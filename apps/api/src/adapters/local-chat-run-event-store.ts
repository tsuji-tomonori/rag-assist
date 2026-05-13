import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ChatRunEvent } from "../types.js"
import type { ChatRunEventStore, CreateChatRunEventInput } from "./chat-run-event-store.js"

export class LocalChatRunEventStore implements ChatRunEventStore {
  constructor(private readonly dataDir: string) {}

  async append(input: CreateChatRunEventInput): Promise<ChatRunEvent> {
    const events = await this.read(input.runId)
    const seq = input.seq ?? ((events.at(-1)?.seq ?? 0) + 1)
    const event: ChatRunEvent = {
      ...input,
      seq,
      createdAt: input.createdAt ?? new Date().toISOString()
    }
    events.push(event)
    await this.write(input.runId, events)
    return event
  }

  async listAfter(runId: string, afterSeq: number, limit = 50): Promise<ChatRunEvent[]> {
    return (await this.read(runId)).filter((event) => event.seq > afterSeq).sort((a, b) => a.seq - b.seq).slice(0, limit)
  }

  private async read(runId: string): Promise<ChatRunEvent[]> {
    try {
      return JSON.parse(await readFile(this.eventsPath(runId), "utf-8")) as ChatRunEvent[]
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return []
      throw err
    }
  }

  private async write(runId: string, events: ChatRunEvent[]): Promise<void> {
    await mkdir(this.eventsDir(), { recursive: true })
    await writeFile(this.eventsPath(runId), `${JSON.stringify(events, null, 2)}\n`, "utf-8")
  }

  private eventsDir(): string {
    return path.join(this.dataDir, "chat-run-events")
  }

  private eventsPath(runId: string): string {
    return path.join(this.eventsDir(), `${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`)
  }
}
