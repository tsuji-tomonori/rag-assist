import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
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
    const targetPath = this.runPath(run.runId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify(run, null, 2))
    await rename(tempPath, targetPath)
  }

  private runPath(runId: string): string {
    return path.join(this.baseDir, "document-ingest-runs", `${runId}.json`)
  }
}
