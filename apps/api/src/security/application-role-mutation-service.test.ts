import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { UserDirectory } from "../adapters/user-directory.js"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { AppUser } from "../auth.js"
import type { ManagedUser } from "../types.js"
import {
  ApplicationRoleMutationError,
  ApplicationRoleMutationService
} from "./application-role-mutation-service.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent,
  SecurityMutationAuditOutboxPort,
  SecurityMutationResult
} from "./security-mutation-audit-outbox.js"
import type { RegisterRevocationCleanupInput } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"

test("role mutation signs out first, writes the exact canonical set, verifies it, commits ledger, and audits", async () => {
  const fixture = mutationFixture()
  const result = await fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "target",
    roles: ["CHAT_USER", "ANSWER_EDITOR"],
    reason: "Support editor duty assigned",
    commitManagedState: async ({ afterRoles }) => {
      fixture.calls.push(`ledger:${afterRoles.join(",")}`)
    }
  })

  assert.deepEqual(result.afterRoles, ["CHAT_USER", "ANSWER_EDITOR"])
  assert.deepEqual(fixture.calls, [
    "signout:target-name",
    "groups:target-name:CHAT_USER,ANSWER_EDITOR",
    "ledger:CHAT_USER,ANSWER_EDITOR"
  ])
  assert.equal(fixture.audit.completed.at(-1)?.result, "success")
  assert.equal(fixture.audit.prepared[0]?.reason, "Support editor duty assigned")
})

const deniedCases: Array<{
  name: string
  mutate: (fixture: ReturnType<typeof mutationFixture>) => { actor?: AppUser; targetId?: string; roles?: string[]; reason?: string }
}> = [
  { name: "actor lacks permission", mutate: (f) => { f.identities.actor = identity("actor", ["CHAT_USER"]); return {} } },
  { name: "target is inactive", mutate: (f) => { f.identities.target = identity("target", ["CHAT_USER"], { accountStatus: "suspended" }); return {} } },
  { name: "target is cross tenant", mutate: (f) => { f.identities.target = identity("target", ["CHAT_USER"], { tenantId: "tenant-2" }); return {} } },
  { name: "role is outside catalog", mutate: () => ({ roles: ["UNKNOWN_ROLE"] }) },
  { name: "reason is empty", mutate: () => ({ reason: "" }) },
  { name: "self role removal", mutate: () => ({ targetId: "actor" }) },
  {
    name: "last system administrator is removed",
    mutate: (f) => {
      f.identities.target = identity("target", ["SYSTEM_ADMIN"])
      f.users = [managedUser("target", ["SYSTEM_ADMIN"])]
      return { roles: ["CHAT_USER"] }
    }
  }
]

for (const denied of deniedCases) {
  test(`role mutation denies ${denied.name} before session or role state changes`, async () => {
    const fixture = mutationFixture()
    const changes = denied.mutate(fixture)
    await assert.rejects(fixture.service.replaceRoles({
      actor: changes.actor ?? actorSnapshot(),
      targetUserId: changes.targetId ?? "target",
      roles: changes.roles ?? ["ANSWER_EDITOR"],
      reason: changes.reason ?? "Required administrative change",
      commitManagedState: async () => { fixture.calls.push("ledger") }
    }), ApplicationRoleMutationError)
    assert.deepEqual(fixture.calls, [])
    assert.equal(fixture.audit.prepared.length, 1)
    assert.equal(fixture.audit.completed.at(-1)?.result, "denied")
  })
}

test("system administrator removal succeeds when another active recovery principal remains", async () => {
  const fixture = mutationFixture()
  fixture.identities.target = identity("target", ["SYSTEM_ADMIN"])
  fixture.identities.recovery = identity("recovery", ["SYSTEM_ADMIN"])
  fixture.users = [
    managedUser("target", ["SYSTEM_ADMIN"]),
    managedUser("recovery", ["SYSTEM_ADMIN"])
  ]

  await fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "target",
    roles: ["CHAT_USER"],
    reason: "Rotate recovery administrator",
    commitManagedState: async () => undefined
  })
  assert.equal(fixture.audit.completed.at(-1)?.result, "success")
})

