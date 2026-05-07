import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"
import { benchmarkCorpusDirFromEnv, benchmarkCorpusSkipMemoryFromEnv, seedBenchmarkCorpus, type SeededDocument } from "./corpus.js"
import { createSkippedDatasetRow, skippedCorpusFileNameSet, skippedExpectedFileNames, type SkippedDatasetRow } from "./skipped-corpus.js"
import { createQualityReview, type QualityReview } from "./metrics/quality.js"
import {
  assertComparableProfiles,
  assertSuiteEvaluatorProfile,
  profileKey,
  resolveEvaluatorProfile,
  type EvaluatorProfile
} from "./evaluator-profile.js"

type DatasetRow = {
  id?: string
  question: string
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
  expectedFactSlots?: ExpectedFactSlot[]
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

type Citation = {
  documentId?: string
  fileName?: string
  chunkId?: string
  score?: number
  text?: string
}

type BenchmarkResponse = {
  id?: string
  responseType?: "answer" | "refusal" | "clarification"
  answer?: string
  isAnswerable?: boolean
  needsClarification?: boolean
  clarification?: {
    needsClarification?: boolean
    reason?: string
    question?: string
    options?: Array<{
      id?: string
      label?: string
      resolvedQuery?: string
      source?: string
      grounding?: Array<{ documentId?: string; fileName?: string; chunkId?: string; heading?: string }>
    }>
    missingSlots?: string[]
    confidence?: number
    ambiguityScore?: number
  }
  citations?: Citation[]
  retrieved?: Citation[]
  debug?: {
    runId?: string
    totalLatencyMs?: number
    steps?: Array<{ label: string; latencyMs: number; status: string; summary?: string; detail?: string; output?: Record<string, unknown> }>
  }
  answerSupport?: {
    unsupportedSentences?: Array<{ sentence?: string; reason?: string }>
    totalSentences?: number
  }
  error?: string
}

type ClarificationResponseOption = NonNullable<NonNullable<BenchmarkResponse["clarification"]>["options"]>[number]

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
  answerContainsExpected: boolean | null
  regexMatched: boolean | null
  answerCorrect: boolean
  abstentionCorrect: boolean | null
  unsupportedAnswer: boolean
  citationHit: boolean | null
  expectedFileHit: boolean | null
  expectedPageHit: boolean | null
  retrievalRecallAtK: boolean | null
  retrievalRecallAt20: boolean | null
  factSlotCoverage: number | null
  supportedFactSlots: number | null
  totalFactSlots: number
  unsupportedSentenceRate: number | null
  unsupportedSentenceCount: number | null
  totalSentenceCount: number | null
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
}

type BenchmarkResultRow = {
  id?: string
  question: string
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
  result: BenchmarkResponse
}

type Summary = {
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
    overClarificationRate: number | null
    clarificationLatencyOverheadMs: number | null
    postClarificationTaskLatencyMs: number | null
    abstentionRecall: number | null
    unsupportedAnswerRate: number | null
    answerContainsRate: number | null
    citationHitRate: number | null
    expectedFileHitRate: number | null
    retrievalRecallAtK: number | null
    retrievalRecallAt20: number | null
    expectedPageHitRate: number | null
    factSlotCoverage: number | null
    refusalPrecision: number | null
    refusalRecall: number | null
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
  }
  failures: Array<{
    id?: string
    question: string
    reasons: string[]
    expectedContains?: string | string[]
    expectedAnswer?: string
    expected?: string
    answerPreview: string
  }>
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

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const apiAuthToken = process.env.API_AUTH_TOKEN
const defaultModelId = process.env.MODEL_ID ?? "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = process.env.EMBEDDING_MODEL_ID?.trim() || undefined
const benchmarkSuiteId = process.env.BENCHMARK_SUITE_ID ?? "standard-agent-v1"
const benchmarkCorpusSuiteId = process.env.BENCHMARK_CORPUS_SUITE_ID ?? benchmarkSuiteId
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

