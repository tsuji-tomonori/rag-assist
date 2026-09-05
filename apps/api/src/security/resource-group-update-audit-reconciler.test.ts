import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { UserGroup } from "../types.js"
import { ResourceGroupUpdateAuditAuthoritativeResolver } from "./resource-group-update-audit-reconciler.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 update resolver completes one audit event after duplicate workers observe the proposed group", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "group-update-audit-reconciler-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const before = group({ name: "旧名称", updatedAt: "2026-07-17T00:00:00.000Z" })
  const after = group({ name: "新名称", updatedAt: "2026-07-17T00:01:00.000Z" })
  const prepared = await outbox.prepare(draft(before, after))
  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new ResourceGroupUpdateAuditAuthoritativeResolver({ get: async () => after })
  ])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, audit(after))
  assert.equal((await outbox.listAll("tenant-1")).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 update resolver honors durable non-success only when current state confirms it", async () => {
  const before = group({ name: "旧名称", updatedAt: "2026-07-17T00:00:00.000Z" })
  const resolver = new ResourceGroupUpdateAuditAuthoritativeResolver({ get: async () => before })
  const durable = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "conflict",
      after: audit(before),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(durable), { result: "conflict", after: audit(before) })

  const changed = new ResourceGroupUpdateAuditAuthoritativeResolver({
    get: async () => group({ name: "第三の名称", updatedAt: "2026-07-17T00:03:00.000Z" })
  })
  await assert.rejects(() => changed.resolve(durable), /does not confirm/)
})

test("FR-086 update resolver finalizes durable early failure without reading a missing target", async () => {
  let reads = 0
  const resolver = new ResourceGroupUpdateAuditAuthoritativeResolver({
    get: async () => {
      reads += 1
      return undefined
    }
  })
  const earlyFailure = intent({
    status: "finalization_pending",
    draft: { ...intent().draft, before: null },
    requestedCompletion: {
      result: "denied",
      after: null,
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(earlyFailure), { result: "denied", after: null })
  assert.equal(reads, 0)
})

test("FR-086 update resolver rejects missing, ambiguous, cross-tenant, and corrupt authoritative state", async () => {
  const before = group({ name: "旧名称", updatedAt: "2026-07-17T00:00:00.000Z" })
  const ambiguous = new ResourceGroupUpdateAuditAuthoritativeResolver({ get: async () => before })
  await assert.rejects(() => ambiguous.resolve(intent()), /no durable non-success result/)

  const missing = new ResourceGroupUpdateAuditAuthoritativeResolver({ get: async () => undefined })
  await assert.rejects(() => missing.resolve(intent()), /target is unavailable/)

  const crossed = new ResourceGroupUpdateAuditAuthoritativeResolver({
    get: async () => ({ ...before, tenantId: "tenant-2" })
  })
  await assert.rejects(() => crossed.resolve(intent()), /crossed its identity boundary/)

  const corrupt = new ResourceGroupUpdateAuditAuthoritativeResolver({
    get: async () => ({ ...before, type: "unknown" as UserGroup["type"] })
  })
  await assert.rejects(() => corrupt.resolve(intent()), /crossed its identity boundary/)
})

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  const before = group({ name: "旧名称", updatedAt: "2026-07-17T00:00:00.000Z" })
  const after = group({ name: "新名称", updatedAt: "2026-07-17T00:01:00.000Z" })
  return {
    schemaVersion: 1,
    intentId: "security_mutation_group_update_test",
    status: "pending",
    draft: draft(before, after),
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  }
}

function draft(before: UserGroup, after: UserGroup) {
  return {
    actorId: "admin-1",
    tenantId: "tenant-1",
    targetType: "resourceGroup",
    targetId: "group-1",
    operation: "update",
    before: audit(before),
    proposedAfter: audit(after),
    reason: "名称更新",
    policyVersion: "resource-group-lifecycle-policy-v1"
  }
}

function group(overrides: Partial<UserGroup> = {}): UserGroup {
  return {
    groupId: "group-1",
    itemType: "userGroup",
    tenantId: "tenant-1",
    name: "グループ",
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy: "admin-1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  }
}

function audit(value: UserGroup) {
  return {
    groupId: value.groupId,
    tenantId: value.tenantId,
    name: value.name,
    type: value.type,
    status: value.status,
    createdBy: value.createdBy,
    updatedAt: value.updatedAt
  }
}
