import { randomUUID } from "node:crypto"
import { config } from "../../../config.js"
import type { EmbedOptions, GenerateOptions, TextModel, TextModelTokenUsage } from "../../../adapters/text-model.js"
import type { UsageEventStore } from "../../../adapters/usage-event-store.js"
import type { UsageEvent, UsageQuantity, UsageMeasurementSource } from "../../../types.js"

export type UsageTrackingContext = {
  tenantId: string
  subjectId?: string
  runId: string
  feature?: string
}

export class UsageTrackingTextModel implements TextModel {
  private invocation = 0

  constructor(
    private readonly inner: TextModel,
    private readonly store: UsageEventStore,
    private readonly context: UsageTrackingContext
  ) {
    if (!context.tenantId.trim() || !context.runId.trim()) throw new Error("Usage tracking requires tenantId and runId")
  }

  async embed(text: string, options: EmbedOptions = {}): Promise<number[]> {
    const ordinal = this.invocation++
    let providerUsage: TextModelTokenUsage | undefined
    try {
      const result = await this.inner.embed(text, { ...options, onUsage: (usage) => { providerUsage = usage; options.onUsage?.(usage) } })
      await this.record("embedding", ordinal, options.modelId ?? config.embeddingModelId, quantitiesForEmbedding(text, providerUsage), "succeeded")
      return result
    } catch (error) {
      await this.record("embedding", ordinal, options.modelId ?? config.embeddingModelId, quantitiesForEmbedding(text, providerUsage), "failed", errorCode(error)).catch(() => undefined)
      throw error
    }
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const ordinal = this.invocation++
    let providerUsage: TextModelTokenUsage | undefined
    try {
      const result = await this.inner.generate(prompt, { ...options, onUsage: (usage) => { providerUsage = usage; options.onUsage?.(usage) } })
      await this.record(featureForTask(options.usageTask) ?? this.context.feature, ordinal, options.modelId ?? config.defaultModelId, quantitiesForGeneration(prompt, result, providerUsage), "succeeded")
      return result
    } catch (error) {
      await this.record(featureForTask(options.usageTask) ?? this.context.feature, ordinal, options.modelId ?? config.defaultModelId, quantitiesForGeneration(prompt, "", providerUsage), "failed", errorCode(error)).catch(() => undefined)
      throw error
    }
  }

  private async record(feature: string | undefined, ordinal: number, modelId: string, quantities: UsageQuantity[], status: UsageEvent["status"], errorCodeValue?: string): Promise<void> {
    const occurredAt = new Date().toISOString()
    await this.store.putOnce({
      schemaVersion: 1,
      eventId: randomUUID(),
      tenantId: this.context.tenantId,
      subjectId: this.context.subjectId,
      runId: this.context.runId,
      feature,
      provider: config.mockBedrock ? "mock" : "bedrock",
      region: config.region,
      modelId,
      quantities,
      status,
      errorCode: errorCodeValue,
      idempotencyKey: `${this.context.runId}:${ordinal}:${feature ?? "unknown"}:${modelId}`,
      occurredAt,
      recordedAt: occurredAt
    })
  }
}

function quantitiesForEmbedding(text: string, usage: TextModelTokenUsage | undefined): UsageQuantity[] {
  return [quantity("input_token", usage?.inputTokens, text)]
}

function quantitiesForGeneration(prompt: string, output: string, usage: TextModelTokenUsage | undefined): UsageQuantity[] {
  return [
    quantity("input_token", usage?.inputTokens, prompt),
    quantity("output_token", usage?.outputTokens, output),
    optionalProviderQuantity("cache_read_token", usage?.cacheReadTokens),
    optionalProviderQuantity("cache_write_token", usage?.cacheWriteTokens)
  ].filter((item): item is UsageQuantity => Boolean(item))
}

function quantity(unit: UsageQuantity["unit"], providerValue: number | undefined, text: string): UsageQuantity {
  if (Number.isFinite(providerValue)) return { unit, value: Math.max(0, Math.trunc(providerValue!)), source: "provider" }
  const estimate = estimateTokens(text)
  return estimate > 0 ? { unit, value: estimate, source: "tokenizer_estimate" } : { unit, source: "missing" }
}

function optionalProviderQuantity(unit: UsageQuantity["unit"], value: number | undefined): UsageQuantity | undefined {
  return Number.isFinite(value) ? { unit, value: Math.max(0, Math.trunc(value!)), source: "provider" } : undefined
}

function estimateTokens(text: string): number {
  const normalized = text.normalize("NFKC").trim()
  if (!normalized) return 0
  const asciiWords = normalized.match(/[A-Za-z0-9_'-]+/g)?.length ?? 0
  const cjkChars = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0
  return Math.max(1, Math.ceil(asciiWords + cjkChars * 0.7 + Math.max(0, normalized.length - cjkChars) / 4))
}

function featureForTask(task: GenerateOptions["usageTask"]): string | undefined {
  return task ? `rag.${task}` : undefined
}

function errorCode(error: unknown): string {
  const candidate = error as { code?: unknown; name?: unknown }
  return typeof candidate.code === "string" && candidate.code ? candidate.code : typeof candidate.name === "string" && candidate.name ? candidate.name : "unknown_error"
}

export function usageMeasurementSource(usage: TextModelTokenUsage | undefined, text: string): UsageMeasurementSource {
  return usage ? "provider" : text.trim() ? "tokenizer_estimate" : "missing"
}
