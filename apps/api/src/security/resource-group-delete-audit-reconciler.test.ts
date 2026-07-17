import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { groupMembershipStateVersion } from "../adapters/group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { GroupMembership, UserGroup } from "../types.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import { ResourceGroupDeleteAuditAuthoritativeResolver } from "./resource-group-delete-audit-reconciler.js"
import {
  archivedGroupCleanupRegistration,
  membershipCleanupRegistration,
  type DeleteLifecycleIntent
} from "./resource-group-lifecycle-service.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 delete resolver completes one audit after archive, membership deny, and both cleanup registrations", async () => {
  const fixture = await createFixture()
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(fixture.objects)
  const prepared = await outbox.prepare(draft())
  const lifecycle = marker({ auditIntentId: prepared.intentId })
  await fixture.objects.putText(markerKey(), JSON.stringify(lifecycle))
  await registerCleanup(fixture.objects, lifecycle, membershipCleanupRegistration(lifecycle), lifecycle.membershipVersion)
  await registerCleanup(fixture.objects, lifecycle, archivedGroupCleanupRegistration(lifecycle), lifecycle.group.updatedAt)
  const reconciler = new SecurityMutationAuditReconciler(outbox, [fixture.resolver])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, audit(archivedGroup()))
  assert.equal((await outbox.listAll("tenant-1")).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 delete resolver rejects partial lifecycle stages and missing cleanup evidence", async () => {
  const partial = await createFixture()
  await partial.objects.putText(markerKey(), JSON.stringify(marker({ status: "memberships_cleared" })))
  await assert.rejects(() => partial.resolver.resolve(intent()), /not authoritatively complete/)

  const missingArchiveCleanup = await createFixture()
  const lifecycle = marker()
  await missingArchiveCleanup.objects.putText(markerKey(), JSON.stringify(lifecycle))
  await registerCleanup(
    missingArchiveCleanup.objects,
    lifecycle,
    membershipCleanupRegistration(lifecycle),
    lifecycle.membershipVersion
  )
  await assert.rejects(
    () => missingArchiveCleanup.resolver.resolve(intent()),
    /cleanup repair is not authoritatively registered/
  )
})

test("FR-086 delete resolver rejects mismatched audit, authoritative group, membership, and cleanup identity", async () => {
  const crossedAudit = await createFixture()
  await crossedAudit.objects.putText(markerKey(), JSON.stringify(marker({ auditIntentId: "other-audit" })))
  await assert.rejects(() => crossedAudit.resolver.resolve(intent()), /crossed its identity boundary/)

  const crossedTenant = await createFixture()
  await crossedTenant.objects.putText(markerKey(), JSON.stringify(marker({
    group: { ...activeGroup(), tenantId: "tenant-2" },
    archivedGroup: { ...archivedGroup(), tenantId: "tenant-2" }
  })))
  await assert.rejects(() => crossedTenant.resolver.resolve(intent()), /crossed its identity boundary/)

  const active = await createFixture({ currentGroup: activeGroup() })
  await active.objects.putText(markerKey(), JSON.stringify(marker()))
  await assert.rejects(() => active.resolver.resolve(intent()), /does not match its lifecycle intent/)

  const memberships = await createFixture({ currentMemberships: [membership()] })
  await memberships.objects.putText(markerKey(), JSON.stringify(marker()))
  await assert.rejects(() => memberships.resolver.resolve(intent()), /membership deny is incomplete/)

  const badCleanup = await createFixture()
  const lifecycle = marker()
  await badCleanup.objects.putText(markerKey(), JSON.stringify(lifecycle))
  await registerCleanup(
    badCleanup.objects,
    lifecycle,
    { ...membershipCleanupRegistration(lifecycle), authoritativeDenyVersion: "membership:wrong" },
    lifecycle.membershipVersion
  )
  await assert.rejects(
    () => badCleanup.resolver.resolve(intent()),
    /cleanup repair is not authoritatively registered/
  )
})

test("FR-086 delete resolver supports an empty original membership set and rejects a corrupt cleanup ledger", async () => {
  const empty = await createFixture()
  const emptyLifecycle = marker({
    memberships: [],
    membershipVersion: groupMembershipStateVersion([])
  })
  await empty.objects.putText(markerKey(), JSON.stringify(emptyLifecycle))
  await registerCleanup(
    empty.objects,
    emptyLifecycle,
    archivedGroupCleanupRegistration(emptyLifecycle),
    emptyLifecycle.group.updatedAt
  )
  assert.deepEqual(await empty.resolver.resolve(intent()), { result: "success", after: audit(archivedGroup()) })

  const corrupt = await createFixture()
  const lifecycle = marker()
  await corrupt.objects.putText(markerKey(), JSON.stringify(lifecycle))
  await registerCleanup(corrupt.objects, lifecycle, membershipCleanupRegistration(lifecycle), lifecycle.membershipVersion)
  await registerCleanup(corrupt.objects, lifecycle, archivedGroupCleanupRegistration(lifecycle), lifecycle.group.updatedAt)
  const manifestKeys = await corrupt.objects.listKeys("security/revocation-cleanup/")
  for (const key of manifestKeys) {
    const value = JSON.parse(await corrupt.objects.getText(key)) as { operationId?: string; tenantId?: string }
    if (value.operationId === `resource-group-archive:${lifecycle.auditIntentId}`) {
      await corrupt.objects.putText(key, JSON.stringify({ ...value, tenantId: "tenant-2" }))
    }
  }
  await assert.rejects(() => corrupt.resolver.resolve(intent()), /cleanup ledger identity is invalid/)
})

