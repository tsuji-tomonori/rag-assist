import assert from "node:assert/strict"
import test from "node:test"
import { parseUsagePricingCatalog, priceUsageEvents, usageCompleteness } from "./_shared/usage/usage-pricing-catalog.js"
import type { PriceCatalogEntry, UsageEvent } from "../types.js"

const base: UsageEvent = {
  schemaVersion: 1, eventId: "event-1", tenantId: "tenant-a", subjectId: "subject-a", runId: "run-a", feature: "chat", provider: "bedrock", region: "ap-northeast-1", modelId: "model-a",
  quantities: [{ unit: "input_token", value: 1, source: "provider" }], status: "succeeded", idempotencyKey: "run-a:0", occurredAt: "2026-05-15T00:00:00.000Z", recordedAt: "2026-05-15T00:00:00.000Z"
}

const catalog: PriceCatalogEntry[] = [
  { catalogVersion: "price-v1", provider: "bedrock", region: "ap-northeast-1", modelId: "model-a", unit: "input_token", priceUsdPerUnit: "0.000001", effectiveFrom: "2026-05-01T00:00:00.000Z", effectiveTo: "2026-06-01T00:00:00.000Z", source: "https://billing.example/approved-v1", approvedBy: "finance-a", publishedAt: "2026-04-20T00:00:00.000Z" },
  { catalogVersion: "price-v2", provider: "bedrock", region: "ap-northeast-1", modelId: "model-a", unit: "input_token", priceUsdPerUnit: "0.000002", effectiveFrom: "2026-06-01T00:00:00.000Z", source: "https://billing.example/approved-v2", approvedBy: "finance-a", publishedAt: "2026-05-20T00:00:00.000Z" }
]

test("pricing selects the effective version and preserves micro-positive costs", () => {
  const june = { ...base, eventId: "event-2", occurredAt: "2026-06-15T00:00:00.000Z", quantities: [{ unit: "input_token" as const, value: 1, source: "tokenizer_estimate" as const }] }
  const priced = priceUsageEvents([base, june], catalog)
  assert.deepEqual(priced.catalogVersions, ["price-v1", "price-v2"])
  assert.equal(priced.items[0]?.pricingState, "actual")
  assert.equal(priced.items[0]?.costUsd, 0.000001)
  assert.equal(priced.items[1]?.pricingState, "estimate")
  assert.equal(priced.items[1]?.costUsd, 0.000002)
})

test("missing and unmatched quantities remain unpriced instead of complete zero", () => {
  const unknown = { ...base, eventId: "event-3", subjectId: undefined, runId: undefined, modelId: "unknown-model", quantities: [{ unit: "output_token" as const, source: "missing" as const }] }
  const priced = priceUsageEvents([unknown], catalog)
  assert.equal(priced.items[0]?.pricingState, "unpriced")
  assert.equal(priced.items[0]?.costUsd, undefined)
  assert.equal(usageCompleteness([unknown], priced.unpricedQuantityCount).state, "partial")
  assert.equal(usageCompleteness([unknown], priced.unpricedQuantityCount).missingQuantityCount, 1)
})

test("catalog parsing rejects unsigned or invalid price metadata", () => {
  assert.deepEqual(parseUsagePricingCatalog(undefined), [])
  assert.throws(() => parseUsagePricingCatalog(JSON.stringify([{ ...catalog[0], approvedBy: "" }])), /approvedBy/)
  assert.throws(() => parseUsagePricingCatalog(JSON.stringify([{ ...catalog[0], priceUsdPerUnit: "-1" }])), /Invalid non-negative decimal price/)
  assert.throws(() => parseUsagePricingCatalog(JSON.stringify([{ ...catalog[0], effectiveFrom: "not-a-date" }])), /effectiveFrom/)
  assert.throws(() => parseUsagePricingCatalog(JSON.stringify([catalog[0], catalog[0]])), /Duplicate price catalog entry/)
})
