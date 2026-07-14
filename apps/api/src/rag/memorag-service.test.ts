import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdtemp } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalFavoriteStore } from "../adapters/local-favorite-store.js"
import { LocalChatRunEventStore } from "../adapters/local-chat-run-event-store.js"
import { LocalChatRunStore } from "../adapters/local-chat-run-store.js"
import type { AppUser } from "../auth.js"
import { LocalDocumentIngestRunEventStore } from "../adapters/local-document-ingest-run-event-store.js"
import { LocalDocumentIngestRunStore } from "../adapters/local-document-ingest-run-store.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import type { AgentRuntimeProvider, AsyncAgentRun, AuthoritativeAdmissionContext, BenchmarkRunner, DebugTrace, FolderPolicyEntry, ManagedUser } from "../types.js"
import type { UserDirectory } from "../adapters/user-directory.js"
import type { VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { CodeBuildLogReader } from "../adapters/codebuild-log-reader.js"
import {
  DocumentShareConflictError,
  DocumentShareValidationError
} from "../documents/document-permission-service.js"
import type { ResourceUserPrincipal } from "../security/resource-group-membership-service.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditIntent
} from "../security/security-mutation-audit-outbox.js"
import { CommandAsyncAgentProvider } from "../async-agent/command-provider.js"
import { AsyncAgentProviderRegistry, type AsyncAgentProviderAdapter, type AsyncAgentProviderInput } from "../async-agent/provider.js"
import { ragRuntimePolicy } from "../chat-orchestration/runtime-policy.js"
import { authorizeDocumentDelete } from "../routes/benchmark-seed.js"
import { config } from "../config.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import { createBenchmarkArtifactDownloadMetadata, createDebugTraceDownloadMetadata, formatDebugTraceJson, MemoRagService, tenantPartitionedOwnerKey } from "./memorag-service.js"

test("service ingests text, lists manifests, persists debug traces, and deletes all document vectors", async () => {
  const { service, dataDir } = await createService()

  const manifest = await service.ingest({
    fileName: "requirements.txt",
    text: "ソフトウェア要求の分類。ソフトウェア製品要求、ソフトウェアプロジェクト要求、機能要求、非機能要求、技術制約、サービス品質制約。",
    metadata: { owner: "qa" }
  })

  assert.equal(manifest.fileName, "requirements.txt")
  assert.equal(manifest.chunkCount, 1)
  assert.ok(manifest.memoryCardCount >= 1)
  assert.ok(manifest.memoryCardsObjectKey)
  assert.ok(manifest.evidenceVectorKeys?.length)
  assert.ok(manifest.memoryVectorKeys?.length)
  assert.equal(manifest.pipelineVersions?.chunkerVersion, "chunk-structure-aware-2026-07-11.v1")
  assert.ok(manifest.chunks?.[0]?.chunkHash)
  assert.equal(manifest.documentStatistics?.chunkCount, manifest.chunkCount)
  assert.ok((manifest.documentStatistics?.averageChunkChars ?? 0) > 0)

  const listed = await service.listDocuments()
  assert.deepEqual(listed.map((doc) => doc.documentId), [manifest.documentId])

  const answer = await service.chat({
    question: "ソフトウェア要求の分類を洗い出して",
    includeDebug: true,
    minScore: 0.01
  })
  assert.equal(answer.isAnswerable, true, JSON.stringify(answer))
  assert.ok(answer.debug?.runId)
  assert.equal(answer.debug?.schemaVersion, 1)
  assert.equal(answer.debug?.pipelineVersions, undefined)
  assert.equal(answer.debug?.replayVersionManifest?.promptVersion, manifest.pipelineVersions?.promptVersion)
  assert.equal(answer.debug?.replayVersionManifest?.parserVersion, manifest.sourceExtractorVersion)
  assert.equal(answer.debug?.replayVersionManifest?.sourceSnapshots[0]?.ingestTraceId, manifest.traceId)
  assert.equal(answer.debug?.requestTraceId, answer.debug?.runId)
  assert.ok((answer.debug?.parentTraceIds?.length ?? 0) > 0)
  const parentSearchTrace = await service.getDebugRun(answer.debug?.parentTraceIds?.[0] ?? "")
  assert.equal(parentSearchTrace?.requestTraceId, answer.debug?.runId)
  assert.ok(parentSearchTrace?.parentTraceIds?.includes(manifest.traceId ?? ""))
  assert.equal(answer.debug?.steps.at(-1)?.label, "finalize_response")
  assert.match(answer.answer, /ソフトウェア製品要求|分類/)
  assert.equal(answer.debug?.steps.at(-1)?.output, undefined)

  const debugRuns = await service.listDebugRuns()
  const chatDebugRuns = debugRuns.filter((trace) => trace.runId === answer.debug?.runId)
  assert.equal(chatDebugRuns.length, 1)
  assert.deepEqual(await service.getDebugRun(answer.debug?.runId ?? ""), chatDebugRuns[0])

  const ordinaryAnswer = await service.chat({
    question: "機能要求と非機能要求を教えて",
    minScore: 0.01
  })
  assert.equal(ordinaryAnswer.isAnswerable, true)
  assert.equal(ordinaryAnswer.debug, undefined, "ordinary response must not expose operator trace")
  const afterOrdinary = await service.listDebugRuns()
  const persistedOrdinary = afterOrdinary.find((trace) => (
    trace.runId !== answer.debug?.runId
    && !trace.runId.startsWith("search_")
    && trace.requestTraceId === trace.runId
  ))
  assert.ok(persistedOrdinary, "ordinary answer must persist a tenant-partitioned redacted trace")
  assert.match(persistedOrdinary?.tenantPartitionId ?? "", /^tenant:[a-f0-9]{24}$/)
  assert.match(persistedOrdinary?.question ?? "", /^sha256:[a-f0-9]{64}$/)
  assert.ok((persistedOrdinary?.parentTraceIds?.length ?? 0) > 0)

  const deleted = await service.deleteDocument(localDocumentManager(), manifest.documentId, {
    reason: "test cleanup",
    expectedUpdatedAt: manifest.updatedAt ?? manifest.createdAt
  })
  assert.equal(deleted.documentId, manifest.documentId)
  assert.equal(deleted.deletedVectorCount, manifest.vectorKeys.length)
  assert.deepEqual(await service.listDocuments(), [])

  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as { records: unknown[] }
  const memoryDb = JSON.parse(await readFile(path.join(dataDir, "memory-vectors.json"), "utf-8")) as { records: unknown[] }
  assert.equal(evidenceDb.records.length, 0)
  assert.equal(memoryDb.records.length, 0)
})

test("service rejects empty uploads and missing documents", async () => {
  const { service } = await createService()

  await assert.rejects(() => service.ingest({ fileName: "empty.txt", text: "   " }), /extractable text|No chunks/)
  await assert.rejects(() => service.deleteDocument(localDocumentManager(), "missing-document-id", {
    reason: "missing document cleanup",
    expectedUpdatedAt: "2026-07-11T00:00:00.000Z"
  }))
  assert.equal(await service.getDebugRun("missing-run"), undefined)
})

test("FR-066 failed ingest compensation persists a tenant-scoped cleanup reconciliation manifest", async () => {
  const { service, deps } = await createService({
    evidencePutErrorAfterWriteWhen: () => true,
    evidenceDeleteErrorAfterWrite: new Error("simulated vector cleanup outage")
  })

  await assert.rejects(() => service.ingest({
    fileName: "cleanup-reconciliation.txt",
    text: "A partial vector write must leave a durable cleanup manifest.",
    skipMemory: true
  }), /simulated partial active put failure/)

  const keys = await deps.objectStore.listKeys("security/revocation-cleanup/")
  assert.equal(keys.length, 1)
  const manifest = JSON.parse(await deps.objectStore.getText(keys[0]!)) as {
    tenantId: string
    trigger: string
    status: string
    targets: Array<{ scope: string }>
  }
  assert.equal(manifest.tenantId, "default")
  assert.equal(manifest.trigger, "deleted")
  assert.equal(manifest.status, "cleanup_pending")
  assert.ok(manifest.targets.some((target) => target.scope === "active_index"))
  assert.deepEqual(await service.listDocuments(), [])
})

test("document share API uses the loaded policy version and common security audit path", async () => {
  const { service, deps } = await createService({
    resourceUserPrincipals: [
      { userId: "local-dev", tenantId: "default", status: "active" },
      { userId: "reader-active", tenantId: "default", status: "active" },
      { userId: "reader-inactive", tenantId: "default", status: "suspended" },
      { userId: "reader-other-tenant", tenantId: "tenant-b", status: "active" }
    ]
  })
  const actor = localDocumentManager()
  const manifest = await service.ingest({
    fileName: "versioned-share.txt",
    text: "Versioned document share contract.",
    skipMemory: true,
    metadata: { tenantId: "default", ownerUserId: actor.userId }
  })

  const loaded = await service.getDocumentShareInfo(actor, manifest.documentId)
  assert.ok(loaded.version)
  assert.deepEqual(loaded.directDocumentGrants, [])

  const updated = await service.updateDocumentShare(actor, manifest.documentId, {
    grants: [{ principalType: "user", principalId: "reader-active", permissionLevel: "readOnly" }],
    expectedVersion: loaded.version,
    reason: "active same-tenant review"
  })
  assert.notEqual(updated.version, loaded.version)
  assert.deepEqual(updated.directDocumentGrants.map((grant) => grant.principalId), ["reader-active"])

  await assert.rejects(() => service.updateDocumentShare(actor, manifest.documentId, {
    grants: [],
    expectedVersion: loaded.version,
    reason: "stale writer"
  }), DocumentShareConflictError)
  await assert.rejects(() => service.updateDocumentShare(actor, manifest.documentId, {
    grants: [{ principalType: "user", principalId: "reader-inactive", permissionLevel: "readOnly" }],
    expectedVersion: updated.version,
    reason: "inactive principal"
  }), DocumentShareValidationError)
  await assert.rejects(() => service.updateDocumentShare(actor, manifest.documentId, {
    grants: [{ principalType: "user", principalId: "reader-other-tenant", permissionLevel: "readOnly" }],
    expectedVersion: updated.version,
    reason: "cross-tenant principal"
  }), DocumentShareValidationError)

  const current = await service.getDocumentShareInfo(actor, manifest.documentId)
  assert.equal(current.version, updated.version)
  assert.deepEqual(current.directDocumentGrants.map((grant) => grant.principalId), ["reader-active"])
  assert.deepEqual(await deps.objectStore.listKeys("documents/share-audit/"), [])

  const auditIntents = await readSecurityMutationAuditIntents(deps)
  assert.deepEqual(auditIntents.map((intent) => intent.result).sort(), ["conflict", "denied", "denied", "success"])
  assert.ok(auditIntents.every((intent) => intent.status === "completed"))
  assert.ok(auditIntents.every((intent) => intent.draft.actorId === actor.userId))
  assert.ok(auditIntents.every((intent) => intent.draft.tenantId === "default"))
  assert.ok(auditIntents.every((intent) => intent.draft.targetId === manifest.documentId))
  assert.ok(auditIntents.every((intent) => intent.draft.policyVersion === "document-share-policy-v1"))
  assert.deepEqual(
    auditIntents.map((intent) => intent.draft.reason).sort(),
    ["active same-tenant review", "cross-tenant principal", "inactive principal", "stale writer"]
  )
})

test("service manages async agent run metadata without provider execution or mock artifacts", async () => {
  const { service, deps } = await createService()
  const owner: AppUser = { userId: "agent-owner", email: "agent-owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const other: AppUser = { userId: "other-user", email: "other@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const admin: AppUser = { userId: "agent-admin", email: "agent-admin@example.com", cognitoGroups: ["ASYNC_AGENT_ADMIN"], accountStatus: "active" as const, tenantId: "default" }
  const otherTenantAdmin: AppUser = { userId: "tenant-b-admin", cognitoGroups: ["ASYNC_AGENT_ADMIN"], accountStatus: "active", tenantId: "tenant-b" }
  const group = await service.createDocumentGroup(owner, { name: "Agent source group" })
  const manifest = await service.ingest({
    fileName: "agent-source.md",
    text: "非同期エージェントの対象資料です。",
    skipMemory: true,
    metadata: { groupIds: [group.groupId], scopeType: "group" }
  })

  const run = await service.createAsyncAgentRun(owner, {
    provider: "custom",
    modelId: "custom-model",
    instruction: "対象資料を確認する",
    selectedDocumentIds: [manifest.documentId, manifest.documentId],
    selectedFolderIds: [group.groupId, group.groupId],
    selectedSkillIds: ["skill-a", "skill-a"],
    selectedAgentProfileIds: ["profile-a", "profile-a"],
    budget: { maxToolCalls: 10 }
  })

  assert.equal(run.agentRunId, run.runId)
  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "disabled")
  assert.equal(run.failureReasonCode, "not_configured")
  assert.deepEqual(run.selectedDocumentIds, [manifest.documentId])
  assert.deepEqual(run.selectedFolderIds, [group.groupId])
  assert.deepEqual(run.selectedSkillIds, ["skill-a"])
  assert.deepEqual(run.selectedAgentProfileIds, ["profile-a"])
  assert.equal(run.workspaceMounts.length, 2)
  assert.ok(run.workspaceMounts.every((mount) => mount.accessMode === "readOnly"))
  assert.deepEqual(run.artifactIds, [])
  assert.deepEqual(run.artifacts, [])

  assert.equal((await service.getAsyncAgentRun(owner, run.agentRunId))?.agentRunId, run.agentRunId)
  assert.equal((await service.getAsyncAgentRun(admin, run.agentRunId))?.agentRunId, run.agentRunId)
  assert.equal(await service.getAsyncAgentRun(otherTenantAdmin, run.agentRunId), undefined)
  await assert.rejects(() => service.getAsyncAgentRun(other, run.agentRunId), /Forbidden/)
  assert.deepEqual(await service.listAsyncAgentRuns(owner), [run])
  assert.deepEqual(await service.listAsyncAgentRuns(other), [])
  assert.equal((await service.listAsyncAgentRuns(admin))[0]?.agentRunId, run.agentRunId)
  assert.deepEqual(await service.listAsyncAgentRuns(otherTenantAdmin), [])
  assert.equal(await service.getAsyncAgentArtifact(otherTenantAdmin, run.agentRunId, "missing-artifact"), undefined)

  const unavailable = await service.createAsyncAgentRun(owner, {
    provider: "unknown_provider" as never,
    modelId: "unknown-model",
    instruction: "未設定 provider は実行しない",
    selectedDocumentIds: [],
    selectedFolderIds: [],
    selectedSkillIds: [],
    selectedAgentProfileIds: []
  })
  assert.equal(unavailable.status, "blocked")
  assert.equal(unavailable.providerAvailability, "provider_unavailable")
  assert.equal(unavailable.failureReasonCode, "provider_unavailable")
  assert.deepEqual(unavailable.workspaceMounts, [])
  assert.deepEqual(unavailable.artifacts, [])

  const cancelled = await service.cancelAsyncAgentRun(owner, run.agentRunId)
  assert.equal(cancelled?.status, "cancelled")
  assert.equal(cancelled?.failureReasonCode, "cancelled")
  assert.equal((await service.cancelAsyncAgentRun(owner, run.agentRunId))?.updatedAt, cancelled?.updatedAt)
  assert.deepEqual(await service.listAsyncAgentArtifacts(owner, run.agentRunId), [])
  assert.equal(await service.getAsyncAgentArtifact(owner, run.agentRunId, "missing-artifact"), undefined)
  assert.equal(await service.getAsyncAgentRun(owner, "missing-run"), undefined)
  assert.equal(await service.cancelAsyncAgentRun(owner, "missing-run"), undefined)
  assert.equal(await service.listAsyncAgentArtifacts(owner, "missing-run"), undefined)
  await assert.rejects(() => service.executeAsyncAgentRun("default", "missing-run"), /Async agent run not found/)

  const queuedRun: AsyncAgentRun = {
    ...run,
    agentRunId: "agent_queued_fixture",
    runId: "agent_queued_fixture",
    status: "queued",
    provider: "codex",
    providerAvailability: "not_configured",
    failureReasonCode: undefined,
    failureReason: undefined,
    artifactIds: ["artifact_report_fixture"],
    artifacts: [{
      artifactId: "artifact_report_fixture",
      agentRunId: "agent_queued_fixture",
      artifactType: "report",
      fileName: "report.md",
      mimeType: "text/markdown",
      size: 12,
      storageRef: "agent-artifacts/agent_queued_fixture/report.md",
      createdAt: run.createdAt,
      writebackStatus: "not_requested"
    }],
    completedAt: undefined
  }
  await deps.objectStore.putText(`agent-runs/${tenantPartitionId("default")}/runs/agent_queued_fixture.json`, JSON.stringify(queuedRun), "application/json; charset=utf-8")

  const blockedByWorkerContract = await service.executeAsyncAgentRun("default", "agent_queued_fixture")
  assert.equal(blockedByWorkerContract.status, "blocked")
  assert.equal(blockedByWorkerContract.failureReasonCode, "not_configured")
  assert.equal((await service.getAsyncAgentArtifact(owner, "agent_queued_fixture", "artifact_report_fixture"))?.fileName, "report.md")
  assert.equal((await service.listAsyncAgentArtifacts(owner, "agent_queued_fixture"))?.length, 1)
})

test("service treats object-store missing variants as absent async agent runs", async () => {
  const owner: AppUser = { userId: "agent-owner", email: "agent-owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const missingVariants = [
    Object.assign(new Error("object missing"), { Code: "NoSuchKey" }),
    Object.assign(new Error("object missing"), { name: "NoSuchKey" }),
    Object.assign(new Error("object missing"), { name: "NotFound" }),
    Object.assign(new Error("object missing"), { $metadata: { httpStatusCode: 404 } }),
    new Error("NoSuchKey: object missing"),
    new Error("ENOENT: object missing")
  ]

  for (const [index, objectGetError] of missingVariants.entries()) {
    const { service } = await createService({
      objectGetErrorPrefix: `agent-runs/${tenantPartitionId("default")}/runs/missing-${index}`,
      objectGetError
    })
    assert.equal(await service.getAsyncAgentRun(owner, `missing-${index}`), undefined)
  }
})

