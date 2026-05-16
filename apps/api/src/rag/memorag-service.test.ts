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
import { LocalChatRunEventStore } from "../adapters/local-chat-run-event-store.js"
import { LocalChatRunStore } from "../adapters/local-chat-run-store.js"
import type { AppUser } from "../auth.js"
import { LocalDocumentIngestRunEventStore } from "../adapters/local-document-ingest-run-event-store.js"
import { LocalDocumentIngestRunStore } from "../adapters/local-document-ingest-run-store.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import type { AgentRuntimeProvider, AsyncAgentRun, BenchmarkRunner, DebugTrace, ManagedUser } from "../types.js"
import type { UserDirectory } from "../adapters/user-directory.js"
import type { CodeBuildLogReader } from "../adapters/codebuild-log-reader.js"
import { CommandAsyncAgentProvider } from "../async-agent/command-provider.js"
import { AsyncAgentProviderRegistry, type AsyncAgentProviderAdapter, type AsyncAgentProviderInput } from "../async-agent/provider.js"
import { ragRuntimePolicy } from "../chat-orchestration/runtime-policy.js"
import { authorizeDocumentDelete } from "../routes/benchmark-seed.js"
import { createBenchmarkArtifactDownloadMetadata, createDebugTraceDownloadMetadata, formatDebugTraceJson, MemoRagService } from "./memorag-service.js"

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
  assert.equal(manifest.pipelineVersions?.chunkerVersion, "chunk-semantic-v3")
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
  assert.equal(answer.isAnswerable, true)
  assert.ok(answer.debug?.runId)
  assert.equal(answer.debug?.schemaVersion, 1)
  assert.equal(answer.debug?.pipelineVersions?.promptVersion, "rag-prompts-v1")
  assert.equal(answer.debug?.steps.at(-1)?.label, "finalize_response")
  assert.match(String(answer.debug?.steps.at(-1)?.output?.answer ?? ""), /ソフトウェア製品要求|分類/)

  const debugRuns = await service.listDebugRuns()
  assert.equal(debugRuns.length, 1)
  assert.deepEqual(await service.getDebugRun(answer.debug?.runId ?? ""), debugRuns[0])

  const deleted = await service.deleteDocument(manifest.documentId)
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
  await assert.rejects(() => service.deleteDocument("missing-document-id"))
  assert.equal(await service.getDebugRun("missing-run"), undefined)
})

test("service manages async agent run metadata without provider execution or mock artifacts", async () => {
  const { service, deps } = await createService()
  const owner: AppUser = { userId: "agent-owner", email: "agent-owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
  const other: AppUser = { userId: "other-user", email: "other@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
  const admin: AppUser = { userId: "agent-admin", email: "agent-admin@example.com", cognitoGroups: ["ASYNC_AGENT_ADMIN"] }
  const manifest = await service.ingest({ fileName: "agent-source.md", text: "非同期エージェントの対象資料です。", skipMemory: true })
  const group = await service.createDocumentGroup(owner, { name: "Agent source group" })

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
  await assert.rejects(() => service.getAsyncAgentRun(other, run.agentRunId), /Forbidden/)
  assert.deepEqual(await service.listAsyncAgentRuns(owner), [run])
  assert.deepEqual(await service.listAsyncAgentRuns(other), [])
  assert.equal((await service.listAsyncAgentRuns(admin))[0]?.agentRunId, run.agentRunId)

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
  await assert.rejects(() => service.executeAsyncAgentRun("missing-run"), /Async agent run not found/)

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
  await deps.objectStore.putText("agent-runs/agent_queued_fixture.json", JSON.stringify(queuedRun), "application/json; charset=utf-8")

  const blockedByWorkerContract = await service.executeAsyncAgentRun("agent_queued_fixture")
  assert.equal(blockedByWorkerContract.status, "blocked")
  assert.equal(blockedByWorkerContract.failureReasonCode, "not_configured")
  assert.equal((await service.getAsyncAgentArtifact(owner, "agent_queued_fixture", "artifact_report_fixture"))?.fileName, "report.md")
  assert.equal((await service.listAsyncAgentArtifacts(owner, "agent_queued_fixture"))?.length, 1)
})

test("service treats object-store missing variants as absent async agent runs", async () => {
  const owner: AppUser = { userId: "agent-owner", email: "agent-owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
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
      objectGetErrorPrefix: `agent-runs/missing-${index}`,
      objectGetError
    })
    assert.equal(await service.getAsyncAgentRun(owner, `missing-${index}`), undefined)
  }
})

