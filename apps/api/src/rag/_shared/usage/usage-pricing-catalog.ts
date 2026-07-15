import type { CostAuditItem, PriceCatalogEntry, UsageDataCompleteness, UsageEvent, UsageQuantity } from "../../../types.js"

export type UsagePricingCatalog = readonly PriceCatalogEntry[]

export function parseUsagePricingCatalog(raw: string | undefined): UsagePricingCatalog {
  if (!raw?.trim()) return []
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) throw new Error("USAGE_PRICING_CATALOG_JSON must be an array")
  const entries = parsed.map(validatePriceCatalogEntry)
  const identities = new Set<string>()
  for (const entry of entries) {
    const identity = [entry.catalogVersion, entry.provider, entry.region, entry.modelId, entry.unit, entry.effectiveFrom].join("\u0000")
    if (identities.has(identity)) throw new Error("Duplicate price catalog entry")
    identities.add(identity)
  }
  return entries
}

export function priceUsageEvents(events: UsageEvent[], catalog: UsagePricingCatalog): { items: CostAuditItem[]; catalogVersions: string[]; unpricedQuantityCount: number } {
  const versions = new Set<string>()
  let unpricedQuantityCount = 0
  const items = events.flatMap((event) => event.quantities.map((quantity) => {
    const pricing = quantity.source === "missing" ? undefined : findPrice(event, quantity, catalog)
    if (!pricing) unpricedQuantityCount += 1
    if (pricing) versions.add(pricing.catalogVersion)
    const quantityValue = quantity.value
    const unitCostUsd = pricing ? parsePrice(pricing.priceUsdPerUnit) : undefined
    return {
      eventId: event.eventId,
      subjectId: event.subjectId ?? "unknown",
      runId: event.runId ?? "unknown",
      feature: event.feature ?? "unknown",
      provider: event.provider ?? "unknown",
      region: event.region ?? "unknown",
      modelId: event.modelId ?? "unknown",
      unit: quantity.unit,
      quantity: quantityValue,
      measurementSource: quantity.source,
      pricingState: !pricing ? "unpriced" as const : quantity.source === "provider" ? "actual" as const : "estimate" as const,
      catalogVersion: pricing?.catalogVersion,
      priceSource: pricing?.source,
      unitCostUsd,
      costUsd: unitCostUsd !== undefined && quantityValue !== undefined ? roundUsd(unitCostUsd * quantityValue) : undefined,
      occurredAt: event.occurredAt
    }
  }))
  return { items, catalogVersions: [...versions].sort(), unpricedQuantityCount }
}

export function usageCompleteness(events: UsageEvent[], unpricedQuantityCount = 0): UsageDataCompleteness {
  const quantities = events.flatMap((event) => event.quantities)
  const missingQuantityCount = quantities.filter((quantity) => quantity.source === "missing").length
  return {
    eventCount: events.length,
    actualQuantityCount: quantities.filter((quantity) => quantity.source === "provider").length,
    estimatedQuantityCount: quantities.filter((quantity) => quantity.source === "tokenizer_estimate").length,
    missingQuantityCount,
    unknownSubjectCount: events.filter((event) => !event.subjectId).length,
    unknownRunCount: events.filter((event) => !event.runId).length,
    unknownModelCount: events.filter((event) => !event.modelId).length,
    unknownFeatureCount: events.filter((event) => !event.feature).length,
    unpricedQuantityCount,
    state: events.length === 0 ? "missing" : missingQuantityCount > 0 || unpricedQuantityCount > 0 || events.some((event) => !event.subjectId || !event.runId || !event.modelId || !event.feature) ? "partial" : "complete"
  }
}

function findPrice(event: UsageEvent, quantity: UsageQuantity, catalog: UsagePricingCatalog): PriceCatalogEntry | undefined {
  const occurredAt = event.occurredAt
  return catalog
    .filter((entry) => entry.provider === event.provider)
    .filter((entry) => entry.region === event.region || entry.region === "*")
    .filter((entry) => entry.modelId === event.modelId || entry.modelId === "*")
    .filter((entry) => entry.unit === quantity.unit)
    .filter((entry) => entry.effectiveFrom <= occurredAt && (!entry.effectiveTo || occurredAt < entry.effectiveTo))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.catalogVersion.localeCompare(a.catalogVersion))[0]
}

function validatePriceCatalogEntry(value: unknown): PriceCatalogEntry {
  const entry = value as Partial<PriceCatalogEntry>
  for (const field of ["catalogVersion", "provider", "region", "modelId", "unit", "priceUsdPerUnit", "effectiveFrom", "source", "approvedBy", "publishedAt"] as const) {
    if (typeof entry[field] !== "string" || !(entry[field] as string).trim()) throw new Error(`Invalid price catalog field: ${field}`)
  }
  if (!isCanonicalInstant(entry.effectiveFrom!)) throw new Error("Invalid price catalog effectiveFrom")
  if (entry.effectiveTo !== undefined && (typeof entry.effectiveTo !== "string" || !isCanonicalInstant(entry.effectiveTo) || entry.effectiveTo <= entry.effectiveFrom!)) throw new Error("Invalid price catalog effectiveTo")
  if (!isCanonicalInstant(entry.publishedAt!)) throw new Error("Invalid price catalog publishedAt")
  parsePrice(entry.priceUsdPerUnit!)
  return entry as PriceCatalogEntry
}

function isCanonicalInstant(value: string): boolean {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}

function parsePrice(value: string): number {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new Error("Invalid non-negative decimal price")
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error("Invalid price")
  return parsed
}

function roundUsd(value: number): number {
  return Number(value.toFixed(12))
}
