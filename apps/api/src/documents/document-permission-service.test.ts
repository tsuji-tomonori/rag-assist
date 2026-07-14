import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { ObjectStore, VersionedText } from "../adapters/object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { AppUser } from "../auth.js"
import type { DocumentManifest } from "../types.js"
import type { ResourceUserPrincipal, ResourceUserPrincipalDirectory } from "../security/resource-group-membership-service.js"
import { ObjectStoreSecurityMutationAuditOutbox } from "../security/security-mutation-audit-outbox.js"
import {
  calculateEffectiveDocumentPermission,
  canMoveDocument,
  canShareDocument,
  DocumentShareConflictError,
  DocumentShareValidationError,
  DocumentPermissionService,
  validateDocumentMoveRequest,
  validateDocumentShareRequest
} from "./document-permission-service.js"

const manager: AppUser = {
  userId: "user-a",
  email: "a@example.com",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "tenant-a"
}

test("calculateEffectiveDocumentPermission adds direct document grants to folder permission", () => {
  assert.equal(calculateEffectiveDocumentPermission("readOnly", "none"), "readOnly")
  assert.equal(calculateEffectiveDocumentPermission("none", "readOnly"), "readOnly")
  assert.equal(calculateEffectiveDocumentPermission("readOnly", "full"), "full")
  assert.equal(calculateEffectiveDocumentPermission("full", "readOnly"), "full")
})

test("document share and move guards require full document permission and operation permission", () => {
  assert.equal(canShareDocument("full", manager), true)
  assert.equal(canShareDocument("readOnly", manager), false)
  assert.equal(canMoveDocument("full", "full", manager), true)
  assert.equal(canMoveDocument("full", "readOnly", manager), false)
  assert.equal(canMoveDocument("readOnly", "full", manager), false)
})

