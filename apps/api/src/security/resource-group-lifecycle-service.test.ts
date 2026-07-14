import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { AppUser } from "../auth.js"
import { ObjectStoreSecurityMutationAuditOutbox } from "./security-mutation-audit-outbox.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import {
  ResourceGroupLifecycleError,
  ResourceGroupLifecycleService
} from "./resource-group-lifecycle-service.js"

test("resource-group CRUD uses canonical kernel, version CAS, public allowlist, and revoke-first archive", async () => {
  const fixture = await createFixture()
  const created = await fixture.service.create(manager, createInput("team-a"))
  assert.deepEqual(created, {
    groupId: "team-a",
    name: "Team A",
    type: "team",
    status: "active",
    version: "2026-07-11T00:00:00.000Z"
  })
  assert.deepEqual(await fixture.service.get(manager, "team-a"), created)
  assert.deepEqual(await fixture.service.list(manager), [created])
  assert.deepEqual((await fixture.memberships.getVersionedGroupState("tenant-a", "team-a")).memberships.map((item) => item.memberId), [manager.userId])

  const updated = await fixture.service.update(manager, "team-a", {
    name: "Team Alpha",
    type: "project",
    expectedVersion: created.version,
    reason: "group rename"
  })
  assert.equal(updated.name, "Team Alpha")
  assert.equal(updated.type, "project")

  await assert.rejects(() => fixture.service.update(manager, "team-a", {
    name: "Stale",
    type: "team",
    expectedVersion: created.version,
    reason: "stale writer"
  }), (error: unknown) => error instanceof ResourceGroupLifecycleError && error.result === "conflict")

  const archived = await fixture.service.delete(manager, "team-a", {
    expectedVersion: updated.version,
    reason: "group retirement"
  })
  assert.equal(archived.status, "archived")
  assert.deepEqual((await fixture.memberships.getVersionedGroupState("tenant-a", "team-a")).memberships, [])
  assert.equal((await fixture.userGroups.get("tenant-a", "team-a"))?.status, "archived")
  const cleanupKeys = await fixture.objectStore.listKeys("security/revocation-cleanup/")
  assert.equal(cleanupKeys.length, 2)
  const cleanupRecords = await Promise.all(cleanupKeys.map(async (key) => (
    JSON.parse(await fixture.objectStore.getText(key)) as { trigger: string; resourceType: string }
  )))
  const cleanupTriggers = cleanupRecords.map((record) => record.trigger)
  assert.deepEqual(cleanupTriggers.sort(), ["archived", "group_revoked"])
  assert.deepEqual([...new Set(cleanupRecords.map((record) => record.resourceType))], ["resource_group"])
  assert.equal((await fixture.objectStore.listKeys("security/revocation-cleanup-repairs/")).length, 2)
})

test("create persists a durable intent and retry converges after membership initialization failure", async () => {
  let failMembership = true
  const fixture = await createFixture({
    wrapMemberships: (inner) => new DelegatingMembershipStore(inner, () => {
      if (failMembership) {
        failMembership = false
        throw new Error("simulated membership initialization failure")
      }
    })
  })
  const input = createInput("retry-create")

  await assert.rejects(() => fixture.service.create(manager, input), /persistence failed/)
  assert.equal((await fixture.userGroups.get("tenant-a", "retry-create"))?.status, "active")
  assert.deepEqual((await fixture.memberships.getVersionedGroupState("tenant-a", "retry-create")).memberships, [])
  assert.equal((await readLifecycleIntent(fixture.objectStore, "create", "retry-create")).status, "group_created")

  const converged = await fixture.service.create(manager, input)
  assert.equal(converged.status, "active")
  assert.equal((await fixture.memberships.getVersionedGroupState("tenant-a", "retry-create")).memberships.length, 1)
  assert.equal((await readLifecycleIntent(fixture.objectStore, "create", "retry-create")).status, "completed")
})

test("delete retry converges an active group with cleared memberships after archive CAS failure", async () => {
  let failArchive = true
  const fixture = await createFixture({
    wrapUserGroups: (inner) => new DelegatingUserGroupStore(inner, (group) => {
      if (group.status === "archived" && failArchive) {
        failArchive = false
        throw new Error("simulated archive failure")
      }
    })
  })
  const created = await fixture.service.create(manager, createInput("retry-delete"))
  const input = { expectedVersion: created.version, reason: "retryable retirement" }

  await assert.rejects(() => fixture.service.delete(manager, "retry-delete", input), /persistence failed/)
  assert.equal((await fixture.userGroups.get("tenant-a", "retry-delete"))?.status, "active")
  assert.deepEqual((await fixture.memberships.getVersionedGroupState("tenant-a", "retry-delete")).memberships, [])
  assert.equal((await readLifecycleIntent(fixture.objectStore, "delete", "retry-delete")).status, "memberships_cleared")

  const converged = await fixture.service.delete(manager, "retry-delete", input)
  assert.equal(converged.status, "archived")
  assert.equal((await readLifecycleIntent(fixture.objectStore, "delete", "retry-delete")).status, "completed")
})

test("missing target and feature denial are completed in common audit before returning", async () => {
  const fixture = await createFixture()
  await assert.rejects(() => fixture.service.update(manager, "missing", {
    name: "Missing",
    type: "team",
    expectedVersion: "unknown",
    reason: "missing target attempt"
  }), (error: unknown) => error instanceof ResourceGroupLifecycleError && error.result === "denied")

  await assert.rejects(() => fixture.service.create({ ...manager, cognitoGroups: ["CHAT_USER"] }, createInput("feature-denied")), (error: unknown) => (
    error instanceof ResourceGroupLifecycleError && error.result === "denied"
  ))
  assert.equal(await fixture.userGroups.get("tenant-a", "feature-denied"), undefined)

  const audits = await loadAudits(fixture.objectStore)
  assert.deepEqual(audits.map((audit) => audit.result).sort(), ["denied", "denied"])
  assert.ok(audits.every((audit) => audit.status === "completed"))
})

