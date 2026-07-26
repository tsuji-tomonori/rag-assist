import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { ServerManagedIdentity } from "../adapters/verified-identity-provider.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { ApplicationRoleAuditAuthoritativeResolver } from "./application-role-audit-reconciler.js"
import { ObjectStoreSecurityMutationAuditOutbox, type SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 application-role resolver supports only the exact target and operation", () => {
  const resolver = new ApplicationRoleAuditAuthoritativeResolver({ getCurrentIdentityBySubject: async () => undefined })
  assert.equal(resolver.supports(draft()), true)
  assert.equal(resolver.supports({ ...draft(), targetType: "account" }), false)
  assert.equal(resolver.supports({ ...draft(), operation: "applicationRole.add" }), false)
})

test("FR-086 application-role resolver converges duplicate workers on one authoritative success event", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "application-role-audit-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const prepared = await outbox.prepare(draft())
  const resolver = new ApplicationRoleAuditAuthoritativeResolver({
    getCurrentIdentityBySubject: async () => identity({ cognitoGroups: ["ANSWER_EDITOR"] })
  })
  const reconciler = new SecurityMutationAuditReconciler(outbox, [resolver])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, identityAudit(["ANSWER_EDITOR"]))
  assert.equal((await outbox.listAll("tenant-1")).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 application-role resolver preserves durable non-success only when current identity confirms it", async () => {
  const resolver = new ApplicationRoleAuditAuthoritativeResolver({
    getCurrentIdentityBySubject: async () => identity()
  })
  const durable = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "conflict",
      after: identityAudit(["CHAT_USER"]),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(durable), {
    result: "conflict",
    after: identityAudit(["CHAT_USER"])
  })

  const changed = new ApplicationRoleAuditAuthoritativeResolver({
    getCurrentIdentityBySubject: async () => identity({ cognitoGroups: ["ANSWER_EDITOR"] })
  })
  await assert.rejects(() => changed.resolve(durable), /do not confirm/)
})

test("FR-086 application-role resolver canonicalizes valid caller role order before comparison", async () => {
  const resolver = new ApplicationRoleAuditAuthoritativeResolver({
    getCurrentIdentityBySubject: async () => identity({ cognitoGroups: ["ANSWER_EDITOR", "CHAT_USER"] })
  })
  const reordered = intent({
    draft: {
      ...draft(),
      proposedAfter: { roles: ["ANSWER_EDITOR", "CHAT_USER"] }
    }
  })

  assert.deepEqual(await resolver.resolve(reordered), {
    result: "success",
    after: identityAudit(["CHAT_USER", "ANSWER_EDITOR"])
  })
})

test("FR-086 application-role resolver finalizes durable early failure without reading Cognito", async () => {
  let reads = 0
  const resolver = new ApplicationRoleAuditAuthoritativeResolver({
    getCurrentIdentityBySubject: async () => {
      reads += 1
      return undefined
    }
  })
  const earlyFailure = intent({
    status: "finalization_pending",
    draft: { ...draft(), before: null },
    requestedCompletion: {
      result: "denied",
      after: null,
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(earlyFailure), { result: "denied", after: null })
  assert.equal(reads, 0)
})

test("FR-086 application-role resolver fails closed for unavailable or boundary-crossing identities", async () => {
  const cases: Array<[string, ServerManagedIdentity | undefined, RegExp]> = [
    ["missing", undefined, /principal is unavailable/],
    ["cross tenant", identity({ tenantId: "tenant-2" }), /crossed its identity boundary/],
    ["cross subject", identity({ userId: "user-2" }), /crossed its identity boundary/],
    ["suspended pending success", identity({ accountStatus: "suspended", cognitoGroups: ["ANSWER_EDITOR"] }), /is not active/],
    ["duplicate roles", identity({ cognitoGroups: ["ANSWER_EDITOR", "ANSWER_EDITOR"] }), /duplicate roles/]
  ]
  for (const [label, current, expected] of cases) {
    const resolver = new ApplicationRoleAuditAuthoritativeResolver({
      getCurrentIdentityBySubject: async () => current
    })
    await assert.rejects(() => resolver.resolve(intent()), expected, label)
  }
})

test("FR-086 application-role resolver does not guess a result from before or third-party role state", async () => {
  const before = new ApplicationRoleAuditAuthoritativeResolver({
    getCurrentIdentityBySubject: async () => identity()
  })
  await assert.rejects(() => before.resolve(intent()), /no durable non-success result/)

  const third = new ApplicationRoleAuditAuthoritativeResolver({
    getCurrentIdentityBySubject: async () => identity({ cognitoGroups: ["RAG_GROUP_MANAGER"] })
  })
  await assert.rejects(() => third.resolve(intent()), /neither the before nor proposed state/)

  await assert.rejects(
    () => before.resolve(intent({ draft: { ...draft(), proposedAfter: { roles: ["UNKNOWN"] } } })),
    /roles are invalid/
  )
})

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: "security_mutation_application_role_test",
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
    targetType: "applicationRolePrincipal",
    targetId: "user-1",
    operation: "applicationRole.replace",
    before: { roles: ["CHAT_USER"] },
    proposedAfter: { roles: ["ANSWER_EDITOR"] },
    reason: "担当変更",
    policyVersion: "application-role-mutation-v1:memorag-access-role-catalog-v2"
  }
}

function identity(overrides: Partial<ServerManagedIdentity> = {}): ServerManagedIdentity {
  return {
    username: "user-1@example.com",
    userId: "user-1",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"],
    tenantId: "tenant-1",
    ...overrides
  }
}

function identityAudit(roles: readonly string[]) {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    accountStatus: "active",
    roles: [...roles]
  }
}
