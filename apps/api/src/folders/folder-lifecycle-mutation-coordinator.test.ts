import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import type { VectorStore } from "../adapters/vector-store.js"
import { folderPolicyStateVersion } from "../adapters/folder-policy-store.js"
import type { AppUser } from "../auth.js"
import type { Dependencies } from "../dependencies.js"
import type { SecurityMutationAuditOutboxPort } from "../security/security-mutation-audit-outbox.js"
import {
  tenantDocumentArtifactKey,
  tenantManifestKey
} from "../rag/_shared/storage/tenant-artifacts.js"
import type { DocumentGroup, DocumentManifest, FolderPolicy, VectorRecord } from "../types.js"
import {
  FolderLifecycleMutationCoordinator,
  FolderMoveAuthorizationError,
  FolderMoveConflictError
} from "./folder-lifecycle-mutation-coordinator.js"

test("folder move atomically commits subtree paths and converges document/index policy projections without changing local grants or versions", async () => {
  const fixture = await createFixture()
  const hierarchy = await fixture.createHierarchy()
  const sourceDocument = await fixture.persistDocument(documentManifest("doc-source", hierarchy.source.groupId))
  const explicitDocument = await fixture.persistDocument(documentManifest("doc-explicit", hierarchy.explicitChild.groupId))
  const grantKey = `documents/share-grants/${tenantId}/${sourceDocument.documentId}.json`
  const grantText = JSON.stringify({ schemaVersion: 1, grants: [{ principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }] })
  await fixture.objectStore.putText(grantKey, grantText, "application/json")
  const explicitPolicyBefore = await fixture.folderPolicyStore.findByFolderId(tenantId, hierarchy.explicitChild.groupId)
  assert.ok(explicitPolicyBefore)
  const explicitVersionBefore = folderPolicyStateVersion(explicitPolicyBefore)

  const result = await fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, {
    destinationParentId: hierarchy.destination.groupId,
    newName: "Moved",
    reason: "approved subtree reorganization",
    expectedVersion: hierarchy.source.updatedAt
  })

  assert.equal(result.folder.canonicalPath, "/Destination/Moved")
  assert.deepEqual([...result.affectedDocumentIds].sort(), ["doc-explicit", "doc-source"])
  assert.equal(result.directDocumentGrantsPreserved, true)
  assert.equal(result.folderLocalPoliciesPreserved, true)
  assert.equal(result.documentVersionsPreserved, true)
  const movedSource = await fixture.documentGroupStore.get(tenantId, hierarchy.source.groupId)
  const movedInheritedChild = await fixture.documentGroupStore.get(tenantId, hierarchy.inheritedChild.groupId)
  const movedExplicitChild = await fixture.documentGroupStore.get(tenantId, hierarchy.explicitChild.groupId)
  assert.equal(movedSource?.canonicalPath, "/Destination/Moved")
  assert.equal(movedInheritedChild?.canonicalPath, "/Destination/Moved/Inherited")
  assert.equal(movedExplicitChild?.canonicalPath, "/Destination/Moved/Explicit")
  assert.equal(movedSource?.inheritedFromFolderId, hierarchy.destination.groupId)
  assert.equal(movedSource?.inheritedPolicyId, "destination-policy")
  assert.equal(movedInheritedChild?.inheritedFromFolderId, hierarchy.destination.groupId)
  assert.equal(movedInheritedChild?.inheritedPolicyId, "destination-policy")
  assert.equal(movedExplicitChild?.policySource, "explicit")
  assert.equal(movedExplicitChild?.policyId, "explicit-child-policy")
  assert.equal(movedExplicitChild?.folderLocalPolicyVersion, explicitVersionBefore)
  assert.equal(movedSource?.adminPrincipalId, mover.userId)
  assert.equal(movedInheritedChild?.adminPrincipalId, mover.userId)
  assert.equal(movedExplicitChild?.adminPrincipalId, mover.userId)
  assert.equal(
    (await fixture.documentGroupStore.findByCanonicalPath(tenantId, `${tenantId}#user#${mover.userId}`, "/destination/moved"))?.groupId,
    hierarchy.source.groupId
  )
  assert.equal(
    await fixture.documentGroupStore.findByCanonicalPath(tenantId, `${tenantId}#user#${mover.userId}`, "/old/source"),
    undefined
  )
  assert.equal(
    (await fixture.folderPolicyStore.findByFolderId(tenantId, hierarchy.explicitChild.groupId))?.policyId,
    explicitPolicyBefore.policyId
  )
  assert.equal(
    folderPolicyStateVersion((await fixture.folderPolicyStore.findByFolderId(tenantId, hierarchy.explicitChild.groupId)) as FolderPolicy),
    explicitVersionBefore
  )
  assert.equal(await fixture.objectStore.getText(grantKey), grantText)

  const afterSourceDocument = await fixture.loadDocument(sourceDocument.documentId)
  const afterExplicitDocument = await fixture.loadDocument(explicitDocument.documentId)
  assert.equal(afterSourceDocument.documentVersion, sourceDocument.documentVersion)
  assert.equal(afterExplicitDocument.documentVersion, explicitDocument.documentVersion)
  assert.equal(afterSourceDocument.lifecycleStatus, "active")
  assert.deepEqual(afterSourceDocument.metadata?.folderCanonicalPaths, ["/Destination/Moved"])
  assert.match(String((afterSourceDocument.metadata?.folderPolicyRefs as string[])[0]), /destination-policy/)
  assert.deepEqual(afterExplicitDocument.metadata?.folderCanonicalPaths, ["/Destination/Moved/Explicit"])
  assert.match(String((afterExplicitDocument.metadata?.folderPolicyRefs as string[])[0]), /explicit-child-policy/)
  for (const record of await fixture.allVectors([sourceDocument, explicitDocument])) {
    assert.equal(record.metadata.lifecycleStatus, "active")
    assert.equal(record.metadata.folderMoveOperationId, result.operationId)
    assert.ok(record.metadata.folderCanonicalPaths?.every((value) => value.startsWith("/Destination/Moved")))
  }
  const activeIndexed = await fixture.evidenceBase.query([1, 0], 10, { tenantId, lifecycleStatus: "active" })
  assert.equal(activeIndexed.length, 2)
  assert.ok(activeIndexed.every((record) => record.metadata.folderCanonicalPaths?.[0]?.startsWith("/Destination/Moved")))
  assert.equal((await fixture.evidenceBase.query([1, 0], 10, { tenantId, lifecycleStatus: "staging" })).length, 0)
  const audits = await fixture.loadAuditIntents()
  assert.equal(audits.length, 1)
  assert.equal(audits[0]?.status, "completed")
  assert.equal(audits[0]?.result, "success")
})

