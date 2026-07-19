import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { GroupMembership, UserGroup } from "../types.js"
import { ResourceGroupCreateAuditAuthoritativeResolver } from "./resource-group-create-audit-reconciler.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 create resolver completes one audit after the lifecycle proves group and owner membership", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "group-create-audit-reconciler-"))
  const objects = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objects)
  const prepared = await outbox.prepare(draft())
  await objects.putText(markerKey(), JSON.stringify(marker({ auditIntentId: prepared.intentId })))
  const resolver = resolverFixture(objects)
  const reconciler = new SecurityMutationAuditReconciler(outbox, [resolver])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, audit(group()))
  assert.equal((await outbox.listAll("tenant-1")).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 create resolver rejects partial lifecycle stages and incomplete membership", async () => {
  const partialObjects = objectReader(marker({ status: "group_created" }))
  await assert.rejects(() => resolverFixture(partialObjects).resolve(intent()), /not authoritatively complete/)

  const missingMembership = new ResourceGroupCreateAuditAuthoritativeResolver(
    objectReader(marker()),
    { get: async () => group() },
    { getVersionedGroupState: async () => ({ memberships: [], version: "empty" }) }
  )
  await assert.rejects(() => missingMembership.resolve(intent()), /membership is incomplete/)
})

test("FR-086 create resolver rejects mismatched audit identity, tenant state, and unexpected members", async () => {
  await assert.rejects(
    () => resolverFixture(objectReader(marker({ auditIntentId: "other-audit" }))).resolve(intent()),
    /crossed its identity boundary/
  )
  await assert.rejects(
    () => resolverFixture(objectReader(marker({ group: { ...group(), createdBy: "other-admin" } }))).resolve(intent()),
    /owner membership is invalid/
  )

  const crossed = new ResourceGroupCreateAuditAuthoritativeResolver(
    objectReader(marker()),
    { get: async () => ({ ...group(), tenantId: "tenant-2" }) },
    { getVersionedGroupState: async () => ({ memberships: [membership()], version: "v1" }) }
  )
  await assert.rejects(() => crossed.resolve(intent()), /crossed its identity boundary/)

  const extraMember = new ResourceGroupCreateAuditAuthoritativeResolver(
    objectReader(marker()),
    { get: async () => group() },
    {
      getVersionedGroupState: async () => ({
        memberships: [membership(), { ...membership(), memberId: "user-2", source: "manual" }],
        version: "v2"
      })
    }
  )
  await assert.rejects(() => extraMember.resolve(intent()), /membership is incomplete or unexpected/)
})

test("FR-086 create resolver finalizes a durable early failure without reading lifecycle or target state", async () => {
  let reads = 0
  const resolver = new ResourceGroupCreateAuditAuthoritativeResolver(
    { getText: async () => { reads += 1; throw new Error("must not read") } },
    { get: async () => { reads += 1; return undefined } },
    { getVersionedGroupState: async () => { reads += 1; throw new Error("must not read") } }
  )
  const early = intent({
    status: "finalization_pending",
    requestedCompletion: { result: "denied", after: null, requestedAt: "2026-07-17T00:02:00.000Z" }
  })

  assert.deepEqual(await resolver.resolve(early), { result: "denied", after: null })
  assert.equal(reads, 0)
})

function resolverFixture(objects: { getText(key: string): Promise<string> }) {
  return new ResourceGroupCreateAuditAuthoritativeResolver(
    objects,
    { get: async () => group() },
    { getVersionedGroupState: async () => ({ memberships: [membership()], version: "v1" }) }
  )
}

function objectReader(value: unknown): { getText(key: string): Promise<string> } {
  return { getText: async () => JSON.stringify(value) }
}

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: "security_mutation_group_create_test",
    status: "pending",
    draft: draft(),
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  }
}

function draft() {
  return {
    actorId: "admin-1",
    tenantId: "tenant-1",
    targetType: "resourceGroup",
    targetId: "group-1",
    operation: "create",
    before: null,
    proposedAfter: audit(group()),
    reason: "グループ作成",
    policyVersion: "resource-group-lifecycle-policy-v1"
  }
}

function marker(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    kind: "create",
    status: "membership_created",
    fingerprint: "fingerprint-1",
    actorId: "admin-1",
    tenantId: "tenant-1",
    group: group(),
    membership: membership(),
    auditIntentId: "security_mutation_group_create_test",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:01:00.000Z",
    ...overrides
  }
}

function group(): UserGroup {
  return {
    groupId: "group-1",
    itemType: "userGroup",
    tenantId: "tenant-1",
    name: "新規グループ",
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy: "admin-1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}

function membership(): GroupMembership {
  return {
    tenantId: "tenant-1",
    groupId: "group-1",
    memberType: "user",
    memberId: "admin-1",
    permissionLevel: "full",
    source: "system",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
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

function markerKey(): string {
  return "security/resource-group-lifecycle/create/tenant-1/group-1.json"
}
