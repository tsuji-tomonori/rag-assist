import assert from "node:assert/strict"
import test from "node:test"
import { monitoringWindow } from "./rag-quality-monitor-worker.js"

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