test("document share and move request validators require reason and destination", () => {
  assert.throws(() => validateDocumentShareRequest([], ""), DocumentShareValidationError)
  assert.throws(() => validateDocumentShareRequest([
    { principalType: "user", principalId: "user-b", permissionLevel: "readOnly" },
    { principalType: "user", principalId: "user-b", permissionLevel: "full" }
  ], "重複確認"), DocumentShareValidationError)
  assert.throws(() => validateDocumentShareRequest([
    { principalType: "user", principalId: "   ", permissionLevel: "readOnly" }
  ], "空白確認"), DocumentShareValidationError)
  assert.doesNotThrow(() => validateDocumentShareRequest([{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "確認依頼"))
  assert.throws(() => validateDocumentMoveRequest({ reason: "整理" }), /destinationFolderId/)
  assert.throws(() => validateDocumentMoveRequest({ destinationFolderId: "folder-1" }), /reason/)
})

test("SYSTEM_ADMIN role does not bypass ordinary document resource permission", async () => {
  const { service } = await createDocumentPermissionFixture()
  const document = manifest("doc-admin-deny", "tenant-a")
  const systemAdmin: AppUser = {
    userId: "system-admin-1",
    cognitoGroups: ["SYSTEM_ADMIN"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
  const decision = await service.resolveEffectiveDocumentPermissionDecision(systemAdmin, document)
  assert.equal(decision.permission, "none")
  assert.equal(decision.reasonCode, "no_matching_allow")
  assert.equal(decision.policyVersion, "resource-permission-decision-v1")
})

test("ordinary direct deny overrides a folder allow and records versioned contributions", async () => {
  const fixture = await createDocumentPermissionFixture()
  const now = "2026-07-11T00:00:00.000Z"
  await fixture.documentGroupStore.create({
    groupId: "folder-allow",
    tenantId: "tenant-a",
    adminPrincipalType: "user",
    adminPrincipalId: "owner-1",
    name: "Allowed folder",
    ownerUserId: "owner-1",
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-1"],
    hasExplicitPolicy: true,
    policyId: "folder-policy-allow",
    status: "active",
    createdAt: now,
    updatedAt: now
  })
  await fixture.folderPolicyStore.save({
    policyId: "folder-policy-allow",
    tenantId: "tenant-a",
    folderId: "folder-allow",
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
    ],
    createdBy: "owner-1",
    createdAt: now,
    updatedAt: now
  })
  const document = {
    ...manifest("doc-explicit-deny", "tenant-a"),
    lifecycleStatus: "active" as const,
    metadata: {
      tenantId: "tenant-a",
      ownerUserId: "owner-1",
      scopeType: "folder",
      folderId: "folder-allow"
    }
  }
  await putLegacyLedger(fixture.objectStore, [grant("tenant-a", document.documentId, "reader-1", "deny")])
  const reader: AppUser = {
    userId: "reader-1",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }

  const decision = await fixture.service.resolveEffectiveDocumentPermissionDecision(reader, document)
  assert.equal(decision.permission, "none")
  assert.equal(decision.reasonCode, "ordinary_policy_denied")
  assert.equal(decision.contributions.find((item) => item.sourceType === "directDocumentPolicy")?.effect, "deny")
  assert.equal(decision.contributions.find((item) => item.sourceType === "folderPolicy")?.permission, "readOnly")
})

test("unreadable ordinary document policy fails closed with a versioned unavailable reason", async () => {
  const fixture = await createDocumentPermissionFixture()
  const document = {
    ...manifest("doc-unreadable-policy", "tenant-a"),
    lifecycleStatus: "active" as const,
    metadata: { tenantId: "tenant-a", ownerUserId: "owner-1", scopeType: "personal" }
  }
  await fixture.objectStore.putText(
    "documents/share-grants/tenant-a/doc-unreadable-policy.json",
    "{not-valid-json",
    "application/json"
  )

  const decision = await fixture.service.resolveEffectiveDocumentPermissionDecision({
    userId: "reader-1",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }, document)

  assert.equal(decision.permission, "none")
  assert.equal(decision.reasonCode, "ordinary_policy_unavailable")
  assert.equal(decision.contributions[0]?.effect, "unavailable")
  assert.equal(decision.contributions[0]?.policyVersion, "document-share-policy-v1")
})

test("personal document administrative principal remains full but cannot be targeted by an ordinary deny mutation", async () => {
  const fixture = await createDocumentPermissionFixture()
  const document = {
    ...manifest("doc-owner-deny", "tenant-a"),
    lifecycleStatus: "active" as const,
    metadata: { tenantId: "tenant-a", ownerUserId: "owner-1", scopeType: "personal" }
  }
  const owner: AppUser = {
    userId: "owner-1",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
  await putLegacyLedger(fixture.objectStore, [grant("tenant-a", document.documentId, "owner-1", "deny")])
  const decision = await fixture.service.resolveEffectiveDocumentPermissionDecision(owner, document)
  assert.equal(decision.permission, "full")
  assert.equal(decision.reasonCode, "administrative_principal")
  await assert.rejects(() => fixture.service.replaceDocumentShareGrants(owner, document, [
    { principalType: "user", principalId: "owner-1", permissionLevel: "deny" }
  ], "invalid owner deny"), DocumentShareValidationError)
})

test("ownership-transfer successor keeps full authority for a folder document despite an ordinary folder deny", async () => {
  const fixture = await createDocumentPermissionFixture()
  const now = "2026-07-11T00:00:00.000Z"
  await fixture.documentGroupStore.create({
    groupId: "folder-successor-deny",
    tenantId: "tenant-a",
    adminPrincipalType: "user",
    adminPrincipalId: "folder-owner-1",
    name: "Transferred document folder",
    ownerUserId: "folder-owner-1",
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["folder-owner-1"],
    hasExplicitPolicy: true,
    policyId: "folder-policy-successor-deny",
    status: "active",
    createdAt: now,
    updatedAt: now
  })
  await fixture.folderPolicyStore.save({
    policyId: "folder-policy-successor-deny",
    tenantId: "tenant-a",
    folderId: "folder-successor-deny",
    entries: [{ principalType: "user", principalId: "successor-1", permissionLevel: "deny" }],
    createdBy: "folder-owner-1",
    createdAt: now,
    updatedAt: now
  })
  const transferredDocument: DocumentManifest = {
    ...manifest("doc-transferred-successor", "tenant-a"),
    lifecycleStatus: "active",
    metadata: {
      tenantId: "tenant-a",
      ownerUserId: "successor-1",
      scopeType: "folder",
      folderId: "folder-successor-deny"
    }
  }
  const successorUser: AppUser = {
    userId: "successor-1",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }

  const decision = await fixture.service.resolveEffectiveDocumentPermissionDecision(successorUser, transferredDocument)
  assert.equal(decision.permission, "full")
  assert.equal(decision.reasonCode, "administrative_principal")
  await assert.doesNotReject(() => fixture.service.assertDocumentOperation(successorUser, transferredDocument, "share", [
    "principalsActiveSameTenant",
    "administrativePrincipalPreserved",
    "expectedVersionMatched"
  ]))
})

test("document owner full follows mandatory tenant lifecycle and integrity denies", async () => {
  const { service } = await createDocumentPermissionFixture()
  const owner: AppUser = { userId: "owner-1", cognitoGroups: ["CHAT_USER"], accountStatus: "active", tenantId: "tenant-a" }
  const document = { ...manifest("doc-owner", "tenant-a"), metadata: { tenantId: "tenant-a", ownerUserId: "owner-1" } }
  assert.equal(await service.resolveEffectiveDocumentPermission(owner, document), "full")
  assert.equal(await service.resolveEffectiveDocumentPermission({ ...owner, tenantId: "tenant-b" }, document), "none")
  assert.equal(await service.resolveEffectiveDocumentPermission(owner, { ...document, lifecycleStatus: "staging" }), "none")
  assert.equal(await service.resolveEffectiveDocumentPermission(owner, {
    ...document,
    derivedIntegrity: {
      schemaVersion: 1,
      expectedChunkCount: 1,
      expectedMemoryCardCount: 0,
      evidenceRecordCount: 0,
      memoryRecordCount: 0,
      manifestHash: "manifest-hash",
      recordSetHash: "record-set-hash",
      verified: false,
      reasons: ["mismatch"]
    }
  }), "none")
})

test("email aliases do not grant access and cross-tenant ledger entries are ignored", async () => {
  const { service, objectStore } = await createDocumentPermissionFixture()
  const document = manifest("doc-principal", "tenant-a")
  const reader: AppUser = {
    userId: "reader-1",
    email: "reader@example.com",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
  await putLegacyLedger(objectStore, [grant("tenant-a", document.documentId, "reader@example.com", "full")])
  assert.equal(await service.resolveEffectiveDocumentPermission(reader, document), "none")

  await objectStore.putText("documents/share-grants.json", JSON.stringify({
    schemaVersion: 1,
    grants: [
      grant("tenant-a", document.documentId, "reader-1", "readOnly"),
      grant("tenant-b", document.documentId, "someone-else", "full")
    ],
    auditLog: []
  }), "application/json")
  assert.equal(await service.resolveEffectiveDocumentPermission(reader, document), "readOnly")
})

test("versioned document share policy validates principals and persists common audit", async () => {
  const fixture = await createSecureDocumentPermissionFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "tenant-a", status: "active" })
  fixture.directory.set({ userId: "reader-1", tenantId: "tenant-a", status: "active" })
  const document = ownedManifest("doc-versioned", "tenant-a", "owner-1")
  const initial = await fixture.service.getVersionedDocumentSharePolicy(document)
  const updated = await fixture.service.replaceVersionedDocumentSharePolicy(secureOwner(), document, {
    expectedVersion: initial.version,
    grants: [{ principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }],
    reason: "閲覧共有"
  })

  assert.notEqual(updated.version, initial.version)
  assert.equal(updated.grants.length, 1)
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 1)
  assert.equal(await fixture.service.resolveEffectiveDocumentPermission({
    userId: "reader-1",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }, document), "readOnly")
})

test("versioned document share revocation registers tenant-scoped reconciliation targets", async () => {
  const fixture = await createSecureDocumentPermissionFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "tenant-a", status: "active" })
  fixture.directory.set({ userId: "reader-1", tenantId: "tenant-a", status: "active" })
  const document = ownedManifest("doc-share-revoked", "tenant-a", "owner-1")
  const initial = await fixture.service.getVersionedDocumentSharePolicy(document)
  const granted = await fixture.service.replaceVersionedDocumentSharePolicy(secureOwner(), document, {
    expectedVersion: initial.version,
    grants: [{ principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }],
    reason: "temporary access"
  })

  await fixture.service.replaceVersionedDocumentSharePolicy(secureOwner(), document, {
    expectedVersion: granted.version,
    grants: [],
    reason: "access revoked"
  })

  const keys = await fixture.objectStore.listKeys("security/revocation-cleanup/")
  assert.equal(keys.length, 1)
  const manifest = JSON.parse(await fixture.objectStore.getText(keys[0]!)) as {
    tenantId: string
    resourceId: string
    trigger: string
    status: string
    targets: Array<{ scope: string; reference: string }>
  }
  assert.equal(manifest.tenantId, "tenant-a")
  assert.equal(manifest.resourceId, document.documentId)
  assert.equal(manifest.trigger, "share_revoked")
  assert.equal(manifest.status, "cleanup_pending")
  assert.deepEqual(manifest.targets.map((target) => [target.scope, target.reference]).sort(), [
    ["grant", "document:doc-share-revoked:principal:user:reader-1:ceiling:none"],
    ["cache", "document:doc-share-revoked:principal:user:reader-1"],
    ["session", "document:doc-share-revoked:principal:user:reader-1/session"],
    ["queued_run", "document:doc-share-revoked:principal:user:reader-1"]
  ].sort())
})

