import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { folderArchiveCleanupRegistration } from "../folders/folder-archive-service.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type { DocumentGroup } from "../types.js"
import { FolderDeleteAuditAuthoritativeResolver } from "./folder-delete-audit-reconciler.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 folder delete resolver supports only the exact target and operation", () => {
  const resolver = new FolderDeleteAuditAuthoritativeResolver(
    new LocalObjectStore("."),
    { get: async () => undefined }
  )
  assert.equal(resolver.supports(draft()), true)
  assert.equal(resolver.supports({ ...draft(), operation: "move" }), false)
  assert.equal(resolver.supports({ ...draft(), targetType: "document" }), false)
})

test("FR-086 folder delete resolver converges duplicate workers after the exact archive commit", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-delete-audit-"))
  const objects = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objects)
  const prepared = await outbox.prepare(draft())
  await registerFolderCleanup(objects, prepared.intentId)
  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new FolderDeleteAuditAuthoritativeResolver(objects, { get: async () => archivedFolder() })
  ])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, audit(archivedFolder()))
  assert.equal((await outbox.listAll("tenant-1")).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 folder delete resolver keeps durable success and non-success only at their exact states", async () => {
  const objects = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "folder-delete-audit-")))
  await registerFolderCleanup(objects, intent().intentId)
  const archived = new FolderDeleteAuditAuthoritativeResolver(objects, { get: async () => archivedFolder() })
  const success = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "success",
      after: audit(archivedFolder()),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })
  assert.deepEqual(await archived.resolve(success), { result: "success", after: audit(archivedFolder()) })

  const active = new FolderDeleteAuditAuthoritativeResolver(objects, { get: async () => activeFolder() })
  const conflict = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "conflict",
      after: audit(activeFolder()),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })
  assert.deepEqual(await active.resolve(conflict), { result: "conflict", after: audit(activeFolder()) })

  await assert.rejects(
    () => archived.resolve({ ...conflict, requestedCompletion: { ...conflict.requestedCompletion!, after: audit(archivedFolder()) } }),
    /requested result does not match/
  )
  await assert.rejects(
    () => active.resolve({ ...success, requestedCompletion: { ...success.requestedCompletion!, after: audit(activeFolder()) } }),
    /requested result does not match/
  )
})

test("FR-086 folder delete resolver finalizes a durable early failure without reading a target", async () => {
  let reads = 0
  const resolver = new FolderDeleteAuditAuthoritativeResolver(
    new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "folder-delete-audit-"))),
    {
      get: async () => {
        reads += 1
        return undefined
      }
    }
  )
  const early = intent({
    status: "finalization_pending",
    draft: {
      ...draft(),
      before: null,
      proposedAfter: { folderId: "folder-1", expectedVersion: "unknown", requestedStatus: "archived" }
    },
    requestedCompletion: {
      result: "denied",
      after: null,
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(early), { result: "denied", after: null })
  assert.equal(reads, 0)
})

test("FR-086 folder delete resolver rejects before, missing, third, cross-tenant, and corrupt current state", async () => {
  const objects = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "folder-delete-audit-")))
  const active = new FolderDeleteAuditAuthoritativeResolver(objects, { get: async () => activeFolder() })
  await assert.rejects(() => active.resolve(intent()), /no durable non-success result/)

  const missing = new FolderDeleteAuditAuthoritativeResolver(objects, { get: async () => undefined })
  await assert.rejects(() => missing.resolve(intent()), /target is unavailable/)

  const third = new FolderDeleteAuditAuthoritativeResolver(objects, {
    get: async () => ({ ...archivedFolder(), updatedAt: "2026-07-17T00:03:00.000Z" })
  })
  await assert.rejects(() => third.resolve(intent()), /matches neither/)

  const crossed = new FolderDeleteAuditAuthoritativeResolver(objects, {
    get: async () => ({ ...archivedFolder(), tenantId: "tenant-2" })
  })
  await assert.rejects(() => crossed.resolve(intent()), /crossed its identity boundary/)

  const corrupt = new FolderDeleteAuditAuthoritativeResolver(objects, {
    get: async () => ({ ...archivedFolder(), canonicalPath: "not-absolute" })
  })
  await assert.rejects(() => corrupt.resolve(intent()), /crossed its identity boundary/)
})

