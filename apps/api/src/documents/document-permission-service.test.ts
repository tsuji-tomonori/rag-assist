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
  const reader: AppUser = { userId: "user-b", email: "b@example.com", cognitoGroups: ["CHAT_USER"] }
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

async function createDocumentPermissionFixture(): Promise<{ service: DocumentPermissionService; objectStore: LocalObjectStore }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "doc-permission-service-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  return { objectStore, service: createDocumentPermissionService(dataDir, objectStore) }
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

function grant(tenantId: string, documentId: string, principalId: string, permissionLevel: "readOnly" | "full") {
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