test("versioned document share policy rejects stale versions without changing state", async () => {
  const fixture = await createSecureDocumentPermissionFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "tenant-a", status: "active" })
  fixture.directory.set({ userId: "reader-1", tenantId: "tenant-a", status: "active" })
  fixture.directory.set({ userId: "reader-2", tenantId: "tenant-a", status: "active" })
  const document = ownedManifest("doc-conflict", "tenant-a", "owner-1")
  const initial = await fixture.service.getVersionedDocumentSharePolicy(document)
  await fixture.service.replaceVersionedDocumentSharePolicy(secureOwner(), document, {
    expectedVersion: initial.version,
    grants: [{ principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }],
    reason: "first writer"
  })
  await assert.rejects(() => fixture.service.replaceVersionedDocumentSharePolicy(secureOwner(), document, {
    expectedVersion: initial.version,
    grants: [{ principalType: "user", principalId: "reader-2", permissionLevel: "full" }],
    reason: "stale writer"
  }), DocumentShareConflictError)

  const current = await fixture.service.getVersionedDocumentSharePolicy(document)
  assert.deepEqual(current.grants.map((item) => item.principalId), ["reader-1"])
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 2)
})

test("versioned document share policy rejects inactive cross-tenant and role principals", async () => {
  const fixture = await createSecureDocumentPermissionFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "tenant-a", status: "active" })
  fixture.directory.set({ userId: "inactive-user", tenantId: "tenant-a", status: "suspended" })
  fixture.directory.set({ userId: "other-tenant-user", tenantId: "tenant-b", status: "active" })
  const document = ownedManifest("doc-principal-validation", "tenant-a", "owner-1")

  for (const principalId of ["missing-user", "inactive-user", "other-tenant-user"]) {
    const current = await fixture.service.getVersionedDocumentSharePolicy(document)
    await assert.rejects(() => fixture.service.replaceVersionedDocumentSharePolicy(secureOwner(), document, {
      expectedVersion: current.version,
      grants: [{ principalType: "user", principalId, permissionLevel: "readOnly" }],
      reason: "invalid principal"
    }), DocumentShareValidationError)
  }

  const current = await fixture.service.getVersionedDocumentSharePolicy(document)
  await assert.rejects(() => fixture.service.replaceVersionedDocumentSharePolicy(secureOwner(), document, {
    expectedVersion: current.version,
    grants: [{ principalType: "group", principalId: "SYSTEM_ADMIN", permissionLevel: "full" }],
    reason: "role namespace"
  }), DocumentShareValidationError)
  assert.deepEqual((await fixture.service.getVersionedDocumentSharePolicy(document)).grants, [])
})

