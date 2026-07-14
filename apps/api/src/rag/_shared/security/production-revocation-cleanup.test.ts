import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalBenchmarkRunStore } from "../../../adapters/local-benchmark-run-store.js"
import { LocalChatRunStore } from "../../../adapters/local-chat-run-store.js"
import { LocalDocumentGroupStore } from "../../../adapters/local-document-group-store.js"
import { LocalDocumentIngestRunStore } from "../../../adapters/local-document-ingest-run-store.js"
import { LocalFolderPolicyStore } from "../../../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../../../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../../../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../../../adapters/local-user-group-store.js"
import type { VectorStore } from "../../../adapters/vector-store.js"
import type { Dependencies } from "../../../dependencies.js"
import type { DocumentGroup, DocumentManifest, DocumentShareGrant, GroupMembership, UserGroup, VectorRecord } from "../../../types.js"
import { tenantPartitionId } from "../../../security/tenant-partition.js"
import { securityResourceReference } from "../../../security/security-resource-reference.js"
import { documentShareGrantKey, documentSharePolicyStateVersion } from "../../../documents/document-permission-service.js"
import { tenantArtifactRoot, tenantManifestKey, tenantVectorKey } from "../storage/tenant-artifacts.js"
import {
  ProductionRevocationCleanupService
} from "./production-revocation-cleanup.js"
import {
  ObjectStoreRevocationCleanupCoordinator
} from "./revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "./revocation-cleanup-repair-outbox.js"

test("FR-066 worker regenerates a missing cleanup manifest from a pre-CAS durable repair", async () => {
  const fixture = await createFixture()
  const repairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore)
  const registration = {
    operationId: "folder-share:repair-a",
    tenantId: "tenant-a",
    resourceType: "folder" as const,
    resourceId: "folder-a",
    trigger: "share_revoked" as const,
    authoritativeDenyVersion: "folder-policy-v2",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "grant" as const, reference: "folder:folder-a:principal:user:user-a:ceiling:none" }]
  }
  await repairOutbox.prepare({ expectedBeforeDenyVersion: "folder-policy-v1", cleanupRegistration: registration, preparedAt: registration.authoritativeDenyConfirmedAt })
  assert.equal(await new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore).get("tenant-a", registration.operationId), undefined)

  const result = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true }).reconcilePending("tenant-a")
  assert.equal(result.completed, 1)
  assert.equal((await new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore).get("tenant-a", registration.operationId))?.status, "completed")
  assert.equal((await repairOutbox.get("tenant-a", "folder", "folder-a", registration.operationId))?.status, "cleanup_completed")
})

test("FR-066 worker retains a prepared repair when it races the deny CAS and converges after commit", async () => {
  const fixture = await createFixture()
  const repairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore)
  const registration = {
    operationId: "folder-share:repair-race",
    tenantId: "tenant-a",
    resourceType: "folder" as const,
    resourceId: "folder-race",
    trigger: "share_revoked" as const,
    authoritativeDenyVersion: "folder-policy-v2",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "grant" as const, reference: "folder:folder-race:principal:user:user-a:ceiling:none" }]
  }
  await repairOutbox.prepare({
    expectedBeforeDenyVersion: "folder-policy-v1",
    cleanupRegistration: registration,
    preparedAt: registration.authoritativeDenyConfirmedAt
  })

  await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => false })
    .reconcilePending("tenant-a")
  assert.equal((await repairOutbox.get("tenant-a", "folder", "folder-race", registration.operationId))?.status, "prepared")
  assert.equal(await new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore).get("tenant-a", registration.operationId), undefined)

  const converged = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
    .reconcilePending("tenant-a")
  assert.equal(converged.completed, 1)
  assert.equal((await repairOutbox.get("tenant-a", "folder", "folder-race", registration.operationId))?.status, "cleanup_completed")
})

