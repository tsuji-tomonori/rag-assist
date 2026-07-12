import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import type { VectorStore } from "../adapters/vector-store.js"
import type { AppUser } from "../auth.js"
import type { Dependencies } from "../dependencies.js"
import type {
  SecurityMutationAuditIntent,
  SecurityMutationAuditOutboxPort
} from "../security/security-mutation-audit-outbox.js"
import type { DocumentGroup, DocumentManifest, VectorRecord } from "../types.js"
import {
  REVOCATION_CLEANUP_SCOPES,
  type RevocationCleanupManifest
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import {
  DocumentLifecycleMutationCoordinator,
  DocumentMutationAuthorizationError,
  DocumentMutationConflictError
} from "./document-lifecycle-mutation-coordinator.js"

test("move requires current full permission on every source folder and the destination", async () => {
  const fixture = await createFixture()
  await fixture.documentGroupStore.create(group("source", "other-owner"))
  await fixture.documentGroupStore.create(group("destination", mover.userId))
  await fixture.persistDocument(manifest("doc-denied", "source", mover.userId))

  await assert.rejects(() => fixture.coordinator.moveDocument(mover, "doc-denied", {
    destinationFolderId: "destination",
    reason: "source permission check"
  }), DocumentMutationAuthorizationError)
  const [audit] = await loadAuditIntents(fixture.objectStore)
  assert.equal(audit?.status, "completed")
  assert.equal(audit?.result, "denied")
  assert.equal(audit?.draft.targetId, "doc-denied")
})

test("missing document move and stale version attempts persist completed denial/conflict audits", async () => {
  const missingFixture = await createFixture()
  await assert.rejects(() => missingFixture.coordinator.moveDocument(mover, "missing-document", {
    destinationFolderId: "destination",
    reason: "missing target attempt"
  }), /ENOENT/)
  const [missingAudit] = await loadAuditIntents(missingFixture.objectStore)
  assert.equal(missingAudit?.status, "completed")
  assert.equal(missingAudit?.result, "denied")
  assert.equal(missingAudit?.draft.targetId, "missing-document")

  const staleFixture = await createFixture()
  await staleFixture.documentGroupStore.create(group("source-stale-move", mover.userId))
  await staleFixture.documentGroupStore.create(group("destination-stale-move", mover.userId))
  const source = manifest("doc-stale-move", "source-stale-move", mover.userId)
  await staleFixture.persistDocument(source)
  await assert.rejects(() => staleFixture.coordinator.moveDocument(mover, source.documentId, {
    destinationFolderId: "destination-stale-move",
    reason: "stale move attempt",
    expectedUpdatedAt: "2026-07-10T00:00:00.000Z"
  }), DocumentMutationConflictError)
  const [staleAudit] = await loadAuditIntents(staleFixture.objectStore)
  assert.equal(staleAudit?.status, "completed")
  assert.equal(staleAudit?.result, "conflict")
  assert.deepEqual(await loadManifest(staleFixture.objectStore, source.documentId), source)
})

test("move audit persistence failure prevents projection and manifest mutation", async () => {
  const unavailableAudit: SecurityMutationAuditOutboxPort = {
    prepare: async () => { throw new Error("audit unavailable") },
    complete: async () => { throw new Error("audit unavailable") }
  }
  const fixture = await createFixture({ securityAuditOutbox: unavailableAudit })
  await fixture.documentGroupStore.create(group("source-audit-failure", mover.userId))
  await fixture.documentGroupStore.create(group("destination-audit-failure", mover.userId))
  const source = manifest("doc-move-audit-failure", "source-audit-failure", mover.userId)
  await fixture.persistDocument(source)

  await assert.rejects(() => fixture.coordinator.moveDocument(mover, source.documentId, {
    destinationFolderId: "destination-audit-failure",
    reason: "audit boundary"
  }), /audit unavailable/)

  assert.deepEqual(await loadManifest(fixture.objectStore, source.documentId), source)
  for (const record of await fixture.allVectors(source)) {
    assert.equal(record.metadata.folderId, "source-audit-failure")
    assert.equal(record.metadata.lifecycleStatus, "active")
  }
})

test("move operation guard honors an ordinary source-folder deny over a group full allow", async () => {
  const fixture = await createFixture()
  const source = { ...group("source-explicit-deny", "other-owner"), hasExplicitPolicy: true, policyId: "source-deny-policy" }
  await fixture.documentGroupStore.create(source)
  await fixture.documentGroupStore.create(group("destination-explicit-deny", mover.userId))
  await fixture.userGroupStore.save({
    groupId: "move-team",
    tenantId: "default",
    name: "Move team",
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy: "other-owner",
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  })
  await fixture.groupMembershipStore.save({
    tenantId: "default",
    groupId: "move-team",
    memberType: "user",
    memberId: mover.userId,
    permissionLevel: "full",
    source: "manual",
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  })
  await fixture.folderPolicyStore.save({
    policyId: "source-deny-policy",
    tenantId: "default",
    folderId: source.groupId,
    entries: [
      { principalType: "user", principalId: "other-owner", permissionLevel: "full" },
      { principalType: "group", principalId: "move-team", permissionLevel: "full" },
      { principalType: "user", principalId: mover.userId, permissionLevel: "deny" }
    ],
    createdBy: "other-owner",
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  })
  await fixture.persistDocument(manifest("doc-explicit-deny", source.groupId, mover.userId))

  await assert.rejects(() => fixture.coordinator.moveDocument(mover, "doc-explicit-deny", {
    destinationFolderId: "destination-explicit-deny",
    reason: "ordinary deny parity"
  }), DocumentMutationAuthorizationError)
})

test("move stages projections, commits the manifest with CAS, and preserves direct grants", async () => {
  const fixture = await createFixture()
  await fixture.documentGroupStore.create(group("source", mover.userId))
  await fixture.documentGroupStore.create(group("destination", mover.userId))
  const source = manifest("doc-move", "source", mover.userId)
  await fixture.persistDocument(source)
  const grantKey = "documents/share-grants/default/doc-move.json"
  const grantText = JSON.stringify({ schemaVersion: 1, grants: [{ principalId: "reader-1" }] })
  await fixture.objectStore.putText(grantKey, grantText, "application/json")

  const result = await fixture.coordinator.moveDocument(mover, source.documentId, {
    destinationFolderId: "destination",
    newTitle: "moved.txt",
    reason: "folder reorganization",
    expectedUpdatedAt: source.updatedAt
  })

  assert.deepEqual(result.before.folderIds, ["source"])
  assert.deepEqual(result.after, { folderIds: ["destination"], fileName: "moved.txt" })
  assert.equal(result.directDocumentGrantsPreserved, true)
  const stored = await loadManifest(fixture.objectStore, source.documentId)
  assert.deepEqual(stored.metadata?.folderIds, ["destination"])
  assert.equal(stored.metadata?.documentMoveOperationId, result.document.metadata?.documentMoveOperationId)
  assert.equal(await fixture.objectStore.getText(grantKey), grantText)
  for (const record of await fixture.allVectors(source)) {
    assert.equal(record.metadata.folderId, "destination")
    assert.equal(record.metadata.lifecycleStatus, "active")
    assert.equal(record.metadata.fileName, "moved.txt")
  }
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 1)
})

