import assert from "node:assert/strict"
import test from "node:test"
import {
  createCostPrioritySecurityMutationAuditReconciliationHandler
} from "./security-mutation-audit-reconciliation-worker.js"

test("cost-priority security audit consumer validates the tenant and performs no reconciliation scan", async () => {
  const handler = createCostPrioritySecurityMutationAuditReconciliationHandler("tenant-1")

  assert.deepEqual(await handler({ tenantId: "tenant-1", limit: 100 }), {
    tenantId: "tenant-1",
    scanned: 0,
    completed: 0,
    repaired: 0
  })
  await assert.rejects(() => handler({ tenantId: "tenant-2" }), /not authorized/)
  await assert.rejects(() => handler({ tenantId: "tenant-1", limit: 0 }), /limit is invalid/)
})
