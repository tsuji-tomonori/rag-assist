import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { AppUser } from "../auth.js"
import {
  SecurityMutationAuditQuarantineService,
  SecurityMutationAuditQuarantineServiceError
} from "./security-mutation-audit-quarantine-service.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  SecurityMutationAuditRedriveError
} from "./security-mutation-audit-outbox.js"

test("SYSTEM_ADMIN redrive uses only the verified actor tenant and records the canonical policy", async () => {
  const fixture = await createFixture()

  const result = await fixture.service.redrive(systemAdmin("tenant-a"), fixture.intentId, {
    idempotencyKey: "operator-request-001",
    reason: "resolver rollout verified"
  })

  assert.equal(result.status, "pending")
  const restored = await fixture.outbox.get("tenant-a", fixture.intentId)
  assert.equal(restored.redriveHistory?.[0]?.actorId, "system-admin-1")
  assert.equal(
    restored.redriveHistory?.[0]?.policyVersion,
    "security-audit-quarantine-redrive-v1:memorag-access-role-catalog-v3"
  )
})

test("ACCESS_ADMIN and suspended SYSTEM_ADMIN cannot redrive a quarantine", async () => {
  for (const actor of [
    { ...systemAdmin("tenant-a"), cognitoGroups: ["ACCESS_ADMIN"] },
    { ...systemAdmin("tenant-a"), accountStatus: "suspended" as const }
  ]) {
    const fixture = await createFixture()
    await assert.rejects(
      () => fixture.service.redrive(actor, fixture.intentId, {
        idempotencyKey: "operator-request-001",
        reason: "unauthorized probe"
      }),
      (error) => error instanceof SecurityMutationAuditQuarantineServiceError && error.code === "forbidden"
    )
    assert.equal((await fixture.outbox.get("tenant-a", fixture.intentId)).status, "quarantined")
  }
})

test("cross-tenant intent identifiers are hidden as not found", async () => {
  const fixture = await createFixture()

  await assert.rejects(
    () => fixture.service.redrive(systemAdmin("tenant-b"), fixture.intentId, {
      idempotencyKey: "operator-request-001",
      reason: "cross tenant probe"
    }),
    (error) => error instanceof SecurityMutationAuditRedriveError && error.code === "not_found"
  )
  assert.equal((await fixture.outbox.get("tenant-a", fixture.intentId)).status, "quarantined")
})

test("missing tenant and non-canonical operator input fail before storage mutation", async () => {
  for (const testCase of [
    {
      actor: { ...systemAdmin("tenant-a"), tenantId: undefined },
      intentId: "security_mutation_valid",
      input: { idempotencyKey: "operator-request-001", reason: "missing tenant" },
      code: "unavailable"
    },
    {
      actor: systemAdmin("tenant-a"),
      intentId: " invalid",
      input: { idempotencyKey: "operator-request-001", reason: "invalid intent" },
      code: "invalid_request"
    },
    {
      actor: systemAdmin("tenant-a"),
      intentId: "security_mutation_valid",
      input: { idempotencyKey: "bad key", reason: "invalid key" },
      code: "invalid_request"
    }
  ] as const) {
    const fixture = await createFixture()
    await assert.rejects(
      () => fixture.service.redrive(testCase.actor, testCase.intentId, testCase.input),
      (error) => error instanceof SecurityMutationAuditQuarantineServiceError && error.code === testCase.code
    )
    assert.equal((await fixture.outbox.get("tenant-a", fixture.intentId)).status, "quarantined")
  }
})

async function createFixture() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-quarantine-service-test-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const intent = await outbox.prepare({
    actorId: "mutation-actor-1",
    tenantId: "tenant-a",
    targetType: "source",
    targetId: "source-1",
    operation: "source_governance.approve_publish",
    before: { status: "unreviewed" },
    proposedAfter: { status: "published" },
    reason: "source approval",
    policyVersion: "source-governance-approval-v1"
  })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await outbox.recordReconciliationFailure(
      "tenant-a",
      intent.intentId,
      "authoritative_resolution_failed",
      3
    )
  }
  return {
    outbox,
    intentId: intent.intentId,
    service: new SecurityMutationAuditQuarantineService(outbox)
  }
}

function systemAdmin(tenantId: string): AppUser {
  return {
    userId: "system-admin-1",
    cognitoGroups: ["SYSTEM_ADMIN"],
    accountStatus: "active",
    tenantId
  }
}
