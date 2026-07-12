import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type { BenchmarkRun } from "../types.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { BenchmarkRunStore, CreateBenchmarkRunInput, UpdateBenchmarkRunInput } from "./benchmark-run-store.js"

export class LocalBenchmarkRunStore implements BenchmarkRunStore {
  constructor(private readonly dataDir: string) {}

  async create(input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    if (await this.get(input.tenantId, input.runId)) throw new Error("Benchmark run already exists")
    await this.write(input)
    return input
  }

  async list(tenantId: string, limit = 50): Promise<BenchmarkRun[]> {
    return (await this.listAll(tenantId)).slice(0, Math.max(1, limit))
  }

  async listAll(tenantId: string): Promise<BenchmarkRun[]> {
    const dir = this.runDir(tenantId)
    try {
      const entries = await readdir(dir)
      const runs = await Promise.all(
        entries
          .filter((entry) => entry.endsWith(".json"))
          .map(async (entry) => JSON.parse(await readFile(path.join(dir, entry), "utf-8")) as BenchmarkRun)
      )
      if (runs.some((run) => run.tenantId !== tenantId)) throw new Error("Benchmark run tenant partition is invalid")
      return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        await this.assertNoLegacyRuns()
        return []
      }
      throw err
    }
  }

  listAllAuthoritative(tenantId: string): Promise<BenchmarkRun[]> {
    return this.listAll(tenantId)
  }

  async get(tenantId: string, runId: string): Promise<BenchmarkRun | undefined> {
    try {
      const run = JSON.parse(await readFile(this.runPath(tenantId, runId), "utf-8")) as BenchmarkRun
      if (run.tenantId !== tenantId || run.runId !== runId) throw new Error("Benchmark run tenant partition is invalid")
      return run
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        await this.assertNoLegacyRun(runId)
        return undefined
      }
      throw err
    }
  }

  async update(tenantId: string, runId: string, input: UpdateBenchmarkRunInput): Promise<BenchmarkRun> {
    const current = await this.get(tenantId, runId)
    if (!current) throw new Error("Benchmark run not found")
    const updated = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    await this.write(updated)
    return updated
  }

  private async write(run: BenchmarkRun): Promise<void> {
    await mkdir(this.runDir(run.tenantId), { recursive: true })
    await writeFile(this.runPath(run.tenantId, run.runId), `${JSON.stringify(run, null, 2)}\n`, "utf-8")
  }

  private runDir(tenantId: string): string {
    return path.join(this.dataDir, "benchmark-runs", tenantPartitionId(tenantId))
  }

  private runPath(tenantId: string, runId: string): string {
    return path.join(this.runDir(tenantId), `${safeId(runId)}.json`)
  }

  private async assertNoLegacyRun(runId: string): Promise<void> {
    try {
      await readFile(path.join(this.dataDir, "benchmark-runs", `${safeId(runId)}.json`), "utf-8")
      throw new Error("Legacy unscoped benchmark run requires tenant migration")
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return
      throw error
    }
  }

  private async assertNoLegacyRuns(): Promise<void> {
    try {
      const entries = await readdir(path.join(this.dataDir, "benchmark-runs"), { withFileTypes: true })
      if (entries.some((entry) => entry.isFile() && entry.name.endsWith(".json"))) {
        throw new Error("Legacy unscoped benchmark runs require tenant migration")
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return
      throw error
    }
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_")
}