test("service surfaces non-missing async agent run load errors", async () => {
  const owner: AppUser = { userId: "agent-owner", email: "agent-owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const { service } = await createService({
    objectGetErrorPrefix: `agent-runs/${tenantPartitionId("default")}/runs/broken`,
    objectGetError: new Error("object store unavailable")
  })
  await assert.rejects(() => service.getAsyncAgentRun(owner, "broken"), /object store unavailable/)
})

test("service listDocuments filters manifests by ACL for callers", async () => {
  const { service, deps } = await createService()
  const chatUser = { userId: "chat-1", email: "chat@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const benchmarkRunner = { userId: "runner-1", email: "runner@example.com", cognitoGroups: ["BENCHMARK_RUNNER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const systemAdmin = { userId: "admin-1", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }
  const generalGroup = await service.createDocumentGroup(chatUser, { name: "General readers" })
  await seedFolderPolicy(deps, generalGroup.groupId, [
    { principalType: "user", principalId: chatUser.userId, permissionLevel: "full" },
    { principalType: "user", principalId: benchmarkRunner.userId, permissionLevel: "readOnly" }
  ])
  const benchmarkGroup = await service.createDocumentGroup(benchmarkRunner, { name: "Benchmark readers" })
  const general = await service.ingest({
    fileName: "general.md",
    text: "通常利用者向けの資料です。",
    skipMemory: true,
    metadata: { groupIds: [generalGroup.groupId], scopeType: "group" }
  })
  const benchmark = await service.ingest({
    fileName: "handbook.md",
    text: "経費精算は30日以内です。",
    skipMemory: true,
    metadata: {
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      source: "benchmark-runner",
      lifecycleStatus: "active",
      groupIds: [benchmarkGroup.groupId],
      scopeType: "group"
    }
  })

  assert.deepEqual((await service.listDocuments(chatUser)).map((doc) => doc.documentId), [general.documentId])
  assert.deepEqual((await service.listDocuments(benchmarkRunner)).map((doc) => doc.documentId).sort(), [benchmark.documentId, general.documentId].sort())
  assert.deepEqual((await service.listDocuments(systemAdmin)).map((doc) => doc.documentId), [])
})

test("service listDocuments hides normal manifests without group owner or ACL from callers", async () => {
  const { service } = await createService()
  const hidden = await service.ingest({
    fileName: "no-acl.md",
    text: "ACL がない通常資料です。",
    skipMemory: true
  })
  const caller = { userId: "chat-1", email: "chat@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const systemAdmin = { userId: "admin-1", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }

  assert.deepEqual((await service.listDocuments(caller)).map((doc) => doc.documentId), [])
  assert.deepEqual((await service.listDocuments(systemAdmin)).map((doc) => doc.documentId), [])
  assert.deepEqual((await service.listDocuments(localDocumentManager())).map((doc) => doc.documentId), [hidden.documentId])
})

test("service persists document quality profile and excludes ineligible documents from normal RAG search", async () => {
  const { service, dataDir } = await createService()
  const eligible = await service.ingest({
    fileName: "eligible.md",
    text: "通常 RAG で利用できる資料です。",
    skipMemory: true
  })
  const excluded = await service.ingest({
    fileName: "excluded.md",
    text: "品質管理により通常 RAG から除外する資料です。",
    skipMemory: true,
    metadata: {
      ragEligibility: "excluded",
      verificationStatus: "rejected",
      freshnessStatus: "expired",
      supersessionStatus: "superseded",
      extractionQualityStatus: "unusable",
      qualityFlags: ["manual_rag_exclusion"]
    }
  })

  assert.equal(eligible.qualityProfile?.ragEligibility, "eligible")
  assert.equal(excluded.qualityProfile?.ragEligibility, "excluded")
  assert.equal(excluded.qualityProfile?.verificationStatus, "rejected")
  assert.deepEqual((await service.listDocuments()).map((doc) => doc.documentId).sort(), [eligible.documentId, excluded.documentId].sort())
  const search = await service.search(
    { query: "品質管理", topK: 5, lexicalTopK: 5, semanticTopK: 0 },
    { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  )
  assert.deepEqual(search.results, [])

  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as { records: Array<{ key: string; metadata: Record<string, unknown> }> }
  const excludedVectorMetadata = evidenceDb.records.find((record) => record.key.startsWith(excluded.documentId))?.metadata
  assert.equal(excludedVectorMetadata?.ragEligibility, "excluded")
  assert.equal(excludedVectorMetadata?.verificationStatus, undefined)
  assert.equal(excludedVectorMetadata?.qualityFlags, undefined)
})

test("service listDocuments skips a manifest that disappeared after listing", async () => {
  const { service } = await createService({ objectListExtraKeys: ["manifests/stale-missing.json"] })
  const manifest = await service.ingest({
    fileName: "active.md",
    text: "active document content",
    skipMemory: true
  })

  const listed = await service.listDocuments()

  assert.deepEqual(listed.map((doc) => doc.documentId), [manifest.documentId])
})

test("benchmark seed delete authorization reads only the target manifest", async () => {
  const { service } = await createService({ objectListExtraKeys: ["manifests/stale-missing.json"] })
  const benchmarkTenantId = config.benchmarkEvaluationTenantId
  const benchmark = await service.ingest({
    fileName: "benchmark.md",
    text: "benchmark corpus content",
    skipMemory: true,
    admissionContext: {
      mode: "local_test_fixture",
      fixtureId: "benchmark-seed-delete",
      tenantId: benchmarkTenantId,
      ownerUserId: "benchmark-evaluation:standard-agent-v1"
    },
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "smoke-agent-v1",
      benchmarkSourceHash: "hash",
      benchmarkIngestSignature: "signature",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner",
      scopeType: "benchmark",
      tenantId: benchmarkTenantId,
      ownerUserId: "benchmark-evaluation:standard-agent-v1"
    }
  })
  const general = await service.ingest({
    fileName: "general.md",
    text: "general document content",
    skipMemory: true
  })
  service.listDocuments = async () => {
    throw new Error("authorizeDocumentDelete must not list all manifests")
  }
  const benchmarkRunner = { userId: "runner-1", email: "runner@example.com", cognitoGroups: ["BENCHMARK_RUNNER"], accountStatus: "active" as const, tenantId: benchmarkTenantId }

  await authorizeDocumentDelete(service, benchmarkRunner, benchmark.documentId)
  await assert.rejects(() => authorizeDocumentDelete(service, benchmarkRunner, general.documentId), (error) => {
    assert.equal(typeof error, "object")
    assert.equal((error as { status?: number }).status, 403)
    return true
  })
})

test("service keeps rich drawing metadata out of vector filter metadata", async () => {
  const { service, dataDir } = await createService()
  const manifest = await service.ingest({
    fileName: "drawing.md",
    text: "建築標準詳細図の表示記号と略号について説明する benchmark corpus content.",
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "architecture-drawing-qarag-v0.1",
      benchmarkSourceHash: "hash",
      benchmarkIngestSignature: "signature",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner",
      expiresAt: "2026-06-01T00:00:00.000Z",
      domainPolicy: "architecture-drawing",
      ragPolicy: "drawing-qarag",
      answerPolicy: "grounded-only",
      drawingSourceType: "standard_detail",
      pageOrSheet: "P1 / sheet 1-01",
      drawingNo: "1-01",
      sheetTitle: "床: 仕上げ",
      scale: "1/5",
      regionId: "s01-titleblock-001",
      regionType: "titleblock",
      sourceType: "pdf_text",
      drawingSheetMetadata: [{ pageOrSheet: "P1", sheetTitle: "表示記号及び略号", sourceQaIds: ["QA-001"] }],
      drawingRegionIndex: [{ regionId: "s01-titleblock-001", regionType: "titleblock", sourceQaIds: ["QA-001"] }],
      drawingReferenceGraph: { schemaVersion: 1, nodes: [{ nodeId: "n1" }], edges: [] },
      drawingExtractionArtifacts: [{ artifactId: "a1", sourceMethod: "pdf_text" }]
    }
  })

  assert.equal(manifest.metadata?.drawingSheetMetadata instanceof Array, true)
  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as { records: Array<{ metadata: Record<string, unknown> }> }
  const vectorMetadata = evidenceDb.records[0]?.metadata
  assert.equal(vectorMetadata?.drawingSourceType, "standard_detail")
  assert.equal(vectorMetadata?.expiresAt, "2026-06-01T00:00:00.000Z")
  assert.equal(vectorMetadata?.domainPolicy, "architecture-drawing")
  assert.equal(vectorMetadata?.ragPolicy, "drawing-qarag")
  assert.equal(vectorMetadata?.answerPolicy, "grounded-only")
  assert.equal(vectorMetadata?.pageOrSheet, "P1 / sheet 1-01")
  assert.equal(vectorMetadata?.drawingNo, "1-01")
  assert.equal(vectorMetadata?.sheetTitle, "床: 仕上げ")
  assert.equal(vectorMetadata?.scale, "1/5")
  assert.equal(vectorMetadata?.regionId, "s01-titleblock-001")
  assert.equal(vectorMetadata?.regionType, "titleblock")
  assert.equal(vectorMetadata?.sourceType, "pdf_text")
  assert.equal(vectorMetadata?.drawingSheetMetadata, undefined)
  assert.equal(vectorMetadata?.drawingRegionIndex, undefined)
  assert.equal(vectorMetadata?.drawingReferenceGraph, undefined)
  assert.equal(vectorMetadata?.drawingExtractionArtifacts, undefined)
})

test("service listDocuments denies group-scoped manifests to non-members without legacy ACLs", async () => {
  const { service, deps } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const member = { userId: "member-1", email: "member@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const outsider = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const group = await service.createDocumentGroup(owner, { name: "Private launch group" })
  await seedFolderPolicy(deps, group.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" },
    { principalType: "user", principalId: member.userId, permissionLevel: "readOnly" }
  ])
  const groupDoc = await service.ingest({
    fileName: "group-secret.md",
    text: "group scope only launch plan.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: owner.userId,
      groupIds: [group.groupId]
    }
  })

  assert.deepEqual((await service.listDocuments(outsider)).map((doc) => doc.documentId), [])
  assert.deepEqual((await service.listDocuments(owner)).map((doc) => doc.documentId), [groupDoc.documentId])
  assert.deepEqual((await service.listDocuments(member)).map((doc) => doc.documentId), [groupDoc.documentId])
})

test("service stores hierarchy outside S3 and legacy metadata update cannot move or share folders", async () => {
  const { service, deps } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const parent = await service.createDocumentGroup(owner, { name: "社内規定" })
  const child = await service.createDocumentGroup(owner, {
    name: "人事",
    parentGroupId: parent.groupId
  })
  const grandchild = await service.createDocumentGroup(owner, {
    name: "採用",
    parentGroupId: child.groupId
  })
  const anotherParent = await service.createDocumentGroup(owner, { name: "全社共有" })

  assert.equal(child.parentGroupId, parent.groupId)
  assert.deepEqual(child.ancestorGroupIds, [parent.groupId])
  assert.deepEqual(grandchild.ancestorGroupIds, [parent.groupId, child.groupId])
  assert.equal((await deps.objectStore.listKeys("document-groups/")).length, 0)

  const rejectedAuthority = {
    description: "metadata only",
    parentGroupId: anotherParent.groupId,
    visibility: "shared",
    sharedGroups: ["HR"]
  } as unknown as Parameters<MemoRagService["updateDocumentGroupSharing"]>[2]
  const updated = await service.updateDocumentGroupSharing(owner, child.groupId, rejectedAuthority)
  assert.equal(updated?.description, "metadata only")
  assert.equal(updated?.parentGroupId, parent.groupId)
  assert.deepEqual(updated?.ancestorGroupIds, [parent.groupId])
  assert.deepEqual(updated?.sharedGroups, [])
  assert.equal(updated?.visibility, "private")
  assert.deepEqual((await deps.documentGroupStore.get("default", grandchild.groupId))?.ancestorGroupIds, [parent.groupId, child.groupId])
})

