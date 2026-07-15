import { createHash } from "node:crypto"
import type { ObjectStore } from "./object-store.js"
import type { UsageEvent, UsageListQuery } from "../types.js"

export type UsageEventPage = {
  events: UsageEvent[]
  nextCursor?: string
  truncated: boolean
  asOf: string
}

export interface UsageEventStore {
  putOnce(event: UsageEvent): Promise<"inserted" | "duplicate">
  query(tenantId: string, query: UsageListQuery): Promise<UsageEventPage>
}

export class InMemoryUsageEventStore implements UsageEventStore {
  private readonly events = new Map<string, UsageEvent>()

  async putOnce(event: UsageEvent): Promise<"inserted" | "duplicate"> {
    const key = tenantIdempotencyKey(event.tenantId, event.idempotencyKey)
    if (this.events.has(key)) return "duplicate"
    this.events.set(key, structuredClone(event))
    return "inserted"
  }

  async query(tenantId: string, query: UsageListQuery): Promise<UsageEventPage> {
    return pageUsageEvents([...this.events.values()], tenantId, query)
  }
}

export class ObjectStoreUsageEventStore implements UsageEventStore {
  constructor(private readonly objectStore: ObjectStore) {}

  async putOnce(event: UsageEvent): Promise<"inserted" | "duplicate"> {
    const objectKey = usageEventObjectKey(event.tenantId, event.idempotencyKey)
    try {
      await this.objectStore.putTextIfVersion(objectKey, JSON.stringify(event, null, 2), undefined, "application/json; charset=utf-8")
      return "inserted"
    } catch (error) {
      if ((error as { code?: string }).code === "PRECONDITION_FAILED") return "duplicate"
      throw error
    }
  }

  async query(tenantId: string, query: UsageListQuery): Promise<UsageEventPage> {
    const keys = await this.objectStore.listKeys(`usage-events/tenants/${encodeURIComponent(tenantId)}/`)
    const events = await Promise.all(keys.filter((key) => key.endsWith(".json")).map(async (key) => JSON.parse(await this.objectStore.getText(key)) as UsageEvent))
    return pageUsageEvents(events, tenantId, query)
  }
}

export function pageUsageEvents(events: UsageEvent[], tenantId: string, query: UsageListQuery): UsageEventPage {
  const normalized = normalizeUsageQuery(query)
  const queryFingerprint = usageQueryFingerprint(tenantId, normalized)
  const after = decodeUsageCursor(normalized.cursor, queryFingerprint)
  const filtered = events
    .filter((event) => event.tenantId === tenantId)
    .filter((event) => event.occurredAt >= normalized.periodStart && event.occurredAt < normalized.periodEnd)
    .filter((event) => !normalized.subjectId || event.subjectId === normalized.subjectId)
    .filter((event) => !normalized.runId || event.runId === normalized.runId)
    .filter((event) => !normalized.modelId || event.modelId === normalized.modelId)
    .filter((event) => !normalized.feature || event.feature === normalized.feature)
    .filter((event) => !normalized.provider || event.provider === normalized.provider)
    .sort(compareUsageEvents)
  const start = after ? filtered.findIndex((event) => usageEventPosition(event) === after) + 1 : 0
  if (after && start === 0) throw new Error("Invalid usage cursor")
  const page = filtered.slice(start, start + normalized.limit)
  const truncated = start + page.length < filtered.length
  return {
    events: page.map((event) => structuredClone(event)),
    nextCursor: truncated && page.length > 0 ? encodeUsageCursor(usageEventPosition(page.at(-1)!), queryFingerprint) : undefined,
    truncated,
    asOf: new Date().toISOString()
  }
}

export function normalizeUsageQuery(query: UsageListQuery): Required<Pick<UsageListQuery, "periodStart" | "periodEnd" | "limit">> & UsageListQuery {
  const periodStart = new Date(query.periodStart)
  const periodEnd = new Date(query.periodEnd)
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodStart >= periodEnd) throw new Error("Invalid half-open usage period")
  return { ...query, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), limit: Math.min(200, Math.max(1, Math.trunc(query.limit ?? 100))) }
}

function compareUsageEvents(a: UsageEvent, b: UsageEvent): number {
  return a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId)
}

function usageEventPosition(event: UsageEvent): string {
  return `${event.occurredAt}#${event.eventId}`
}

function tenantIdempotencyKey(tenantId: string, idempotencyKey: string): string {
  return `${tenantId}\u0000${idempotencyKey}`
}

function usageEventObjectKey(tenantId: string, idempotencyKey: string): string {
  const digest = createHash("sha256").update(tenantIdempotencyKey(tenantId, idempotencyKey)).digest("hex")
  return `usage-events/tenants/${encodeURIComponent(tenantId)}/${digest}.json`
}

function usageQueryFingerprint(tenantId: string, query: UsageListQuery): string {
  const canonical = JSON.stringify({ tenantId, periodStart: query.periodStart, periodEnd: query.periodEnd, subjectId: query.subjectId, runId: query.runId, modelId: query.modelId, feature: query.feature, provider: query.provider, limit: query.limit })
  return createHash("sha256").update(canonical).digest("hex")
}

function encodeUsageCursor(after: string, queryFingerprint: string): string {
  return Buffer.from(JSON.stringify({ version: 1, after, queryFingerprint }), "utf8").toString("base64url")
}

function decodeUsageCursor(cursor: string | undefined, queryFingerprint: string): string | undefined {
  if (!cursor) return undefined
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { version?: unknown; after?: unknown; queryFingerprint?: unknown }
    if (value.version !== 1 || typeof value.after !== "string" || value.queryFingerprint !== queryFingerprint) throw new Error("Invalid usage cursor")
    return value.after
  } catch {
    throw new Error("Invalid usage cursor")
  }
}
