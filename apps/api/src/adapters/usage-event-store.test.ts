import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "./local-object-store.js"
import { InMemoryUsageEventStore, ObjectStoreUsageEventStore } from "./usage-event-store.js"
import type { UsageEvent } from "../types.js"

function event(index: number, tenantId = "tenant-a", overrides: Partial<UsageEvent> = {}): UsageEvent {
  const occurredAt = new Date(Date.UTC(2026, 4, 1, 0, 0, index)).toISOString()
  return {
    schemaVersion: 1,
    eventId: `event-${String(index).padStart(4, "0")}`,
    tenantId,
    subjectId: `subject-${index % 3}`,
    runId: `run-${index}`,
    feature: index % 2 === 0 ? "chat" : "embedding",
    provider: "bedrock",
    region: "ap-northeast-1",
    modelId: "model-a",
    quantities: [{ unit: "input_token", value: index + 1, source: "provider" }],
    status: "succeeded",
    idempotencyKey: `operation-${index}`,
    occurredAt,
    recordedAt: occurredAt,
    ...overrides
  }
}

test("usage store traverses more than 1,000 tenant events through every stable cursor page", async () => {
  const store = new InMemoryUsageEventStore()
  for (let index = 0; index < 1205; index += 1) await store.putOnce(event(index))
  for (let index = 0; index < 15; index += 1) await store.putOnce(event(index, "tenant-b"))

  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = await store.query("tenant-a", {
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-05-02T00:00:00.000Z",
      limit: 137,
      cursor
    })
    ids.push(...page.events.map((item) => item.eventId))
    cursor = page.nextCursor
  } while (cursor)

  assert.equal(ids.length, 1205)
  assert.equal(new Set(ids).size, 1205)
  assert.ok(ids.every((id) => id.startsWith("event-")))
})

test("idempotency is scoped by tenant and a cursor cannot be reused with another query", async () => {
  const store = new InMemoryUsageEventStore()
  assert.equal(await store.putOnce(event(1, "tenant-a", { idempotencyKey: "same" })), "inserted")
  assert.equal(await store.putOnce(event(2, "tenant-a", { idempotencyKey: "same" })), "duplicate")
  assert.equal(await store.putOnce(event(3, "tenant-b", { idempotencyKey: "same" })), "inserted")
  await store.putOnce(event(4, "tenant-a"))

  const first = await store.query("tenant-a", { periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-02T00:00:00.000Z", limit: 1 })
  assert.equal(first.events.length, 1)
  assert.ok(first.nextCursor)
  await assert.rejects(
    () => store.query("tenant-a", { periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-02T00:00:00.000Z", feature: "chat", limit: 1, cursor: first.nextCursor }),
    /Invalid usage cursor/
  )
  assert.equal((await store.query("tenant-b", { periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-02T00:00:00.000Z" })).events.length, 1)
})

test("usage periods are half-open and invalid periods fail explicitly", async () => {
  const store = new InMemoryUsageEventStore()
  await store.putOnce(event(0, "tenant-a", { occurredAt: "2026-05-01T00:00:00.000Z" }))
  await store.putOnce(event(1, "tenant-a", { occurredAt: "2026-06-01T00:00:00.000Z" }))
  const page = await store.query("tenant-a", { periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-06-01T00:00:00.000Z" })
  assert.deepEqual(page.events.map((item) => item.eventId), ["event-0000"])
  await assert.rejects(() => store.query("tenant-a", { periodStart: "2026-06-01T00:00:00.000Z", periodEnd: "2026-05-01T00:00:00.000Z" }), /Invalid half-open usage period/)
})

test("object-store usage idempotency remains atomic under concurrent replay", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "usage-event-store-"))
  const store = new ObjectStoreUsageEventStore(new LocalObjectStore(dataDir))
  const results = await Promise.all(Array.from({ length: 20 }, () => store.putOnce(event(1))))

  assert.equal(results.filter((result) => result === "inserted").length, 1)
  assert.equal(results.filter((result) => result === "duplicate").length, 19)
  const page = await store.query("tenant-a", {
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-05-02T00:00:00.000Z"
  })
  assert.deepEqual(page.events.map((item) => item.eventId), ["event-0001"])
})