test("service assigns canonical paths to the actor user and ignores requested administrative principals", async () => {
  const { service } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER", "TEAM_A"], accountStatus: "active" as const, tenantId: "default" }
  const otherOwner = { userId: "owner-2", email: "owner2@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const systemAdmin = { userId: "admin-1", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }

  const root = await service.createDocumentGroup(owner, { name: "Team" })
  const child = await service.createDocumentGroup(owner, { name: "Spec", parentGroupId: root.groupId })
  const rootSibling = await service.createDocumentGroup(owner, { name: "Spec" })
  const otherOwnerRoot = await service.createDocumentGroup(otherOwner, { name: "Team" })
  const attemptedGroupManagedRoot = await service.createDocumentGroup(owner, {
    name: "Escalation attempt",
    adminPrincipalType: "group",
    adminPrincipalId: "TEAM_A"
  } as unknown as Parameters<MemoRagService["createDocumentGroup"]>[1])
  const attemptedSystemAdminBypass = await service.createDocumentGroup(systemAdmin, {
    name: "System admin escalation attempt",
    adminPrincipalType: "group",
    adminPrincipalId: "UNKNOWN_ADMIN_GROUP"
  } as unknown as Parameters<MemoRagService["createDocumentGroup"]>[1])

  assert.equal(root.canonicalPath, "/Team")
  assert.equal(root.normalizedCanonicalPath, "/team")
  assert.equal(root.adminPathPk, "default#user#owner-1")
  assert.equal(child.canonicalPath, "/Team/Spec")
  assert.equal(child.normalizedCanonicalPath, "/team/spec")
  assert.equal(rootSibling.canonicalPath, "/Spec")
  assert.equal(otherOwnerRoot.adminPathPk, "default#user#owner-2")
  assert.equal(attemptedGroupManagedRoot.adminPrincipalType, "user")
  assert.equal(attemptedGroupManagedRoot.adminPrincipalId, owner.userId)
  assert.equal(attemptedGroupManagedRoot.adminPathPk, "default#user#owner-1")
  assert.equal(attemptedGroupManagedRoot.visibility, "private")
  assert.deepEqual(attemptedGroupManagedRoot.sharedUserIds, [])
  assert.deepEqual(attemptedGroupManagedRoot.sharedGroups, [])
  assert.deepEqual(attemptedGroupManagedRoot.managerUserIds, [owner.userId])
  assert.equal(attemptedSystemAdminBypass.adminPrincipalType, "user")
  assert.equal(attemptedSystemAdminBypass.adminPrincipalId, systemAdmin.userId)
  assert.equal(attemptedSystemAdminBypass.adminPathPk, "default#user#admin-1")

  await assert.rejects(() => service.createDocumentGroup(owner, { name: "team" }), /canonical path already exists/)
  await assert.rejects(() => service.createDocumentGroup(owner, { name: "Forbidden/Name" }), /unsupported characters/)
  await assert.rejects(() => service.createDocumentGroup(owner, { name: "Forbidden\u0001Name" }), /unsupported characters/)
  await assert.rejects(() => service.createDocumentGroup(owner, { name: "   " }), /name is required/)
})

test("service recalculates descendant canonical paths and local lock items on rename", async () => {
  const { service, dataDir } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const source = await service.createDocumentGroup(owner, { name: "Source" })
  const child = await service.createDocumentGroup(owner, { name: "Child", parentGroupId: source.groupId })
  const grandchild = await service.createDocumentGroup(owner, { name: "Grandchild", parentGroupId: child.groupId })

  const renamed = await service.updateDocumentGroupSharing(owner, child.groupId, { name: "Renamed" })
  assert.equal(renamed?.canonicalPath, "/Source/Renamed")
  assert.deepEqual(renamed?.ancestorGroupIds, [source.groupId])

  const groups = await service.listDocumentGroups(owner)
  const movedGrandchild = groups.find((group) => group.groupId === grandchild.groupId)
  assert.equal(movedGrandchild?.canonicalPath, "/Source/Renamed/Grandchild")
  assert.deepEqual(movedGrandchild?.ancestorGroupIds, [source.groupId, child.groupId])

  const db = JSON.parse(await readFile(path.join(
    dataDir,
    "document-groups",
    tenantPartitionId("default"),
    "items.json"
  ), "utf-8")) as { pathLocks?: Array<{ lockedGroupId: string; normalizedCanonicalPath: string }> }
  assert.ok(db.pathLocks?.some((lock) => lock.lockedGroupId === child.groupId && lock.normalizedCanonicalPath === "/source/renamed"))
  assert.ok(db.pathLocks?.some((lock) => lock.lockedGroupId === grandchild.groupId && lock.normalizedCanonicalPath === "/source/renamed/grandchild"))
  assert.equal(db.pathLocks?.some((lock) => lock.lockedGroupId === child.groupId && lock.normalizedCanonicalPath === "/source/child"), false)
})

test("service legacy metadata update ignores runtime parent mutation fields", async () => {
  const { service, dataDir } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const root = await service.createDocumentGroup(owner, { name: "Root" })
  const child = await service.createDocumentGroup(owner, { name: "Child", parentGroupId: root.groupId })
  const grandchild = await service.createDocumentGroup(owner, { name: "Grandchild", parentGroupId: child.groupId })
  await service.createDocumentGroup(owner, { name: "Sibling", parentGroupId: root.groupId })

  const rejectedMove = { description: "metadata only", parentGroupId: null } as unknown as Parameters<MemoRagService["updateDocumentGroupSharing"]>[2]
  const updated = await service.updateDocumentGroupSharing(owner, child.groupId, rejectedMove)

  assert.equal(updated?.description, "metadata only")
  assert.equal(updated?.parentGroupId, root.groupId)
  assert.deepEqual(updated?.ancestorGroupIds, [root.groupId])
  assert.equal(updated?.canonicalPath, "/Root/Child")
  assert.equal(updated?.normalizedCanonicalPath, "/root/child")

  const groups = await service.listDocumentGroups(owner)
  const movedGrandchild = groups.find((group) => group.groupId === grandchild.groupId)
  assert.equal(movedGrandchild?.canonicalPath, "/Root/Child/Grandchild")
  assert.deepEqual(movedGrandchild?.ancestorGroupIds, [root.groupId, child.groupId])

  const db = JSON.parse(await readFile(path.join(
    dataDir,
    "document-groups",
    tenantPartitionId("default"),
    "items.json"
  ), "utf-8")) as { pathLocks?: Array<{ lockedGroupId: string; normalizedCanonicalPath: string }> }
  assert.ok(db.pathLocks?.some((lock) => lock.lockedGroupId === child.groupId && lock.normalizedCanonicalPath === "/root/child"))
  assert.ok(db.pathLocks?.some((lock) => lock.lockedGroupId === grandchild.groupId && lock.normalizedCanonicalPath === "/root/child/grandchild"))
  assert.equal(db.pathLocks?.some((lock) => lock.lockedGroupId === child.groupId && lock.normalizedCanonicalPath === "/child"), false)

  await assert.rejects(
    () => service.updateDocumentGroupSharing(owner, child.groupId, { name: "Sibling" }),
    /canonical path already exists/
  )
})

test("service normalizes legacy document groups on read", async () => {
  const { service, deps } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  await deps.documentGroupStore.create({
    groupId: "legacy-parent",
    tenantId: "default",
    name: "Legacy",
    ownerUserId: owner.userId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [owner.userId],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  })
  await deps.documentGroupStore.create({
    groupId: "legacy-child",
    tenantId: "default",
    name: "Child",
    parentGroupId: "legacy-parent",
    ownerUserId: owner.userId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [owner.userId],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  })

  const groups = await service.listDocumentGroups(owner)
  assert.equal(groups.find((group) => group.groupId === "legacy-parent")?.canonicalPath, "/Legacy")
  assert.equal(groups.find((group) => group.groupId === "legacy-child")?.canonicalPath, "/Legacy/Child")
  assert.equal(groups.find((group) => group.groupId === "legacy-child")?.adminPathPk, "default#user#owner-1")
})

test("service enforces document group management and search scope boundaries", async () => {
  const { service, deps } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const manager = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["CHAT_USER", "RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const outsider = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const admin = { userId: "admin-1", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }

  assert.equal(await service.updateDocumentGroupSharing(owner, "missing-group", { description: "missing" }), undefined)
  await service.assertDocumentGroupsWritable(owner, [])
  await service.assertSearchScopeReadable(owner, undefined)
  await assert.rejects(
    () => service.createDocumentGroup(owner, { name: "missing child", parentGroupId: "missing-parent" }),
    /Parent document group not found/
  )

  const parent = await service.createDocumentGroup(owner, { name: "Parent" })
  await seedFolderPolicy(deps, parent.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" },
    { principalType: "user", principalId: manager.userId, permissionLevel: "full" }
  ])
  const child = await service.createDocumentGroup(manager, {
    name: "Child",
    parentGroupId: parent.groupId,
    description: "  private child  "
  })
  const privateParent = await service.createDocumentGroup(owner, {
    name: "Private parent"
  })

  assert.equal(child.description, "private child")
  assert.equal(child.adminPrincipalType, "user")
  assert.equal(child.adminPrincipalId, manager.userId)
  assert.equal(child.visibility, "private")
  assert.deepEqual(child.sharedUserIds, [])
  assert.deepEqual(child.sharedGroups, [])
  assert.deepEqual(child.managerUserIds, [manager.userId])
  await assert.rejects(
    () => service.createDocumentGroup(outsider, { name: "Forbidden child", parentGroupId: parent.groupId }),
    /Forbidden: cannot create a child group/
  )
  await assert.rejects(
    () => service.updateDocumentGroupSharing(outsider, parent.groupId, { description: "forbidden" }),
    /only group managers/
  )
  const rejectedMove = { parentGroupId: privateParent.groupId } as unknown as Parameters<MemoRagService["updateDocumentGroupSharing"]>[2]
  const unchangedChild = await service.updateDocumentGroupSharing(manager, child.groupId, rejectedMove)
  assert.equal(unchangedChild?.parentGroupId, parent.groupId)
  await assert.rejects(() => service.assertDocumentGroupsWritable(outsider, [parent.groupId]), /cannot write document group/)
  await assert.rejects(() => service.assertDocumentGroupsWritable(admin, [parent.groupId]), /cannot write document group/)
  await assert.rejects(() => service.assertSearchScopeReadable(outsider, { groupIds: [parent.groupId] }), /cannot read document group/)
  await service.assertSearchScopeReadable(manager, { groupIds: [parent.groupId] })
})

test("service inherits parent document group sharing unless child has explicit policy", async () => {
  const { service, deps } = await createService()
  const owner: AppUser = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const reader: AppUser = { userId: "reader-1", email: "reader@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const outsider: AppUser = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const suspendedReader: AppUser = { ...reader, accountStatus: "suspended" }

  const parent = await service.createDocumentGroup(owner, { name: "Parent policy" })
  await seedFolderPolicy(deps, parent.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" },
    { principalType: "user", principalId: reader.userId, permissionLevel: "readOnly" }
  ])
  const inheritedChild = await service.createDocumentGroup(owner, {
    name: "Inherited child",
    parentGroupId: parent.groupId
  })
  const restrictedChild = await service.createDocumentGroup(owner, {
    name: "Restricted child",
    parentGroupId: parent.groupId
  })
  await seedFolderPolicy(deps, restrictedChild.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" }
  ])
  await service.ingest({
    fileName: "inherited-child.md",
    text: "inherited pear policy is readable through the parent folder sharing.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: owner.userId,
      groupIds: [inheritedChild.groupId]
    }
  })
  await service.ingest({
    fileName: "restricted-child.md",
    text: "restricted mango policy must not leak to the parent shared reader.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: owner.userId,
      groupIds: [restrictedChild.groupId]
    }
  })

  assert.equal(await deps.folderPolicyStore.findByFolderId("default", inheritedChild.groupId), undefined)
  assert.ok(await deps.folderPolicyStore.findByFolderId("default", restrictedChild.groupId))
  assert.deepEqual((await service.listDocumentGroups(reader)).map((group) => group.groupId).sort(), [inheritedChild.groupId, parent.groupId].sort())
  assert.equal((await service.listDocumentGroups(reader)).some((group) => group.groupId === restrictedChild.groupId), false)
  await assert.rejects(() => service.listDocumentGroups(suspendedReader), /Forbidden/)
  assert.deepEqual((await service.listDocuments(reader)).map((document) => document.fileName), ["inherited-child.md"])
  await service.assertSearchScopeReadable(reader, { groupIds: [inheritedChild.groupId] })
  await assert.rejects(() => service.assertDocumentGroupsWritable(reader, [inheritedChild.groupId]), /cannot write document group/)
  await assert.rejects(() => service.assertSearchScopeReadable(reader, { groupIds: [restrictedChild.groupId] }), /cannot read document group/)
  await assert.rejects(() => service.assertSearchScopeReadable(outsider, { groupIds: [inheritedChild.groupId] }), /cannot read document group/)

  const inheritedSearch = await service.search({
    query: "inherited pear",
    topK: 10,
    lexicalTopK: 20,
    semanticTopK: 0,
    scope: { mode: "groups", groupIds: [inheritedChild.groupId] }
  }, reader)
  assert.deepEqual(inheritedSearch.results.map((result) => result.fileName), ["inherited-child.md"])
  assert.equal(JSON.stringify(inheritedSearch).includes("restricted-child"), false)

  await assert.rejects(
    () => service.search({ query: "restricted mango", topK: 10, scope: { mode: "groups", groupIds: [restrictedChild.groupId] } }, reader),
    /cannot read document group/
  )
  await assert.rejects(
    () => service.chat({ question: "restricted mango", searchScope: { mode: "groups", groupIds: [restrictedChild.groupId] } }, reader),
    /cannot read document group/
  )
})

test("service preserves legacy explicit shared child policy when hasExplicitPolicy is false", async () => {
  const { service, deps } = await createService()
  const owner: AppUser = { userId: "owner-legacy", email: "owner-legacy@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const reader: AppUser = { userId: "reader-legacy", email: "reader-legacy@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  await deps.documentGroupStore.create({
    groupId: "legacy-private-parent",
    tenantId: "default",
    name: "Legacy private parent",
    ownerUserId: owner.userId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [owner.userId],
    hasExplicitPolicy: false,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  })
  await deps.documentGroupStore.create({
    groupId: "legacy-shared-child",
    tenantId: "default",
    name: "Legacy shared child",
    parentGroupId: "legacy-private-parent",
    ownerUserId: owner.userId,
    visibility: "shared",
    sharedUserIds: [reader.userId],
    sharedGroups: [],
    managerUserIds: [owner.userId],
    hasExplicitPolicy: false,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  })
  await service.ingest({
    fileName: "legacy-shared-child.md",
    text: "legacy child policy should remain visible to the explicitly shared reader.",
    skipMemory: true,
    metadata: { scopeType: "group", ownerUserId: owner.userId, groupIds: ["legacy-shared-child"] }
  })

  const visibleGroups = await service.listDocumentGroups(reader)
  assert.equal(visibleGroups.some((group) => group.groupId === "legacy-private-parent"), false)
  assert.equal(visibleGroups.some((group) => group.groupId === "legacy-shared-child"), true)
  await service.assertSearchScopeReadable(reader, { groupIds: ["legacy-shared-child"] })
  assert.deepEqual((await service.listDocuments(reader)).map((document) => document.fileName), ["legacy-shared-child.md"])
})

test("service preserves legacy explicit private child policy and does not leak parent sharing", async () => {
  const { service, deps } = await createService()
  const owner: AppUser = { userId: "owner-legacy", email: "owner-legacy@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const reader: AppUser = { userId: "reader-legacy", email: "reader-legacy@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  await deps.documentGroupStore.create({
    groupId: "legacy-shared-parent",
    tenantId: "default",
    name: "Legacy shared parent",
    ownerUserId: owner.userId,
    visibility: "shared",
    sharedUserIds: [reader.userId],
    sharedGroups: [],
    managerUserIds: [owner.userId],
    hasExplicitPolicy: false,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  })
  await deps.documentGroupStore.create({
    groupId: "legacy-private-child",
    tenantId: "default",
    name: "Legacy private child",
    parentGroupId: "legacy-shared-parent",
    ownerUserId: owner.userId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [owner.userId],
    hasExplicitPolicy: false,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  })
  await service.ingest({
    fileName: "legacy-private-child.md",
    text: "legacy private child must not become visible through parent sharing.",
    skipMemory: true,
    metadata: { scopeType: "group", ownerUserId: owner.userId, groupIds: ["legacy-private-child"] }
  })

  const visibleGroups = await service.listDocumentGroups(reader)
  assert.equal(visibleGroups.some((group) => group.groupId === "legacy-shared-parent"), true)
  assert.equal(visibleGroups.some((group) => group.groupId === "legacy-private-child"), false)
  await assert.rejects(
    () => service.assertSearchScopeReadable(reader, { groupIds: ["legacy-private-child"] }),
    /cannot read document group/
  )
  assert.deepEqual(await service.listDocuments(reader), [])
})

test("service annotates visible document groups with effective permission and inheritance source", async () => {
  const { service, deps } = await createService()
  const owner: AppUser = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const reader: AppUser = { userId: "reader-1", email: "reader@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const parent = await service.createDocumentGroup(owner, { name: "Shared parent for annotation" })
  await seedFolderPolicy(deps, parent.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" },
    { principalType: "user", principalId: reader.userId, permissionLevel: "readOnly" }
  ])
  const inheritedChild = await service.createDocumentGroup(owner, {
    name: "Inherited child for annotation",
    parentGroupId: parent.groupId
  })
  const explicitPrivateChild = await service.createDocumentGroup(owner, {
    name: "Explicit private child for annotation",
    parentGroupId: parent.groupId
  })
  await seedFolderPolicy(deps, explicitPrivateChild.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" }
  ])

  const visibleGroups = await service.listDocumentGroups(reader)
  const visibleParent = visibleGroups.find((group) => group.groupId === parent.groupId)
  const visibleInheritedChild = visibleGroups.find((group) => group.groupId === inheritedChild.groupId)

  assert.equal(visibleParent?.effectivePermission, "readOnly")
  assert.equal(visibleParent?.policySource, "explicit")
  assert.equal(visibleInheritedChild?.effectivePermission, "readOnly")
  assert.equal(visibleInheritedChild?.policySource, "inherited")
  assert.equal(visibleInheritedChild?.inheritedFromFolderId, parent.groupId)
  assert.equal(visibleGroups.some((group) => group.groupId === explicitPrivateChild.groupId), false)
})

test("document administrative principal retains read access despite ordinary folder denial", async () => {
  const { service } = await createService()
  const groupAdmin: AppUser = { userId: "group-admin", email: "group-admin@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const uploader: AppUser = { userId: "uploader", email: "uploader@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const group = await service.createDocumentGroup(groupAdmin, { name: "Owner bypass read group" })
  const manifest = await service.ingest({
    fileName: "owner-bypass-read.md",
    text: "owner bypass read content must stay hidden without folder read permission.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: uploader.userId,
      groupIds: [group.groupId]
    }
  })

  assert.equal((await service.listDocumentGroups(uploader)).some((candidate) => candidate.groupId === group.groupId), false)
  assert.deepEqual((await service.listDocuments(uploader)).map((document) => document.documentId), [manifest.documentId])
  assert.equal((await service.getParsedDocumentPreview(uploader, manifest.documentId))?.documentId, manifest.documentId)
})

test("document administrative principal retains delete and reindex authority despite ordinary folder denial", async () => {
  const { service } = await createService()
  const groupAdmin: AppUser = { userId: "group-admin", email: "group-admin@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const uploader: AppUser = { userId: "uploader", email: "uploader@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const group = await service.createDocumentGroup(groupAdmin, { name: "Owner bypass manage group" })
  const manifest = await service.ingest({
    fileName: "owner-bypass-manage.md",
    text: "owner bypass manage content must not be deleted or reindexed without folder full permission.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: uploader.userId,
      groupIds: [group.groupId]
    }
  })

  await authorizeDocumentDelete(service, uploader, manifest.documentId)
  const staged = await service.stageReindexMigration(uploader, manifest.documentId)
  assert.equal(staged.sourceDocumentId, manifest.documentId)
  assert.equal(staged.status, "staged")
})

test("search includes owner-owned group scoped documents despite ordinary folder denial", async () => {
  const { service } = await createService()
  const groupAdmin: AppUser = { userId: "group-admin", email: "group-admin@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const uploader: AppUser = { userId: "uploader", email: "uploader@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const group = await service.createDocumentGroup(groupAdmin, { name: "Owner bypass search group" })
  const manifest = await service.ingest({
    fileName: "owner-bypass-search.md",
    text: "revoked owner secret pear must not appear in all mode search.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: uploader.userId,
      groupIds: [group.groupId]
    }
  })

  const result = await service.search({
    query: "owner secret pear",
    topK: 10,
    lexicalTopK: 20,
    semanticTopK: 0
  }, uploader)

  assert.deepEqual(result.results.map((item) => item.documentId), [manifest.documentId])
  assert.equal(JSON.stringify(result).includes("revoked owner secret pear"), true)
})

test("service enforces full document group permission for delete and reindex operations", async () => {
  const { service, deps } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const sharedReader = { userId: "reader-1", email: "reader@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const outsider = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const group = await service.createDocumentGroup(owner, { name: "Restricted group" })
  await seedFolderPolicy(deps, group.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" },
    { principalType: "user", principalId: sharedReader.userId, permissionLevel: "readOnly" }
  ])
  const manifest = await service.ingest({
    fileName: "restricted.md",
    text: "restricted content",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: owner.userId,
      groupIds: [group.groupId]
    }
  })

  await assert.rejects(() => authorizeDocumentDelete(service, sharedReader, manifest.documentId), /Forbidden/)
  await assert.rejects(() => authorizeDocumentDelete(service, outsider, manifest.documentId), /Forbidden/)
  await authorizeDocumentDelete(service, owner, manifest.documentId)

  await assert.rejects(() => service.stageReindexMigration(sharedReader, manifest.documentId), /cannot manage document/)
  await assert.rejects(() => service.stageReindexMigration(outsider, manifest.documentId), /cannot manage document/)
  const staged = await service.stageReindexMigration(owner, manifest.documentId)

  await assert.rejects(() => service.cutoverReindexMigration(sharedReader, staged.migrationId), /cannot manage document/)
  await service.cutoverReindexMigration(owner, staged.migrationId)
  await assert.rejects(() => service.rollbackReindexMigration(sharedReader, staged.migrationId), /cannot manage document/)
  await service.rollbackReindexMigration(owner, staged.migrationId)
})

test("service reindexes documents through embedding cache compatible pipeline versions", async () => {
  const { service } = await createService()
  const actor: AppUser = {
    userId: "manager-1",
    email: "manager@example.com",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "# 申請手順\n申請期限は翌月5営業日です。\n\n# 例外\n例外承認者は部長です。",
    metadata: { tenantId: "tenant-a", ownerUserId: actor.userId }
  })

  assert.ok(manifest.chunks?.some((chunk) => chunk.sectionPath?.includes("申請手順")))
  const reindexed = await service.reindexDocument(actor, manifest.documentId)
  assert.notEqual(reindexed.documentId, manifest.documentId)
  assert.equal(reindexed.metadata?.stagedFromDocumentId, manifest.documentId)
  assert.equal(reindexed.lifecycleStatus, "active")
  assert.equal(reindexed.embeddingModelId, manifest.embeddingModelId)
  assert.ok(reindexed.memoryCardCount >= manifest.memoryCardCount)

  const migrations = await service.listReindexMigrations()
  assert.equal(migrations[0]?.status, "cutover")
  assert.equal((await service.listDocuments(actor)).some((doc) => doc.documentId === manifest.documentId), false)
})

