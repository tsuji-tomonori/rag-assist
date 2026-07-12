import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { AppUser } from "../auth.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  type RegisterRevocationCleanupInput
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type { GroupMembership, UserGroup } from "../types.js"
import {
  ResourceGroupMembershipMutationError,
  ResourceGroupMembershipService,
  type ResourceUserPrincipal,
  type ResourceUserPrincipalDirectory
} from "./resource-group-membership-service.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditIntent,
  type SecurityMutationAuditOutboxPort,
  type SecurityMutationResult
} from "./security-mutation-audit-outbox.js"
import {
  ObjectStoreResourceGroupMembershipCleanupRepairStore,
  type ResourceGroupMembershipCleanupRepairStore
} from "./resource-group-membership-cleanup-repair-store.js"

test("authorized manager replaces a complete membership state with an audit intent", async () => {
  const fixture = await createFixture()
  fixture.directory.set(activeUser("user-1"))
  const initial = await fixture.service.getState(manager(), "team-a")

  const result = await fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "readOnly" }],
    reason: "閲覧担当を追加"
  })

  assert.notEqual(result.version, initial.version)
  assert.deepEqual(result.memberships.map((membership) => [membership.memberId, membership.permissionLevel]), [["user-1", "readOnly"]])
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 1)
})

test("feature permission and target full are both required", async () => {
  const fixture = await createFixture()
  fixture.directory.set(activeUser("user-1"))
  const initial = await fixture.service.getState(manager(), "team-a")

  await assertMutationError(() => fixture.service.replaceMemberships({ ...manager(), cognitoGroups: ["CHAT_USER"] }, "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "権限不足"
  }), "denied")

  await assertMutationError(() => fixture.service.replaceMemberships({ ...manager(), userId: "other-manager" }, "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "対象権限不足"
  }), "denied")
  assert.equal((await fixture.service.getState(manager(), "team-a")).version, initial.version)
})

test("versioned membership reads require the current mutate feature and target full authority", async () => {
  const fixture = await createFixture()

  await assertMutationError(() => fixture.service.getState({ ...manager(), cognitoGroups: ["CHAT_USER"] }, "team-a"), "denied")
  await assertMutationError(() => fixture.service.getState({ ...manager(), userId: "other-manager" }, "team-a"), "denied")

  const state = await fixture.service.getState(manager(), "team-a")
  assert.deepEqual(state.memberships, [])
  assert.match(state.version, /^[a-f0-9]{64}$/u)
})

test("retained user principals must be active and same-tenant", async () => {
  for (const principal of [
    undefined,
    activeUser("user-1", "tenant-b"),
    { ...activeUser("user-1"), status: "suspended" as const }
  ]) {
    const fixture = await createFixture()
    if (principal) fixture.directory.set(principal)
    const initial = await fixture.service.getState(manager(), "team-a")
    await assertMutationError(() => fixture.service.replaceMemberships(manager(), "team-a", {
      expectedVersion: initial.version,
      memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "readOnly" }],
      reason: "不正 principal 拒否"
    }), "denied")
    assert.deepEqual((await fixture.service.getState(manager(), "team-a")).memberships, [])
  }
})

test("application-role namespace and nested group cycles fail closed", async () => {
  const fixture = await createFixture()
  await fixture.userGroupStore.save(group("child-team", "manager-1"))
  await fixture.userGroupStore.save(group("SYSTEM_ADMIN", "manager-1"))
  await fixture.membershipStore.save(membership("child-team", "group", "team-a", "full"))
  const initial = await fixture.service.getState(manager(), "team-a")

  await assertMutationError(() => fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "group", memberId: "child-team", permissionLevel: "full" }],
    reason: "循環拒否"
  }), "denied")

  await assertMutationError(() => fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "group", memberId: "SYSTEM_ADMIN", permissionLevel: "full" }],
    reason: "namespace 拒否"
  }), "denied")
  assert.deepEqual((await fixture.service.getState(manager(), "team-a")).memberships, [])
})

test("retained group principals must exist, be active, and stay in the target tenant", async () => {
  for (const target of [
    undefined,
    { ...group("child-team", "manager-1"), status: "archived" as const },
    group("child-team", "manager-1", "tenant-b")
  ]) {
    const fixture = await createFixture()
    if (target) await fixture.userGroupStore.save(target)
    const initial = await fixture.service.getState(manager(), "team-a")

    await assertMutationError(() => fixture.service.replaceMemberships(manager(), "team-a", {
      expectedVersion: initial.version,
      memberships: [{ memberType: "group", memberId: "child-team", permissionLevel: "readOnly" }],
      reason: "不正 group principal 拒否"
    }), "denied")
    assert.deepEqual((await fixture.service.getState(manager(), "team-a")).memberships, [])
  }
})

