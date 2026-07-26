import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { AppUser } from "../auth.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditOutboxPort } from "../security/security-mutation-audit-outbox.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
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
  const operationId = `folder-archive:${audit?.intentId}`
  const repair = await new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore)
    .get("tenant-a", "folder", folder.groupId, operationId)
  assert.equal(repair?.status, "cleanup_registered")
  assert.equal(repair?.expectedBeforeDenyVersion, folder.updatedAt)
  assert.equal(repair?.cleanupRegistration.authoritativeDenyVersion, `folder:${archived.updatedAt}`)
  assert.equal(repair?.cleanupRegistration.authoritativeDenyConfirmedAt, archived.updatedAt)
  assert.deepEqual(repair?.cleanupRegistration.knownTargets, [
    { scope: "grant", reference: `folder:${folder.groupId}` },
    { scope: "cache", reference: `folder:${folder.groupId}` },
    { scope: "session", reference: `folder:${folder.groupId}/session` },
    { scope: "queued_run", reference: `folder:${folder.groupId}` },
    { scope: "evaluation_artifact", reference: `folder:${folder.groupId}` }
  ])
  const cleanup = await new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
    .get("tenant-a", operationId)
  assert.equal(cleanup?.status, "cleanup_pending")
  assert.equal(cleanup?.tenantId, "tenant-a")
  assert.equal(cleanup?.resourceId, folder.groupId)
  assert.equal(cleanup?.trigger, "archived")
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
  const blocked = await createFixture({ auditOutbox: unavailableAudit })
  const folder = group("audit-blocked")
  await blocked.documentGroups.create(folder)
  await assert.rejects(() => blocked.service.archive(manager, folder.groupId, {
    expectedVersion: folder.updatedAt,
    reason: "audit boundary"
  }), /audit unavailable/)
  assert.equal((await blocked.documentGroups.get("tenant-a", folder.groupId))?.status, "active")
})

test("folder archive fails closed before CAS when the cleanup repair cannot be persisted", async () => {
  const fixture = await createFixture({
    cleanupRepairOutbox: {
      prepare: async () => { throw new Error("repair unavailable") },
      markDenyCommitted: async () => { throw new Error("unexpected") },
      markCleanupRegistered: async () => { throw new Error("unexpected") },
      markAbandoned: async () => { throw new Error("unexpected") }
    }
  })
  const folder = group("repair-blocked")
  await fixture.documentGroups.create(folder)

  await assert.rejects(() => fixture.service.archive(manager, folder.groupId, {
    expectedVersion: folder.updatedAt,
    reason: "repair boundary"
  }), (error: unknown) => error instanceof FolderArchiveError && error.result === "failed")

  assert.equal((await fixture.documentGroups.get("tenant-a", folder.groupId))?.status, "active")
  const [audit] = await loadAudits(fixture.objectStore)
  assert.equal(audit?.status, "completed")
  assert.equal(audit?.result, "failed")
})

test("folder archive abandons its repair when the archive CAS fails", async () => {
  const fixture = await createFixture({
    wrapDocumentGroups: (inner) => new DelegatingDocumentGroupStore(inner, async () => {
      const error = new Error("changed before archive") as Error & { code?: string }
      error.code = "PRECONDITION_FAILED"
      throw error
    })
  })
  const folder = group("cas-conflict")
  await fixture.documentGroups.create(folder)

  await assert.rejects(() => fixture.service.archive(manager, folder.groupId, {
    expectedVersion: folder.updatedAt,
    reason: "CAS conflict"
  }), (error: unknown) => error instanceof FolderArchiveError && error.result === "conflict")

  assert.equal((await fixture.documentGroups.get("tenant-a", folder.groupId))?.status, "active")
  const [audit] = await loadAudits(fixture.objectStore)
  assert.equal(audit?.result, "conflict")
  const repair = await new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore)
    .get("tenant-a", "folder", folder.groupId, `folder-archive:${audit?.intentId}`)
  assert.equal(repair?.status, "abandoned")
})

test("folder archive retains a repair and pending audit when cleanup ledger registration fails after CAS", async () => {
  const fixture = await createFixture({
    cleanupCoordinator: { register: async () => { throw new Error("ledger unavailable") } }
  })
  const folder = group("ledger-deferred")
  await fixture.documentGroups.create(folder)

  await assert.rejects(() => fixture.service.archive(manager, folder.groupId, {
    expectedVersion: folder.updatedAt,
    reason: "ledger recovery"
  }), (error: unknown) => error instanceof FolderArchiveError && error.result === "failed")

  const archived = await fixture.documentGroups.get("tenant-a", folder.groupId)
  assert.equal(archived?.status, "archived")
  const [audit] = await loadAudits(fixture.objectStore)
  assert.equal(audit?.status, "pending")
  assert.equal(audit?.result, undefined)
  const repair = await new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore)
    .get("tenant-a", "folder", folder.groupId, `folder-archive:${audit?.intentId}`)
  assert.equal(repair?.status, "deny_committed")
  assert.equal(
    await new ObjectStoreRevocationCleanupCoordinator(fixture.objectStore)
      .get("tenant-a", `folder-archive:${audit?.intentId}`),
    undefined
  )
})

const manager: AppUser = {
  userId: "manager-1",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "tenant-a"
}

async function createFixture(options: Readonly<{
  auditOutbox?: SecurityMutationAuditOutboxPort
  cleanupCoordinator?: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
  cleanupRepairOutbox?: Pick<
    ObjectStoreRevocationCleanupRepairOutbox,
    "prepare" | "markDenyCommitted" | "markCleanupRegistered" | "markAbandoned"
  >
  wrapDocumentGroups?: (inner: LocalDocumentGroupStore) => DocumentGroupStore
}> = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-archive-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const documentGroups = new LocalDocumentGroupStore(dataDir)
  const serviceDocumentGroups = options.wrapDocumentGroups?.(documentGroups) ?? documentGroups
  const service = new FolderArchiveService({
    objectStore,
    documentGroupStore: serviceDocumentGroups,
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir),
    securityAuditOutbox: options.auditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(objectStore),
    legacyGlobalDocumentArtifacts: false,
    cleanupCoordinator: options.cleanupCoordinator,
    cleanupRepairOutbox: options.cleanupRepairOutbox
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
    intentId: string
    status: string
    result?: string
    draft: { targetId: string; reason: string }
  }))
}

class DelegatingDocumentGroupStore implements DocumentGroupStore {
  constructor(
    private readonly inner: DocumentGroupStore,
    private readonly beforeUpdateWithPathLocks: () => Promise<void>
  ) {}

  list(...args: Parameters<DocumentGroupStore["list"]>) { return this.inner.list(...args) }
  get(...args: Parameters<DocumentGroupStore["get"]>) { return this.inner.get(...args) }
  create(...args: Parameters<DocumentGroupStore["create"]>) { return this.inner.create(...args) }
  createWithPathLock(...args: Parameters<DocumentGroupStore["createWithPathLock"]>) { return this.inner.createWithPathLock(...args) }
  update(...args: Parameters<DocumentGroupStore["update"]>) { return this.inner.update(...args) }
  findByCanonicalPath(...args: Parameters<DocumentGroupStore["findByCanonicalPath"]>) { return this.inner.findByCanonicalPath(...args) }
  listByAdminPath(...args: Parameters<DocumentGroupStore["listByAdminPath"]>) { return this.inner.listByAdminPath(...args) }
  async updateWithPathLocks(...args: Parameters<DocumentGroupStore["updateWithPathLocks"]>) {
    await this.beforeUpdateWithPathLocks()
    return this.inner.updateWithPathLocks(...args)
  }
}