test("service stages and rolls back structured blue-green reindex migrations", async () => {
  const { service, dataDir } = await createService()
  const actor = localDocumentManager()
  const textractJson = JSON.stringify({
    Blocks: [
      { Id: "table-1", BlockType: "TABLE", Page: 1, Confidence: 92, Relationships: [{ Type: "CHILD", Ids: ["cell-1", "cell-2"] }] },
      { Id: "cell-1", BlockType: "CELL", RowIndex: 1, ColumnIndex: 1, Confidence: 90, Relationships: [{ Type: "CHILD", Ids: ["word-1"] }] },
      { Id: "cell-2", BlockType: "CELL", RowIndex: 1, ColumnIndex: 2, Confidence: 88, Relationships: [{ Type: "CHILD", Ids: ["word-2"] }] },
      { Id: "word-1", BlockType: "WORD", Text: "項目" },
      { Id: "word-2", BlockType: "WORD", Text: "期限" }
    ]
  })
  const manifest = await service.ingest({ fileName: "policy.textract.json", textractJson, skipMemory: true, metadata: { ownerUserId: actor.userId } })

  assert.equal(manifest.chunks?.[0]?.chunkKind, "table")
  assert.equal(manifest.chunks?.[0]?.tableId, "table-1")
  assert.equal(manifest.chunks?.[0]?.tableConfidence, 90)
  assert.equal(manifest.parsedDocument?.tables?.[0]?.id, "table-1")
  assert.ok(manifest.structuredBlocksObjectKey)
  const structuredBlocks = JSON.parse(await readFile(path.join(dataDir, `objects/${manifest.structuredBlocksObjectKey}`), "utf-8")) as {
    schemaVersion?: number
    parsedDocument?: { tables?: Array<{ id: string }> }
  }
  assert.equal(structuredBlocks.schemaVersion, 2)
  assert.equal(structuredBlocks.parsedDocument?.tables?.[0]?.id, "table-1")

  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  assert.equal(staged.status, "staged")
  assert.deepEqual((await service.listDocuments()).map((doc) => doc.documentId), [manifest.documentId])

  const cutover = await service.cutoverReindexMigration(actor, staged.migrationId)
  assert.equal(cutover.status, "cutover")
  const activeAfterCutover = await service.listDocuments()
  assert.deepEqual(activeAfterCutover.map((doc) => doc.documentId), [staged.stagedDocumentId])
  assert.equal(activeAfterCutover[0]?.chunks?.[0]?.chunkKind, "table")
  const evidenceDbAfterCutover = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as {
    records: Array<{ key: string; metadata?: { lifecycleStatus?: string } }>
  }
  assert.equal(
    evidenceDbAfterCutover.records.find((record) => record.key.startsWith(staged.stagedDocumentId))?.metadata?.lifecycleStatus,
    "active"
  )

  const rolledBack = await service.rollbackReindexMigration(actor, staged.migrationId)
  assert.equal(rolledBack.status, "rolled_back")
  const activeAfterRollback = await service.listDocuments()
  assert.equal(activeAfterRollback.length, 1)
  assert.equal(activeAfterRollback[0]?.chunks?.[0]?.chunkKind, "table")
})

test("service restores staging state when cutover vector activation fails after partial write", async () => {
  let failActivePut = false
  let stagedDocumentId = ""
  const { service, dataDir } = await createService({
    evidencePutErrorAfterWriteWhen: (records) =>
      failActivePut && records.some((record) => record.key.startsWith(stagedDocumentId) && record.metadata.lifecycleStatus === "active")
  })
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "申請期限は翌月5営業日です。",
    skipMemory: true,
    metadata: { ownerUserId: actor.userId }
  })
  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  stagedDocumentId = staged.stagedDocumentId

  failActivePut = true
  await assert.rejects(() => service.cutoverReindexMigration(actor, staged.migrationId), /simulated partial active put failure/)

  assert.deepEqual((await service.listDocuments()).map((doc) => doc.documentId), [manifest.documentId])
  const stagedManifest = JSON.parse(await readFile(path.join(dataDir, `objects/${staged.stagedManifestObjectKey}`), "utf-8")) as { lifecycleStatus?: string }
  assert.equal(stagedManifest.lifecycleStatus, "staging")
  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as {
    records: Array<{ key: string; metadata?: { lifecycleStatus?: string } }>
  }
  assert.equal(
    evidenceDb.records.find((record) => record.key.startsWith(staged.stagedDocumentId))?.metadata?.lifecycleStatus,
    "staging"
  )
})

test("FR-090 reindex cutover compensates publication when current authorization is revoked before ledger commit", async () => {
  let armed = false
  let revoked = false
  let activePointerKey = ""
  const actor: AppUser = { userId: "reindex-manager", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active", tenantId: "default" }
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: actor.userId,
      userId: actor.userId,
      email: actor.email,
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: actor.cognitoGroups,
      tenantId: actor.tenantId!
    })
  }
  const { service } = await createService({
    verifiedIdentityProvider: identityProvider,
    onObjectPutTextIfVersion: (key) => {
      if (armed && key === activePointerKey) revoked = true
    }
  })
  const manifest = await service.ingest({ fileName: "reauth-cutover.md", text: "reindex authorization", skipMemory: true, metadata: { ownerUserId: actor.userId } })
  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  assert.ok(staged.activePointerKey)
  activePointerKey = staged.activePointerKey
  armed = true

  await assert.rejects(() => service.cutoverReindexMigration(actor, staged.migrationId), /permission_revoked/)
  const activeDocuments = await service.listDocuments(actor)
  assert.equal(activeDocuments.length, 1)
  assert.notEqual(activeDocuments[0]?.documentId, staged.stagedDocumentId)
})

test("FR-090 failed cutover compensation persists a durable intent and an authorized retry converges it", async () => {
  let armed = false
  let revoked = false
  let failCompensation = true
  let pointerWrites = 0
  let activePointerKey = ""
  const actor: AppUser = { userId: "reindex-repair", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active", tenantId: "default" }
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: actor.userId,
      userId: actor.userId,
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: actor.cognitoGroups,
      tenantId: actor.tenantId!
    })
  }
  const { service, deps } = await createService({
    verifiedIdentityProvider: identityProvider,
    onObjectPutTextIfVersion: (key) => {
      if (!armed || key !== activePointerKey) return
      pointerWrites += 1
      if (pointerWrites === 1) revoked = true
      if (pointerWrites === 2 && failCompensation) throw new Error("simulated compensation pointer outage")
    }
  })
  const manifest = await service.ingest({
    fileName: "cutover-repair.md",
    text: "A failed publication compensation must remain retryable.",
    skipMemory: true,
    metadata: { ownerUserId: actor.userId }
  })
  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  activePointerKey = staged.activePointerKey!
  armed = true

  await assert.rejects(() => service.cutoverReindexMigration(actor, staged.migrationId), /permission_revoked/)
  const repairKeys = await deps.objectStore.listKeys("security/reindex-publication-compensation/")
  assert.equal(repairKeys.length, 1)
  const pending = JSON.parse(await deps.objectStore.getText(repairKeys[0]!)) as { status: string; attempts: number; lastError?: string }
  assert.equal(pending.status, "pending")
  assert.equal(pending.attempts, 1)
  assert.match(pending.lastError ?? "", /compensation_pointer_outage/)
  await assert.rejects(() => service.cutoverReindexMigration(actor, staged.migrationId), /permission_revoked/)
  assert.equal((JSON.parse(await deps.objectStore.getText(repairKeys[0]!)) as { status: string }).status, "pending")

  revoked = false
  failCompensation = false
  const reconciled = await service.cutoverReindexMigration(actor, staged.migrationId)
  assert.equal(reconciled.status, "rolled_back")
  const completed = JSON.parse(await deps.objectStore.getText(repairKeys[0]!)) as { status: string }
  assert.equal(completed.status, "completed")
  assert.equal((await service.listDocuments(actor)).length, 1)
})

test("FR-090 revoked rollback persists ledger reconciliation and retries only after current authorization", async () => {
  let armed = false
  let revoked = false
  let activePointerKey = ""
  const actor: AppUser = { userId: "rollback-repair", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active", tenantId: "default" }
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: actor.userId,
      userId: actor.userId,
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: actor.cognitoGroups,
      tenantId: actor.tenantId!
    })
  }
  const { service, deps } = await createService({
    verifiedIdentityProvider: identityProvider,
    onObjectPutTextIfVersion: (key) => {
      if (armed && key === activePointerKey) revoked = true
    }
  })
  const manifest = await service.ingest({
    fileName: "rollback-repair.md",
    text: "Rollback ledger reconciliation requires a current actor.",
    skipMemory: true,
    metadata: { ownerUserId: actor.userId }
  })
  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  await service.cutoverReindexMigration(actor, staged.migrationId)
  activePointerKey = staged.activePointerKey!
  armed = true

  await assert.rejects(() => service.rollbackReindexMigration(actor, staged.migrationId), /permission_revoked/)
  const repairKeys = await deps.objectStore.listKeys("security/reindex-publication-compensation/")
  assert.equal(repairKeys.length, 1)
  assert.equal((JSON.parse(await deps.objectStore.getText(repairKeys[0]!)) as { status: string }).status, "compensated")
  await assert.rejects(() => service.rollbackReindexMigration(actor, staged.migrationId), /permission_revoked/)

  revoked = false
  armed = false
  const reconciled = await service.rollbackReindexMigration(actor, staged.migrationId)
  assert.equal(reconciled.status, "rolled_back")
  assert.equal((JSON.parse(await deps.objectStore.getText(repairKeys[0]!)) as { status: string }).status, "completed")
})

test("service manages reviewed alias artifacts and audit log", async () => {
  const { service, dataDir } = await createService()
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }

  const alias = await service.createAlias(actor, {
    term: "PTO",
    expansions: ["有給休暇", "休暇申請"],
    scope: { tenantId: "tenant-a" }
  })
  assert.equal(alias.status, "draft")
  assert.equal(alias.term, "pto")

  const updated = await service.updateAlias(actor, alias.aliasId, { expansions: ["年次有給休暇"] })
  assert.deepEqual(updated?.expansions, ["年次有給休暇"])

  const reviewed = await service.reviewAlias(actor, alias.aliasId, { decision: "approve", comment: "社内用語として確認済み" })
  assert.equal(reviewed?.status, "approved")

  const published = await service.publishAliases(actor)
  assert.equal(published.aliasCount, 1)
  assert.match(published.version, /^alias_/)

  const audit = await service.listAliasAuditLog()
  assert.deepEqual(audit.map((item) => item.action).sort(), ["create", "publish", "review", "update"])

  const latest = JSON.parse(await readFile(path.join(dataDir, "objects", "aliases", "latest.json"), "utf-8")) as { objectKey: string }
  assert.match(latest.objectKey, /^aliases\/alias_/)
})

test("service creates search improvement candidates as draft review items", async () => {
  const { service } = await createService()
  const requester = { userId: "user-1", email: "requester@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const manager = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  const question = await service.createQuestion({
    title: "回答不能",
    question: "担当者へ確認してください。",
    source: "answer_unavailable",
    messageId: "msg-1",
    ragRunId: "run-1",
    answerUnavailableReason: "根拠が不足しています。"
  }, requester)

  const missing = await service.createSearchImprovementCandidate(manager, "missing-question", { term: "pto", expansions: ["有給休暇"] })
  assert.equal(missing, undefined)

  const candidate = await service.createSearchImprovementCandidate(manager, question.questionId, {
    term: "PTO",
    expansions: ["有給休暇"],
    candidateSource: "ai_suggested",
    suggestionReason: "回答不能 ticket から検索語対応づけ候補を作成",
    reviewReason: "担当者レビュー待ち",
    impactSummary: "休暇関連の検索だけに影響",
    searchResultDiffSummary: "公開前レビューで確認する",
    beforeResultIds: ["before-1"],
    afterResultIds: ["after-1"]
  })
  assert.equal(candidate?.status, "draft")
  assert.deepEqual(candidate?.searchImprovement, {
    candidateSource: "ai_suggested",
    sourceQuestionId: question.questionId,
    sourceMessageId: "msg-1",
    sourceRagRunId: "run-1",
    suggestionReason: "回答不能 ticket から検索語対応づけ候補を作成",
    reviewState: "pending_review",
    reviewReason: "担当者レビュー待ち",
    impactSummary: "休暇関連の検索だけに影響",
    searchResultDiffSummary: "公開前レビューで確認する",
    beforeResultIds: ["before-1"],
    afterResultIds: ["after-1"]
  })

  const reviewed = await service.reviewAlias(manager, candidate?.aliasId ?? "", { decision: "approve", comment: "レビュー済み" })
  assert.equal(reviewed?.searchImprovement?.reviewState, "reviewed")
  await service.publishAliases(manager)
  assert.equal((await service.listAliases()).find((item) => item.aliasId === candidate?.aliasId)?.searchImprovement?.reviewState, "published")
})

test("service delegates human question lifecycle to the question store", async () => {
  const { service } = await createService()
  const user = { userId: "user-1", email: "requester@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const question = await service.createQuestion({
    title: "資料外の質問",
    question: "担当者へ確認してください。",
    source: "answer_unavailable",
    messageId: "msg-1",
    ragRunId: "run-1",
    answerUnavailableEventId: "event-1",
    answerUnavailableReason: "根拠が不足しています。",
    sanitizedDiagnostics: {
      tier: "support_sanitized",
      answerUnavailableReason: "根拠が不足しています。",
      retrievalQuality: "insufficient_evidence",
      qualityCauses: ["retrieval_gap"],
      visibleCitationIds: ["cite-1"],
      visibleDocumentIds: ["doc-1"],
      visibleChunkIds: ["chunk-1"],
      qualityWarnings: ["検索語対応づけの確認が必要"],
      suggestedNextActions: ["search_improvement_review"]
    },
    sourceQuestion: "資料外の質問は？",
    chatAnswer: "資料からは回答できません。"
  }, user)
  assert.equal(question.status, "open")
  assert.equal(question.requesterName, "requester@example.com")
  assert.equal(question.requesterDepartment, "未設定")
  assert.equal(question.requesterUserId, "user-1")
  assert.equal(question.source, "answer_unavailable")
  assert.deepEqual(question.sanitizedDiagnostics, {
    tier: "support_sanitized",
    answerUnavailableReason: "根拠が不足しています。",
    retrievalQuality: "insufficient_evidence",
    qualityCauses: ["retrieval_gap"],
    visibleCitationIds: ["cite-1"],
    visibleDocumentIds: ["doc-1"],
    visibleChunkIds: ["chunk-1"],
    qualityWarnings: ["検索語対応づけの確認が必要"],
    suggestedNextActions: ["search_improvement_review"]
  })
  assert.equal((await service.listAllQuestionsForAdmin())[0]?.questionId, question.questionId)
  assert.equal((await service.getQuestion(question.questionId))?.questionId, question.questionId)

  const answered = await service.answerQuestion(question.questionId, {
    answerTitle: "回答",
    answerBody: "担当者の確認結果です。",
    references: "社内確認"
  }, { userId: "answerer-1", email: "answerer@example.com", cognitoGroups: ["ANSWER_EDITOR"], accountStatus: "active" as const, tenantId: "default" })
  assert.equal(answered.status, "answered")
  assert.equal(answered.answerBody, "担当者の確認結果です。")
  assert.equal(answered.responderName, "answerer@example.com")

  const resolved = await service.resolveQuestion(question.questionId)
  assert.equal(resolved.status, "resolved")
})

test("questionCreate_setsDefaultAssigneeGroupWhenMissing", async () => {
  const mutableConfig = config as { defaultSupportAssigneeGroupId: string }
  const previous = mutableConfig.defaultSupportAssigneeGroupId
  mutableConfig.defaultSupportAssigneeGroupId = "support-default"
  try {
    const { service } = await createService()
    const question = await service.createQuestion({
      title: "資料外の質問",
      question: "担当者へ確認してください。"
    }, { userId: "user-1", email: "requester@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" })

    assert.equal(question.assigneeGroupId, "support-default")
  } finally {
    mutableConfig.defaultSupportAssigneeGroupId = previous
  }
})

test("conversationHistoryList_includesOldFavoriteBeforeRecentNonFavorites", async () => {
  const { service, deps } = await createService()
  const user: AppUser = { userId: "user-1", tenantId: "default", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }
  for (let index = 1; index <= 21; index += 1) {
    await service.saveConversationHistory(user, {
      id: `conv-${index}`,
      title: `会話 ${index}`,
      messages: [],
      updatedAt: `2026-05-${String(index).padStart(2, "0")}T00:00:00.000Z`
    })
  }
  await deps.favoriteStore.save(tenantPartitionedOwnerKey(user), { targetType: "chatSession", targetId: "conv-1", label: "古いお気に入り" })

  const history = await service.listConversationHistory(user)

  assert.equal(history.length, 20)
  assert.equal(history[0]?.id, "conv-1")
  assert.equal(history[0]?.isFavorite, true)
  assert.equal(history.some((item) => item.id === "conv-2"), false)
})

test("favoriteList_marksUnsupportedTargetTypeInaccessible", async () => {
  const { service, deps } = await createService()
  const user: AppUser = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  await deps.favoriteStore.save(tenantPartitionedOwnerKey(user), { targetType: "skill", targetId: "skill-1", label: "Skill 1" })

  const favorites = await service.listFavorites(user)

  assert.equal(favorites[0]?.targetType, "skill")
  assert.equal(favorites[0]?.accessible, false)
  assert.equal(favorites[0]?.label, "この項目には現在アクセスできません")
})

test("favoriteCreateDoesNotReturnAccessibleTrueWithoutResolver", async () => {
  const { service } = await createService()
  const user: AppUser = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  await assert.rejects(() => service.saveFavorite(user, { targetType: "skill", targetId: "skill-1" }), /Unsupported favorite target type/)
})

test("favoriteCreateRechecksChatSessionOwner", async () => {
  const { service } = await createService()
  const owner: AppUser = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const other: AppUser = { userId: "other-1", email: "other@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  await service.saveConversationHistory(owner, {
    id: "conv-1",
    title: "会話",
    messages: [],
    updatedAt: "2026-05-21T00:00:00.000Z"
  })

  const ownerFavorite = await service.saveFavorite(owner, { targetType: "chatSession", targetId: "conv-1", label: "会話" })
  const otherFavorite = await service.saveFavorite(other, { targetType: "chatSession", targetId: "conv-1", label: "会話" })

  assert.equal(ownerFavorite.accessible, true)
  assert.equal(otherFavorite.accessible, false)
})