test("stale dangling edge can be removed because it is absent from proposed state", async () => {
  const fixture = await createFixture()
  await fixture.membershipStore.save(membership("team-a", "user", "deleted-user", "full"))
  const stale = await fixture.service.getState(manager(), "team-a")

  const result = await fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: stale.version,
    memberships: [],
    reason: "削除済み principal edge cleanup"
  })
  assert.deepEqual(result.memberships, [])
})

test("a stale expected version is rejected without overwriting the committed complete state", async () => {
  const fixture = await createFixture()
  fixture.directory.set(activeUser("user-1"))
  fixture.directory.set(activeUser("user-2"))
  const initial = await fixture.service.getState(manager(), "team-a")
  const committed = await fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "first writer"
  })

  await assertMutationError(() => fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-2", permissionLevel: "full" }],
    reason: "stale writer"
  }), "conflict")
  assert.equal((await fixture.service.getState(manager(), "team-a")).version, committed.version)
  assert.deepEqual((await fixture.service.getState(manager(), "team-a")).memberships.map((item) => item.memberId), ["user-1"])
})

test("complete-state optimistic concurrency accepts one writer and audits the conflict", async () => {
  const fixture = await createFixture()
  fixture.directory.set(activeUser("user-1"))
  fixture.directory.set(activeUser("user-2"))
  const initial = await fixture.service.getState(manager(), "team-a")
  const results = await Promise.allSettled([
    fixture.service.replaceMemberships(manager(), "team-a", {
      expectedVersion: initial.version,
      memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
      reason: "writer one"
    }),
    fixture.service.replaceMemberships(manager(), "team-a", {
      expectedVersion: initial.version,
      memberships: [{ memberType: "user", memberId: "user-2", permissionLevel: "full" }],
      reason: "writer two"
    })
  ])

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(results.filter((result) => result.status === "rejected").length, 1)
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 2)
})

test("audit prepare failure prevents state mutation", async () => {
  const fixture = await createFixture({ auditOutbox: new FailingPrepareOutbox() })
  fixture.directory.set(activeUser("user-1"))
  const initial = await fixture.service.getState(manager(), "team-a")
  await assert.rejects(() => fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "監査失敗"
  }), /audit unavailable/)
  assert.deepEqual((await fixture.service.getState(manager(), "team-a")).memberships, [])
})

test("audit completion failure returns no success while retaining a durable pending intent", async () => {
  const auditOutbox = new PendingOnlyOutbox()
  const fixture = await createFixture({ auditOutbox })
  fixture.directory.set(activeUser("user-1"))
  const initial = await fixture.service.getState(manager(), "team-a")
  await assert.rejects(() => fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "完了監査失敗"
  }), /audit completion unavailable/)
  assert.equal((await fixture.service.getState(manager(), "team-a")).memberships.length, 1)
  assert.equal(auditOutbox.pending.length, 1)
})

test("membership revoke registers durable group cleanup after deny and before audit success", async () => {
  const events: string[] = []
  const auditOutbox = new TrackingOutbox(events)
  let captured: RegisterRevocationCleanupInput | undefined
  const fixture = await createFixture({
    auditOutbox,
    cleanupCoordinator: ({ objectStore, memberships }) => {
      const durable = new ObjectStoreRevocationCleanupCoordinator(
        objectStore,
        () => new Date("2026-07-11T00:00:00.000Z")
      )
      return {
        register: async (input) => {
          events.push("cleanup.register")
          assert.equal(
            (await objectStore.listKeys("security/resource-group-membership-cleanup-repairs/")).length,
            1,
            "a durable repair intent must precede the authoritative deny"
          )
          assert.deepEqual(
            (await memberships.getVersionedGroupState("tenant-a", "team-a")).memberships,
            [],
            "the authoritative membership deny must already be effective"
          )
          captured = input
          return durable.register(input)
        }
      }
    }
  })
  await fixture.membershipStore.save(membership("team-a", "user", "revoked-user", "full"))
  const current = await fixture.service.getState(manager(), "team-a")

  await fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: current.version,
    memberships: [],
    reason: "担当解除"
  })

  assert.deepEqual(events, ["audit.prepare", "cleanup.register", "audit.complete:success"])
  assert.equal(captured?.tenantId, "tenant-a")
  assert.equal(captured?.resourceType, "resource_group")
  assert.equal(captured?.resourceId, "team-a")
  assert.equal(captured?.trigger, "group_revoked")
  assert.match(captured?.authoritativeDenyVersion ?? "", /^[a-f0-9]{64}$/u)
  assert.deepEqual(
    [...new Set(captured?.knownTargets?.map((target) => target.scope))].sort(),
    ["cache", "evaluation_artifact", "grant", "queued_run", "session"]
  )
  assert.equal((await fixture.objectStore.listKeys("security/revocation-cleanup-repairs/")).length, 1)
})