test("FR-066 role revoke registers session, grant, cache, and queued-run cleanup after the authoritative role set", async () => {
  const fixture = mutationFixture({ recordCleanup: true })
  await fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "target",
    roles: ["ANSWER_EDITOR"],
    reason: "Revoke chat access",
    commitManagedState: async () => { fixture.calls.push("ledger") }
  })

  assert.deepEqual(fixture.calls, [
    "signout:target-name",
    "groups:target-name:ANSWER_EDITOR",
    "cleanup:role_revoked",
    "ledger"
  ])
  assert.equal(fixture.cleanupRegistrations.length, 1)
  assert.deepEqual(fixture.cleanupRegistrations[0]?.knownTargets?.map((target) => target.scope).sort(), ["cache", "evaluation_artifact", "grant", "queued_run", "session"])
  assert.equal((await fixture.objectStore.listKeys("security/revocation-cleanup-repairs/")).length, 1)
})

test("session revocation failure leaves authoritative roles and ledger unchanged", async () => {
  const fixture = mutationFixture({ failSignOut: true })
  await assert.rejects(fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "target",
    roles: ["ANSWER_EDITOR"],
    reason: "Change role",
    commitManagedState: async () => { fixture.calls.push("ledger") }
  }), ApplicationRoleMutationError)
  assert.deepEqual(fixture.identities.target?.cognitoGroups, ["CHAT_USER"])
  assert.equal(fixture.calls.includes("ledger"), false)
  assert.equal(fixture.audit.completed.at(-1)?.result, "failed")
  await assert.doesNotReject(() => new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore)
    .assertResourceFenceReleased("tenant-1", "account", "target"))
})

test("missing target is denied only after a durable common audit is completed", async () => {
  const fixture = mutationFixture()
  fixture.identities.target = undefined

  await assert.rejects(() => fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "target",
    roles: ["ANSWER_EDITOR"],
    reason: "Missing target attempt",
    commitManagedState: async () => { fixture.calls.push("ledger") }
  }), ApplicationRoleMutationError)

  assert.deepEqual(fixture.calls, [])
  assert.equal(fixture.audit.prepared.length, 1)
  assert.equal(fixture.audit.completed.at(-1)?.result, "denied")
  assert.equal(fixture.audit.completed.at(-1)?.after, null)
})

test("identity lookup failure is audited as failed before any protected mutation", async () => {
  const fixture = mutationFixture({ failIdentityLookup: true })

  await assert.rejects(() => fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "target",
    roles: ["ANSWER_EDITOR"],
    reason: "Identity dependency failure",
    commitManagedState: async () => { fixture.calls.push("ledger") }
  }), ApplicationRoleMutationError)

  assert.deepEqual(fixture.calls, [])
  assert.equal(fixture.audit.prepared.length, 1)
  assert.equal(fixture.audit.completed.at(-1)?.result, "failed")
})

test("FR-080 concurrent two-administrator removals serialize at the tenant fence and never reach zero administrators", async () => {
  const fixture = mutationFixture()
  fixture.identities.adminA = identity("adminA", ["SYSTEM_ADMIN"])
  fixture.identities.adminB = identity("adminB", ["SYSTEM_ADMIN"])
  fixture.users = [managedUser("adminA", ["SYSTEM_ADMIN"]), managedUser("adminB", ["SYSTEM_ADMIN"])]

  const originalReplace = fixture.directory.replaceApplicationRoles!
  let releaseFirst!: () => void
  const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve })
  let firstEnteredResolve!: () => void
  const firstEntered = new Promise<void>((resolve) => { firstEnteredResolve = resolve })
  fixture.directory.replaceApplicationRoles = async (username, input) => {
    if (username === "adminB-name") {
      firstEnteredResolve()
      await firstBlocked
    }
    return originalReplace(username, input)
  }

  const first = fixture.service.replaceRoles({
    actor: snapshotFor("adminA"),
    targetUserId: "adminB",
    roles: ["CHAT_USER"],
    reason: "Remove administrator B",
    commitManagedState: async () => undefined
  })
  await firstEntered
  const second = fixture.service.replaceRoles({
    actor: snapshotFor("adminB"),
    targetUserId: "adminA",
    roles: ["CHAT_USER"],
    reason: "Remove administrator A",
    commitManagedState: async () => undefined
  })

  await assert.rejects(second, (error: unknown) => (
    error instanceof ApplicationRoleMutationError && error.result === "conflict"
  ))
  releaseFirst()
  await first

  const remaining = Object.values(fixture.identities).filter((candidate) => (
    candidate?.accountStatus === "active" && candidate.cognitoGroups.includes("SYSTEM_ADMIN") &&
    (candidate.userId === "adminA" || candidate.userId === "adminB")
  ))
  assert.equal(remaining.length, 1)
  assert.equal(fixture.audit.completed.some((entry) => entry.result === "conflict"), true)
})