test("service preserves asynchronous chat run options and can mark worker failures", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const started = await service.startChatRun({
    question: "検索設定を確認して",
    modelId: "model-a",
    embeddingModelId: "embed-a",
    clueModelId: "clue-a",
    topK: 5,
    memoryTopK: 2,
    minScore: 2,
    strictGrounded: false,
    useMemory: false,
    maxIterations: 999
  }, user)
  const stored = await deps.chatRunStore.get("default", started.runId)
  assert.equal(stored?.strictGrounded, false)
  assert.equal(stored?.useMemory, false)
  assert.equal(stored?.maxIterations, ragRuntimePolicy.retrieval.maxIterations)
  assert.equal(stored?.minScore, 1)

  const benchmarkRun = await service.createBenchmarkRun(user, { minScore: 2 })
  assert.equal(benchmarkRun.minScore, 1)
  const mmragSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "mmrag-docqa-v1")
  assert.deepEqual(mmragSuite, {
    suiteId: "mmrag-docqa-v1",
    label: "MMRAG-DocQA",
    mode: "agent",
    datasetS3Key: "hf://datasets/yubo2333/MMLongBench-Doc",
    preset: "standard",
    defaultConcurrency: 1
  })
  const mmragRun = await service.createBenchmarkRun(user, { suiteId: "mmrag-docqa-v1", mode: "agent" })
  assert.equal(mmragRun.suiteId, "mmrag-docqa-v1")
  assert.equal(mmragRun.datasetS3Key, "hf://datasets/yubo2333/MMLongBench-Doc")
  const jpPublicPdfSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "jp-public-pdf-qa-v1")
  assert.deepEqual(jpPublicPdfSuite, {
    suiteId: "jp-public-pdf-qa-v1",
    label: "日本語公開PDF QA",
    mode: "agent",
    datasetS3Key: "benchmark/dataset.jp-public-pdf-qa.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  })
  const jpPublicPdfRun = await service.createBenchmarkRun(user, { suiteId: "jp-public-pdf-qa-v1", mode: "agent" })
  assert.equal(jpPublicPdfRun.suiteId, "jp-public-pdf-qa-v1")
  assert.equal(jpPublicPdfRun.datasetS3Key, "benchmark/dataset.jp-public-pdf-qa.jsonl")
  const mtragSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "mtrag-v1")
  assert.equal(mtragSuite?.datasetS3Key, "datasets/conversation/mtrag-v1.jsonl")
  const chatragSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "chatrag-bench-v1")
  assert.equal(chatragSuite?.datasetS3Key, "datasets/conversation/chatrag-bench-v1.jsonl")
  const mlitSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "mlit-pdf-figure-table-rag-seed-v1")
  assert.deepEqual(mlitSuite, {
    suiteId: "mlit-pdf-figure-table-rag-seed-v1",
    label: "MLIT PDF figure/table RAG seed",
    mode: "agent",
    datasetS3Key: "datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  })
  const mlitRun = await service.createBenchmarkRun(user, { suiteId: "mlit-pdf-figure-table-rag-seed-v1", mode: "agent" })
  assert.equal(mlitRun.suiteId, "mlit-pdf-figure-table-rag-seed-v1")
  assert.equal(mlitRun.datasetS3Key, "datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl")
  const architectureSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "architecture-drawing-qarag-v0.1")
  assert.deepEqual(architectureSuite, {
    suiteId: "architecture-drawing-qarag-v0.1",
    label: "建築図面 QARAG v0.1",
    mode: "agent",
    datasetS3Key: "generated://architecture-drawing-qarag-v0.1",
    preset: "standard",
    defaultConcurrency: 1
  })
  const architectureRun = await service.createBenchmarkRun(user, { suiteId: "architecture-drawing-qarag-v0.1", mode: "agent" })
  assert.equal(architectureRun.suiteId, "architecture-drawing-qarag-v0.1")
  assert.equal(architectureRun.datasetS3Key, "generated://architecture-drawing-qarag-v0.1")

  await deps.chatRunStore.create({
    runId: "run-worker-timeout",
    status: "running",
    createdBy: "user-1",
    tenantId: "default",
    question: "timeout",
    modelId: "model-a",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  const failed = await service.markChatRunFailed("default", "run-worker-timeout", "States.Timeout: worker timed out")
  assert.equal(failed.status, "failed")
  assert.equal(failed.error, "States.Timeout: worker timed out")
  const errorEvents = await deps.chatRunEventStore.listAfter("default", "run-worker-timeout", 0)
  assert.equal(errorEvents.at(-1)?.type, "error")
  assert.equal(errorEvents.at(-1)?.message, "States.Timeout: worker timed out")
})

test("service preserves async agent ownership, cancel, and artifact metadata boundaries", async () => {
  const { service } = await createService()
  const owner = { userId: "agent-owner", email: "owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const outsider = { userId: "agent-outsider", email: "outsider@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const admin = { userId: "agent-admin", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }

  const run = await service.createAsyncAgentRun(owner, {
    provider: "custom",
    modelId: "custom-placeholder",
    instruction: "状態だけ確認する"
  })
  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "disabled")
  assert.equal(run.failureReasonCode, "not_configured")

  assert.equal((await service.getAsyncAgentRun(owner, run.agentRunId))?.agentRunId, run.agentRunId)
  await assert.rejects(() => service.getAsyncAgentRun(outsider, run.agentRunId), /Forbidden/)
  await assert.rejects(() => service.cancelAsyncAgentRun(outsider, run.agentRunId), /Forbidden/)
  assert.equal((await service.listAsyncAgentRuns(owner))[0]?.agentRunId, run.agentRunId)
  assert.deepEqual(await service.listAsyncAgentRuns(outsider), [])
  assert.equal((await service.listAsyncAgentRuns(admin))[0]?.agentRunId, run.agentRunId)
  assert.deepEqual(await service.listAsyncAgentArtifacts(owner, run.agentRunId), [])
  assert.equal(await service.listAsyncAgentArtifacts(owner, "missing-agent-run"), undefined)
  assert.equal(await service.getAsyncAgentArtifact(owner, run.agentRunId, "missing-artifact"), undefined)

  const cancelled = await service.cancelAsyncAgentRun(owner, run.agentRunId)
  assert.equal(cancelled?.status, "cancelled")
  assert.equal(cancelled?.failureReasonCode, "cancelled")
  assert.equal((await service.cancelAsyncAgentRun(owner, run.agentRunId))?.status, "cancelled")
  assert.equal(await service.cancelAsyncAgentRun(owner, "missing-agent-run"), undefined)
  assert.equal((await service.executeAsyncAgentRun("default", run.agentRunId)).status, "cancelled")
  await assert.rejects(() => service.executeAsyncAgentRun("default", "missing-agent-run"), /Async agent run not found/)

  const unavailable = await service.createAsyncAgentRun(owner, {
    provider: "future_provider" as AgentRuntimeProvider,
    modelId: "future-placeholder",
    instruction: "未登録 provider は実行しない"
  })
  assert.equal(unavailable.providerAvailability, "provider_unavailable")
  assert.equal(unavailable.failureReasonCode, "provider_unavailable")
  assert.equal((await service.executeAsyncAgentRun("default", unavailable.agentRunId)).status, "blocked")
})

test("service rejects async agent selections that are not readable", async () => {
  const { service } = await createService()
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const baseInput = {
    provider: "claude_code" as const,
    modelId: "claude-placeholder",
    instruction: "選択境界を確認する"
  }

  await assert.rejects(() => service.createAsyncAgentRun(user, {
    ...baseInput,
    selectedDocumentIds: ["missing-document"]
  }), /Forbidden/)
  await assert.rejects(() => service.createAsyncAgentRun(user, {
    ...baseInput,
    selectedSkillIds: ["skill-1"]
  }), /Forbidden/)
  await assert.rejects(() => service.createAsyncAgentRun(user, {
    ...baseInput,
    selectedAgentProfileIds: ["profile-1"]
  }), /Forbidden/)
})

test("service records async agent readable selections without expanding duplicates", async () => {
  const { service } = await createService()
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const document = await service.ingest({
    fileName: "agent-source.md",
    text: "非同期エージェントが参照する読み取り可能な資料です。",
    skipMemory: true,
    metadata: { ownerUserId: user.userId }
  })

  const run = await service.createAsyncAgentRun(user, {
    provider: "codex",
    modelId: "codex-placeholder",
    instruction: "選択資料の mount 情報を確認する",
    selectedDocumentIds: [document.documentId, document.documentId],
    selectedSkillIds: ["skill-a", "skill-a"],
    selectedAgentProfileIds: ["profile-a", "profile-a"],
    budget: { maxDurationMinutes: 15 }
  })

  assert.deepEqual(run.selectedDocumentIds, [document.documentId])
  assert.deepEqual(run.selectedSkillIds, ["skill-a"])
  assert.deepEqual(run.selectedAgentProfileIds, ["profile-a"])
  assert.deepEqual(run.budget, { maxDurationMinutes: 15 })
  assert.equal(run.workspaceMounts.length, 1)
  assert.deepEqual(run.workspaceMounts[0], {
    mountId: run.workspaceMounts[0]?.mountId,
    workspaceId: run.workspaceId,
    sourceType: "document",
    sourceId: document.documentId,
    mountedPath: `/workspace/read-only/documents/${document.documentId}`,
    accessMode: "readOnly",
    permissionCheckedAt: run.createdAt
  })
})

test("service executes configured Claude Code provider with sanitized artifacts", async () => {
  const calls: AsyncAgentProviderInput[] = []
  const provider = fakeAsyncAgentProvider({
    availability: "available",
    execute: async (input) => {
      calls.push(input)
      return {
        status: "completed",
        artifacts: [{
          artifactType: "markdown",
          fileName: "report.md",
          mimeType: "text/markdown",
          text: "result with ANTHROPIC_API_KEY=should-not-leak and X-Amz-Signature=abc123",
          writebackStatus: "not_requested"
        }],
        logText: "Bearer secret-token-value"
      }
    }
  })
  const { service, deps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const document = await service.ingest({
    fileName: "agent-source.md",
    text: "Claude Code provider に readOnly mount される資料です。",
    skipMemory: true,
    metadata: { ownerUserId: user.userId }
  })
  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "資料を要約する",
    selectedDocumentIds: [document.documentId],
    budget: { maxDurationMinutes: 5, maxToolCalls: 3 }
  })
  assert.equal(run.status, "queued")
  assert.equal(run.providerAvailability, "available")

  const completed = await service.executeAsyncAgentRun("default", run.agentRunId)

  assert.equal(completed.status, "completed")
  assert.equal(completed.failureReason, undefined)
  assert.equal(completed.artifacts.length, 2)
  assert.equal(completed.artifacts[0]?.fileName, "report.md")
  assert.equal(completed.artifacts[0]?.writebackStatus, "not_requested")
  assert.equal(calls[0]?.instruction, "資料を要約する")
  assert.equal(calls[0]?.workspaceMounts[0]?.sourceId, document.documentId)
  assert.deepEqual(calls[0]?.budget, { maxDurationMinutes: 5, maxToolCalls: 3 })
  const reportText = await deps.objectStore.getText(completed.artifacts[0]?.storageRef ?? "")
  const logText = await deps.objectStore.getText(completed.artifacts[1]?.storageRef ?? "")
  assert.doesNotMatch(reportText, /should-not-leak|abc123/)
  assert.doesNotMatch(logText, /secret-token-value/)
  assert.match(reportText, /ANTHROPIC_API_KEY=\[REDACTED\]/)
  assert.match(logText, /Bearer \[REDACTED\]/)
})

test("FR-090 async agent revoke after artifact writes deletes artifacts before permission_revoked persistence", async () => {
  let identityChecks = 0
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async (subject) => {
      identityChecks += 1
      return {
        username: subject,
        userId: subject,
        accountStatus: identityChecks >= 5 ? "suspended" : "active",
        cognitoGroups: ["ASYNC_AGENT_USER"],
        tenantId: "default"
      }
    }
  }
  const provider = fakeAsyncAgentProvider({
    availability: "available",
    execute: async () => ({
      status: "completed",
      artifacts: [{
        artifactType: "report",
        fileName: "late-report.md",
        mimeType: "text/markdown",
        text: "must be deleted after revoke"
      }]
    })
  })
  const { service, deps } = await createService({
    asyncAgentProviders: new AsyncAgentProviderRegistry([provider]),
    verifiedIdentityProvider: identityProvider
  })
  const user: AppUser = {
    userId: "agent-race-user",
    cognitoGroups: ["ASYNC_AGENT_USER"],
    accountStatus: "active",
    tenantId: "default"
  }
  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "race boundary"
  })

  const failed = await service.executeAsyncAgentRun("default", run.agentRunId)

  assert.equal(failed.status, "failed")
  assert.equal(failed.failureReasonCode, "permission_revoked")
  assert.deepEqual(failed.artifactIds, [])
  assert.deepEqual(failed.artifacts, [])
  assert.ok(identityChecks >= 5)
  const runPrefix = `agent-runs/${tenantPartitionId("default")}/runs/${encodeURIComponent(run.agentRunId)}`
  assert.deepEqual((await deps.objectStore.listKeys(runPrefix)).filter((key) => key.includes("/artifacts/")), [])
})

test("service records Claude Code provider failures without leaking raw secrets", async () => {
  const provider = fakeAsyncAgentProvider({
    availability: "available",
    execute: async () => ({
      status: "expired",
      failureReason: "timeout with token: abcdefghijklmnop",
      logText: "signed url X-Amz-Credential=credential-value"
    })
  })
  const { service, deps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "timeout を確認する"
  })

  const expired = await service.executeAsyncAgentRun("default", run.agentRunId)

  assert.equal(expired.status, "expired")
  assert.equal(expired.failureReasonCode, "execution_error")
  assert.doesNotMatch(expired.failureReason ?? "", /abcdefghijklmnop/)
  assert.equal(expired.artifacts[0]?.artifactType, "log")
  const logText = await deps.objectStore.getText(expired.artifacts[0]?.storageRef ?? "")
  assert.doesNotMatch(logText, /credential-value/)
  assert.match(logText, /X-Amz-Credential=\[REDACTED\]/)
})

test("service converts Claude Code provider exceptions to sanitized failed runs", async () => {
  const provider = fakeAsyncAgentProvider({
    availability: "available",
    execute: async () => {
      throw new Error("provider crashed with ANTHROPIC_API_KEY=raw-secret")
    }
  })
  const { service } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "例外を確認する"
  })

  const failed = await service.executeAsyncAgentRun("default", run.agentRunId)

  assert.equal(failed.status, "failed")
  assert.equal(failed.failureReasonCode, "execution_error")
  assert.doesNotMatch(failed.failureReason ?? "", /raw-secret/)
  assert.match(failed.failureReason ?? "", /ANTHROPIC_API_KEY=\[REDACTED\]/)
})

test("service keeps Claude Code provider not configured without mock artifacts", async () => {
  const provider = fakeAsyncAgentProvider({ availability: "not_configured" })
  const { service } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "未設定状態を確認する"
  })

  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "not_configured")
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(run.artifactIds, [])
  assert.equal((await service.executeAsyncAgentRun("default", run.agentRunId)).status, "blocked")
})

test("service executes configured Codex command provider with sanitized artifacts", async () => {
  const command = `/bin/sh ${asyncAgentCommandFixturePath()} success`
  const provider = new CommandAsyncAgentProvider({
    provider: "codex",
    displayName: "Codex",
    commandEnvName: "CODEX_COMMAND",
    command,
    modelIds: ["codex-cli"],
    timeoutMs: 1000,
    outputFileName: "codex-output.md"
  })
  const { service, deps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const document = await service.ingest({
    fileName: "codex-source.md",
    text: "Codex provider に readOnly mount される資料です。",
    skipMemory: true,
    metadata: { ownerUserId: user.userId }
  })
  const run = await service.createAsyncAgentRun(user, {
    provider: "codex",
    modelId: "codex-cli",
    instruction: "資料を整理する",
    selectedDocumentIds: [document.documentId],
    budget: { maxDurationMinutes: 5, maxToolCalls: 4 }
  })

  assert.equal(run.status, "queued")
  assert.equal(run.providerAvailability, "available")
  const completed = await service.executeAsyncAgentRun("default", run.agentRunId)

  assert.equal(completed.status, "completed")
  assert.equal(completed.artifacts.length, 2)
  assert.equal(completed.artifacts[0]?.fileName, "codex-output.md")
  const artifactText = await deps.objectStore.getText(completed.artifacts[0]?.storageRef ?? "")
  const request = JSON.parse(artifactText) as AsyncAgentProviderInput
  assert.equal(request.provider, "codex")
  assert.equal(request.modelId, "codex-cli")
  assert.equal(request.instruction, "資料を整理する")
  assert.equal(request.workspaceMounts[0]?.sourceId, document.documentId)
  assert.deepEqual(request.budget, { maxDurationMinutes: 5, maxToolCalls: 4 })
  const logText = await deps.objectStore.getText(completed.artifacts[1]?.storageRef ?? "")
  assert.doesNotMatch(logText, /fixture-secret-token/)
  assert.match(logText, /CODEX_TOKEN=\[REDACTED\]/)
})

test("service records Codex command provider failures and timeouts without leaking raw secrets", async () => {
  const fixturePath = asyncAgentCommandFixturePath()
  const failureProvider = new CommandAsyncAgentProvider({
    provider: "codex",
    displayName: "Codex",
    commandEnvName: "CODEX_COMMAND",
    command: `/bin/sh ${fixturePath} fail`,
    modelIds: ["codex-cli"],
    timeoutMs: 1000,
    outputFileName: "codex-output.md"
  })
  const timeoutProvider = new CommandAsyncAgentProvider({
    provider: "codex",
    displayName: "Codex",
    commandEnvName: "CODEX_COMMAND",
    command: `/bin/sh ${fixturePath} timeout`,
    modelIds: ["codex-cli"],
    timeoutMs: 10,
    outputFileName: "codex-output.md"
  })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const { service: failureService, deps: failureDeps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([failureProvider]) })
  const failedRun = await failureService.createAsyncAgentRun(user, {
    provider: "codex",
    modelId: "codex-cli",
    instruction: "失敗時の sanitize を確認する"
  })
  const failed = await failureService.executeAsyncAgentRun("default", failedRun.agentRunId)

  assert.equal(failed.status, "failed")
  assert.equal(failed.failureReason, "Codex provider exited with code 7.")
  const failureLog = await failureDeps.objectStore.getText(failed.artifacts[0]?.storageRef ?? "")
  assert.doesNotMatch(failureLog, /fixture-secret-token/)
  assert.match(failureLog, /Bearer \[REDACTED\]/)

  const { service: timeoutService } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([timeoutProvider]) })
  const timeoutRun = await timeoutService.createAsyncAgentRun(user, {
    provider: "codex",
    modelId: "codex-cli",
    instruction: "timeout を確認する"
  })
  const expired = await timeoutService.executeAsyncAgentRun("default", timeoutRun.agentRunId)

  assert.equal(expired.status, "expired")
  assert.equal(expired.failureReason, "Codex provider execution timed out.")
})

test("service keeps Codex provider not configured without mock artifacts", async () => {
  const provider = new CommandAsyncAgentProvider({
    provider: "codex",
    displayName: "Codex",
    commandEnvName: "CODEX_COMMAND",
    command: "",
    modelIds: [],
    timeoutMs: 1000,
    outputFileName: "codex-output.md"
  })
  const { service } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const run = await service.createAsyncAgentRun(user, {
    provider: "codex",
    modelId: "codex-cli",
    instruction: "未設定状態を確認する"
  })

  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "not_configured")
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(run.artifactIds, [])
  assert.equal((await service.executeAsyncAgentRun("default", run.agentRunId)).status, "blocked")
})

