import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ChatRunEvent } from "../types.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { ChatRunEventStore, CreateChatRunEventInput } from "./chat-run-event-store.js"

export class LocalChatRunEventStore implements ChatRunEventStore {
  constructor(private readonly dataDir: string) {}

  async append(tenantId: string, input: CreateChatRunEventInput): Promise<ChatRunEvent> {
    const events = await this.read(tenantId, input.runId)
    const seq = input.seq ?? ((events.at(-1)?.seq ?? 0) + 1)
    const event: ChatRunEvent = {
      ...input,
      seq,
      createdAt: input.createdAt ?? new Date().toISOString()
    }
    events.push(event)
    await this.write(tenantId, input.runId, events)
    return event
  }

  async listAfter(tenantId: string, runId: string, afterSeq: number, limit = 50): Promise<ChatRunEvent[]> {
    return (await this.read(tenantId, runId)).filter((event) => event.seq > afterSeq).sort((a, b) => a.seq - b.seq).slice(0, limit)
  }

  private async read(tenantId: string, runId: string): Promise<ChatRunEvent[]> {
    try {
      return JSON.parse(await readFile(this.eventsPath(tenantId, runId), "utf-8")) as ChatRunEvent[]
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        await this.assertNoLegacyEvents(runId)
        return []
      }
      throw err
    }
  }

  private async write(tenantId: string, runId: string, events: ChatRunEvent[]): Promise<void> {
    await mkdir(this.eventsDir(tenantId), { recursive: true })
    const targetPath = this.eventsPath(tenantId, runId)
    const tempPath = `${targetPath}.${randomUUID()}.tmp`
    await writeFile(tempPath, `${JSON.stringify(events, null, 2)}\n`, "utf-8")
    await rename(tempPath, targetPath)
  }

  private eventsDir(tenantId: string): string {
    return path.join(this.dataDir, "chat-run-events", tenantPartitionId(tenantId))
  }

  private eventsPath(tenantId: string, runId: string): string {
    return path.join(this.eventsDir(tenantId), `${safeId(runId)}.json`)
  }

  private async assertNoLegacyEvents(runId: string): Promise<void> {
    try {
      await readFile(path.join(this.dataDir, "chat-run-events", `${safeId(runId)}.json`), "utf-8")
      throw new Error("Legacy unscoped chat run events require tenant migration")
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return
      throw error
    }
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_")
}
