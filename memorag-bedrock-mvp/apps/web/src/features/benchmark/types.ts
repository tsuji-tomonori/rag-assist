export type BenchmarkRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"
export type BenchmarkMode = "agent" | "search" | "load"
export type BenchmarkRunner = "codebuild" | "lambda"

export type BenchmarkRunMetrics = {
  total: number
  succeeded: number
  failedHttp: number
  answerableAccuracy?: number | null
  abstentionRecall?: number | null
  citationHitRate?: number | null
  expectedFileHitRate?: number | null
  retrievalRecallAt20?: number | null
  p50LatencyMs?: number | null
  p95LatencyMs?: number | null
  averageLatencyMs?: number | null
  errorRate?: number | null
}

export type BenchmarkRun = {
  runId: string
  status: BenchmarkRunStatus
  mode: BenchmarkMode
  runner: BenchmarkRunner
  suiteId: string
  datasetS3Key: string
  createdBy: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  executionArn?: string
  codeBuildBuildId?: string
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
  summaryS3Key?: string
  reportS3Key?: string
  resultsS3Key?: string
  metrics?: BenchmarkRunMetrics
  error?: string
}

export type BenchmarkSuite = {
  suiteId: string
  label: string
  mode: BenchmarkMode
  datasetS3Key: string
  preset: "smoke" | "standard"
  defaultConcurrency: number
}