test("FR-066 account evaluation artifacts carry exact resource identity and are enumerated for deletion", async () => {
  const fixture = await createFixture()
  const securityRef = securityResourceReference("tenant-a", "account", "user-eval")
  await fixture.chatRuns.create({
    runId: "chat-eval",
    status: "succeeded",
    createdBy: "user-eval",
    tenantId: "tenant-a",
    securityResourceRefs: [securityRef],
    question: "done",
    modelId: "model",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:01:00.000Z"
  })
  const debugKey = `debug-runs/${tenantPartitionId("tenant-a")}/2026-07-11/chat-eval.json`
  await fixture.objectStore.putText(debugKey, JSON.stringify({
    runId: "chat-eval",
    tenantPartitionId: tenantPartitionId("tenant-a"),
    securityResourceRefs: [securityRef],
    retrieved: [], finalEvidence: [], citations: []
  }))
  const qualityPartition = encodeURIComponent(tenantPartitionId("tenant-a")).replace(/%/g, "_")
  const qualityKey = `quality-control/source-samples/${qualityPartition}/account-eval.json`
  await fixture.objectStore.putText(qualityKey, JSON.stringify({
    sourceType: "debug_trace",
    artifactId: "chat-eval",
    tenantPartitionId: tenantPartitionId("tenant-a"),
    securityResourceRefs: [securityRef]
  }))
  await new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore).register({
    operationId: "account-evaluation-cleanup",
    tenantId: "tenant-a",
    resourceType: "account",
    resourceId: "user-eval",
    trigger: "account_revoked",
    authoritativeDenyVersion: "deny-v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:02:00.000Z",
    knownTargets: [{ scope: "evaluation_artifact", reference: "principal:user-eval" }]
  })

  const result = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true }).reconcilePending("tenant-a")
  assert.equal(result.completed, 1)
  await assert.rejects(() => fixture.objectStore.getText(debugKey), /ENOENT/)
  await assert.rejects(() => fixture.objectStore.getText(qualityKey), /ENOENT/)
})

test("FR-066 group and folder evaluation artifacts are deleted only by their exact retained identity", async () => {
  for (const item of [
    { resourceType: "group" as const, resourceId: "group-eval", kind: "resource_group" as const, trigger: "archived" as const },
    { resourceType: "folder" as const, resourceId: "folder-eval", kind: "folder" as const, trigger: "archived" as const }
  ]) {
    const fixture = await createFixture()
    const securityRef = securityResourceReference("tenant-a", item.kind, item.resourceId)
    const runId = `${item.resourceType}-evaluation-run`
    await fixture.chatRuns.create({
      runId,
      status: "succeeded",
      createdBy: "evaluation-user",
      tenantId: "tenant-a",
      securityResourceRefs: [securityRef],
      question: "done",
      modelId: "model",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:01:00.000Z"
    })
    const debugKey = `debug-runs/${tenantPartitionId("tenant-a")}/2026-07-11/${runId}.json`
    await fixture.objectStore.putText(debugKey, JSON.stringify({
      runId,
      tenantPartitionId: tenantPartitionId("tenant-a"),
      securityResourceRefs: [securityRef],
      retrieved: [], finalEvidence: [], citations: []
    }))
    const qualityPartition = encodeURIComponent(tenantPartitionId("tenant-a")).replace(/%/g, "_")
    const qualityKey = `quality-control/source-samples/${qualityPartition}/${runId}.json`
    await fixture.objectStore.putText(qualityKey, JSON.stringify({
      sourceType: "debug_trace",
      artifactId: runId,
      tenantPartitionId: tenantPartitionId("tenant-a"),
      securityResourceRefs: [securityRef]
    }))
    await new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore).register({
      operationId: `${item.resourceType}-evaluation-cleanup`,
      tenantId: "tenant-a",
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      trigger: item.trigger,
      authoritativeDenyVersion: "deny-v1",
      authoritativeDenyConfirmedAt: "2026-07-11T00:02:00.000Z",
      knownTargets: [{ scope: "evaluation_artifact", reference: `${item.resourceType}:${item.resourceId}` }]
    })

    const result = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true }).reconcilePending("tenant-a")
    assert.equal(result.completed, 1)
    await assert.rejects(() => fixture.objectStore.getText(debugKey), /ENOENT/)
    await assert.rejects(() => fixture.objectStore.getText(qualityKey), /ENOENT/)
  }
})

