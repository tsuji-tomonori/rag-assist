import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"
import { benchmarkCorpusDirFromEnv, benchmarkCorpusSkipMemoryFromEnv, benchmarkIngestRunPollIntervalMsFromEnv, benchmarkIngestRunTimeoutMsFromEnv, seedBenchmarkCorpus, type SeededDocument } from "./corpus.js"
import { createBenchmarkApiClient } from "./api-client.js"
import { createSkippedDatasetRow, skippedCorpusFileNameSet, skippedExpectedFileNames, type SkippedDatasetRow } from "./skipped-corpus.js"
import { createQualityReview, type QualityReview } from "./metrics/quality.js"
import { normalizeExpectedDrawingValue, normalizedDrawingValuesMatch, type DrawingValueKind } from "./metrics/drawing-normalization.js"
import {
  assertComparableProfiles,
  assertSuiteEvaluatorProfile,
  profileKey,
  resolveEvaluatorProfile,
  type EvaluatorProfile
} from "./evaluator-profile.js"
import {
  benchmarkArtifactContractVersion,
  createBenchmarkCaseResult,
  createBenchmarkDatasetPrepareRun,
  createBenchmarkRunArtifact,
  createBenchmarkSuiteMetadata,
  datasetSourceFromEnv,
  targetConfigFromEnv
} from "./artifact-contract.js"
import type { BenchmarkQueryResponse } from "@memorag-mvp/contract"
import type { BenchmarkRun, BenchmarkSuite, BenchmarkTargetConfig, BenchmarkUseCase } from "@memorag-mvp/contract"

type DatasetRow = {
  id?: string
  question: string
  agentRunId?: string
  asyncAgentRun?: AsyncAgentRunMetadata
  expectedAsyncAgentStatus?: AsyncAgentRunStatus
  expectedProviderAvailability?: AgentProviderAvailability
  expectedFailureReasonCode?: AsyncAgentFailureReasonCode
  expectedNoArtifacts?: boolean
  expectedArtifactMetadataRedacted?: boolean
  artifactMetadataForbiddenPatterns?: string[]
  conversationId?: string
  turnId?: string
  turnIndex?: number
  history?: ConversationTurn[]
  conversation?: ConversationInput
  expectedStandaloneQuestion?: string
  expectedEvidenceTurns?: Array<string | number>
  turnDependency?: string
  expected?: string
  expectedAnswer?: string
  referenceAnswer?: string
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
  expectedResponseType?: "answer" | "refusal" | "clarification"
  expectedClarification?: boolean
  expectedMissingSlots?: string[]
  expectedOptionsAnyOf?: string[]
  followUp?: FollowUpExpectation
  answerable?: boolean
  complexity?: "simple" | "multi_hop" | "comparison" | "procedure" | "ambiguous" | "out_of_scope"
  unanswerableType?: "missing_fact" | "out_of_scope" | "ambiguous" | "conflicting" | string
  expectedFiles?: string[]
  expectedFileNames?: string[]
  expectedDocumentIds?: string[]
  expectedPages?: Array<number | string>
  expectedRegionIds?: string[]
  forbiddenFiles?: string[]
  forbiddenDocumentIds?: string[]
  expectedFactSlots?: ExpectedFactSlot[]
  expectedNormalizedValues?: ExpectedNormalizedValue[]
  expectedExtractionValues?: ExpectedNormalizedValue[]
  expectedCounts?: ExpectedCount[]
  expectedGraphResolutions?: ExpectedGraphResolution[]
  evidenceSufficiency?: EvidenceSufficiencyExpectation
  modelId?: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  strictGrounded?: boolean
  useMemory?: boolean
  evaluatorProfile?: string
  metadata?: Record<string, unknown>
}

type FollowUpExpectation = {
  selectedOptionId?: string
  selectedOptionLabel?: string
  selectedResolvedQuery?: string
  expectedResponseType?: "answer" | "refusal"
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
  answerable?: boolean
  expectedFiles?: string[]
  expectedFileNames?: string[]
  expectedDocumentIds?: string[]
}

type ExpectedFactSlot = {
  id: string
  description?: string
  mustContain?: string | string[]
  expectedFiles?: string[]
  expectedDocumentIds?: string[]
}

type ExpectedNormalizedValue = string | {
  raw?: string
  canonical?: string
  kind?: DrawingValueKind
}

type ExpectedCount = {
  id?: string
  label?: string
  expected: number
}

type ExpectedGraphResolution = {
  id?: string
  target?: string
}

type EvidenceSufficiencyExpectation = {
  requireBbox?: boolean
  expectedSourceTypes?: string | string[]
  sourcePriority?: string[]
}

type Citation = {
  documentId?: string
  fileName?: string
  chunkId?: string
  regionId?: string
  regionType?: string
  sourceType?: string
  bbox?: unknown
  pageStart?: number
  pageEnd?: number
  pageOrSheet?: string
  drawingNo?: string
  sheetTitle?: string
  scale?: string
  score?: number
  text?: string
  metadata?: Record<string, unknown>
}

type ConversationTurn = {
  role: "user" | "assistant"
  text: string
  citations?: Citation[]
  createdAt?: string
}

type ConversationInput = {
  conversationId: string
  turnId?: string
  turnIndex?: number
  turns: ConversationTurn[]
  turnDependency?: string
  state?: {
    activeEntities?: string[]
    activeDocuments?: string[]
    activeTopics?: string[]
    constraints?: string[]
  }
}

type BenchmarkResponse = Partial<BenchmarkQueryResponse> & {
  answerSupport?: {
    unsupportedSentences?: Array<{ sentence?: string; reason?: string }>
    totalSentences?: number
  }
  diagnostics?: {
    extractions?: DiagnosticExtraction[]
    counts?: DiagnosticCount[]
    graphResolutions?: DiagnosticGraphResolution[]
  }
  error?: string
}

type DiagnosticExtraction = {
  id?: string
  kind?: DrawingValueKind
  raw?: string
  value?: string
  canonical?: string
  normalizedValue?: string
}

type DiagnosticCount = {
  id?: string
  label?: string
  value?: number
  count?: number
}

type DiagnosticGraphResolution = {
  id?: string
  target?: string
  resolvedTarget?: string
}

type ClarificationResponseOption = NonNullable<NonNullable<BenchmarkResponse["clarification"]>["options"]>[number]

type AgentProviderAvailability = "disabled" | "not_configured" | "provider_unavailable" | "available"

type AsyncAgentRunStatus =
  | "queued"
  | "preparing_workspace"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled"
  | "expired"

type AsyncAgentFailureReasonCode = "not_configured" | "provider_unavailable" | "cancelled" | "execution_error"

type AsyncAgentArtifactMetadata = {
  artifactId?: string
  artifactType?: string
  fileName?: string
  mimeType?: string
  size?: number
  storageRef?: string
  writebackStatus?: string
}

type AsyncAgentRunMetadata = {
  agentRunId?: string
  runId?: string
  provider?: string
  modelId?: string
  status?: AsyncAgentRunStatus
  providerAvailability?: AgentProviderAvailability
  failureReasonCode?: AsyncAgentFailureReasonCode
  failureReason?: string
  artifactIds?: string[]
  artifacts?: AsyncAgentArtifactMetadata[]
}

type RowEvaluation = {
  expectedAnswerable: boolean
  actualAnswerable: boolean
  answerabilityCorrect: boolean
  expectedResponseType: "answer" | "refusal" | "clarification"
  actualResponseType: "answer" | "refusal" | "clarification"
  responseTypeCorrect: boolean
  clarificationNeededCorrect: boolean | null
  optionHit: boolean | null
  missingSlotHit: boolean | null
  corpusGroundedOptions: boolean | null
  postClarificationAnswerCorrect: boolean | null
  queryRewriteHit: boolean | null
  answerContainsExpected: boolean | null
  regexMatched: boolean | null
  answerContentCorrect: boolean
  groundedFileCorrect: boolean | null
  groundedPageCorrect: boolean | null
  answerCorrect: boolean
  abstentionCorrect: boolean | null
  unsupportedAnswer: boolean
  citationHit: boolean | null
  expectedFileHit: boolean | null
  expectedPageHit: boolean | null
  pageRecallAtK: boolean | null
  pageRecallAt20: boolean | null
  regionRecallAtK: boolean | null
  regionRecallAt20: boolean | null
  retrievalRecallAtK: boolean | null
  retrievalRecallAt20: boolean | null
  retrievalMrrAtK: number | null
  factSlotCoverage: number | null
  normalizedAnswerMatch: boolean | null
  extractionAccuracy: boolean | null
  countMape: number | null
  graphResolutionAccuracy: boolean | null
  evidenceSufficiencyPass: boolean | null
  evidenceBboxPresent: boolean | null
  sourcePriorityCorrect: boolean | null
  supportedFactSlots: number | null
  totalFactSlots: number
  citationSupportPass: boolean | null
  unsupportedSentenceRate: number | null
  unsupportedSentenceCount: number | null
  totalSentenceCount: number | null
  noAccessLeakCount: number
  noAccessLeak: boolean | null
  refused: boolean
  iterationCount: number | null
  retrievalCallCount: number | null
  riskSignalCount: number | null
  llmJudgeCount: number | null
  llmJudgeNoConflictCount: number | null
  llmJudgeConflictCount: number | null
  llmJudgeUnclearCount: number | null
  llmJudgeResolved: boolean | null
  topCitationScore: number | null
  retrievedCount: number
  citationCount: number
  failureReasons: string[]
  failureDebugSignals: string[]
  failureCategories: FailureCategory[]
  asyncProviderAvailabilityCorrect: boolean | null
  asyncStatusCorrect: boolean | null
  asyncFailureReasonCodeCorrect: boolean | null
  asyncNoMockArtifacts: boolean | null
  asyncArtifactMetadataRedacted: boolean | null
}

type BenchmarkResultRow = {
  id?: string
  question: string
  conversationId?: string
  turnId?: string
  turnIndex?: number
  expectedStandaloneQuestion?: string
  expectedEvidenceTurns?: Array<string | number>
  turnDependency?: string
  expected?: string
  expectedAnswer?: string
  referenceAnswer?: string
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
  answerable?: boolean
  complexity?: string
  unanswerableType?: string
  expectedFactSlots?: ExpectedFactSlot[]
  followUp?: {
    status: number
    latencyMs: number
    selectedOptionId?: string
    selectedOptionLabel?: string
    selectedResolvedQuery?: string
    result: BenchmarkResponse
  }
  status: number
  latencyMs: number
  taskLatencyMs: number
  evaluation: RowEvaluation
  evaluatorProfile: string
  metadata?: Record<string, unknown>
  result: BenchmarkResponse & { asyncAgentRun?: AsyncAgentRunMetadata }
}

type Summary = {
  artifactContractVersion: 1
  suite: BenchmarkSuite
  baselineConfig?: BenchmarkTargetConfig
  candidateConfig: BenchmarkTargetConfig
  caseResults: BenchmarkRun["caseResults"]
  datasetPrepareRuns: BenchmarkRun["datasetPrepareRuns"]
  seedManifest: BenchmarkRun["seedManifest"]
  skipManifest: BenchmarkRun["skipManifest"]
  datasetPath: string
  outputPath: string
  reportPath: string
  summaryPath: string
  evaluatorProfile: EvaluatorProfile
  baselineComparisonNote?: string
  apiBaseUrl: string
  corpusSeed: SeededDocument[]
  generatedAt: string
  total: number
  skipped: number
  skippedRows: SkippedDatasetRow[]
  succeeded: number
  failedHttp: number
  answerableTotal: number
  unanswerableTotal: number
  metrics: {
    answerableAccuracy: number | null
    clarificationNeedPrecision: number | null
    clarificationNeedRecall: number | null
    clarificationNeedF1: number | null
    optionHitRate: number | null
    missingSlotHitRate: number | null
    corpusGroundedOptionRate: number | null
    postClarificationAccuracy: number | null
    queryRewriteAccuracy: number | null
    overClarificationRate: number | null
    clarificationLatencyOverheadMs: number | null
    postClarificationTaskLatencyMs: number | null
    abstentionRecall: number | null
    abstainAccuracy: number | null
    unsupportedAnswerRate: number | null
    answerContentAccuracy: number | null
    answerContainsRate: number | null
    groundedFileAccuracy: number | null
    groundedPageAccuracy: number | null
    citationHitRate: number | null
    expectedFileHitRate: number | null
    pageRecallAtK: number | null
    pageRecallAt20: number | null
    regionRecallAtK: number | null
    regionRecallAt20: number | null
    normalizedAnswerAccuracy: number | null
    extractionAccuracy: number | null
    countMape: number | null
    graphResolutionAccuracy: number | null
    evidenceSufficiencyPassRate: number | null
    retrievalRecallAtK: number | null
    retrievalMrrAtK: number | null
    retrievalRecallAt20: number | null
    expectedPageHitRate: number | null
    factSlotCoverage: number | null
    citationSupportPassRate: number | null
    refusalPrecision: number | null
    refusalRecall: number | null
    noAccessLeakCount: number
    noAccessLeakRate: number | null
    unsupportedSentenceRate: number | null
    avgIterations: number | null
    avgRetrievalCalls: number | null
    avgRiskSignals: number | null
    llmJudgeInvocationRate: number | null
    llmJudgeNoConflictRate: number | null
    llmJudgeConflictRate: number | null
    llmJudgeUnclearRate: number | null
    llmJudgeResolvedRate: number | null
    p50LatencyMs: number | null
    p95LatencyMs: number | null
    averageLatencyMs: number | null
    asyncProviderAvailabilityAccuracy: number | null
    asyncStatusAccuracy: number | null
    asyncFailureReasonCodeAccuracy: number | null
    asyncNoMockArtifactRate: number | null
    asyncArtifactMetadataRedactionPassRate: number | null
  }
  turnDependencyMetrics: Record<string, {
    total: number
    answerableAccuracy: number | null
    answerContentAccuracy: number | null
    groundedFileAccuracy: number | null
    groundedPageAccuracy: number | null
    retrievalRecallAtK: number | null
    expectedPageHitRate: number | null
    citationSupportPassRate: number | null
    refusalPrecision: number | null
    refusalRecall: number | null
    unsupportedSentenceRate: number | null
  }>
  failures: Array<{
    id?: string
    question: string
    reasons: string[]
    expectedContains?: string | string[]
    expectedAnswer?: string
    expected?: string
    answerPreview: string
    debugSignals: string[]
    categories: FailureCategory[]
  }>
  diagnosticFailureBreakdown: Record<DiagnosticFailureCategory, number>
  qualityReview: QualityReview
}

type MetricReportRow = {
  metric: BenchmarkReportMetricName
  value: string
  status: "evaluated" | "not_applicable"
  basis: string
  note: string
}

type CoverageReportRow = {
  item: string
  count: number
  note: string
}

type FailureCategory =
  | "search_failure"
  | "extraction_failure"
  | "chunk_failure"
  | "generation_failure"
  | "refusal_failure"

type DiagnosticFailureCategory = "retrieval" | "ocr" | "grounding" | "reasoning" | "abstention"

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const apiAuthToken = process.env.API_AUTH_TOKEN
const api = createBenchmarkApiClient({ apiBaseUrl, authToken: apiAuthToken })
const defaultModelId = process.env.MODEL_ID ?? "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = process.env.EMBEDDING_MODEL_ID?.trim() || undefined
const benchmarkSuiteId = process.env.BENCHMARK_SUITE_ID ?? "standard-agent-v1"
const benchmarkCorpusSuiteId = process.env.BENCHMARK_CORPUS_SUITE_ID ?? benchmarkSuiteId
const benchmarkRunner = benchmarkRunnerFromEnv()
const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const datasetPath = resolveExistingPath(process.env.DATASET ?? "dataset.sample.jsonl", [process.cwd(), benchmarkDir, repoRoot])
const outputPath = resolveOutputPath(process.env.OUTPUT ?? ".local-data/benchmark-results.jsonl")
const reportPath = resolveOutputPath(process.env.REPORT ?? outputPath.replace(/\.jsonl$/i, ".report.md"))
const summaryPath = resolveOutputPath(process.env.SUMMARY ?? outputPath.replace(/\.jsonl$/i, ".summary.json"))
const baselineSummaryPath = process.env.BASELINE_SUMMARY
  ? resolveExistingPath(process.env.BASELINE_SUMMARY, [process.cwd(), benchmarkDir, repoRoot])
  : undefined
const baselineSummary = baselineSummaryPath
  ? (JSON.parse(await readFile(baselineSummaryPath, "utf-8")) as { metrics?: Summary["metrics"]; evaluatorProfile?: Summary["evaluatorProfile"] })
  : undefined
const suiteEvaluatorProfile = resolveEvaluatorProfile(process.env.EVALUATOR_PROFILE)
const baselineComparisonNote = baselineSummary
  ? assertComparableProfiles(suiteEvaluatorProfile, baselineSummary, process.env.ALLOW_EVALUATOR_PROFILE_MISMATCH === "1")
  : undefined
const benchmarkCorpusDir = benchmarkCorpusDirFromEnv(process.env)
const resolvedBenchmarkCorpusDir = benchmarkCorpusDir
  ? resolveExistingPath(benchmarkCorpusDir, [process.cwd(), benchmarkDir, repoRoot])
  : undefined
const suiteMetadata = createBenchmarkSuiteMetadata({
  suiteId: benchmarkSuiteId,
  useCase: benchmarkUseCaseFromEnv(),
  runner: benchmarkRunner,
  corpus: {
    suiteId: benchmarkCorpusSuiteId,
    dir: process.env.BENCHMARK_CORPUS_DIR,
    source: process.env.BENCHMARK_CORPUS_DIR ? "local" : "none"
  },
  datasetSource: datasetSourceFromEnv(process.env),
  evaluatorProfile: profileKey(suiteEvaluatorProfile)
})
const candidateConfig = targetConfigFromEnv({
  suite: suiteMetadata,
  env: process.env,
  apiBaseUrl,
  evaluatorProfile: profileKey(suiteEvaluatorProfile),
  defaultModelId,
  defaultEmbeddingModelId
})
const baselineConfig = baselineSummaryPath ? { ...candidateConfig, targetName: "baseline" } : undefined