test("move retry converges a manifest-committed partial projection failure to the new state", async () => {
  let failActivation = true
  const fixture = await createFixture({
    evidenceStore: (inner) => new FaultingVectorStore(inner, {
      put: (records) => {
        if (failActivation && records.some((record) => record.metadata.folderId === "destination" && record.metadata.lifecycleStatus === "active")) {
          failActivation = false
          throw new Error("simulated activation failure")
        }
      }
    })
  })
  await fixture.documentGroupStore.create(group("source", mover.userId))
  await fixture.documentGroupStore.create(group("destination", mover.userId))
  const source = manifest("doc-retry", "source", mover.userId)
  await fixture.persistDocument(source)
  const input = { destinationFolderId: "destination", reason: "retryable move" }

  await assert.rejects(() => fixture.coordinator.moveDocument(mover, source.documentId, input), /activation failure/)
  const committed = await loadManifest(fixture.objectStore, source.documentId)
  assert.deepEqual(committed.metadata?.folderIds, ["destination"])

  const retried = await fixture.coordinator.moveDocument(mover, source.documentId, input)
  assert.deepEqual(retried.after.folderIds, ["destination"])
  for (const record of await fixture.allVectors(source)) {
    assert.equal(record.metadata.folderId, "destination")
    assert.equal(record.metadata.lifecycleStatus, "active")
  }
})