test("service surfaces non-missing async agent run load errors", async () => {
  const owner: AppUser = { userId: "agent-owner", email: "agent-owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
  const { service } = await createService({
    objectGetErrorPrefix: "agent-runs/broken",
    objectGetError: new Error("object store unavailable")
  })
  await assert.rejects(() => service.getAsyncAgentRun(owner, "broken"), /object store unavailable/)
})

test("service listDocuments filters manifests by ACL for callers", async () => {
  const { service } = await createService()
  const general = await service.ingest({
    fileName: "general.md",
    text: "通常利用者向けの資料です。",
    skipMemory: true
  })
  const benchmark = await service.ingest({
    fileName: "handbook.md",
    text: "経費精算は30日以内です。",
    skipMemory: true,
    metadata: {
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      source: "benchmark-runner",
      lifecycleStatus: "active"
    }
  })
  const chatUser = { userId: "chat-1", email: "chat@example.com", cognitoGroups: ["CHAT_USER"] }
  const benchmarkRunner = { userId: "runner-1", email: "runner@example.com", cognitoGroups: ["BENCHMARK_RUNNER"] }
  const systemAdmin = { userId: "admin-1", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

  assert.deepEqual((await service.listDocuments(chatUser)).map((doc) => doc.documentId), [general.documentId])
  assert.deepEqual((await service.listDocuments(benchmarkRunner)).map((doc) => doc.documentId).sort(), [benchmark.documentId, general.documentId].sort())
  assert.deepEqual((await service.listDocuments(systemAdmin)).map((doc) => doc.documentId).sort(), [benchmark.documentId, general.documentId].sort())
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

  assert.equal(eligible.qualityProfile, undefined)
  assert.equal(excluded.qualityProfile?.ragEligibility, "excluded")
  assert.equal(excluded.qualityProfile?.verificationStatus, "rejected")
  assert.deepEqual((await service.listDocuments()).map((doc) => doc.documentId).sort(), [eligible.documentId, excluded.documentId].sort())
  const search = await service.search(
    { query: "品質管理", topK: 5, lexicalTopK: 5, semanticTopK: 0 },
    { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"] }
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
  const benchmark = await service.ingest({
    fileName: "benchmark.md",
    text: "benchmark corpus content",
    skipMemory: true,
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
      source: "benchmark-runner"
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
  const benchmarkRunner = { userId: "runner-1", email: "runner@example.com", cognitoGroups: ["BENCHMARK_RUNNER"] }

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
  const { service } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER"] }
  const member = { userId: "member-1", email: "member@example.com", cognitoGroups: ["CHAT_USER"] }
  const outsider = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["CHAT_USER"] }
  const group = await service.createDocumentGroup(owner, {
    name: "Private launch group",
    sharedUserIds: [member.userId]
  })
  const publicDoc = await service.ingest({
    fileName: "public.md",
    text: "全員が読める一般資料です。",
    skipMemory: true
  })
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

  assert.deepEqual((await service.listDocuments(outsider)).map((doc) => doc.documentId), [publicDoc.documentId])
  assert.deepEqual((await service.listDocuments(owner)).map((doc) => doc.documentId).sort(), [groupDoc.documentId, publicDoc.documentId].sort())
  assert.deepEqual((await service.listDocuments(member)).map((doc) => doc.documentId).sort(), [groupDoc.documentId, publicDoc.documentId].sort())
})

test("service stores document group hierarchy outside S3 object keys", async () => {
  const { service, deps } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER"] }
  const parent = await service.createDocumentGroup(owner, {
    name: "社内規定",
    visibility: "shared",
    sharedGroups: ["HR"]
  })
  const child = await service.createDocumentGroup(owner, {
    name: "人事",
    parentGroupId: parent.groupId,
    visibility: "private"
  })
  const grandchild = await service.createDocumentGroup(owner, {
    name: "採用",
    parentGroupId: child.groupId,
    visibility: "private"
  })
  const anotherParent = await service.createDocumentGroup(owner, {
    name: "全社共有",
    visibility: "private"
  })

  assert.equal(child.parentGroupId, parent.groupId)
  assert.deepEqual(child.ancestorGroupIds, [parent.groupId])
  assert.deepEqual(grandchild.ancestorGroupIds, [parent.groupId, child.groupId])
  assert.equal((await deps.objectStore.listKeys("document-groups/")).length, 0)

  const moved = await service.updateDocumentGroupSharing(owner, child.groupId, {
    parentGroupId: anotherParent.groupId,
    visibility: "shared",
    sharedGroups: ["HR"]
  })
  assert.equal(moved?.parentGroupId, anotherParent.groupId)
  assert.deepEqual(moved?.ancestorGroupIds, [anotherParent.groupId])
  assert.deepEqual(moved?.sharedGroups, ["HR"])
  assert.deepEqual((await deps.documentGroupStore.get(grandchild.groupId))?.ancestorGroupIds, [anotherParent.groupId, child.groupId])
})

test("service enforces document group management and search scope boundaries", async () => {
  const { service } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER"] }
  const manager = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["CHAT_USER"] }
  const outsider = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["CHAT_USER"] }
  const admin = { userId: "admin-1", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

  assert.equal(await service.updateDocumentGroupSharing(owner, "missing-group", { visibility: "shared" }), undefined)
  await service.assertDocumentGroupsWritable(owner, [])
  await service.assertSearchScopeReadable(owner, undefined)
  await assert.rejects(
    () => service.createDocumentGroup(owner, { name: "missing child", parentGroupId: "missing-parent" }),
    /Parent document group not found/
  )

  const parent = await service.createDocumentGroup(owner, {
    name: "Parent",
    visibility: "private",
    managerUserIds: [manager.userId],
    sharedUserIds: [manager.userId]
  })
  const child = await service.createDocumentGroup(manager, {
    name: "Child",
    parentGroupId: parent.groupId,
    description: "  shared child  ",
    sharedUserIds: [owner.userId, owner.userId],
    sharedGroups: ["HR", "HR"],
    managerUserIds: [manager.userId, manager.userId]
  })
  const privateParent = await service.createDocumentGroup(owner, {
    name: "Private parent"
  })

  assert.equal(child.description, "shared child")
  assert.deepEqual(child.sharedUserIds, [owner.userId])
  assert.deepEqual(child.sharedGroups, ["HR"])
  assert.deepEqual(child.managerUserIds, [manager.userId])
  await assert.rejects(
    () => service.createDocumentGroup(outsider, { name: "Forbidden child", parentGroupId: parent.groupId }),
    /Forbidden: cannot create a child group/
  )
  await assert.rejects(
    () => service.updateDocumentGroupSharing(owner, parent.groupId, { parentGroupId: parent.groupId }),
    /cannot be its own parent/
  )
  await assert.rejects(
    () => service.updateDocumentGroupSharing(owner, parent.groupId, { parentGroupId: child.groupId }),
    /cannot move under its descendant/
  )
  await assert.rejects(
    () => service.updateDocumentGroupSharing(owner, parent.groupId, { parentGroupId: "missing-parent" }),
    /Parent document group not found/
  )
  await assert.rejects(
    () => service.updateDocumentGroupSharing(outsider, parent.groupId, { visibility: "shared" }),
    /only group managers/
  )
  await assert.rejects(
    () => service.updateDocumentGroupSharing(manager, child.groupId, { parentGroupId: privateParent.groupId }),
    /cannot move group under this parent/
  )
  await assert.rejects(() => service.assertDocumentGroupsWritable(outsider, [parent.groupId]), /cannot write document group/)
  await service.assertDocumentGroupsWritable(admin, [parent.groupId])
  await assert.rejects(() => service.assertSearchScopeReadable(outsider, { groupIds: [parent.groupId] }), /cannot read document group/)
  await service.assertSearchScopeReadable(manager, { groupIds: [parent.groupId] })
})

test("service enforces full document group permission for delete and reindex operations", async () => {
  const { service } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const sharedReader = { userId: "reader-1", email: "reader@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const outsider = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const group = await service.createDocumentGroup(owner, {
    name: "Restricted group",
    sharedUserIds: [sharedReader.userId]
  })
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
  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "# 申請手順\n申請期限は翌月5営業日です。\n\n# 例外\n例外承認者は部長です。",
    metadata: { tenantId: "tenant-a" }
  })

  assert.ok(manifest.chunks?.some((chunk) => chunk.sectionPath?.includes("申請手順")))
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const reindexed = await service.reindexDocument(actor, manifest.documentId)
  assert.notEqual(reindexed.documentId, manifest.documentId)
  assert.equal(reindexed.metadata?.stagedFromDocumentId, manifest.documentId)
  assert.equal(reindexed.lifecycleStatus, "active")
  assert.equal(reindexed.embeddingModelId, manifest.embeddingModelId)
  assert.ok(reindexed.memoryCardCount >= manifest.memoryCardCount)

  const migrations = await service.listReindexMigrations()
  assert.equal(migrations[0]?.status, "cutover")
  assert.equal((await service.listDocuments()).some((doc) => doc.documentId === manifest.documentId), false)
})

test("service stages and rolls back structured blue-green reindex migrations", async () => {
  const { service, dataDir } = await createService()
  const textractJson = JSON.stringify({
    Blocks: [
      { Id: "table-1", BlockType: "TABLE", Page: 1, Confidence: 92, Relationships: [{ Type: "CHILD", Ids: ["cell-1", "cell-2"] }] },
      { Id: "cell-1", BlockType: "CELL", RowIndex: 1, ColumnIndex: 1, Confidence: 90, Relationships: [{ Type: "CHILD", Ids: ["word-1"] }] },
      { Id: "cell-2", BlockType: "CELL", RowIndex: 1, ColumnIndex: 2, Confidence: 88, Relationships: [{ Type: "CHILD", Ids: ["word-2"] }] },
      { Id: "word-1", BlockType: "WORD", Text: "項目" },
      { Id: "word-2", BlockType: "WORD", Text: "期限" }
    ]
  })
  const manifest = await service.ingest({ fileName: "policy.textract.json", textractJson, skipMemory: true })

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

  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
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
  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "申請期限は翌月5営業日です。",
    skipMemory: true
  })
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  stagedDocumentId = staged.stagedDocumentId

  failActivePut = true
  await assert.rejects(() => service.cutoverReindexMigration(actor, staged.migrationId), /simulated partial active put failure/)

  assert.deepEqual((await service.listDocuments()).map((doc) => doc.documentId), [manifest.documentId])
  const stagedManifest = JSON.parse(await readFile(path.join(dataDir, `objects/manifests/${staged.stagedDocumentId}.json`), "utf-8")) as { lifecycleStatus?: string }
  assert.equal(stagedManifest.lifecycleStatus, "staging")
  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as {
    records: Array<{ key: string; metadata?: { lifecycleStatus?: string } }>
  }
  assert.equal(
    evidenceDb.records.find((record) => record.key.startsWith(staged.stagedDocumentId))?.metadata?.lifecycleStatus,
    "staging"
  )
})