test("FR-080 expired identity-mutation lease is fenced, rolled back idempotently, and allows a later tenant mutation", async () => {
  let nowMs = Date.parse("2026-07-11T00:00:00.000Z")
  const fixture = mutationFixture({ now: () => new Date(nowMs), lockLeaseDurationMs: 50 })
  fixture.identities.other = identity("other", ["CHAT_USER"])
  fixture.users = [
    managedUser("actor", ["SYSTEM_ADMIN"]),
    managedUser("target", ["CHAT_USER"]),
    managedUser("other", ["CHAT_USER"])
  ]

  const originalReplace = fixture.directory.replaceApplicationRoles!
  let releaseStale!: () => void
  const staleBlocked = new Promise<void>((resolve) => { releaseStale = resolve })
  let staleEnteredResolve!: () => void
  const staleEntered = new Promise<void>((resolve) => { staleEnteredResolve = resolve })
  let blockedOnce = false
  fixture.directory.replaceApplicationRoles = async (username, input) => {
    await originalReplace(username, input)
    if (username === "target-name" && !blockedOnce) {
      blockedOnce = true
      staleEnteredResolve()
      await staleBlocked
    }
  }

  const stale = fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "target",
    roles: ["ANSWER_EDITOR"],
    reason: "Mutation that loses its lease",
    commitManagedState: async () => undefined
  })
  await staleEntered
  nowMs += 1_000

  const recoveredSuccessor = await fixture.service.replaceRoles({
    actor: actorSnapshot(),
    targetUserId: "other",
    roles: ["ANSWER_EDITOR"],
    reason: "Mutation after expired lease recovery",
    commitManagedState: async () => undefined
  })
  assert.deepEqual(recoveredSuccessor.afterRoles, ["ANSWER_EDITOR"])
  assert.deepEqual(fixture.identities.target?.cognitoGroups, ["CHAT_USER"])
  assert.deepEqual(fixture.identities.other?.cognitoGroups, ["ANSWER_EDITOR"])

  releaseStale()
  await assert.rejects(stale, ApplicationRoleMutationError)
  assert.deepEqual(fixture.identities.target?.cognitoGroups, ["CHAT_USER"])
  assert.equal(fixture.audit.completed.some((entry) => entry.result === "failed"), true)
  const repairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore)
  assert.equal(
    (await repairOutbox.get("tenant-1", "account", "target", "application-role:intent-1"))?.status,
    "abandoned"
  )
  await assert.doesNotReject(() => repairOutbox.assertResourceFenceReleased("tenant-1", "account", "target"))
})

