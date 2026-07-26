import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { ObjectStore, VersionedText } from "../adapters/object-store.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  SecurityMutationAuditCompletionPendingError,
  SecurityMutationAuditRedriveError
} from "./security-mutation-audit-outbox.js"

test("security mutation audit outbox persists intent before final result", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objectStore, () => new Date("2026-07-11T00:00:00.000Z"))
  const intent = await outbox.prepare({
    actorId: "actor-1",
    tenantId: "tenant-a",
    targetType: "resourceGroup",
    targetId: "team-a",
    operation: "membership.replace",
    before: [],
    proposedAfter: [{ memberType: "user", memberId: "user-1" }],
    reason: "担当追加",
    policyVersion: "membership-policy-v1"
  })

  assert.equal(intent.status, "pending")
  const keys = await objectStore.listKeys("security-audit/intents/")
  assert.equal(keys.length, 1)

  const completed = await outbox.complete(intent.intentId, "tenant-a", "success", intent.draft.proposedAfter)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, intent.draft.proposedAfter)
  assert.deepEqual(
    await outbox.complete(intent.intentId, "tenant-a", "success", intent.draft.proposedAfter),
    completed
  )
  await assert.rejects(() => outbox.complete(intent.intentId, "tenant-a", "success", []), /different result/)
})

test("security mutation audit outbox fails closed on invalid identity fields", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-invalid-test-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  await assert.rejects(() => outbox.prepare({
    actorId: " actor-1",
    tenantId: "tenant-a",
    targetType: "document",
    targetId: "doc-1",
    operation: "share.replace",
    before: [],
    proposedAfter: [],
    reason: "共有解除",
    policyVersion: "policy-v1"
  }), /missing or non-canonical/)
})

test("pending audit listing is tenant-scoped and rejects cross-tenant identity lookup", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-tenant-test-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const tenantA = await outbox.prepare(draft("tenant-a", "source-a"))
  await outbox.prepare(draft("tenant-b", "source-b"))

  assert.deepEqual((await outbox.listPending("tenant-a")).map((intent) => intent.intentId), [tenantA.intentId])
  await outbox.complete(tenantA.intentId, "tenant-a", "denied", tenantA.draft.before)
  assert.deepEqual((await outbox.listAll("tenant-a")).map((intent) => [intent.intentId, intent.result]), [[tenantA.intentId, "denied"]])
  assert.deepEqual((await outbox.listAll("tenant-b")).map((intent) => intent.draft.targetId), ["source-b"])
  await assert.rejects(() => outbox.get("tenant-b", tenantA.intentId), /not found/)
  await assert.rejects(() => outbox.listPending(" tenant-a"), /tenantId is invalid/)
})

test("duplicate workers converge on exactly one immutable completion", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-race-test-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const intent = await outbox.prepare(draft("tenant-a", "source-race"))
  const after = { status: "published", revision: 2 }

  const completed = await Promise.all(Array.from({ length: 8 }, () => (
    outbox.complete(intent.intentId, "tenant-a", "success", after)
  )))
  assert.ok(completed.every((item) => item.status === "completed"))
  assert.equal(new Set(completed.map((item) => item.completedAt)).size, 1)
  assert.deepEqual(await outbox.listPending("tenant-a"), [])
  await assert.rejects(
    () => outbox.complete(intent.intentId, "tenant-a", "failed", after),
    /different result/
  )
})

test("a durable finalization request survives final event write failure and retry converges", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-finalize-test-"))
  const inner = new LocalObjectStore(dataDir)
  const store = new FinalEventFailingObjectStore(inner)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(store)
  const intent = await outbox.prepare(draft("tenant-a", "source-pending"))
  const after = { status: "restricted", revision: 3 }

  await assert.rejects(
    () => outbox.complete(intent.intentId, "tenant-a", "success", after),
    (error) => {
      assert.ok(error instanceof SecurityMutationAuditCompletionPendingError)
      assert.equal(error.intent.status, "finalization_pending")
      assert.equal(error.intent.requestedCompletion?.result, "success")
      assert.deepEqual(error.intent.requestedCompletion?.after, after)
      return true
    }
  )
  assert.equal((await outbox.listPending("tenant-a"))[0]?.status, "finalization_pending")

  store.failCompletedWrites = false
  const completed = await outbox.complete(intent.intentId, "tenant-a", "success", after)
  assert.equal(completed.status, "completed")
  assert.deepEqual(await outbox.listPending("tenant-a"), [])
})

