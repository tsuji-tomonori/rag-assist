import assert from "node:assert/strict"
import test from "node:test"
import {
  createCostPriorityRagQualityMonitorHandler,
  monitoringWindow
} from "./rag-quality-monitor-worker.js"
import {
  ACTIVE_RAG_QUALITY_POLICY_KEY,
  RAG_SAFETY_STATE_KEY,
  type RagSafetyState
} from "./rag/quality-control/production-rag-monitor.js"

test("FR-093 scheduled monitor derives a bounded explicit UTC observation window", () => {
  const window = monitoringWindow({ windowMinutes: 15 }, new Date("2026-07-11T03:00:00.000Z"))
  assert.deepEqual(window, {
    windowStart: "2026-07-11T02:45:00.000Z",
    windowEnd: "2026-07-11T03:00:00.000Z",
    evaluatedAt: "2026-07-11T03:00:00.000Z"
  })
})

test("FR-093 monitor rejects invalid or reversed windows", () => {
  assert.throws(() => monitoringWindow({ windowStart: "invalid", windowEnd: "2026-07-11T03:00:00.000Z" }), /Invalid/)
  assert.throws(() => monitoringWindow({ windowStart: "2026-07-11T04:00:00.000Z", windowEnd: "2026-07-11T03:00:00.000Z" }), /Invalid/)
})

test("cost-priority scheduled monitor performs one direct policy read and safety-state write without a list adapter", async () => {
  const calls: Array<{ operation: "get" | "put"; key: string }> = []
  let written = ""
  const handler = createCostPriorityRagQualityMonitorHandler({
    objectStore: {
      getText: async (key) => {
        calls.push({ operation: "get", key })
        return JSON.stringify({
          profileId: "memorag-dev-rag-quality",
          version: "2026-07-16.draft-1",
          runtimeProfileVersion: "1"
        })
      },
      putText: async (key, text) => {
        calls.push({ operation: "put", key })
        written = text
      }
    },
    now: () => new Date("2026-07-22T00:05:00.000Z"),
    safetyStateTtlSeconds: 600
  })

  const result = await handler({ windowMinutes: 5 })
  const state = JSON.parse(written) as RagSafetyState

  assert.deepEqual(calls, [
    { operation: "get", key: ACTIVE_RAG_QUALITY_POLICY_KEY },
    { operation: "put", key: RAG_SAFETY_STATE_KEY }
  ])
  assert.equal(result.monitoringDisabled, true)
  assert.equal(result.disabledReason, "cost_priority")
  assert.equal(result.observationCount, 0)
  assert.equal(result.alertCount, 0)
  assert.equal(state.responseMode, "normal")
  assert.equal(state.promotionFrozen, false)
  assert.equal(state.documentQuarantineRequired, false)
  assert.equal(state.activeRuntimeProfileVersion, "1")
  assert.equal(state.validUntil, "2026-07-22T00:15:00.000Z")
})
