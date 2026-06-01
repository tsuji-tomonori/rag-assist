import { randomUUID } from "node:crypto"
import { config } from "../../../config.js"
import type { EmbedOptions, GenerateOptions, TextModel, TextModelTokenUsage } from "../../../adapters/text-model.js"
import type { UsageEvent, UsageEventFeature } from "../../../types.js"
import type { UsageEventStore } from "../../../adapters/usage-event-store.js"
import { calculateUsageEventCost, defaultPricingVersion } from "./pricing-catalog.js"

export type UsageTrackingContext = {
  tenantId?: string
  userId: string
  sessionId?: string
  messageId?: string
  orchestrationRunId?: string
  ragRunId?: string
  toolInvocationId?: string
  ingestRunId?: string
}

export class UsageTrackingTextModel implements TextModel {
  constructor(
    private readonly inner: TextModel,
    private readonly store: UsageEventStore,
    private readonly context: UsageTrackingContext
  ) {}

  async embed(text: string, options: EmbedOptions = {}): Promise<number[]> {
    const startedAt = Date.now()
    let providerUsage: TextModelTokenUsage | undefined
    let vector: number[]
    try {
      vector = await this.inner.embed(text, {
        ...options,
        onUsage: (usage) => {
          providerUsage = usage
          options.onUsage?.(usage)
        }
      })
    } catch (error) {
      await this.recordEmbeddingEvent(text, providerUsage, startedAt, options, "failed", errorCodeFrom(error))
      throw error
    }
    await this.recordEmbeddingEvent(text, providerUsage, startedAt, options, "succeeded")
    return vector
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const startedAt = Date.now()
    let providerUsage: TextModelTokenUsage | undefined
    let output: string
    try {
      output = await this.inner.generate(prompt, {
        ...options,
        onUsage: (usage) => {
          providerUsage = usage
          options.onUsage?.(usage)
        }
      })
    } catch (error) {
      await this.recordGenerateEvent(prompt, "", providerUsage, startedAt, options, "failed", errorCodeFrom(error))
      throw error
    }
    await this.recordGenerateEvent(prompt, output, providerUsage, startedAt, options, "succeeded")
    return output
  }

  private async recordEmbeddingEvent(
    text: string,
    providerUsage: TextModelTokenUsage | undefined,
    startedAt: number,
    options: EmbedOptions,
    status: UsageEvent["status"],
    errorCode?: string
  ): Promise<void> {
    const normalized = normalizeEmbeddingUsage(text, providerUsage)
    const now = new Date().toISOString()
    const modelId = options.modelId ?? config.embeddingModelId
    const event: UsageEvent = {
      eventId: randomUUID(),
      tenantId: this.context.tenantId ?? "default",
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      messageId: this.context.messageId,
      orchestrationRunId: this.context.orchestrationRunId,
      ragRunId: this.context.ragRunId,
      toolInvocationId: this.context.toolInvocationId,
      ingestRunId: this.context.ingestRunId,
      feature: "embedding",
      provider: config.mockBedrock ? "mock" : "bedrock",
      modelId,
      inputTokens: normalized.inputTokens,
      outputTokens: 0,
      totalTokens: normalized.inputTokens,
      tokenSource: normalized.tokenSource,
      usageConfidence: normalized.usageConfidence,
      pricingVersion: defaultPricingVersion,
      latencyMs: Date.now() - startedAt,
      status,
      errorCode,
      idempotencyKey: `${this.context.orchestrationRunId ?? this.context.sessionId ?? this.context.userId}:embedding:${modelId}:${hashPrompt(text)}`,
      createdAt: now
    }
    event.estimatedCostUsd = calculateUsageEventCost(event).estimatedCostUsd
    await this.store.putOnce(event)
  }