test("pending enumeration applies its limit after filtering completed records", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-limit-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objectStore)
  await Promise.all(Array.from({ length: 5 }, (_, index) => outbox.prepare(draft("tenant-a", `source-${index}`))))
  const ordered = await Promise.all((await objectStore.listKeys("security-audit/intents/tenant-a/")).sort().map(async (key) => ({
    key,
    intent: JSON.parse(await objectStore.getText(key)) as Awaited<ReturnType<typeof outbox.prepare>>
  })))
  const expectedPending = ordered.at(-1)!.intent
  await Promise.all(ordered.slice(0, -1).map(({ intent }) => (
    outbox.complete(intent.intentId, "tenant-a", "success", { status: "published" })
  )))

  assert.deepEqual((await outbox.listPending("tenant-a", 1)).map((intent) => intent.intentId), [expectedPending.intentId])
})

test("reconciliation failures converge on a bounded durable quarantine and leave raw errors unstored", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-quarantine-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(
    objectStore,
    () => new Date("2026-07-11T00:00:20.000Z")
  )
  const intent = await outbox.prepare(draft("tenant-a", "source-poison"))

  await Promise.all(Array.from({ length: 8 }, () => outbox.recordReconciliationFailure(
    "tenant-a",
    intent.intentId,
    "authoritative_resolution_failed",
    3
  )))

  const quarantined = await outbox.get("tenant-a", intent.intentId)
  assert.equal(quarantined.status, "quarantined")
  assert.deepEqual(quarantined.reconciliation, {
    attempts: 3,
    maxAttempts: 3,
    lastFailureCode: "authoritative_resolution_failed",
    lastAttemptedAt: "2026-07-11T00:00:20.000Z",
    quarantinedAt: "2026-07-11T00:00:20.000Z"
  })
  assert.deepEqual(await outbox.listPending("tenant-a"), [])
  assert.doesNotMatch(JSON.stringify(quarantined), /stack|simulated|exception/i)
  await assert.rejects(
    () => outbox.recordReconciliationFailure("tenant-b", intent.intentId, "authoritative_resolution_failed", 3),
    /not found/
  )
})

test("corrupt and stale reconciliation evidence fails closed", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-corrupt-quarantine-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objectStore)
  const intent = await outbox.prepare(draft("tenant-a", "source-corrupt"))
  const [key] = await objectStore.listKeys("security-audit/intents/tenant-a/")
  await objectStore.putText(key!, JSON.stringify({
    ...intent,
    status: "quarantined",
    reconciliation: {
      attempts: 2,
      maxAttempts: 3,
      lastFailureCode: "raw_infrastructure_error",
      lastAttemptedAt: "not-a-timestamp",
      quarantinedAt: "2026-07-11T00:00:20.000Z"
    }
  }))

  await assert.rejects(() => outbox.get("tenant-a", intent.intentId), /reconciliation evidence is invalid/)
})

test("quarantined intent redrive atomically preserves operator audit and restores scheduled pending state", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-redrive-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(
    objectStore,
    () => new Date("2026-07-17T09:30:00.000Z")
  )
  const intent = await outbox.prepare(draft("tenant-a", "source-redrive"))
  await quarantine(outbox, intent.intentId)

  const accepted = await outbox.redriveQuarantined("tenant-a", intent.intentId, redriveCommand())

  assert.deepEqual(accepted, {
    intentId: intent.intentId,
    status: "pending",
    idempotencyKey: "redrive-001",
    requestedAt: "2026-07-17T09:30:00.000Z",
    redriveCount: 1
  })
  const restored = await outbox.get("tenant-a", intent.intentId)
  assert.equal(restored.status, "pending")
  assert.equal(restored.reconciliation, undefined)
  assert.deepEqual(restored.redriveHistory, [{
    idempotencyKey: "redrive-001",
    actorId: "system-admin-1",
    reason: "resolver deployment completed",
    policyVersion: "security-audit-quarantine-redrive-v1:memorag-access-role-catalog-v3",
    requestedAt: "2026-07-17T09:30:00.000Z",
    restoredStatus: "pending",
    previousReconciliation: {
      attempts: 3,
      maxAttempts: 3,
      lastFailureCode: "authoritative_resolution_failed",
      lastAttemptedAt: "2026-07-17T09:30:00.000Z",
      quarantinedAt: "2026-07-17T09:30:00.000Z"
    }
  }])
  assert.deepEqual((await outbox.listPending("tenant-a")).map((candidate) => candidate.intentId), [intent.intentId])
})

