import type { BenchmarkRunStore } from "../adapters/benchmark-run-store.js"
import type { AppUser } from "../auth.js"
import {
  isPermissionRevokedError,
  type WorkerAuthorizationBoundary
} from "../security/current-worker-authorization.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type {
  BenchmarkMode,
  BenchmarkRun,
  BenchmarkRunner,
  BenchmarkRunThresholds,
  BenchmarkSuite
} from "../types.js"
import type { BenchmarkExecutionStarter } from "./benchmark-execution-starter.js"

export type CreateBenchmarkRunInput = {
  suiteId?: string
  mode?: BenchmarkMode
  runner?: BenchmarkRunner
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
  thresholds?: BenchmarkRunThresholds
}

export type BenchmarkRunCreationDefaults = {
  suiteId: string
  runner: "codebuild"
  modelId: string
  embeddingModelId: string
}

export type BenchmarkRunCreationPorts = {
  benchmarkRunStore: Pick<BenchmarkRunStore, "create" | "update">
  suites: readonly BenchmarkSuite[]
  defaults: BenchmarkRunCreationDefaults
  executionEnabled: boolean
  tenantIdForActor: (actor: AppUser) => string
  securityResourceRefsForActor: (actor: AppUser) => Promise<string[]>
  normalizeTopK: (mode: BenchmarkMode, value: number | undefined) => number
  normalizeMemoryTopK: (value: number | undefined) => number
  normalizeMinScore: (value: number | undefined) => number
  authorizeBoundary: (run: BenchmarkRun, boundary: WorkerAuthorizationBoundary) => Promise<unknown>
  executionStarter: BenchmarkExecutionStarter
  now: () => string
  createRunId: (now: string) => string
}

export class BenchmarkRunCreationService {
  constructor(private readonly ports: BenchmarkRunCreationPorts) {}

  async create(actor: AppUser, input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    const suiteId = input.suiteId ?? this.ports.defaults.suiteId
    const suite = this.ports.suites.find((candidate) => candidate.suiteId === suiteId)
    if (!suite) throw new Error(`Unknown benchmark suite: ${input.suiteId}`)
    if ((input.mode ?? suite.mode) !== suite.mode) {
      throw new Error(`Suite ${suite.suiteId} does not support mode ${input.mode}`)
    }
    if ((input.runner ?? this.ports.defaults.runner) !== this.ports.defaults.runner) {
      throw new Error("Only codebuild runner is supported in this version")
    }

    const now = this.ports.now()
    const runId = this.ports.createRunId(now)
    const tenantId = this.ports.tenantIdForActor(actor)
    const outputPrefix = `runs/${tenantPartitionId(tenantId)}/${runId}`
    const run: BenchmarkRun = {
      runId,
      status: "queued",
      mode: suite.mode,
      runner: this.ports.defaults.runner,
      suiteId: suite.suiteId,
      datasetS3Key: suite.datasetS3Key,
      createdBy: actor.userId,
      tenantId,
      securityResourceRefs: await this.ports.securityResourceRefsForActor(actor),
      createdAt: now,
      updatedAt: now,
      modelId: input.modelId ?? this.ports.defaults.modelId,
      embeddingModelId: input.embeddingModelId ?? this.ports.defaults.embeddingModelId,
      topK: this.ports.normalizeTopK(suite.mode, input.topK),
      memoryTopK: this.ports.normalizeMemoryTopK(input.memoryTopK),
      minScore: this.ports.normalizeMinScore(input.minScore),
      concurrency: input.concurrency ?? suite.defaultConcurrency,
      thresholds: input.thresholds,
      summaryS3Key: `${outputPrefix}/summary.json`,
      reportS3Key: `${outputPrefix}/report.md`,
      resultsS3Key: `${outputPrefix}/results.jsonl`
    }

    await this.ports.benchmarkRunStore.create(run)
    if (!this.ports.executionEnabled) return run

    try {
      await this.ports.authorizeBoundary(run, "start")
      await this.ports.authorizeBoundary(run, "protected_read")
      await this.ports.authorizeBoundary(run, "external_side_effect")
      const executionArn = await this.ports.executionStarter.start(run, outputPrefix)
      await this.ports.authorizeBoundary(run, "durable_commit")
      return await this.ports.benchmarkRunStore.update(run.tenantId, run.runId, { executionArn })
    } catch (error) {
      const permissionRevoked = isPermissionRevokedError(error)
      const failed = await this.ports.benchmarkRunStore.update(run.tenantId, run.runId, {
        status: "failed",
        completedAt: this.ports.now(),
        error: permissionRevoked ? "permission_revoked" : error instanceof Error ? error.message : String(error),
        errorCode: permissionRevoked ? "permission_revoked" : "execution_error"
      })
      if (permissionRevoked) return failed
      throw error
    }
  }
}