const corpusSeed = await seedBenchmarkCorpus({
  apiBaseUrl,
  authToken: apiAuthToken,
  corpusDir: resolvedBenchmarkCorpusDir,
  suiteId: benchmarkCorpusSuiteId,
  skipMemory: benchmarkCorpusSkipMemoryFromEnv(process.env),
  embeddingModelId: defaultEmbeddingModelId,
  ingestRunPollIntervalMs: benchmarkIngestRunPollIntervalMsFromEnv(process.env),
  ingestRunTimeoutMs: benchmarkIngestRunTimeoutMsFromEnv(process.env),
  log: (message) => console.log(message)
})

await mkdir(path.dirname(outputPath), { recursive: true })
await mkdir(path.dirname(reportPath), { recursive: true })
await mkdir(path.dirname(summaryPath), { recursive: true })
const out = createWriteStream(outputPath, { encoding: "utf-8" })
const rl = readline.createInterface({ input: createReadStream(datasetPath, { encoding: "utf-8" }), crlfDelay: Infinity })

let count = 0
const results: BenchmarkResultRow[] = []
const skippedRows: SkippedDatasetRow[] = []
const skippedCorpusFiles = skippedCorpusFileNameSet(corpusSeed)
const conversationMemory = new Map<string, ConversationTurn[]>()
const runnableRows: DatasetRow[] = []
for await (const line of rl) {
  if (!line.trim()) continue
  const row = JSON.parse(line) as DatasetRow
  const skippedFiles = skippedExpectedFileNames(row, skippedCorpusFiles)
  if (skippedFiles.length > 0) {
    skippedRows.push(createSkippedDatasetRow(row, skippedFiles))
    console.log(`Benchmark row skipped: ${row.id ?? row.question} (required corpus skipped: ${skippedFiles.join(", ")})`)
    continue
  }
  runnableRows.push(row)
}

for (const row of orderRowsForConversationExecution(runnableRows)) {
  const rowEvaluatorProfile = resolveEvaluatorProfile(row.evaluatorProfile ?? profileKey(suiteEvaluatorProfile))
  assertSuiteEvaluatorProfile(rowEvaluatorProfile, suiteEvaluatorProfile, row.id ?? row.question)
  const firstStartedAt = Date.now()
  const conversation = buildConversationInput(row)
  const queryResult: { status: number; body: BenchmarkResponse & { asyncAgentRun?: AsyncAgentRunMetadata } } = benchmarkRunner === "async_agent"
    ? await runAsyncAgentBenchmarkRow(row)
    : await runQuery(row, conversation)
  const { status, body } = queryResult
  const initialLatencyMs = Date.now() - firstStartedAt
  const followUp = benchmarkRunner === "async_agent" ? undefined : await runFollowUp(row, body)
  const result: BenchmarkResultRow = {
    id: row.id,
    question: row.question,
    conversationId: row.conversationId ?? row.conversation?.conversationId,
    turnId: row.turnId ?? row.conversation?.turnId,
    turnIndex: row.turnIndex ?? row.conversation?.turnIndex,
    expectedStandaloneQuestion: row.expectedStandaloneQuestion,
    expectedEvidenceTurns: row.expectedEvidenceTurns,
    turnDependency: row.turnDependency ?? row.conversation?.turnDependency,
    expected: row.expected,
    expectedAnswer: row.expectedAnswer,
    referenceAnswer: row.referenceAnswer,
    expectedContains: row.expectedContains,
    expectedRegex: row.expectedRegex,
    answerable: row.answerable,
    complexity: row.complexity,
    unanswerableType: row.unanswerableType,
    expectedFactSlots: row.expectedFactSlots,
    followUp,
    status,
    latencyMs: initialLatencyMs,
    taskLatencyMs: initialLatencyMs + (followUp?.latencyMs ?? 0),
    evaluation: benchmarkRunner === "async_agent"
      ? evaluateAsyncAgentRow(row, body.asyncAgentRun, status, body, rowEvaluatorProfile)
      : evaluateRow(row, body, status, followUp, rowEvaluatorProfile),
    evaluatorProfile: profileKey(rowEvaluatorProfile),
    metadata: row.metadata,
    result: body
  }
  out.write(`${JSON.stringify(result)}\n`)
  results.push(result)
  if (benchmarkRunner !== "async_agent") rememberConversationTurn(row, body)
  count += 1
}

await closeStream(out)
const summary = summarize(results, corpusSeed, skippedRows)
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8")
await writeFile(reportPath, renderMarkdownReport(summary, results), "utf-8")

console.log(`Wrote ${count} benchmark rows to ${outputPath}`)
if (skippedRows.length > 0) console.log(`Skipped ${skippedRows.length} benchmark rows because required corpus was skipped`)
console.log(`Wrote benchmark summary to ${summaryPath}`)
console.log(`Wrote benchmark report to ${reportPath}`)

function orderRowsForConversationExecution(rows: DatasetRow[]): DatasetRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const conversationA = a.row.conversationId ?? a.row.conversation?.conversationId
      const conversationB = b.row.conversationId ?? b.row.conversation?.conversationId
      if (!conversationA && !conversationB) return a.index - b.index
      if (!conversationA) return a.index - b.index
      if (!conversationB) return a.index - b.index
      if (conversationA !== conversationB) return a.index - b.index
      return (a.row.turnIndex ?? a.row.conversation?.turnIndex ?? a.index) - (b.row.turnIndex ?? b.row.conversation?.turnIndex ?? b.index)
    })
    .map((item) => item.row)
}

function buildConversationInput(row: DatasetRow): ConversationInput | undefined {
  const conversationId = row.conversationId ?? row.conversation?.conversationId
  if (!conversationId) return row.conversation
  const rememberedTurns = conversationMemory.get(conversationId) ?? []
  return {
    conversationId,
    turnId: row.turnId ?? row.conversation?.turnId ?? (row.turnIndex === undefined ? row.id : String(row.turnIndex)),
    turnIndex: row.turnIndex ?? row.conversation?.turnIndex,
    turns: [
      ...(row.conversation?.turns ?? []),
      ...(row.history ?? []),
      ...rememberedTurns
    ],
    turnDependency: row.turnDependency ?? row.conversation?.turnDependency,
    state: row.conversation?.state
  }
}

function rememberConversationTurn(row: DatasetRow, body: BenchmarkResponse): void {
  const conversationId = row.conversationId ?? row.conversation?.conversationId
  if (!conversationId) return
  const turns = conversationMemory.get(conversationId) ?? []
  turns.push({ role: "user", text: row.question })
  turns.push({ role: "assistant", text: body.answer ?? "", citations: body.citations ?? [] })
  conversationMemory.set(conversationId, turns)
}

async function runQuery(row: DatasetRow, conversation?: ConversationInput): Promise<{ status: number; body: BenchmarkResponse }> {
  return runQueryRequest({
    id: row.id,
    question: row.question,
    conversation,
    modelId: row.modelId ?? defaultModelId,
    embeddingModelId: row.embeddingModelId ?? defaultEmbeddingModelId,
    clueModelId: row.clueModelId,
    topK: row.topK,
    memoryTopK: row.memoryTopK,
    minScore: row.minScore,
    strictGrounded: row.strictGrounded,
    useMemory: row.useMemory
  })
}

