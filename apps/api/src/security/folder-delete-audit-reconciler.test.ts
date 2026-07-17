import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { DocumentGroup } from "../types.js"
import { FolderDeleteAuditAuthoritativeResolver } from "./folder-delete-audit-reconciler.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 folder delete resolver supports only the exact target and operation", () => {
  const resolver = new FolderDeleteAuditAuthoritativeResolver({ get: async () => undefined })
  assert.equal(resolver.supports(draft()), true)
  assert.equal(resolver.supports({ ...draft(), operation: "move" }), false)
  assert.equal(resolver.supports({ ...draft(), targetType: "document" }), false)
})

test("FR-086 folder delete resolver converges duplicate workers after the exact archive commit", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-delete-audit-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const prepared = await outbox.prepare(draft())
  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new FolderDeleteAuditAuthoritativeResolver({ get: async () => archivedFolder() })
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
  const archived = new FolderDeleteAuditAuthoritativeResolver({ get: async () => archivedFolder() })
  const success = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "success",
      after: audit(archivedFolder()),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })
  assert.deepEqual(await archived.resolve(success), { result: "success", after: audit(archivedFolder()) })

  const active = new FolderDeleteAuditAuthoritativeResolver({ get: async () => activeFolder() })
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
  const resolver = new FolderDeleteAuditAuthoritativeResolver({
    get: async () => {
      reads += 1
      return undefined
    }
  })
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
  const active = new FolderDeleteAuditAuthoritativeResolver({ get: async () => activeFolder() })
  await assert.rejects(() => active.resolve(intent()), /no durable non-success result/)

  const missing = new FolderDeleteAuditAuthoritativeResolver({ get: async () => undefined })
  await assert.rejects(() => missing.resolve(intent()), /target is unavailable/)

  const third = new FolderDeleteAuditAuthoritativeResolver({
    get: async () => ({ ...archivedFolder(), updatedAt: "2026-07-17T00:03:00.000Z" })
  })
  await assert.rejects(() => third.resolve(intent()), /matches neither/)

  const crossed = new FolderDeleteAuditAuthoritativeResolver({
    get: async () => ({ ...archivedFolder(), tenantId: "tenant-2" })
  })
  await assert.rejects(() => crossed.resolve(intent()), /crossed its identity boundary/)

  const corrupt = new FolderDeleteAuditAuthoritativeResolver({
    get: async () => ({ ...archivedFolder(), canonicalPath: "not-absolute" })
  })
  await assert.rejects(() => corrupt.resolve(intent()), /crossed its identity boundary/)
})

test("FR-086 folder delete resolver rejects invalid transition, policy, and early proposal evidence", async () => {
  const resolver = new FolderDeleteAuditAuthoritativeResolver({ get: async () => archivedFolder() })
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