test("redrive restores finalization_pending when a durable requested completion exists", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-redrive-finalization-test-"))
  const inner = new LocalObjectStore(dataDir)
  const store = new FinalEventFailingObjectStore(inner)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(store)
  const intent = await outbox.prepare(draft("tenant-a", "source-finalization-redrive"))
  const after = { status: "published", revision: 2 }
  await assert.rejects(() => outbox.complete(intent.intentId, "tenant-a", "success", after))
  await quarantine(outbox, intent.intentId)

  const accepted = await outbox.redriveQuarantined("tenant-a", intent.intentId, redriveCommand())

  assert.equal(accepted.status, "finalization_pending")
  const restored = await outbox.get("tenant-a", intent.intentId)
  assert.equal(restored.status, "finalization_pending")
  assert.deepEqual(restored.requestedCompletion?.after, after)
  assert.equal(restored.redriveHistory?.[0]?.restoredStatus, "finalization_pending")
})

test("duplicate redrive requests converge and remain idempotent after worker completion", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-redrive-duplicate-test-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const intent = await outbox.prepare(draft("tenant-a", "source-redrive-duplicate"))
  await quarantine(outbox, intent.intentId)

  const duplicates = await Promise.all(Array.from({ length: 8 }, () => (
    outbox.redriveQuarantined("tenant-a", intent.intentId, redriveCommand())
  )))
  assert.equal(new Set(duplicates.map((result) => JSON.stringify(result))).size, 1)
  assert.equal((await outbox.get("tenant-a", intent.intentId)).redriveHistory?.length, 1)

  await outbox.complete(intent.intentId, "tenant-a", "success", intent.draft.proposedAfter)
  assert.deepEqual(
    await outbox.redriveQuarantined("tenant-a", intent.intentId, redriveCommand()),
    duplicates[0]
  )
})

test("redrive rejects idempotency payload drift and a second operation while the intent is active", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-redrive-conflict-test-"))
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const intent = await outbox.prepare(draft("tenant-a", "source-redrive-conflict"))
  await quarantine(outbox, intent.intentId)
  await outbox.redriveQuarantined("tenant-a", intent.intentId, redriveCommand())

  await assert.rejects(
    () => outbox.redriveQuarantined("tenant-a", intent.intentId, { ...redriveCommand(), reason: "different reason" }),
    (error) => error instanceof SecurityMutationAuditRedriveError && error.code === "idempotency_conflict"
  )
  await assert.rejects(
    () => outbox.redriveQuarantined("tenant-a", intent.intentId, { ...redriveCommand(), idempotencyKey: "redrive-002" }),
    (error) => error instanceof SecurityMutationAuditRedriveError && error.code === "not_quarantined"
  )
})

test("redrive hides cross-tenant intent identity and fails closed on corrupt quarantine evidence", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-redrive-boundary-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objectStore)
  const intent = await outbox.prepare(draft("tenant-a", "source-redrive-boundary"))
  await quarantine(outbox, intent.intentId)

  await assert.rejects(
    () => outbox.redriveQuarantined("tenant-b", intent.intentId, redriveCommand()),
    (error) => error instanceof SecurityMutationAuditRedriveError && error.code === "not_found"
  )

  const [key] = await objectStore.listKeys("security-audit/intents/tenant-a/")
  const stored = JSON.parse(await objectStore.getText(key!))
  stored.reconciliation.attempts = 2
  await objectStore.putText(key!, JSON.stringify(stored))
  await assert.rejects(
    () => outbox.redriveQuarantined("tenant-a", intent.intentId, redriveCommand()),
    (error) => error instanceof SecurityMutationAuditRedriveError && error.code === "unavailable"
  )
})

test("redrive audit write failure leaves the intent quarantined", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-redrive-write-failure-test-"))
  const inner = new LocalObjectStore(dataDir)
  const store = new RedriveFailingObjectStore(inner)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(store)
  const intent = await outbox.prepare(draft("tenant-a", "source-redrive-write-failure"))
  await quarantine(outbox, intent.intentId)
  store.failRedriveWrites = true

  await assert.rejects(
    () => outbox.redriveQuarantined("tenant-a", intent.intentId, redriveCommand()),
    (error) => error instanceof SecurityMutationAuditRedriveError && error.code === "unavailable"
  )
  const unchanged = await outbox.get("tenant-a", intent.intentId)
  assert.equal(unchanged.status, "quarantined")
  assert.equal(unchanged.redriveHistory, undefined)
})