test("FR-066 production reconciliation discovers and removes every physical scope without crossing tenants", async () => {
  const fixture = await createFixture()
  const active = documentManifest(fixture.deps, "tenant-a", "doc-a", "active")
  const old = documentManifest(fixture.deps, "tenant-a", "doc-old", "superseded", "source-a")
  await seedDocument(fixture, active)
  await seedDocument(fixture, old)
  const stageKey = `${tenantArtifactRoot("tenant-a")}/${active.publicationFence!.stageNamespace}/partial.json`
  await fixture.objectStore.putText(stageKey, "staged secret")
  const cacheKey = `embedding-cache/${hash24("tenant-a")}/model/cache.json`
  const otherCacheKey = `embedding-cache/${hash24("tenant-b")}/model/cache.json`
  await fixture.objectStore.putText(cacheKey, "tenant a cache")
  await fixture.objectStore.putText(otherCacheKey, "tenant b cache")
  const debugKey = `debug-runs/${tenantPartitionId("tenant-a")}/2026-07-11/trace-a.json`
  await fixture.objectStore.putText(debugKey, JSON.stringify({
    tenantPartitionId: tenantPartitionId("tenant-a"),
    retrieved: [{ documentId: active.documentId }],
    finalEvidence: [],
    citations: []
  }))
  const qualityPartition = encodeURIComponent(tenantPartitionId("tenant-a")).replace(/%/g, "_")
  const qualityKey = `quality-control/source-samples/${qualityPartition}/sample-a.json`
  await fixture.objectStore.putText(qualityKey, JSON.stringify({
    sourceType: "debug_trace",
    artifactId: "trace-a",
    tenantPartitionId: tenantPartitionId("tenant-a"),
    resourceIds: [active.documentId, active.publicationControl!.sourceId]
  }))
  await seedRuns(fixture)

  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  const registered = await coordinator.register({
    operationId: "source-governance:audit-a",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "source-a",
    trigger: "classification_restricted",
    deniedPurposes: ["normal_rag", "evaluation"],
    authoritativeDenyVersion: "deny-v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [
      { scope: "source", reference: active.sourceObjectKey },
      { scope: "chunk", reference: `${active.documentId}:${active.chunks![0]!.id}` },
      { scope: "memory", reference: active.memoryVectorKeys![0]! },
      { scope: "active_index", reference: `index-v1:${active.evidenceVectorKeys![0]!}` },
      { scope: "staged_index", reference: active.publicationFence!.stageNamespace },
      { scope: "old_index", reference: old.documentId },
      { scope: "cache", reference: `document:${active.documentId}` },
      { scope: "grant", reference: `source-governance:${active.publicationControl!.sourceId}` },
      { scope: "session", reference: "resource-group:group-a:user:user-a/session" },
      { scope: "queued_run", reference: "principal:user-a" },
      { scope: "evaluation_artifact", reference: debugKey },
      { scope: "evaluation_artifact", reference: "quality-control:debug_trace:trace-a" }
    ]
  })

  const service = new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
  assert.equal((await service.reconcilePending("tenant-a")).reconciliationRequired, 1)
  const result = await service.reconcilePending("tenant-a")
  assert.equal(result.examined, 1)
  assert.equal(result.completed, 1, JSON.stringify(await coordinator.get("tenant-a", registered.operationId)))
  assert.equal((await coordinator.get("tenant-a", registered.operationId))?.status, "completed")
  assert.deepEqual(await fixture.objectStore.listKeys(`${tenantArtifactRoot("tenant-a")}/`), [])
  assert.equal(await fixture.objectStore.getText(otherCacheKey), "tenant b cache")
  assert.deepEqual(await fixture.objectStore.listKeys(`embedding-cache/${hash24("tenant-a")}/`), [])
  await assert.rejects(() => fixture.objectStore.getText(debugKey), /ENOENT/)
  await assert.rejects(() => fixture.objectStore.getText(qualityKey), /ENOENT/)
  assert.deepEqual(fixture.evidence.keys(), [])
  assert.deepEqual(fixture.memory.keys(), [])
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-a"))?.status, "failed")
  assert.equal((await fixture.ingestRuns.get("tenant-a", "ingest-a"))?.status, "failed")
  assert.equal((await fixture.benchmarkRuns.get("tenant-a", "benchmark-a"))?.status, "failed")
})

test("FR-066 share revocation cleans derived principal state without deleting shared document content", async () => {
  const fixture = await createFixture()
  const document = documentManifest(fixture.deps, "tenant-a", "doc-shared", "active", "source-shared")
  await seedDocument(fixture, document)
  const unrelatedGrant = shareGrant("tenant-a", document.documentId, "reader-2")
  await fixture.objectStore.putText(documentShareGrantKey("tenant-a", document.documentId), JSON.stringify({
    schemaVersion: 1,
    grants: [unrelatedGrant]
  }))
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "share-revoke-reader-1",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: document.documentId,
    trigger: "share_revoked",
    deniedPurposes: ["normal_rag"],
    // Simulates an unrelated grant edit after reader-1 was revoked.
    authoritativeDenyVersion: documentSharePolicyStateVersion([]),
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [
      { scope: "grant", reference: `document:${document.documentId}:principal:user:reader-1:ceiling:none` },
      { scope: "cache", reference: `document:${document.documentId}:principal:user:reader-1` },
      { scope: "session", reference: `document:${document.documentId}:principal:user:reader-1/session` },
      { scope: "queued_run", reference: `document:${document.documentId}:principal:user:reader-1` }
    ]
  })

  const service = new ProductionRevocationCleanupService(fixture.deps)
  assert.equal((await service.reconcilePending("tenant-a")).reconciliationRequired, 1)
  const result = await service.reconcilePending("tenant-a")
  assert.equal(result.completed, 1)
  assert.equal(await fixture.objectStore.getText(document.sourceObjectKey), "source")
  assert.equal(JSON.parse(await fixture.objectStore.getText(document.manifestObjectKey)).documentId, document.documentId)
  assert.deepEqual(fixture.evidence.keys(), document.evidenceVectorKeys)
  assert.deepEqual(fixture.memory.keys(), document.memoryVectorKeys)
})