test("FR-086 delete resolver confirms a durable terminal failure without cleanup or mutation", async () => {
  const fixture = await createFixture({ currentGroup: activeGroup(), currentMemberships: [membership()] })
  await fixture.objects.putText(markerKey(), JSON.stringify(marker({ status: "failed" })))
  const durable = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "conflict",
      after: audit(activeGroup()),
      requestedAt: "2026-07-17T00:03:00.000Z"
    }
  })

  assert.deepEqual(await fixture.resolver.resolve(durable), {
    result: "conflict",
    after: audit(activeGroup())
  })
})

test("FR-086 delete resolver finalizes a durable early failure without reading lifecycle or target state", async () => {
  let reads = 0
  const resolver = new ResourceGroupDeleteAuditAuthoritativeResolver(
    { getText: async () => { reads += 1; throw new Error("must not read") } } as unknown as ObjectStore,
    { get: async () => { reads += 1; return undefined } },
    { getVersionedGroupState: async () => { reads += 1; throw new Error("must not read") } }
  )
  const early = intent({
    status: "finalization_pending",
    draft: { ...draft(), before: null },
    requestedCompletion: { result: "denied", after: null, requestedAt: "2026-07-17T00:03:00.000Z" }
  })

  assert.deepEqual(await resolver.resolve(early), { result: "denied", after: null })
  assert.equal(reads, 0)
})

async function createFixture(options: Readonly<{
  currentGroup?: UserGroup
  currentMemberships?: GroupMembership[]
}> = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "group-delete-audit-reconciler-"))
  const objects = new LocalObjectStore(dataDir)
  const currentMemberships = options.currentMemberships ?? []
  const resolver = new ResourceGroupDeleteAuditAuthoritativeResolver(
    objects,
    { get: async () => options.currentGroup ?? archivedGroup() },
    {
      getVersionedGroupState: async () => ({
        memberships: currentMemberships,
        version: groupMembershipStateVersion(currentMemberships)
      })
    }
  )
  return { objects, resolver }
}

async function registerCleanup(
  objects: ObjectStore,
  lifecycle: DeleteLifecycleIntent,
  registration: ReturnType<typeof archivedGroupCleanupRegistration>,
  expectedBeforeDenyVersion: string
): Promise<void> {
  const repairs = new ObjectStoreRevocationCleanupRepairOutbox(objects)
  let repair = await repairs.prepare({
    expectedBeforeDenyVersion,
    cleanupRegistration: registration,
    preparedAt: lifecycle.createdAt
  })
  repair = await repairs.markDenyCommitted(repair, "2026-07-17T00:01:30.000Z")
  await new ObjectStoreRevocationCleanupCoordinator(objects, () => new Date("2026-07-17T00:01:40.000Z")).register(registration)
  await repairs.markCleanupRegistered(repair, "2026-07-17T00:01:50.000Z")
}

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: "security_mutation_group_delete_test",
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
    operation: "delete",
    before: audit(activeGroup()),
    proposedAfter: audit(archivedGroup()),
    reason: "グループ削除",
    policyVersion: "resource-group-lifecycle-policy-v1"
  }
}

function marker(overrides: Partial<DeleteLifecycleIntent> = {}): DeleteLifecycleIntent {
  return {
    schemaVersion: 1,
    kind: "delete",
    status: "group_archived",
    fingerprint: "fingerprint-1",
    actorId: "admin-1",
    tenantId: "tenant-1",
    group: activeGroup(),
    archivedGroup: archivedGroup(),
    memberships: [membership()],
    membershipVersion: groupMembershipStateVersion([membership()]),
    permission: "full",
    administrativePrincipal: false,
    auditIntentId: "security_mutation_group_delete_test",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:02:00.000Z",
    ...overrides
  }
}

function activeGroup(): UserGroup {
  return {
    groupId: "group-1",
    itemType: "userGroup",
    tenantId: "tenant-1",
    name: "削除対象グループ",
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy: "admin-1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}

function archivedGroup(): UserGroup {
  return {
    ...activeGroup(),
    status: "archived",
    updatedAt: "2026-07-17T00:01:00.000Z"
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
  return "security/resource-group-lifecycle/delete/tenant-1/group-1.json"
}
