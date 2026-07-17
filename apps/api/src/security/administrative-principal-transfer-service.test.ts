import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { VectorStore } from "../adapters/vector-store.js"
import type { AppUser } from "../auth.js"
import type { Dependencies } from "../dependencies.js"
import type { DocumentGroup, DocumentManifest, UserGroup, VectorRecord } from "../types.js"
import {
  AdministrativePrincipalTransferError,
  AdministrativePrincipalTransferService
} from "./administrative-principal-transfer-service.js"
import { AdministrativePrincipalTransferAuditAuthoritativeResolver } from "./administrative-principal-transfer-audit-reconciler.js"
import { ObjectStoreAdministrativePrincipalTransferFence } from "./administrative-principal-transfer-fence.js"
import type { SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"

test("generic administrative-principal change transfers every folder, document, and resource-group reference before the change", async () => {
  const fixture = await transferFixture()
  await fixture.documentGroups.create(folder("folder-1", source.userId))
  await fixture.userGroups.save(resourceGroup("resource-1", source.userId))
  await fixture.persistDocument(document("doc-1", source.userId))

  const result = await fixture.service.transferBeforeAdministrativePrincipalChange({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default",
    successor,
    reason: "account retirement"
  })

  assert.deepEqual(result, {
    operationId: result.operationId,
    transferredFolders: 1,
    transferredResourceGroups: 1,
    transferredDocuments: 1
  })
  const transferredFolder = await fixture.documentGroups.get("default", "folder-1")
  assert.equal(transferredFolder?.ownerUserId, successor.userId)
  assert.equal(transferredFolder?.adminPrincipalId, successor.userId)
  assert.ok(transferredFolder?.managerUserIds.includes(successor.userId))
  assert.equal((await fixture.userGroups.get("default", "resource-1"))?.createdBy, successor.userId)
  const transferredDocument = await fixture.loadDocument("doc-1")
  assert.equal(transferredDocument.metadata?.ownerUserId, successor.userId)
  assert.equal(transferredDocument.admission?.ownerUserId, successor.userId)
  for (const record of await fixture.allVectors(transferredDocument)) assert.equal(record.metadata.ownerUserId, successor.userId)
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 1)
})

test("FR-086 producer state and current records satisfy the administrative-principal audit resolver contract", async () => {
  const fixture = await transferFixture()
  await fixture.documentGroups.create(folder("folder-1", source.userId))
  await fixture.userGroups.save(resourceGroup("resource-1", source.userId))
  await fixture.persistDocument(document("doc-1", source.userId))

  await fixture.service.transferBeforeAdministrativePrincipalChange({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default",
    successor,
    reason: "producer resolver contract"
  })

  const [auditKey] = await fixture.objectStore.listKeys("security-audit/intents/")
  assert.ok(auditKey)
  const completed = JSON.parse(await fixture.objectStore.getText(auditKey)) as SecurityMutationAuditIntent
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.ok(completed.after)
  const state = JSON.parse(await fixture.objectStore.getText(
    `security/ownership-transfer/default/${source.userId}.json`
  )) as { operationId: string; documents: Array<{ target: DocumentManifest }> }
  assert.equal(
    state.documents[0]?.target.metadata?.administrativeTransferOperationId,
    state.operationId
  )

  const resolver = new AdministrativePrincipalTransferAuditAuthoritativeResolver({
    objects: fixture.objectStore,
    folders: fixture.documentGroups,
    resourceGroups: fixture.userGroups,
    localTestIngestAdmissionContext: {
      mode: "local_test_fixture",
      fixtureId: "administrative-transfer-test",
      tenantId: "default",
      ownerUserId: source.userId
    },
    legacyGlobalDocumentArtifacts: true
  })
  const replay: SecurityMutationAuditIntent = {
    ...completed,
    status: "finalization_pending",
    requestedCompletion: {
      result: completed.result as "success",
      after: completed.after as NonNullable<SecurityMutationAuditIntent["after"]>,
      requestedAt: completed.completedAt as string
    }
  }
  assert.deepEqual(await resolver.resolve(replay), { result: "success", after: completed.after })
})