test("service executes configured OpenCode command provider with sanitized artifacts", async () => {
  const command = `/bin/sh ${asyncAgentCommandFixturePath()} success-opencode`
  const provider = new CommandAsyncAgentProvider({
    provider: "opencode",
    displayName: "OpenCode",
    commandEnvName: "OPENCODE_COMMAND",
    command,
    modelIds: ["opencode-cli"],
    timeoutMs: 1000,
    outputFileName: "opencode-output.md"
  })
  const { service, deps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER", "CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }
  const document = await service.ingest({
    fileName: "opencode-source.md",
    text: "OpenCode provider に readOnly mount される資料です。",
    skipMemory: true,
    metadata: { ownerUserId: user.userId }
  })
  const run = await service.createAsyncAgentRun(user, {
    provider: "opencode",
    modelId: "opencode-cli",
    instruction: "資料を確認する",
    selectedDocumentIds: [document.documentId],
    budget: { maxDurationMinutes: 4, maxToolCalls: 2 }
  })

  assert.equal(run.status, "queued")
  assert.equal(run.providerAvailability, "available")
  const completed = await service.executeAsyncAgentRun("default", run.agentRunId)

  assert.equal(completed.status, "completed")
  assert.equal(completed.artifacts.length, 2)
  assert.equal(completed.artifacts[0]?.fileName, "opencode-output.md")
  const artifactText = await deps.objectStore.getText(completed.artifacts[0]?.storageRef ?? "")
  const request = JSON.parse(artifactText) as AsyncAgentProviderInput
  assert.equal(request.provider, "opencode")
  assert.equal(request.modelId, "opencode-cli")
  assert.equal(request.instruction, "資料を確認する")
  assert.equal(request.workspaceMounts[0]?.sourceId, document.documentId)
  assert.deepEqual(request.budget, { maxDurationMinutes: 4, maxToolCalls: 2 })
  const logText = await deps.objectStore.getText(completed.artifacts[1]?.storageRef ?? "")
  assert.doesNotMatch(logText, /fixture-secret-token/)
  assert.match(logText, /OPENCODE_TOKEN=\[REDACTED\]/)
})

test("service records OpenCode command provider failures and timeouts without leaking raw secrets", async () => {
  const fixturePath = asyncAgentCommandFixturePath()
  const failureProvider = new CommandAsyncAgentProvider({
    provider: "opencode",
    displayName: "OpenCode",
    commandEnvName: "OPENCODE_COMMAND",
    command: `/bin/sh ${fixturePath} fail-opencode`,
    modelIds: ["opencode-cli"],
    timeoutMs: 1000,
    outputFileName: "opencode-output.md"
  })
  const timeoutProvider = new CommandAsyncAgentProvider({
    provider: "opencode",
    displayName: "OpenCode",
    commandEnvName: "OPENCODE_COMMAND",
    command: `/bin/sh ${fixturePath} timeout`,
    modelIds: ["opencode-cli"],
    timeoutMs: 10,
    outputFileName: "opencode-output.md"
  })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const { service: failureService, deps: failureDeps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([failureProvider]) })
  const failedRun = await failureService.createAsyncAgentRun(user, {
    provider: "opencode",
    modelId: "opencode-cli",
    instruction: "失敗時の sanitize を確認する"
  })
  const failed = await failureService.executeAsyncAgentRun("default", failedRun.agentRunId)

  assert.equal(failed.status, "failed")
  assert.equal(failed.failureReason, "OpenCode provider exited with code 7.")
  const failureLog = await failureDeps.objectStore.getText(failed.artifacts[0]?.storageRef ?? "")
  assert.doesNotMatch(failureLog, /fixture-secret-token/)
  assert.match(failureLog, /OPENCODE_API_KEY=\[REDACTED\]/)

  const { service: timeoutService } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([timeoutProvider]) })
  const timeoutRun = await timeoutService.createAsyncAgentRun(user, {
    provider: "opencode",
    modelId: "opencode-cli",
    instruction: "timeout を確認する"
  })
  const expired = await timeoutService.executeAsyncAgentRun("default", timeoutRun.agentRunId)

  assert.equal(expired.status, "expired")
  assert.equal(expired.failureReason, "OpenCode provider execution timed out.")
})

test("service keeps OpenCode provider not configured without mock artifacts", async () => {
  const provider = new CommandAsyncAgentProvider({
    provider: "opencode",
    displayName: "OpenCode",
    commandEnvName: "OPENCODE_COMMAND",
    command: "",
    modelIds: [],
    timeoutMs: 1000,
    outputFileName: "opencode-output.md"
  })
  const { service } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const run = await service.createAsyncAgentRun(user, {
    provider: "opencode",
    modelId: "opencode-cli",
    instruction: "未設定状態を確認する"
  })

  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "not_configured")
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(run.artifactIds, [])
  assert.equal((await service.executeAsyncAgentRun("default", run.agentRunId)).status, "blocked")
})

test("FR-090 chat run treats an authorized final append as the last success boundary", async () => {
  let revoked = false
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: "chat-worker",
      userId: "chat-worker",
      email: "chat-worker@example.com",
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: ["CHAT_USER"],
      tenantId: "default"
    })
  }
  const { service, deps } = await createService({
    verifiedIdentityProvider: identityProvider,
    onChatRunEventAppend: (event) => {
      if (event.type === "final" && event.stage === "done") revoked = true
    }
  })
  await deps.chatRunStore.create({
    runId: "chat-final-reauth",
    status: "queued",
    createdBy: "chat-worker",
    tenantId: "default",
    userEmail: "chat-worker@example.com",
    userGroups: ["CHAT_USER"],
    question: "根拠がない場合は回答不能ですか？",
    modelId: "model-a",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.01,
    includeDebug: true,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const result = await service.executeChatRun("default", "chat-final-reauth")

  assert.equal(result.status, "succeeded")
  assert.equal(result.errorCode, undefined)
  assert.ok(result.answer)
  const events = await deps.chatRunEventStore.listAfter("default", result.runId, 0)
  const final = events.find((event) => event.type === "final")
  const debugRunId = (final?.data as Record<string, unknown> | undefined)?.debugRunId
  assert.equal(typeof debugRunId, "string")
  assert.ok(await service.getDebugRun(String(debugRunId)))
  assert.equal(events.some((event) => event.type === "final"), true)
  assert.equal(events.at(-1)?.type, "final")
})

test("FR-090 synchronous chat reauthorizes current identity at protected and external boundaries", async () => {
  let identityReads = 0
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => {
      identityReads += 1
      return {
        username: "sync-chat-user",
        userId: "sync-chat-user",
        email: "sync-chat-user@example.com",
        accountStatus: identityReads >= 3 ? "suspended" : "active",
        cognitoGroups: ["CHAT_USER"],
        tenantId: "default"
      }
    }
  }
  const { service } = await createService({ verifiedIdentityProvider: identityProvider })
  const actor: AppUser = {
    userId: "sync-chat-user",
    email: "sync-chat-user@example.com",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"],
    tenantId: "default"
  }

  await assert.rejects(
    () => service.chat({ question: "current authorization boundary test" }, actor),
    /permission_revoked/
  )
  assert.ok(identityReads >= 3)
})

test("FR-090 chat trace precommit denial writes no debug artifact, observation, final event, or success", async () => {
  let revoked = false
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: "chat-worker",
      userId: "chat-worker",
      email: "chat-worker@example.com",
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: ["CHAT_USER"],
      tenantId: "default"
    })
  }
  const { service, deps } = await createService({
    verifiedIdentityProvider: identityProvider,
    onChatRunEventAppend: (event) => {
      if (
        event.type === "status"
        && (event.stage === "finalize_response" || event.stage === "finalize_refusal")
        && event.message?.includes("完了")
      ) revoked = true
    }
  })
  await deps.chatRunStore.create({
    runId: "chat-trace-precommit-revoke",
    status: "queued",
    createdBy: "chat-worker",
    tenantId: "default",
    userEmail: "chat-worker@example.com",
    userGroups: ["CHAT_USER"],
    question: "根拠がない場合は回答不能ですか？",
    modelId: "model-a",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.01,
    includeDebug: true,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const result = await service.executeChatRun("default", "chat-trace-precommit-revoke")

  assert.equal(result.status, "failed")
  assert.equal(result.errorCode, "permission_revoked")
  assert.deepEqual((await service.listDebugRuns()).filter((trace) => trace.targetType === "chat_orchestration_run"), [])
  assert.deepEqual(await deps.objectStore.listKeys("quality-control/source-samples/"), [])
  const events = await deps.chatRunEventStore.listAfter("default", result.runId, 0)
  assert.equal(events.some((event) => event.type === "final"), false)
  assert.equal(events.some((event) => event.type === "error"), false)
})

test("FR-090 ordinary chat final-event denial compensates its always-persisted redacted trace and observations", async () => {
  let revoked = false
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: "chat-worker",
      userId: "chat-worker",
      email: "chat-worker@example.com",
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: ["CHAT_USER"],
      tenantId: "default"
    })
  }
  const { service, deps } = await createService({
    verifiedIdentityProvider: identityProvider,
    onObjectPutText: (key) => {
      if (key.startsWith("debug-runs/") && !key.includes("/search_")) revoked = true
    }
  })
  await deps.chatRunStore.create({
    runId: "chat-final-precommit-revoke",
    status: "queued",
    createdBy: "chat-worker",
    tenantId: "default",
    userEmail: "chat-worker@example.com",
    userGroups: ["CHAT_USER"],
    question: "根拠がない場合は回答不能ですか？",
    modelId: "model-a",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.01,
    includeDebug: false,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const result = await service.executeChatRun("default", "chat-final-precommit-revoke")

  assert.equal(result.status, "failed")
  assert.equal(result.errorCode, "permission_revoked")
  assert.equal(result.answer, undefined)
  assert.equal(result.debugRunId, undefined)
  assert.deepEqual((await service.listDebugRuns()).filter((trace) => trace.targetType === "chat_orchestration_run"), [])
  assert.deepEqual(await deps.objectStore.listKeys("quality-control/source-samples/"), [])
  const events = await deps.chatRunEventStore.listAfter("default", result.runId, 0)
  assert.equal(events.some((event) => event.type === "final"), false)
  assert.equal(events.some((event) => event.type === "error"), false)
})

test("FR-090 chat compensation failure leaves a durable cleanup intent with the authoritative deny", async () => {
  let revoked = false
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: "chat-worker",
      userId: "chat-worker",
      email: "chat-worker@example.com",
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: ["CHAT_USER"],
      tenantId: "default"
    })
  }
  const { service, deps } = await createService({
    verifiedIdentityProvider: identityProvider,
    onObjectPutText: (key) => {
      if (key.startsWith("debug-runs/") && !key.includes("/search_")) revoked = true
    },
    objectDeleteErrorPrefix: "debug-runs/",
    objectDeleteError: new Error("simulated debug cleanup outage")
  })
  await deps.chatRunStore.create({
    runId: "chat-cleanup-intent",
    status: "queued",
    createdBy: "chat-worker",
    tenantId: "default",
    userGroups: ["CHAT_USER"],
    question: "根拠がない場合は回答不能ですか？",
    modelId: "model-a",
    includeDebug: false,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  })

  const result = await service.executeChatRun("default", "chat-cleanup-intent")

  assert.equal(result.status, "failed")
  assert.equal(result.errorCode, "permission_revoked")
  assert.equal((await deps.objectStore.listKeys("debug-runs/")).filter((key) => !key.includes("/search_")).length, 1)
  const cleanupKeys = await deps.objectStore.listKeys("security/revocation-cleanup/")
  assert.equal(cleanupKeys.length, 1)
  const cleanup = JSON.parse(await deps.objectStore.getText(cleanupKeys[0]!)) as {
    resourceType: string
    authoritativeDeny: { status: string; version: string }
    targets: Array<{ reference: string }>
  }
  assert.equal(cleanup.resourceType, "account")
  assert.equal(cleanup.authoritativeDeny.status, "effective")
  assert.equal(cleanup.authoritativeDeny.version, "worker-authorization:chat-cleanup-intent:permission_revoked")
  assert.ok(cleanup.targets.some((target) => target.reference.startsWith("debug-runs/")))
  assert.ok(cleanup.targets.some((target) => target.reference.includes("quality-control:debug_trace:")))
  assert.ok(cleanup.targets.some((target) => target.reference.includes("quality-control:normal_chat:")))
})

