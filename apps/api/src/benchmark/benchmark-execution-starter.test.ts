import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type { StartExecutionCommand } from "@aws-sdk/client-sfn"
import { tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import type { BenchmarkRun } from "../types.js"
import {
  AwsBenchmarkExecutionStarter,
  type BenchmarkExecutionStartClient,
  type BenchmarkExecutionStarterConfig
} from "./benchmark-execution-starter.js"

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const adapterSource = readFileSync(path.join(sourceRoot, "benchmark/benchmark-execution-starter.ts"), "utf8")
const facadeSource = readFileSync(path.join(sourceRoot, "rag/memorag-service.ts"), "utf8")

test("benchmark execution start mapping is isolated from the facade behind a narrow adapter", () => {
  assert.doesNotMatch(adapterSource, /Dependencies|benchmarkRunStore|authoritativeActorTenantId|from "\.\.\/config\.js"/)
  assert.match(adapterSource, /implements BenchmarkExecutionStarter/)
  assert.match(facadeSource, /private readonly benchmarkExecutionStarter: BenchmarkExecutionStarter/)
  assert.match(facadeSource, /this\.benchmarkExecutionStarter\.start\(run, outputPrefix\)/)
  assert.doesNotMatch(facadeSource, /private async startBenchmarkExecution/)
})

test("AwsBenchmarkExecutionStarter maps the exact tenant-scoped Step Functions command", async () => {
  const commands: StartExecutionCommand[] = []
  const client: BenchmarkExecutionStartClient = {
    send: async (command) => {
      commands.push(command)
      return { executionArn: "arn:aws:states:ap-northeast-1:123:execution:benchmark:run-1" }
    }
  }
  const config: BenchmarkExecutionStarterConfig = {
    region: "ap-northeast-1",
    stateMachineArn: "arn:aws:states:ap-northeast-1:123:stateMachine:benchmark",
    bucketName: "benchmark-artifacts",
    targetApiBaseUrl: "https://api.example.test"
  }
  const run = benchmarkRun()
  const outputPrefix = `runs/${tenantPartitionId(run.tenantId)}/${run.runId}`

  const executionArn = await new AwsBenchmarkExecutionStarter(config, client).start(run, outputPrefix)

  assert.equal(executionArn, "arn:aws:states:ap-northeast-1:123:execution:benchmark:run-1")
  assert.equal(commands.length, 1)
  assert.deepEqual(commands[0]?.input, {
    stateMachineArn: config.stateMachineArn,
    name: `${tenantPartitionId(run.tenantId).replace(":", "-")}-${run.runId}`,
    input: JSON.stringify({
      runId: run.runId,
      storageRunId: tenantStorageKey(run.tenantId, run.runId),
      createdBy: run.createdBy,
      tenantId: run.tenantId,
      mode: run.mode,
      runner: run.runner,
      suiteId: run.suiteId,
      datasetS3Key: run.datasetS3Key,
      datasetS3Uri: `s3://${config.bucketName}/${run.datasetS3Key}`,
      outputS3Prefix: `s3://${config.bucketName}/${outputPrefix}`,
      apiBaseUrl: config.targetApiBaseUrl,
      modelId: run.modelId,
      embeddingModelId: run.embeddingModelId,
      topK: run.topK,
      memoryTopK: run.memoryTopK,
      minScore: run.minScore,
      concurrency: run.concurrency,
      summaryS3Key: run.summaryS3Key,
      reportS3Key: run.reportS3Key,
      resultsS3Key: run.resultsS3Key
    })
  })
})

test("AwsBenchmarkExecutionStarter preserves execution ARN and client failure behavior", async () => {
  const missingArnClient: BenchmarkExecutionStartClient = { send: async () => ({}) }
  await assert.rejects(
    () => new AwsBenchmarkExecutionStarter(starterConfig(), missingArnClient).start(benchmarkRun(), "runs/output"),
    /Step Functions executionArn was not returned/
  )

  const failure = new Error("Step Functions unavailable")
  const failingClient: BenchmarkExecutionStartClient = { send: async () => { throw failure } }
  await assert.rejects(
    () => new AwsBenchmarkExecutionStarter(starterConfig(), failingClient).start(benchmarkRun(), "runs/output"),
    (error: unknown) => error === failure
  )
})

test("AwsBenchmarkExecutionStarter sanitizes only the execution name and keeps the canonical tenant storage run id", async () => {
  let captured: StartExecutionCommand | undefined
  const client: BenchmarkExecutionStartClient = {
    send: async (command) => {
      captured = command
      return { executionArn: "arn:aws:states:ap-northeast-1:123:execution:benchmark:unsafe" }
    }
  }
  const run = {
    ...benchmarkRun(),
    runId: `run:/unsafe value?${"x".repeat(90)}`
  }

  await new AwsBenchmarkExecutionStarter(starterConfig(), client).start(run, "runs/unsafe")

  const expectedName = `${tenantPartitionId(run.tenantId).replace(":", "-")}-${run.runId}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80)
  assert.equal(captured?.input.name, expectedName)
  assert.equal(captured?.input.name?.length, 80)
  const payload = JSON.parse(captured?.input.input ?? "{}") as Record<string, unknown>
  assert.equal(payload.runId, run.runId)
  assert.equal(payload.storageRunId, tenantStorageKey(run.tenantId, run.runId))
})

function starterConfig(): BenchmarkExecutionStarterConfig {
  return {
    region: "ap-northeast-1",
    stateMachineArn: "arn:aws:states:ap-northeast-1:123:stateMachine:benchmark",
    bucketName: "benchmark-artifacts",
    targetApiBaseUrl: "https://api.example.test"
  }
}

function benchmarkRun(): BenchmarkRun {
  return {
    runId: "run-1",
    status: "queued",
    mode: "agent",
    runner: "codebuild",
    suiteId: "standard-agent-v1",
    datasetS3Key: "benchmark/dataset.jsonl",
    createdBy: "user-1",
    tenantId: "tenant-a",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    modelId: "model-1",
    embeddingModelId: "embedding-1",
    topK: 12,
    memoryTopK: 5,
    minScore: 0.25,
    concurrency: 3,
    summaryS3Key: "runs/summary.json",
    reportS3Key: "runs/report.md",
    resultsS3Key: "runs/results.jsonl"
  }
}
