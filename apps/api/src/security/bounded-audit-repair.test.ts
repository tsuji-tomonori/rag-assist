import assert from "node:assert/strict"
import test from "node:test"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"
import type { SecurityMutationAuditReconciliationOutboxPort } from "./security-mutation-audit-outbox.js"
import { validateBoundedRepairEvent } from "../security-mutation-audit-reconciliation-worker.js"

test("explicit audit repair rejects an unbounded or cross-tenant request before reads", async () => {
  const reconciler = new SecurityMutationAuditReconciler({ get: async () => { throw new Error("unexpected read") } } as never, [{ supports: () => true, resolve: async () => { throw new Error("unused") } }])
  for (const ids of [[], ["a", "a"], Array.from({ length: 101 }, (_, i) => String(i))]) {
    await assert.rejects(reconciler.reconcileIntents("tenant-a", ids), /unique intent IDs/)
  }
  assert.throws(() => validateBoundedRepairEvent({ tenantId: "tenant-b", intentIds: ["a"] }, "tenant-a"), /not authorized/)
  assert.throws(() => validateBoundedRepairEvent({ tenantId: "tenant-a" }, "tenant-a"), /unique intent IDs/)
})

test("explicit audit repair reads candidates only and leaves completed/quarantined intents unchanged", async () => {
  const reads: string[] = []
  const store = { get: async (_tenant: string, id: string) => {
    reads.push(id)
    return { draft: { tenantId: "tenant-a" }, status: id === "done" ? "completed" : "quarantined" }
  }, listPending: async () => { throw new Error("forbidden LIST") }, listAll: async () => { throw new Error("forbidden LIST") } }
  const resolver = { supports: () => true, resolve: async () => { throw new Error("unexpected resolve") }, repairCompleted: async () => { throw new Error("forbidden historical repair") } }
  const reconciler = new SecurityMutationAuditReconciler(store as unknown as SecurityMutationAuditReconciliationOutboxPort, [resolver])
  const result = await reconciler.reconcileIntents("tenant-a", ["done", "quarantined"])
  assert.deepEqual(reads, ["done", "quarantined"])
  assert.equal(result.scanned, 0)
  assert.equal(result.repaired, 0)
  assert.equal(result.repairDeferred, 0)
})