test("empty administrative-principal transfer still completes a correlated success audit event", async () => {
  const fixture = await transferFixture()

  const result = await fixture.service.transferBeforeAdministrativePrincipalChange({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default",
    reason: "verified empty ownership inventory"
  })

  assert.deepEqual(result, {
    operationId: result.operationId,
    transferredFolders: 0,
    transferredResourceGroups: 0,
    transferredDocuments: 0
  })
  const [auditKey] = await fixture.objectStore.listKeys("security-audit/intents/")
  assert.ok(auditKey)
  const audit = JSON.parse(await fixture.objectStore.getText(auditKey)) as {
    status: string
    result?: string
    draft: { targetType: string; targetId: string }
  }
  assert.equal(audit.status, "completed")
  assert.equal(audit.result, "success")
  assert.deepEqual(
    { targetType: audit.draft.targetType, targetId: audit.draft.targetId },
    { targetType: "administrativePrincipal", targetId: source.userId }
  )
})

test("transfer rejects a missing, inactive, or cross-tenant successor without changing ownership", async () => {
  const fixture = await transferFixture()
  await fixture.documentGroups.create(folder("folder-1", source.userId))

  for (const invalid of [
    undefined,
    { userId: "inactive", tenantId: "default", status: "suspended" as const },
    { userId: "cross", tenantId: "other", status: "active" as const }
  ]) {
    await assert.rejects(() => fixture.service.transferBeforePermanentDelete({
      actor: admin,
      sourceUserId: source.userId,
      tenantId: "default",
      successor: invalid,
      reason: "invalid successor"
    }), AdministrativePrincipalTransferError)
    assert.equal((await fixture.documentGroups.get("default", "folder-1"))?.ownerUserId, source.userId)
  }
})

test("unauthorized administrative-principal transfer is durably audited as denied before returning", async () => {
  const fixture = await transferFixture()
  await fixture.documentGroups.create(folder("folder-1", source.userId))

  await assert.rejects(() => fixture.service.transferBeforeAdministrativePrincipalChange({
    actor: { ...admin, cognitoGroups: ["CHAT_USER"] },
    sourceUserId: source.userId,
    tenantId: "default",
    successor,
    reason: "unauthorized transfer attempt"
  }), AdministrativePrincipalTransferError)

  assert.equal((await fixture.documentGroups.get("default", "folder-1"))?.ownerUserId, source.userId)
  const [auditKey] = await fixture.objectStore.listKeys("security-audit/intents/")
  assert.ok(auditKey)
  const audit = JSON.parse(await fixture.objectStore.getText(auditKey)) as { status: string; result?: string }
  assert.equal(audit.status, "completed")
  assert.equal(audit.result, "denied")
})

test("partial transfer failure rolls already changed resources back and blocks account deletion", async () => {
  let failResourceTransfer = true
  const fixture = await transferFixture({
    wrapUserGroups: (inner) => ({
      list: (tenantId) => inner.list(tenantId),
      get: (tenantId, groupId) => inner.get(tenantId, groupId),
      create: (group) => inner.create(group),
      save: (group) => inner.save(group),
      archive: (tenantId, groupId, updatedAt) => inner.archive(tenantId, groupId, updatedAt),
      replace: async (group, expectedUpdatedAt) => {
        if (failResourceTransfer && group.createdBy === successor.userId) {
          failResourceTransfer = false
          throw new Error("simulated resource transfer failure")
        }
        return inner.replace(group, expectedUpdatedAt)
      }
    })
  })
  await fixture.documentGroups.create(folder("folder-1", source.userId))
  await fixture.userGroups.save(resourceGroup("resource-1", source.userId))
  await fixture.persistDocument(document("doc-1", source.userId))

  await assert.rejects(() => fixture.service.transferBeforePermanentDelete({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default",
    successor,
    reason: "rollback test"
  }), /rolled back/)

  assert.equal((await fixture.documentGroups.get("default", "folder-1"))?.ownerUserId, source.userId)
  assert.equal((await fixture.userGroups.get("default", "resource-1"))?.createdBy, source.userId)
  assert.equal((await fixture.loadDocument("doc-1")).metadata?.ownerUserId, source.userId)
})

test("document projection failure rolls folder and resource-group transfers back without orphaning ownership", async () => {
  let failProjection = true
  const fixture = await transferFixture({
    wrapEvidence: (inner) => ({
      put: async (records) => {
        if (failProjection && records.some((record) => record.metadata.ownerUserId === successor.userId)) {
          failProjection = false
          throw new Error("simulated document projection failure")
        }
        return inner.put(records)
      },
      getByKeys: (keys) => inner.getByKeys(keys),
      query: (...args) => inner.query(...args),
      delete: (keys) => inner.delete(keys)
    })
  })
  await fixture.documentGroups.create(folder("folder-1", source.userId))
  await fixture.userGroups.save(resourceGroup("resource-1", source.userId))
  await fixture.persistDocument(document("doc-1", source.userId))

  await assert.rejects(() => fixture.service.transferBeforePermanentDelete({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default",
    successor,
    reason: "projection rollback test"
  }), /rolled back/)

  assert.equal((await fixture.documentGroups.get("default", "folder-1"))?.ownerUserId, source.userId)
  assert.equal((await fixture.userGroups.get("default", "resource-1"))?.createdBy, source.userId)
  assert.equal((await fixture.loadDocument("doc-1")).metadata?.ownerUserId, source.userId)
  for (const record of await fixture.allVectors(document("doc-1", source.userId))) {
    assert.equal(record.metadata.ownerUserId, source.userId)
  }
})

