import type { BenchmarkRunStore } from "../adapters/benchmark-run-store.js"
import type { CodeBuildLogReader } from "../adapters/codebuild-log-reader.js"
import type { AppUser } from "../auth.js"
import type { BenchmarkRun } from "../types.js"

export type BenchmarkRunQueryPorts = {
  benchmarkRunStore: Pick<BenchmarkRunStore, "list" | "get">
  codeBuildLogReader?: Pick<CodeBuildLogReader, "getText">
  tenantIdForActor: (actor: AppUser) => string
}

export class BenchmarkRunQueryService {
  constructor(private readonly ports: BenchmarkRunQueryPorts) {}

  async list(actor: AppUser): Promise<BenchmarkRun[]> {
    return this.ports.benchmarkRunStore.list(this.ports.tenantIdForActor(actor))
  }

  async get(actor: AppUser, runId: string): Promise<BenchmarkRun | undefined> {
    return this.ports.benchmarkRunStore.get(this.ports.tenantIdForActor(actor), runId)
  }

  async getCodeBuildLogText(actor: AppUser, runId: string): Promise<{ text: string; fileName: string; contentDisposition: string } | undefined> {
    const run = await this.get(actor, runId)
    if (!run) return undefined

    const text = await this.ports.codeBuildLogReader?.getText({
      buildId: run.codeBuildBuildId,
      logGroupName: run.codeBuildLogGroupName,
      logStreamName: run.codeBuildLogStreamName
    })
    if (text === undefined) return undefined

    const fileName = `benchmark-logs-${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}.txt`
    return {
      text,
      fileName,
      contentDisposition: `attachment; filename="${fileName}"`
    }
  }
}