async function runAsyncAgentBenchmarkRow(row: DatasetRow): Promise<{
  status: number
  body: BenchmarkResponse & { asyncAgentRun?: AsyncAgentRunMetadata }
}> {
  const inlineRun = row.asyncAgentRun ?? asyncAgentRunFromMetadata(row.metadata)
  if (inlineRun) {
    return {
      status: 200,
      body: {
        responseType: "refusal",
        isAnswerable: false,
        answer: inlineRun.failureReason ?? inlineRun.status ?? "async agent run metadata evaluated",
        asyncAgentRun: inlineRun
      }
    }
  }

  if (!row.agentRunId) {
    return {
      status: 0,
      body: {
        responseType: "refusal",
        isAnswerable: false,
        error: "async_agent_run_not_configured"
      }
    }
  }

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/agents/runs/${encodeURIComponent(row.agentRunId)}`, {
      headers: {
        ...(apiAuthToken ? { Authorization: `Bearer ${apiAuthToken}` } : {})
      }
    })
    const body = await response.json().catch(() => ({})) as unknown
    const asyncAgentRun = isAsyncAgentRunMetadata(body) ? body : undefined
    return {
      status: response.status,
      body: {
        responseType: "refusal",
        isAnswerable: false,
        answer: asyncAgentRun?.failureReason ?? asyncAgentRun?.status ?? "",
        asyncAgentRun,
        ...(asyncAgentRun ? {} : { error: JSON.stringify(body) })
      }
    }
  } catch (error) {
    return {
      status: 0,
      body: {
        responseType: "refusal",
        isAnswerable: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

async function runFollowUp(
  row: DatasetRow,
  body: BenchmarkResponse
): Promise<BenchmarkResultRow["followUp"] | undefined> {
  if (!row.followUp || inferActualResponseType(body) !== "clarification") return undefined
  const option = selectFollowUpOption(body, row.followUp)
  const question = row.followUp.selectedResolvedQuery ?? option?.resolvedQuery
  if (!question?.trim()) return undefined

  const startedAt = Date.now()
  const { status, body: followUpBody } = await runQueryRequest({
    id: row.id ? `${row.id}:follow-up` : undefined,
    question,
    modelId: row.modelId ?? defaultModelId,
    embeddingModelId: row.embeddingModelId ?? defaultEmbeddingModelId,
    clueModelId: row.clueModelId,
    topK: row.topK,
    memoryTopK: row.memoryTopK,
    minScore: row.minScore,
    strictGrounded: row.strictGrounded,
    useMemory: row.useMemory,
    clarificationContext: {
      originalQuestion: row.question,
      selectedOptionId: option?.id ?? row.followUp.selectedOptionId,
      selectedValue: option?.label ?? row.followUp.selectedOptionLabel
    }
  })

  return {
    status,
    latencyMs: Date.now() - startedAt,
    selectedOptionId: option?.id ?? row.followUp.selectedOptionId,
    selectedOptionLabel: option?.label ?? row.followUp.selectedOptionLabel,
    selectedResolvedQuery: question,
    result: followUpBody
  }
}

async function runQueryRequest(input: {
  id?: string
  question: string
  modelId?: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  strictGrounded?: boolean
  useMemory?: boolean
  conversation?: ConversationInput
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
}): Promise<{ status: number; body: BenchmarkResponse }> {
  try {
    const body = await api.benchmark.query({
      id: input.id,
      question: input.question,
      clarificationContext: input.clarificationContext,
      conversation: input.conversation,
      modelId: input.modelId ?? defaultModelId,
      embeddingModelId: input.embeddingModelId,
      clueModelId: input.clueModelId,
      topK: input.topK,
      memoryTopK: input.memoryTopK,
      minScore: input.minScore,
      strictGrounded: input.strictGrounded,
      useMemory: input.useMemory,
      benchmarkSuiteId: benchmarkCorpusSuiteId,
      includeDebug: true
    })
    return { status: 200, body }
  } catch (error) {
    return {
      status: 0,
      body: {
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

function selectFollowUpOption(
  body: BenchmarkResponse,
  followUp: FollowUpExpectation
): ClarificationResponseOption | undefined {
  const options = body.clarification?.options ?? []
  if (followUp.selectedOptionId) return options.find((option) => option.id === followUp.selectedOptionId)
  if (followUp.selectedOptionLabel) {
    const expected = normalize(followUp.selectedOptionLabel)
    return options.find((option) => normalize(option.label ?? "").includes(expected))
  }
  return options[0]
}

function evaluateRow(
  row: DatasetRow,
  body: BenchmarkResponse,
  status: number,
  followUp: BenchmarkResultRow["followUp"],
  evaluatorProfile: EvaluatorProfile
): RowEvaluation {
  const expectedAnswerable = inferExpectedAnswerable(row, evaluatorProfile)
  const actualAnswerable = Boolean(body.isAnswerable)
  const expectedResponseType = inferExpectedResponseType(row, expectedAnswerable)
  const actualResponseType = inferActualResponseType(body)
  const answer = body.answer ?? ""
  const citations = body.citations ?? []
  const retrieved = body.retrieved ?? []
  const finalEvidence = body.finalEvidence ?? citations
  const expectedContains = toArray(row.expectedContains ?? row.expectedAnswer ?? (expectedAnswerable ? row.expected : undefined))
  const expectedRegex = toArray(row.expectedRegex)
  const expectedFiles = toArray(row.expectedFiles ?? row.expectedFileNames)
  const expectedDocumentIds = toArray(row.expectedDocumentIds)
  const expectedPages = toArray(row.expectedPages).map(String)
  const expectedRegionIds = toArray(row.expectedRegionIds)
  const forbiddenFiles = toArray(row.forbiddenFiles)
  const forbiddenDocumentIds = toArray(row.forbiddenDocumentIds)
  const failureReasons: string[] = []
  const refused = !actualAnswerable || isNoAnswerText(answer, evaluatorProfile)
  const answerabilityCorrect = actualAnswerable === expectedAnswerable
  if (!answerabilityCorrect) failureReasons.push(expectedAnswerable ? "expected_answer_but_refused" : "expected_refusal_but_answered")
  const responseTypeCorrect = actualResponseType === expectedResponseType
  if (!responseTypeCorrect) failureReasons.push(`expected_${expectedResponseType}_but_${actualResponseType}`)

  const expectedClarification = row.expectedClarification ?? expectedResponseType === "clarification"
  const actualClarification = actualResponseType === "clarification" || body.needsClarification === true || body.clarification?.needsClarification === true
  const clarificationNeededCorrect =
    row.expectedClarification === undefined && row.expectedResponseType === undefined ? null : actualClarification === expectedClarification
  if (clarificationNeededCorrect === false) failureReasons.push(expectedClarification ? "expected_clarification" : "over_clarification")

  const optionLabels = body.clarification?.options?.map((option) => option.label ?? "").filter(Boolean) ?? []
  const optionHit =
    row.expectedOptionsAnyOf && row.expectedOptionsAnyOf.length > 0
      ? row.expectedOptionsAnyOf.some((expected) => optionLabels.some((label) => normalize(label).includes(normalize(expected))))
      : null
  if (optionHit === false) failureReasons.push("clarification_option_miss")

  const actualMissingSlots = body.clarification?.missingSlots ?? []
  const missingSlotHit =
    row.expectedMissingSlots && row.expectedMissingSlots.length > 0
      ? row.expectedMissingSlots.every((expected) =>
          actualMissingSlots.some((actual) => normalize(actual).includes(normalize(expected)))
        )
      : null
  if (missingSlotHit === false) failureReasons.push("clarification_missing_slot_miss")

  const corpusGroundedOptions =
    actualClarification && (body.clarification?.options?.length ?? 0) > 0
      ? body.clarification?.options?.every((option) => (option.grounding?.length ?? 0) > 0 && ["memory", "evidence", "aspect", "history"].includes(option.source ?? "")) ?? false
      : null
  if (corpusGroundedOptions === false) failureReasons.push("clarification_option_not_grounded")

  const postClarificationAnswerCorrect = evaluateFollowUp(row.followUp, followUp, failureReasons, evaluatorProfile)
  const actualStandaloneQuestion = extractStandaloneQuestion(body)
  const queryRewriteHit = evaluateQueryRewrite(row.expectedStandaloneQuestion, actualStandaloneQuestion)
  if (queryRewriteHit === false) failureReasons.push("query_rewrite_miss")

  const answerContainsExpected =
    expectedAnswerable && expectedContains.length > 0
      ? expectedContains.every((expected) => normalize(answer).includes(normalize(expected)))
      : null
  if (answerContainsExpected === false) failureReasons.push("answer_missing_expected_text")

  const regexMatched =
    expectedAnswerable && expectedRegex.length > 0
      ? expectedRegex.every((pattern) => safeRegexTest(pattern, answer))
      : null
  if (regexMatched === false) failureReasons.push("answer_regex_mismatch")

  const citationHit = expectedAnswerable ? citations.length > 0 : null
  if (citationHit === false) failureReasons.push("missing_citation")

  const expectedFileHit =
    expectedFiles.length > 0 ? hasExpectedFileHit([...citations, ...finalEvidence], expectedFiles) : null
  if (expectedFileHit === false) failureReasons.push("expected_file_not_hit")

  const expectedDocumentHit =
    expectedDocumentIds.length > 0 ? hasExpectedDocumentHit([...citations, ...finalEvidence], expectedDocumentIds) : null
  if (expectedDocumentHit === false) failureReasons.push("expected_document_not_hit")

  const expectedPageHit =
    expectedPages.length > 0 && hasObservablePageMetadata([...citations, ...finalEvidence, ...retrieved])
      ? hasExpectedPageHit([...citations, ...finalEvidence], expectedPages)
      : null
  if (expectedPageHit === false) failureReasons.push("expected_page_not_hit")
  const pageRecallAtK =
    expectedPages.length > 0 ? hasExpectedPageRecallAtK(retrieved, expectedPages, evaluatorProfile.retrieval.recallK) : null
  if (pageRecallAtK === false) failureReasons.push(`page_recall_at_${evaluatorProfile.retrieval.recallK}_miss`)
  const pageRecallAt20 =
    expectedPages.length > 0 ? hasExpectedPageRecallAtK(retrieved, expectedPages, 20) : null

  const regionRecallAtK =
    expectedRegionIds.length > 0 ? hasExpectedRegionRecallAtK(retrieved, expectedRegionIds, evaluatorProfile.retrieval.recallK) : null
  if (regionRecallAtK === false) failureReasons.push(`region_recall_at_${evaluatorProfile.retrieval.recallK}_miss`)
  const regionRecallAt20 =
    expectedRegionIds.length > 0 ? hasExpectedRegionRecallAtK(retrieved, expectedRegionIds, 20) : null

  const retrievalRecallAtK =
    expectedFiles.length > 0 || expectedDocumentIds.length > 0
      ? hasRetrievalRecallAtK(retrieved, expectedFiles, expectedDocumentIds, evaluatorProfile.retrieval.recallK)
      : null
  if (retrievalRecallAtK === false) failureReasons.push(`retrieval_recall_at_${evaluatorProfile.retrieval.recallK}_miss`)
  const retrievalRecallAt20 =
    expectedFiles.length > 0 || expectedDocumentIds.length > 0
      ? hasRetrievalRecallAtK(retrieved, expectedFiles, expectedDocumentIds, 20)
      : null
  const retrievalMrrAtK =
    expectedFiles.length > 0 || expectedDocumentIds.length > 0
      ? reciprocalRankAtK(retrieved, expectedFiles, expectedDocumentIds, evaluatorProfile.retrieval.recallK)
      : null

  const factSlotResult = evaluateFactSlots(row.expectedFactSlots ?? [], answer, [...citations, ...finalEvidence], expectedAnswerable)
  if (factSlotResult.coverage !== null && factSlotResult.coverage < 1) failureReasons.push("fact_slot_not_covered")
  const expectedNormalizedValues = toNormalizedExpectedValues(row.expectedNormalizedValues ?? [])
  const normalizedAnswerMatch = expectedAnswerable && expectedNormalizedValues.length > 0
    ? normalizedDrawingValuesMatch(expectedNormalizedValues, answer, [...citations, ...finalEvidence].map((citation) => citation.text ?? "").join("\n"))
    : null
  if (normalizedAnswerMatch === false) failureReasons.push("normalized_answer_mismatch")
  const extractionAccuracy = expectedAnswerable && (row.expectedExtractionValues?.length ?? 0) > 0
    ? diagnosticExtractionsMatch(row.expectedExtractionValues ?? [], body)
    : null
  if (extractionAccuracy === false) failureReasons.push("extraction_accuracy_mismatch")
  const countMape = expectedAnswerable && (row.expectedCounts?.length ?? 0) > 0 ? diagnosticCountMape(row.expectedCounts ?? [], body) : null
  if (countMape !== null && countMape > 0) failureReasons.push("count_mape_nonzero")
  const graphResolutionAccuracy = expectedAnswerable && (row.expectedGraphResolutions?.length ?? 0) > 0
    ? diagnosticGraphResolutionsMatch(row.expectedGraphResolutions ?? [], body)
    : null
  if (graphResolutionAccuracy === false) failureReasons.push("graph_resolution_mismatch")
  const evidenceSufficiency = evaluateEvidenceSufficiency(
    row.evidenceSufficiency,
    [...citations, ...finalEvidence],
    normalizedAnswerMatch,
    expectedAnswerable
  )
  for (const reason of evidenceSufficiency.failureReasons) failureReasons.push(reason)

  const supportResult = evaluateUnsupportedSentences(body)
  if (supportResult.rate !== null && supportResult.rate > 0) failureReasons.push("unsupported_sentence_detected")
  const citationSupportPass = supportResult.rate === null ? null : supportResult.rate === 0
  const retrievalJudgeResult = evaluateRetrievalJudge(body)
  const noAccessLeakCount = countForbiddenEvidence([...citations, ...finalEvidence, ...retrieved], forbiddenFiles, forbiddenDocumentIds)
  const noAccessLeak = forbiddenFiles.length > 0 || forbiddenDocumentIds.length > 0 ? noAccessLeakCount === 0 : null
  if (noAccessLeak === false) failureReasons.push("no_access_leak")

  if (status < 200 || status >= 300) failureReasons.push(`http_${status}`)
  const answerContentCorrect =
    expectedAnswerable &&
    answerabilityCorrect &&
    responseTypeCorrect &&
    answerContainsExpected !== false &&
    regexMatched !== false &&
    normalizedAnswerMatch !== false &&
    status >= 200 &&
    status < 300
  const groundedFileCorrect =
    expectedAnswerable && (citationHit !== null || expectedFileHit !== null || expectedDocumentHit !== null)
      ? answerContentCorrect &&
        citationHit !== false &&
        expectedFileHit !== false &&
        expectedDocumentHit !== false
      : null
  const groundedPageCorrect =
    expectedAnswerable && expectedPageHit !== null
      ? groundedFileCorrect !== false && groundedFileCorrect !== null && expectedPageHit === true
      : null
  const answerCorrect =
    expectedAnswerable &&
    answerabilityCorrect &&
    responseTypeCorrect &&
    answerContainsExpected !== false &&
    regexMatched !== false &&
    citationHit !== false &&
    expectedFileHit !== false &&
    expectedDocumentHit !== false &&
    expectedPageHit !== false &&
    regionRecallAtK !== false &&
    normalizedAnswerMatch !== false &&
    extractionAccuracy !== false &&
    graphResolutionAccuracy !== false &&
    evidenceSufficiency.pass !== false &&
    (countMape === null || countMape === 0) &&
    status >= 200 &&
    status < 300

  const abstentionCorrect = expectedAnswerable ? null : !actualAnswerable || isNoAnswerText(answer, evaluatorProfile)
  if (abstentionCorrect === false) failureReasons.push("unsupported_answer")
  const failureCategories = classifyFailureCategories(failureReasons)
  const failureDebugSignals = summarizeFailureDebugSignals({
    expectedAnswerable,
    actualResponseType,
    answerContainsExpected,
    expectedFileHit: expectedFileHit ?? expectedDocumentHit,
    retrievalRecallAtK,
    queryRewriteHit,
    body
  })

  return {
    expectedAnswerable,
    actualAnswerable,
    answerabilityCorrect,
    expectedResponseType,
    actualResponseType,
    responseTypeCorrect,
    clarificationNeededCorrect,
    optionHit,
    missingSlotHit,
    corpusGroundedOptions,
    postClarificationAnswerCorrect,
    queryRewriteHit,
    answerContainsExpected,
    regexMatched,
    answerContentCorrect,
    groundedFileCorrect,
    groundedPageCorrect,
    answerCorrect,
    abstentionCorrect,
    unsupportedAnswer: !expectedAnswerable && actualAnswerable && !isNoAnswerText(answer, evaluatorProfile),
    citationHit,
    expectedFileHit: expectedFileHit ?? expectedDocumentHit,
    expectedPageHit,
    pageRecallAtK,
    pageRecallAt20,
    regionRecallAtK,
    regionRecallAt20,
    retrievalRecallAtK,
    retrievalRecallAt20,
    retrievalMrrAtK,
    factSlotCoverage: factSlotResult.coverage,
    normalizedAnswerMatch,
    extractionAccuracy,
    countMape,
    graphResolutionAccuracy,
    evidenceSufficiencyPass: evidenceSufficiency.pass,
    evidenceBboxPresent: evidenceSufficiency.bboxPresent,
    sourcePriorityCorrect: evidenceSufficiency.sourcePriorityCorrect,
    supportedFactSlots: factSlotResult.supported,
    totalFactSlots: factSlotResult.total,
    citationSupportPass,
    unsupportedSentenceRate: supportResult.rate,
    unsupportedSentenceCount: supportResult.unsupported,
    totalSentenceCount: supportResult.total,
    noAccessLeakCount,
    noAccessLeak,
    refused,
    iterationCount: countDebugSteps(body, "evaluate_search_progress"),
    retrievalCallCount: countDebugSteps(body, "execute_search_action"),
    riskSignalCount: retrievalJudgeResult.riskSignalCount,
    llmJudgeCount: retrievalJudgeResult.llmJudgeCount,
    llmJudgeNoConflictCount: retrievalJudgeResult.noConflictCount,
    llmJudgeConflictCount: retrievalJudgeResult.conflictCount,
    llmJudgeUnclearCount: retrievalJudgeResult.unclearCount,
    llmJudgeResolved: retrievalJudgeResult.resolved,
    topCitationScore: citations.length > 0 ? Math.max(...citations.map((citation) => citation.score ?? 0)) : null,
    retrievedCount: retrieved.length,
    citationCount: citations.length,
    failureReasons,
    failureDebugSignals,
    failureCategories,
    asyncProviderAvailabilityCorrect: null,
    asyncStatusCorrect: null,
    asyncFailureReasonCodeCorrect: null,
    asyncNoMockArtifacts: null,
    asyncArtifactMetadataRedacted: null
  }
}

function evaluateAsyncAgentRow(
  row: DatasetRow,
  run: AsyncAgentRunMetadata | undefined,
  status: number,
  body: BenchmarkResponse,
  evaluatorProfile: EvaluatorProfile
): RowEvaluation {
  const base = evaluateRow(
    {
      ...row,
      answerable: false,
      expectedResponseType: "refusal",
      expectedContains: undefined,
      expectedRegex: undefined,
      expectedFiles: undefined,
      expectedFileNames: undefined,
      expectedDocumentIds: undefined,
      expectedPages: undefined,
      expectedRegionIds: undefined
    },
    {
      ...body,
      responseType: "refusal",
      isAnswerable: false,
      answer: body.answer ?? run?.failureReason ?? run?.status ?? ""
    },
    status,
    undefined,
    evaluatorProfile
  )
  const failureReasons = [...base.failureReasons]
  const expectedProviderAvailability = row.expectedProviderAvailability
  const expectedStatus = row.expectedAsyncAgentStatus
  const expectedFailureReasonCode = row.expectedFailureReasonCode

  const asyncProviderAvailabilityCorrect = expectedProviderAvailability
    ? run?.providerAvailability === expectedProviderAvailability
    : null
  if (asyncProviderAvailabilityCorrect === false) failureReasons.push("async_provider_availability_mismatch")

  const asyncStatusCorrect = expectedStatus ? run?.status === expectedStatus : null
  if (asyncStatusCorrect === false) failureReasons.push("async_status_mismatch")

  const asyncFailureReasonCodeCorrect = expectedFailureReasonCode
    ? run?.failureReasonCode === expectedFailureReasonCode
    : null
  if (asyncFailureReasonCodeCorrect === false) failureReasons.push("async_failure_reason_code_mismatch")

  const artifacts = run?.artifacts ?? []
  const artifactIds = run?.artifactIds ?? []
  const unavailable = run?.providerAvailability === "not_configured" || run?.providerAvailability === "provider_unavailable" || run?.providerAvailability === "disabled"
  const asyncNoMockArtifacts = row.expectedNoArtifacts === true || unavailable
    ? artifacts.length === 0 && artifactIds.length === 0
    : null
  if (asyncNoMockArtifacts === false) failureReasons.push("async_mock_artifact_present")

  const asyncArtifactMetadataRedacted = row.expectedArtifactMetadataRedacted === true
    ? asyncAgentArtifactMetadataRedacted(run, row.artifactMetadataForbiddenPatterns ?? [])
    : null
  if (asyncArtifactMetadataRedacted === false) failureReasons.push("async_artifact_metadata_not_redacted")

  return {
    ...base,
    answerCorrect: failureReasons.length === 0,
    abstentionCorrect: failureReasons.length === 0,
    failureReasons,
    failureCategories: classifyFailureCategories(failureReasons),
    failureDebugSignals: run ? base.failureDebugSignals : [...base.failureDebugSignals, "async_agent_run_metadata_missing"],
    asyncProviderAvailabilityCorrect,
    asyncStatusCorrect,
    asyncFailureReasonCodeCorrect,
    asyncNoMockArtifacts,
    asyncArtifactMetadataRedacted
  }
}

function evaluateFollowUp(
  expected: FollowUpExpectation | undefined,
  followUp: BenchmarkResultRow["followUp"],
  failureReasons: string[],
  evaluatorProfile: EvaluatorProfile
): boolean | null {
  if (!expected) return null
  if (!followUp) {
    failureReasons.push("post_clarification_follow_up_not_run")
    return false
  }

  const body = followUp.result
  const expectedAnswerable = expected.answerable ?? expected.expectedResponseType !== "refusal"
  const actualResponseType = inferActualResponseType(body)
  const expectedResponseType = expected.expectedResponseType ?? (expectedAnswerable ? "answer" : "refusal")
  const responseTypeCorrect = actualResponseType === expectedResponseType
  const answer = body.answer ?? ""
  const expectedContains = toArray(expected.expectedContains)
  const expectedRegex = toArray(expected.expectedRegex)
  const expectedFiles = toArray(expected.expectedFiles ?? expected.expectedFileNames)
  const expectedDocumentIds = toArray(expected.expectedDocumentIds)
  const citations = body.citations ?? []
  const finalEvidence = body.finalEvidence ?? citations
  const containsCorrect =
    expectedAnswerable && expectedContains.length > 0
      ? expectedContains.every((item) => normalize(answer).includes(normalize(item)))
      : true
  const regexCorrect =
    expectedAnswerable && expectedRegex.length > 0
      ? expectedRegex.every((pattern) => safeRegexTest(pattern, answer))
      : true
  const fileHit =
    expectedFiles.length > 0 || expectedDocumentIds.length > 0
      ? hasRetrievalRecallAtK([...citations, ...finalEvidence], expectedFiles, expectedDocumentIds, evaluatorProfile.retrieval.recallK)
      : true
  const httpOk = followUp.status >= 200 && followUp.status < 300
  const passed = httpOk && responseTypeCorrect && containsCorrect && regexCorrect && fileHit

  if (!httpOk) failureReasons.push(`post_clarification_http_${followUp.status}`)
  if (!responseTypeCorrect) failureReasons.push(`post_clarification_expected_${expectedResponseType}_but_${actualResponseType}`)
  if (!containsCorrect) failureReasons.push("post_clarification_answer_missing_expected_text")
  if (!regexCorrect) failureReasons.push("post_clarification_answer_regex_mismatch")
  if (!fileHit) failureReasons.push("post_clarification_expected_file_not_hit")

  return passed
}

function extractStandaloneQuestion(body: BenchmarkResponse): string | undefined {
  for (const step of body.debug?.steps ?? []) {
    if (step.label !== "decontextualize_query") continue
    const output = step.output?.decontextualizedQuery
    if (typeof output === "object" && output !== null && "standaloneQuestion" in output) {
      const value = (output as { standaloneQuestion?: unknown }).standaloneQuestion
      return typeof value === "string" ? value : undefined
    }
  }
  return undefined
}

function asyncAgentRunFromMetadata(metadata: Record<string, unknown> | undefined): AsyncAgentRunMetadata | undefined {
  const value = metadata?.asyncAgentRun
  return isAsyncAgentRunMetadata(value) ? value : undefined
}

function isAsyncAgentRunMetadata(value: unknown): value is AsyncAgentRunMetadata {
  if (!value || typeof value !== "object") return false
  const candidate = value as AsyncAgentRunMetadata
  return Boolean(candidate.agentRunId || candidate.runId || candidate.status || candidate.providerAvailability)
}

function asyncAgentArtifactMetadataRedacted(
  run: AsyncAgentRunMetadata | undefined,
  additionalForbiddenPatterns: string[]
): boolean {
  if (!run) return false
  const metadataText = [
    run.failureReason,
    ...(run.artifacts ?? []).flatMap((artifact) => [
      artifact.artifactId,
      artifact.fileName,
      artifact.mimeType,
      artifact.storageRef,
      artifact.writebackStatus
    ])
  ].filter((value): value is string => typeof value === "string").join("\n")
  if (!metadataText) return true
  return asyncAgentForbiddenMetadataPatterns(additionalForbiddenPatterns).every((pattern) => !safeRegexTest(pattern, metadataText))
}

function asyncAgentForbiddenMetadataPatterns(additionalPatterns: string[]): string[] {
  return [
    "Bearer\\s+[A-Za-z0-9._~+/=-]{8,}",
    "(secret|token|api[_-]?key)(['\\\":=\\s]+)[A-Za-z0-9._~+/=-]{8,}",
    "X-Amz-Signature=[A-Za-z0-9]+",
    "https?://[^\\s]+[?&](X-Amz-Signature|Signature|token|api_key)=",
    ...additionalPatterns
  ]
}

function evaluateQueryRewrite(expected: string | undefined, actual: string | undefined): boolean | null {
  if (!expected) return null
  if (!actual) return false
  return normalize(actual).includes(normalize(expected)) || normalize(expected).includes(normalize(actual))
}

function summarizeFailureDebugSignals(input: {
  expectedAnswerable: boolean
  actualResponseType: "answer" | "refusal" | "clarification"
  answerContainsExpected: boolean | null
  expectedFileHit: boolean | null
  retrievalRecallAtK: boolean | null
  queryRewriteHit: boolean | null
  body: BenchmarkResponse
}): string[] {
  const signals: string[] = []
  if (input.expectedAnswerable && input.actualResponseType === "refusal") signals.push("response_type:refusal")
  if (input.answerContainsExpected === false) signals.push("expected_contains_miss")
  if (input.expectedFileHit === false) signals.push("citation_file_miss")
  if (input.retrievalRecallAtK === false) signals.push("retrieval_file_miss")
  if (input.queryRewriteHit === false) signals.push("decontextualization_bad_query")

  for (const step of input.body.debug?.steps ?? []) {
    const outputText = JSON.stringify(step.output ?? {})
    const detail = step.detail ?? ""
    const combined = `${step.label}\n${step.status ?? ""}\n${step.summary ?? ""}\n${detail}\n${outputText}`
    if (/citation_validation_failed/.test(combined)) signals.push("citation_validation_failed")
    if (step.label === "sufficient_context_gate" && /missing_required_fact|missingFacts|missing=/.test(combined)) {
      signals.push("sufficient_context_missing_fact")
    }
    if (step.label === "execute_search_action" && step.status === "error") {
      signals.push("execute_search_action_error")
    }
  }

  return [...new Set(signals)]
}

function summarize(results: BenchmarkResultRow[], corpusSeed: SeededDocument[], skippedRows: SkippedDatasetRow[]): Summary {
  const answerableRows = results.filter((row) => row.evaluation.expectedAnswerable)
  const unanswerableRows = results.filter((row) => !row.evaluation.expectedAnswerable)
  const clarificationExpectedRows = results.filter((row) => row.evaluation.expectedResponseType === "clarification")
  const clarificationActualRows = results.filter((row) => row.evaluation.actualResponseType === "clarification")
  const clearAnswerRows = results.filter((row) => row.evaluation.expectedResponseType === "answer")
  const optionHitRows = results.filter((row) => row.evaluation.optionHit !== null)
  const missingSlotRows = results.filter((row) => row.evaluation.missingSlotHit !== null)
  const groundedOptionRows = results.filter((row) => row.evaluation.corpusGroundedOptions !== null)
  const postClarificationRows = results.filter((row) => row.evaluation.postClarificationAnswerCorrect !== null)
  const queryRewriteRows = results.filter((row) => row.evaluation.queryRewriteHit !== null)
  const postClarificationTaskLatencies = postClarificationRows
    .filter((row) => row.followUp)
    .map((row) => row.taskLatencyMs)
  const latencies = results.map((row) => row.latencyMs).sort((a, b) => a - b)
  const citationEvaluated = results.filter((row) => row.evaluation.citationHit !== null)
  const fileEvaluated = results.filter((row) => row.evaluation.expectedFileHit !== null)
  const answerContentEvaluated = results.filter((row) => row.evaluation.expectedAnswerable)
  const groundedFileEvaluated = results.filter((row) => row.evaluation.groundedFileCorrect !== null)
  const groundedPageEvaluated = results.filter((row) => row.evaluation.groundedPageCorrect !== null)
  const retrievalRecallAtKEvaluated = results.filter((row) => row.evaluation.retrievalRecallAtK !== null)
  const retrievalRecallAt20Evaluated = results.filter((row) => row.evaluation.retrievalRecallAt20 !== null)
  const retrievalMrrAtKEvaluated = results.filter((row) => row.evaluation.retrievalMrrAtK !== null)
  const pageEvaluated = results.filter((row) => row.evaluation.expectedPageHit !== null)
  const pageRecallAtKEvaluated = results.filter((row) => row.evaluation.pageRecallAtK !== null)
  const pageRecallAt20Evaluated = results.filter((row) => row.evaluation.pageRecallAt20 !== null)
  const regionRecallAtKEvaluated = results.filter((row) => row.evaluation.regionRecallAtK !== null)
  const regionRecallAt20Evaluated = results.filter((row) => row.evaluation.regionRecallAt20 !== null)
  const containsEvaluated = results.filter((row) => row.evaluation.answerContainsExpected !== null)
  const factSlotEvaluated = results.filter((row) => row.evaluation.factSlotCoverage !== null)
  const normalizedAnswerEvaluated = results.filter((row) => row.evaluation.normalizedAnswerMatch !== null)
  const extractionEvaluated = results.filter((row) => row.evaluation.extractionAccuracy !== null)
  const countEvaluated = results.filter((row) => row.evaluation.countMape !== null)
  const graphResolutionEvaluated = results.filter((row) => row.evaluation.graphResolutionAccuracy !== null)
  const evidenceSufficiencyEvaluated = results.filter((row) => row.evaluation.evidenceSufficiencyPass !== null)
  const supportEvaluated = results.filter((row) => row.evaluation.unsupportedSentenceRate !== null)
  const citationSupportEvaluated = results.filter((row) => row.evaluation.citationSupportPass !== null)
  const noAccessLeakEvaluated = results.filter((row) => row.evaluation.noAccessLeak !== null)
  const refusedRows = results.filter((row) => row.evaluation.refused)
  const iterationCounts = results
    .map((row) => row.evaluation.iterationCount)
    .filter((value): value is number => value !== null)
  const retrievalCallCounts = results
    .map((row) => row.evaluation.retrievalCallCount)
    .filter((value): value is number => value !== null)
  const riskSignalCounts = results
    .map((row) => row.evaluation.riskSignalCount)
    .filter((value): value is number => value !== null)
  const llmJudgeEvaluated = results.filter((row) => (row.evaluation.llmJudgeCount ?? 0) > 0)
  const llmJudgeCallCount = llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeCount ?? 0), 0)
  const asyncProviderAvailabilityEvaluated = results.filter((row) => row.evaluation.asyncProviderAvailabilityCorrect !== null)
  const asyncStatusEvaluated = results.filter((row) => row.evaluation.asyncStatusCorrect !== null)
  const asyncFailureReasonCodeEvaluated = results.filter((row) => row.evaluation.asyncFailureReasonCodeCorrect !== null)
  const asyncNoMockArtifactsEvaluated = results.filter((row) => row.evaluation.asyncNoMockArtifacts !== null)
  const asyncArtifactMetadataRedactionEvaluated = results.filter((row) => row.evaluation.asyncArtifactMetadataRedacted !== null)
  const seedManifest = corpusSeed.map((seed) => ({
    fileName: seed.fileName,
    status: seed.status,
    chunkCount: seed.chunkCount,
    sourceHash: seed.sourceHash,
    ingestSignature: seed.ingestSignature,
    skipReason: seed.skipReason
  }))
  const skipManifest = skippedRows.map((row) => ({
    id: row.id,
    question: row.question,
    fileNames: row.fileNames,
    reason: row.reason
  }))
  const caseResults = results.map((row) => createBenchmarkCaseResult({
    caseId: row.id,
    status: row.status,
    failureReasons: row.evaluation.failureReasons,
    retrieval: {
      retrievedCount: row.evaluation.retrievedCount,
      recallAtK: row.evaluation.retrievalRecallAtK === null ? null : Number(row.evaluation.retrievalRecallAtK),
      recallAt20: row.evaluation.retrievalRecallAt20 === null ? null : Number(row.evaluation.retrievalRecallAt20),
      mrrAtK: row.evaluation.retrievalMrrAtK,
      noAccessLeakCount: row.evaluation.noAccessLeakCount
    },
    citation: {
      citationCount: row.evaluation.citationCount,
      citationHit: row.evaluation.citationHit,
      citationSupportPass: row.evaluation.citationSupportPass,
      expectedFileHit: row.evaluation.expectedFileHit,
      expectedPageHit: row.evaluation.expectedPageHit
    },
    latency: {
      latencyMs: row.latencyMs,
      taskLatencyMs: row.taskLatencyMs
    }
  }))
  const datasetPrepareRuns = [
    createBenchmarkDatasetPrepareRun({
      suite: suiteMetadata,
      datasetPath,
      seedManifest,
      skipManifest
    })
  ]

  const summary = {
    artifactContractVersion: benchmarkArtifactContractVersion,
    suite: suiteMetadata,
    baselineConfig,
    candidateConfig,
    caseResults,
    datasetPrepareRuns,
    seedManifest,
    skipManifest,
    datasetPath,
    outputPath,
    reportPath,
    summaryPath,
    evaluatorProfile: suiteEvaluatorProfile,
    baselineComparisonNote,
    apiBaseUrl,
    corpusSeed,
    generatedAt: new Date().toISOString(),
    total: results.length,
    skipped: skippedRows.length,
    skippedRows,
    succeeded: results.filter((row) => row.status >= 200 && row.status < 300).length,
    failedHttp: results.filter((row) => row.status < 200 || row.status >= 300).length,
    answerableTotal: answerableRows.length,
    unanswerableTotal: unanswerableRows.length,
    metrics: {
      answerableAccuracy: rate(answerableRows.filter((row) => row.evaluation.answerCorrect).length, answerableRows.length),
      clarificationNeedPrecision: rate(
        clarificationActualRows.filter((row) => row.evaluation.expectedResponseType === "clarification").length,
        clarificationActualRows.length
      ),
      clarificationNeedRecall: rate(
        clarificationExpectedRows.filter((row) => row.evaluation.actualResponseType === "clarification").length,
        clarificationExpectedRows.length
      ),
      clarificationNeedF1: f1(
        rate(
          clarificationActualRows.filter((row) => row.evaluation.expectedResponseType === "clarification").length,
          clarificationActualRows.length
        ),
        rate(
          clarificationExpectedRows.filter((row) => row.evaluation.actualResponseType === "clarification").length,
          clarificationExpectedRows.length
        )
      ),
      optionHitRate: rate(optionHitRows.filter((row) => row.evaluation.optionHit === true).length, optionHitRows.length),
      missingSlotHitRate: rate(
        missingSlotRows.filter((row) => row.evaluation.missingSlotHit === true).length,
        missingSlotRows.length
      ),
      corpusGroundedOptionRate: rate(
        groundedOptionRows.filter((row) => row.evaluation.corpusGroundedOptions === true).length,
        groundedOptionRows.length
      ),
      postClarificationAccuracy: rate(
        postClarificationRows.filter((row) => row.evaluation.postClarificationAnswerCorrect === true).length,
        postClarificationRows.length
      ),
      queryRewriteAccuracy: rate(
        queryRewriteRows.filter((row) => row.evaluation.queryRewriteHit === true).length,
        queryRewriteRows.length
      ),
      overClarificationRate: rate(
        clearAnswerRows.filter((row) => row.evaluation.actualResponseType === "clarification").length,
        clearAnswerRows.length
      ),
      clarificationLatencyOverheadMs: latencyDelta(clarificationActualRows, results.filter((row) => row.evaluation.actualResponseType !== "clarification")),
      postClarificationTaskLatencyMs:
        postClarificationTaskLatencies.length === 0
          ? null
          : Math.round(postClarificationTaskLatencies.reduce((sum, value) => sum + value, 0) / postClarificationTaskLatencies.length),
      abstentionRecall: rate(
        unanswerableRows.filter((row) => row.evaluation.abstentionCorrect === true).length,
        unanswerableRows.length
      ),
      abstainAccuracy: rate(
        unanswerableRows.filter((row) => row.evaluation.abstentionCorrect === true).length,
        unanswerableRows.length
      ),
      unsupportedAnswerRate: rate(
        unanswerableRows.filter((row) => row.evaluation.unsupportedAnswer).length,
        unanswerableRows.length
      ),
      answerContentAccuracy: rate(
        answerContentEvaluated.filter((row) => row.evaluation.answerContentCorrect).length,
        answerContentEvaluated.length
      ),
      answerContainsRate: rate(
        containsEvaluated.filter((row) => row.evaluation.answerContainsExpected === true).length,
        containsEvaluated.length
      ),
      groundedFileAccuracy: rate(
        groundedFileEvaluated.filter((row) => row.evaluation.groundedFileCorrect === true).length,
        groundedFileEvaluated.length
      ),
      groundedPageAccuracy: rate(
        groundedPageEvaluated.filter((row) => row.evaluation.groundedPageCorrect === true).length,
        groundedPageEvaluated.length
      ),
      citationHitRate: rate(
        citationEvaluated.filter((row) => row.evaluation.citationHit === true).length,
        citationEvaluated.length
      ),
      expectedFileHitRate: rate(
        fileEvaluated.filter((row) => row.evaluation.expectedFileHit === true).length,
        fileEvaluated.length
      ),
      pageRecallAtK: rate(
        pageRecallAtKEvaluated.filter((row) => row.evaluation.pageRecallAtK === true).length,
        pageRecallAtKEvaluated.length
      ),
      pageRecallAt20: rate(
        pageRecallAt20Evaluated.filter((row) => row.evaluation.pageRecallAt20 === true).length,
        pageRecallAt20Evaluated.length
      ),
      regionRecallAtK: rate(
        regionRecallAtKEvaluated.filter((row) => row.evaluation.regionRecallAtK === true).length,
        regionRecallAtKEvaluated.length
      ),
      regionRecallAt20: rate(
        regionRecallAt20Evaluated.filter((row) => row.evaluation.regionRecallAt20 === true).length,
        regionRecallAt20Evaluated.length
      ),
      normalizedAnswerAccuracy: rate(
        normalizedAnswerEvaluated.filter((row) => row.evaluation.normalizedAnswerMatch === true).length,
        normalizedAnswerEvaluated.length
      ),
      extractionAccuracy: rate(
        extractionEvaluated.filter((row) => row.evaluation.extractionAccuracy === true).length,
        extractionEvaluated.length
      ),
      countMape:
        countEvaluated.length === 0
          ? null
          : Number((countEvaluated.reduce((sum, row) => sum + (row.evaluation.countMape ?? 0), 0) / countEvaluated.length).toFixed(4)),
      graphResolutionAccuracy: rate(
        graphResolutionEvaluated.filter((row) => row.evaluation.graphResolutionAccuracy === true).length,
        graphResolutionEvaluated.length
      ),
      evidenceSufficiencyPassRate: rate(
        evidenceSufficiencyEvaluated.filter((row) => row.evaluation.evidenceSufficiencyPass === true).length,
        evidenceSufficiencyEvaluated.length
      ),
      retrievalRecallAtK: rate(
        retrievalRecallAtKEvaluated.filter((row) => row.evaluation.retrievalRecallAtK === true).length,
        retrievalRecallAtKEvaluated.length
      ),
      retrievalMrrAtK:
        retrievalMrrAtKEvaluated.length === 0
          ? null
          : Number(
              (
                retrievalMrrAtKEvaluated.reduce((sum, row) => sum + (row.evaluation.retrievalMrrAtK ?? 0), 0) /
                retrievalMrrAtKEvaluated.length
              ).toFixed(4)
            ),
      retrievalRecallAt20: rate(
        retrievalRecallAt20Evaluated.filter((row) => row.evaluation.retrievalRecallAt20 === true).length,
        retrievalRecallAt20Evaluated.length
      ),
      expectedPageHitRate: rate(
        pageEvaluated.filter((row) => row.evaluation.expectedPageHit === true).length,
        pageEvaluated.length
      ),
      factSlotCoverage:
        factSlotEvaluated.length === 0
          ? null
          : Number(
              (
                factSlotEvaluated.reduce((sum, row) => sum + (row.evaluation.factSlotCoverage ?? 0), 0) /
                factSlotEvaluated.length
              ).toFixed(4)
            ),
      citationSupportPassRate: rate(
        citationSupportEvaluated.filter((row) => row.evaluation.citationSupportPass === true).length,
        citationSupportEvaluated.length
      ),
      refusalPrecision: rate(
        refusedRows.filter((row) => !row.evaluation.expectedAnswerable).length,
        refusedRows.length
      ),
      refusalRecall: rate(
        unanswerableRows.filter((row) => row.evaluation.refused).length,
        unanswerableRows.length
      ),
      noAccessLeakCount: results.reduce((sum, row) => sum + row.evaluation.noAccessLeakCount, 0),
      noAccessLeakRate: rate(
        noAccessLeakEvaluated.filter((row) => row.evaluation.noAccessLeak === true).length,
        noAccessLeakEvaluated.length
      ),
      unsupportedSentenceRate:
        supportEvaluated.length === 0
          ? null
          : Number(
              (
                supportEvaluated.reduce((sum, row) => sum + (row.evaluation.unsupportedSentenceRate ?? 0), 0) /
                supportEvaluated.length
              ).toFixed(4)
            ),
      avgIterations: average(iterationCounts),
      avgRetrievalCalls: average(retrievalCallCounts),
      avgRiskSignals: average(riskSignalCounts),
      llmJudgeInvocationRate: rate(llmJudgeEvaluated.length, results.length),
      llmJudgeNoConflictRate: rate(
        llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeNoConflictCount ?? 0), 0),
        llmJudgeCallCount
      ),
      llmJudgeConflictRate: rate(
        llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeConflictCount ?? 0), 0),
        llmJudgeCallCount
      ),
      llmJudgeUnclearRate: rate(
        llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeUnclearCount ?? 0), 0),
        llmJudgeCallCount
      ),
      llmJudgeResolvedRate: rate(
        llmJudgeEvaluated.filter((row) => row.evaluation.llmJudgeResolved === true).length,
        llmJudgeEvaluated.length
      ),
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      averageLatencyMs: results.length === 0 ? null : Math.round(results.reduce((sum, row) => sum + row.latencyMs, 0) / results.length),
      asyncProviderAvailabilityAccuracy: rate(
        asyncProviderAvailabilityEvaluated.filter((row) => row.evaluation.asyncProviderAvailabilityCorrect === true).length,
        asyncProviderAvailabilityEvaluated.length
      ),
      asyncStatusAccuracy: rate(
        asyncStatusEvaluated.filter((row) => row.evaluation.asyncStatusCorrect === true).length,
        asyncStatusEvaluated.length
      ),
      asyncFailureReasonCodeAccuracy: rate(
        asyncFailureReasonCodeEvaluated.filter((row) => row.evaluation.asyncFailureReasonCodeCorrect === true).length,
        asyncFailureReasonCodeEvaluated.length
      ),
      asyncNoMockArtifactRate: rate(
        asyncNoMockArtifactsEvaluated.filter((row) => row.evaluation.asyncNoMockArtifacts === true).length,
        asyncNoMockArtifactsEvaluated.length
      ),
      asyncArtifactMetadataRedactionPassRate: rate(
        asyncArtifactMetadataRedactionEvaluated.filter((row) => row.evaluation.asyncArtifactMetadataRedacted === true).length,
        asyncArtifactMetadataRedactionEvaluated.length
      )
    },
    turnDependencyMetrics: summarizeTurnDependencyMetrics(results),
    failures: results
      .filter((row) => row.evaluation.failureReasons.length > 0)
      .map((row) => ({
        id: row.id,
        question: row.question,
        reasons: row.evaluation.failureReasons,
        expectedContains: row.expectedContains,
        expectedAnswer: row.expectedAnswer,
        expected: row.expected,
        answerPreview: (row.result.answer ?? row.result.error ?? "").slice(0, 180),
        debugSignals: row.evaluation.failureDebugSignals,
        categories: row.evaluation.failureCategories
      })),
    diagnosticFailureBreakdown: diagnosticFailureBreakdown(results)
  }
  return {
    ...createBenchmarkRunArtifact({
      suite: suiteMetadata,
      baselineConfig,
      candidateConfig,
      caseResults,
      datasetPrepareRuns,
      seedManifest,
      skipManifest,
      generatedAt: summary.generatedAt
    }),
    ...summary,
    qualityReview: createQualityReview({
      current: summary.metrics,
      baseline: baselineSummary?.metrics,
      thresholds: suiteEvaluatorProfile.thresholds,
      failures: summary.failures
    })
  }
}

function benchmarkUseCaseFromEnv(): BenchmarkUseCase | undefined {
  const value = process.env.BENCHMARK_USE_CASE
  if (
    value === "internal_qa" ||
    value === "multi_turn_rag" ||
    value === "chat_rag" ||
    value === "search_retrieval" ||
    value === "long_pdf_qa" ||
    value === "design_drawing_qa" ||
    value === "knowledge_quality" ||
    value === "public_pdf_qa" ||
    value === "async_agent_task"
  ) {
    return value
  }
  return undefined
}

function benchmarkRunnerFromEnv(): BenchmarkSuite["runner"] {
  const value = process.env.BENCHMARK_RUNNER
  if (value === "agent" || value === "search" || value === "conversation" || value === "async_agent") return value
  return process.env.BENCHMARK_USE_CASE === "async_agent_task" ? "async_agent" : "agent"
}

function summarizeTurnDependencyMetrics(results: BenchmarkResultRow[]): Summary["turnDependencyMetrics"] {
  const groups = new Map<string, BenchmarkResultRow[]>()
  for (const row of results) {
    const key = row.turnDependency ?? (row.conversationId ? "unspecified" : "standalone")
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return Object.fromEntries([...groups.entries()].map(([dependency, rows]) => {
    const answerableRows = rows.filter((row) => row.evaluation.expectedAnswerable)
    const groundedFileRows = rows.filter((row) => row.evaluation.groundedFileCorrect !== null)
    const groundedPageRows = rows.filter((row) => row.evaluation.groundedPageCorrect !== null)
    const retrievalRows = rows.filter((row) => row.evaluation.retrievalRecallAtK !== null)
    const pageRows = rows.filter((row) => row.evaluation.expectedPageHit !== null)
    const supportRows = rows.filter((row) => row.evaluation.citationSupportPass !== null)
    const refusedRows = rows.filter((row) => row.evaluation.refused)
    const unanswerableRows = rows.filter((row) => !row.evaluation.expectedAnswerable)
    const unsupportedRows = rows.filter((row) => row.evaluation.unsupportedSentenceRate !== null)
    return [dependency, {
      total: rows.length,
      answerableAccuracy: rate(answerableRows.filter((row) => row.evaluation.answerCorrect).length, answerableRows.length),
      answerContentAccuracy: rate(answerableRows.filter((row) => row.evaluation.answerContentCorrect).length, answerableRows.length),
      groundedFileAccuracy: rate(groundedFileRows.filter((row) => row.evaluation.groundedFileCorrect === true).length, groundedFileRows.length),
      groundedPageAccuracy: rate(groundedPageRows.filter((row) => row.evaluation.groundedPageCorrect === true).length, groundedPageRows.length),
      retrievalRecallAtK: rate(retrievalRows.filter((row) => row.evaluation.retrievalRecallAtK === true).length, retrievalRows.length),
      expectedPageHitRate: rate(pageRows.filter((row) => row.evaluation.expectedPageHit === true).length, pageRows.length),
      citationSupportPassRate: rate(supportRows.filter((row) => row.evaluation.citationSupportPass === true).length, supportRows.length),
      refusalPrecision: rate(refusedRows.filter((row) => !row.evaluation.expectedAnswerable).length, refusedRows.length),
      refusalRecall: rate(unanswerableRows.filter((row) => row.evaluation.refused).length, unanswerableRows.length),
      unsupportedSentenceRate:
        unsupportedRows.length === 0
          ? null
          : Number(
              (
                unsupportedRows.reduce((sum, row) => sum + (row.evaluation.unsupportedSentenceRate ?? 0), 0) /
                unsupportedRows.length
              ).toFixed(4)
            )
    }]
  }))
}

type BenchmarkReportMetricName =
  | "answerable_accuracy"
  | "clarification_need_precision"
  | "clarification_need_recall"
  | "clarification_need_f1"
  | "option_hit_rate"
  | "missing_slot_hit_rate"
  | "corpus_grounded_option_rate"
  | "post_clarification_accuracy"
  | "query_rewrite_accuracy"
  | "over_clarification_rate"
  | "clarification_latency_delta_vs_non_clarification_ms"
  | "post_clarification_task_latency_ms"
  | "abstention_recall"
  | "abstain_accuracy"
  | "unsupported_answer_rate"
  | "answer_content_accuracy"
  | "answer_contains_rate"
  | "grounded_file_accuracy"
  | "grounded_page_accuracy"
  | "citation_hit_rate"
  | "expected_file_hit_rate"
  | "page_recall_at_k"
  | "page_recall_at_20"
  | "region_recall_at_k"
  | "region_recall_at_20"
  | "normalized_answer_accuracy"
  | "extraction_accuracy"
  | "count_mape"
  | "graph_resolution_accuracy"
  | "evidence_sufficiency_pass_rate"
  | "retrieval_recall_at_k"
  | "retrieval_mrr_at_k"
  | "retrieval_recall_at_20"
  | "expected_page_hit_rate"
  | "fact_slot_coverage"
  | "citation_support_pass_rate"
  | "refusal_precision"
  | "refusal_recall"
  | "no_access_leak_count"
  | "no_access_leak_rate"
  | "unsupported_sentence_rate"
  | "avg_iterations"
  | "avg_retrieval_calls"
  | "avg_risk_signals"
  | "llm_judge_invocation_rate"
  | "llm_judge_no_conflict_rate"
  | "llm_judge_conflict_rate"
  | "llm_judge_unclear_rate"
  | "llm_judge_resolved_rate"
  | "p50_latency_ms"
  | "p95_latency_ms"
  | "average_latency_ms"
  | "async_provider_availability_accuracy"
  | "async_status_accuracy"
  | "async_failure_reason_code_accuracy"
  | "async_no_mock_artifact_rate"
  | "async_artifact_metadata_redaction_pass_rate"

function renderMarkdownReport(summary: Summary, results: BenchmarkResultRow[]): string {
  const coverageRows = buildCoverageReportRows(results)
  const metricRows = buildMetricReportRows(summary, results)

  const corpusSeedRows = summary.corpusSeed.length === 0
    ? "\nNo benchmark corpus seed configured.\n"
    : [
        "| file | status | reason | chunks | source hash | ingest signature |",
        "| --- | --- | --- | ---: | --- | --- |",
        ...summary.corpusSeed.map((seed) =>
          `| ${escapeMarkdown(seed.fileName)} | ${seed.status} | ${escapeMarkdown(seed.skipReason ?? "")} | ${seed.chunkCount} | ${seed.sourceHash.slice(0, 12)} | ${seed.ingestSignature.slice(0, 12)} |`
        )
      ].join("\n")

  const skippedRowRows = summary.skippedRows.length === 0
    ? "\nNo skipped benchmark rows.\n"
    : [
        "| id | question | files | reason |",
        "| --- | --- | --- | --- |",
        ...summary.skippedRows.map((row) =>
          `| ${escapeMarkdown(row.id ?? "")} | ${escapeMarkdown(row.question)} | ${escapeMarkdown(row.fileNames.join(", "))} | ${row.reason} |`
        )
      ].join("\n")

  const failureRows = summary.failures.length === 0
    ? "\nNo failed benchmark rows.\n"
    : [
        "| id | question | reasons | debug signals | categories | answer preview |",
        "| --- | --- | --- | --- | --- | --- |",
        ...summary.failures.map((failure) =>
          `| ${escapeMarkdown(failure.id ?? "")} | ${escapeMarkdown(failure.question)} | ${escapeMarkdown(failure.reasons.join(", "))} | ${escapeMarkdown(failure.debugSignals.join(", "))} | ${escapeMarkdown(failure.categories.join(", "))} | ${escapeMarkdown(failure.answerPreview)} |`
        )
      ].join("\n")

  const diagnosticFailureRows = [
    "| category | count |",
    "| --- | ---: |",
    ...Object.entries(summary.diagnosticFailureBreakdown).map(([category, count]) => `| ${category} | ${count} |`)
  ].join("\n")

  const regressionRows = summary.qualityReview.regressions.length === 0
    ? "\nNo benchmark metric regressions detected.\n"
    : [
        "| metric | baseline | current | delta | threshold |",
        "| --- | ---: | ---: | ---: | ---: |",
        ...summary.qualityReview.regressions.map((regression) =>
          `| ${regression.metric} | ${regression.baseline} | ${regression.current} | ${regression.delta} | ${regression.threshold} |`
        )
      ].join("\n")

  const aliasCandidateRows = summary.qualityReview.aliasCandidates.length === 0
    ? "\nNo alias candidates suggested.\n"
    : [
        "| term | expansions | source rows | reason |",
        "| --- | --- | --- | --- |",
        ...summary.qualityReview.aliasCandidates.map((candidate) =>
          `| ${escapeMarkdown(candidate.term)} | ${escapeMarkdown(candidate.expansions.join(", "))} | ${escapeMarkdown(candidate.sourceRowIds.join(", "))} | ${escapeMarkdown(candidate.reason)} |`
        )
      ].join("\n")

  const turnDependencyRows = Object.keys(summary.turnDependencyMetrics).length === 0
    ? "\nNo turn dependency metrics.\n"
    : [
        "| dependency | total | answerable_accuracy | answer_content_accuracy | grounded_file_accuracy | grounded_page_accuracy | retrieval_recall_at_k | expected_page_hit_rate | citation_support_pass_rate | refusal_precision | refusal_recall | unsupported_sentence_rate |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ...Object.entries(summary.turnDependencyMetrics).map(([dependency, metrics]) =>
          `| ${escapeMarkdown(dependency)} | ${metrics.total} | ${formatRate(metrics.answerableAccuracy)} | ${formatRate(metrics.answerContentAccuracy)} | ${formatRate(metrics.groundedFileAccuracy)} | ${formatRate(metrics.groundedPageAccuracy)} | ${formatRate(metrics.retrievalRecallAtK)} | ${formatRate(metrics.expectedPageHitRate)} | ${formatRate(metrics.citationSupportPassRate)} | ${formatRate(metrics.refusalPrecision)} | ${formatRate(metrics.refusalRecall)} | ${formatRate(metrics.unsupportedSentenceRate)} |`
        )
      ].join("\n")

  const detailRows = [
    "| id | category | expected | actual | fact_slots | support | leak | clarification | iterations | retrieval_calls | risk_signals | llm_judge | latency_ms | task_latency_ms | citations | retrieved | result |",
    "| --- | --- | --- | --- | ---: | --- | ---: | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |",
    ...results.map((row) => {
      const passed = row.evaluation.failureReasons.length === 0 ? "pass" : row.evaluation.failureReasons.join(", ")
      return `| ${escapeMarkdown(row.id ?? "")} | ${escapeMarkdown(rowCategory(row))} | ${row.evaluation.expectedResponseType} | ${row.evaluation.actualResponseType} | ${formatRate(row.evaluation.factSlotCoverage)} | ${formatBoolean(row.evaluation.citationSupportPass)} | ${row.evaluation.noAccessLeakCount} | ${formatClarificationSummary(row.evaluation)} | ${formatNumber(row.evaluation.iterationCount)} | ${formatNumber(row.evaluation.retrievalCallCount)} | ${formatNumber(row.evaluation.riskSignalCount)} | ${formatLlmJudgeSummary(row.evaluation)} | ${row.latencyMs} | ${row.taskLatencyMs} | ${row.evaluation.citationCount} | ${row.evaluation.retrievedCount} | ${escapeMarkdown(passed)} |`
    })
  ].join("\n")

  return `# MemoRAG Benchmark Report

- Generated at: ${summary.generatedAt}
- API base URL: ${summary.apiBaseUrl}
- Dataset: ${summary.datasetPath}
- Raw results: ${summary.outputPath}
- Summary JSON: ${summary.summaryPath}
- Evaluator profile: ${profileKey(summary.evaluatorProfile)}
- RAG profile: ${formatBenchmarkRagProfiles(results)}
- Baseline comparison: ${summary.baselineComparisonNote ?? "same_profile_or_not_configured"}

## Summary

- Total rows: ${summary.total}
- Skipped rows: ${summary.skipped}
- HTTP success: ${summary.succeeded}
- HTTP failed: ${summary.failedHttp}
- Answerable rows: ${summary.answerableTotal}
- Unanswerable rows: ${summary.unanswerableTotal}

## Dataset Coverage

| item | count | note |
| --- | ---: | --- |
${coverageRows.map((row) => `| ${row.item} | ${row.count} | ${escapeMarkdown(row.note)} |`).join("\n")}

## Metrics

| metric | value | status | basis | description | note |
| --- | ---: | --- | --- | --- | --- |
${metricRows.map((row) => `| ${row.metric} | ${row.value} | ${row.status} | ${escapeMarkdown(row.basis)} | ${escapeMarkdown(metricDescription(row.metric))} | ${escapeMarkdown(row.note)} |`).join("\n")}

## Turn Dependency Metrics

${turnDependencyRows}

## Corpus Seed

${corpusSeedRows}

## Quality Review

- Status: ${summary.qualityReview.status}
- Baseline summary: ${baselineSummaryPath ?? "not_configured"}

### Regressions

${regressionRows}

### Alias Candidates

${aliasCandidateRows}

## Failures

${failureRows}

## Diagnostic Failure Breakdown

${diagnosticFailureRows}

## Skipped Rows

${skippedRowRows}

## Row Details

${detailRows}
`
}

function metricDescription(metric: BenchmarkReportMetricName): string {
  switch (metric) {
    case "answerable_accuracy":
      return "回答可能な行で、期待語句・正規表現・引用・期待資料などの判定を満たした割合。page metadata が観測できない場合の page hit は gate から外す。"
    case "clarification_need_precision":
      return "実際に確認質問を返した行のうち、dataset でも確認質問を期待していた割合。"
    case "clarification_need_recall":
      return "確認質問が必要な行のうち、実際に確認質問を返せた割合。"
    case "clarification_need_f1":
      return "確認質問の precision と recall の調和平均。確認質問の出し過ぎと不足のバランスを見る。"
    case "option_hit_rate":
      return "確認質問の選択肢に、dataset が期待する候補語句が含まれた割合。"
    case "missing_slot_hit_rate":
      return "確認質問で不足 slot として返した項目が、dataset の期待不足 slot を満たした割合。"
    case "corpus_grounded_option_rate":
      return "確認質問の選択肢が、memory・evidence・aspect・history などの根拠に紐づいていた割合。"
    case "post_clarification_accuracy":
      return "確認質問後の follow-up 実行で、期待する回答または拒否に到達した割合。"
    case "query_rewrite_accuracy":
      return "multi-turn 行で standalone query が expectedStandaloneQuestion と一致した割合。"
    case "over_clarification_rate":
      return "明確に回答すべき行で、不要な確認質問を返した割合。低いほどよい。"
    case "clarification_latency_delta_vs_non_clarification_ms":
      return "確認質問を返した行の初回 latency と、それ以外の行の初回 latency の平均差。"
    case "post_clarification_task_latency_ms":
      return "確認質問の初回応答から follow-up 完了までを含めた task latency の平均。"
    case "abstention_recall":
      return "回答不能な行のうち、回答せず拒否できた割合。"
    case "abstain_accuracy":
      return "回答不能な行で、通常回答に進まず refusal / no-answer として評価できた割合。unsupported answer とは別に見る。"
    case "unsupported_answer_rate":
      return "回答不能な行で、根拠なしに回答してしまった割合。低いほどよい。"
    case "answer_content_accuracy":
      return "回答可能な行で、回答種別・期待語句・正規表現・正規化値が満たされた割合。citation / file / page grounding とは分けて見る。"
    case "answer_contains_rate":
      return "回答可能な行で、期待語句または期待回答文字列を回答に含められた割合。"
    case "grounded_file_accuracy":
      return "回答内容が正しく、citation / finalEvidence に期待ファイルまたは期待 document が含まれた割合。"
    case "grounded_page_accuracy":
      return "回答内容と期待ファイル grounding が正しく、citation / finalEvidence に期待 page が含まれた割合。page metadata が観測できる行だけを評価する。"
    case "citation_hit_rate":
      return "回答可能な行で、少なくとも 1 件の citation を返した割合。"
    case "expected_file_hit_rate":
      return "期待ファイルまたは期待 document が citation/finalEvidence に含まれた割合。"
    case "page_recall_at_k":
      return "evaluator profile の retrieval.recallK で期待 page が raw retrieved に含まれた割合。"
    case "page_recall_at_20":
      return "上位 20 件の raw retrieved に期待 page が含まれた割合。visual retrieval の page 到達性能比較に使う。"
    case "region_recall_at_k":
      return "evaluator profile の retrieval.recallK で期待 region id が raw retrieved に含まれた割合。"
    case "region_recall_at_20":
      return "上位 20 件の raw retrieved に期待 region id が含まれた割合。"
    case "normalized_answer_accuracy":
      return "期待値と回答・根拠を同じ図面値正規化に通したうえで一致した割合。"
    case "extraction_accuracy":
      return "diagnostics.extractions の正規化値が dataset の期待抽出値と一致した割合。"
    case "count_mape":
      return "diagnostics.counts のカウント値と期待カウントの平均絶対パーセント誤差。低いほどよい。"
    case "graph_resolution_accuracy":
      return "diagnostics.graphResolutions が期待する参照先・解決先に到達した割合。"
    case "evidence_sufficiency_pass_rate":
      return "図面 QA の evidenceSufficiency 条件に対し、bbox・source priority・正規化値一致を満たした割合。"
    case "retrieval_recall_at_k":
      return "evaluator profile の retrieval.recallK で期待ファイルまたは期待 document が含まれた割合。"
    case "retrieval_mrr_at_k":
      return "evaluator profile の retrieval.recallK 内で、最初に期待ファイルまたは期待 document が現れた順位の逆数平均。"
    case "retrieval_recall_at_20":
      return "上位 20 件の raw retrieved に期待ファイルまたは期待 document が含まれた割合。"
    case "expected_page_hit_rate":
      return "期待 page が citation/finalEvidence に含まれた割合。citation / finalEvidence / retrieved に page metadata が観測できる行だけを評価する。"
    case "fact_slot_coverage":
      return "dataset の expectedFactSlots のうち、回答文または取得根拠で支持できた fact slot の平均割合。"
    case "citation_support_pass_rate":
      return "answerSupport が評価した行のうち、非支持文が 0 件だった割合。"
    case "refusal_precision":
      return "拒否した行のうち、dataset 上も回答不能だった割合。高いほど誤拒否が少ない。"
    case "refusal_recall":
      return "回答不能な行のうち、実際に拒否できた割合。"
    case "no_access_leak_count":
      return "dataset で forbiddenFiles または forbiddenDocumentIds に指定した根拠が citation/retrieved に出た件数。0 が gate。"
    case "no_access_leak_rate":
      return "ACL negative 行のうち、forbidden evidence が citation/retrieved に出なかった割合。"
    case "unsupported_sentence_rate":
      return "answerSupport が検出した非支持文の割合。低いほど根拠に忠実。"
    case "avg_iterations":
      return "debug trace 上の検索評価 iteration 数の平均。"
    case "avg_retrieval_calls":
      return "debug trace 上の検索 action 実行回数の平均。"
    case "avg_risk_signals":
      return "retrieval evaluator が検出した risk signal 数の平均。"
    case "llm_judge_invocation_rate":
      return "LLM judge が 1 回以上実行された行の割合。"
    case "llm_judge_no_conflict_rate":
      return "LLM judge 判定のうち NO_CONFLICT だった割合。"
    case "llm_judge_conflict_rate":
      return "LLM judge 判定のうち CONFLICT だった割合。低いほどよい。"
    case "llm_judge_unclear_rate":
      return "LLM judge 判定のうち UNCLEAR だった割合。"
    case "llm_judge_resolved_rate":
      return "LLM judge 対象行のうち、最終的に conflict を解消できた割合。"
    case "p50_latency_ms":
      return "初回 API call latency の中央値。"
    case "p95_latency_ms":
      return "初回 API call latency の 95 パーセンタイル。遅い tail latency を見る。"
    case "average_latency_ms":
      return "初回 API call latency の平均。"
    case "async_provider_availability_accuracy":
      return "async agent run metadata の providerAvailability が dataset の期待値と一致した割合。"
    case "async_status_accuracy":
      return "async agent run metadata の status が dataset の期待値と一致した割合。"
    case "async_failure_reason_code_accuracy":
      return "async agent run metadata の failureReasonCode が dataset の期待値と一致した割合。"
    case "async_no_mock_artifact_rate":
      return "provider 未設定・利用不可など実行不能な async agent run が artifactIds/artifacts を返していない割合。"
    case "async_artifact_metadata_redaction_pass_rate":
      return "async agent artifact metadata と failure reason に secret、token、signed URL らしい値が残っていない割合。"
  }
}

function formatBenchmarkRagProfiles(results: BenchmarkResultRow[]): string {
  const profiles = new Set<string>()
  for (const row of results) {
    const profile = row.result.debug?.ragProfile
    if (profile?.id && profile?.version) {
      const retrieval = profile.retrievalProfileId && profile.retrievalProfileVersion
        ? ` retrieval=${profile.retrievalProfileId}@${profile.retrievalProfileVersion}`
        : ""
      const answer = profile.answerPolicyId && profile.answerPolicyVersion
        ? ` answer=${profile.answerPolicyId}@${profile.answerPolicyVersion}`
        : ""
      profiles.add(`${profile.id}@${profile.version}${retrieval}${answer}`)
    }
    const followUpProfile = row.followUp?.result.debug?.ragProfile
    if (followUpProfile?.id && followUpProfile?.version) {
      const retrieval = followUpProfile.retrievalProfileId && followUpProfile.retrievalProfileVersion
        ? ` retrieval=${followUpProfile.retrievalProfileId}@${followUpProfile.retrievalProfileVersion}`
        : ""
      const answer = followUpProfile.answerPolicyId && followUpProfile.answerPolicyVersion
        ? ` answer=${followUpProfile.answerPolicyId}@${followUpProfile.answerPolicyVersion}`
        : ""
      profiles.add(`${followUpProfile.id}@${followUpProfile.version}${retrieval}${answer}`)
    }
  }
  return profiles.size === 0 ? "not_reported" : Array.from(profiles).sort().join(", ")
}

function buildCoverageReportRows(results: BenchmarkResultRow[]): CoverageReportRow[] {
  const expectedClarificationRows = results.filter((row) => row.evaluation.expectedResponseType === "clarification")
  const expectedAnswerRows = results.filter((row) => row.evaluation.expectedResponseType === "answer")
  const expectedUnanswerableRows = results.filter((row) => !row.evaluation.expectedAnswerable)
  const categoryCounts = new Map<string, number>()
  for (const result of results) {
    const category = rowCategory(result)
    if (!category) continue
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
  }
  const actualClarificationRows = results.filter((row) => row.evaluation.actualResponseType === "clarification")
  const refusedRows = results.filter((row) => row.evaluation.refused)
  const llmJudgeEvaluated = results.filter((row) => (row.evaluation.llmJudgeCount ?? 0) > 0)
  const llmJudgeCallCount = llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeCount ?? 0), 0)
  return [
    { item: "expected_answer_rows", count: expectedAnswerRows.length, note: "answerable / normal QA denominator" },
    { item: "expected_clarification_rows", count: expectedClarificationRows.length, note: "clarification recall and F1 denominator" },
    { item: "expected_unanswerable_rows", count: expectedUnanswerableRows.length, note: "abstention / refusal recall denominator" },
    ...[...categoryCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([category, count]) => ({
      item: `evaluation_category_${category}`,
      count,
      note: "baseline evaluation category from row metadata.evaluationCategory"
    })),
    {
      item: "rows_with_expected_options_any_of",
      count: results.filter((row) => row.evaluation.optionHit !== null).length,
      note: "option_hit_rate denominator"
    },
    {
      item: "rows_with_expected_missing_slots",
      count: results.filter((row) => row.evaluation.missingSlotHit !== null).length,
      note: "missing_slot_hit_rate denominator"
    },
    {
      item: "rows_with_follow_up_expectation",
      count: results.filter((row) => row.evaluation.postClarificationAnswerCorrect !== null).length,
      note: "post_clarification_accuracy denominator"
    },
    {
      item: "rows_with_conversation_id",
      count: results.filter((row) => row.conversationId).length,
      note: "multi-turn conversation rows"
    },
    {
      item: "rows_with_expected_standalone_question",
      count: results.filter((row) => row.expectedStandaloneQuestion).length,
      note: "query rewriting accuracy fixture rows"
    },
    {
      item: "rows_with_expected_pages",
      count: results.filter((row) => row.evaluation.expectedPageHit !== null).length,
      note: "expected_page_hit_rate denominator after observable page metadata check"
    },
    {
      item: "rows_with_expected_region_ids",
      count: results.filter((row) => row.evaluation.regionRecallAtK !== null).length,
      note: "region_recall_at_k denominator"
    },
    {
      item: "rows_with_expected_fact_slots",
      count: results.filter((row) => row.evaluation.factSlotCoverage !== null).length,
      note: "fact_slot_coverage denominator"
    },
    {
      item: "rows_with_expected_normalized_values",
      count: results.filter((row) => row.evaluation.normalizedAnswerMatch !== null).length,
      note: "normalized_answer_accuracy denominator"
    },
    {
      item: "rows_with_expected_extraction_values",
      count: results.filter((row) => row.evaluation.extractionAccuracy !== null).length,
      note: "extraction_accuracy denominator"
    },
    {
      item: "rows_with_expected_counts",
      count: results.filter((row) => row.evaluation.countMape !== null).length,
      note: "count_mape denominator"
    },
    {
      item: "rows_with_expected_graph_resolutions",
      count: results.filter((row) => row.evaluation.graphResolutionAccuracy !== null).length,
      note: "graph_resolution_accuracy denominator"
    },
    {
      item: "rows_with_evidence_sufficiency",
      count: results.filter((row) => row.evaluation.evidenceSufficiencyPass !== null).length,
      note: "evidence_sufficiency_pass_rate denominator"
    },
    {
      item: "actual_clarification_rows",
      count: actualClarificationRows.length,
      note: "clarification precision and latency delta group"
    },
    {
      item: "refused_rows",
      count: refusedRows.length,
      note: "refusal precision denominator"
    },
    {
      item: "rows_with_llm_judge_calls",
      count: llmJudgeEvaluated.length,
      note: "LLM judge invocation / resolved-rate row denominator"
    },
    {
      item: "llm_judge_call_count",
      count: llmJudgeCallCount,
      note: "LLM judge NO_CONFLICT / CONFLICT / UNCLEAR label-rate denominator"
    },
    {
      item: "rows_with_async_agent_provider_availability_expectation",
      count: results.filter((row) => row.evaluation.asyncProviderAvailabilityCorrect !== null).length,
      note: "async_provider_availability_accuracy denominator"
    },
    {
      item: "rows_with_async_agent_artifact_redaction_expectation",
      count: results.filter((row) => row.evaluation.asyncArtifactMetadataRedacted !== null).length,
      note: "async_artifact_metadata_redaction_pass_rate denominator"
    }
  ]
}

function buildMetricReportRows(summary: Summary, results: BenchmarkResultRow[]): MetricReportRow[] {
  const answerableRows = results.filter((row) => row.evaluation.expectedAnswerable)
  const unanswerableRows = results.filter((row) => !row.evaluation.expectedAnswerable)
  const clarificationExpectedRows = results.filter((row) => row.evaluation.expectedResponseType === "clarification")
  const clarificationActualRows = results.filter((row) => row.evaluation.actualResponseType === "clarification")
  const clearAnswerRows = results.filter((row) => row.evaluation.expectedResponseType === "answer")
  const optionHitRows = results.filter((row) => row.evaluation.optionHit !== null)
  const missingSlotRows = results.filter((row) => row.evaluation.missingSlotHit !== null)
  const groundedOptionRows = results.filter((row) => row.evaluation.corpusGroundedOptions !== null)
  const postClarificationRows = results.filter((row) => row.evaluation.postClarificationAnswerCorrect !== null)
  const queryRewriteRows = results.filter((row) => row.evaluation.queryRewriteHit !== null)
  const postClarificationTaskLatencies = postClarificationRows.filter((row) => row.followUp)
  const containsEvaluated = results.filter((row) => row.evaluation.answerContainsExpected !== null)
  const answerContentEvaluated = results.filter((row) => row.evaluation.expectedAnswerable)
  const groundedFileEvaluated = results.filter((row) => row.evaluation.groundedFileCorrect !== null)
  const groundedPageEvaluated = results.filter((row) => row.evaluation.groundedPageCorrect !== null)
  const citationEvaluated = results.filter((row) => row.evaluation.citationHit !== null)
  const fileEvaluated = results.filter((row) => row.evaluation.expectedFileHit !== null)
  const retrievalRecallAtKEvaluated = results.filter((row) => row.evaluation.retrievalRecallAtK !== null)
  const retrievalRecallAt20Evaluated = results.filter((row) => row.evaluation.retrievalRecallAt20 !== null)
  const retrievalMrrAtKEvaluated = results.filter((row) => row.evaluation.retrievalMrrAtK !== null)
  const pageEvaluated = results.filter((row) => row.evaluation.expectedPageHit !== null)
  const pageRecallAtKEvaluated = results.filter((row) => row.evaluation.pageRecallAtK !== null)
  const pageRecallAt20Evaluated = results.filter((row) => row.evaluation.pageRecallAt20 !== null)
  const regionRecallAtKEvaluated = results.filter((row) => row.evaluation.regionRecallAtK !== null)
  const regionRecallAt20Evaluated = results.filter((row) => row.evaluation.regionRecallAt20 !== null)
  const factSlotEvaluated = results.filter((row) => row.evaluation.factSlotCoverage !== null)
  const normalizedAnswerEvaluated = results.filter((row) => row.evaluation.normalizedAnswerMatch !== null)
  const extractionEvaluated = results.filter((row) => row.evaluation.extractionAccuracy !== null)
  const countEvaluated = results.filter((row) => row.evaluation.countMape !== null)
  const graphResolutionEvaluated = results.filter((row) => row.evaluation.graphResolutionAccuracy !== null)
  const evidenceSufficiencyEvaluated = results.filter((row) => row.evaluation.evidenceSufficiencyPass !== null)
  const supportEvaluated = results.filter((row) => row.evaluation.unsupportedSentenceRate !== null)
  const citationSupportEvaluated = results.filter((row) => row.evaluation.citationSupportPass !== null)
  const noAccessLeakEvaluated = results.filter((row) => row.evaluation.noAccessLeak !== null)
  const refusedRows = results.filter((row) => row.evaluation.refused)
  const iterationRows = results.filter((row) => row.evaluation.iterationCount !== null)
  const retrievalCallRows = results.filter((row) => row.evaluation.retrievalCallCount !== null)
  const riskSignalRows = results.filter((row) => row.evaluation.riskSignalCount !== null)
  const llmJudgeEvaluated = results.filter((row) => (row.evaluation.llmJudgeCount ?? 0) > 0)
  const llmJudgeCallCount = llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeCount ?? 0), 0)
  const nonClarificationRows = results.filter((row) => row.evaluation.actualResponseType !== "clarification")
  const asyncProviderAvailabilityRows = results.filter((row) => row.evaluation.asyncProviderAvailabilityCorrect !== null)
  const asyncStatusRows = results.filter((row) => row.evaluation.asyncStatusCorrect !== null)
  const asyncFailureReasonRows = results.filter((row) => row.evaluation.asyncFailureReasonCodeCorrect !== null)
  const asyncNoMockArtifactRows = results.filter((row) => row.evaluation.asyncNoMockArtifacts !== null)
  const asyncArtifactRedactionRows = results.filter((row) => row.evaluation.asyncArtifactMetadataRedacted !== null)

  return [
    metricRateRow("answerable_accuracy", summary.metrics.answerableAccuracy, answerableRows.filter((row) => row.evaluation.answerCorrect).length, answerableRows.length, "通常QAの正答率。answerable rows が分母。"),
    metricRateRow("clarification_need_precision", summary.metrics.clarificationNeedPrecision, clarificationActualRows.filter((row) => row.evaluation.expectedResponseType === "clarification").length, clarificationActualRows.length, "実際に clarification を返した行のうち、期待値も clarification だった割合。0.0% は false positive の存在を示す。"),
    metricRateRow("clarification_need_recall", summary.metrics.clarificationNeedRecall, clarificationExpectedRows.filter((row) => row.evaluation.actualResponseType === "clarification").length, clarificationExpectedRows.length, "期待値として clarification が必要な行がない場合は評価対象外。"),
    metricNullableRow("clarification_need_f1", formatRate(summary.metrics.clarificationNeedF1), summary.metrics.clarificationNeedF1, `precision=${formatRate(summary.metrics.clarificationNeedPrecision)}, recall=${formatRate(summary.metrics.clarificationNeedRecall)}`, "precision と recall の両方が計算できる場合だけ評価可能。"),
    metricRateRow("option_hit_rate", summary.metrics.optionHitRate, optionHitRows.filter((row) => row.evaluation.optionHit === true).length, optionHitRows.length, "`expectedOptionsAnyOf` がある行だけを評価。"),
    metricRateRow("missing_slot_hit_rate", summary.metrics.missingSlotHitRate, missingSlotRows.filter((row) => row.evaluation.missingSlotHit === true).length, missingSlotRows.length, "`expectedMissingSlots` がある行だけを評価。"),
    metricRateRow("corpus_grounded_option_rate", summary.metrics.corpusGroundedOptionRate, groundedOptionRows.filter((row) => row.evaluation.corpusGroundedOptions === true).length, groundedOptionRows.length, "出してしまった clarification option の grounding を見る指標。clarification 判断の正しさとは別。"),
    metricRateRow("post_clarification_accuracy", summary.metrics.postClarificationAccuracy, postClarificationRows.filter((row) => row.evaluation.postClarificationAnswerCorrect === true).length, postClarificationRows.length, "`followUp` 期待値がある行だけを評価。"),
    metricRateRow("query_rewrite_accuracy", summary.metrics.queryRewriteAccuracy, queryRewriteRows.filter((row) => row.evaluation.queryRewriteHit === true).length, queryRewriteRows.length, "`expectedStandaloneQuestion` がある行だけを評価。"),
    metricRateRow("over_clarification_rate", summary.metrics.overClarificationRate, clearAnswerRows.filter((row) => row.evaluation.actualResponseType === "clarification").length, clearAnswerRows.length, "回答すべき行で不要な clarification になった割合。"),
    metricNullableRow("clarification_latency_delta_vs_non_clarification_ms", formatNumber(summary.metrics.clarificationLatencyOverheadMs), summary.metrics.clarificationLatencyOverheadMs, `${clarificationActualRows.length} actual clarification rows vs ${nonClarificationRows.length} non-clarification rows`, "同一質問の overhead ではなく、actual clarification 行の平均 latency から non-clarification 行の平均 latency を引いた差分。負値は clarification 行の方が速いことを示す。summary JSON key は clarificationLatencyOverheadMs を維持。"),
    metricNullableRow("post_clarification_task_latency_ms", formatNumber(summary.metrics.postClarificationTaskLatencyMs), summary.metrics.postClarificationTaskLatencyMs, `${postClarificationTaskLatencies.length}/${postClarificationRows.length} follow-up rows with latency`, "確認質問から follow-up 完了までの平均 task latency。"),
    metricRateRow("abstention_recall", summary.metrics.abstentionRecall, unanswerableRows.filter((row) => row.evaluation.abstentionCorrect === true).length, unanswerableRows.length, "unanswerable 行がない場合は評価対象外。"),
    metricRateRow("abstain_accuracy", summary.metrics.abstainAccuracy, unanswerableRows.filter((row) => row.evaluation.abstentionCorrect === true).length, unanswerableRows.length, "unanswerable 行がない場合は評価対象外。abstention_recall と同じ分母で、unsupported_answer_rate と分けて表示。"),
    metricRateRow("unsupported_answer_rate", summary.metrics.unsupportedAnswerRate, unanswerableRows.filter((row) => row.evaluation.unsupportedAnswer).length, unanswerableRows.length, "unanswerable 行がない場合は評価対象外。"),
    metricRateRow("answer_content_accuracy", summary.metrics.answerContentAccuracy, answerContentEvaluated.filter((row) => row.evaluation.answerContentCorrect).length, answerContentEvaluated.length, "answerable 行で回答種別・期待語句・正規表現・正規化値だけを見る。citation / file / page grounding は別指標。"),
    metricRateRow("answer_contains_rate", summary.metrics.answerContainsRate, containsEvaluated.filter((row) => row.evaluation.answerContainsExpected === true).length, containsEvaluated.length, "`expectedContains` / `expectedAnswer` を持つ answerable 行の期待語句一致率。"),
    metricRateRow("grounded_file_accuracy", summary.metrics.groundedFileAccuracy, groundedFileEvaluated.filter((row) => row.evaluation.groundedFileCorrect === true).length, groundedFileEvaluated.length, "回答内容に加え、citation / finalEvidence の期待ファイルまたは期待 document hit を見る。"),
    metricRateRow("grounded_page_accuracy", summary.metrics.groundedPageAccuracy, groundedPageEvaluated.filter((row) => row.evaluation.groundedPageCorrect === true).length, groundedPageEvaluated.length, "回答内容・期待ファイル・期待 page hit を見る。page metadata が観測できる行だけを分母にする。"),
    metricRateRow("citation_hit_rate", summary.metrics.citationHitRate, citationEvaluated.filter((row) => row.evaluation.citationHit === true).length, citationEvaluated.length, "answerable 行で citation が返った割合。"),
    metricRateRow("expected_file_hit_rate", summary.metrics.expectedFileHitRate, fileEvaluated.filter((row) => row.evaluation.expectedFileHit === true).length, fileEvaluated.length, "`expectedFiles` または `expectedDocumentIds` がある行だけを citation/finalEvidence で評価。"),
    metricRateRow("page_recall_at_k", summary.metrics.pageRecallAtK, pageRecallAtKEvaluated.filter((row) => row.evaluation.pageRecallAtK === true).length, pageRecallAtKEvaluated.length, "`expectedPages` を raw retrieved の evaluator profile retrieval.recallK で評価。"),
    metricRateRow("page_recall_at_20", summary.metrics.pageRecallAt20, pageRecallAt20Evaluated.filter((row) => row.evaluation.pageRecallAt20 === true).length, pageRecallAt20Evaluated.length, "`expectedPages` を raw retrieved の top 20 で評価。"),
    metricRateRow("region_recall_at_k", summary.metrics.regionRecallAtK, regionRecallAtKEvaluated.filter((row) => row.evaluation.regionRecallAtK === true).length, regionRecallAtKEvaluated.length, "`expectedRegionIds` を raw retrieved の evaluator profile retrieval.recallK で評価。"),
    metricRateRow("region_recall_at_20", summary.metrics.regionRecallAt20, regionRecallAt20Evaluated.filter((row) => row.evaluation.regionRecallAt20 === true).length, regionRecallAt20Evaluated.length, "`expectedRegionIds` を raw retrieved の top 20 で評価。"),
    metricRateRow("normalized_answer_accuracy", summary.metrics.normalizedAnswerAccuracy, normalizedAnswerEvaluated.filter((row) => row.evaluation.normalizedAnswerMatch === true).length, normalizedAnswerEvaluated.length, "`expectedNormalizedValues` がある行だけを回答と根拠の正規化値で評価。"),
    metricRateRow("extraction_accuracy", summary.metrics.extractionAccuracy, extractionEvaluated.filter((row) => row.evaluation.extractionAccuracy === true).length, extractionEvaluated.length, "`expectedExtractionValues` がある行だけを diagnostics.extractions の正規化値で評価。"),
    metricNullableRow("count_mape", formatNumber(summary.metrics.countMape), summary.metrics.countMape, `${countEvaluated.length} rows with expectedCounts`, "`expectedCounts` がある行の平均 MAPE。"),
    metricRateRow("graph_resolution_accuracy", summary.metrics.graphResolutionAccuracy, graphResolutionEvaluated.filter((row) => row.evaluation.graphResolutionAccuracy === true).length, graphResolutionEvaluated.length, "`expectedGraphResolutions` がある行だけを diagnostics.graphResolutions で評価。"),
    metricRateRow("evidence_sufficiency_pass_rate", summary.metrics.evidenceSufficiencyPassRate, evidenceSufficiencyEvaluated.filter((row) => row.evaluation.evidenceSufficiencyPass === true).length, evidenceSufficiencyEvaluated.length, "`evidenceSufficiency` がある行だけを bbox / source priority / normalized value gate で評価。"),
    metricRateRow("retrieval_recall_at_k", summary.metrics.retrievalRecallAtK, retrievalRecallAtKEvaluated.filter((row) => row.evaluation.retrievalRecallAtK === true).length, retrievalRecallAtKEvaluated.length, "`expectedFiles` または `expectedDocumentIds` を raw retrieved の evaluator profile retrieval.recallK で評価。"),
    metricNullableRow("retrieval_mrr_at_k", formatNumber(summary.metrics.retrievalMrrAtK), summary.metrics.retrievalMrrAtK, `${retrievalMrrAtKEvaluated.length} rows with expectedFiles or expectedDocumentIds`, "`expectedFiles` または `expectedDocumentIds` を raw retrieved の evaluator profile retrieval.recallK 内の reciprocal rank で評価。"),
    metricRateRow("retrieval_recall_at_20", summary.metrics.retrievalRecallAt20, retrievalRecallAt20Evaluated.filter((row) => row.evaluation.retrievalRecallAt20 === true).length, retrievalRecallAt20Evaluated.length, "`expectedFiles` または `expectedDocumentIds` を raw retrieved の top 20 で評価する後方互換指標。"),
    metricRateRow("expected_page_hit_rate", summary.metrics.expectedPageHitRate, pageEvaluated.filter((row) => row.evaluation.expectedPageHit === true).length, pageEvaluated.length, "`expectedPages` があり、page metadata が観測できる行だけを citation/finalEvidence で評価。"),
    metricNullableRow("fact_slot_coverage", formatRate(summary.metrics.factSlotCoverage), summary.metrics.factSlotCoverage, `${factSlotEvaluated.length} rows with expectedFactSlots`, "`expectedFactSlots` がある行の平均 coverage。"),
    metricRateRow("citation_support_pass_rate", summary.metrics.citationSupportPassRate, citationSupportEvaluated.filter((row) => row.evaluation.citationSupportPass === true).length, citationSupportEvaluated.length, "answerSupport 出力がある行だけを評価。"),
    metricRateRow("refusal_precision", summary.metrics.refusalPrecision, refusedRows.filter((row) => !row.evaluation.expectedAnswerable).length, refusedRows.length, "実際に refusal した行のうち、期待値も unanswerable/refusal だった割合。0.0% は answer-only dataset での false positive を示す。"),
    metricRateRow("refusal_recall", summary.metrics.refusalRecall, unanswerableRows.filter((row) => row.evaluation.refused).length, unanswerableRows.length, "unanswerable 行がない場合は評価対象外。"),
    metricNullableRow("no_access_leak_count", formatNumber(summary.metrics.noAccessLeakCount), summary.metrics.noAccessLeakCount, `${noAccessLeakEvaluated.length} rows with forbiddenFiles or forbiddenDocumentIds`, "forbidden evidence が citation/retrieved に出た件数。0 が gate。"),
    metricRateRow("no_access_leak_rate", summary.metrics.noAccessLeakRate, noAccessLeakEvaluated.filter((row) => row.evaluation.noAccessLeak === true).length, noAccessLeakEvaluated.length, "forbidden evidence を指定した行だけを評価。"),
    metricNullableRow("unsupported_sentence_rate", formatRate(summary.metrics.unsupportedSentenceRate), summary.metrics.unsupportedSentenceRate, `${supportEvaluated.length} rows with answer support output`, "answer support 出力がある行だけを評価。"),
    metricNullableRow("avg_iterations", formatNumber(summary.metrics.avgIterations), summary.metrics.avgIterations, `${iterationRows.length} rows with evaluate_search_progress debug steps`, "debug steps がない場合は評価対象外。"),
    metricNullableRow("avg_retrieval_calls", formatNumber(summary.metrics.avgRetrievalCalls), summary.metrics.avgRetrievalCalls, `${retrievalCallRows.length} rows with execute_search_action debug steps`, "debug steps がない場合は評価対象外。"),
    metricNullableRow("avg_risk_signals", formatNumber(summary.metrics.avgRiskSignals), summary.metrics.avgRiskSignals, `${riskSignalRows.length} rows with retrieval_evaluator output`, "0 は評価対象行の risk signal count が 0 だったことを示す。"),
    metricRateRow("llm_judge_invocation_rate", summary.metrics.llmJudgeInvocationRate, llmJudgeEvaluated.length, results.length, "全行のうち LLM judge call が1回以上あった行の割合。0.0% は呼び出し行がなかったことを示す。"),
    metricRateRow("llm_judge_no_conflict_rate", summary.metrics.llmJudgeNoConflictRate, llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeNoConflictCount ?? 0), 0), llmJudgeCallCount, "LLM judge call がない場合は label rate を評価できない。"),
    metricRateRow("llm_judge_conflict_rate", summary.metrics.llmJudgeConflictRate, llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeConflictCount ?? 0), 0), llmJudgeCallCount, "LLM judge call がない場合は label rate を評価できない。"),
    metricRateRow("llm_judge_unclear_rate", summary.metrics.llmJudgeUnclearRate, llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeUnclearCount ?? 0), 0), llmJudgeCallCount, "LLM judge call がない場合は label rate を評価できない。"),
    metricRateRow("llm_judge_resolved_rate", summary.metrics.llmJudgeResolvedRate, llmJudgeEvaluated.filter((row) => row.evaluation.llmJudgeResolved === true).length, llmJudgeEvaluated.length, "LLM judge call がある行だけを評価。"),
    metricNullableRow("p50_latency_ms", formatNumber(summary.metrics.p50LatencyMs), summary.metrics.p50LatencyMs, `${results.length} rows`, "初回 API call latency の p50。"),
    metricNullableRow("p95_latency_ms", formatNumber(summary.metrics.p95LatencyMs), summary.metrics.p95LatencyMs, `${results.length} rows`, "初回 API call latency の p95。"),
    metricNullableRow("average_latency_ms", formatNumber(summary.metrics.averageLatencyMs), summary.metrics.averageLatencyMs, `${results.length} rows`, "初回 API call latency の平均。"),
    metricRateRow("async_provider_availability_accuracy", summary.metrics.asyncProviderAvailabilityAccuracy, asyncProviderAvailabilityRows.filter((row) => row.evaluation.asyncProviderAvailabilityCorrect === true).length, asyncProviderAvailabilityRows.length, "`expectedProviderAvailability` がある async_agent 行だけを評価。"),
    metricRateRow("async_status_accuracy", summary.metrics.asyncStatusAccuracy, asyncStatusRows.filter((row) => row.evaluation.asyncStatusCorrect === true).length, asyncStatusRows.length, "`expectedAsyncAgentStatus` がある async_agent 行だけを評価。"),
    metricRateRow("async_failure_reason_code_accuracy", summary.metrics.asyncFailureReasonCodeAccuracy, asyncFailureReasonRows.filter((row) => row.evaluation.asyncFailureReasonCodeCorrect === true).length, asyncFailureReasonRows.length, "`expectedFailureReasonCode` がある async_agent 行だけを評価。"),
    metricRateRow("async_no_mock_artifact_rate", summary.metrics.asyncNoMockArtifactRate, asyncNoMockArtifactRows.filter((row) => row.evaluation.asyncNoMockArtifacts === true).length, asyncNoMockArtifactRows.length, "not_configured / provider_unavailable / disabled 行、または `expectedNoArtifacts` 行で artifact が空である割合。"),
    metricRateRow("async_artifact_metadata_redaction_pass_rate", summary.metrics.asyncArtifactMetadataRedactionPassRate, asyncArtifactRedactionRows.filter((row) => row.evaluation.asyncArtifactMetadataRedacted === true).length, asyncArtifactRedactionRows.length, "`expectedArtifactMetadataRedacted` がある async_agent 行で artifact metadata と failure reason に secret-like pattern が残っていない割合。")
  ]
}

function metricRateRow(metric: BenchmarkReportMetricName, value: number | null, numerator: number, denominator: number, note: string): MetricReportRow {
  return {
    metric,
    value: formatRate(value),
    status: denominator === 0 ? "not_applicable" : "evaluated",
    basis: denominator === 0 ? "0 denominator" : `${numerator}/${denominator}`,
    note
  }
}

function metricNullableRow(metric: BenchmarkReportMetricName, value: string, rawValue: number | null, basis: string, note: string): MetricReportRow {
  return {
    metric,
    value,
    status: rawValue === null ? "not_applicable" : "evaluated",
    basis,
    note
  }
}

function inferExpectedAnswerable(row: DatasetRow, evaluatorProfile: EvaluatorProfile = suiteEvaluatorProfile): boolean {
  if (row.expectedResponseType === "clarification" || row.expectedClarification === true) return false
  if (row.expectedResponseType === "refusal") return false
  if (row.expectedResponseType === "answer") return true
  if (typeof row.answerable === "boolean") return row.answerable
  const expected = normalize(row.expected ?? row.expectedAnswer ?? "")
  if (!expected) return true
  return !isNoAnswerText(expected, evaluatorProfile)
}

function inferExpectedResponseType(row: DatasetRow, expectedAnswerable: boolean): RowEvaluation["expectedResponseType"] {
  if (row.expectedResponseType) return row.expectedResponseType
  if (row.expectedClarification === true) return "clarification"
  return expectedAnswerable ? "answer" : "refusal"
}

function inferActualResponseType(body: BenchmarkResponse): RowEvaluation["actualResponseType"] {
  if (body.responseType === "answer" || body.responseType === "refusal" || body.responseType === "clarification") return body.responseType
  if (body.needsClarification === true || body.clarification?.needsClarification === true) return "clarification"
  return body.isAnswerable ? "answer" : "refusal"
}

function isNoAnswerText(value: string, evaluatorProfile: EvaluatorProfile = suiteEvaluatorProfile): boolean {
  const normalized = normalize(value)
  return evaluatorProfile.answerMatching.noAnswerTexts.some((text) => normalized.includes(normalize(text)))
}

function hasExpectedFileHit(citations: Citation[], expectedFiles: string[]): boolean {
  return expectedFiles.some((expected) =>
    citations.some((citation) => normalize(citation.fileName ?? "").includes(normalize(expected)))
  )
}

function hasExpectedDocumentHit(citations: Citation[], expectedDocumentIds: string[]): boolean {
  return expectedDocumentIds.some((expected) =>
    citations.some((citation) => normalize(citation.documentId ?? "") === normalize(expected))
  )
}

function hasExpectedPageHit(citations: Citation[], expectedPages: string[]): boolean {
  const pagePatterns = expectedPages.flatMap((page) => {
    const escaped = escapeRegExp(page)
    const numeric = numericPage(page)
    return [
      new RegExp(`(?:^|[^0-9])p(?:age)?[_ -]?0*${escaped}(?:[^0-9]|$)`, "iu"),
      new RegExp(`(?:^|[^0-9])${escaped}\\s*(?:ページ|頁)(?:[^0-9]|$)`, "iu"),
      ...(numeric === null
        ? []
        : [
            new RegExp(`(?:^|[^0-9])p(?:age)?[_ -]?0*${numeric}(?:[^0-9]|$)`, "iu"),
            new RegExp(`(?:^|[^0-9])${numeric}\\s*(?:ページ|頁)(?:[^0-9]|$)`, "iu")
          ])
    ]
  })
  return citations.some((citation) => {
    if (expectedPages.some((page) => citationCoversPage(citation, page))) return true
    const haystack = [citation.chunkId, citation.fileName, citation.text].filter(Boolean).join("\n")
    return pagePatterns.some((pattern) => pattern.test(haystack))
  })
}

function hasObservablePageMetadata(citations: Citation[]): boolean {
  return citations.some((citation) => citationPageKeys(citation).length > 0)
}

function hasExpectedPageRecallAtK(citations: Citation[], expectedPages: string[], k: number): boolean {
  return hasExpectedPageHit(citations.slice(0, Math.max(1, Math.trunc(k))), expectedPages)
}

function hasExpectedRegionRecallAtK(citations: Citation[], expectedRegionIds: string[], k: number): boolean {
  const topK = citations.slice(0, Math.max(1, Math.trunc(k)))
  return expectedRegionIds.every((expected) =>
    topK.some((citation) => citationRegionKeys(citation).some((key) => normalize(key) === normalize(expected)))
  )
}

function citationRegionKeys(citation: Citation): string[] {
  const metadata = citation.metadata ?? {}
  return [
    citation.regionId,
    citation.regionType,
    stringMetadata(metadata.regionId),
    stringMetadata(metadata.drawingRegionId),
    stringMetadata(metadata.regionType),
    stringMetadata(metadata.expectedRegionId),
    citation.chunkId
  ].filter((value): value is string => Boolean(value))
}

function hasRetrievalRecallAtK(citations: Citation[], expectedFiles: string[], expectedDocumentIds: string[], k: number): boolean {
  const topK = citations.slice(0, Math.max(1, Math.trunc(k)))
  const fileHit = expectedFiles.length === 0 || hasExpectedFileHit(topK, expectedFiles)
  const documentHit = expectedDocumentIds.length === 0 || hasExpectedDocumentHit(topK, expectedDocumentIds)
  return fileHit && documentHit
}

function reciprocalRankAtK(citations: Citation[], expectedFiles: string[], expectedDocumentIds: string[], k: number): number {
  const topK = citations.slice(0, Math.max(1, Math.trunc(k)))
  const index = topK.findIndex(
    (citation) =>
      (expectedFiles.length > 0 && hasExpectedFileHit([citation], expectedFiles)) ||
      (expectedDocumentIds.length > 0 && hasExpectedDocumentHit([citation], expectedDocumentIds))
  )
  return index === -1 ? 0 : Number((1 / (index + 1)).toFixed(4))
}

function citationCoversPage(citation: Citation, expectedPage: string): boolean {
  if (citationPageKeys(citation).some((page) => normalize(page) === normalize(expectedPage))) return true
  const numeric = numericPage(expectedPage)
  if (numeric === null) return false
  const start = citation.pageStart
  const end = citation.pageEnd ?? start
  return typeof start === "number" && typeof end === "number" && numeric >= start && numeric <= end
}

function citationPageKeys(citation: Citation): string[] {
  const metadata = citation.metadata ?? {}
  return [
    citation.pageStart,
    citation.pageEnd,
    citation.pageOrSheet,
    citation.drawingNo,
    citation.sheetTitle,
    stringMetadata(metadata.pageStart),
    stringMetadata(metadata.pageEnd),
    stringMetadata(metadata.pageNumber),
    stringMetadata(metadata.pageNo),
    stringMetadata(metadata.page),
    stringMetadata(metadata.pageOrSheet),
    stringMetadata(metadata.sheetNo),
    stringMetadata(metadata.sheetNumber),
    stringMetadata(metadata.drawingNo)
  ].flatMap((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return [String(value)]
    if (typeof value === "string" && value.trim()) return [value]
    return []
  })
}

function numericPage(value: string): number | null {
  const match = value.normalize("NFKC").match(/\d+/u)
  if (!match) return null
  const page = Number(match[0])
  return Number.isInteger(page) && page > 0 ? page : null
}

function countForbiddenEvidence(citations: Citation[], forbiddenFiles: string[], forbiddenDocumentIds: string[]): number {
  const leaked = new Set<string>()
  for (const citation of citations) {
    const hit =
      (forbiddenFiles.length > 0 && hasExpectedFileHit([citation], forbiddenFiles)) ||
      (forbiddenDocumentIds.length > 0 && hasExpectedDocumentHit([citation], forbiddenDocumentIds))
    if (!hit) continue
    leaked.add([citation.documentId ?? "", citation.fileName ?? "", citation.chunkId ?? ""].join("\u0000"))
  }
  return leaked.size
}

function evaluateFactSlots(
  slots: ExpectedFactSlot[],
  answer: string,
  evidence: Citation[],
  expectedAnswerable: boolean
): { coverage: number | null; supported: number | null; total: number } {
  if (!expectedAnswerable || slots.length === 0) return { coverage: null, supported: null, total: slots.length }

  const supported = slots.filter((slot) => hasSupportedFactSlot(slot, answer, evidence)).length
  return {
    coverage: rate(supported, slots.length),
    supported,
    total: slots.length
  }
}

function hasSupportedFactSlot(slot: ExpectedFactSlot, answer: string, evidence: Citation[]): boolean {
  const mustContain = toArray(slot.mustContain)
  const answerHit = mustContain.every((expected) => normalize(answer).includes(normalize(expected)))
  if (!answerHit) return false

  const expectedFiles = toArray(slot.expectedFiles)
  const expectedDocumentIds = toArray(slot.expectedDocumentIds)
  if (expectedFiles.length > 0 && !hasExpectedFileHit(evidence, expectedFiles)) return false
  if (expectedDocumentIds.length > 0 && !hasExpectedDocumentHit(evidence, expectedDocumentIds)) return false

  const evidenceText = evidence.map((citation) => `${citation.fileName ?? ""}\n${citation.documentId ?? ""}\n${citation.text ?? ""}`).join("\n")
  return evidence.length > 0 && (mustContain.length === 0 || mustContain.every((expected) => normalize(evidenceText).includes(normalize(expected))))
}

function toNormalizedExpectedValues(values: ExpectedNormalizedValue[]): string[] {
  return values.map((value) => normalizeExpectedDrawingValue(value)).filter((value): value is string => Boolean(value))
}

function diagnosticExtractionsMatch(expectedValues: ExpectedNormalizedValue[], body: BenchmarkResponse): boolean {
  const expected = toNormalizedExpectedValues(expectedValues)
  if (expected.length === 0) return true
  const observed = new Set(
    diagnosticExtractions(body).flatMap((extraction) => [
      extraction.canonical,
      extraction.normalizedValue,
      extraction.raw ? normalizeExpectedDrawingValue({ raw: extraction.raw, kind: extraction.kind }) : null,
      extraction.value ? normalizeExpectedDrawingValue({ raw: extraction.value, kind: extraction.kind }) : null
    ]).filter((value): value is string => Boolean(value))
  )
  return expected.every((value) => observed.has(value))
}

function diagnosticCountMape(expectedCounts: ExpectedCount[], body: BenchmarkResponse): number | null {
  if (expectedCounts.length === 0) return null
  const actual = diagnosticCounts(body)
  const errors = expectedCounts.map((expected) => {
    const matched = actual.find((candidate) => diagnosticIdMatches(candidate, expected))
    const actualValue = matched?.value ?? matched?.count
    if (typeof actualValue !== "number" || !Number.isFinite(actualValue)) return 1
    if (expected.expected === 0) return actualValue === 0 ? 0 : 1
    return Math.abs(actualValue - expected.expected) / Math.abs(expected.expected)
  })
  return Number((errors.reduce((sum, value) => sum + value, 0) / errors.length).toFixed(4))
}

function diagnosticGraphResolutionsMatch(expectedResolutions: ExpectedGraphResolution[], body: BenchmarkResponse): boolean {
  if (expectedResolutions.length === 0) return true
  const actual = diagnosticGraphResolutions(body)
  return expectedResolutions.every((expected) =>
    actual.some((candidate) => {
      if (expected.id && candidate.id && normalize(expected.id) !== normalize(candidate.id)) return false
      const target = candidate.target ?? candidate.resolvedTarget
      return Boolean(expected.target && target && normalize(expected.target) === normalize(target))
    })
  )
}

function evaluateEvidenceSufficiency(
  expectation: EvidenceSufficiencyExpectation | undefined,
  evidence: Citation[],
  normalizedAnswerMatch: boolean | null,
  expectedAnswerable: boolean
): {
  pass: boolean | null
  bboxPresent: boolean | null
  sourcePriorityCorrect: boolean | null
  failureReasons: string[]
} {
  if (!expectedAnswerable || !expectation) {
    return { pass: null, bboxPresent: null, sourcePriorityCorrect: null, failureReasons: [] }
  }

  const failureReasons: string[] = []
  const requireBbox = expectation.requireBbox === true
  const bboxPresent = requireBbox ? evidence.some(hasEvidenceBbox) : null
  if (bboxPresent === false) failureReasons.push("missing_evidence_bbox")

  const expectedSourceTypes = toArray(expectation.expectedSourceTypes).map(normalize).filter(Boolean)
  const sourcePriorityCorrect =
    expectedSourceTypes.length === 0
      ? null
      : evidenceSourcePriorityMatches(evidence, expectedSourceTypes, expectation.sourcePriority)
  if (sourcePriorityCorrect === false) failureReasons.push("source_priority_mismatch")

  if (normalizedAnswerMatch === false) failureReasons.push("evidence_normalized_value_mismatch")

  const pass =
    bboxPresent === false || sourcePriorityCorrect === false || normalizedAnswerMatch === false
      ? false
      : bboxPresent !== null || sourcePriorityCorrect !== null || normalizedAnswerMatch !== null
        ? true
        : null

  return {
    pass,
    bboxPresent,
    sourcePriorityCorrect,
    failureReasons
  }
}

function evidenceSourcePriorityMatches(evidence: Citation[], expectedSourceTypes: string[], sourcePriority: string[] | undefined): boolean {
  const actualTypes = evidence.flatMap(evidenceSourceTypes).map(normalize).filter(Boolean)
  if (actualTypes.length === 0) return false
  const priority = (sourcePriority && sourcePriority.length > 0 ? sourcePriority : defaultDrawingSourcePriority).map(normalize)
  const ranked = actualTypes
    .map((type) => ({ type, rank: sourceTypeRank(type, priority) }))
    .sort((left, right) => left.rank - right.rank)
  const best = ranked[0]?.type
  if (!best) return false
  return expectedSourceTypes.includes(best)
}

const defaultDrawingSourcePriority = [
  "project_drawing",
  "standard_detail",
  "equipment_standard",
  "benchmark_reference",
  "external"
]

function sourceTypeRank(sourceType: string, sourcePriority: string[]): number {
  const index = sourcePriority.indexOf(sourceType)
  return index === -1 ? sourcePriority.length : index
}

function evidenceSourceTypes(citation: Citation): string[] {
  const metadata = citation.metadata ?? {}
  return [
    citation.sourceType,
    stringMetadata(metadata.sourceType),
    stringMetadata(metadata.source_type),
    stringMetadata(metadata.drawingSourceType),
    stringMetadata(metadata.docType)
  ].filter((value): value is string => Boolean(value))
}

function hasEvidenceBbox(citation: Citation): boolean {
  const metadata = citation.metadata ?? {}
  const candidates = [
    citation.bbox,
    metadata.bbox,
    metadata.boundingBox,
    metadata.regionBbox,
    metadata.region_bbox,
    metadata.polygon
  ]
  return candidates.some((candidate) => {
    if (Array.isArray(candidate)) return candidate.length >= 4
    if (!isRecord(candidate)) return false
    return (
      ("x" in candidate && "y" in candidate && ("width" in candidate || "w" in candidate) && ("height" in candidate || "h" in candidate)) ||
      ("left" in candidate && "top" in candidate && ("width" in candidate || "right" in candidate) && ("height" in candidate || "bottom" in candidate))
    )
  })
}

function diagnosticExtractions(body: BenchmarkResponse): DiagnosticExtraction[] {
  const debug = body.debug as { drawingDiagnostics?: { extractions?: DiagnosticExtraction[] } } | undefined
  return [...(body.diagnostics?.extractions ?? []), ...(debug?.drawingDiagnostics?.extractions ?? [])]
}

function diagnosticCounts(body: BenchmarkResponse): DiagnosticCount[] {
  const debug = body.debug as { drawingDiagnostics?: { counts?: DiagnosticCount[] } } | undefined
  return [...(body.diagnostics?.counts ?? []), ...(debug?.drawingDiagnostics?.counts ?? [])]
}

function diagnosticGraphResolutions(body: BenchmarkResponse): DiagnosticGraphResolution[] {
  const debug = body.debug as { drawingDiagnostics?: { graphResolutions?: DiagnosticGraphResolution[] } } | undefined
  return [...(body.diagnostics?.graphResolutions ?? []), ...(debug?.drawingDiagnostics?.graphResolutions ?? [])]
}

function diagnosticIdMatches(candidate: { id?: string; label?: string }, expected: { id?: string; label?: string }): boolean {
  if (expected.id) return normalize(candidate.id ?? "") === normalize(expected.id)
  if (expected.label) return normalize(candidate.label ?? "") === normalize(expected.label)
  return false
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function evaluateUnsupportedSentences(body: BenchmarkResponse): {
  rate: number | null
  unsupported: number | null
  total: number | null
} {
  const support = body.answerSupport ?? extractAnswerSupportFromDebug(body)
  if (!support) return { rate: null, unsupported: null, total: null }

  const unsupported = support.unsupportedSentences?.length ?? 0
  const total = support.totalSentences ?? splitSentences(body.answer ?? "").length
  return {
    rate: total === 0 ? null : rate(unsupported, total),
    unsupported,
    total: total === 0 ? null : total
  }
}

function evaluateRetrievalJudge(body: BenchmarkResponse): {
  riskSignalCount: number | null
  llmJudgeCount: number | null
  noConflictCount: number | null
  conflictCount: number | null
  unclearCount: number | null
  resolved: boolean | null
} {
  const evaluations = extractRetrievalEvaluationsFromDebug(body)
  if (evaluations.length === 0) {
    return {
      riskSignalCount: null,
      llmJudgeCount: null,
      noConflictCount: null,
      conflictCount: null,
      unclearCount: null,
      resolved: null
    }
  }

  const labels = evaluations.map((evaluation) => evaluation.llmJudge?.label).filter((label): label is RetrievalJudgeLabel => Boolean(label))
  const noConflictCount = labels.filter((label) => label === "NO_CONFLICT").length
  const conflictCount = labels.filter((label) => label === "CONFLICT").length
  const unclearCount = labels.filter((label) => label === "UNCLEAR").length
  const resolved =
    labels.length === 0
      ? null
      : evaluations.some(
          (evaluation) =>
            evaluation.llmJudge?.label === "NO_CONFLICT" &&
            evaluation.conflictingFactIds.length === 0 &&
            evaluation.retrievalQuality === "sufficient"
        )

  return {
    riskSignalCount: evaluations.reduce((sum, evaluation) => sum + evaluation.riskSignalCount, 0),
    llmJudgeCount: labels.length,
    noConflictCount,
    conflictCount,
    unclearCount,
    resolved
  }
}

type RetrievalJudgeLabel = "CONFLICT" | "NO_CONFLICT" | "UNCLEAR"

type RetrievalEvaluationDebug = {
  retrievalQuality?: string
  conflictingFactIds: string[]
  riskSignalCount: number
  llmJudge?: {
    label: RetrievalJudgeLabel
  }
}

function extractRetrievalEvaluationsFromDebug(body: BenchmarkResponse): RetrievalEvaluationDebug[] {
  const steps = body.debug?.steps?.filter((step) => step.label === "retrieval_evaluator") ?? []
  return steps.flatMap((step) => {
    const output = step.output?.retrievalEvaluation
    if (!isRecord(output)) return []
    return [parseRetrievalEvaluation(output)]
  })
}

function parseRetrievalEvaluation(value: Record<string, unknown>): RetrievalEvaluationDebug {
  const riskSignals = Array.isArray(value.riskSignals) ? value.riskSignals : []
  const conflictingFactIds = Array.isArray(value.conflictingFactIds)
    ? value.conflictingFactIds.filter((id): id is string => typeof id === "string")
    : []
  const llmJudge = isRecord(value.llmJudge) && isRetrievalJudgeLabel(value.llmJudge.label) ? { label: value.llmJudge.label } : undefined
  return {
    retrievalQuality: typeof value.retrievalQuality === "string" ? value.retrievalQuality : undefined,
    conflictingFactIds,
    riskSignalCount: riskSignals.length,
    llmJudge
  }
}

function extractAnswerSupportFromDebug(body: BenchmarkResponse): BenchmarkResponse["answerSupport"] | undefined {
  const step = body.debug?.steps?.find((candidate) => candidate.label === "verify_answer_support")
  if (!step?.detail) return undefined
  const parsed = parseJsonObject(step.detail)
  if (!parsed || typeof parsed !== "object") return undefined
  const unsupportedSentences = Array.isArray(parsed.unsupportedSentences)
    ? parsed.unsupportedSentences.filter((sentence): sentence is { sentence?: string; reason?: string } => typeof sentence === "object")
    : undefined
  const totalSentences = typeof parsed.totalSentences === "number" ? parsed.totalSentences : undefined
  return { unsupportedSentences, totalSentences }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isRetrievalJudgeLabel(value: unknown): value is RetrievalJudgeLabel {
  return value === "CONFLICT" || value === "NO_CONFLICT" || value === "UNCLEAR"
}

function parseJsonObject(value: string): Record<string, unknown> | undefined {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return undefined
  try {
    return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function countDebugSteps(body: BenchmarkResponse, label: string): number | null {
  if (!body.debug?.steps) return null
  return body.debug.steps.filter((step) => step.label === label).length
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[。.!?！？])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase()
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Number((numerator / denominator).toFixed(4))
}

function f1(precision: number | null, recall: number | null): number | null {
  if (precision === null || recall === null || precision + recall === 0) return null
  return Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
}

function latencyDelta(current: BenchmarkResultRow[], baseline: BenchmarkResultRow[]): number | null {
  if (current.length === 0 || baseline.length === 0) return null
  return Math.round((current.reduce((sum, row) => sum + row.latencyMs, 0) / current.length) - (baseline.reduce((sum, row) => sum + row.latencyMs, 0) / baseline.length))
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
}

function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) return null
  const index = Math.ceil(sortedValues.length * p) - 1
  return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, index))] ?? null
}

function formatRate(value: number | null): string {
  if (value === null) return "not_applicable"
  return `${(value * 100).toFixed(1)}%`
}

function formatNumber(value: number | null): string {
  return value === null ? "not_applicable" : String(value)
}

function formatClarificationSummary(evaluation: RowEvaluation): string {
  if (evaluation.expectedResponseType !== "clarification" && evaluation.actualResponseType !== "clarification") return "not_applicable"
  return escapeMarkdown(
    [
      `need=${evaluation.clarificationNeededCorrect === null ? "not_specified" : evaluation.clarificationNeededCorrect ? "ok" : "ng"}`,
      `option=${evaluation.optionHit === null ? "not_applicable" : evaluation.optionHit ? "hit" : "miss"}`,
      `slot=${evaluation.missingSlotHit === null ? "not_applicable" : evaluation.missingSlotHit ? "hit" : "miss"}`,
      `grounded=${evaluation.corpusGroundedOptions === null ? "not_applicable" : evaluation.corpusGroundedOptions ? "yes" : "no"}`
    ].join(", ")
  )
}

function formatLlmJudgeSummary(evaluation: RowEvaluation): string {
  if ((evaluation.llmJudgeCount ?? 0) === 0) return "not_applicable"
  const parts = [
    `calls=${evaluation.llmJudgeCount}`,
    `no_conflict=${evaluation.llmJudgeNoConflictCount ?? 0}`,
    `conflict=${evaluation.llmJudgeConflictCount ?? 0}`,
    `unclear=${evaluation.llmJudgeUnclearCount ?? 0}`,
    `resolved=${evaluation.llmJudgeResolved === null ? "not_applicable" : evaluation.llmJudgeResolved ? "yes" : "no"}`
  ]
  return escapeMarkdown(parts.join(", "))
}

function formatBoolean(value: boolean | null): string {
  if (value === null) return "not_applicable"
  return value ? "pass" : "fail"
}

function rowCategory(row: Pick<BenchmarkResultRow, "metadata" | "complexity" | "unanswerableType">): string {
  const category = row.metadata?.evaluationCategory ?? row.metadata?.category
  if (typeof category === "string" && category.trim()) return category.trim()
  return row.complexity ?? row.unanswerableType ?? ""
}

function classifyFailureCategories(reasons: string[]): FailureCategory[] {
  const categories = new Set<FailureCategory>()
  for (const reason of reasons) {
    if (/retrieval|expected_file|expected_document/i.test(reason)) categories.add("search_failure")
    else if (/expected_page|missing_citation|missing_evidence_bbox|source_priority/i.test(reason)) categories.add("extraction_failure")
    else if (/fact_slot|chunk/i.test(reason)) categories.add("chunk_failure")
    else if (/refus|unsupported_answer|expected_answer_but_refused|expected_refusal_but_answered|no_access_leak/i.test(reason)) categories.add("refusal_failure")
    else categories.add("generation_failure")
  }
  return [...categories].sort()
}

function diagnosticFailureBreakdown(results: BenchmarkResultRow[]): Record<DiagnosticFailureCategory, number> {
  const counts: Record<DiagnosticFailureCategory, number> = {
    retrieval: 0,
    ocr: 0,
    grounding: 0,
    reasoning: 0,
    abstention: 0
  }
  for (const row of results) {
    const categories = new Set(row.evaluation.failureReasons.flatMap(diagnosticFailureCategoriesFor))
    for (const category of categories) counts[category] += 1
  }
  return counts
}

function diagnosticFailureCategoriesFor(reason: string): DiagnosticFailureCategory[] {
  if (/retrieval|expected_file|expected_document/i.test(reason)) return ["retrieval"]
  if (/extraction_accuracy|normalized_answer|evidence_normalized/i.test(reason)) return ["ocr"]
  if (/expected_page|region_recall|missing_citation|citation_support|unsupported_sentence|fact_slot|missing_evidence_bbox|source_priority/i.test(reason)) return ["grounding"]
  if (/refus|unsupported_answer|expected_answer_but_refused|expected_refusal_but_answered|no_access_leak/i.test(reason)) return ["abstention"]
  if (/count_mape|graph_resolution|answer_missing|regex|query_rewrite|clarification/i.test(reason)) return ["reasoning"]
  return ["reasoning"]
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function safeRegexTest(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, "iu").test(value)
  } catch {
    return false
  }
}

async function closeStream(stream: NodeJS.WritableStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.once("finish", resolve)
    stream.once("error", reject)
    stream.end()
  })
}

function resolveExistingPath(input: string, bases: string[]): string {
  if (path.isAbsolute(input)) return input
  for (const base of bases) {
    const candidate = path.resolve(base, input)
    if (existsSync(candidate)) return candidate
  }
  return path.resolve(process.cwd(), input)
}

function resolveOutputPath(input: string): string {
  if (path.isAbsolute(input)) return input
  return path.resolve(repoRoot, input)
}