test("service manages reviewed alias artifacts and audit log", async () => {
  const { service, dataDir } = await createService()
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }

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
  const requester = { userId: "user-1", email: "requester@example.com", cognitoGroups: ["CHAT_USER"] }
  const manager = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
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
  const user = { userId: "user-1", email: "requester@example.com", cognitoGroups: ["CHAT_USER"] }

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
  assert.equal((await service.listQuestions())[0]?.questionId, question.questionId)
  assert.equal((await service.getQuestion(question.questionId))?.questionId, question.questionId)

  const answered = await service.answerQuestion(question.questionId, {
    answerTitle: "回答",
    answerBody: "担当者の確認結果です。",
    references: "社内確認"
  }, { userId: "answerer-1", email: "answerer@example.com", cognitoGroups: ["ANSWER_EDITOR"] })
  assert.equal(answered.status, "answered")
  assert.equal(answered.answerBody, "担当者の確認結果です。")
  assert.equal(answered.responderName, "answerer@example.com")

  const resolved = await service.resolveQuestion(question.questionId)
  assert.equal(resolved.status, "resolved")
})

test("service preserves asynchronous chat run options and can mark worker failures", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"] }

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
  const stored = await deps.chatRunStore.get(started.runId)
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
    question: "timeout",
    modelId: "model-a",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  const failed = await service.markChatRunFailed("run-worker-timeout", "States.Timeout: worker timed out")
  assert.equal(failed.status, "failed")
  assert.equal(failed.error, "States.Timeout: worker timed out")
  const errorEvents = await deps.chatRunEventStore.listAfter("run-worker-timeout", 0)
  assert.equal(errorEvents.at(-1)?.type, "error")
  assert.equal(errorEvents.at(-1)?.message, "States.Timeout: worker timed out")
})