test("pre-commit projection failure restores the complete before image and records a failed audit", async () => {
  let failStaging = true
  const fixture = await createFixture({
    evidenceStore: (inner) => new FaultingVectorStore(inner, (records) => {
      if (failStaging && records.some((record) => record.metadata.lifecycleStatus === "staging")) {
        failStaging = false
        throw new Error("simulated staging projection failure")
      }
    })
  })
  const hierarchy = await fixture.createHierarchy()
  const document = await fixture.persistDocument(documentManifest("doc-rollback", hierarchy.inheritedChild.groupId))

  await assert.rejects(() => fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, {
    destinationParentId: hierarchy.destination.groupId,
    reason: "rollback test",
    expectedVersion: hierarchy.source.updatedAt
  }), /staging projection failure/)

  assert.equal((await fixture.documentGroupStore.get(tenantId, hierarchy.source.groupId))?.canonicalPath, "/Old/Source")
  assert.equal((await fixture.documentGroupStore.get(tenantId, hierarchy.inheritedChild.groupId))?.canonicalPath, "/Old/Source/Inherited")
  const restored = await fixture.loadDocument(document.documentId)
  assert.deepEqual(restored, document)
  for (const record of await fixture.allVectors([document])) {
    assert.equal(record.metadata.lifecycleStatus, "active")
    assert.equal(record.metadata.folderMoveOperationId, undefined)
    assert.deepEqual(record.metadata.folderCanonicalPaths, ["/Old/Source/Inherited"])
  }
  const state = await fixture.loadMoveState(hierarchy.source.groupId)
  assert.equal(state.status, "rolled_back")
  assert.equal((await fixture.loadAuditIntents())[0]?.result, "failed")
})