test("direct document grants are isolated by tenant", async () => {
  const { service } = await createDocumentPermissionFixture()
  const actor = manager
  const reader: AppUser = { userId: "user-b", email: "b@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active", tenantId: "tenant-a" }
  const tenantA = manifest("doc-1", "tenant-a")
  const tenantB = manifest("doc-1", "tenant-b")

  await service.replaceDocumentShareGrants(actor, tenantA, [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "tenant A only")
  assert.equal(await service.resolveEffectiveDocumentPermission(reader, tenantA), "readOnly")
  assert.equal(await service.resolveEffectiveDocumentPermission(reader, tenantB), "none")

  await service.replaceDocumentShareGrants(actor, tenantB, [{ principalType: "user", principalId: "user-c", permissionLevel: "full" }], "tenant B only")
  const tenantAShare = await service.getShareInfo(actor, tenantA)
  assert.deepEqual(tenantAShare.directDocumentGrants.map((grant) => grant.tenantId), ["tenant-a"])
  assert.deepEqual(tenantAShare.directDocumentGrants.map((grant) => grant.principalId), ["user-b"])
})

test("legacy global ledger is used only when per-document grant file is missing", async () => {
  const { service, objectStore } = await createDocumentPermissionFixture()
  const doc = manifest("doc-1", "tenant-a")

  await putLegacyLedger(objectStore, [grant("tenant-a", "doc-1", "user-b", "readOnly")])
  const legacyShare = await service.getShareInfo(manager, doc)
  assert.deepEqual(legacyShare.directDocumentGrants.map((item) => [item.principalId, item.permissionLevel]), [["user-b", "readOnly"]])

  await objectStore.putText("documents/share-grants/tenant-a/doc-1.json", JSON.stringify({
    schemaVersion: 1,
    grants: [grant("tenant-a", "doc-1", "user-c", "full")]
  }), "application/json")
  const migratedShare = await service.getShareInfo(manager, doc)
  assert.deepEqual(migratedShare.directDocumentGrants.map((item) => [item.principalId, item.permissionLevel]), [["user-c", "full"]])
})

test("empty per-document grant file suppresses legacy fallback after direct grants are removed", async () => {
  const { service, objectStore } = await createDocumentPermissionFixture()
  const reader: AppUser = { userId: "user-b", email: "b@example.com", cognitoGroups: ["CHAT_USER"], accountStatus: "active", tenantId: "tenant-a" }
  const doc = manifest("doc-1", "tenant-a")

  await putLegacyLedger(objectStore, [grant("tenant-a", "doc-1", "user-b", "readOnly")])
  assert.equal(await service.resolveEffectiveDocumentPermission(reader, doc), "readOnly")

  await service.replaceDocumentShareGrants(manager, doc, [], "共有解除")

  const raw = JSON.parse(await objectStore.getText("documents/share-grants/tenant-a/doc-1.json")) as { grants?: unknown[] }
  assert.deepEqual(raw.grants, [])
  assert.deepEqual((await service.getShareInfo(manager, doc)).directDocumentGrants, [])
  assert.equal(await service.resolveEffectiveDocumentPermission(reader, doc), "none")
})

test("document share ledgers are saved per document without cross-document lost updates", async () => {
  const { service } = await createDocumentPermissionFixture()
  const docA = manifest("doc-a", "tenant-a")
  const docB = manifest("doc-b", "tenant-a")

  await Promise.all([
    service.replaceDocumentShareGrants(manager, docA, [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "doc A share"),
    service.replaceDocumentShareGrants(manager, docB, [{ principalType: "user", principalId: "user-c", permissionLevel: "full" }], "doc B share")
  ])

  const docAShare = await service.getShareInfo(manager, docA)
  const docBShare = await service.getShareInfo(manager, docB)
  assert.deepEqual(docAShare.directDocumentGrants.map((grant) => [grant.documentId, grant.principalId, grant.permissionLevel]), [["doc-a", "user-b", "readOnly"]])
  assert.deepEqual(docBShare.directDocumentGrants.map((grant) => [grant.documentId, grant.principalId, grant.permissionLevel]), [["doc-b", "user-c", "full"]])
})

test("multi-instance concurrent replacements for the same document fail with conflict instead of last-write-wins", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "doc-permission-service-test-"))
  const objectStore = new PausingObjectStore(new LocalObjectStore(dataDir), "documents/share-grants/tenant-a/doc-1.json")
  const serviceA = createDocumentPermissionService(dataDir, objectStore)
  const serviceB = createDocumentPermissionService(dataDir, objectStore)
  const doc = manifest("doc-1", "tenant-a")

  const results = await Promise.allSettled([
    serviceA.replaceDocumentShareGrants(manager, doc, [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "first share"),
    serviceB.replaceDocumentShareGrants(manager, doc, [{ principalType: "user", principalId: "user-c", permissionLevel: "readOnly" }], "second share")
  ])

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  const rejected = results.find((result) => result.status === "rejected")
  assert.ok(rejected)
  assert.ok((rejected as PromiseRejectedResult).reason instanceof DocumentShareConflictError)
  const grants = (await serviceA.getShareInfo(manager, doc)).directDocumentGrants
  assert.equal(grants.length, 1)
})