test("service preserves async agent ownership, cancel, and artifact metadata boundaries", async () => {
  const { service } = await createService()
  const owner = { userId: "agent-owner", email: "owner@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
  const outsider = { userId: "agent-outsider", email: "outsider@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
  const admin = { userId: "agent-admin", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

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
  assert.equal((await service.executeAsyncAgentRun(run.agentRunId)).status, "cancelled")
  await assert.rejects(() => service.executeAsyncAgentRun("missing-agent-run"), /Async agent run not found/)

  const unavailable = await service.createAsyncAgentRun(owner, {
    provider: "future_provider" as AgentRuntimeProvider,
    modelId: "future-placeholder",
    instruction: "未登録 provider は実行しない"
  })
  assert.equal(unavailable.providerAvailability, "provider_unavailable")
  assert.equal(unavailable.failureReasonCode, "provider_unavailable")
  assert.equal((await service.executeAsyncAgentRun(unavailable.agentRunId)).status, "blocked")
})

test("service rejects async agent selections that are not readable", async () => {
  const { service } = await createService()
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["CHAT_USER"] }
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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
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

  const completed = await service.executeAsyncAgentRun(run.agentRunId)

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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "timeout を確認する"
  })

  const expired = await service.executeAsyncAgentRun(run.agentRunId)

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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "例外を確認する"
  })

  const failed = await service.executeAsyncAgentRun(run.agentRunId)

  assert.equal(failed.status, "failed")
  assert.equal(failed.failureReasonCode, "execution_error")
  assert.doesNotMatch(failed.failureReason ?? "", /raw-secret/)
  assert.match(failed.failureReason ?? "", /ANTHROPIC_API_KEY=\[REDACTED\]/)
})