test("cleanup registration failure leaves a durable repair intent that retries while deny remains effective", async () => {
  const events: string[] = []
  const auditOutbox = new TrackingOutbox(events)
  let failCleanupRegistration = true
  const fixture = await createFixture({
    auditOutbox,
    cleanupCoordinator: ({ objectStore }) => {
      const durable = new ObjectStoreRevocationCleanupCoordinator(objectStore)
      return { register: async (input) => {
        events.push("cleanup.register")
        if (failCleanupRegistration) throw new Error("cleanup ledger unavailable")
        return durable.register(input)
      } }
    }
  })
  await fixture.membershipStore.save(membership("team-a", "user", "revoked-user", "full"))
  const current = await fixture.service.getState(manager(), "team-a")

  await assertMutationError(() => fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: current.version,
    memberships: [],
    reason: "担当解除"
  }), "failed")

  assert.deepEqual((await fixture.service.getState(manager(), "team-a")).memberships, [])
  assert.deepEqual(events, ["audit.prepare", "cleanup.register", "audit.complete:failed"])
  assert.deepEqual(auditOutbox.results, ["failed"])
  const pending = await fixture.cleanupRepairStore.listPending("tenant-a", "team-a")
  assert.equal(pending.length, 1)
  assert.equal(pending[0]?.status, "deny_committed")
  assert.equal(pending[0]?.cleanupRegistration.authoritativeDenyVersion, (await fixture.service.getState(manager(), "team-a")).version)
  assert.equal((await fixture.objectStore.listKeys("security/revocation-cleanup/")).length, 0)
  assert.equal(
    (await new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore).get(
      "tenant-a",
      "resource_group",
      "team-a",
      pending[0]!.operationId
    ))?.status,
    "deny_committed"
  )

  failCleanupRegistration = false
  assert.equal(await fixture.service.retryPendingRevocationCleanups(manager(), "team-a"), 1)
  assert.deepEqual((await fixture.service.getState(manager(), "team-a")).memberships, [])
  assert.equal((await fixture.cleanupRepairStore.listPending("tenant-a", "team-a")).length, 0)
  assert.equal((await fixture.objectStore.listKeys("security/revocation-cleanup/")).length, 1)
  assert.equal(
    (await new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore).get(
      "tenant-a",
      "resource_group",
      "team-a",
      pending[0]!.operationId
    ))?.status,
    "cleanup_registered"
  )
  assert.deepEqual(events, ["audit.prepare", "cleanup.register", "audit.complete:failed", "cleanup.register"])
})

test("repair intent persistence failure prevents an untracked membership deny", async () => {
  const events: string[] = []
  const fixture = await createFixture({
    auditOutbox: new TrackingOutbox(events),
    cleanupCoordinator: () => ({
      register: async () => {
        throw new Error("cleanup registration must not run")
      }
    }),
    cleanupRepairStore: () => ({
      prepare: async () => {
        events.push("repair.prepare")
        throw new Error("repair ledger unavailable")
      },
      listPending: async () => [],
      markDenyCommitted: async () => { throw new Error("unexpected") },
      markCleanupRegistered: async () => { throw new Error("unexpected") },
      markAbandoned: async () => { throw new Error("unexpected") }
    })
  })
  await fixture.membershipStore.save(membership("team-a", "user", "retained-user", "full"))
  const current = await fixture.service.getState(manager(), "team-a")

  await assertMutationError(() => fixture.service.replaceMemberships(manager(), "team-a", {
    expectedVersion: current.version,
    memberships: [],
    reason: "追跡不能 deny の防止"
  }), "failed")

  assert.deepEqual(
    (await fixture.service.getState(manager(), "team-a")).memberships.map((item) => item.memberId),
    ["retained-user"]
  )
  assert.deepEqual(events, ["audit.prepare", "repair.prepare", "audit.complete:failed"])
})

class MapPrincipalDirectory implements ResourceUserPrincipalDirectory {
  private readonly users = new Map<string, ResourceUserPrincipal>()

  set(user: ResourceUserPrincipal) {
    this.users.set(user.userId, user)
  }

  async getUser(userId: string): Promise<ResourceUserPrincipal | undefined> {
    return this.users.get(userId)
  }
}

class FailingPrepareOutbox implements SecurityMutationAuditOutboxPort {
  async prepare(): Promise<SecurityMutationAuditIntent> {
    throw new Error("audit unavailable")
  }

