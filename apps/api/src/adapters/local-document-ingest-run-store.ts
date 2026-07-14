import { randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DocumentIngestRun } from "../types.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { CreateDocumentIngestRunInput, DocumentIngestRunStore, UpdateDocumentIngestRunInput } from "./document-ingest-run-store.js"

export class LocalDocumentIngestRunStore implements DocumentIngestRunStore {
  constructor(private readonly baseDir: string) {}

  async create(input: CreateDocumentIngestRunInput): Promise<DocumentIngestRun> {
    if (await this.get(input.tenantId, input.runId)) throw new Error("Document ingest run already exists")
    await this.write(input)
    return input
  }

  async list(tenantId: string, limit = 500): Promise<DocumentIngestRun[]> {
    return (await this.listAll(tenantId)).slice(0, Math.max(1, limit))
  }

  async listAll(tenantId: string): Promise<DocumentIngestRun[]> {
    const runDir = path.join(this.baseDir, "document-ingest-runs", tenantPartitionId(tenantId))
    try {
      const entries = await readdir(runDir)
      const runs = await Promise.all(entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => JSON.parse(await readFile(path.join(runDir, entry), "utf-8")) as DocumentIngestRun))
      if (runs.some((run) => run.tenantId !== tenantId)) throw new Error("Document ingest run tenant partition is invalid")
      return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }
  }

  listAllAuthoritative(tenantId: string): Promise<DocumentIngestRun[]> {
    return this.listAll(tenantId)
  }

  async get(tenantId: string, runId: string): Promise<DocumentIngestRun | undefined> {
    try {
      const run = JSON.parse(await readFile(this.runPath(tenantId, runId), "utf-8")) as DocumentIngestRun
      if (run.tenantId !== tenantId || run.runId !== runId) throw new Error("Document ingest run tenant partition is invalid")
      return run
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        await this.assertNoLegacyRun(runId)
        return undefined
      }
      throw err
    }
  }

  async update(tenantId: string, runId: string, input: UpdateDocumentIngestRunInput): Promise<DocumentIngestRun> {
    const current = await this.get(tenantId, runId)
    if (!current) throw new Error("Document ingest run not found")
    const next = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    await this.write(next)
    return next
  }

  private async write(run: DocumentIngestRun): Promise<void> {
    const targetPath = this.runPath(run.tenantId, run.runId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify(run, null, 2))
    await rename(tempPath, targetPath)
  }

  private runPath(tenantId: string, runId: string): string {
    return path.join(this.baseDir, "document-ingest-runs", tenantPartitionId(tenantId), `${safeId(runId)}.json`)
  }

  private async assertNoLegacyRun(runId: string): Promise<void> {
    try {
      await readFile(path.join(this.baseDir, "document-ingest-runs", `${safeId(runId)}.json`), "utf-8")
      throw new Error("Legacy unscoped document ingest run requires tenant migration")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_")
}