test("post-commit activation failure exposes no old active projection and retry converges hidden documents to after", async () => {
  let failActivation = true
  const fixture = await createFixture({
    evidenceStore: (inner) => new FaultingVectorStore(inner, (records) => {
      if (
        failActivation &&
        records.some((record) => record.metadata.lifecycleStatus === "active" && record.metadata.folderMoveOperationId)
      ) {
        failActivation = false
        throw new Error("simulated activation failure")
      }
    })
  })
  const hierarchy = await fixture.createHierarchy()
  const first = await fixture.persistDocument(documentManifest("doc-retry-a", hierarchy.source.groupId))
  const second = await fixture.persistDocument(documentManifest("doc-retry-b", hierarchy.inheritedChild.groupId))
  const request = {
    destinationParentId: hierarchy.destination.groupId,
    reason: "retry reconciliation",
    expectedVersion: hierarchy.source.updatedAt
  } as const

  await assert.rejects(() => fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, request), /activation failure/)
  assert.equal((await fixture.documentGroupStore.get(tenantId, hierarchy.source.groupId))?.canonicalPath, "/Destination/Source")
  assert.equal((await fixture.loadMoveState(hierarchy.source.groupId)).status, "reconciliation_pending")
  for (const manifest of [await fixture.loadDocument(first.documentId), await fixture.loadDocument(second.documentId)]) {
    assert.equal(manifest.lifecycleStatus, "staging")
    assert.ok((manifest.metadata?.folderCanonicalPaths as string[])[0]?.startsWith("/Destination/Source"))
  }
  const partialVectors = await fixture.allVectors([first, second])
  assert.equal(partialVectors.some((record) => (
    record.metadata.lifecycleStatus === "active" &&
    record.metadata.folderCanonicalPaths?.[0]?.startsWith("/Old/Source")
  )), false)

  const completed = await fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, request)
  assert.equal(completed.folder.canonicalPath, "/Destination/Source")
  assert.equal((await fixture.loadMoveState(hierarchy.source.groupId)).status, "completed")
  for (const manifest of [await fixture.loadDocument(first.documentId), await fixture.loadDocument(second.documentId)]) {
    assert.equal(manifest.lifecycleStatus, "active")
    assert.ok((manifest.metadata?.folderCanonicalPaths as string[])[0]?.startsWith("/Destination/Source"))
  }
  for (const record of await fixture.allVectors([first, second])) {
    assert.equal(record.metadata.lifecycleStatus, "active")
    assert.ok(record.metadata.folderCanonicalPaths?.[0]?.startsWith("/Destination/Source"))
  }
  assert.equal((await fixture.loadAuditIntents())[0]?.result, "success")
})

test("folder move rejects a descendant destination without changing subtree or document projections", async () => {
  const fixture = await createFixture()
  const hierarchy = await fixture.createHierarchy()
  const document = await fixture.persistDocument(documentManifest("doc-cycle", hierarchy.source.groupId))

  await assert.rejects(() => fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, {
    destinationParentId: hierarchy.inheritedChild.groupId,
    reason: "invalid descendant move",
    expectedVersion: hierarchy.source.updatedAt
  }), FolderMoveConflictError)

  assert.equal((await fixture.documentGroupStore.get(tenantId, hierarchy.source.groupId))?.canonicalPath, "/Old/Source")
  assert.deepEqual(await fixture.loadDocument(document.documentId), document)
  assert.ok((await fixture.allVectors([document])).every((record) => record.metadata.lifecycleStatus === "active"))
  assert.equal((await fixture.loadAuditIntents())[0]?.result, "conflict")
})

test("folder move reauthorizes current identity before subtree commit and rolls hidden documents back on suspension", async () => {
  let suspendAfterStage: (() => void) | undefined
  const fixture = await createFixture({
    evidenceStore: (inner) => new FaultingVectorStore(inner, (records) => {
      if (records.some((record) => record.metadata.lifecycleStatus === "staging")) suspendAfterStage?.()
    })
  })
  const hierarchy = await fixture.createHierarchy()
  const document = await fixture.persistDocument(documentManifest("doc-current-auth", hierarchy.source.groupId))
  suspendAfterStage = () => {
    fixture.identity.accountStatus = "suspended"
    suspendAfterStage = undefined
  }

  await assert.rejects(() => fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, {
    destinationParentId: hierarchy.destination.groupId,
    reason: "current identity boundary",
    expectedVersion: hierarchy.source.updatedAt
  }), FolderMoveAuthorizationError)

  assert.equal((await fixture.documentGroupStore.get(tenantId, hierarchy.source.groupId))?.canonicalPath, "/Old/Source")
  assert.deepEqual(await fixture.loadDocument(document.documentId), document)
  assert.ok((await fixture.allVectors([document])).every((record) => record.metadata.lifecycleStatus === "active"))
  assert.equal((await fixture.loadAuditIntents())[0]?.result, "denied")
})