test("resource-group production lifecycle isolates identical raw IDs across tenants", async () => {
  const fixture = await createFixture()
  const tenantBManager: AppUser = { ...manager, userId: "manager-b", tenantId: "tenant-b" }
  await fixture.service.create(manager, createInput("shared-id"))
  await fixture.service.create(tenantBManager, createInput("shared-id"))

  assert.equal((await fixture.userGroups.get("tenant-a", "shared-id"))?.createdBy, manager.userId)
  assert.equal((await fixture.userGroups.get("tenant-b", "shared-id"))?.createdBy, tenantBManager.userId)
  assert.deepEqual((await fixture.memberships.getVersionedGroupState("tenant-a", "shared-id")).memberships.map((item) => item.memberId), [manager.userId])
  assert.deepEqual((await fixture.memberships.getVersionedGroupState("tenant-b", "shared-id")).memberships.map((item) => item.memberId), [tenantBManager.userId])
  assert.deepEqual((await fixture.service.list(manager)).map((item) => item.groupId), ["shared-id"])
  assert.deepEqual((await fixture.service.list(tenantBManager)).map((item) => item.groupId), ["shared-id"])
})

const manager: AppUser = {
  userId: "manager-1",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "tenant-a"
}

function createInput(groupId: string) {
  return {
    groupId,
    name: groupId === "team-a" ? "Team A" : groupId,
    type: "team" as const,
    expectedVersion: "absent" as const,
    reason: "resource group creation"
  }
}

async function createFixture(options: {
  wrapMemberships?: (inner: LocalGroupMembershipStore) => GroupMembershipStore
  wrapUserGroups?: (inner: LocalUserGroupStore) => UserGroupStore
} = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "resource-group-lifecycle-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const innerUserGroups = new LocalUserGroupStore(dataDir)
  const innerMemberships = new LocalGroupMembershipStore(dataDir)
  const userGroups = options.wrapUserGroups?.(innerUserGroups) ?? innerUserGroups
  const memberships = options.wrapMemberships?.(innerMemberships) ?? innerMemberships
  let tick = 0
  const clock = () => new Date(Date.parse("2026-07-11T00:00:00.000Z") + tick++ * 1000)
  const service = new ResourceGroupLifecycleService({
    userGroupStore: userGroups,
    groupMembershipStore: memberships,
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    objectStore,
    auditOutbox: new ObjectStoreSecurityMutationAuditOutbox(objectStore, clock),
    cleanupCoordinator: new ObjectStoreRevocationCleanupCoordinator(objectStore, clock),
    now: clock
  })
  return { service, objectStore, userGroups, memberships }
}

class DelegatingMembershipStore implements GroupMembershipStore {
  constructor(
    private readonly inner: GroupMembershipStore,
    private readonly beforeReplace: () => void
  ) {}

  list(...args: Parameters<GroupMembershipStore["list"]>) { return this.inner.list(...args) }
  listByGroupId(...args: Parameters<GroupMembershipStore["listByGroupId"]>) { return this.inner.listByGroupId(...args) }
  listByMember(...args: Parameters<GroupMembershipStore["listByMember"]>) { return this.inner.listByMember(...args) }
  save(...args: Parameters<GroupMembershipStore["save"]>) { return this.inner.save(...args) }
  delete(...args: Parameters<GroupMembershipStore["delete"]>) { return this.inner.delete(...args) }
  getVersionedGroupState(...args: Parameters<GroupMembershipStore["getVersionedGroupState"]>) { return this.inner.getVersionedGroupState(...args) }
  replaceGroupState(...args: Parameters<GroupMembershipStore["replaceGroupState"]>) {
    this.beforeReplace()
    return this.inner.replaceGroupState(...args)
  }
}

class DelegatingUserGroupStore implements UserGroupStore {
  constructor(
    private readonly inner: UserGroupStore,
    private readonly beforeReplace: (group: Parameters<UserGroupStore["replace"]>[0]) => void
  ) {}

  list(...args: Parameters<UserGroupStore["list"]>) { return this.inner.list(...args) }
  get(...args: Parameters<UserGroupStore["get"]>) { return this.inner.get(...args) }
  create(...args: Parameters<UserGroupStore["create"]>) { return this.inner.create(...args) }
  save(...args: Parameters<UserGroupStore["save"]>) { return this.inner.save(...args) }
  archive(...args: Parameters<UserGroupStore["archive"]>) { return this.inner.archive(...args) }
  replace(...args: Parameters<UserGroupStore["replace"]>) {
    this.beforeReplace(args[0])
    return this.inner.replace(...args)
  }
}

async function readLifecycleIntent(objectStore: LocalObjectStore, kind: "create" | "delete", groupId: string) {
  return JSON.parse(await objectStore.getText(
    `security/resource-group-lifecycle/${kind}/tenant-a/${groupId}.json`
  )) as { status: string }
}

async function loadAudits(objectStore: LocalObjectStore) {
  const keys = await objectStore.listKeys("security-audit/intents/")
  return Promise.all(keys.map(async (key) => JSON.parse(await objectStore.getText(key)) as { status: string; result?: string }))
}