test("FR-066 purpose-only source restriction preserves normal-RAG source and index artifacts", async () => {
  const fixture = await createFixture()
  const document = documentManifest(fixture.deps, "tenant-a", "doc-purpose", "active", "source-purpose")
  await seedDocument(fixture, document)
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "source-governance:purpose-only",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "source-purpose",
    trigger: "usage_restricted",
    deniedPurposes: ["evaluation"],
    authoritativeDenyVersion: "purpose-deny-v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "evaluation_artifact", reference: "quality-control:source-governance:source-purpose" }]
  })

  const result = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
    .reconcilePending("tenant-a")
  assert.equal(result.completed, 1)
  assert.equal(await fixture.objectStore.getText(document.sourceObjectKey), "source")
  assert.equal(JSON.parse(await fixture.objectStore.getText(document.manifestObjectKey)).documentId, document.documentId)
  assert.deepEqual(fixture.evidence.keys(), document.evidenceVectorKeys)
  assert.deepEqual(fixture.memory.keys(), document.memoryVectorKeys)
})

test("FR-066 document permission downgrade keeps read-only chat and stops full-required ingest", async () => {
  const fixture = await createFixture()
  const document = documentManifest(fixture.deps, "tenant-a", "doc-downgrade", "active", "source-downgrade")
  await seedDocument(fixture, document)
  await fixture.objectStore.putText(documentShareGrantKey("tenant-a", document.documentId), JSON.stringify({
    schemaVersion: 1,
    grants: [{ ...shareGrant("tenant-a", document.documentId, "reader-1"), permissionLevel: "readOnly" }]
  }))
  const now = "2026-07-11T00:00:00.000Z"
  await fixture.chatRuns.create({
    runId: "chat-readonly", status: "queued", createdBy: "reader-1", tenantId: "tenant-a", userGroups: ["CHAT_USER"],
    question: "allowed", modelId: "model", searchScope: { mode: "documents", documentIds: [document.documentId] }, createdAt: now, updatedAt: now
  })
  await fixture.ingestRuns.create({
    runId: "ingest-full", status: "queued", createdBy: "reader-1", tenantId: "tenant-a", userGroups: ["CHAT_USER"],
    uploadId: "upload-full", objectKey: "upload-full", purpose: "document", fileName: "full.md", documentId: document.documentId,
    createdAt: now, updatedAt: now
  })
  await fixture.benchmarkRuns.create({
    runId: "benchmark-no-resource-identity", status: "queued", mode: "search", runner: "lambda", suiteId: "suite-a",
    datasetS3Key: "dataset-a", createdBy: "reader-1", tenantId: "tenant-a", createdAt: now, updatedAt: now
  })
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "document-downgrade",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: document.documentId,
    trigger: "share_revoked",
    authoritativeDenyVersion: "document-downgrade-v1",
    authoritativeDenyConfirmedAt: now,
    knownTargets: [
      { scope: "grant", reference: `document:${document.documentId}:principal:user:reader-1:ceiling:readOnly` },
      { scope: "queued_run", reference: `document:${document.documentId}:principal:user:reader-1` }
    ]
  })

  const service = new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
  await service.reconcilePending("tenant-a")
  await service.reconcilePending("tenant-a")
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-readonly"))?.status, "queued")
  assert.equal((await fixture.ingestRuns.get("tenant-a", "ingest-full"))?.status, "failed")
  assert.equal((await fixture.benchmarkRuns.get("tenant-a", "benchmark-no-resource-identity"))?.status, "queued")
})