test("move reauthorizes immediately before manifest commit and rolls projections back when source access is revoked", async () => {
  let revokeSource: (() => Promise<void>) | undefined
  const fixture = await createFixture({
    evidenceStore: (inner) => new FaultingVectorStore(inner, {
      put: async (records) => {
        if (records.some((record) => record.metadata.lifecycleStatus === "staging")) await revokeSource?.()
      }
    })
  })
  await fixture.documentGroupStore.create(group("source", mover.userId))
  await fixture.documentGroupStore.create(group("destination", mover.userId))
  const source = manifest("doc-reauth", "source", mover.userId)
  await fixture.persistDocument(source)
  revokeSource = async () => {
    await fixture.documentGroupStore.update("default", "source", { status: "archived" })
    revokeSource = undefined
  }

  await assert.rejects(() => fixture.coordinator.moveDocument(mover, source.documentId, {
    destinationFolderId: "destination",
    reason: "current authorization boundary"
  }), DocumentMutationAuthorizationError)
  const current = await loadManifest(fixture.objectStore, source.documentId)
  assert.deepEqual(current.metadata?.folderIds, ["source"])
  for (const record of await fixture.allVectors(source)) {
    assert.equal(record.metadata.folderId, "source")
    assert.equal(record.metadata.lifecycleStatus, "active")
  }
})

