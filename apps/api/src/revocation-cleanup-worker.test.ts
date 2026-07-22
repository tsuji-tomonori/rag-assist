import assert from "node:assert/strict"
import test from "node:test"
import {
  createRevocationCleanupHandler,
  handler as scheduledRevocationCleanupHandler
} from "./revocation-cleanup-worker.js"

test("FR-066 cleanup worker processes only canonical explicit tenant partitions", async () => {
  const seen: Array<{ tenantId: string; limit: number | undefined }> = []
  const handler = createRevocationCleanupHandler({
    reconcilePending: async (tenantId, limit) => {
      seen.push({ tenantId, limit })
      return {
        tenantId,
        examined: 1,
        completed: tenantId === "tenant-a" ? 1 : 0,
        superseded: tenantId === "tenant-b" ? 1 : 0,
        reconciliationRequired: 0,
        operationIds: [`operation-${tenantId}`]
      }
    }
  })

  const result = await handler({ tenantIds: ["tenant-b", "tenant-a", "tenant-a"], limitPerTenant: 25 })
  assert.deepEqual(seen, [
    { tenantId: "tenant-a", limit: 25 },
    { tenantId: "tenant-b", limit: 25 }
  ])
  assert.deepEqual({
    tenantCount: result.tenantCount,
    examined: result.examined,
    completed: result.completed,
    superseded: result.superseded,
    reconciliationRequired: result.reconciliationRequired
  }, {
    tenantCount: 2,
    examined: 2,
    completed: 1,
    superseded: 1,
    reconciliationRequired: 0
  })
})

test("FR-066 cleanup worker accepts an empty registry but rejects unavailable, blank, unbounded, or non-canonical tenant input", async () => {
  const handler = createRevocationCleanupHandler({
    reconcilePending: async () => { throw new Error("must not run") }
  }, () => [])

  assert.deepEqual(await handler({}), {
    tenantCount: 0,
    examined: 0,
    completed: 0,
    superseded: 0,
    reconciliationRequired: 0,
    tenants: []
  })
  await assert.rejects(
    () => createRevocationCleanupHandler({ reconcilePending: async () => { throw new Error("must not run") } })({}),
    /registry is unavailable/
  )
  await assert.rejects(() => handler({ tenantIds: [" tenant-a"] }), /invalid tenant/)
  await assert.rejects(() => handler({ tenantIds: ["tenant-a"], limitPerTenant: 0 }), /between 1 and 1000/)
  await assert.rejects(() => handler({ tenantIds: "tenant-a" }), /non-empty array/)
})

test("cost-priority scheduled revocation cleanup does not discover tenants or reconcile manifests", async () => {
  assert.deepEqual(
    await scheduledRevocationCleanupHandler({ tenantIds: ["tenant-a"], limitPerTenant: 100 }),
    {
      tenantCount: 0,
      examined: 0,
      completed: 0,
      superseded: 0,
      reconciliationRequired: 0,
      tenants: []
    }
  )
})