test("service keeps Claude Code provider not configured without mock artifacts", async () => {
  const provider = fakeAsyncAgentProvider({ availability: "not_configured" })
  const { service } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([provider]) })
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }

  const run = await service.createAsyncAgentRun(user, {
    provider: "claude_code",
    modelId: "claude-code-default",
    instruction: "未設定状態を確認する"
  })

  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "not_configured")
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(run.artifactIds, [])
  assert.equal((await service.executeAsyncAgentRun(run.agentRunId)).status, "blocked")
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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
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
  const completed = await service.executeAsyncAgentRun(run.agentRunId)

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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }

  const { service: failureService, deps: failureDeps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([failureProvider]) })
  const failedRun = await failureService.createAsyncAgentRun(user, {
    provider: "codex",
    modelId: "codex-cli",
    instruction: "失敗時の sanitize を確認する"
  })
  const failed = await failureService.executeAsyncAgentRun(failedRun.agentRunId)

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
  const expired = await timeoutService.executeAsyncAgentRun(timeoutRun.agentRunId)

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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }

  const run = await service.createAsyncAgentRun(user, {
    provider: "codex",
    modelId: "codex-cli",
    instruction: "未設定状態を確認する"
  })

  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "not_configured")
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(run.artifactIds, [])
  assert.equal((await service.executeAsyncAgentRun(run.agentRunId)).status, "blocked")
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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }
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
  const completed = await service.executeAsyncAgentRun(run.agentRunId)

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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }

  const { service: failureService, deps: failureDeps } = await createService({ asyncAgentProviders: new AsyncAgentProviderRegistry([failureProvider]) })
  const failedRun = await failureService.createAsyncAgentRun(user, {
    provider: "opencode",
    modelId: "opencode-cli",
    instruction: "失敗時の sanitize を確認する"
  })
  const failed = await failureService.executeAsyncAgentRun(failedRun.agentRunId)

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
  const expired = await timeoutService.executeAsyncAgentRun(timeoutRun.agentRunId)

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
  const user = { userId: "agent-user", email: "agent@example.com", cognitoGroups: ["ASYNC_AGENT_USER"] }

  const run = await service.createAsyncAgentRun(user, {
    provider: "opencode",
    modelId: "opencode-cli",
    instruction: "未設定状態を確認する"
  })

  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "not_configured")
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(run.artifactIds, [])
  assert.equal((await service.executeAsyncAgentRun(run.agentRunId)).status, "blocked")
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

  const completed = await service.executeChatRun("run-debug-reference")
  assert.equal(completed.status, "succeeded")
  assert.equal((completed as unknown as Record<string, unknown>).debug, undefined)
  assert.ok(completed.debugRunId)

  const events = await deps.chatRunEventStore.listAfter("run-debug-reference", 0)
  const final = events.find((event) => event.type === "final")
  assert.ok(final)
  assert.equal(typeof (final.data as Record<string, unknown>).debugRunId, "string")
  assert.equal((final.data as Record<string, unknown>).debug, undefined)
  assert.ok(await service.getDebugRun(completed.debugRunId ?? ""))
})

