import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { AppUser } from "../auth.js"
import type { DocumentManifest } from "../types.js"
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
  cognitoGroups: ["RAG_GROUP_MANAGER"]
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

test("direct document grants are isolated by tenant", async () => {
  const { service } = await createDocumentPermissionFixture()
  const actor = manager
  const reader: AppUser = { userId: "user-b", email: "b@example.com", cognitoGroups: ["CHAT_USER"] }
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

test("concurrent replacements for the same document fail with conflict instead of dropping grants silently", async () => {
  const { service } = await createDocumentPermissionFixture()
  const doc = manifest("doc-1", "tenant-a")

  const results = await Promise.allSettled([
    service.replaceDocumentShareGrants(manager, doc, [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "first share"),
    service.replaceDocumentShareGrants(manager, doc, [{ principalType: "user", principalId: "user-c", permissionLevel: "readOnly" }], "second share")
  ])

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  const rejected = results.find((result) => result.status === "rejected")
  assert.ok(rejected)
  assert.ok((rejected as PromiseRejectedResult).reason instanceof DocumentShareConflictError)
  const grants = (await service.getShareInfo(manager, doc)).directDocumentGrants
  assert.equal(grants.length, 1)
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

async function createDocumentPermissionFixture(): Promise<{ service: DocumentPermissionService; objectStore: LocalObjectStore }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "doc-permission-service-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  return {
    objectStore,
    service: new DocumentPermissionService({
      objectStore,
      documentGroupStore: new LocalDocumentGroupStore(dataDir),
      folderPolicyStore: new LocalFolderPolicyStore(dataDir),
      userGroupStore: new LocalUserGroupStore(dataDir),
      groupMembershipStore: new LocalGroupMembershipStore(dataDir)
    })
  }
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