test("concurrent folder moves serialize on the durable intent CAS and publish one coherent winner", async () => {
  const fixture = await createFixture()
  const hierarchy = await fixture.createHierarchy()
  const destinationB = group("destination-b", "Destination B")
  await fixture.documentGroupStore.createWithPathLock(destinationB)
  const document = await fixture.persistDocument(documentManifest("doc-concurrent", hierarchy.source.groupId))

  const results = await Promise.allSettled([
    fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, {
      destinationParentId: hierarchy.destination.groupId,
      reason: "concurrent writer a",
      expectedVersion: hierarchy.source.updatedAt
    }),
    new FolderLifecycleMutationCoordinator(fixture.deps).moveFolder(mover, hierarchy.source.groupId, {
      destinationParentId: destinationB.groupId,
      reason: "concurrent writer b",
      expectedVersion: hierarchy.source.updatedAt
    })
  ])

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
  assert.ok(rejected?.reason instanceof FolderMoveConflictError)
  const current = await fixture.documentGroupStore.get(tenantId, hierarchy.source.groupId)
  assert.ok(current?.canonicalPath === "/Destination/Source" || current?.canonicalPath === "/Destination B/Source")
  const manifest = await fixture.loadDocument(document.documentId)
  assert.equal(manifest.lifecycleStatus, "active")
  assert.equal((manifest.metadata?.folderCanonicalPaths as string[])[0], current?.canonicalPath)
  assert.ok((await fixture.allVectors([document])).every((record) => (
    record.metadata.lifecycleStatus === "active" && record.metadata.folderCanonicalPaths?.[0] === current?.canonicalPath
  )))
  assert.deepEqual((await fixture.loadAuditIntents()).map((audit) => audit.result).sort(), ["conflict", "success"])
})

test("audit intent persistence failure prevents any subtree or document projection mutation", async () => {
  const unavailableAudit: SecurityMutationAuditOutboxPort = {
    prepare: async () => { throw new Error("audit unavailable") },
    complete: async () => { throw new Error("audit unavailable") }
  }
  const fixture = await createFixture({ securityAuditOutbox: unavailableAudit })
  const hierarchy = await fixture.createHierarchy()
  const document = await fixture.persistDocument(documentManifest("doc-audit-failure", hierarchy.source.groupId))

  await assert.rejects(() => fixture.coordinator.moveFolder(mover, hierarchy.source.groupId, {
    destinationParentId: hierarchy.destination.groupId,
    reason: "audit boundary",
    expectedVersion: hierarchy.source.updatedAt
  }), /audit unavailable/)

  assert.equal((await fixture.documentGroupStore.get(tenantId, hierarchy.source.groupId))?.canonicalPath, "/Old/Source")
  assert.deepEqual(await fixture.loadDocument(document.documentId), document)
  assert.ok((await fixture.allVectors([document])).every((record) => record.metadata.lifecycleStatus === "active"))
})

type FixtureOptions = Readonly<{
  evidenceStore?: (inner: LocalVectorStore) => VectorStore
  memoryStore?: (inner: LocalVectorStore) => VectorStore
  securityAuditOutbox?: SecurityMutationAuditOutboxPort
}>