test("asynchronous chat run stores debug trace by reference", async () => {
  const { service, deps } = await createService()
  await service.ingest({
    fileName: "debug.txt",
    text: "debug trace は object store に保存し、非同期 run には参照 ID だけを残します。"
  })

  await deps.chatRunStore.create({
    runId: "run-debug-reference",
    status: "queued",
    createdBy: "user-1",
    tenantId: "default",
    userEmail: "user@example.com",
    userGroups: ["SYSTEM_ADMIN"],
    question: "debug trace の保存先は？",
    modelId: "model-a",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.01,
    includeDebug: true,
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const completed = await service.executeChatRun("default", "run-debug-reference")
  assert.equal(completed.status, "succeeded")
  assert.equal((completed as unknown as Record<string, unknown>).debug, undefined)
  assert.ok(completed.debugRunId)

  const events = await deps.chatRunEventStore.listAfter("default", "run-debug-reference", 0)
  const final = events.find((event) => event.type === "final")
  assert.ok(final)
  assert.equal(typeof (final.data as Record<string, unknown>).debugRunId, "string")
  assert.equal((final.data as Record<string, unknown>).debug, undefined)
  assert.ok(await service.getDebugRun(completed.debugRunId ?? ""))
})

test("FR-074 asynchronous document ingest success persists tenant-scoped replay evidence", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active" as const, tenantId: "default" }
  await deps.objectStore.putBytes("uploads/documents/user-1/handbook.txt", Buffer.from("非同期取り込みはS3 upload sessionからworkerで実行します。"), "text/plain")

  const started = await service.startDocumentIngestRun({
    uploadId: "upload-1",
    objectKey: "uploads/documents/user-1/handbook.txt",
    purpose: "document",
    fileName: "handbook.txt",
    mimeType: "text/plain",
    skipMemory: true
  }, user)

  const completed = await waitForDocumentIngestRun(deps, started.runId)
  assert.equal(completed.status, "succeeded")
  assert.equal(completed.manifest?.fileName, "handbook.txt")
  assert.equal(completed.documentId, completed.manifest?.documentId)
  assert.ok(completed.traceId)
  assert.equal(completed.replayVersionManifest?.sourceSnapshots[0]?.ingestTraceId, completed.traceId)
  assert.equal(completed.replayVersionManifest?.parserVersion, completed.manifest?.sourceExtractorVersion)
  assert.equal(completed.replayVersionManifest?.ocrVersion, null)

  const events = await deps.documentIngestRunEventStore.listAfter("default", started.runId, 0)
  assert.deepEqual(events.map((event) => event.type), ["status", "status", "status", "status", "final"])
  assert.equal(completed.stage, "done")
  assert.equal(completed.counters?.chunkCount, 1)
  assert.equal(events.at(-1)?.stage, "done")
  assert.equal(events.at(-1)?.traceId, completed.traceId)
  assert.deepEqual(events.at(-1)?.replayVersionManifest, completed.replayVersionManifest)
  const trace = await service.getDebugRun(completed.traceId, user)
  assert.equal(trace?.targetType, "ingest_run")
  assert.equal(trace?.requestTraceId, started.runId)
  assert.deepEqual(trace?.replayVersionManifest, completed.replayVersionManifest)
  assert.equal(await service.getDebugRun(completed.traceId, { ...user, tenantId: "other-tenant" }), undefined)
})

test("FR-074 rejected document ingest persists observed replay evidence without publishing success", async () => {
  const { service, deps } = await createService()
  const objectKey = "uploads/documents/default/worker-user/rejected.txt"
  await deps.objectStore.putBytes(objectKey, Buffer.from("Rejected admission is retained only as staging evidence."), "text/plain")
  await deps.documentIngestRunStore.create({
    runId: "ingest-rejected",
    status: "queued",
    createdBy: "worker-user",
    tenantId: "default",
    userEmail: "worker@example.com",
    userGroups: ["RAG_GROUP_MANAGER"],
    uploadId: "upload-rejected",
    objectKey,
    purpose: "document",
    fileName: "rejected.txt",
    mimeType: "text/plain",
    admissionContext: { ...workerAdmissionContext(), inspectionStatus: "failed" },
    skipMemory: true,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const rejected = await service.executeDocumentIngestRun("default", "ingest-rejected")

  assert.equal(rejected.status, "rejected")
  assert.ok(rejected.traceId)
  assert.equal(rejected.replayVersionManifest?.sourceSnapshots[0]?.ingestTraceId, rejected.traceId)
  assert.equal(rejected.replayVersionManifest?.decisions.responseStatus, "warning")
  assert.equal(rejected.replayVersionManifest?.decisions.decisionCode, "rejected")
  assert.deepEqual(rejected.replayVersionManifest?.decisions.reasonCodes, ["admission_rejected"])
  assert.equal(rejected.replayVersionManifest?.decisions.deniedCandidateCount, rejected.replayVersionManifest?.decisions.candidateCount)
  const events = await deps.documentIngestRunEventStore.listAfter("default", rejected.runId, 0)
  assert.equal(events.at(-1)?.type, "final")
  assert.equal(events.at(-1)?.stage, "rejected")
  assert.equal(events.at(-1)?.traceId, rejected.traceId)
  const actor = { userId: "worker-user", tenantId: "default", accountStatus: "active" as const, cognitoGroups: ["RAG_GROUP_MANAGER"] }
  assert.equal((await service.getDebugRun(rejected.traceId, actor))?.status, "warning")
  assert.equal(await service.getDebugRun(rejected.traceId, { ...actor, tenantId: "other-tenant" }), undefined)
})

test("FR-074 worker failure persists an unknown-null replay manifest and a redacted trace", async () => {
  const { service, deps } = await createService()
  await deps.documentIngestRunStore.create({
    runId: "ingest-worker-failed",
    status: "queued",
    createdBy: "worker-user",
    tenantId: "default",
    uploadId: "upload-worker-failed",
    objectKey: "uploads/worker-failed.txt",
    purpose: "document",
    fileName: "secret-owner@example.com.txt",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const failed = await service.markDocumentIngestRunFailed("default", "ingest-worker-failed", "Bearer secret-worker-token-value")

  assert.equal(failed.status, "failed")
  assert.ok(failed.traceId)
  assert.equal(failed.replayVersionManifest?.sourceSnapshots.length, 0)
  assert.equal(failed.replayVersionManifest?.parserVersion, null)
  assert.equal(failed.replayVersionManifest?.embedding.modelId, null)
  assert.equal(failed.replayVersionManifest?.indexVersion, null)
  assert.equal(failed.replayVersionManifest?.decisions.decisionCode, "failed")
  assert.deepEqual(failed.replayVersionManifest?.decisions.reasonCodes, ["execution_error"])
  const events = await deps.documentIngestRunEventStore.listAfter("default", failed.runId, 0)
  assert.equal(events.at(-1)?.traceId, failed.traceId)
  assert.deepEqual(events.at(-1)?.replayVersionManifest, failed.replayVersionManifest)
  const actor = { userId: "worker-user", tenantId: "default", accountStatus: "active" as const, cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const trace = await service.getDebugRun(failed.traceId, actor)
  assert.match(trace?.question ?? "", /^sha256:/)
  assert.doesNotMatch(JSON.stringify(trace), /secret-owner@example\.com|secret-worker-token-value/)
})

test("FR-074 cancelled document ingest persists replay evidence without accepting caller trace correlation", async () => {
  const { service, deps } = await createService()
  await deps.documentIngestRunStore.create({
    runId: "ingest-cancelled",
    status: "queued",
    createdBy: "worker-user",
    tenantId: "default",
    uploadId: "upload-cancelled",
    objectKey: "uploads/cancelled.txt",
    purpose: "document",
    fileName: "cancelled.txt",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const cancelled = await service.cancelDocumentIngestRun("default", "ingest-cancelled")

  assert.equal(cancelled?.status, "cancelled")
  assert.equal(cancelled?.traceId, "ingest-run:ingest-cancelled")
  assert.equal(cancelled?.replayVersionManifest?.parserVersion, null)
  assert.equal(cancelled?.replayVersionManifest?.decisions.decisionCode, "cancelled")
  assert.deepEqual(cancelled?.replayVersionManifest?.decisions.reasonCodes, ["cancelled"])
  const trace = await service.getDebugRun(cancelled?.traceId ?? "", {
    userId: "worker-user",
    tenantId: "default",
    accountStatus: "active",
    cognitoGroups: ["RAG_GROUP_MANAGER"]
  })
  assert.equal(trace?.requestTraceId, "ingest-cancelled")
  assert.equal(trace?.status, "warning")
  assert.equal(await service.cancelDocumentIngestRun("other-tenant", "ingest-cancelled"), undefined)
})

test("FR-090 ingest reauthorizes after the final event and compensates before persisting success", async () => {
  let revoked = false
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => ({
      username: "worker-user",
      userId: "worker-user",
      email: "worker@example.com",
      accountStatus: revoked ? "suspended" : "active",
      cognitoGroups: ["RAG_GROUP_MANAGER"],
      tenantId: "default"
    })
  }
  const { service, deps } = await createService({
    verifiedIdentityProvider: identityProvider,
    onDocumentIngestRunEventAppend: (event) => {
      if (event.type === "final" && event.stage === "done") revoked = true
    }
  })
  const objectKey = "uploads/documents/default/worker-user/final-reauth.txt"
  await deps.objectStore.putBytes(objectKey, Buffer.from("A final-event race must never commit ingest success."), "text/plain")
  await deps.documentIngestRunStore.create({
    runId: "ingest-final-reauth",
    status: "queued",
    createdBy: "worker-user",
    tenantId: "default",
    userEmail: "worker@example.com",
    userGroups: ["RAG_GROUP_MANAGER"],
    uploadId: "upload-final-reauth",
    objectKey,
    purpose: "document",
    fileName: "final-reauth.txt",
    mimeType: "text/plain",
    admissionContext: workerAdmissionContext(),
    skipMemory: true,
    stage: "queued",
    counters: {},
    warnings: [],
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const result = await service.executeDocumentIngestRun("default", "ingest-final-reauth")

  assert.equal(result.status, "failed")
  assert.equal(result.errorCode, "permission_revoked")
  assert.equal(result.documentId, undefined)
  assert.deepEqual(await deps.objectStore.listKeys("source-governance/"), [])
  assert.equal((await service.listDocuments({
    userId: "worker-user",
    tenantId: "default",
    accountStatus: "active",
    cognitoGroups: ["RAG_GROUP_MANAGER"]
  })).length, 0)
  const events = await deps.documentIngestRunEventStore.listAfter("default", result.runId, 0)
  assert.equal(events.some((event) => event.type === "final"), true)
  assert.equal(events.at(-1)?.type, "error")
})

test("FR-090 revoke after governance creation compensates all ingest artifacts and never publishes success", async () => {
  let identityLookups = 0
  const runtime = { deps: undefined as Dependencies | undefined }
  const identityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async () => {
      identityLookups += 1
      const governanceCreated = runtime.deps
        ? (await runtime.deps.objectStore.listKeys("source-governance/")).length > 0
        : false
      return {
        username: "worker-user",
        userId: "worker-user",
        email: "worker@example.com",
        accountStatus: governanceCreated ? "suspended" : "active",
        cognitoGroups: ["RAG_GROUP_MANAGER"],
        tenantId: "default"
      }
    }
  }
  const { service, deps } = await createService({ verifiedIdentityProvider: identityProvider })
  runtime.deps = deps
  const objectKey = "uploads/documents/default/worker-user/revoke-after-governance.txt"
  await deps.objectStore.putBytes(objectKey, Buffer.from("A late revoke must compensate the whole document ingest transaction."), "text/plain")
  const admissionContext = workerAdmissionContext()
  await deps.documentIngestRunStore.create({
    runId: "ingest-revoke-after-governance",
    status: "queued",
    createdBy: "worker-user",
    tenantId: "default",
    userEmail: "worker@example.com",
    userGroups: ["RAG_GROUP_MANAGER"],
    uploadId: "upload-revoke-after-governance",
    objectKey,
    purpose: "document",
    fileName: "revoke-after-governance.txt",
    mimeType: "text/plain",
    admissionContext,
    skipMemory: true,
    stage: "queued",
    counters: {},
    warnings: [],
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const completed = await service.executeDocumentIngestRun("default", "ingest-revoke-after-governance")

  assert.equal(completed.status, "failed")
  assert.equal(completed.errorCode, "permission_revoked")
  assert.equal(completed.documentId, undefined)
  assert.ok(identityLookups >= 7)
  assert.equal((await service.listDocuments({
    userId: "worker-user",
    tenantId: "default",
    accountStatus: "active",
    cognitoGroups: ["RAG_GROUP_MANAGER"]
  })).length, 0)
  assert.deepEqual(await deps.objectStore.listKeys("source-governance/"), [])
  assert.ok((await deps.objectStore.getBytes(objectKey)).length > 0, "upload is retained because revoke happened before delete")
  const events = await deps.documentIngestRunEventStore.listAfter("default", completed.runId, 0)
  assert.equal(events.some((event) => event.type === "final"), false)
  assert.equal(events.at(-1)?.type, "error")
})

test("service lists all Cognito directory users in the managed user ledger", async () => {
  const directoryUsers: ManagedUser[] = [
    {
      userId: "admin-sub",
      email: "admin@example.com",
      displayName: "Admin",
      status: "active",
      groups: ["SYSTEM_ADMIN"],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    },
    {
      userId: "member-sub",
      email: "member@example.com",
      displayName: "Member",
      status: "active",
      groups: ["CHAT_USER"],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    }
  ]
  const assignedGroups: Array<{ username: string; groups: string[] }> = []
  const { service } = await createService({
    userDirectory: {
      listUsers: async () => directoryUsers,
      setUserGroups: async (username, groups) => {
        assignedGroups.push({ username, groups })
      }
    }
  })
  const actor = { userId: "admin-sub", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }

  const users = await service.listManagedUsers(actor)

  assert.deepEqual(users.map((user) => user.email), ["admin@example.com", "member@example.com"])
  assert.equal(users.find((user) => user.userId === "member-sub")?.groups[0], "CHAT_USER")

  const updated = await service.assignUserRoles(actor, "member-sub", ["ANSWER_EDITOR"])
  assert.deepEqual(updated?.groups, ["ANSWER_EDITOR"])
  assert.deepEqual(assignedGroups, [{ username: "member@example.com", groups: ["ANSWER_EDITOR"] }])
  assert.deepEqual((await service.listManagedUsers(actor)).find((user) => user.userId === "member-sub")?.groups, ["ANSWER_EDITOR"])

  const suspended = await service.suspendManagedUser(actor, "member-sub")
  assert.equal(suspended?.status, "suspended")
  assert.equal((await service.listManagedUsers(actor)).find((user) => user.userId === "member-sub")?.status, "suspended")

  await service.deleteManagedUser(actor, "member-sub")
  assert.equal((await service.listManagedUsers(actor)).some((user) => user.userId === "member-sub"), false)
})

test("service merges Cognito directory users with existing ledger users by email", async () => {
  let directoryUsers: ManagedUser[] = []
  const { service } = await createService({
    userDirectory: {
      listUsers: async () => directoryUsers
    }
  })
  const actor = { userId: "admin-sub", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }

  await service.createManagedUser(actor, {
    email: "dup@example.com",
    displayName: "Ledger User",
    groups: ["ANSWER_EDITOR"]
  })
  directoryUsers = [
    {
      userId: "dup-sub",
      email: "dup@example.com",
      displayName: "Cognito User",
      status: "active",
      groups: ["CHAT_USER"],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z"
    }
  ]

  const users = await service.listManagedUsers(actor)
  const matchingUsers = users.filter((user) => user.email === "dup@example.com")

  assert.equal(matchingUsers.length, 1)
  assert.equal(matchingUsers[0]?.userId, "dup-sub")
  assert.deepEqual(matchingUsers[0]?.groups, ["ANSWER_EDITOR"])
})

test("service chat returns refusal and error debug trace when external dependencies fail", async () => {
  const { service } = await createService({
    textModel: new MockBedrockTextModel({ embed: new Error("Bedrock embed timeout") }),
    evidenceQueryError: new Error("Vector query failed"),
    objectGetErrorPrefix: "debug-runs/",
    objectGetError: new Error("S3 get failed")
  })

  const result = await service.chat({
    question: "仕様は？",
    includeDebug: true
  })

  assert.equal(result.isAnswerable, false)
  assert.equal(result.answer, "資料からは回答できません。")
  assert.equal(result.debug?.status, "error")
  const errorStep = result.debug?.steps.find((step) => step.status === "error")
  assert.ok(errorStep)
  assert.equal(errorStep?.detail, undefined)
  assert.equal(errorStep?.output, undefined)
  assert.doesNotMatch(JSON.stringify(result.debug), /Bedrock embed timeout|Vector query failed/)
  await assert.rejects(() => service.listDebugRuns(), /S3 get failed/)
})

test("debug trace download metadata forces attachment and sanitizes the file name", () => {
  const metadata = createDebugTraceDownloadMetadata("run/with:unsafe*chars")

  assert.deepEqual(metadata, {
    fileName: "debug-trace-run_with_unsafe_chars.json",
    objectKey: "downloads/debug-trace-run_with_unsafe_chars.json",
    contentDisposition: 'attachment; filename="debug-trace-run_with_unsafe_chars.json"'
  })
})

test("benchmark artifact download metadata forces attachment and artifact extensions", () => {
  assert.deepEqual(createBenchmarkArtifactDownloadMetadata("bench/with:unsafe*chars", "report", "runs/bench/report.md"), {
    fileName: "benchmark-report-bench_with_unsafe_chars.md",
    objectKey: "runs/bench/report.md",
    contentDisposition: 'attachment; filename="benchmark-report-bench_with_unsafe_chars.md"'
  })
  assert.deepEqual(createBenchmarkArtifactDownloadMetadata("bench-1", "summary", "runs/bench-1/summary.json"), {
    fileName: "benchmark-summary-bench-1.json",
    objectKey: "runs/bench-1/summary.json",
    contentDisposition: 'attachment; filename="benchmark-summary-bench-1.json"'
  })
  assert.deepEqual(createBenchmarkArtifactDownloadMetadata("bench-1", "results", "runs/bench-1/results.jsonl"), {
    fileName: "benchmark-results-bench-1.jsonl",
    objectKey: "runs/bench-1/results.jsonl",
    contentDisposition: 'attachment; filename="benchmark-results-bench-1.jsonl"'
  })
})

test("benchmark CodeBuild log download returns the stored log URL", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }
  const run = await service.createBenchmarkRun(user, {})
  await deps.benchmarkRunStore.update("default", run.runId, {
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogUrl: "https://console.aws.amazon.com/codesuite/codebuild/projects/memo/build/build-id/log"
  })

  assert.equal(await service.createBenchmarkArtifactDownloadUrl(user, "missing-run", "logs"), undefined)
  const download = await service.createBenchmarkArtifactDownloadUrl(user, run.runId, "logs")
  assert.deepEqual(download, {
    url: "https://console.aws.amazon.com/codesuite/codebuild/projects/memo/build/build-id/log",
    expiresInSeconds: 900,
    objectKey: "memo-benchmark:build-id"
  })
})

test("benchmark CodeBuild log text download uses stored log stream metadata", async () => {
  const references: unknown[] = []
  const logReader: CodeBuildLogReader = {
    getText: async (reference) => {
      references.push(reference)
      return reference.logGroupName === "/aws/codebuild/memo" && reference.logStreamName === "build-stream"
        ? "install phase\nbuild phase\n"
        : undefined
    }
  }
  const { service, deps } = await createService({ codeBuildLogReader: logReader })
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }
  const run = await service.createBenchmarkRun(user, {})
  await deps.benchmarkRunStore.update("default", run.runId, {
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogGroupName: "/aws/codebuild/memo",
    codeBuildLogStreamName: "build-stream"
  })

  assert.equal(await service.getBenchmarkCodeBuildLogText(user, "missing-run"), undefined)
  const download = await service.getBenchmarkCodeBuildLogText(user, run.runId)
  assert.deepEqual(download, {
    text: "install phase\nbuild phase\n",
    fileName: `benchmark-logs-${run.runId}.txt`,
    contentDisposition: `attachment; filename="benchmark-logs-${run.runId}.txt"`
  })
  assert.deepEqual(references, [
    {
      buildId: "memo-benchmark:build-id",
      logGroupName: "/aws/codebuild/memo",
      logStreamName: "build-stream"
    }
  ])
})

test("debug trace JSON for answerable runs matches the v1 schema example", () => {
  const trace: DebugTrace = {
    schemaVersion: 1,
    runId: "run_answerable",
    question: "期限はいつですか？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:01.000Z",
    totalLatencyMs: 1000,
    status: "success",
    answerPreview: "期限は翌月5営業日までです。",
    isAnswerable: true,
    citations: [
      {
        documentId: "doc-1",
        fileName: "policy.txt",
        chunkId: "chunk-0001",
        score: 0.91,
        text: "申請期限は翌月5営業日までです。"
      }
    ],
    retrieved: [
      {
        documentId: "doc-1",
        fileName: "policy.txt",
        chunkId: "chunk-0001",
        score: 0.91,
        text: "申請期限は翌月5営業日までです。"
      }
    ],
    steps: [
      {
        id: 1,
        label: "retrieve_memory",
        status: "success",
        latencyMs: 12,
        modelId: "amazon.titan-embed-text-v2:0",
        summary: "memory hits=1",
        output: {
          memoryCards: [
            {
              key: "doc-1-memory-0000",
              score: 0.8,
              metadata: {
                kind: "memory",
                documentId: "doc-1",
                fileName: "policy.txt",
                memoryId: "memory-0000",
                text: "Summary: 申請期限",
                createdAt: "2026-05-01T00:00:00.000Z"
              }
            }
          ]
        },
        hitCount: 1,
        startedAt: "2026-05-02T00:00:00.000Z",
        completedAt: "2026-05-02T00:00:00.012Z"
      },
      {
        id: 2,
        label: "finalize_response",
        status: "success",
        latencyMs: 3,
        summary: "finalized",
        detail: "期限は翌月5営業日までです。",
        output: {
          answer: "期限は翌月5営業日までです。"
        },
        tokenCount: 10,
        startedAt: "2026-05-02T00:00:00.997Z",
        completedAt: "2026-05-02T00:00:01.000Z"
      }
    ]
  }

  const formatted = JSON.parse(formatDebugTraceJson(trace)) as DebugTrace
  assert.match(formatted.question, /^sha256:[0-9a-f]{64}$/)
  assert.equal(formatted.answerPreview, "[redacted:document-content]")
  assert.equal(formatted.citations[0]?.text, "[redacted:document-content]")
  assert.equal(formatted.retrieved[0]?.text, "[redacted:document-content]")
  assert.equal(formatted.steps[0]?.summary, "retrieve_memory:success")
  assert.equal(formatted.steps[0]?.output, undefined)
  assert.equal(formatted.steps[1]?.detail, undefined)
  assert.equal(formatted.steps[1]?.output, undefined)
  assert.equal(formatted.targetType, "rag_run")
  assert.equal(formatted.visibility, "operator_sanitized")
  assert.equal(formatted.sanitizePolicyVersion, "debug-trace-sanitize-v1")
  assert.ok(formatted.exportRedaction?.redactedFields.includes("retrieved[].text"))
  assert.ok(formatted.exportRedaction?.redactedFields.includes("steps[].output"))
})

test("debug trace JSON for refusal runs matches the v1 schema example", () => {
  const trace: DebugTrace = {
    schemaVersion: 1,
    runId: "run_refusal",
    question: "資料にない制度は？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:00.200Z",
    totalLatencyMs: 200,
    status: "warning",
    answerPreview: "資料からは回答できません。",
    isAnswerable: false,
    citations: [],
    retrieved: [],
    steps: [
      {
        id: 1,
        label: "answerability_gate",
        status: "warning",
        latencyMs: 8,
        summary: "answerable=false, reason=no_relevant_chunks",
        detail: "reason=no_relevant_chunks\nconfidence=0",
        output: {
          answerability: {
            isAnswerable: false,
            reason: "no_relevant_chunks",
            confidence: 0
          },
          answer: "資料からは回答できません。",
          citations: []
        },
        startedAt: "2026-05-02T00:00:00.100Z",
        completedAt: "2026-05-02T00:00:00.108Z"
      }
    ]
  }

  const formatted = JSON.parse(formatDebugTraceJson(trace)) as DebugTrace
  assert.equal(formatted.schemaVersion, 1)
  assert.equal(formatted.runId, "run_refusal")
  assert.match(formatted.question, /^sha256:[0-9a-f]{64}$/)
  assert.equal(formatted.answerPreview, "[redacted:document-content]")
  assert.deepEqual(formatted.citations, [])
  assert.deepEqual(formatted.retrieved, [])
  assert.equal(formatted.steps[0]?.summary, "answerability_gate:warning")
  assert.equal(formatted.steps[0]?.detail, undefined)
  assert.equal(formatted.steps[0]?.output, undefined)
  assert.equal(formatted.targetType, "rag_run")
  assert.equal(formatted.visibility, "operator_sanitized")
  assert.ok(formatted.exportRedaction?.redactedFields.includes("question"))
})

test("service ingest falls back when memory JSON parse fails and surfaces generate timeout", async () => {
  const { service: parseFallbackService } = await createService({
    textModel: new MockBedrockTextModel({ invalidJsonOnGenerate: true })
  })
  const manifest = await parseFallbackService.ingest({
    fileName: "doc.txt",
    text: "これは要件定義の本文です。"
  })
  assert.equal(manifest.memoryCardCount, 1)

  const { service: timeoutService } = await createService({
    textModel: new MockBedrockTextModel({ generate: new Error("Bedrock generate timeout") })
  })
  await assert.rejects(
    () => timeoutService.ingest({ fileName: "doc.txt", text: "これは要件定義の本文です。" }),
    /Bedrock generate timeout/
  )
})

test("service covers admin defaults, alias misses, terminal async runs, and benchmark edge cases", async () => {
  const { service, deps } = await createService()
  const admin = { userId: "admin-1", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" as const, tenantId: "default" }
  const chatUser = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const, tenantId: "default" }

  const managed = await service.createManagedUser(admin, {
    email: "  Worker@Example.COM  ",
    displayName: "   ",
    groups: []
  })
  assert.equal(managed.email, "worker@example.com")
  assert.equal(managed.displayName, "worker")
  assert.deepEqual(managed.groups, ["CHAT_USER"])
  await assert.rejects(
    () => service.createManagedUser(admin, { email: "worker@example.com", groups: ["CHAT_USER"] }),
    /already exists/
  )
  assert.equal(await service.assignUserRoles(admin, "missing-user", ["CHAT_USER"]), undefined)
  assert.deepEqual((await service.assignUserRoles(admin, managed.userId, []))?.groups, ["CHAT_USER"])
  assert.equal(await service.suspendManagedUser(admin, "missing-user"), undefined)
  assert.equal(await service.deleteManagedUser(admin, "missing-user"), undefined)
  assert.ok((await service.listAdminAuditLog(admin)).some((entry) => entry.action === "role:assign"))

  const usage = await service.listUsageSummaries(admin)
  assert.equal(usage.find((item) => item.userId === managed.userId)?.chatMessages, undefined)
  assert.ok(usage.find((item) => item.userId === managed.userId)?.unavailableMetrics.includes("chatMessages"))
  const cost = await service.getCostAuditSummary(admin)
  assert.equal(cost.available, false)
  assert.equal(cost.currency, undefined)
  assert.equal(cost.items, undefined)

  const alias = await service.createAlias(admin, {
    term: "  PTO  ",
    expansions: [" 有給休暇 ", "有給休暇", ""],
    scope: { tenantId: " tenant-a ", department: "" }
  })
  assert.deepEqual(alias.expansions, ["有給休暇"])
  assert.deepEqual(alias.scope, { tenantId: "tenant-a" })
  assert.equal(await service.updateAlias(admin, "missing-alias", { term: "x" }), undefined)
  assert.equal(await service.reviewAlias(admin, "missing-alias", { decision: "approve" }), undefined)
  assert.equal(await service.disableAlias(admin, "missing-alias"), undefined)
  assert.equal((await service.reviewAlias(admin, alias.aliasId, { decision: "reject", comment: "未承認" }))?.status, "draft")
  assert.equal((await service.disableAlias(admin, alias.aliasId))?.status, "disabled")
  assert.equal((await service.updateAlias(admin, alias.aliasId, { term: "paid-time-off" }))?.status, "disabled")
  assert.equal((await service.publishAliases(admin)).aliasCount, 0)
  assert.equal((await service.listAliases())[0]?.status, "disabled")

  await assert.rejects(() => service.cutoverReindexMigration(admin, "missing-migration"), /not found/)
  await assert.rejects(() => service.rollbackReindexMigration(admin, "missing-migration"), /not found/)

  await assert.rejects(() => service.executeChatRun("default", "missing-run"), /Chat run not found/)
  await assert.rejects(() => service.markChatRunFailed("default", "missing-run", "timeout"), /Chat run not found/)
  await deps.chatRunStore.create({
    runId: "run-terminal",
    status: "succeeded",
    createdBy: chatUser.userId,
    tenantId: "default",
    question: "done",
    modelId: "model-a",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  assert.equal((await service.markChatRunFailed("default", "run-terminal", "ignored")).status, "succeeded")

  await assert.rejects(() => service.executeDocumentIngestRun("default", "missing-ingest"), /Document ingest run not found/)
  await assert.rejects(() => service.markDocumentIngestRunFailed("default", "missing-ingest", "timeout"), /Document ingest run not found/)
	  await deps.documentIngestRunStore.create({
	    runId: "ingest-terminal",
	    status: "cancelled",
	    createdBy: chatUser.userId,
	    tenantId: "default",
	    uploadId: "upload-terminal",
	    objectKey: "uploads/cancelled.txt",
	    purpose: "document",
	    fileName: "cancelled.txt",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  assert.equal((await service.markDocumentIngestRunFailed("default", "ingest-terminal", "ignored")).status, "cancelled")
  await deps.objectStore.putBytes("uploads/empty.txt", Buffer.from(""))
	  await deps.documentIngestRunStore.create({
	    runId: "ingest-empty",
	    status: "queued",
	    createdBy: chatUser.userId,
	    userEmail: chatUser.email,
	    userGroups: ["RAG_GROUP_MANAGER"],
	    tenantId: "default",
	    uploadId: "upload-empty",
	    objectKey: "uploads/empty.txt",
	    purpose: "document",
    fileName: "empty.txt",
    mimeType: "text/plain",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  const failedIngest = await service.executeDocumentIngestRun("default", "ingest-empty")
  assert.equal(failedIngest.status, "failed")
  assert.match(failedIngest.error ?? "", /Uploaded object is empty/)

  await assert.rejects(() => service.createBenchmarkRun(chatUser, { suiteId: "missing-suite" }), /Unknown benchmark suite/)
  await assert.rejects(() => service.createBenchmarkRun(chatUser, { suiteId: "search-smoke-v1", mode: "agent" }), /does not support mode/)
	  await assert.rejects(() => service.createBenchmarkRun(chatUser, { runner: "local" as BenchmarkRunner }), /Only codebuild runner/)
  const searchRun = await service.createBenchmarkRun(chatUser, { suiteId: "search-smoke-v1", mode: "search", topK: 999 })
  assert.equal(searchRun.mode, "search")
  assert.equal(searchRun.topK, ragRuntimePolicy.retrieval.searchRagMaxTopK)
  assert.equal(await service.cancelBenchmarkRun(chatUser, "missing-benchmark-run"), undefined)
  assert.equal((await service.cancelBenchmarkRun(chatUser, searchRun.runId))?.status, "cancelled")
  assert.equal(await service.createBenchmarkArtifactDownloadUrl(chatUser, searchRun.runId, "logs"), undefined)
  await assert.rejects(() => service.createBenchmarkArtifactDownloadUrl(chatUser, searchRun.runId, "summary"), /BENCHMARK_BUCKET_NAME/)
  assert.equal(await service.getBenchmarkCodeBuildLogText(chatUser, searchRun.runId), undefined)
})

async function createService(options: {
  textModel?: MockBedrockTextModel
  evidenceQueryError?: Error
  evidencePutErrorAfterWriteWhen?: (records: Parameters<LocalVectorStore["put"]>[0]) => boolean
  evidenceDeleteErrorAfterWrite?: Error
  objectGetErrorPrefix?: string
  objectGetError?: Error
  objectDeleteErrorPrefix?: string
  objectDeleteError?: Error
  objectListExtraKeys?: string[]
  userDirectory?: UserDirectory
  codeBuildLogReader?: CodeBuildLogReader
  asyncAgentProviders?: AsyncAgentProviderRegistry
  resourceUserPrincipals?: readonly ResourceUserPrincipal[]
  verifiedIdentityProvider?: VerifiedIdentityProvider
  onChatRunEventAppend?: (input: Parameters<LocalChatRunEventStore["append"]>[1]) => void | Promise<void>
  onObjectPutText?: (key: string) => void | Promise<void>
  onObjectPutTextIfVersion?: (key: string) => void | Promise<void>
  onDocumentIngestRunEventAppend?: (input: Parameters<LocalDocumentIngestRunEventStore["append"]>[1]) => void | Promise<void>
} = {}): Promise<{ service: MemoRagService; dataDir: string; deps: Dependencies }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-service-test-"))
  const baseObjectStore = new LocalObjectStore(dataDir)
  const baseEvidenceStore = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const baseChatRunEventStore = new LocalChatRunEventStore(dataDir)
  const baseDocumentIngestRunEventStore = new LocalDocumentIngestRunEventStore(dataDir)
  const deps = {
    objectStore: {
      putText: async (...args: Parameters<LocalObjectStore["putText"]>) => {
        await baseObjectStore.putText(...args)
        await options.onObjectPutText?.(args[0])
      },
      putTextIfVersion: async (...args: Parameters<LocalObjectStore["putTextIfVersion"]>) => {
        const result = await baseObjectStore.putTextIfVersion(...args)
        await options.onObjectPutTextIfVersion?.(args[0])
        return result
      },
      putBytes: (...args: Parameters<LocalObjectStore["putBytes"]>) => baseObjectStore.putBytes(...args),
      getText: async (key: string) => {
        if (options.objectGetError && options.objectGetErrorPrefix && key.startsWith(options.objectGetErrorPrefix)) {
          throw options.objectGetError
        }
        return baseObjectStore.getText(key)
      },
      getTextWithVersion: (...args: Parameters<LocalObjectStore["getTextWithVersion"]>) => baseObjectStore.getTextWithVersion(...args),
      getBytes: (...args: Parameters<LocalObjectStore["getBytes"]>) => baseObjectStore.getBytes(...args),
      getObjectSize: (...args: Parameters<LocalObjectStore["getObjectSize"]>) => baseObjectStore.getObjectSize(...args),
      deleteObject: async (...args: Parameters<LocalObjectStore["deleteObject"]>) => {
        if (options.objectDeleteError && options.objectDeleteErrorPrefix && args[0].startsWith(options.objectDeleteErrorPrefix)) {
          throw options.objectDeleteError
        }
        return baseObjectStore.deleteObject(...args)
      },
      listKeys: async (...args: Parameters<LocalObjectStore["listKeys"]>) => [
        ...(await baseObjectStore.listKeys(...args)),
        ...(options.objectListExtraKeys ?? [])
      ]
    },
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    evidenceVectorStore: {
      put: async (...args: Parameters<LocalVectorStore["put"]>) => {
        await baseEvidenceStore.put(...args)
        if (options.evidencePutErrorAfterWriteWhen?.(args[0])) throw new Error("simulated partial active put failure")
      },
      query: async (...args: Parameters<LocalVectorStore["query"]>) => {
        if (options.evidenceQueryError) throw options.evidenceQueryError
        return baseEvidenceStore.query(...args)
      },
      getByKeys: (...args: Parameters<LocalVectorStore["getByKeys"]>) => baseEvidenceStore.getByKeys(...args),
      delete: async (...args: Parameters<LocalVectorStore["delete"]>) => {
        await baseEvidenceStore.delete(...args)
        if (options.evidenceDeleteErrorAfterWrite) throw options.evidenceDeleteErrorAfterWrite
      }
    },
    textModel: options.textModel ?? new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir),
    favoriteStore: new LocalFavoriteStore(dataDir),
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir),
    chatRunStore: new LocalChatRunStore(dataDir),
    chatRunEventStore: {
      append: async (...args: Parameters<LocalChatRunEventStore["append"]>) => {
        const appended = await baseChatRunEventStore.append(...args)
        await options.onChatRunEventAppend?.(args[1])
        return appended
      },
      listAfter: (...args: Parameters<LocalChatRunEventStore["listAfter"]>) => baseChatRunEventStore.listAfter(...args)
    },
    documentIngestRunStore: new LocalDocumentIngestRunStore(dataDir),
    documentIngestRunEventStore: {
      append: async (...args: Parameters<LocalDocumentIngestRunEventStore["append"]>) => {
        const appended = await baseDocumentIngestRunEventStore.append(...args)
        await options.onDocumentIngestRunEventAppend?.(args[1])
        return appended
      },
      listAfter: (...args: Parameters<LocalDocumentIngestRunEventStore["listAfter"]>) => baseDocumentIngestRunEventStore.listAfter(...args)
    },
    documentGroupStore: new LocalDocumentGroupStore(dataDir),
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir),
    codeBuildLogReader: options.codeBuildLogReader ?? { getText: async () => undefined },
    asyncAgentProviders: options.asyncAgentProviders ?? defaultTestAsyncAgentProviders(),
    userDirectory: options.userDirectory,
    verifiedIdentityProvider: options.verifiedIdentityProvider,
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "memorag-service-test", tenantId: "default", ownerUserId: "local-dev" }
  } as unknown as Dependencies
  if (options.resourceUserPrincipals) {
    const principals = new Map(options.resourceUserPrincipals.map((principal) => [principal.userId, principal]))
    deps.resourceUserPrincipalDirectory = {
      getUser: async (userId: string) => principals.get(userId)
    }
    deps.securityAuditOutbox = new ObjectStoreSecurityMutationAuditOutbox(deps.objectStore)
  }
  return { service: new MemoRagService(deps), dataDir, deps }
}

function workerAdmissionContext(): AuthoritativeAdmissionContext {
  const reference = (id: string) => ({ id: `worker:${id}`, version: "v1", hash: `${id}:approved` })
  return {
    mode: "authoritative",
    tenantId: "default",
    ownerUserId: "worker-user",
    authorizationRef: reference("authorization"),
    classificationRef: reference("classification"),
    usagePolicyRef: reference("usage"),
    qualityRef: reference("quality"),
    lifecycleRef: reference("lifecycle"),
    provenanceRef: reference("provenance"),
    inspectionStatus: "passed",
    qualityProfile: {
      knowledgeQualityStatus: "approved",
      verificationStatus: "verified",
      freshnessStatus: "current",
      supersessionStatus: "current",
      extractionQualityStatus: "high",
      ragEligibility: "eligible",
      flags: []
    },
    lifecycleStatus: "active",
    scope: { scopeType: "personal", allowedUsers: ["worker-user"] }
  }
}

async function seedFolderPolicy(deps: Dependencies, folderId: string, entries: FolderPolicyEntry[], tenantId = "default"): Promise<void> {
  const folder = await deps.documentGroupStore.get(tenantId, folderId)
  assert.ok(folder, `folder fixture ${folderId} must exist`)
  const policyId = `test-policy-${folderId}`
  const now = "2026-05-01T00:00:00.000Z"
  await deps.folderPolicyStore.save({
    policyId,
    itemType: "folderPolicy",
    tenantId: folder.tenantId ?? "default",
    folderId,
    entries,
    createdBy: folder.ownerUserId,
    createdAt: now,
    updatedAt: now
  })
}

async function readSecurityMutationAuditIntents(deps: Dependencies): Promise<SecurityMutationAuditIntent[]> {
  const keys = await deps.objectStore.listKeys("security-audit/intents/")
  return Promise.all(keys.map(async (key) => JSON.parse(await deps.objectStore.getText(key)) as SecurityMutationAuditIntent))
}

function localDocumentManager(): AppUser {
  return {
    userId: "local-dev",
    email: "local-dev@example.com",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "default"
  }
}

function fakeAsyncAgentProvider(options: {
  provider?: AgentRuntimeProvider
  displayName?: string
  availability: "available" | "not_configured"
  execute?: AsyncAgentProviderAdapter["execute"]
}): AsyncAgentProviderAdapter {
  return {
    definition: () => ({
      provider: options.provider ?? "claude_code",
      displayName: options.displayName ?? "Claude Code",
      availability: options.availability,
      reason: options.availability === "available" ? undefined : "CLAUDE_CODE_COMMAND is not configured.",
      configuredModelIds: options.availability === "available" ? ["claude-code-default"] : []
    }),
    execute: options.execute ?? (async () => ({ status: "failed", failureReason: "not configured" }))
  }
}

function defaultTestAsyncAgentProviders(): AsyncAgentProviderRegistry {
  return new AsyncAgentProviderRegistry([
    fakeAsyncAgentProvider({ provider: "claude_code", displayName: "Claude Code", availability: "not_configured" }),
    fakeAsyncAgentProvider({ provider: "codex", displayName: "Codex", availability: "not_configured" }),
    fakeAsyncAgentProvider({ provider: "opencode", displayName: "OpenCode", availability: "not_configured" }),
    {
      definition: () => ({
        provider: "custom",
        displayName: "Custom",
        availability: "disabled",
        reason: "Custom provider execution is disabled until a tenant provider adapter is configured.",
        configuredModelIds: []
      }),
      execute: async () => ({ status: "failed", failureReason: "custom disabled" })
    }
  ])
}

function asyncAgentCommandFixturePath(): string {
  return fileURLToPath(new URL("../../test-fixtures/async-agent-command.sh", import.meta.url))
}

async function waitForDocumentIngestRun(deps: Dependencies, runId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const run = await deps.documentIngestRunStore.get("default", runId)
    if (run?.status === "succeeded" || run?.status === "rejected" || run?.status === "failed" || run?.status === "cancelled") return run
    await delay(20)
  }
  throw new Error(`Timed out waiting for document ingest run: ${runId}`)
}