test("FR-066 group-principal revoke stops only proven group members", async () => {
  const fixture = await createFixture()
  const document = documentManifest(fixture.deps, "tenant-a", "doc-group-revoke", "active", "source-group-revoke")
  await seedDocument(fixture, document)
  await fixture.objectStore.putText(documentShareGrantKey("tenant-a", document.documentId), JSON.stringify({
    schemaVersion: 1,
    grants: [shareGrant("tenant-a", document.documentId, "alternate-a")]
  }))
  await fixture.userGroups.create(userGroup("tenant-a", "team-a"))
  await fixture.groupMemberships.save(groupMembership("tenant-a", "team-a", "user", "member-a", "readOnly"))
  await fixture.groupMemberships.save(groupMembership("tenant-a", "team-a", "user", "alternate-a", "readOnly"))
  const now = "2026-07-11T00:00:00.000Z"
  for (const [runId, createdBy] of [
    ["chat-member", "member-a"],
    ["chat-alternate-grant", "alternate-a"],
    ["chat-unrelated", "unrelated-a"]
  ] as const) {
    await fixture.chatRuns.create({
      runId, status: "queued", createdBy, tenantId: "tenant-a", userGroups: ["CHAT_USER"], question: "scope",
      modelId: "model", searchScope: { mode: "documents", documentIds: [document.documentId] }, createdAt: now, updatedAt: now
    })
  }
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "document-group-revoke",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: document.documentId,
    trigger: "share_revoked",
    authoritativeDenyVersion: "document-group-revoke-v1",
    authoritativeDenyConfirmedAt: now,
    knownTargets: [
      { scope: "grant", reference: `document:${document.documentId}:principal:group:team-a:ceiling:none` },
      { scope: "queued_run", reference: `document:${document.documentId}:principal:group:team-a` }
    ]
  })

  const service = new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
  await service.reconcilePending("tenant-a")
  await service.reconcilePending("tenant-a")
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-member"))?.status, "failed")
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-alternate-grant"))?.status, "queued")
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-unrelated"))?.status, "queued")
})

test("FR-066 resource-group full-to-readOnly downgrade preserves chat and stops full-required ingest", async () => {
  const fixture = await createFixture()
  const now = "2026-07-11T00:00:00.000Z"
  await fixture.userGroups.create(userGroup("tenant-a", "team-downgrade"))
  await fixture.groupMemberships.save(groupMembership("tenant-a", "team-downgrade", "user", "member-a", "readOnly"))
  await fixture.documentGroups.create(documentGroup("tenant-a", "folder-a"))
  await fixture.folderPolicies.save({
    policyId: "policy-folder-a", itemType: "folderPolicy", tenantId: "tenant-a", folderId: "folder-a",
    entries: [{ principalType: "group", principalId: "team-downgrade", permissionLevel: "full" }],
    createdBy: "owner-a", createdAt: now, updatedAt: now
  })
  await fixture.chatRuns.create({
    runId: "chat-group-readonly", status: "queued", createdBy: "member-a", tenantId: "tenant-a", userGroups: ["CHAT_USER"],
    question: "allowed", modelId: "model", searchScope: { mode: "groups", groupIds: ["folder-a"] }, createdAt: now, updatedAt: now
  })
  await fixture.ingestRuns.create({
    runId: "ingest-group-full", status: "queued", createdBy: "member-a", tenantId: "tenant-a", userGroups: ["CHAT_USER"],
    uploadId: "upload-group", objectKey: "upload-group", purpose: "document", fileName: "group.md", metadata: { groupIds: ["folder-a"] },
    createdAt: now, updatedAt: now
  })
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "resource-group-downgrade",
    tenantId: "tenant-a",
    resourceType: "resource_group",
    resourceId: "team-downgrade",
    trigger: "group_revoked",
    authoritativeDenyVersion: "resource-group-downgrade-v1",
    authoritativeDenyConfirmedAt: now,
    knownTargets: [
      { scope: "grant", reference: "resource-group/team-downgrade/principal/user/member-a/grant/ceiling/readOnly" },
      { scope: "queued_run", reference: "resource-group/team-downgrade/principal/user/member-a/queued-run" }
    ]
  })

  const service = new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
  await service.reconcilePending("tenant-a")
  await service.reconcilePending("tenant-a")
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-group-readonly"))?.status, "queued")
  assert.equal((await fixture.ingestRuns.get("tenant-a", "ingest-group-full"))?.status, "failed")
})

test("FR-066 queued-run discovery uses the complete tenant enumeration rather than a truncated API page", async () => {
  const fixture = await createFixture()
  const now = "2026-07-11T00:00:00.000Z"
  for (const runId of ["chat-page-1", "chat-page-2"]) {
    await fixture.chatRuns.create({
      runId,
      status: "queued",
      createdBy: "user-a",
      tenantId: "tenant-a",
      question: "secret",
      modelId: "model",
      createdAt: now,
      updatedAt: now
    })
  }
  fixture.chatRuns.list = async () => [(await fixture.chatRuns.get("tenant-a", "chat-page-1"))!]
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "all-run-pages",
    tenantId: "tenant-a",
    resourceType: "account",
    resourceId: "user-a",
    trigger: "account_revoked",
    authoritativeDenyVersion: "account-revocation:1:audit-a",
    authoritativeDenyConfirmedAt: now,
    knownTargets: [{ scope: "queued_run", reference: "principal:user-a" }]
  })

  const service = new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
  assert.equal((await service.reconcilePending("tenant-a")).reconciliationRequired, 1)
  const result = await service.reconcilePending("tenant-a")
  assert.equal(result.completed, 1)
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-page-1"))?.status, "failed")
  assert.equal((await fixture.chatRuns.get("tenant-a", "chat-page-2"))?.status, "failed")
})

