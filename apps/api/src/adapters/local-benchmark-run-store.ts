import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type { BenchmarkRun } from "../types.js"
import type { BenchmarkRunStore, CreateBenchmarkRunInput, UpdateBenchmarkRunInput } from "./benchmark-run-store.js"

export class LocalBenchmarkRunStore implements BenchmarkRunStore {
  constructor(private readonly dataDir: string) {}

  async create(input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    await this.write(input)
    return input
  }

  async list(limit = 50): Promise<BenchmarkRun[]> {
    const dir = this.runDir()
    try {
      const entries = await readdir(dir)
      const runs = await Promise.all(
        entries
          .filter((entry) => entry.endsWith(".json"))
          .map(async (entry) => JSON.parse(await readFile(path.join(dir, entry), "utf-8")) as BenchmarkRun)
      )
      return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return []
      throw err
    }
  }

  async get(runId: string): Promise<BenchmarkRun | undefined> {
    try {
      return JSON.parse(await readFile(this.runPath(runId), "utf-8")) as BenchmarkRun
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return undefined
      throw err
    }
  }

  async update(runId: string, input: UpdateBenchmarkRunInput): Promise<BenchmarkRun> {
    const current = await this.get(runId)
    if (!current) throw new Error("Benchmark run not found")
    const updated = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    await this.write(updated)
    return updated
  }

  private async write(run: BenchmarkRun): Promise<void> {
    await mkdir(this.runDir(), { recursive: true })
    await writeFile(this.runPath(run.runId), `${JSON.stringify(run, null, 2)}\n`, "utf-8")
  }

  private runDir(): string {
    return path.join(this.dataDir, "benchmark-runs")
  }

  private runPath(runId: string): string {
    return path.join(this.runDir(), `${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`)
  }
}