test("concurrent moves serialize on the durable document intent and leave one coherent winner", async () => {
  const fixture = await createFixture()
  await fixture.documentGroupStore.create(group("source", mover.userId))
  await fixture.documentGroupStore.create(group("destination-a", mover.userId))
  await fixture.documentGroupStore.create(group("destination-b", mover.userId))
  const source = manifest("doc-race", "source", mover.userId)
  await fixture.persistDocument(source)

  const results = await Promise.allSettled([
    fixture.coordinator.moveDocument(mover, source.documentId, { destinationFolderId: "destination-a", reason: "race a" }),
    new DocumentLifecycleMutationCoordinator(fixture.deps).moveDocument(mover, source.documentId, { destinationFolderId: "destination-b", reason: "race b" })
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
  assert.ok(rejected?.reason instanceof DocumentMutationConflictError)
  const current = await loadManifest(fixture.objectStore, source.documentId)
  const winningFolder = (current.metadata?.folderIds as string[])[0]
  assert.ok(winningFolder === "destination-a" || winningFolder === "destination-b")
  for (const record of await fixture.allVectors(source)) {
    assert.equal(record.metadata.folderId, winningFolder)
    assert.equal(record.metadata.lifecycleStatus, "active")
  }
})

test("delete writes the authoritative deny tombstone before cleanup and retry completes idempotently", async () => {
  let failDelete = true
  const fixture = await createFixture({
    evidenceStore: (inner) => new FaultingVectorStore(inner, {
      delete: () => {
        if (failDelete) {
          failDelete = false
          throw new Error("simulated cleanup failure")
        }
      }
    })
  })
  await fixture.documentGroupStore.create(group("source", mover.userId))
  const source = manifest("doc-delete", "source", mover.userId)
  await fixture.persistDocument(source)
  await fixture.objectStore.putText("documents/share-grants/default/doc-delete.json", "grant", "application/json")

  await assert.rejects(
    () => fixture.coordinator.deleteDocument(mover, source.documentId, {
      reason: "retention expiry",
      expectedUpdatedAt: source.updatedAt ?? source.createdAt
    }),
    /cleanup failure/
  )
  const tombstone = await loadManifest(fixture.objectStore, source.documentId)
  assert.equal(tombstone.lifecycleStatus, "superseded")
  assert.equal(tombstone.metadata?.lifecycleStatus, "superseded")
  assert.equal(typeof (tombstone.metadata?.documentRevocation as { operationId?: unknown })?.operationId, "string")
  const cleanupKeys = await fixture.objectStore.listKeys("security/revocation-cleanup/")
  assert.equal(cleanupKeys.length, 1)
  const cleanup = JSON.parse(await fixture.objectStore.getText(cleanupKeys[0]!)) as RevocationCleanupManifest
  assert.deepEqual(cleanup.scopes.map((scope) => scope.scope), REVOCATION_CLEANUP_SCOPES)
  assert.deepEqual(
    [...new Set(cleanup.targets.map((target) => target.scope))]
      .filter((scope) => ["cache", "session", "queued_run", "evaluation_artifact"].includes(scope))
      .sort(),
    ["cache", "evaluation_artifact", "queued_run", "session"]
  )
  assert.equal((await fixture.objectStore.listKeys("security/revocation-cleanup-repairs/")).length, 1)
  await fixture.objectStore.deleteObject(source.manifestObjectKey)

  const completed = await fixture.coordinator.deleteDocument(mover, source.documentId, {
    reason: "retention expiry",
    expectedUpdatedAt: source.updatedAt ?? source.createdAt
  })
  assert.equal(completed.tombstoned, true)
  assert.deepEqual(await fixture.allVectors(source), [])
  await assert.rejects(() => fixture.objectStore.getText(source.sourceObjectKey), /ENOENT/)
  await assert.rejects(() => fixture.objectStore.getText(source.manifestObjectKey), /ENOENT/)
  await assert.rejects(() => fixture.objectStore.getText("documents/share-grants/default/doc-delete.json"), /ENOENT/)
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 1)
})

test("delete denial persists a completed common audit and leaves every protected projection unchanged", async () => {
  const fixture = await createFixture()
  await fixture.documentGroupStore.create(group("source-denied", mover.userId))
  const source = manifest("doc-delete-denied", "source-denied", mover.userId)
  await fixture.persistDocument(source)
  const deniedActor: AppUser = {
    userId: "reader-1",
    email: "reader-1@example.com",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "default"
  }

  await assert.rejects(() => fixture.coordinator.deleteDocument(deniedActor, source.documentId, {
    reason: "unauthorized cleanup",
    expectedUpdatedAt: source.updatedAt ?? source.createdAt
  }), DocumentMutationAuthorizationError)

  assert.deepEqual(await loadManifest(fixture.objectStore, source.documentId), source)
  assert.equal((await fixture.allVectors(source)).length, 2)
  const [audit] = await loadAuditIntents(fixture.objectStore)
  assert.equal(audit?.status, "completed")
  assert.equal(audit?.result, "denied")
  assert.equal(audit?.draft.actorId, deniedActor.userId)
  assert.equal(audit?.draft.reason, "unauthorized cleanup")
  assert.deepEqual(audit?.after, audit?.draft.before)
})

test("delete stale version persists conflict audit and does not create a tombstone", async () => {
  const fixture = await createFixture()
  await fixture.documentGroupStore.create(group("source-stale", mover.userId))
  const source = manifest("doc-delete-stale", "source-stale", mover.userId)
  await fixture.persistDocument(source)

  await assert.rejects(() => fixture.coordinator.deleteDocument(mover, source.documentId, {
    reason: "stale client cleanup",
    expectedUpdatedAt: "2026-07-10T00:00:00.000Z"
  }), DocumentMutationConflictError)

  assert.deepEqual(await loadManifest(fixture.objectStore, source.documentId), source)
  assert.equal((await fixture.allVectors(source)).length, 2)
  const [audit] = await loadAuditIntents(fixture.objectStore)
  assert.equal(audit?.status, "completed")
  assert.equal(audit?.result, "conflict")
  assert.deepEqual(audit?.after, audit?.draft.before)
})

test("delete audit persistence failure prevents tombstone and projection cleanup", async () => {
  const unavailableAudit: SecurityMutationAuditOutboxPort = {
    prepare: async () => { throw new Error("audit unavailable") },
    complete: async () => { throw new Error("audit unavailable") }
  }
  const fixture = await createFixture({ securityAuditOutbox: unavailableAudit })
  await fixture.documentGroupStore.create(group("source-audit-failure", mover.userId))
  const source = manifest("doc-delete-audit-failure", "source-audit-failure", mover.userId)
  await fixture.persistDocument(source)

  await assert.rejects(() => fixture.coordinator.deleteDocument(mover, source.documentId, {
    reason: "audit boundary",
    expectedUpdatedAt: source.updatedAt ?? source.createdAt
  }), /audit unavailable/)

  assert.deepEqual(await loadManifest(fixture.objectStore, source.documentId), source)
  assert.equal((await fixture.allVectors(source)).length, 2)
})

test("benchmark deletion authorizes through its resource subject but attributes audit and tombstone to the verified runner", async () => {
  const fixture = await createFixture()
  const suiteId = "smoke-agent-v1"
  const ownerUserId = "benchmark-evaluation:standard-agent-v1"
  const source = manifest("benchmark-seed-delete", "unused", ownerUserId)
  source.metadata = {
    tenantId: "default",
    ownerUserId,
    scopeType: "benchmark",
    benchmarkSeed: true,
    benchmarkSuiteId: suiteId,
    source: "benchmark-runner",
    docType: "benchmark-corpus",
    lifecycleStatus: "active"
  }
  await fixture.objectStore.putText(source.sourceObjectKey, "source", "text/plain")
  await fixture.objectStore.putText(source.manifestObjectKey, JSON.stringify(source, null, 2), "application/json")
  const authorizationActor: AppUser = {
    userId: ownerUserId,
    email: "runner@example.com",
    cognitoGroups: ["BENCHMARK_RUNNER"],
    accountStatus: "active",
    tenantId: "default"
  }

  await fixture.coordinator.deleteDocument(authorizationActor, source.documentId, {
    reason: "benchmark seed cleanup",
    expectedUpdatedAt: source.updatedAt ?? source.createdAt
  }, { auditActorId: "verified-runner-1" })

  const [audit] = await loadAuditIntents(fixture.objectStore)
  assert.equal(audit?.draft.actorId, "verified-runner-1")
  const intents = await fixture.objectStore.listKeys("document-mutations/delete/")
  const storedIntent = JSON.parse(await fixture.objectStore.getText(intents[0]!)) as DeleteIntentShape
  assert.equal(storedIntent?.actorId, "verified-runner-1")
  const revocation = storedIntent.tombstoneManifest.metadata?.documentRevocation as { actorId?: string }
  assert.equal(revocation.actorId, "verified-runner-1")
})

type DeleteIntentShape = {
  actorId?: string
  tombstoneManifest: DocumentManifest
}

type FixtureOptions = {
  evidenceStore?: (inner: LocalVectorStore) => VectorStore
  memoryStore?: (inner: LocalVectorStore) => VectorStore
  securityAuditOutbox?: SecurityMutationAuditOutboxPort
}

async function createFixture(options: FixtureOptions = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "document-mutation-coordinator-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const baseEvidence = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const baseMemory = new LocalVectorStore(dataDir, "memory-vectors.json")
  const evidenceVectorStore = options.evidenceStore?.(baseEvidence) ?? baseEvidence
  const memoryVectorStore = options.memoryStore?.(baseMemory) ?? baseMemory
  const documentGroupStore = new LocalDocumentGroupStore(dataDir)
  const folderPolicyStore = new LocalFolderPolicyStore(dataDir)
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const groupMembershipStore = new LocalGroupMembershipStore(dataDir)
  const deps = {
    objectStore,
    evidenceVectorStore,
    memoryVectorStore,
    documentGroupStore,
    folderPolicyStore,
    userGroupStore,
    groupMembershipStore,
    securityAuditOutbox: options.securityAuditOutbox,
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "document-lifecycle-test" },
    legacyGlobalDocumentArtifacts: true
  } as unknown as Dependencies
  const coordinator = new DocumentLifecycleMutationCoordinator(deps)

  const persistDocument = async (value: DocumentManifest) => {
    await objectStore.putText(value.sourceObjectKey, "source", "text/plain")
    await objectStore.putText(value.manifestObjectKey, JSON.stringify(value, null, 2), "application/json")
    await baseEvidence.put([vector(value.evidenceVectorKeys?.[0] as string, value, "chunk")])
    await baseMemory.put([vector(value.memoryVectorKeys?.[0] as string, value, "memory")])
  }
  const allVectors = async (value: DocumentManifest) => [
    ...(await baseEvidence.getByKeys(value.evidenceVectorKeys ?? [])),
    ...(await baseMemory.getByKeys(value.memoryVectorKeys ?? []))
  ]
  return { deps, coordinator, objectStore, documentGroupStore, folderPolicyStore, userGroupStore, groupMembershipStore, persistDocument, allVectors }
}

