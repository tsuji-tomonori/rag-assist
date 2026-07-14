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
import type { AppUser } from "../auth.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditOutboxPort } from "../security/security-mutation-audit-outbox.js"
import type { DocumentGroup } from "../types.js"
import { FolderArchiveError, FolderArchiveService } from "./folder-archive-service.js"

test("empty folder archive uses full permission, expected version, deny-first status and common audit", async () => {
  const fixture = await createFixture()
  const folder = group("folder-a")
  await fixture.documentGroups.create(folder)

  const archived = await fixture.service.archive(manager, folder.groupId, {
    expectedVersion: folder.updatedAt,
    reason: "obsolete folder"
  })
  assert.equal(archived.status, "archived")
  assert.equal((await fixture.documentGroups.get("tenant-a", folder.groupId))?.status, "archived")
  const [audit] = await loadAudits(fixture.objectStore)
  assert.equal(audit?.status, "completed")
  assert.equal(audit?.result, "success")
  assert.equal(audit?.draft.reason, "obsolete folder")
})

test("folder archive conflicts on stale version or active descendants without changing state", async () => {
  const fixture = await createFixture()
  const parent = group("parent")
  const child = { ...group("child"), parentGroupId: parent.groupId, ancestorGroupIds: [parent.groupId] }
  await fixture.documentGroups.create(parent)
  await fixture.documentGroups.create(child)

  await assert.rejects(() => fixture.service.archive(manager, parent.groupId, {
    expectedVersion: parent.updatedAt,
    reason: "parent retirement"
  }), (error: unknown) => error instanceof FolderArchiveError && error.result === "conflict")
  assert.equal((await fixture.documentGroups.get("tenant-a", parent.groupId))?.status, "active")

  await assert.rejects(() => fixture.service.archive(manager, child.groupId, {
    expectedVersion: "stale",
    reason: "stale archive"
  }), (error: unknown) => error instanceof FolderArchiveError && error.result === "conflict")
  assert.equal((await fixture.documentGroups.get("tenant-a", child.groupId))?.status, "active")
  const audits = await loadAudits(fixture.objectStore)
  assert.deepEqual(audits.map((audit) => audit.result).sort(), ["conflict", "conflict"])
})

test("missing folder denial is audited and audit prepare failure prevents archive", async () => {
  const fixture = await createFixture()
  await assert.rejects(() => fixture.service.archive(manager, "missing", {
    expectedVersion: "unknown",
    reason: "missing folder attempt"
  }), (error: unknown) => error instanceof FolderArchiveError && error.result === "denied")
  const [denied] = await loadAudits(fixture.objectStore)
  assert.equal(denied?.result, "denied")
  assert.equal(denied?.draft.targetId, "missing")

  const unavailableAudit: SecurityMutationAuditOutboxPort = {
    prepare: async () => { throw new Error("audit unavailable") },
    complete: async () => { throw new Error("audit unavailable") }
  }
  const blocked = await createFixture(unavailableAudit)
  const folder = group("audit-blocked")
  await blocked.documentGroups.create(folder)
  await assert.rejects(() => blocked.service.archive(manager, folder.groupId, {
    expectedVersion: folder.updatedAt,
    reason: "audit boundary"
  }), /audit unavailable/)
  assert.equal((await blocked.documentGroups.get("tenant-a", folder.groupId))?.status, "active")
})

const manager: AppUser = {
  userId: "manager-1",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "tenant-a"
}

async function createFixture(auditOutbox?: SecurityMutationAuditOutboxPort) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-archive-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const documentGroups = new LocalDocumentGroupStore(dataDir)
  const service = new FolderArchiveService({
    objectStore,
    documentGroupStore: documentGroups,
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir),
    securityAuditOutbox: auditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(objectStore),
    legacyGlobalDocumentArtifacts: false
  }, () => new Date("2026-07-11T00:00:01.000Z"))
  return { objectStore, documentGroups, service }
}

function group(groupId: string): DocumentGroup {
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "tenant-a",
    adminPrincipalType: "user",
    adminPrincipalId: manager.userId,
    name: groupId,
    normalizedName: groupId,
    canonicalPath: `/${groupId}`,
    normalizedCanonicalPath: `/${groupId}`,
    adminPathPk: "tenant-a#user#manager-1",
    parentPathPk: "tenant-a#user#manager-1#root",
    ancestorGroupIds: [],
    ownerUserId: manager.userId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [manager.userId],
    status: "active",
    createdBy: manager.userId,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

async function loadAudits(objectStore: LocalObjectStore) {
  const keys = await objectStore.listKeys("security-audit/intents/")
  return Promise.all(keys.map(async (key) => JSON.parse(await objectStore.getText(key)) as {
    status: string
    result?: string
    draft: { targetId: string; reason: string }
  }))
}
