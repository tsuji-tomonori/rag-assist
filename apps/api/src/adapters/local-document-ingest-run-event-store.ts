import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DocumentIngestRunEvent } from "../types.js"
import type { CreateDocumentIngestRunEventInput, DocumentIngestRunEventStore } from "./document-ingest-run-event-store.js"

export class LocalDocumentIngestRunEventStore implements DocumentIngestRunEventStore {
  constructor(private readonly baseDir: string) {}

  async append(input: CreateDocumentIngestRunEventInput): Promise<DocumentIngestRunEvent> {
    const events = await this.read(input.runId)
    const event: DocumentIngestRunEvent = {
      ...input,
      seq: input.seq ?? ((events.at(-1)?.seq ?? 0) + 1),
      createdAt: input.createdAt ?? new Date().toISOString()
    }
    events.push(event)
    await this.write(input.runId, events)
    return event
  }

  async listAfter(runId: string, afterSeq: number, limit = 50): Promise<DocumentIngestRunEvent[]> {
    return (await this.read(runId)).filter((event) => event.seq > afterSeq).slice(0, limit)
  }

  private async read(runId: string): Promise<DocumentIngestRunEvent[]> {
    try {
      return JSON.parse(await readFile(this.eventsPath(runId), "utf-8")) as DocumentIngestRunEvent[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
      throw err
    }
  }

  private async write(runId: string, events: DocumentIngestRunEvent[]): Promise<void> {
    const targetPath = this.eventsPath(runId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify(events, null, 2))
    await rename(tempPath, targetPath)
  }

  private eventsPath(runId: string): string {
    return path.join(this.baseDir, "document-ingest-run-events", `${runId}.json`)
  }
}
