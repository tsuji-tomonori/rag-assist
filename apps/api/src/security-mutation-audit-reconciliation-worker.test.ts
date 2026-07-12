import assert from "node:assert/strict"
import test from "node:test"
import type { ObjectStore, VersionedText } from "./adapters/object-store.js"
import {
  SourceGovernanceAuditAuthoritativeResolver
} from "./rag/offline/pre-retrieval/admission/source-governance-audit-reconciler.js"
import {
  readSourceGovernanceRecordById,
  sourceGovernanceAuditValue,
  sourceGovernanceRecordKey,
  type SourceGovernanceRecord
} from "./rag/offline/pre-retrieval/admission/source-governance-approval-service.js"
import {
  createSecurityMutationAuditReconciliationHandler
} from "./security-mutation-audit-reconciliation-worker.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  SecurityMutationAuditCompletionPendingError
} from "./security/security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security/security-mutation-audit-reconciler.js"

test("FR-086 production consumer rechecks authoritative state and duplicate workers emit one final result", async () => {
  const store = new VersionedMemoryObjectStore()
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(store, sequenceClock())
  const before = sourceRecord("source-1", "unreviewed", 1)
  const intent = await outbox.prepare({
    actorId: "reviewer-1",
    tenantId: "tenant-1",
    targetType: "source",
    targetId: before.sourceId,
    operation: "source_governance.approve_publish",
    before: sourceGovernanceAuditValue(before),
    proposedAfter: { status: "published" },
    reason: "reviewed",
    policyVersion: "source-governance-approval-v1"
  })
  const published = sourceRecord("source-1", "published", 2, intent.intentId)
  await putSourceRecord(store, published)
  const after = sourceGovernanceAuditValue(published)

  store.failNextCompletedAuditWrite()
  await assert.rejects(
    () => outbox.complete(intent.intentId, "tenant-1", "success", after),
    SecurityMutationAuditCompletionPendingError
  )
  assert.equal((await outbox.get("tenant-1", intent.intentId)).status, "finalization_pending")

  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new SourceGovernanceAuditAuthoritativeResolver(store, outbox, sequenceClock())
  ])
  const handler = createSecurityMutationAuditReconciliationHandler({
    authorizedTenantId: "tenant-1",
    reconciler
  })
  const results = await Promise.all(Array.from({ length: 8 }, () => handler({ tenantId: "tenant-1", limit: 10 })))

  const completed = await outbox.get("tenant-1", intent.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, after)
  assert.equal((await store.listKeys("security-audit/intents/tenant-1/")).length, 1)
  assert.ok(results.some((result) => result.completed === 1))
  assert.deepEqual(await handler({ tenantId: "tenant-1", limit: 10 }), {
    tenantId: "tenant-1",
    scanned: 0,
    completed: 0,
    repaired: 0
  })
})

test("FR-086 a durable source marker supplies the result and is restored only after audit completion", async () => {
  const store = new VersionedMemoryObjectStore()
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(store, sequenceClock())
  const before = sourceRecord("source-marker", "unreviewed", 1)
  const intent = await outbox.prepare({
    actorId: "reviewer-1",
    tenantId: "tenant-1",
    targetType: "source",
    targetId: before.sourceId,
    operation: "source_governance.approve_publish",
    before: sourceGovernanceAuditValue(before),
    proposedAfter: { status: "published" },
    reason: "reviewed",
    policyVersion: "source-governance-approval-v1"
  })
  const published = sourceRecord(before.sourceId, "published", 2, intent.intentId)
  const after = sourceGovernanceAuditValue(published)
  await putSourceRecord(store, {
    ...published,
    status: "reconciliation_required",
    revision: 3,
    auditReconciliation: {
      intentId: intent.intentId,
      result: "success",
      after,
      resumeStatus: "published",
      requestedAt: "2026-07-11T00:00:05.000Z"
    },
    lastFailureCode: "security_audit_completion_pending"
  })

  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new SourceGovernanceAuditAuthoritativeResolver(store, outbox, sequenceClock())
  ])
  store.failNextSourceGovernanceWrite()
  await assert.rejects(
    () => reconciler.reconcileTenant("tenant-1"),
    /simulated source governance write outage/
  )
  assert.equal((await outbox.get("tenant-1", intent.intentId)).status, "completed")
  assert.equal((await readSourceGovernanceRecordById(store, "tenant-1", before.sourceId))?.record.status, "reconciliation_required")

  const result = await reconciler.reconcileTenant("tenant-1")

  assert.equal(result.completed, 0)
  assert.equal(result.repaired, 1)
  assert.equal((await outbox.get("tenant-1", intent.intentId)).result, "success")
  const restored = await readSourceGovernanceRecordById(store, "tenant-1", before.sourceId)
  assert.equal(restored?.record.status, "published")
  assert.equal(restored?.record.auditReconciliation, undefined)
  assert.equal(restored?.record.lastFailureCode, undefined)
})

