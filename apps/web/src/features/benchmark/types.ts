export type BenchmarkRunStatus = "queued" | "running" | "succeeded" | "failed" | "timed_out" | "cancelled"
export type BenchmarkMode = "agent" | "search" | "load"
export type BenchmarkRunner = "codebuild" | "lambda"

export type BenchmarkRunMetrics = {
  total: number
  succeeded: number
  failedHttp: number
  answerableAccuracy?: number | null
  turnAnswerCorrectRate?: number | null
  conversationSuccessRate?: number | null
  historyDependentAccuracy?: number | null
  clarificationNeedPrecision?: number | null
  clarificationNeedRecall?: number | null
  clarificationNeedF1?: number | null
  optionHitRate?: number | null
  missingSlotHitRate?: number | null
  corpusGroundedOptionRate?: number | null
  postClarificationAccuracy?: number | null
  overClarificationRate?: number | null
  clarificationLatencyOverheadMs?: number | null
  postClarificationTaskLatencyMs?: number | null
  abstentionRecall?: number | null
  abstentionAccuracy?: number | null
  citationHitRate?: number | null
  expectedFileHitRate?: number | null
  retrievalRecallAt20?: number | null
  retrievalRecallAtK?: number | null
  p50LatencyMs?: number | null
  p95LatencyMs?: number | null
  p99LatencyMs?: number | null
  averageLatencyMs?: number | null
  errorRate?: number | null
  falseDenialRate?: number | null
  faithfulness?: number | null
  contextRelevance?: number | null
  contextRelevanceSampleCount?: number | null
  citationCompleteness?: number | null
  falseAnswerRate?: number | null
  falseRefusalRate?: number | null
  taskCompletionRate?: number | null
  taskOutcomeAccuracy?: number | null
  eligibilityPropagationP99Ms?: number | null
  mttrMs?: number | null
  datasetVersion?: string
  workloadProfileVersion?: string
  runtimeProfileVersion?: string
  priceCatalogVersion?: string
  indexVersion?: string
  promptVersion?: string
  pipelineVersion?: string
  parserVersion?: string
  chunkerVersion?: string
  modelCostPerUnit?: number | null
  embeddingCostPerUnit?: number | null
  storageCostPerUnit?: number | null
  workerCostPerUnit?: number | null
  egressCostPerUnit?: number | null
  totalCostPerUnit?: number | null
  unitCostKind?: "chat_request" | "search_request" | "ingest_document"
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
  codeBuildLogUrl?: string
  codeBuildLogGroupName?: string
  codeBuildLogStreamName?: string
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
  summaryS3Key?: string
  reportS3Key?: string
  resultsS3Key?: string
  releaseAuditS3Key?: string
  artifactIntegrity?: {
    schemaVersion: 1
    status: "pending" | "complete" | "partial_failure" | "failed"
    availableCount: number
    failureCount: number
    artifacts: Array<{
      kind: "results" | "summary" | "report" | "release_audit"
      status: "pending" | "available" | "generation_failed" | "upload_failed"
      failureReason?: string
    }>
  }
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
