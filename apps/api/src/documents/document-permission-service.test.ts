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
  assert.throws(() => validateDocumentShareRequest([], ""), /reason/)
  assert.doesNotThrow(() => validateDocumentShareRequest([{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "確認依頼"))
  assert.throws(() => validateDocumentMoveRequest({ reason: "整理" }), /destinationFolderId/)
  assert.throws(() => validateDocumentMoveRequest({ destinationFolderId: "folder-1" }), /reason/)
})

test("direct document grants are isolated by tenant", async () => {
  const service = await createDocumentPermissionService()
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

async function createDocumentPermissionService(): Promise<DocumentPermissionService> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "doc-permission-service-test-"))
  return new DocumentPermissionService({
    objectStore: new LocalObjectStore(dataDir),
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