function mutationFixture(options: {
  failSignOut?: boolean
  failIdentityLookup?: boolean
  recordCleanup?: boolean
  now?: () => Date
  lockLeaseDurationMs?: number
} = {}) {
  const calls: string[] = []
  const identities: Record<string, ServerManagedIdentity | undefined> = {
    actor: identity("actor", ["SYSTEM_ADMIN"]),
    target: identity("target", ["CHAT_USER"])
  }
  let users: ManagedUser[] = [managedUser("actor", ["SYSTEM_ADMIN"]), managedUser("target", ["CHAT_USER"])]
  const provider: VerifiedIdentityProvider = {
    async getCurrentIdentity(username) {
      return Object.values(identities).find((candidate) => candidate?.username === username)
    },
    async getCurrentIdentityBySubject(subject) {
      if (options.failIdentityLookup) throw new Error("identity unavailable")
      return identities[subject]
    }
  }
  const directory: Pick<UserDirectory, "listUsers" | "replaceApplicationRoles" | "revokeSessions"> = {
    async listUsers() { return users },
    async revokeSessions(username) {
      calls.push(`signout:${username}`)
      if (options.failSignOut) throw new Error("signout unavailable")
    },
    async replaceApplicationRoles(username, input) {
      await input.assertFence()
      calls.push(`groups:${username}:${input.desiredRoles.join(",")}`)
      const target = Object.values(identities).find((candidate) => candidate?.username === username)
      assert.deepEqual(target?.cognitoGroups, input.expectedRoles)
      if (target) target.cognitoGroups = [...input.desiredRoles]
      await input.assertFence()
    }
  }
  const audit = new MemoryAuditOutbox()
  const objectStore = new LocalObjectStore(mkdtempSync(path.join(tmpdir(), "application-role-mutation-")))
  const cleanupRegistrations: RegisterRevocationCleanupInput[] = []
  const service = new ApplicationRoleMutationService({
    identityProvider: provider,
    userDirectory: directory,
    objectStore,
    auditOutbox: audit,
    now: options.now,
    lockLeaseDurationMs: options.lockLeaseDurationMs,
    cleanupCoordinator: options.recordCleanup ? {
      register: async (input) => {
        cleanupRegistrations.push(input)
        calls.push(`cleanup:${input.trigger}`)
        return {} as never
      }
    } : undefined
  })
  return {
    service,
    calls,
    identities,
    directory,
    objectStore,
    audit,
    cleanupRegistrations,
    get users() { return users },
    set users(value: ManagedUser[]) { users = value }
  }
}

class MemoryAuditOutbox implements SecurityMutationAuditOutboxPort {
  prepared: SecurityMutationAuditDraft[] = []
  completed: Array<{ result: SecurityMutationResult; after: unknown }> = []
  intents = new Map<string, SecurityMutationAuditIntent>()

  async prepare(draft: SecurityMutationAuditDraft): Promise<SecurityMutationAuditIntent> {
    this.prepared.push(draft)
    const intent: SecurityMutationAuditIntent = {
      schemaVersion: 1,
      intentId: `intent-${this.prepared.length}`,
      status: "pending",
      draft,
      createdAt: "2026-07-11T00:00:00.000Z"
    }
    this.intents.set(intent.intentId, intent)
    return intent
  }

  async complete(intentId: string, _tenantId: string, result: SecurityMutationResult, after: any): Promise<SecurityMutationAuditIntent> {
    const intent = this.intents.get(intentId)!
    this.completed.push({ result, after })
    return { ...intent, status: "completed", result, after, completedAt: "2026-07-11T00:00:01.000Z" }
  }
}

function identity(
  userId: string,
  cognitoGroups: string[],
  overrides: Partial<ServerManagedIdentity> = {}
): ServerManagedIdentity {
  return {
    username: `${userId}-name`,
    userId,
    email: `${userId}@example.com`,
    accountStatus: "active",
    cognitoGroups,
    tenantId: "tenant-1",
    ...overrides
  }
}

function actorSnapshot(): AppUser {
  return {
    userId: "actor",
    email: "actor@example.com",
    cognitoGroups: ["SYSTEM_ADMIN"],
    accountStatus: "active",
    tenantId: "tenant-1"
  }
}

function snapshotFor(userId: string): AppUser {
  return {
    userId,
    email: `${userId}@example.com`,
    cognitoGroups: ["SYSTEM_ADMIN"],
    accountStatus: "active",
    tenantId: "tenant-1"
  }
}

function managedUser(userId: string, groups: string[]): ManagedUser {
  return {
    userId,
    email: `${userId}@example.com`,
    status: "active",
    groups,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}
