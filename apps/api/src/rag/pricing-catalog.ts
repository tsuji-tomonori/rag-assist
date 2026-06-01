import type { UsageEvent } from "../types.js"

export type ModelPricing = {
  pricingVersion: string
  provider: UsageEvent["provider"]
  modelId: string
  currency: "USD"
  inputUsdPer1MToken: string
  outputUsdPer1MToken: string
  cacheReadUsdPer1MToken?: string
  cacheWriteUsdPer1MToken?: string
  embeddingUsdPer1MToken?: string
  effectiveFrom: string
  effectiveTo?: string
  updatedBy: string
  updatedAt: string
}

export type PricingCatalog = readonly ModelPricing[]

export const defaultPricingVersion = "bedrock-2026-06-local-v1"
export const defaultPricingCatalogUpdatedAt = "2026-06-01T00:00:00.000Z"

export const defaultPricingCatalog: PricingCatalog = [
  {
    pricingVersion: defaultPricingVersion,
    provider: "bedrock",
    modelId: "*",
    currency: "USD",
    inputUsdPer1MToken: "0.8",
    outputUsdPer1MToken: "2.4",
    cacheReadUsdPer1MToken: "0",
    cacheWriteUsdPer1MToken: "0",
    effectiveFrom: "2026-06-01T00:00:00.000Z",
    updatedBy: "system",
    updatedAt: defaultPricingCatalogUpdatedAt
  },
  {
    pricingVersion: defaultPricingVersion,
    provider: "mock",
    modelId: "*",
    currency: "USD",
    inputUsdPer1MToken: "0.8",
    outputUsdPer1MToken: "2.4",
    cacheReadUsdPer1MToken: "0",
    cacheWriteUsdPer1MToken: "0",
    effectiveFrom: "2026-06-01T00:00:00.000Z",
    updatedBy: "system",
    updatedAt: defaultPricingCatalogUpdatedAt
  },
  {
    pricingVersion: defaultPricingVersion,
    provider: "bedrock",
    modelId: "embedding",
    currency: "USD",
    inputUsdPer1MToken: "0",
    outputUsdPer1MToken: "0",
    embeddingUsdPer1MToken: "0.1",
    effectiveFrom: "2026-06-01T00:00:00.000Z",
    updatedBy: "system",
    updatedAt: defaultPricingCatalogUpdatedAt
  },
  {
    pricingVersion: defaultPricingVersion,
    provider: "mock",
    modelId: "embedding",
    currency: "USD",
    inputUsdPer1MToken: "0",
    outputUsdPer1MToken: "0",
    embeddingUsdPer1MToken: "0.1",
    effectiveFrom: "2026-06-01T00:00:00.000Z",
    updatedBy: "system",
    updatedAt: defaultPricingCatalogUpdatedAt
  }
]

export function calculateUsageEventCost(event: UsageEvent, catalog: PricingCatalog = defaultPricingCatalog): { pricingVersion?: string; estimatedCostUsd?: number } {
  if (event.usageConfidence === "missing") return { pricingVersion: event.pricingVersion }
  if (typeof event.estimatedCostUsd === "number" && Number.isFinite(event.estimatedCostUsd)) {
    return { pricingVersion: event.pricingVersion, estimatedCostUsd: event.estimatedCostUsd }
  }
  const pricing = findPricing(event, catalog)
  if (!pricing) return { pricingVersion: event.pricingVersion, estimatedCostUsd: event.estimatedCostUsd }
  const inputCost = (event.inputTokens / 1_000_000) * numberFromPricing(pricing.inputUsdPer1MToken)
  const outputCost = (event.outputTokens / 1_000_000) * numberFromPricing(pricing.outputUsdPer1MToken)
  const cacheReadCost = ((event.cacheReadTokens ?? 0) / 1_000_000) * numberFromPricing(pricing.cacheReadUsdPer1MToken)
  const cacheWriteCost = ((event.cacheWriteTokens ?? 0) / 1_000_000) * numberFromPricing(pricing.cacheWriteUsdPer1MToken)
  const embeddingCost = event.feature === "embedding"
    ? (event.inputTokens / 1_000_000) * numberFromPricing(pricing.embeddingUsdPer1MToken)
    : 0
  return {
    pricingVersion: pricing.pricingVersion,
    estimatedCostUsd: roundCost(inputCost + outputCost + cacheReadCost + cacheWriteCost + embeddingCost)
  }
}

export function pricingVersionForEvents(events: UsageEvent[], catalog: PricingCatalog = defaultPricingCatalog): string | undefined {
  const versions = new Set(
    events
      .map((event) => calculateUsageEventCost(event, catalog).pricingVersion)
      .filter((value): value is string => Boolean(value))
  )
  if (versions.size === 0) return undefined
  if (versions.size === 1) return [...versions][0]
  return "mixed"
}

function findPricing(event: UsageEvent, catalog: PricingCatalog): ModelPricing | undefined {
  const version = event.pricingVersion ?? defaultPricingVersion
  const modelId = event.feature === "embedding" ? "embedding" : event.modelId
  return catalog.find((pricing) => pricing.pricingVersion === version && pricing.provider === event.provider && pricing.modelId === modelId)
    ?? catalog.find((pricing) => pricing.pricingVersion === version && pricing.provider === event.provider && pricing.modelId === "*")
}

function numberFromPricing(value: string | undefined): number {
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundCost(value: number): number {
  return Number(value.toFixed(8))
}
