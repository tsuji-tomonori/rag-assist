import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ChatRun } from "../types.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import { chatRunResultFieldNames, type ChatRunExecutionEnvelope, type ChatRunStore, type CreateChatRunInput, type UpdateChatRunInput } from "./chat-run-store.js"

const conditionalUpdateQueues = new Map<string, Promise<void>>()

export class LocalChatRunStore implements ChatRunStore {
  constructor(private readonly dataDir: string) {}

  async create(input: CreateChatRunInput): Promise<ChatRun> {
    if (await this.get(input.tenantId, input.runId)) throw new Error("Chat run already exists")
    await this.write(input)
    return input
  }

  async list(tenantId: string, limit = 500): Promise<ChatRun[]> {
    return (await this.listAll(tenantId)).slice(0, Math.max(1, limit))
  }

  async listAll(tenantId: string): Promise<ChatRun[]> {
    try {
      const entries = await readdir(this.runDir(tenantId))
      const runs = await Promise.all(entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => JSON.parse(await readFile(path.join(this.runDir(tenantId), entry), "utf-8")) as ChatRun))
      if (runs.some((run) => run.tenantId !== tenantId)) throw new Error("Chat run tenant partition is invalid")
      return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []
      throw error
    }
  }

  listAllAuthoritative(tenantId: string): Promise<ChatRun[]> {
    return this.listAll(tenantId)
  }

  async get(tenantId: string, runId: string): Promise<ChatRun | undefined> {
    try {
      const run = JSON.parse(await readFile(this.runPath(tenantId, runId), "utf-8")) as ChatRun
      if (run.tenantId !== tenantId || run.runId !== runId) throw new Error("Chat run tenant partition is invalid")
      return run
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        await this.assertNoLegacyRun(runId)
        return undefined
      }
      throw err
    }
  }

  async getExecutionEnvelope(tenantId: string, runId: string): Promise<ChatRunExecutionEnvelope | undefined> {
    const run = await this.get(tenantId, runId)
    if (!run) return undefined
    const {
      runId: id, tenantId: tenant, status, createdBy, userEmail, userGroups, securityResourceRefs, searchScope,
      createdAt, updatedAt, startedAt, completedAt, error, errorCode, ttl
    } = run
    return {
      runId: id, tenantId: tenant, status, createdBy, userEmail, userGroups, securityResourceRefs, searchScope,
      createdAt, updatedAt, startedAt, completedAt, error, errorCode, ttl
    }
  }

  async update(tenantId: string, runId: string, input: UpdateChatRunInput): Promise<ChatRun> {
    const current = await this.get(tenantId, runId)
    if (!current) throw new Error("Chat run not found")
    const { clearResult, ...patch } = input
    const updated = { ...current, ...patch, updatedAt: input.updatedAt ?? new Date().toISOString() }
    if (clearResult) {
      for (const field of chatRunResultFieldNames) delete updated[field]
    }
    await this.write(updated)
    return updated
  }

  async updateIfStatus(
    tenantId: string,
    runId: string,
    expectedStatus: ChatRun["status"],
    input: UpdateChatRunInput
  ): Promise<boolean> {
    return runConditionalUpdate(this.runPath(tenantId, runId), async () => {
      const current = await this.get(tenantId, runId)
      if (!current || current.status !== expectedStatus) return false
      const { clearResult, ...patch } = input
      const updated = { ...current, ...patch, updatedAt: input.updatedAt ?? new Date().toISOString() }
      if (clearResult) for (const field of chatRunResultFieldNames) delete updated[field]
      await this.write(updated)
      return true
    })
  }

  private async write(run: ChatRun): Promise<void> {
    await mkdir(this.runDir(run.tenantId), { recursive: true })
    await writeFile(this.runPath(run.tenantId, run.runId), `${JSON.stringify(run, null, 2)}\n`, "utf-8")
  }

  private runDir(tenantId: string): string {
    return path.join(this.dataDir, "chat-runs", tenantPartitionId(tenantId))
  }

  private runPath(tenantId: string, runId: string): string {
    return path.join(this.runDir(tenantId), `${safeId(runId)}.json`)
  }

  private async assertNoLegacyRun(runId: string): Promise<void> {
    try {
      await readFile(path.join(this.dataDir, "chat-runs", `${safeId(runId)}.json`), "utf-8")
      throw new Error("Legacy unscoped chat run requires tenant migration")
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return
      throw error
    }
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_")
}

async function runConditionalUpdate<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = conditionalUpdateQueues.get(key) ?? Promise.resolve()
  let release: () => void = () => undefined
  const current = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => current, () => current)
  conditionalUpdateQueues.set(key, queued)
  await previous.catch(() => undefined)
  try {
    return await task()
  } finally {
    release()
    if (conditionalUpdateQueues.get(key) === queued) conditionalUpdateQueues.delete(key)
  }
}