test("FR-066 temporary scope mismatch invalidates only stale scope state and preserves the attachment", async () => {
  const fixture = await createFixture()
  const base = documentManifest(fixture.deps, "tenant-a", "temp-a", "active", "temp-source-a")
  const attachment: DocumentManifest = {
    ...base,
    metadata: {
      ...base.metadata,
      scopeType: "chat",
      temporaryScopeId: "scope-current",
      expiresAt: "2026-07-12T00:00:00.000Z"
    }
  }
  await seedDocument(fixture, attachment)
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: `temporary:temporary_scope_mismatch:${attachment.documentId}:scope-stale`,
    tenantId: "tenant-a",
    resourceType: "temporary_attachment",
    resourceId: attachment.documentId,
    trigger: "temporary_scope_mismatch",
    authoritativeDenyVersion: `temporary_scope_mismatch:${attachment.createdAt}`,
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [
      { scope: "cache", reference: `temporary:${attachment.documentId}:scope:scope-stale` },
      { scope: "queued_run", reference: "temporary-scope:scope-stale" }
    ]
  })

  const service = new ProductionRevocationCleanupService(fixture.deps)
  assert.equal((await service.reconcilePending("tenant-a")).reconciliationRequired, 1)
  const result = await service.reconcilePending("tenant-a")
  assert.equal(result.completed, 1)
  assert.equal(await fixture.objectStore.getText(attachment.sourceObjectKey), "source")
  assert.deepEqual(fixture.evidence.keys(), attachment.evidenceVectorKeys)
  assert.deepEqual(fixture.memory.keys(), attachment.memoryVectorKeys)
})

test("FR-066 production reconciliation rejects prefix escape and retains the authoritative deny for retry", async () => {
  const fixture = await createFixture()
  const secretKey = `${tenantArtifactRoot("tenant-b")}/documents/secret.txt`
  await fixture.objectStore.putText(secretKey, "other tenant secret")
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  const registered = await coordinator.register({
    operationId: "escape-attempt",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-a",
    trigger: "deleted",
    authoritativeDenyVersion: "uncommitted:v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "source", reference: secretKey }]
  })

  const result = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
    .reconcilePending("tenant-a")
  assert.equal(result.reconciliationRequired, 1)
  const pending = await coordinator.get("tenant-a", registered.operationId)
  assert.equal(pending?.status, "reconciliation_required")
  assert.match(pending?.lastFailureCode ?? "", /source:cleanup:RevocationCleanupValidationError/)
  assert.equal(await fixture.objectStore.getText(secretKey), "other tenant secret")
})

test("FR-066 encoded vector cleanup rejects another tenant partition", async () => {
  const fixture = await createFixture()
  const otherTenantVector = tenantVectorKey(fixture.deps, "tenant-b", "memory-secret")
  await fixture.memory.put([vectorRecord(otherTenantVector, "doc-secret", "memory")])
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "vector-escape-attempt",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-a",
    trigger: "deleted",
    authoritativeDenyVersion: "uncommitted:v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "memory", reference: `memory-vector:${encodeURIComponent(otherTenantVector)}` }]
  })

  const result = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => true })
    .reconcilePending("tenant-a")
  assert.equal(result.reconciliationRequired, 1)
  assert.deepEqual(fixture.memory.keys(), [otherTenantVector])
  assert.match((await coordinator.get("tenant-a", "vector-escape-attempt"))?.lastFailureCode ?? "", /memory:cleanup:RevocationCleanupValidationError/)
})

test("FR-066 unknown authoritative state fails closed while a confirmed superseding state performs no cleanup", async () => {
  const fixture = await createFixture()
  const sourceKey = `${tenantArtifactRoot("tenant-a")}/documents/doc-a/source.txt`
  await fixture.objectStore.putText(sourceKey, "protected")
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "unknown-deny",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-a",
    trigger: "deleted",
    authoritativeDenyVersion: "deny-v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "source", reference: sourceKey }]
  })
  await new ProductionRevocationCleanupService(fixture.deps, {
    isCurrent: async () => { throw new Error("simulated authoritative read failure") }
  }).reconcilePending("tenant-a")
  assert.equal((await coordinator.get("tenant-a", "unknown-deny"))?.status, "reconciliation_required")
  assert.equal(await fixture.objectStore.getText(sourceKey), "protected")

  const superseded = await new ProductionRevocationCleanupService(fixture.deps, { isCurrent: async () => false })
    .reconcilePending("tenant-a")
  assert.equal(superseded.superseded, 1)
  assert.equal((await coordinator.get("tenant-a", "unknown-deny"))?.status, "superseded")
  assert.equal(await fixture.objectStore.getText(sourceKey), "protected")
})