async function createFixture(options: FixtureOptions = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-move-coordinator-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const evidenceBase = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const memoryBase = new LocalVectorStore(dataDir, "memory-vectors.json")
  const documentGroupStore = new LocalDocumentGroupStore(dataDir)
  const folderPolicyStore = new LocalFolderPolicyStore(dataDir)
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const groupMembershipStore = new LocalGroupMembershipStore(dataDir)
  const identity = mutableIdentity()
  const verifiedIdentityProvider = new MutableVerifiedIdentityProvider(identity)
  const deps = {
    objectStore,
    evidenceVectorStore: options.evidenceStore?.(evidenceBase) ?? evidenceBase,
    memoryVectorStore: options.memoryStore?.(memoryBase) ?? memoryBase,
    documentGroupStore,
    folderPolicyStore,
    userGroupStore,
    groupMembershipStore,
    verifiedIdentityProvider,
    securityAuditOutbox: options.securityAuditOutbox
  } as unknown as Dependencies
  const coordinator = new FolderLifecycleMutationCoordinator(deps)

  const createHierarchy = async () => {
    const oldParent = group("old-parent", "Old")
    const destinationAdminPathPk = `${tenantId}#user#destination-owner`
    const destination = {
      ...group("destination", "Destination"),
      adminPrincipalId: "destination-owner",
      adminPathPk: destinationAdminPathPk,
      parentPathPk: `${destinationAdminPathPk}#ROOT`,
      ownerUserId: "destination-owner",
      managerUserIds: ["destination-owner"],
      createdBy: "destination-owner"
    }
    const source = group("source", "Source", oldParent)
    const inheritedChild = group("inherited-child", "Inherited", source)
    const explicitChild = {
      ...group("explicit-child", "Explicit", source),
      hasExplicitPolicy: true,
      policyId: "explicit-child-policy"
    }
    for (const value of [oldParent, destination, source, inheritedChild, explicitChild]) {
      await documentGroupStore.createWithPathLock(value)
    }
    for (const policy of [
      folderPolicy("old-policy", oldParent.groupId),
      folderPolicy("destination-policy", destination.groupId),
      folderPolicy("explicit-child-policy", explicitChild.groupId)
    ]) await folderPolicyStore.save(policy)
    return { oldParent, destination, source, inheritedChild, explicitChild }
  }

  const persistDocument = async (manifest: DocumentManifest) => {
    const key = tenantManifestKey(deps, tenantId, manifest.documentId)
    const persisted = { ...manifest, manifestObjectKey: key }
    await objectStore.putText(persisted.sourceObjectKey, "source text", "text/plain")
    await objectStore.putText(key, JSON.stringify(persisted, null, 2), "application/json")
    await evidenceBase.put([vector(persisted.evidenceVectorKeys?.[0] as string, persisted, "chunk")])
    await memoryBase.put([vector(persisted.memoryVectorKeys?.[0] as string, persisted, "memory")])
    return persisted
  }
  const loadDocument = async (documentId: string) => JSON.parse(
    await objectStore.getText(tenantManifestKey(deps, tenantId, documentId))
  ) as DocumentManifest
  const allVectors = async (manifests: readonly DocumentManifest[]) => {
    const evidenceKeys = manifests.flatMap((manifest) => manifest.evidenceVectorKeys ?? [])
    const memoryKeys = manifests.flatMap((manifest) => manifest.memoryVectorKeys ?? [])
    return [...await evidenceBase.getByKeys(evidenceKeys), ...await memoryBase.getByKeys(memoryKeys)]
  }
  const loadMoveState = async (folderId: string) => JSON.parse(await objectStore.getText(
    tenantDocumentArtifactKey(deps, tenantId, `folder-mutations/move/${encodeURIComponent(folderId)}.json`)
  )) as { status: string }
  const loadAuditIntents = async () => Promise.all(
    (await objectStore.listKeys(`security-audit/intents/${tenantId}/`)).map(async (key) => (
      JSON.parse(await objectStore.getText(key)) as { status: string; result?: string }
    ))
  )
  return {
    deps,
    coordinator,
    objectStore,
    evidenceBase,
    memoryBase,
    documentGroupStore,
    folderPolicyStore,
    identity,
    createHierarchy,
    persistDocument,
    loadDocument,
    allVectors,
    loadMoveState,
    loadAuditIntents
  }
}

class MutableVerifiedIdentityProvider implements VerifiedIdentityProvider {
  constructor(private readonly identity: ServerManagedIdentity) {}

  async getCurrentIdentity(username: string): Promise<ServerManagedIdentity | undefined> {
    return username === this.identity.username ? { ...this.identity, cognitoGroups: [...this.identity.cognitoGroups] } : undefined
  }