test("completed schema-v1 records from the pre-staging writer remain readable and immutable", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "security-audit-outbox-legacy-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objectStore)
  const intent = await outbox.prepare(draft("tenant-a", "source-legacy"))
  const [key] = await objectStore.listKeys("security-audit/intents/tenant-a/")
  const legacyCompleted = {
    ...intent,
    status: "completed",
    result: "denied",
    after: intent.draft.before,
    completedAt: "2026-07-11T00:00:10.000Z"
  }
  await objectStore.putText(key!, JSON.stringify(legacyCompleted, null, 2), "application/json")

  assert.deepEqual(await outbox.get("tenant-a", intent.intentId), legacyCompleted)
  assert.deepEqual(
    await outbox.complete(intent.intentId, "tenant-a", "denied", intent.draft.before),
    legacyCompleted
  )
})

function draft(tenantId: string, targetId: string) {
  return {
    actorId: "actor-1",
    tenantId,
    targetType: "source",
    targetId,
    operation: "source_governance.approve_publish",
    before: { status: "unreviewed", revision: 1 },
    proposedAfter: { status: "published" },
    reason: "情報源承認",
    policyVersion: "source-governance-approval-v1"
  }
}

function redriveCommand() {
  return {
    actorId: "system-admin-1",
    idempotencyKey: "redrive-001",
    reason: "resolver deployment completed",
    policyVersion: "security-audit-quarantine-redrive-v1:memorag-access-role-catalog-v3"
  }
}

async function quarantine(outbox: ObjectStoreSecurityMutationAuditOutbox, intentId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await outbox.recordReconciliationFailure(
      "tenant-a",
      intentId,
      "authoritative_resolution_failed",
      3
    )
  }
}

class FinalEventFailingObjectStore implements ObjectStore {
  failCompletedWrites = true

  constructor(private readonly inner: ObjectStore) {}

  putText(key: string, text: string, contentType?: string): Promise<void> {
    return this.inner.putText(key, text, contentType)
  }

  putTextIfVersion(key: string, text: string, expectedVersion: string | undefined, contentType?: string): Promise<void> {
    if (this.failCompletedWrites && text.includes('"status": "completed"')) {
      throw new Error("simulated final audit event outage")
    }
    return this.inner.putTextIfVersion(key, text, expectedVersion, contentType)
  }

  putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
    return this.inner.putBytes(key, bytes, contentType)
  }

  getText(key: string): Promise<string> { return this.inner.getText(key) }
  getTextWithVersion(key: string): Promise<VersionedText> { return this.inner.getTextWithVersion(key) }
  getBytes(key: string): Promise<Buffer> { return this.inner.getBytes(key) }
  getObjectSize(key: string): Promise<number> { return this.inner.getObjectSize(key) }
  deleteObject(key: string): Promise<void> { return this.inner.deleteObject(key) }
  listKeys(prefix: string): Promise<string[]> { return this.inner.listKeys(prefix) }
}

class RedriveFailingObjectStore implements ObjectStore {
  failRedriveWrites = false

  constructor(private readonly inner: ObjectStore) {}

  putText(key: string, text: string, contentType?: string): Promise<void> {
    return this.inner.putText(key, text, contentType)
  }

  putTextIfVersion(key: string, text: string, expectedVersion: string | undefined, contentType?: string): Promise<void> {
    if (this.failRedriveWrites && text.includes('"redriveHistory"')) {
      throw new Error("simulated redrive audit outage")
    }
    return this.inner.putTextIfVersion(key, text, expectedVersion, contentType)
  }

  putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
    return this.inner.putBytes(key, bytes, contentType)
  }

  getText(key: string): Promise<string> { return this.inner.getText(key) }
  getTextWithVersion(key: string): Promise<VersionedText> { return this.inner.getTextWithVersion(key) }
  getBytes(key: string): Promise<Buffer> { return this.inner.getBytes(key) }
  getObjectSize(key: string): Promise<number> { return this.inner.getObjectSize(key) }
  deleteObject(key: string): Promise<void> { return this.inner.deleteObject(key) }
  listKeys(prefix: string): Promise<string[]> { return this.inner.listKeys(prefix) }
}