test("concurrent successor choices allow only one durable transfer winner", async () => {
  const fixture = await transferFixture()
  await fixture.documentGroups.create(folder("folder-1", source.userId))
  const otherSuccessor = { userId: "successor-2", tenantId: "default", status: "active" as const }

  const results = await Promise.allSettled([
    fixture.service.transferBeforePermanentDelete({
      actor: admin,
      sourceUserId: source.userId,
      tenantId: "default",
      successor,
      reason: "successor race"
    }),
    new AdministrativePrincipalTransferService({
      objectStore: fixture.objectStore,
      documentGroupStore: fixture.documentGroups,
      userGroupStore: fixture.userGroups,
      evidenceVectorStore: { put: async () => undefined, query: async () => [], delete: async () => undefined },
      memoryVectorStore: { put: async () => undefined, query: async () => [], delete: async () => undefined }
    }).transferBeforePermanentDelete({
      actor: admin,
      sourceUserId: source.userId,
      tenantId: "default",
      successor: otherSuccessor,
      reason: "successor race"
    })
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(results.filter((result) => result.status === "rejected").length, 1)
  assert.ok([successor.userId, otherSuccessor.userId].includes((await fixture.documentGroups.get("default", "folder-1"))?.ownerUserId ?? ""))
})

test("FR-078 durable deny-first fence drains an ownership write that commits after the first snapshot with orphan count zero", async () => {
  let injectedLateOwnership = false
  const fixture = await transferFixture({
    wrapDocumentGroups: (inner, objectStore) => ({
      list: (tenantId) => inner.list(tenantId),
      get: (tenantId, groupId) => inner.get(tenantId, groupId),
      create: (input) => inner.create(input),
      createWithPathLock: (input) => inner.createWithPathLock(input),
      update: (tenantId, groupId, input) => inner.update(tenantId, groupId, input),
      findByCanonicalPath: (tenantId, adminPathPk, normalizedCanonicalPath) => inner.findByCanonicalPath(tenantId, adminPathPk, normalizedCanonicalPath),
      listByAdminPath: (tenantId, adminPathPk) => inner.listByAdminPath(tenantId, adminPathPk),
      updateWithPathLocks: async (tenantId, updates) => {
        const updated = await inner.updateWithPathLocks(tenantId, updates)
        if (!injectedLateOwnership) {
          injectedLateOwnership = true
          const fence = await new ObjectStoreAdministrativePrincipalTransferFence(objectStore).get("default", source.userId)
          assert.equal(fence?.status, "blocking")
          // Represents an already-authorized request whose write was in flight
          // when the durable principal fence became visible.
          await inner.create(folder("folder-late", source.userId))
        }
        return updated
      }
    })
  })
  await fixture.documentGroups.create(folder("folder-initial", source.userId))

  const result = await fixture.service.transferBeforePermanentDelete({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default",
    successor,
    reason: "concurrent ownership drain"
  })

  assert.equal(injectedLateOwnership, true)
  assert.equal(result.transferredFolders, 2)
  assert.equal((await fixture.documentGroups.get("default", "folder-initial"))?.ownerUserId, successor.userId)
  assert.equal((await fixture.documentGroups.get("default", "folder-late"))?.ownerUserId, successor.userId)
  assert.deepEqual(await fixture.service.inspectBeforePermanentDelete({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default"
  }), { folders: 0, resourceGroups: 0, documents: 0, total: 0 })

  assert.ok(result.operationId)
  await fixture.service.confirmPermanentDeleteAccountDeny({
    tenantId: "default",
    sourceUserId: source.userId,
    operationId: result.operationId
  })
  const retried = await fixture.service.transferBeforePermanentDelete({
    actor: admin,
    sourceUserId: source.userId,
    tenantId: "default",
    successor,
    reason: "idempotent transfer recovery"
  })
  assert.equal(retried.operationId, result.operationId)
  assert.equal(retried.transferredFolders, 2)
})

type FixtureOptions = {
  wrapDocumentGroups?: (inner: LocalDocumentGroupStore, objectStore: LocalObjectStore) => DocumentGroupStore
  wrapUserGroups?: (inner: LocalUserGroupStore) => UserGroupStore
  wrapEvidence?: (inner: LocalVectorStore) => VectorStore
}

async function transferFixture(options: FixtureOptions = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ownership-transfer-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const baseDocumentGroups = new LocalDocumentGroupStore(dataDir)
  const transferDocumentGroups = options.wrapDocumentGroups?.(baseDocumentGroups, objectStore) ?? baseDocumentGroups
  const baseUserGroups = new LocalUserGroupStore(dataDir)
  const userGroups = options.wrapUserGroups?.(baseUserGroups) ?? baseUserGroups
  const baseEvidence = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const evidenceVectorStore = options.wrapEvidence?.(baseEvidence) ?? baseEvidence
  const memoryVectorStore = new LocalVectorStore(dataDir, "memory-vectors.json")
  const deps = {
    objectStore,
    documentGroupStore: transferDocumentGroups,
    userGroupStore: userGroups,
    evidenceVectorStore,
    memoryVectorStore,
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "administrative-transfer-test" },
    legacyGlobalDocumentArtifacts: true
  } as unknown as Dependencies
  const service = new AdministrativePrincipalTransferService(deps)
  const persistDocument = async (manifest: DocumentManifest) => {
    await objectStore.putText(manifest.sourceObjectKey, "source")
    await objectStore.putText(manifest.manifestObjectKey, JSON.stringify(manifest, null, 2), "application/json")
    await baseEvidence.put([vector(manifest.evidenceVectorKeys?.[0] as string, manifest, "chunk")])
    await memoryVectorStore.put([vector(manifest.memoryVectorKeys?.[0] as string, manifest, "memory")])
  }
  const loadDocument = async (documentId: string) => JSON.parse(
    await objectStore.getText(`manifests/${documentId}.json`)
  ) as DocumentManifest
  const allVectors = async (manifest: DocumentManifest) => [
    ...(await baseEvidence.getByKeys(manifest.evidenceVectorKeys ?? [])),
    ...(await memoryVectorStore.getByKeys(manifest.memoryVectorKeys ?? []))
  ]
  return { service, objectStore, documentGroups: baseDocumentGroups, userGroups, persistDocument, loadDocument, allVectors }
}

const admin: AppUser = {
  userId: "admin-1",
  cognitoGroups: ["SYSTEM_ADMIN"],
  accountStatus: "active",
  tenantId: "default"
}
const source = { userId: "source-1", tenantId: "default", status: "active" as const }
const successor = { userId: "successor-1", tenantId: "default", status: "active" as const }

function folder(groupId: string, ownerUserId: string): DocumentGroup {
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

function resourceGroup(groupId: string, createdBy: string): UserGroup {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    groupId,
    itemType: "userGroup",
    tenantId: "default",
    name: groupId,
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy,
    createdAt: now,
    updatedAt: now
  }
}

function document(documentId: string, ownerUserId: string): DocumentManifest {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    documentId,
    fileName: `${documentId}.txt`,
    metadata: { tenantId: "default", ownerUserId, scopeType: "personal", allowedUsers: [ownerUserId] },
    admission: {
      schemaVersion: 1,
      status: "approved",
      tenantId: "default",
      ownerUserId,
      inspectionStatus: "passed",
      reasons: [],
      rejectedProtectedMetadataKeys: [],
      admittedAt: now
    },
    sourceObjectKey: `documents/${documentId}.txt`,
    manifestObjectKey: `manifests/${documentId}.json`,
    vectorKeys: [`${documentId}-e`, `${documentId}-m`],
    evidenceVectorKeys: [`${documentId}-e`],
    memoryVectorKeys: [`${documentId}-m`],
    chunkCount: 1,
    memoryCardCount: 1,
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now
  }
}

function vector(key: string, manifest: DocumentManifest, kind: "chunk" | "memory"): VectorRecord {
  return {
    key,
    vector: [1, 0],
    metadata: {
      kind,
      documentId: manifest.documentId,
      fileName: manifest.fileName,
      ownerUserId: manifest.metadata?.ownerUserId as string,
      allowedUsers: manifest.metadata?.allowedUsers as string[],
      tenantId: "default",
      lifecycleStatus: "active",
      createdAt: manifest.createdAt
    }
  }
}