  async getCurrentIdentityBySubject(subject: string): Promise<ServerManagedIdentity | undefined> {
    return subject === this.identity.userId ? { ...this.identity, cognitoGroups: [...this.identity.cognitoGroups] } : undefined
  }
}

class FaultingVectorStore implements VectorStore {
  constructor(
    private readonly inner: VectorStore,
    private readonly beforePut: (records: VectorRecord[]) => void | Promise<void>
  ) {}

  async put(records: VectorRecord[]): Promise<void> {
    await this.beforePut(records)
    await this.inner.put(records)
  }

  async getByKeys(keys: string[]): Promise<VectorRecord[]> {
    if (!this.inner.getByKeys) throw new Error("getByKeys unavailable")
    return this.inner.getByKeys(keys)
  }

  query(...args: Parameters<VectorStore["query"]>) {
    return this.inner.query(...args)
  }

  delete(keys: string[]): Promise<void> {
    return this.inner.delete(keys)
  }
}

const tenantId = "tenant-a"

const mover: AppUser = {
  userId: "mover-1",
  identityUsername: "mover-1",
  email: "mover-1@example.com",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId
}

function mutableIdentity(): ServerManagedIdentity {
  return {
    username: mover.identityUsername as string,
    userId: mover.userId,
    email: mover.email,
    accountStatus: "active",
    cognitoGroups: [...mover.cognitoGroups],
    tenantId
  }
}

function group(groupId: string, name: string, parent?: DocumentGroup): DocumentGroup {
  const now = "2026-07-11T00:00:00.000Z"
  const canonicalPath = parent ? `${parent.canonicalPath}/${name}` : `/${name}`
  const normalizedName = name.toLocaleLowerCase("ja-JP")
  const normalizedCanonicalPath = parent ? `${parent.normalizedCanonicalPath}/${normalizedName}` : `/${normalizedName}`
  const adminPathPk = `${tenantId}#user#${mover.userId}`
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId,
    adminPrincipalType: "user",
    adminPrincipalId: mover.userId,
    name,
    normalizedName,
    canonicalPath,
    normalizedCanonicalPath,
    adminPathPk,
    parentPathPk: `${adminPathPk}#${parent?.groupId ?? "ROOT"}`,
    parentGroupId: parent?.groupId,
    ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : [],
    ownerUserId: mover.userId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [mover.userId],
    status: "active",
    createdBy: mover.userId,
    createdAt: now,
    updatedAt: now
  }
}

function folderPolicy(policyId: string, folderId: string): FolderPolicy {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    policyId,
    itemType: "folderPolicy",
    tenantId,
    folderId,
    entries: [{ principalType: "user", principalId: mover.userId, permissionLevel: "full" }],
    createdBy: mover.userId,
    createdAt: now,
    updatedAt: now
  }
}

function documentManifest(documentId: string, folderId: string): DocumentManifest {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    documentId,
    documentVersion: `version-${documentId}`,
    fileName: `${documentId}.txt`,
    metadata: {
      tenantId,
      ownerUserId: mover.userId,
      scopeType: "group",
      groupId: folderId,
      folderId,
      groupIds: [folderId],
      folderIds: [folderId],
      lifecycleStatus: "active"
    },
    sourceObjectKey: `tenant-artifacts/source/${documentId}.txt`,
    manifestObjectKey: "replaced-by-fixture",
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

function vector(key: string, manifest: DocumentManifest, kind: "chunk" | "memory"): VectorRecord {
  const folderId = (manifest.metadata?.folderIds as string[])[0] as string
  const sourcePath = folderId === "source" ? "/Old/Source" : folderId === "inherited-child" ? "/Old/Source/Inherited" : "/Old/Source/Explicit"
  return {
    key,
    vector: [1, 0],
    metadata: {
      kind,
      documentId: manifest.documentId,
      documentVersion: manifest.documentVersion,
      fileName: manifest.fileName,
      text: "folder move evidence",
      tenantId,
      scopeType: "group",
      groupId: folderId,
      folderId,
      groupIds: [folderId],
      folderIds: [folderId],
      folderCanonicalPaths: [sourcePath],
      lifecycleStatus: "active",
      createdAt: manifest.createdAt
    }
  }
}