test("service executes asynchronous document ingest runs from uploaded object", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"] }
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

  const events = await deps.documentIngestRunEventStore.listAfter(started.runId, 0)
  assert.deepEqual(events.map((event) => event.type), ["status", "status", "status", "status", "final"])
  assert.equal(completed.stage, "done")
  assert.equal(completed.counters?.chunkCount, 1)
  assert.equal(events.at(-1)?.stage, "done")
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
  const actor = { userId: "admin-sub", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

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
  const actor = { userId: "admin-sub", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

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
  assert.equal(result.debug?.status, "warning")
  const errorStep = result.debug?.steps.find((step) => step.status === "error")
  assert.ok(errorStep)
  assert.match(errorStep?.detail ?? "", /Bedrock embed timeout|Vector query failed/)
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
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }
  const run = await service.createBenchmarkRun(user, {})
  await deps.benchmarkRunStore.update(run.runId, {
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogUrl: "https://console.aws.amazon.com/codesuite/codebuild/projects/memo/build/build-id/log"
  })

  assert.equal(await service.createBenchmarkArtifactDownloadUrl("missing-run", "logs"), undefined)
  const download = await service.createBenchmarkArtifactDownloadUrl(run.runId, "logs")
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
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }
  const run = await service.createBenchmarkRun(user, {})
  await deps.benchmarkRunStore.update(run.runId, {
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogGroupName: "/aws/codebuild/memo",
    codeBuildLogStreamName: "build-stream"
  })

  assert.equal(await service.getBenchmarkCodeBuildLogText("missing-run"), undefined)
  const download = await service.getBenchmarkCodeBuildLogText(run.runId)
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
  assert.deepEqual(formatted.citations, trace.citations)
  assert.deepEqual(formatted.retrieved, trace.retrieved)
  assert.deepEqual(formatted.steps, trace.steps)
  assert.equal(formatted.targetType, "rag_run")
  assert.equal(formatted.visibility, "operator_sanitized")
  assert.equal(formatted.sanitizePolicyVersion, "debug-trace-sanitize-v1")
  assert.deepEqual(formatted.exportRedaction?.redactedFields, ["rawPrompt", "credentials", "internalReasoning", "unauthorizedDocuments", "internalPolicyDetails"])
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

  assert.deepEqual(JSON.parse(formatDebugTraceJson(trace)), {
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
    ],
    targetType: "rag_run",
    visibility: "operator_sanitized",
    sanitizePolicyVersion: "debug-trace-sanitize-v1",
    exportRedaction: {
      policyVersion: "debug-trace-sanitize-v1",
      visibility: "operator_sanitized",
      redactedFields: ["rawPrompt", "credentials", "internalReasoning", "unauthorizedDocuments", "internalPolicyDetails"],
      notes: [
        "legacy trace normalized with J2 debug redaction metadata",
        "debug API remains protected by chat:admin:read_all until debug:* migration is completed"
      ]
    }
  })
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
  const admin = { userId: "admin-1", cognitoGroups: ["SYSTEM_ADMIN"] }
  const chatUser = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"] }

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
  assert.equal(usage.find((item) => item.userId === managed.userId)?.chatMessages, 0)
  const cost = await service.getCostAuditSummary(admin)
  assert.equal(cost.currency, "USD")
  assert.ok(cost.items.some((item) => item.category === "document chunks"))

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

  await assert.rejects(() => service.executeChatRun("missing-run"), /Chat run not found/)
  await assert.rejects(() => service.markChatRunFailed("missing-run", "timeout"), /Chat run not found/)
  await deps.chatRunStore.create({
    runId: "run-terminal",
    status: "succeeded",
    createdBy: chatUser.userId,
    question: "done",
    modelId: "model-a",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  assert.equal((await service.markChatRunFailed("run-terminal", "ignored")).status, "succeeded")

  await assert.rejects(() => service.executeDocumentIngestRun("missing-ingest"), /Document ingest run not found/)
  await assert.rejects(() => service.markDocumentIngestRunFailed("missing-ingest", "timeout"), /Document ingest run not found/)
	  await deps.documentIngestRunStore.create({
	    runId: "ingest-terminal",
	    status: "cancelled",
	    createdBy: chatUser.userId,
	    uploadId: "upload-terminal",
	    objectKey: "uploads/cancelled.txt",
	    purpose: "document",
	    fileName: "cancelled.txt",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  assert.equal((await service.markDocumentIngestRunFailed("ingest-terminal", "ignored")).status, "cancelled")
  await deps.objectStore.putBytes("uploads/empty.txt", Buffer.from(""))
	  await deps.documentIngestRunStore.create({
	    runId: "ingest-empty",
	    status: "queued",
	    createdBy: chatUser.userId,
	    userEmail: chatUser.email,
	    userGroups: chatUser.cognitoGroups,
	    uploadId: "upload-empty",
	    objectKey: "uploads/empty.txt",
	    purpose: "document",
    fileName: "empty.txt",
    mimeType: "text/plain",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  const failedIngest = await service.executeDocumentIngestRun("ingest-empty")
  assert.equal(failedIngest.status, "failed")
  assert.match(failedIngest.error ?? "", /Uploaded object is empty/)

  await assert.rejects(() => service.createBenchmarkRun(chatUser, { suiteId: "missing-suite" }), /Unknown benchmark suite/)
  await assert.rejects(() => service.createBenchmarkRun(chatUser, { suiteId: "search-smoke-v1", mode: "agent" }), /does not support mode/)
	  await assert.rejects(() => service.createBenchmarkRun(chatUser, { runner: "local" as BenchmarkRunner }), /Only codebuild runner/)
  const searchRun = await service.createBenchmarkRun(chatUser, { suiteId: "search-smoke-v1", mode: "search", topK: 999 })
  assert.equal(searchRun.mode, "search")
  assert.equal(searchRun.topK, ragRuntimePolicy.retrieval.searchRagMaxTopK)
  assert.equal(await service.cancelBenchmarkRun("missing-benchmark-run"), undefined)
  assert.equal((await service.cancelBenchmarkRun(searchRun.runId))?.status, "cancelled")
  assert.equal(await service.createBenchmarkArtifactDownloadUrl(searchRun.runId, "logs"), undefined)
  await assert.rejects(() => service.createBenchmarkArtifactDownloadUrl(searchRun.runId, "summary"), /BENCHMARK_BUCKET_NAME/)
  assert.equal(await service.getBenchmarkCodeBuildLogText(searchRun.runId), undefined)
})

async function createService(options: {
  textModel?: MockBedrockTextModel
  evidenceQueryError?: Error
  evidencePutErrorAfterWriteWhen?: (records: Parameters<LocalVectorStore["put"]>[0]) => boolean
  objectGetErrorPrefix?: string
  objectGetError?: Error
  objectListExtraKeys?: string[]
  userDirectory?: UserDirectory
  codeBuildLogReader?: CodeBuildLogReader
  asyncAgentProviders?: AsyncAgentProviderRegistry
} = {}): Promise<{ service: MemoRagService; dataDir: string; deps: Dependencies }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-service-test-"))
  const baseObjectStore = new LocalObjectStore(dataDir)
  const baseEvidenceStore = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const deps = {
    objectStore: {
      putText: (...args: Parameters<LocalObjectStore["putText"]>) => baseObjectStore.putText(...args),
      putBytes: (...args: Parameters<LocalObjectStore["putBytes"]>) => baseObjectStore.putBytes(...args),
      getText: async (key: string) => {
        if (options.objectGetError && options.objectGetErrorPrefix && key.startsWith(options.objectGetErrorPrefix)) {
          throw options.objectGetError
        }
        return baseObjectStore.getText(key)
      },
      getBytes: (...args: Parameters<LocalObjectStore["getBytes"]>) => baseObjectStore.getBytes(...args),
      deleteObject: (...args: Parameters<LocalObjectStore["deleteObject"]>) => baseObjectStore.deleteObject(...args),
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
      delete: (...args: Parameters<LocalVectorStore["delete"]>) => baseEvidenceStore.delete(...args)
    },
    textModel: options.textModel ?? new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir),
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir),
    chatRunStore: new LocalChatRunStore(dataDir),
    chatRunEventStore: new LocalChatRunEventStore(dataDir),
    documentIngestRunStore: new LocalDocumentIngestRunStore(dataDir),
    documentIngestRunEventStore: new LocalDocumentIngestRunEventStore(dataDir),
    documentGroupStore: new LocalDocumentGroupStore(dataDir),
    codeBuildLogReader: options.codeBuildLogReader ?? { getText: async () => undefined },
    asyncAgentProviders: options.asyncAgentProviders ?? defaultTestAsyncAgentProviders(),
    userDirectory: options.userDirectory
  } as unknown as Dependencies
  return { service: new MemoRagService(deps), dataDir, deps }
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
    const run = await deps.documentIngestRunStore.get(runId)
    if (run?.status === "succeeded" || run?.status === "failed" || run?.status === "cancelled") return run
    await delay(20)
  }
  throw new Error(`Timed out waiting for document ingest run: ${runId}`)
}