test("FR-066 pending enumeration is tenant-scoped and malformed listed state fails closed", async () => {
  const fixture = await createFixture()
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
  await coordinator.register({
    operationId: "tenant-a-op",
    tenantId: "tenant-a",
    resourceType: "account",
    resourceId: "user-a",
    trigger: "account_revoked",
    authoritativeDenyVersion: "v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z"
  })
  await coordinator.register({
    operationId: "tenant-b-op",
    tenantId: "tenant-b",
    resourceType: "account",
    resourceId: "user-b",
    trigger: "account_revoked",
    authoritativeDenyVersion: "v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z"
  })
  assert.deepEqual((await coordinator.listPending("tenant-a")).map((manifest) => manifest.operationId), ["tenant-a-op"])

  const key = (await fixture.objectStore.listKeys(`security/revocation-cleanup/${hash24("tenant-a")}/`))[0]
  assert.ok(key)
  await fixture.objectStore.putText(key, "not-json")
  await assert.rejects(() => coordinator.listPending("tenant-a"), SyntaxError)
})

type Fixture = Awaited<ReturnType<typeof createFixture>>

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "production-revocation-cleanup-"))
  const objectStore = new LocalObjectStore(path.join(root, "objects"))
  const evidence = new MemoryVectorStore()
  const memory = new MemoryVectorStore()
  const chatRuns = new LocalChatRunStore(path.join(root, "runs"))
  const ingestRuns = new LocalDocumentIngestRunStore(path.join(root, "runs"))
  const benchmarkRuns = new LocalBenchmarkRunStore(path.join(root, "runs"))
  const documentGroups = new LocalDocumentGroupStore(path.join(root, "groups"))
  const folderPolicies = new LocalFolderPolicyStore(path.join(root, "groups"))
  const userGroups = new LocalUserGroupStore(path.join(root, "groups"))
  const groupMemberships = new LocalGroupMembershipStore(path.join(root, "groups"))
  const deps = {
    objectStore,
    benchmarkArtifactStore: objectStore,
    evidenceVectorStore: evidence,
    memoryVectorStore: memory,
    chatRunStore: chatRuns,
    documentIngestRunStore: ingestRuns,
    benchmarkRunStore: benchmarkRuns,
    documentGroupStore: documentGroups,
    folderPolicyStore: folderPolicies,
    userGroupStore: userGroups,
    groupMembershipStore: groupMemberships,
    legacyGlobalDocumentArtifacts: false
  } as unknown as Dependencies
  return {
    deps,
    objectStore,
    evidence,
    memory,
    chatRuns,
    ingestRuns,
    benchmarkRuns,
    documentGroups,
    folderPolicies,
    userGroups,
    groupMemberships
  }
}

function documentManifest(
  deps: Dependencies,
  tenantId: string,
  documentId: string,
  lifecycleStatus: "active" | "superseded",
  sourceId = "source-a"
): DocumentManifest {
  const root = `${tenantArtifactRoot(tenantId)}/documents/${documentId}`
  const evidenceKey = tenantVectorKey(deps, tenantId, `${documentId}-chunk-a`)
  const memoryKey = tenantVectorKey(deps, tenantId, `${documentId}-memory-a`)
  return {
    documentId,
    documentVersion: "version-a",
    fileName: `${documentId}.md`,
    metadata: { tenantId, ownerUserId: "user-a", lifecycleStatus },
    admission: { schemaVersion: 1, status: "approved", tenantId, ownerUserId: "user-a", inspectionStatus: "passed", reasons: [], rejectedProtectedMetadataKeys: [], admittedAt: "2026-07-11T00:00:00.000Z" },
    sourceObjectKey: `${root}/source.txt`,
    structuredBlocksObjectKey: `${root}/structured.json`,
    memoryCardsObjectKey: `${root}/memory.json`,
    manifestObjectKey: tenantManifestKey(deps, tenantId, documentId),
    vectorKeys: [evidenceKey, memoryKey],
    evidenceVectorKeys: [evidenceKey],
    memoryVectorKeys: [memoryKey],
    chunks: [{ id: "chunk-a", startChar: 0, endChar: 5 }],
    chunkCount: 1,
    memoryCardCount: 1,
    lifecycleStatus,
    publicationFence: {
      schemaVersion: 1,
      runId: "run-a",
      artifactId: documentId,
      idempotencyKey: "idempotency-a",
      sourceId,
      purpose: "ingest",
      stageNamespace: `staging/publications/run-a/${documentId}`,
      generation: 1,
      fencingToken: "fence-a"
    },
    publicationControl: {
      schemaVersion: 1,
      sourceId,
      purpose: "ingest",
      activePointerKey: "publication/active/pointer.json",
      artifactId: documentId,
      runId: "run-a",
      generation: 1,
      fencingToken: "fence-a"
    },
    createdAt: "2026-07-11T00:00:00.000Z"
  }
}

