import { randomUUID } from "node:crypto"
import type { ObjectStore } from "./object-store.js"
import type { UsageEvent } from "../types.js"

export interface UsageEventStore {
  putOnce(event: UsageEvent): Promise<void>
  list(): Promise<UsageEvent[]>
}

export class InMemoryUsageEventStore implements UsageEventStore {
  private readonly events: UsageEvent[] = []

  async putOnce(event: UsageEvent): Promise<void> {
    if (this.events.some((candidate) => candidate.idempotencyKey === event.idempotencyKey)) return
    this.events.push(event)
  }

  async list(): Promise<UsageEvent[]> {
    return [...this.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export class ObjectStoreUsageEventStore implements UsageEventStore {
  constructor(private readonly objectStore: ObjectStore) {}

  async putOnce(event: UsageEvent): Promise<void> {
    const existing = await this.list()
    if (existing.some((candidate) => candidate.idempotencyKey === event.idempotencyKey)) return
    await this.objectStore.putText(usageEventKey(event), JSON.stringify(event, null, 2), "application/json; charset=utf-8")
  }

  async list(): Promise<UsageEvent[]> {
    const keys = await this.objectStore.listKeys("usage-events/")
    const events = await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => JSON.parse(await this.objectStore.getText(key)) as UsageEvent)
    )
    return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

function usageEventKey(event: Pick<UsageEvent, "createdAt" | "eventId">): string {
  const timestamp = event.createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `usage-events/${timestamp}-${event.eventId || randomUUID()}.json`
}