test("multi-instance audit appends retry conflicts and keep both entries", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "doc-permission-service-test-"))
  const objectStore = new PausingObjectStore(new LocalObjectStore(dataDir), "documents/share-audit/tenant-a/doc-1.json")
  const serviceA = createDocumentPermissionService(dataDir, objectStore)
  const serviceB = createDocumentPermissionService(dataDir, objectStore)

  await Promise.all([
    serviceA.appendDocumentAudit(manager, "document:move", "tenant-a", "doc-1", { folderIds: ["old-a"] }, { folderIds: ["new-a"] }, "整理A"),
    serviceB.appendDocumentAudit(manager, "document:move", "tenant-a", "doc-1", { folderIds: ["old-b"] }, { folderIds: ["new-b"] }, "整理B")
  ])

  const auditLog = await serviceA.listAuditLog()
  assert.equal(auditLog.filter((entry) => entry.documentId === "doc-1" && entry.action === "document:move").length, 2)
  assert.deepEqual(new Set(auditLog.map((entry) => entry.reason)), new Set(["整理A", "整理B"]))
})

test("share grant updates and move audit entries use separate per-document ledgers", async () => {
  const { service } = await createDocumentPermissionFixture()
  const doc = manifest("doc-1", "tenant-a")

  await Promise.all([
    service.replaceDocumentShareGrants(manager, doc, [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "share for review"),
    service.appendDocumentAudit(manager, "document:move", "tenant-a", "doc-1", { folderIds: ["old"] }, { folderIds: ["new"] }, "整理")
  ])

  const shareInfo = await service.getShareInfo(manager, doc)
  const auditLog = await service.listAuditLog()
  assert.deepEqual(shareInfo.directDocumentGrants.map((grant) => grant.principalId), ["user-b"])
  assert.ok(auditLog.some((entry) => entry.documentId === "doc-1" && entry.action === "document:move"))
  assert.ok(auditLog.some((entry) => entry.documentId === "doc-1" && entry.action === "document:share"))
})

async function createDocumentPermissionFixture() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "doc-permission-service-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const documentGroupStore = new LocalDocumentGroupStore(dataDir)
  const folderPolicyStore = new LocalFolderPolicyStore(dataDir)
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const groupMembershipStore = new LocalGroupMembershipStore(dataDir)
  const service = new DocumentPermissionService({
    objectStore,
    documentGroupStore,
    folderPolicyStore,
    userGroupStore,
    groupMembershipStore
  })
  return { objectStore, service, documentGroupStore, folderPolicyStore, userGroupStore, groupMembershipStore }
}

