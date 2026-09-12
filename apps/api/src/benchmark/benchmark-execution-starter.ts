import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn"
import { tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import type { BenchmarkRun } from "../types.js"

export type BenchmarkExecutionStarter = {
  start(run: BenchmarkRun, outputPrefix: string): Promise<string>
}

export type BenchmarkExecutionStarterConfig = {
  region: string
  stateMachineArn: string
  bucketName: string
  targetApiBaseUrl: string
}

export type BenchmarkExecutionStartClient = {
  send(command: StartExecutionCommand): Promise<{ executionArn?: string }>
}

export class AwsBenchmarkExecutionStarter implements BenchmarkExecutionStarter {
  private readonly client: BenchmarkExecutionStartClient

  constructor(
    private readonly config: BenchmarkExecutionStarterConfig,
    client?: BenchmarkExecutionStartClient
  ) {
    this.client = client ?? new SFNClient({ region: config.region })
  }

  async start(run: BenchmarkRun, outputPrefix: string): Promise<string> {
    const response = await this.client.send(new StartExecutionCommand({
      stateMachineArn: this.config.stateMachineArn,
      name: benchmarkWorkerExecutionName(run.tenantId, run.runId),
      input: JSON.stringify({
        runId: run.runId,
        storageRunId: tenantStorageKey(run.tenantId, run.runId),
        createdBy: run.createdBy,
        tenantId: run.tenantId,
        mode: run.mode,
        runner: run.runner,
        suiteId: run.suiteId,
        datasetS3Key: run.datasetS3Key,
        datasetS3Uri: `s3://${this.config.bucketName}/${run.datasetS3Key}`,
        outputS3Prefix: `s3://${this.config.bucketName}/${outputPrefix}`,
        apiBaseUrl: this.config.targetApiBaseUrl,
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
    }))
    if (!response.executionArn) throw new Error("Step Functions executionArn was not returned")
    return response.executionArn
  }
}

function benchmarkWorkerExecutionName(tenantId: string, runId: string): string {
  return `${tenantPartitionId(tenantId).replace(":", "-")}-${runId}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80)
}
