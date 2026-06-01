import assert from "node:assert/strict"
import test from "node:test"

import type { EmbedOptions, GenerateOptions, TextModel, TextModelTokenUsage } from "../adapters/text-model.js"
import type { UsageEvent } from "../types.js"
import type { UsageEventStore } from "../adapters/usage-event-store.js"
import { UsageTrackingTextModel } from "./usage-tracking-text-model.js"

class MemoryUsageEventStore implements UsageEventStore {
  readonly events: UsageEvent[] = []

  async putOnce(event: UsageEvent): Promise<void> {
    if (this.events.some((candidate) => candidate.idempotencyKey === event.idempotencyKey)) return
    this.events.push(event)
  }

  async list(): Promise<UsageEvent[]> {
    return this.events
  }
}

class FakeTextModel implements TextModel {
  constructor(
    private readonly output: string,
    private readonly usage?: TextModelTokenUsage,
    private readonly embedUsage?: TextModelTokenUsage
  ) {}

  async embed(_text: string, options: EmbedOptions = {}): Promise<number[]> {
    if (this.embedUsage) options.onUsage?.(this.embedUsage)
    return [0]
  }

  async generate(_prompt: string, options: GenerateOptions = {}): Promise<string> {
    if (this.usage) options.onUsage?.(this.usage)
    return this.output
  }
}

class FailingTextModel implements TextModel {
  async embed(_text: string): Promise<number[]> {
    throw Object.assign(new Error("embedding unavailable"), { code: "EmbeddingUnavailable" })
  }

  async generate(_prompt: string): Promise<string> {
    throw Object.assign(new Error("bedrock unavailable"), { name: "ThrottlingException" })
  }
}

test("usage tracking text model stores provider usage as actual token event", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel("回答", { inputTokens: 100, outputTokens: 20 }), store, { userId: "user-1", sessionId: "chat-1" })

  await model.generate("質問", { modelId: "model-a", usageTask: "finalAnswer" })

  assert.equal(store.events.length, 1)
  assert.equal(store.events[0]?.inputTokens, 100)
  assert.equal(store.events[0]?.outputTokens, 20)
  assert.equal(store.events[0]?.tokenSource, "provider_usage")
  assert.equal(store.events[0]?.usageConfidence, "actual")
  assert.equal(store.events[0]?.feature, "rag.generate_answer")
  assert.equal(store.events[0]?.pricingVersion, "bedrock-2026-06-local-v1")
  assert.equal(store.events[0]?.estimatedCostUsd, 0.000128)
})

test("usage tracking text model preserves provider cache token usage", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel("回答", { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 }), store, { userId: "user-1", sessionId: "chat-cache" })

  await model.generate("質問", { modelId: "model-a", usageTask: "finalAnswer" })

  assert.equal(store.events.length, 1)
  assert.equal(store.events[0]?.inputTokens, 100)
  assert.equal(store.events[0]?.outputTokens, 20)
  assert.equal(store.events[0]?.cacheReadTokens, 30)
  assert.equal(store.events[0]?.cacheWriteTokens, 40)
  assert.equal(store.events[0]?.totalTokens, 190)
  assert.equal(store.events[0]?.tokenSource, "provider_usage")
})

test("usage tracking text model clamps provider usage and falls back to chat feature", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel("回答", { inputTokens: -1.9, outputTokens: 2.9 }), store, {
    tenantId: "tenant-a",
    userId: "user-1",
    messageId: "message-1",
    ragRunId: "rag-1",
    toolInvocationId: "tool-1",
    ingestRunId: "ingest-1"
  })
  const observedUsage: TextModelTokenUsage[] = []

  await model.generate("質問", { onUsage: (usage) => observedUsage.push(usage) })

  assert.equal(observedUsage.length, 1)
  assert.equal(store.events.length, 1)
  assert.equal(store.events[0]?.tenantId, "tenant-a")
  assert.equal(store.events[0]?.messageId, "message-1")
  assert.equal(store.events[0]?.ragRunId, "rag-1")
  assert.equal(store.events[0]?.toolInvocationId, "tool-1")
  assert.equal(store.events[0]?.ingestRunId, "ingest-1")
  assert.equal(store.events[0]?.feature, "chat")
  assert.equal(store.events[0]?.inputTokens, 0)
  assert.equal(store.events[0]?.outputTokens, 2)
})

test("usage tracking text model estimates tokens when provider usage is absent", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel("根拠に基づく回答です。"), store, { userId: "user-1" })

  await model.generate("休暇申請の期限を教えてください。", { modelId: "model-a", usageTask: "sufficientContext" })

  assert.equal(store.events.length, 1)
  assert.ok((store.events[0]?.inputTokens ?? 0) > 0)
  assert.ok((store.events[0]?.outputTokens ?? 0) > 0)
  assert.equal(store.events[0]?.tokenSource, "tokenizer_estimate")
  assert.equal(store.events[0]?.usageConfidence, "estimated")
  assert.equal(store.events[0]?.feature, "rag.answerability")
})