async function createSecureDocumentPermissionFixture() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "secure-doc-permission-service-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const directory = new TestResourcePrincipalDirectory()
  const service = new DocumentPermissionService({
    objectStore,
    documentGroupStore: new LocalDocumentGroupStore(dataDir),
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir),
    resourceUserPrincipalDirectory: directory,
    securityAuditOutbox: new ObjectStoreSecurityMutationAuditOutbox(objectStore)
  })
  return { service, objectStore, directory }
}

class TestResourcePrincipalDirectory implements ResourceUserPrincipalDirectory {
  private readonly users = new Map<string, ResourceUserPrincipal>()

  set(user: ResourceUserPrincipal): void {
    this.users.set(user.userId, user)
  }

  async getUser(userId: string): Promise<ResourceUserPrincipal | undefined> {
    return this.users.get(userId)
  }
}

function secureOwner(): AppUser {
  return {
    userId: "owner-1",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
}

function ownedManifest(documentId: string, tenantId: string, ownerUserId: string): DocumentManifest {
  const value = manifest(documentId, tenantId)
  return { ...value, metadata: { ...(value.metadata ?? {}), tenantId, ownerUserId }, lifecycleStatus: "active" }
}

function createDocumentPermissionService(dataDir: string, objectStore: ObjectStore): DocumentPermissionService {
  return new DocumentPermissionService({
      objectStore,
      documentGroupStore: new LocalDocumentGroupStore(dataDir),
      folderPolicyStore: new LocalFolderPolicyStore(dataDir),
      userGroupStore: new LocalUserGroupStore(dataDir),
      groupMembershipStore: new LocalGroupMembershipStore(dataDir)
  })
}

function manifest(documentId: string, tenantId: string): DocumentManifest {
  return {
    documentId,
    fileName: `${documentId}.pdf`,
    metadata: { tenantId },
    sourceObjectKey: `documents/${tenantId}/${documentId}.pdf`,
    manifestObjectKey: `manifests/${tenantId}-${documentId}.json`,
    vectorKeys: [],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-05-01T00:00:00.000Z"
  }
}

function grant(tenantId: string, documentId: string, principalId: string, permissionLevel: "deny" | "readOnly" | "full") {
  return {
    documentShareGrantId: `grant-${tenantId}-${documentId}-${principalId}`,
    itemType: "documentShareGrant" as const,
    tenantId,
    documentId,
    principalType: "user" as const,
    principalId,
    permissionLevel,
    createdBy: "owner-1",
    reason: "fixture",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  }
}

async function putLegacyLedger(objectStore: ObjectStore, grants: ReturnType<typeof grant>[]): Promise<void> {
  await objectStore.putText("documents/share-grants.json", JSON.stringify({
    schemaVersion: 1,
    grants,
    auditLog: []
  }), "application/json")
}

class PausingObjectStore implements ObjectStore {
  private pendingReads = 0
  private releaseReads: (() => void) | undefined
  private readonly readsReleased = new Promise<void>((resolve) => {
    this.releaseReads = resolve
  })

  constructor(private readonly inner: ObjectStore, private readonly pauseKey: string) {}

  async putText(key: string, text: string, contentType?: string): Promise<void> {
    return this.inner.putText(key, text, contentType)
  }

  async putTextIfVersion(key: string, text: string, expectedVersion: string | undefined, contentType?: string): Promise<void> {
    return this.inner.putTextIfVersion(key, text, expectedVersion, contentType)
  }

  async putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
    return this.inner.putBytes(key, bytes, contentType)
  }

  async getText(key: string): Promise<string> {
    return this.inner.getText(key)
  }

  async getTextWithVersion(key: string): Promise<VersionedText> {
    try {
      return await this.inner.getTextWithVersion(key)
    } catch (err) {
      if (key === this.pauseKey && isMissingObjectErrorForTest(err)) {
        this.pendingReads += 1
        if (this.pendingReads >= 2) this.releaseReads?.()
        await this.readsReleased
      }
      throw err
    }
  }

  async getBytes(key: string): Promise<Buffer> {
    return this.inner.getBytes(key)
  }

  async getObjectSize(key: string): Promise<number> {
    return this.inner.getObjectSize(key)
  }

  async deleteObject(key: string): Promise<void> {
    return this.inner.deleteObject(key)
  }

  async listKeys(prefix: string): Promise<string[]> {
    return this.inner.listKeys(prefix)
  }
}

function isMissingObjectErrorForTest(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT"
}