class FaultingVectorStore implements VectorStore {
  constructor(
    private readonly inner: VectorStore,
    private readonly faults: {
      put?: (records: VectorRecord[]) => void | Promise<void>
      delete?: (keys: string[]) => void | Promise<void>
    }
  ) {}

  async put(records: VectorRecord[]): Promise<void> {
    await this.faults.put?.(records)
    return this.inner.put(records)
  }

  async getByKeys(keys: string[]): Promise<VectorRecord[]> {
    if (!this.inner.getByKeys) throw new Error("getByKeys unavailable")
    return this.inner.getByKeys(keys)
  }

  async query(...args: Parameters<VectorStore["query"]>) {
    return this.inner.query(...args)
  }

  async delete(keys: string[]): Promise<void> {
    await this.faults.delete?.(keys)
    return this.inner.delete(keys)
  }
}

const mover: AppUser = {
  userId: "mover-1",
  email: "mover-1@example.com",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "default"
}

function group(groupId: string, ownerUserId: string): DocumentGroup {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: ownerUserId,
    name: groupId,
    normalizedName: groupId,
    canonicalPath: `/${groupId}`,
    normalizedCanonicalPath: `/${groupId}`,
    adminPathPk: `default#user#${ownerUserId}`,
    parentPathPk: `default#user#${ownerUserId}#ROOT`,
    ancestorGroupIds: [],
    ownerUserId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [ownerUserId],
    status: "active",
    createdBy: ownerUserId,
    createdAt: now,
    updatedAt: now
  }
}