test("usage tracking text model maps retrieval judge and memory card calls to explicit rag features", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel("判定結果", { inputTokens: 40, outputTokens: 8 }), store, { userId: "user-1", orchestrationRunId: "run-feature-map" })

  await model.generate("検索候補を判定", { modelId: "model-a", usageTask: "retrievalJudge" })
  await model.generate("memory card を生成", { modelId: "model-a", usageTask: "memoryCard" })

  assert.deepEqual(store.events.map((event) => event.feature), ["rag.retrieval_judge", "rag.memory_card"])
  assert.ok(store.events.every((event) => event.tokenSource === "provider_usage"))
})

test("usage tracking text model marks empty usage as missing and deduplicates retries", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel(""), store, { userId: "user-1", orchestrationRunId: "run-1" })

  await model.generate("", { modelId: "model-a", usageTask: "answerSupport" })
  await model.generate("", { modelId: "model-a", usageTask: "answerSupport" })

  assert.equal(store.events.length, 1)
  assert.equal(store.events[0]?.inputTokens, 0)
  assert.equal(store.events[0]?.outputTokens, 0)
  assert.equal(store.events[0]?.tokenSource, "unknown")
  assert.equal(store.events[0]?.usageConfidence, "missing")
  assert.equal(store.events[0]?.estimatedCostUsd, undefined)
})

test("usage tracking text model stores embedding usage separately", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel("", undefined, { inputTokens: 42, outputTokens: 0 }), store, { userId: "user-1", sessionId: "chat-1" })

  await model.embed("検索クエリ", { modelId: "embed-model" })

  assert.equal(store.events.length, 1)
  assert.equal(store.events[0]?.feature, "embedding")
  assert.equal(store.events[0]?.modelId, "embed-model")
  assert.equal(store.events[0]?.inputTokens, 42)
  assert.equal(store.events[0]?.outputTokens, 0)
  assert.equal(store.events[0]?.tokenSource, "provider_usage")
  assert.equal(store.events[0]?.usageConfidence, "actual")
})

test("usage tracking text model estimates embedding tokens when provider usage is absent", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel(""), store, { userId: "user-1", sessionId: "search-1" })

  await model.embed("休暇申請の検索クエリ", { modelId: "embed-model" })

  assert.equal(store.events.length, 1)
  assert.equal(store.events[0]?.feature, "embedding")
  assert.ok((store.events[0]?.inputTokens ?? 0) > 0)
  assert.equal(store.events[0]?.totalTokens, store.events[0]?.inputTokens)
  assert.equal(store.events[0]?.tokenSource, "tokenizer_estimate")
  assert.equal(store.events[0]?.usageConfidence, "estimated")
})

test("usage tracking text model marks empty embedding usage as missing", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FakeTextModel(""), store, { userId: "user-1" })

  await model.embed("", {})

  assert.equal(store.events.length, 1)
  assert.equal(store.events[0]?.feature, "embedding")
  assert.equal(store.events[0]?.inputTokens, 0)
  assert.equal(store.events[0]?.tokenSource, "unknown")
  assert.equal(store.events[0]?.usageConfidence, "missing")
  assert.equal(store.events[0]?.estimatedCostUsd, undefined)
})

test("usage tracking text model records failed generate and embedding attempts", async () => {
  const store = new MemoryUsageEventStore()
  const model = new UsageTrackingTextModel(new FailingTextModel(), store, { userId: "user-1", orchestrationRunId: "run-failed" })

  await assert.rejects(() => model.generate("回答に失敗する質問", { modelId: "model-a", usageTask: "finalAnswer" }), /bedrock unavailable/)
  await assert.rejects(() => model.embed("検索に失敗するクエリ", { modelId: "embed-model" }), /embedding unavailable/)

  assert.equal(store.events.length, 2)
  const generateEvent = store.events.find((event) => event.feature === "rag.generate_answer")
  assert.equal(generateEvent?.status, "failed")
  assert.equal(generateEvent?.errorCode, "ThrottlingException")
  assert.equal(generateEvent?.tokenSource, "tokenizer_estimate")
  assert.ok((generateEvent?.inputTokens ?? 0) > 0)
  const embeddingEvent = store.events.find((event) => event.feature === "embedding")
  assert.equal(embeddingEvent?.status, "failed")
  assert.equal(embeddingEvent?.errorCode, "EmbeddingUnavailable")
  assert.equal(embeddingEvent?.tokenSource, "tokenizer_estimate")
  assert.ok((embeddingEvent?.inputTokens ?? 0) > 0)
})