test("FR-086 worker and resolver reject cross-tenant, unknown, and stale authoritative targets", async () => {
  let calls = 0
  const handler = createSecurityMutationAuditReconciliationHandler({
    authorizedTenantId: "tenant-1",
    reconciler: {
      reconcileTenant: async (tenantId) => {
        calls += 1
        return { tenantId, scanned: 0, completed: 0, repaired: 0 }
      }
    }
  })
  await assert.rejects(() => handler({ tenantId: "tenant-2" }), /not authorized/)
  await assert.rejects(() => handler({}), /not authorized/)
  await assert.rejects(() => handler({ tenantId: "tenant-1", limit: 0 }), /limit is invalid/)
  assert.equal(calls, 0)

  const store = new VersionedMemoryObjectStore()
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(store, sequenceClock())
  const resolver = new SourceGovernanceAuditAuthoritativeResolver(store, outbox, sequenceClock())
  const reconciler = new SecurityMutationAuditReconciler(outbox, [resolver])
  const unknown = await outbox.prepare({
    actorId: "operator-1",
    tenantId: "tenant-1",
    targetType: "account",
    targetId: "account-1",
    operation: "account.disable",
    before: { status: "active" },
    proposedAfter: { status: "disabled" },
    reason: "policy",
    policyVersion: "v1"
  })
  await assert.rejects(
    () => reconciler.reconcileTenant("tenant-1"),
    /no unique authoritative resolver/
  )
  assert.equal((await outbox.get("tenant-1", unknown.intentId)).status, "pending")

  const missingStore = new VersionedMemoryObjectStore()
  const missingOutbox = new ObjectStoreSecurityMutationAuditOutbox(missingStore, sequenceClock())
  const missingIntent = await missingOutbox.prepare({
    actorId: "reviewer-1",
    tenantId: "tenant-1",
    targetType: "source",
    targetId: "missing-source",
    operation: "source_governance.restrict",
    before: { status: "published" },
    proposedAfter: { status: "restricted" },
    reason: "quality revoke",
    policyVersion: "source-governance-approval-v1"
  })
  const missingReconciler = new SecurityMutationAuditReconciler(missingOutbox, [
    new SourceGovernanceAuditAuthoritativeResolver(missingStore, missingOutbox, sequenceClock())
  ])
  await assert.rejects(
    () => missingReconciler.reconcileTenant("tenant-1"),
    /authoritative source governance target was not found/i
  )
  assert.equal((await missingOutbox.get("tenant-1", missingIntent.intentId)).status, "pending")

  const staleStore = new VersionedMemoryObjectStore()
  const staleOutbox = new ObjectStoreSecurityMutationAuditOutbox(staleStore, sequenceClock())
  const original = sourceRecord("source-stale", "unreviewed", 1)
  const staleIntent = await staleOutbox.prepare({
    actorId: "reviewer-1",
    tenantId: "tenant-1",
    targetType: "source",
    targetId: original.sourceId,
    operation: "source_governance.approve_publish",
    before: sourceGovernanceAuditValue(original),
    proposedAfter: { status: "published" },
    reason: "reviewed",
    policyVersion: "source-governance-approval-v1"
  })
  const expected = sourceRecord(original.sourceId, "published", 2, staleIntent.intentId)
  staleStore.failNextCompletedAuditWrite()
  await assert.rejects(
    () => staleOutbox.complete(staleIntent.intentId, "tenant-1", "success", sourceGovernanceAuditValue(expected)),
    SecurityMutationAuditCompletionPendingError
  )
  await putSourceRecord(staleStore, {
    ...sourceRecord(original.sourceId, "restricted", 3, "newer-intent"),
    restriction: {
      dimensions: ["quality"],
      deniedPurposes: [],
      restrictedBy: "reviewer-2",
      restrictedAt: "2026-07-11T00:00:08.000Z",
      reason: "newer deny"
    }
  })
  const staleReconciler = new SecurityMutationAuditReconciler(staleOutbox, [
    new SourceGovernanceAuditAuthoritativeResolver(staleStore, staleOutbox, sequenceClock())
  ])
  await assert.rejects(
    () => staleReconciler.reconcileTenant("tenant-1"),
    /does not match the requested audit completion/
  )
  assert.equal((await staleOutbox.get("tenant-1", staleIntent.intentId)).status, "finalization_pending")
})