async function seedDocument(fixture: Fixture, manifest: DocumentManifest): Promise<void> {
  await Promise.all([
    fixture.objectStore.putText(manifest.sourceObjectKey, "source"),
    fixture.objectStore.putText(manifest.structuredBlocksObjectKey!, "structured"),
    fixture.objectStore.putText(manifest.memoryCardsObjectKey!, "memory"),
    fixture.objectStore.putText(manifest.manifestObjectKey, JSON.stringify(manifest))
  ])
  await fixture.evidence.put([vectorRecord(manifest.evidenceVectorKeys![0]!, manifest.documentId, "chunk")])
  await fixture.memory.put([vectorRecord(manifest.memoryVectorKeys![0]!, manifest.documentId, "memory")])
}

async function seedRuns(fixture: Fixture): Promise<void> {
  const now = "2026-07-11T00:00:00.000Z"
  await fixture.chatRuns.create({
    runId: "chat-a", status: "queued", createdBy: "user-a", tenantId: "tenant-a", question: "secret", modelId: "model", createdAt: now, updatedAt: now
  })
  await fixture.ingestRuns.create({
    runId: "ingest-a", status: "running", createdBy: "user-a", tenantId: "tenant-a", uploadId: "upload-a", objectKey: "upload-a", purpose: "document", fileName: "a.md", createdAt: now, updatedAt: now
  })
  await fixture.benchmarkRuns.create({
    runId: "benchmark-a", status: "queued", mode: "search", runner: "lambda", suiteId: "suite-a", datasetS3Key: "dataset-a", createdBy: "user-a", tenantId: "tenant-a", createdAt: now, updatedAt: now
  })
}

function vectorRecord(key: string, documentId: string, kind: "chunk" | "memory"): VectorRecord {
  return {
    key,
    vector: [1, 2],
    metadata: {
      kind,
      documentId,
      fileName: `${documentId}.md`,
      ...(kind === "chunk" ? { chunkId: "chunk-a" } : { memoryId: "memory-a" }),
      createdAt: "2026-07-11T00:00:00.000Z"
    }
  }
}

function shareGrant(tenantId: string, documentId: string, principalId: string): DocumentShareGrant {
  return {
    documentShareGrantId: `grant-${principalId}`,
    itemType: "documentShareGrant",
    tenantId,
    documentId,
    principalType: "user",
    principalId,
    permissionLevel: "readOnly",
    createdBy: "owner-a",
    reason: "fixture",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function userGroup(tenantId: string, groupId: string): UserGroup {
  return {
    groupId,
    itemType: "userGroup",
    tenantId,
    name: groupId,
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy: "owner-a",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function groupMembership(
  tenantId: string,
  groupId: string,
  memberType: GroupMembership["memberType"],
  memberId: string,
  permissionLevel: GroupMembership["permissionLevel"]
): GroupMembership {
  return {
    tenantId,
    groupId,
    memberType,
    memberId,
    permissionLevel,
    source: "manual",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function documentGroup(tenantId: string, groupId: string): DocumentGroup {
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId,
    adminPrincipalType: "user",
    adminPrincipalId: "owner-a",
    name: groupId,
    normalizedName: groupId,
    canonicalPath: `/${groupId}`,
    normalizedCanonicalPath: `/${groupId}`,
    adminPathPk: `${tenantId}#user#owner-a`,
    parentPathPk: `${tenantId}#user#owner-a#ROOT`,
    ancestorGroupIds: [],
    ownerUserId: "owner-a",
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-a"],
    hasExplicitPolicy: true,
    policyId: `policy-${groupId}`,
    status: "active",
    createdBy: "owner-a",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

class MemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, VectorRecord>()
  async put(records: VectorRecord[]): Promise<void> { for (const record of records) this.records.set(record.key, structuredClone(record)) }
  async getByKeys(keys: string[]): Promise<VectorRecord[]> { return keys.map((key) => this.records.get(key)).filter((record): record is VectorRecord => Boolean(record)) }
  async query() { return [] }
  async delete(keys: string[]): Promise<void> { for (const key of keys) this.records.delete(key) }
  keys(): string[] { return [...this.records.keys()].sort() }
}

function hash24(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}
