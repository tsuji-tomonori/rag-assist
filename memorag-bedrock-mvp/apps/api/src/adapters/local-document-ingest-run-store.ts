import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DocumentIngestRun } from "../types.js"
import type { CreateDocumentIngestRunInput, DocumentIngestRunStore, UpdateDocumentIngestRunInput } from "./document-ingest-run-store.js"

export class LocalDocumentIngestRunStore implements DocumentIngestRunStore {
  constructor(private readonly baseDir: string) {}

  async create(input: CreateDocumentIngestRunInput): Promise<DocumentIngestRun> {
    await this.write(input)
    return input
  }

  async get(runId: string): Promise<DocumentIngestRun | undefined> {
    try {
      return JSON.parse(await readFile(this.runPath(runId), "utf-8")) as DocumentIngestRun
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined
      throw err
    }
  }

  async update(runId: string, input: UpdateDocumentIngestRunInput): Promise<DocumentIngestRun> {
    const current = await this.get(runId)
    if (!current) throw new Error("Document ingest run not found")
    const next = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    await this.write(next)
    return next
  }

  private async write(run: DocumentIngestRun): Promise<void> {
    await mkdir(path.dirname(this.runPath(run.runId)), { recursive: true })
    await writeFile(this.runPath(run.runId), JSON.stringify(run, null, 2))
  }

  private runPath(runId: string): string {
    return path.join(this.baseDir, "document-ingest-runs", `${runId}.json`)
  }
}
