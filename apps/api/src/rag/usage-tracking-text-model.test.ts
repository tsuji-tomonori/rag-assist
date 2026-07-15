import assert from "node:assert/strict"
import test from "node:test"
import type { TextModel } from "../adapters/text-model.js"
import { InMemoryUsageEventStore } from "../adapters/usage-event-store.js"
import { UsageTrackingTextModel } from "./_shared/usage/usage-tracking-text-model.js"

test("tracking records provider quantities and replay uses the same tenant-scoped idempotency key", async () => {
  const inner: TextModel = {
    embed: async (_text, options) => { options?.onUsage?.({ inputTokens: 3, outputTokens: 0 }); return [0.1] },
    generate: async (_prompt, options) => { options?.onUsage?.({ inputTokens: 5, outputTokens: 2 }); return "answer" }
  }
  const store = new InMemoryUsageEventStore()
  const context = { tenantId: "tenant-a", subjectId: "subject-a", runId: "run-a", feature: "chat" }
  await new UsageTrackingTextModel(inner, store, context).generate("question")
  await new UsageTrackingTextModel(inner, store, context).generate("question")
  const page = await store.query("tenant-a", { periodStart: "2020-01-01T00:00:00.000Z", periodEnd: "2030-01-01T00:00:00.000Z" })
  assert.equal(page.events.length, 1)
  assert.deepEqual(page.events[0]?.quantities.map((item) => item.source), ["provider", "provider"])
})

test("tracking separates tokenizer estimates from missing values and never invents a tenant", async () => {
  const inner: TextModel = { embed: async () => [0.1], generate: async () => "" }
  const store = new InMemoryUsageEventStore()
  const model = new UsageTrackingTextModel(inner, store, { tenantId: "tenant-a", runId: "run-b" })
  await model.generate("non-empty prompt")
  await model.embed("")
  const page = await store.query("tenant-a", { periodStart: "2020-01-01T00:00:00.000Z", periodEnd: "2030-01-01T00:00:00.000Z" })
  assert.equal(page.events[0]?.quantities[0]?.source, "tokenizer_estimate")
  assert.equal(page.events[1]?.quantities[0]?.source, "missing")
  assert.throws(() => new UsageTrackingTextModel(inner, store, { tenantId: "", runId: "run" }), /requires tenantId/)
})