function sourceRecord(
  sourceId: string,
  status: SourceGovernanceRecord["status"],
  revision: number,
  auditIntentId?: string
): SourceGovernanceRecord {
  return {
    schemaVersion: 1,
    sourceId,
    sourceVersion: "source-version-1",
    sourceManifestObjectKey: `manifests/${sourceId}.json`,
    tenantId: "tenant-1",
    ownerUserId: "owner-1",
    status,
    revision,
    auditIntentId,
    activeDocumentId: status === "published" || status === "restricted" ? `active-${sourceId}` : undefined,
    publishedAt: status === "published" || status === "restricted" ? "2026-07-11T00:00:04.000Z" : undefined,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:04.000Z"
  }
}

async function putSourceRecord(store: ObjectStore, record: SourceGovernanceRecord): Promise<void> {
  await store.putText(
    sourceGovernanceRecordKey(record.tenantId, record.sourceId),
    JSON.stringify(record, null, 2),
    "application/json"
  )
}

function sequenceClock(): () => Date {
  let milliseconds = Date.parse("2026-07-11T00:00:00.000Z")
  return () => {
    milliseconds += 1_000
    return new Date(milliseconds)
  }
}

class VersionedMemoryObjectStore implements ObjectStore {
  private readonly values = new Map<string, { text: string; version: number }>()
  private completedAuditWriteFailures = 0
  private sourceGovernanceWriteFailures = 0

  failNextCompletedAuditWrite(): void {
    this.completedAuditWriteFailures += 1
  }

  failNextSourceGovernanceWrite(): void {
    this.sourceGovernanceWriteFailures += 1
  }

  async putText(key: string, text: string): Promise<void> {
    const current = this.values.get(key)
    this.values.set(key, { text, version: (current?.version ?? 0) + 1 })
  }

  async putTextIfVersion(key: string, text: string, expectedVersion: string | undefined): Promise<void> {
    const current = this.values.get(key)
    if ((current === undefined ? undefined : String(current.version)) !== expectedVersion) {
      throw Object.assign(new Error(`Conditional write failed for ${key}`), { code: "PRECONDITION_FAILED" })
    }
    if (
      this.completedAuditWriteFailures > 0
      && key.startsWith("security-audit/intents/")
      && (JSON.parse(text) as { status?: string }).status === "completed"
    ) {
      this.completedAuditWriteFailures -= 1
      throw new Error("simulated completed audit event write outage")
    }
    if (this.sourceGovernanceWriteFailures > 0 && key.startsWith("source-governance/")) {
      this.sourceGovernanceWriteFailures -= 1
      throw new Error("simulated source governance write outage")
    }
    this.values.set(key, { text, version: (current?.version ?? 0) + 1 })
  }

  async getText(key: string): Promise<string> {
    const value = this.values.get(key)
    if (!value) throw Object.assign(new Error(`No such key: ${key}`), { code: "ENOENT" })
    return value.text
  }

  async getTextWithVersion(key: string): Promise<VersionedText> {
    const value = this.values.get(key)
    if (!value) throw Object.assign(new Error(`No such key: ${key}`), { code: "ENOENT" })
    return { text: value.text, version: String(value.version) }
  }

  async listKeys(prefix: string): Promise<string[]> {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort()
  }

  async deleteObject(key: string): Promise<void> { this.values.delete(key) }
  async putBytes(): Promise<void> { throw new Error("not implemented") }
  async getBytes(): Promise<Buffer> { throw new Error("not implemented") }
  async getObjectSize(): Promise<number> { throw new Error("not implemented") }
}
