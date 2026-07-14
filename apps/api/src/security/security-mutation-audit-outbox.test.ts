import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { ObjectStore, VersionedText } from "../adapters/object-store.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  SecurityMutationAuditCompletionPendingError
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