  private async recordGenerateEvent(
    prompt: string,
    output: string,
    providerUsage: TextModelTokenUsage | undefined,
    startedAt: number,
    options: GenerateOptions,
    status: UsageEvent["status"],
    errorCode?: string
  ): Promise<void> {
    const normalized = normalizeUsage(prompt, output, providerUsage)
    const now = new Date().toISOString()
    const modelId = options.modelId ?? config.defaultModelId
    const event: UsageEvent = {
      eventId: randomUUID(),
      tenantId: this.context.tenantId ?? "default",
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      messageId: this.context.messageId,
      orchestrationRunId: this.context.orchestrationRunId,
      ragRunId: this.context.ragRunId,
      toolInvocationId: this.context.toolInvocationId,
      ingestRunId: this.context.ingestRunId,
      feature: featureForTask(options.usageTask),
      provider: config.mockBedrock ? "mock" : "bedrock",
      modelId,
      inputTokens: normalized.inputTokens,
      outputTokens: normalized.outputTokens,
      cacheReadTokens: normalized.cacheReadTokens,
      cacheWriteTokens: normalized.cacheWriteTokens,
      totalTokens: normalized.inputTokens + normalized.outputTokens + (normalized.cacheReadTokens ?? 0) + (normalized.cacheWriteTokens ?? 0),
      tokenSource: normalized.tokenSource,
      usageConfidence: normalized.usageConfidence,
      pricingVersion: defaultPricingVersion,
      latencyMs: Date.now() - startedAt,
      status,
      errorCode,
      idempotencyKey: `${this.context.orchestrationRunId ?? this.context.sessionId ?? this.context.userId}:${options.usageTask ?? "generate"}:${hashPrompt(prompt)}`,
      createdAt: now
    }
    event.estimatedCostUsd = calculateUsageEventCost(event).estimatedCostUsd
    await this.store.putOnce(event)
  }
}

function normalizeUsage(prompt: string, output: string, providerUsage: TextModelTokenUsage | undefined): Pick<UsageEvent, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "tokenSource" | "usageConfidence"> {
  if (providerUsage && Number.isFinite(providerUsage.inputTokens) && Number.isFinite(providerUsage.outputTokens)) {
    return {
      inputTokens: Math.max(0, Math.trunc(providerUsage.inputTokens ?? 0)),
      outputTokens: Math.max(0, Math.trunc(providerUsage.outputTokens ?? 0)),
      cacheReadTokens: providerUsage.cacheReadTokens,
      cacheWriteTokens: providerUsage.cacheWriteTokens,
      tokenSource: "provider_usage",
      usageConfidence: "actual"
    }
  }
  const inputTokens = estimateTokens(prompt)
  const outputTokens = estimateTokens(output)
  if (inputTokens > 0 || outputTokens > 0) {
    return {
      inputTokens,
      outputTokens,
      tokenSource: config.mockBedrock ? "mock_estimate" : "tokenizer_estimate",
      usageConfidence: "estimated"
    }
  }
  return { inputTokens: 0, outputTokens: 0, tokenSource: "unknown", usageConfidence: "missing" }
}

function normalizeEmbeddingUsage(text: string, providerUsage: TextModelTokenUsage | undefined): Pick<UsageEvent, "inputTokens" | "tokenSource" | "usageConfidence"> {
  if (providerUsage && Number.isFinite(providerUsage.inputTokens)) {
    return {
      inputTokens: Math.max(0, Math.trunc(providerUsage.inputTokens ?? 0)),
      tokenSource: "provider_usage",
      usageConfidence: "actual"
    }
  }
  const inputTokens = estimateTokens(text)
  if (inputTokens > 0) {
    return {
      inputTokens,
      tokenSource: config.mockBedrock ? "mock_estimate" : "tokenizer_estimate",
      usageConfidence: "estimated"
    }
  }
  return { inputTokens: 0, tokenSource: "unknown", usageConfidence: "missing" }
}

function estimateTokens(text: string): number {
  const normalized = text.normalize("NFKC").trim()
  if (!normalized) return 0
  const asciiWords = normalized.match(/[A-Za-z0-9_'-]+/g)?.length ?? 0
  const cjkChars = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0
  const otherChars = Math.max(0, normalized.length - cjkChars)
  return Math.max(1, Math.ceil(asciiWords + cjkChars * 0.7 + otherChars / 4))
}

function featureForTask(task: GenerateOptions["usageTask"]): UsageEventFeature {
  switch (task) {
    case "clue":
      return "rag.query_rewrite"
    case "sufficientContext":
      return "rag.answerability"
    case "retrievalJudge":
      return "rag.retrieval_judge"
    case "finalAnswer":
      return "rag.generate_answer"
    case "answerSupport":
      return "rag.support_verification"
    case "answerRepair":
      return "rag.answer_repair"
    case "memoryCard":
      return "rag.memory_card"
    default:
      return "chat"
  }
}

function hashPrompt(prompt: string): string {
  let hash = 0
  for (let index = 0; index < prompt.length; index += 1) hash = ((hash << 5) - hash + prompt.charCodeAt(index)) | 0
  return Math.abs(hash).toString(36)
}

function errorCodeFrom(error: unknown): string {
  const candidate = error as { code?: unknown; name?: unknown }
  if (typeof candidate.code === "string" && candidate.code.trim()) return candidate.code
  if (typeof candidate.name === "string" && candidate.name.trim()) return candidate.name
  return "unknown_error"
}