  async complete(): Promise<SecurityMutationAuditIntent> {
    throw new Error("unexpected")
  }
}

class PendingOnlyOutbox implements SecurityMutationAuditOutboxPort {
  readonly pending: SecurityMutationAuditIntent[] = []

  async prepare(draft: SecurityMutationAuditIntent["draft"]): Promise<SecurityMutationAuditIntent> {
    const intent: SecurityMutationAuditIntent = {
      schemaVersion: 1,
      intentId: `intent-${this.pending.length + 1}`,
      status: "pending",
      draft,
      createdAt: "2026-07-11T00:00:00.000Z"
    }
    this.pending.push(intent)
    return intent
  }

  async complete(_intentId: string, _tenantId: string, _result: SecurityMutationResult): Promise<SecurityMutationAuditIntent> {
    throw new Error("audit completion unavailable")
  }
}

class TrackingOutbox implements SecurityMutationAuditOutboxPort {
  readonly results: SecurityMutationResult[] = []
  private intent: SecurityMutationAuditIntent | undefined

  constructor(private readonly events: string[]) {}

  async prepare(draft: SecurityMutationAuditIntent["draft"]): Promise<SecurityMutationAuditIntent> {
    this.events.push("audit.prepare")
    this.intent = {
      schemaVersion: 1,
      intentId: "tracked-intent",
      status: "pending",
      draft,
      createdAt: "2026-07-11T00:00:00.000Z"
    }
    return this.intent
  }

  async complete(
    intentId: string,
    tenantId: string,
    result: SecurityMutationResult,
    after: SecurityMutationAuditIntent["after"]
  ): Promise<SecurityMutationAuditIntent> {
    assert.equal(intentId, this.intent?.intentId)
    assert.equal(tenantId, this.intent?.draft.tenantId)
    this.events.push(`audit.complete:${result}`)
    this.results.push(result)
    return {
      ...this.intent!,
      status: "completed",
      result,
      after,
      completedAt: "2026-07-11T00:00:01.000Z"
    }
  }
}

type CleanupCoordinator = Pick<ObjectStoreRevocationCleanupCoordinator, "register">

async function createFixture(input: {
  auditOutbox?: SecurityMutationAuditOutboxPort
  cleanupCoordinator?: (context: {
    objectStore: LocalObjectStore
    memberships: LocalGroupMembershipStore
  }) => CleanupCoordinator
  cleanupRepairStore?: (context: {
    objectStore: LocalObjectStore
    memberships: LocalGroupMembershipStore
  }) => ResourceGroupMembershipCleanupRepairStore
} = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "resource-group-membership-service-test-"))
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const membershipStore = new LocalGroupMembershipStore(dataDir)
  const objectStore = new LocalObjectStore(dataDir)
  const directory = new MapPrincipalDirectory()
  await userGroupStore.save(group("team-a", "manager-1"))
  const cleanupRepairStore = input.cleanupRepairStore?.({ objectStore, memberships: membershipStore })
    ?? new ObjectStoreResourceGroupMembershipCleanupRepairStore(objectStore)
  const service = new ResourceGroupMembershipService({
    userGroupStore,
    groupMembershipStore: membershipStore,
    userPrincipalDirectory: directory,
    auditOutbox: input.auditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(objectStore),
    cleanupCoordinator: input.cleanupCoordinator?.({ objectStore, memberships: membershipStore })
      ?? new ObjectStoreRevocationCleanupCoordinator(objectStore),
    cleanupRepairStore,
    cleanupRepairOutbox: new ObjectStoreRevocationCleanupRepairOutbox(objectStore),
    now: () => new Date("2026-07-11T00:00:00.000Z")
  })
  return { service, userGroupStore, membershipStore, objectStore, directory, cleanupRepairStore }
}

function manager(): AppUser {
  return {
    userId: "manager-1",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
}

function activeUser(userId: string, tenantId = "tenant-a"): ResourceUserPrincipal {
  return { userId, tenantId, status: "active" }
}

function group(groupId: string, createdBy: string, tenantId = "tenant-a"): UserGroup {
  return {
    groupId,
    itemType: "userGroup",
    tenantId,
    name: groupId,
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function membership(
  groupId: string,
  memberType: GroupMembership["memberType"],
  memberId: string,
  permissionLevel: GroupMembership["permissionLevel"]
): GroupMembership {
  return {
    tenantId: "tenant-a",
    groupId,
    memberType,
    memberId,
    permissionLevel,
    source: "manual",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

async function assertMutationError(
  operation: () => Promise<unknown>,
  result: ResourceGroupMembershipMutationError["result"]
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => (
    error instanceof ResourceGroupMembershipMutationError && error.result === result
  ))
}
