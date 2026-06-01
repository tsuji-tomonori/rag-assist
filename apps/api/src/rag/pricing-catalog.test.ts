import assert from "node:assert/strict"
import test from "node:test"

import type { UsageEvent } from "../types.js"
import { calculateUsageEventCost, pricingVersionForEvents, type PricingCatalog } from "./pricing-catalog.js"

const baseEvent: UsageEvent = {
  eventId: "event-1",
  tenantId: "default",
  userId: "user-1",
  feature: "rag.generate_answer",
  provider: "bedrock",
  modelId: "model-a",
  inputTokens: 1000,
  outputTokens: 500,
  totalTokens: 1500,
  tokenSource: "provider_usage",
  usageConfidence: "actual",
  status: "succeeded",
  idempotencyKey: "event-1",
  createdAt: "2026-06-01T00:00:00.000Z"
}

const catalog: PricingCatalog = [
  {
    pricingVersion: "v1",
    provider: "bedrock",
    modelId: "*",
    currency: "USD",
    inputUsdPer1MToken: "1",
    outputUsdPer1MToken: "2",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    updatedBy: "test",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    pricingVersion: "v2",
    provider: "bedrock",
    modelId: "*",
    currency: "USD",
    inputUsdPer1MToken: "10",
    outputUsdPer1MToken: "20",
    effectiveFrom: "2026-02-01T00:00:00.000Z",
    updatedBy: "test",
    updatedAt: "2026-02-01T00:00:00.000Z"
  },
  {
    pricingVersion: "v-cache",
    provider: "bedrock",
    modelId: "*",
    currency: "USD",
    inputUsdPer1MToken: "1",
    outputUsdPer1MToken: "2",
    cacheReadUsdPer1MToken: "0.25",
    cacheWriteUsdPer1MToken: "1.5",
    effectiveFrom: "2026-03-01T00:00:00.000Z",
    updatedBy: "test",
    updatedAt: "2026-03-01T00:00:00.000Z"
  },
  {
    pricingVersion: "v1",
    provider: "bedrock",
    modelId: "embedding",
    currency: "USD",
    inputUsdPer1MToken: "0",
    outputUsdPer1MToken: "0",
    embeddingUsdPer1MToken: "0.5",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    updatedBy: "test",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    pricingVersion: "v-invalid",
    provider: "bedrock",
    modelId: "model-invalid",
    currency: "USD",
    inputUsdPer1MToken: "not-a-number",
    outputUsdPer1MToken: "also-invalid",
    cacheReadUsdPer1MToken: "bad-cache-read",
    cacheWriteUsdPer1MToken: "bad-cache-write",
    effectiveFrom: "2026-04-01T00:00:00.000Z",
    updatedBy: "test",
    updatedAt: "2026-04-01T00:00:00.000Z"
  }
]

test("pricing catalog calculates token costs from usage event pricing version", () => {
  const result = calculateUsageEventCost({ ...baseEvent, pricingVersion: "v1" }, catalog)

  assert.equal(result.pricingVersion, "v1")
  assert.equal(result.estimatedCostUsd, 0.002)
})

test("pricing catalog keeps old usage events on their original pricing version", () => {
  const oldResult = calculateUsageEventCost({ ...baseEvent, pricingVersion: "v1" }, catalog)
  const newResult = calculateUsageEventCost({ ...baseEvent, pricingVersion: "v2" }, catalog)

  assert.equal(oldResult.estimatedCostUsd, 0.002)
  assert.equal(newResult.estimatedCostUsd, 0.02)
})

test("pricing catalog preserves stored estimated cost on usage events", () => {
  const result = calculateUsageEventCost({
    ...baseEvent,
    pricingVersion: "v1",
    estimatedCostUsd: 0.123456
  }, catalog)

  assert.equal(result.pricingVersion, "v1")
  assert.equal(result.estimatedCostUsd, 0.123456)
})

test("pricing catalog excludes missing usage from estimated cost", () => {
  const result = calculateUsageEventCost({
    ...baseEvent,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    tokenSource: "unknown",
    usageConfidence: "missing",
    pricingVersion: "v1"
  }, catalog)

  assert.equal(result.pricingVersion, "v1")
  assert.equal(result.estimatedCostUsd, undefined)
})

test("pricing catalog includes cache read and cache write token costs", () => {
  const result = calculateUsageEventCost({
    ...baseEvent,
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 2000,
    cacheWriteTokens: 3000,
    totalTokens: 6500,
    pricingVersion: "v-cache"
  }, catalog)

  assert.equal(result.pricingVersion, "v-cache")
  assert.equal(result.estimatedCostUsd, 0.007)
})

test("pricing catalog uses embedding price for embedding events", () => {
  const result = calculateUsageEventCost({
    ...baseEvent,
    feature: "embedding",
    modelId: "embed-model",
    inputTokens: 1000,
    outputTokens: 0,
    totalTokens: 1000,
    pricingVersion: "v1"
  }, catalog)

  assert.equal(result.estimatedCostUsd, 0.0005)
})

test("pricing catalog returns stored pricing metadata when catalog price is missing", () => {
  const result = calculateUsageEventCost({
    ...baseEvent,
    pricingVersion: "v-missing"
  }, catalog)

  assert.equal(result.pricingVersion, "v-missing")
  assert.equal(result.estimatedCostUsd, undefined)
})

test("pricing catalog treats invalid price strings as zero cost", () => {
  const result = calculateUsageEventCost({
    ...baseEvent,
    modelId: "model-invalid",
    cacheReadTokens: 100,
    cacheWriteTokens: 100,
    totalTokens: 1700,
    pricingVersion: "v-invalid"
  }, catalog)

  assert.equal(result.pricingVersion, "v-invalid")
  assert.equal(result.estimatedCostUsd, 0)
})

test("pricing catalog summarizes event pricing versions", () => {
  assert.equal(pricingVersionForEvents([], catalog), undefined)
  assert.equal(pricingVersionForEvents([{ ...baseEvent, pricingVersion: "v1" }], catalog), "v1")
  assert.equal(pricingVersionForEvents([
    { ...baseEvent, eventId: "event-1", idempotencyKey: "event-1", pricingVersion: "v1" },
    { ...baseEvent, eventId: "event-2", idempotencyKey: "event-2", pricingVersion: "v2" }
  ], catalog), "mixed")
})