const corpusSeed = await seedBenchmarkCorpus({
  apiBaseUrl,
  authToken: apiAuthToken,
  corpusDir: resolvedBenchmarkCorpusDir,
  suiteId: benchmarkCorpusSuiteId,
  skipMemory: benchmarkCorpusSkipMemoryFromEnv(process.env),
  embeddingModelId: defaultEmbeddingModelId,
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
for await (const line of rl) {
  if (!line.trim()) continue
  const row = JSON.parse(line) as DatasetRow
  const skippedFiles = skippedExpectedFileNames(row, skippedCorpusFiles)
  if (skippedFiles.length > 0) {
    skippedRows.push(createSkippedDatasetRow(row, skippedFiles))
    console.log(`Benchmark row skipped: ${row.id ?? row.question} (required corpus skipped: ${skippedFiles.join(", ")})`)
    continue
  }
  const rowEvaluatorProfile = resolveEvaluatorProfile(row.evaluatorProfile ?? profileKey(suiteEvaluatorProfile))
  assertSuiteEvaluatorProfile(rowEvaluatorProfile, suiteEvaluatorProfile, row.id ?? row.question)
  const firstStartedAt = Date.now()
  const { status, body } = await runQuery(row)
  const initialLatencyMs = Date.now() - firstStartedAt
  const followUp = await runFollowUp(row, body)
  const result: BenchmarkResultRow = {
    id: row.id,
    question: row.question,
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
    evaluation: evaluateRow(row, body, status, followUp, rowEvaluatorProfile),
    evaluatorProfile: profileKey(rowEvaluatorProfile),
    metadata: row.metadata,
    result: body
  }
  out.write(`${JSON.stringify(result)}\n`)
  results.push(result)
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

async function runQuery(row: DatasetRow): Promise<{ status: number; body: BenchmarkResponse }> {
  return runQueryRequest({
    id: row.id,
    question: row.question,
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
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
}): Promise<{ status: number; body: BenchmarkResponse }> {
  try {
    const response = await fetch(`${apiBaseUrl}/benchmark/query`, {
      method: "POST",
      headers: createRequestHeaders(),
      body: JSON.stringify({
        id: input.id,
        question: input.question,
        clarificationContext: input.clarificationContext,
        modelId: input.modelId ?? defaultModelId,
        embeddingModelId: input.embeddingModelId,
        clueModelId: input.clueModelId,
        topK: input.topK,
        memoryTopK: input.memoryTopK,
        minScore: input.minScore,
        strictGrounded: input.strictGrounded,
        useMemory: input.useMemory,
        includeDebug: true
      })
    })
    const text = await response.text()
    const body = text ? (JSON.parse(text) as BenchmarkResponse) : { error: "Empty response body" }
    return { status: response.status, body }
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

function createRequestHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(apiAuthToken ? { Authorization: `Bearer ${apiAuthToken}` } : {})
  }
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
  const expectedContains = toArray(row.expectedContains ?? row.expectedAnswer ?? (expectedAnswerable ? row.expected : undefined))
  const expectedRegex = toArray(row.expectedRegex)
  const expectedFiles = toArray(row.expectedFiles ?? row.expectedFileNames)
  const expectedDocumentIds = toArray(row.expectedDocumentIds)
  const expectedPages = toArray(row.expectedPages).map(String)
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
    expectedFiles.length > 0 ? hasExpectedFileHit([...citations, ...retrieved], expectedFiles) : null
  if (expectedFileHit === false) failureReasons.push("expected_file_not_hit")

  const expectedDocumentHit =
    expectedDocumentIds.length > 0 ? hasExpectedDocumentHit([...citations, ...retrieved], expectedDocumentIds) : null
  if (expectedDocumentHit === false) failureReasons.push("expected_document_not_hit")

  const expectedPageHit =
    expectedPages.length > 0 ? hasExpectedPageHit([...citations, ...retrieved], expectedPages) : null
  if (expectedPageHit === false) failureReasons.push("expected_page_not_hit")

  const retrievalRecallAtK =
    expectedFiles.length > 0 || expectedDocumentIds.length > 0
      ? hasRetrievalRecallAtK([...retrieved, ...citations], expectedFiles, expectedDocumentIds, evaluatorProfile.retrieval.recallK)
      : null
  if (retrievalRecallAtK === false) failureReasons.push(`retrieval_recall_at_${evaluatorProfile.retrieval.recallK}_miss`)
  const retrievalRecallAt20 =
    expectedFiles.length > 0 || expectedDocumentIds.length > 0
      ? hasRetrievalRecallAtK([...retrieved, ...citations], expectedFiles, expectedDocumentIds, 20)
      : null

  const factSlotResult = evaluateFactSlots(row.expectedFactSlots ?? [], answer, [...citations, ...retrieved], expectedAnswerable)
  if (factSlotResult.coverage !== null && factSlotResult.coverage < 1) failureReasons.push("fact_slot_not_covered")

  const supportResult = evaluateUnsupportedSentences(body)
  if (supportResult.rate !== null && supportResult.rate > 0) failureReasons.push("unsupported_sentence_detected")
  const retrievalJudgeResult = evaluateRetrievalJudge(body)

  if (status < 200 || status >= 300) failureReasons.push(`http_${status}`)

  const answerCorrect =
    expectedAnswerable &&
    answerabilityCorrect &&
    answerContainsExpected !== false &&
    regexMatched !== false &&
    citationHit !== false &&
    expectedFileHit !== false &&
    expectedDocumentHit !== false &&
    expectedPageHit !== false &&
    status >= 200 &&
    status < 300

  const abstentionCorrect = expectedAnswerable ? null : !actualAnswerable || isNoAnswerText(answer, evaluatorProfile)
  if (abstentionCorrect === false) failureReasons.push("unsupported_answer")

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
    answerContainsExpected,
    regexMatched,
    answerCorrect,
    abstentionCorrect,
    unsupportedAnswer: !expectedAnswerable && actualAnswerable && !isNoAnswerText(answer, evaluatorProfile),
    citationHit,
    expectedFileHit: expectedFileHit ?? expectedDocumentHit,
    expectedPageHit,
    retrievalRecallAtK,
    retrievalRecallAt20,
    factSlotCoverage: factSlotResult.coverage,
    supportedFactSlots: factSlotResult.supported,
    totalFactSlots: factSlotResult.total,
    unsupportedSentenceRate: supportResult.rate,
    unsupportedSentenceCount: supportResult.unsupported,
    totalSentenceCount: supportResult.total,
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
    failureReasons
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
  const retrieved = body.retrieved ?? []
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
      ? hasRetrievalRecallAtK([...citations, ...retrieved], expectedFiles, expectedDocumentIds, evaluatorProfile.retrieval.recallK)
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
  const postClarificationTaskLatencies = postClarificationRows
    .filter((row) => row.followUp)
    .map((row) => row.taskLatencyMs)
  const latencies = results.map((row) => row.latencyMs).sort((a, b) => a - b)
  const citationEvaluated = results.filter((row) => row.evaluation.citationHit !== null)
  const fileEvaluated = results.filter((row) => row.evaluation.expectedFileHit !== null)
  const retrievalRecallAtKEvaluated = results.filter((row) => row.evaluation.retrievalRecallAtK !== null)
  const retrievalRecallAt20Evaluated = results.filter((row) => row.evaluation.retrievalRecallAt20 !== null)
  const pageEvaluated = results.filter((row) => row.evaluation.expectedPageHit !== null)
  const containsEvaluated = results.filter((row) => row.evaluation.answerContainsExpected !== null)
  const factSlotEvaluated = results.filter((row) => row.evaluation.factSlotCoverage !== null)
  const supportEvaluated = results.filter((row) => row.evaluation.unsupportedSentenceRate !== null)
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

  const summary = {
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
      unsupportedAnswerRate: rate(
        unanswerableRows.filter((row) => row.evaluation.unsupportedAnswer).length,
        unanswerableRows.length
      ),
      answerContainsRate: rate(
        containsEvaluated.filter((row) => row.evaluation.answerContainsExpected === true).length,
        containsEvaluated.length
      ),
      citationHitRate: rate(
        citationEvaluated.filter((row) => row.evaluation.citationHit === true).length,
        citationEvaluated.length
      ),
      expectedFileHitRate: rate(
        fileEvaluated.filter((row) => row.evaluation.expectedFileHit === true).length,
        fileEvaluated.length
      ),
      retrievalRecallAtK: rate(
        retrievalRecallAtKEvaluated.filter((row) => row.evaluation.retrievalRecallAtK === true).length,
        retrievalRecallAtKEvaluated.length
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
      refusalPrecision: rate(
        refusedRows.filter((row) => !row.evaluation.expectedAnswerable).length,
        refusedRows.length
      ),
      refusalRecall: rate(
        unanswerableRows.filter((row) => row.evaluation.refused).length,
        unanswerableRows.length
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
      averageLatencyMs: results.length === 0 ? null : Math.round(results.reduce((sum, row) => sum + row.latencyMs, 0) / results.length)
    },
    failures: results
      .filter((row) => row.evaluation.failureReasons.length > 0)
      .map((row) => ({
        id: row.id,
        question: row.question,
        reasons: row.evaluation.failureReasons,
        expectedContains: row.expectedContains,
        expectedAnswer: row.expectedAnswer,
        expected: row.expected,
        answerPreview: (row.result.answer ?? row.result.error ?? "").slice(0, 180)
      }))
  }
  return {
    ...summary,
    qualityReview: createQualityReview({
      current: summary.metrics,
      baseline: baselineSummary?.metrics,
      thresholds: suiteEvaluatorProfile.thresholds,
      failures: summary.failures
    })
  }
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
  | "over_clarification_rate"
  | "clarification_latency_delta_vs_non_clarification_ms"
  | "post_clarification_task_latency_ms"
  | "abstention_recall"
  | "unsupported_answer_rate"
  | "answer_contains_rate"
  | "citation_hit_rate"
  | "expected_file_hit_rate"
  | "retrieval_recall_at_k"
  | "retrieval_recall_at_20"
  | "expected_page_hit_rate"
  | "fact_slot_coverage"
  | "refusal_precision"
  | "refusal_recall"
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
        "| id | question | reasons | answer preview |",
        "| --- | --- | --- | --- |",
        ...summary.failures.map((failure) =>
          `| ${escapeMarkdown(failure.id ?? "")} | ${escapeMarkdown(failure.question)} | ${escapeMarkdown(failure.reasons.join(", "))} | ${escapeMarkdown(failure.answerPreview)} |`
        )
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

  const detailRows = [
    "| id | expected | actual | fact_slots | clarification | iterations | retrieval_calls | risk_signals | llm_judge | latency_ms | task_latency_ms | citations | retrieved | result |",
    "| --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |",
    ...results.map((row) => {
      const passed = row.evaluation.failureReasons.length === 0 ? "pass" : row.evaluation.failureReasons.join(", ")
      return `| ${escapeMarkdown(row.id ?? "")} | ${row.evaluation.expectedResponseType} | ${row.evaluation.actualResponseType} | ${formatRate(row.evaluation.factSlotCoverage)} | ${formatClarificationSummary(row.evaluation)} | ${formatNumber(row.evaluation.iterationCount)} | ${formatNumber(row.evaluation.retrievalCallCount)} | ${formatNumber(row.evaluation.riskSignalCount)} | ${formatLlmJudgeSummary(row.evaluation)} | ${row.latencyMs} | ${row.taskLatencyMs} | ${row.evaluation.citationCount} | ${row.evaluation.retrievedCount} | ${escapeMarkdown(passed)} |`
    })
  ].join("\n")

  return `# MemoRAG Benchmark Report

- Generated at: ${summary.generatedAt}
- API base URL: ${summary.apiBaseUrl}
- Dataset: ${summary.datasetPath}
- Raw results: ${summary.outputPath}
- Summary JSON: ${summary.summaryPath}
- Evaluator profile: ${profileKey(summary.evaluatorProfile)}
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

## Skipped Rows

${skippedRowRows}

## Row Details

${detailRows}
`
}

function metricDescription(metric: BenchmarkReportMetricName): string {
  switch (metric) {
    case "answerable_accuracy":
      return "回答可能な行で、期待語句・正規表現・引用・期待資料などの判定をすべて満たした割合。"
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
    case "over_clarification_rate":
      return "明確に回答すべき行で、不要な確認質問を返した割合。低いほどよい。"
    case "clarification_latency_delta_vs_non_clarification_ms":
      return "確認質問を返した行の初回 latency と、それ以外の行の初回 latency の平均差。"
    case "post_clarification_task_latency_ms":
      return "確認質問の初回応答から follow-up 完了までを含めた task latency の平均。"
    case "abstention_recall":
      return "回答不能な行のうち、回答せず拒否できた割合。"
    case "unsupported_answer_rate":
      return "回答不能な行で、根拠なしに回答してしまった割合。低いほどよい。"
    case "answer_contains_rate":
      return "回答可能な行で、期待語句または期待回答文字列を回答に含められた割合。"
    case "citation_hit_rate":
      return "回答可能な行で、少なくとも 1 件の citation を返した割合。"
    case "expected_file_hit_rate":
      return "期待ファイルまたは期待 document が citation/retrieved に含まれた割合。"
    case "retrieval_recall_at_k":
      return "evaluator profile の retrieval.recallK で期待ファイルまたは期待 document が含まれた割合。"
    case "retrieval_recall_at_20":
      return "上位 20 件の retrieved/citation に期待ファイルまたは期待 document が含まれた割合。"
    case "expected_page_hit_rate":
      return "期待 page が citation/retrieved に含まれた割合。"
    case "fact_slot_coverage":
      return "dataset の expectedFactSlots のうち、回答文または取得根拠で支持できた fact slot の平均割合。"
    case "refusal_precision":
      return "拒否した行のうち、dataset 上も回答不能だった割合。高いほど誤拒否が少ない。"
    case "refusal_recall":
      return "回答不能な行のうち、実際に拒否できた割合。"
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
  }
}

function buildCoverageReportRows(results: BenchmarkResultRow[]): CoverageReportRow[] {
  const expectedClarificationRows = results.filter((row) => row.evaluation.expectedResponseType === "clarification")
  const expectedAnswerRows = results.filter((row) => row.evaluation.expectedResponseType === "answer")
  const expectedUnanswerableRows = results.filter((row) => !row.evaluation.expectedAnswerable)
  const actualClarificationRows = results.filter((row) => row.evaluation.actualResponseType === "clarification")
  const refusedRows = results.filter((row) => row.evaluation.refused)
  const llmJudgeEvaluated = results.filter((row) => (row.evaluation.llmJudgeCount ?? 0) > 0)
  const llmJudgeCallCount = llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeCount ?? 0), 0)
  return [
    { item: "expected_answer_rows", count: expectedAnswerRows.length, note: "answerable / normal QA denominator" },
    { item: "expected_clarification_rows", count: expectedClarificationRows.length, note: "clarification recall and F1 denominator" },
    { item: "expected_unanswerable_rows", count: expectedUnanswerableRows.length, note: "abstention / refusal recall denominator" },
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
      item: "rows_with_expected_pages",
      count: results.filter((row) => row.evaluation.expectedPageHit !== null).length,
      note: "expected_page_hit_rate denominator"
    },
    {
      item: "rows_with_expected_fact_slots",
      count: results.filter((row) => row.evaluation.factSlotCoverage !== null).length,
      note: "fact_slot_coverage denominator"
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
  const postClarificationTaskLatencies = postClarificationRows.filter((row) => row.followUp)
  const containsEvaluated = results.filter((row) => row.evaluation.answerContainsExpected !== null)
  const citationEvaluated = results.filter((row) => row.evaluation.citationHit !== null)
  const fileEvaluated = results.filter((row) => row.evaluation.expectedFileHit !== null)
  const retrievalRecallAtKEvaluated = results.filter((row) => row.evaluation.retrievalRecallAtK !== null)
  const retrievalRecallAt20Evaluated = results.filter((row) => row.evaluation.retrievalRecallAt20 !== null)
  const pageEvaluated = results.filter((row) => row.evaluation.expectedPageHit !== null)
  const factSlotEvaluated = results.filter((row) => row.evaluation.factSlotCoverage !== null)
  const supportEvaluated = results.filter((row) => row.evaluation.unsupportedSentenceRate !== null)
  const refusedRows = results.filter((row) => row.evaluation.refused)
  const iterationRows = results.filter((row) => row.evaluation.iterationCount !== null)
  const retrievalCallRows = results.filter((row) => row.evaluation.retrievalCallCount !== null)
  const riskSignalRows = results.filter((row) => row.evaluation.riskSignalCount !== null)
  const llmJudgeEvaluated = results.filter((row) => (row.evaluation.llmJudgeCount ?? 0) > 0)
  const llmJudgeCallCount = llmJudgeEvaluated.reduce((sum, row) => sum + (row.evaluation.llmJudgeCount ?? 0), 0)
  const nonClarificationRows = results.filter((row) => row.evaluation.actualResponseType !== "clarification")

  return [
    metricRateRow("answerable_accuracy", summary.metrics.answerableAccuracy, answerableRows.filter((row) => row.evaluation.answerCorrect).length, answerableRows.length, "通常QAの正答率。answerable rows が分母。"),
    metricRateRow("clarification_need_precision", summary.metrics.clarificationNeedPrecision, clarificationActualRows.filter((row) => row.evaluation.expectedResponseType === "clarification").length, clarificationActualRows.length, "実際に clarification を返した行のうち、期待値も clarification だった割合。0.0% は false positive の存在を示す。"),
    metricRateRow("clarification_need_recall", summary.metrics.clarificationNeedRecall, clarificationExpectedRows.filter((row) => row.evaluation.actualResponseType === "clarification").length, clarificationExpectedRows.length, "期待値として clarification が必要な行がない場合は評価対象外。"),
    metricNullableRow("clarification_need_f1", formatRate(summary.metrics.clarificationNeedF1), summary.metrics.clarificationNeedF1, `precision=${formatRate(summary.metrics.clarificationNeedPrecision)}, recall=${formatRate(summary.metrics.clarificationNeedRecall)}`, "precision と recall の両方が計算できる場合だけ評価可能。"),
    metricRateRow("option_hit_rate", summary.metrics.optionHitRate, optionHitRows.filter((row) => row.evaluation.optionHit === true).length, optionHitRows.length, "`expectedOptionsAnyOf` がある行だけを評価。"),
    metricRateRow("missing_slot_hit_rate", summary.metrics.missingSlotHitRate, missingSlotRows.filter((row) => row.evaluation.missingSlotHit === true).length, missingSlotRows.length, "`expectedMissingSlots` がある行だけを評価。"),
    metricRateRow("corpus_grounded_option_rate", summary.metrics.corpusGroundedOptionRate, groundedOptionRows.filter((row) => row.evaluation.corpusGroundedOptions === true).length, groundedOptionRows.length, "出してしまった clarification option の grounding を見る指標。clarification 判断の正しさとは別。"),
    metricRateRow("post_clarification_accuracy", summary.metrics.postClarificationAccuracy, postClarificationRows.filter((row) => row.evaluation.postClarificationAnswerCorrect === true).length, postClarificationRows.length, "`followUp` 期待値がある行だけを評価。"),
    metricRateRow("over_clarification_rate", summary.metrics.overClarificationRate, clearAnswerRows.filter((row) => row.evaluation.actualResponseType === "clarification").length, clearAnswerRows.length, "回答すべき行で不要な clarification になった割合。"),
    metricNullableRow("clarification_latency_delta_vs_non_clarification_ms", formatNumber(summary.metrics.clarificationLatencyOverheadMs), summary.metrics.clarificationLatencyOverheadMs, `${clarificationActualRows.length} actual clarification rows vs ${nonClarificationRows.length} non-clarification rows`, "同一質問の overhead ではなく、actual clarification 行の平均 latency から non-clarification 行の平均 latency を引いた差分。負値は clarification 行の方が速いことを示す。summary JSON key は clarificationLatencyOverheadMs を維持。"),
    metricNullableRow("post_clarification_task_latency_ms", formatNumber(summary.metrics.postClarificationTaskLatencyMs), summary.metrics.postClarificationTaskLatencyMs, `${postClarificationTaskLatencies.length}/${postClarificationRows.length} follow-up rows with latency`, "確認質問から follow-up 完了までの平均 task latency。"),
    metricRateRow("abstention_recall", summary.metrics.abstentionRecall, unanswerableRows.filter((row) => row.evaluation.abstentionCorrect === true).length, unanswerableRows.length, "unanswerable 行がない場合は評価対象外。"),
    metricRateRow("unsupported_answer_rate", summary.metrics.unsupportedAnswerRate, unanswerableRows.filter((row) => row.evaluation.unsupportedAnswer).length, unanswerableRows.length, "unanswerable 行がない場合は評価対象外。"),
    metricRateRow("answer_contains_rate", summary.metrics.answerContainsRate, containsEvaluated.filter((row) => row.evaluation.answerContainsExpected === true).length, containsEvaluated.length, "`expectedContains` / `expectedAnswer` を持つ answerable 行の期待語句一致率。"),
    metricRateRow("citation_hit_rate", summary.metrics.citationHitRate, citationEvaluated.filter((row) => row.evaluation.citationHit === true).length, citationEvaluated.length, "answerable 行で citation が返った割合。"),
    metricRateRow("expected_file_hit_rate", summary.metrics.expectedFileHitRate, fileEvaluated.filter((row) => row.evaluation.expectedFileHit === true).length, fileEvaluated.length, "`expectedFiles` または `expectedDocumentIds` がある行だけを評価。"),
    metricRateRow("retrieval_recall_at_k", summary.metrics.retrievalRecallAtK, retrievalRecallAtKEvaluated.filter((row) => row.evaluation.retrievalRecallAtK === true).length, retrievalRecallAtKEvaluated.length, "`expectedFiles` または `expectedDocumentIds` を evaluator profile の retrieval.recallK で評価。"),
    metricRateRow("retrieval_recall_at_20", summary.metrics.retrievalRecallAt20, retrievalRecallAt20Evaluated.filter((row) => row.evaluation.retrievalRecallAt20 === true).length, retrievalRecallAt20Evaluated.length, "`expectedFiles` または `expectedDocumentIds` を top 20 retrieved/citation で評価する後方互換指標。"),
    metricRateRow("expected_page_hit_rate", summary.metrics.expectedPageHitRate, pageEvaluated.filter((row) => row.evaluation.expectedPageHit === true).length, pageEvaluated.length, "`expectedPages` がある行だけを評価。"),
    metricNullableRow("fact_slot_coverage", formatRate(summary.metrics.factSlotCoverage), summary.metrics.factSlotCoverage, `${factSlotEvaluated.length} rows with expectedFactSlots`, "`expectedFactSlots` がある行の平均 coverage。"),
    metricRateRow("refusal_precision", summary.metrics.refusalPrecision, refusedRows.filter((row) => !row.evaluation.expectedAnswerable).length, refusedRows.length, "実際に refusal した行のうち、期待値も unanswerable/refusal だった割合。0.0% は answer-only dataset での false positive を示す。"),
    metricRateRow("refusal_recall", summary.metrics.refusalRecall, unanswerableRows.filter((row) => row.evaluation.refused).length, unanswerableRows.length, "unanswerable 行がない場合は評価対象外。"),
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
    metricNullableRow("average_latency_ms", formatNumber(summary.metrics.averageLatencyMs), summary.metrics.averageLatencyMs, `${results.length} rows`, "初回 API call latency の平均。")
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
    return [
      new RegExp(`(?:^|[^0-9])p(?:age)?[_ -]?0*${escaped}(?:[^0-9]|$)`, "iu"),
      new RegExp(`(?:^|[^0-9])${escaped}\\s*(?:ページ|頁)(?:[^0-9]|$)`, "iu")
    ]
  })
  return citations.some((citation) => {
    const haystack = [citation.chunkId, citation.fileName, citation.text].filter(Boolean).join("\n")
    return pagePatterns.some((pattern) => pattern.test(haystack))
  })
}

function hasRetrievalRecallAtK(citations: Citation[], expectedFiles: string[], expectedDocumentIds: string[], k: number): boolean {
  const topK = citations.slice(0, Math.max(1, Math.trunc(k)))
  const fileHit = expectedFiles.length === 0 || hasExpectedFileHit(topK, expectedFiles)
  const documentHit = expectedDocumentIds.length === 0 || hasExpectedDocumentHit(topK, expectedDocumentIds)
  return fileHit && documentHit
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
