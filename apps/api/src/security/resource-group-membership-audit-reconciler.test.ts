import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { GroupMembership } from "../types.js"
import { ResourceGroupMembershipAuditAuthoritativeResolver } from "./resource-group-membership-audit-reconciler.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 membership resolver completes a pending success from tenant-scoped authoritative state", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "membership-audit-reconciler-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const before = [membership("user-old", "readOnly", "2026-07-17T00:00:00.000Z")]
  const after = [
    membership("user-new", "full", "2026-07-17T00:01:00.000Z"),
    membership("user-old", "readOnly", "2026-07-17T00:01:00.000Z")
  ]
  const intent = await outbox.prepare({
    actorId: "admin-1",
    tenantId: "tenant-1",
    targetType: "resourceGroup",
    targetId: "group-1",
    operation: "membership.replace",
    before: audit(before),
    proposedAfter: audit(after),
    reason: "担当者追加",
    policyVersion: "resource-group-membership-policy-v1"
  })
  const resolver = new ResourceGroupMembershipAuditAuthoritativeResolver({
    getVersionedGroupState: async () => ({ memberships: [...after].reverse(), version: "v2" })
  })
  const reconciler = new SecurityMutationAuditReconciler(outbox, [resolver])
  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", intent.intentId)
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, audit([...after].reverse()).sort(compareAudit))
})

test("FR-086 membership resolver honors a durable non-success result only when current state confirms it", async () => {
  const before = [membership("user-old", "readOnly", "2026-07-17T00:00:00.000Z")]
  const base = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "conflict",
      after: audit(before),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })
  const resolver = new ResourceGroupMembershipAuditAuthoritativeResolver({
    getVersionedGroupState: async () => ({ memberships: before, version: "v1" })
  })

  assert.deepEqual(await resolver.resolve(base), {
    result: "conflict",
    after: audit(before)
  })

  const changedResolver = new ResourceGroupMembershipAuditAuthoritativeResolver({
    getVersionedGroupState: async () => ({
      memberships: [membership("user-other", "full", "2026-07-17T00:03:00.000Z")],
      version: "v3"
    })
  })
  await assert.rejects(() => changedResolver.resolve(base), /does not confirm/)
})

test("FR-086 membership resolver finalizes a durable early failure without inventing target state", async () => {
  let reads = 0
  const resolver = new ResourceGroupMembershipAuditAuthoritativeResolver({
    getVersionedGroupState: async () => {
      reads += 1
      throw new Error("must not read a target that lookup already proved absent")
    }
  })
  const earlyFailure = intent({
    status: "finalization_pending",
    draft: {
      ...intent().draft,
      before: null
    },
    requestedCompletion: {
      result: "denied",
      after: null,
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(earlyFailure), { result: "denied", after: null })
  assert.equal(reads, 0)
})

test("FR-086 membership resolver rejects cross-tenant records and ambiguous pending before-state", async () => {
  const before = [membership("user-old", "readOnly", "2026-07-17T00:00:00.000Z")]
  const resolver = new ResourceGroupMembershipAuditAuthoritativeResolver({
    getVersionedGroupState: async () => ({ memberships: before, version: "v1" })
  })
  await assert.rejects(() => resolver.resolve(intent()), /no durable non-success result/)

  const crossTenantResolver = new ResourceGroupMembershipAuditAuthoritativeResolver({
    getVersionedGroupState: async () => ({
      memberships: [{ ...before[0]!, tenantId: "tenant-2" }],
      version: "v1"
    })
  })
  await assert.rejects(() => crossTenantResolver.resolve(intent()), /crossed its identity boundary/)

  const corruptResolver = new ResourceGroupMembershipAuditAuthoritativeResolver({
    getVersionedGroupState: async () => ({
      memberships: [{ ...before[0]!, permissionLevel: "owner" as GroupMembership["permissionLevel"] }],
      version: "v1"
    })
  })
  await assert.rejects(() => corruptResolver.resolve(intent()), /crossed its identity boundary/)
})

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  const before = [membership("user-old", "readOnly", "2026-07-17T00:00:00.000Z")]
  const after = [membership("user-new", "full", "2026-07-17T00:01:00.000Z")]
  return {
    schemaVersion: 1,
    intentId: "security_mutation_test",
    status: "pending",
    draft: {
      actorId: "admin-1",
      tenantId: "tenant-1",
      targetType: "resourceGroup",
      targetId: "group-1",
      operation: "membership.replace",
      before: audit(before),
      proposedAfter: audit(after),
      reason: "担当者更新",
      policyVersion: "resource-group-membership-policy-v1"
    },
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  }
}

function membership(
  memberId: string,
  permissionLevel: GroupMembership["permissionLevel"],
  updatedAt: string
): GroupMembership {
  return {
    tenantId: "tenant-1",
    groupId: "group-1",
    memberType: "user",
    memberId,
    permissionLevel,
    source: "manual",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt
  }
}

function audit(memberships: readonly GroupMembership[]) {
  return memberships.map((entry) => ({
    tenantId: entry.tenantId,
    groupId: entry.groupId,
    memberType: entry.memberType,
    memberId: entry.memberId,
    permissionLevel: entry.permissionLevel,
    source: entry.source,
    updatedAt: entry.updatedAt
  }))
}

function compareAudit(left: ReturnType<typeof audit>[number], right: ReturnType<typeof audit>[number]): number {
  return `${left.memberType}\u0000${left.memberId}`.localeCompare(`${right.memberType}\u0000${right.memberId}`)
}