test("FR-086 folder delete resolver rejects invalid transition, policy, and early proposal evidence", async () => {
  const resolver = new FolderDeleteAuditAuthoritativeResolver(
    new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "folder-delete-audit-"))),
    { get: async () => archivedFolder() }
  )
  await assert.rejects(
    () => resolver.resolve(intent({ draft: { ...draft(), proposedAfter: audit(activeFolder()) } })),
    /transition is invalid/
  )
  await assert.rejects(
    () => resolver.resolve(intent({ draft: { ...draft(), policyVersion: "wrong-policy" } })),
    /policy version is invalid/
  )
  await assert.rejects(
    () => resolver.resolve(intent({
      status: "finalization_pending",
      draft: { ...draft(), before: null, proposedAfter: { folderId: "other", expectedVersion: "v", requestedStatus: "archived" } },
      requestedCompletion: { result: "failed", after: null, requestedAt: "2026-07-17T00:02:00.000Z" }
    })),
    /early audit proposal is invalid/
  )
})

test("FR-086 folder delete resolver retains pending audit until exact cleanup evidence exists", async () => {
  const objects = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "folder-delete-audit-")))
  const resolver = new FolderDeleteAuditAuthoritativeResolver(objects, { get: async () => archivedFolder() })
  const auditIntent = intent()

  await assert.rejects(
    () => resolver.resolve(auditIntent),
    /cleanup repair is not authoritatively registered/
  )

  const registration = folderArchiveCleanupRegistration(auditIntent.intentId, archivedFolder())
  const repairs = new ObjectStoreRevocationCleanupRepairOutbox(objects)
  const prepared = await repairs.prepare({
    expectedBeforeDenyVersion: activeFolder().updatedAt,
    cleanupRegistration: registration,
    preparedAt: archivedFolder().updatedAt
  })
  const committed = await repairs.markDenyCommitted(prepared, archivedFolder().updatedAt)
  await repairs.markCleanupRegistered(committed, archivedFolder().updatedAt)

  await assert.rejects(
    () => resolver.resolve(auditIntent),
    /cleanup ledger is not authoritatively registered/
  )
})

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: "security_mutation_folder_delete_test",
    status: "pending",
    draft: draft(),
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  }
}

function draft() {
  return {
    actorId: "manager-1",
    tenantId: "tenant-1",
    targetType: "folder",
    targetId: "folder-1",
    operation: "delete",
    before: audit(activeFolder()),
    proposedAfter: audit(archivedFolder()),
    reason: "obsolete folder",
    policyVersion: "folder-archive-policy-v1"
  }
}

function activeFolder(): DocumentGroup {
  return {
    groupId: "folder-1",
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "tenant-1",
    adminPrincipalType: "user",
    adminPrincipalId: "manager-1",
    name: "Folder 1",
    normalizedName: "folder 1",
    canonicalPath: "/folder-1",
    normalizedCanonicalPath: "/folder-1",
    adminPathPk: "tenant-1#user#manager-1",
    parentPathPk: "tenant-1#user#manager-1#root",
    ancestorGroupIds: [],
    ownerUserId: "manager-1",
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["manager-1"],
    status: "active",
    createdBy: "manager-1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}

function archivedFolder(): DocumentGroup {
  return {
    ...activeFolder(),
    status: "archived",
    updatedAt: "2026-07-17T00:01:00.000Z"
  }
}

function audit(folder: DocumentGroup) {
  return {
    groupId: folder.groupId,
    tenantId: folder.tenantId,
    parentGroupId: folder.parentGroupId ?? null,
    canonicalPath: folder.canonicalPath ?? null,
    status: folder.status ?? "active",
    updatedAt: folder.updatedAt
  }
}

async function registerFolderCleanup(objects: LocalObjectStore, auditIntentId: string): Promise<void> {
  const archived = archivedFolder()
  const registration = folderArchiveCleanupRegistration(auditIntentId, archived)
  const repairs = new ObjectStoreRevocationCleanupRepairOutbox(objects)
  const prepared = await repairs.prepare({
    expectedBeforeDenyVersion: activeFolder().updatedAt,
    cleanupRegistration: registration,
    preparedAt: archived.updatedAt
  })
  const committed = await repairs.markDenyCommitted(prepared, archived.updatedAt)
  await new ObjectStoreRevocationCleanupCoordinator(objects).register(registration)
  await repairs.markCleanupRegistered(committed, archived.updatedAt)
}
