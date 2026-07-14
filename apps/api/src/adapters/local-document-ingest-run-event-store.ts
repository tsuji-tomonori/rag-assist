import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DocumentIngestRunEvent } from "../types.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { CreateDocumentIngestRunEventInput, DocumentIngestRunEventStore } from "./document-ingest-run-event-store.js"

export class LocalDocumentIngestRunEventStore implements DocumentIngestRunEventStore {
  constructor(private readonly baseDir: string) {}

  async append(tenantId: string, input: CreateDocumentIngestRunEventInput): Promise<DocumentIngestRunEvent> {
    const events = await this.read(tenantId, input.runId)
    const event: DocumentIngestRunEvent = {
      ...input,
      seq: input.seq ?? ((events.at(-1)?.seq ?? 0) + 1),
      createdAt: input.createdAt ?? new Date().toISOString()
    }
    events.push(event)
    await this.write(tenantId, input.runId, events)
    return event
  }

  async listAfter(tenantId: string, runId: string, afterSeq: number, limit = 50): Promise<DocumentIngestRunEvent[]> {
    return (await this.read(tenantId, runId)).filter((event) => event.seq > afterSeq).slice(0, limit)
  }

  private async read(tenantId: string, runId: string): Promise<DocumentIngestRunEvent[]> {
    try {
      return JSON.parse(await readFile(this.eventsPath(tenantId, runId), "utf-8")) as DocumentIngestRunEvent[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        await this.assertNoLegacyEvents(runId)
        return []
      }
      throw err
    }
  }

  private async write(tenantId: string, runId: string, events: DocumentIngestRunEvent[]): Promise<void> {
    const targetPath = this.eventsPath(tenantId, runId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify(events, null, 2))
    await rename(tempPath, targetPath)
  }

  private eventsPath(tenantId: string, runId: string): string {
    return path.join(this.baseDir, "document-ingest-run-events", tenantPartitionId(tenantId), `${safeId(runId)}.json`)
  }

  private async assertNoLegacyEvents(runId: string): Promise<void> {
    try {
      await readFile(path.join(this.baseDir, "document-ingest-run-events", `${safeId(runId)}.json`), "utf-8")
      throw new Error("Legacy unscoped document ingest run events require tenant migration")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_")
}