function manifest(documentId: string, folderId: string, ownerUserId: string): DocumentManifest {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    documentId,
    fileName: `${documentId}.txt`,
    metadata: {
      tenantId: "default",
      ownerUserId,
      scopeType: "group",
      groupId: folderId,
      folderId,
      groupIds: [folderId],
      folderIds: [folderId],
      lifecycleStatus: "active"
    },
    sourceObjectKey: `documents/${documentId}.txt`,
    manifestObjectKey: `manifests/${documentId}.json`,
    vectorKeys: [`${documentId}-evidence`, `${documentId}-memory`],
    evidenceVectorKeys: [`${documentId}-evidence`],
    memoryVectorKeys: [`${documentId}-memory`],
    chunkCount: 1,
    memoryCardCount: 1,
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now
  }
}

function vector(key: string, source: DocumentManifest, kind: "chunk" | "memory"): VectorRecord {
  const folderId = (source.metadata?.folderIds as string[])[0] as string
  return {
    key,
    vector: [1, 0],
    metadata: {
      kind,
      documentId: source.documentId,
      fileName: source.fileName,
      text: "test",
      tenantId: "default",
      scopeType: "group",
      groupId: folderId,
      folderId,
      groupIds: [folderId],
      folderIds: [folderId],
      lifecycleStatus: "active",
      createdAt: source.createdAt
    }
  }
}

async function loadManifest(objectStore: LocalObjectStore, documentId: string): Promise<DocumentManifest> {
  return JSON.parse(await objectStore.getText(`manifests/${documentId}.json`)) as DocumentManifest
}

async function loadAuditIntents(objectStore: LocalObjectStore): Promise<SecurityMutationAuditIntent[]> {
  const keys = await objectStore.listKeys("security-audit/intents/")
  return Promise.all(keys.map(async (key) => JSON.parse(await objectStore.getText(key)) as SecurityMutationAuditIntent))
}
