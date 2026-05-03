import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"
import { createQualityReview, type QualityReview } from "./metrics/quality.js"

type DatasetRow = {
  id?: string
  question: string
  expected?: string
  expectedAnswer?: string
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
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
  answer?: string
  isAnswerable?: boolean
  citations?: Citation[]
  retrieved?: Citation[]
  debug?: {
    runId?: string
    totalLatencyMs?: number
    steps?: Array<{ label: string; latencyMs: number; status: string; summary?: string; detail?: string }>
  }
  answerSupport?: {
    unsupportedSentences?: Array<{ sentence?: string; reason?: string }>
    totalSentences?: number
  }
  error?: string
}

type RowEvaluation = {
  expectedAnswerable: boolean
  actualAnswerable: boolean
  answerabilityCorrect: boolean
  answerContainsExpected: boolean | null
  regexMatched: boolean | null
  answerCorrect: boolean
  abstentionCorrect: boolean | null
  unsupportedAnswer: boolean
  citationHit: boolean | null
  expectedFileHit: boolean | null
  expectedPageHit: boolean | null
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
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
  answerable?: boolean
  complexity?: string
  unanswerableType?: string
  expectedFactSlots?: ExpectedFactSlot[]
  status: number
  latencyMs: number
  evaluation: RowEvaluation
  result: BenchmarkResponse
}

type Summary = {
  datasetPath: string
  outputPath: string
  reportPath: string
  summaryPath: string
  apiBaseUrl: string
  generatedAt: string
  total: number
  succeeded: number
  failedHttp: number
  answerableTotal: number
  unanswerableTotal: number
  metrics: {
    answerableAccuracy: number | null
    abstentionRecall: number | null
    unsupportedAnswerRate: number | null
    answerContainsRate: number | null
    citationHitRate: number | null
    expectedFileHitRate: number | null
    retrievalRecallAt20: number | null
    expectedPageHitRate: number | null
    factSlotCoverage: number | null
    refusalPrecision: number | null
    refusalRecall: number | null
    unsupportedSentenceRate: number | null
    avgIterations: number | null
    avgRetrievalCalls: number | null
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

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const apiAuthToken = process.env.API_AUTH_TOKEN
const defaultModelId = process.env.MODEL_ID ?? "amazon.nova-lite-v1:0"
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
  ? (JSON.parse(await readFile(baselineSummaryPath, "utf-8")) as { metrics?: Summary["metrics"] })
  : undefined

await mkdir(path.dirname(outputPath), { recursive: true })
await mkdir(path.dirname(reportPath), { recursive: true })
await mkdir(path.dirname(summaryPath), { recursive: true })
const out = createWriteStream(outputPath, { encoding: "utf-8" })
const rl = readline.createInterface({ input: createReadStream(datasetPath, { encoding: "utf-8" }), crlfDelay: Infinity })

let count = 0
const results: BenchmarkResultRow[] = []
for await (const line of rl) {
  if (!line.trim()) continue
  const row = JSON.parse(line) as DatasetRow
  const startedAt = Date.now()
  const { status, body } = await runQuery(row)
  const result: BenchmarkResultRow = {
    id: row.id,
    question: row.question,
    expected: row.expected,
    expectedAnswer: row.expectedAnswer,
    expectedContains: row.expectedContains,
    expectedRegex: row.expectedRegex,
    answerable: row.answerable,
    complexity: row.complexity,
    unanswerableType: row.unanswerableType,
    expectedFactSlots: row.expectedFactSlots,
    status,
    latencyMs: Date.now() - startedAt,
    evaluation: evaluateRow(row, body, status),
    result: body
  }
  out.write(`${JSON.stringify(result)}\n`)
  results.push(result)
  count += 1
}

await closeStream(out)
const summary = summarize(results)
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8")
await writeFile(reportPath, renderMarkdownReport(summary, results), "utf-8")

console.log(`Wrote ${count} benchmark rows to ${outputPath}`)
console.log(`Wrote benchmark summary to ${summaryPath}`)
console.log(`Wrote benchmark report to ${reportPath}`)

async function runQuery(row: DatasetRow): Promise<{ status: number; body: BenchmarkResponse }> {
  try {
    const response = await fetch(`${apiBaseUrl}/benchmark/query`, {
      method: "POST",
      headers: createRequestHeaders(),
      body: JSON.stringify({
        id: row.id,
        question: row.question,
        modelId: row.modelId ?? defaultModelId,
        embeddingModelId: row.embeddingModelId,
        clueModelId: row.clueModelId,
        topK: row.topK,
        memoryTopK: row.memoryTopK,
        minScore: row.minScore,
        strictGrounded: row.strictGrounded,
        useMemory: row.useMemory,
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

function createRequestHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(apiAuthToken ? { Authorization: `Bearer ${apiAuthToken}` } : {})
  }
}

function evaluateRow(row: DatasetRow, body: BenchmarkResponse, status: number): RowEvaluation {
  const expectedAnswerable = inferExpectedAnswerable(row)
  const actualAnswerable = Boolean(body.isAnswerable)
  const answer = body.answer ?? ""
  const citations = body.citations ?? []
  const retrieved = body.retrieved ?? []
  const expectedContains = toArray(row.expectedContains ?? row.expectedAnswer ?? (expectedAnswerable ? row.expected : undefined))
  const expectedRegex = toArray(row.expectedRegex)
  const expectedFiles = toArray(row.expectedFiles ?? row.expectedFileNames)
  const expectedDocumentIds = toArray(row.expectedDocumentIds)
  const expectedPages = toArray(row.expectedPages).map(String)
  const failureReasons: string[] = []
  const refused = !actualAnswerable || isNoAnswerText(answer)
  const answerabilityCorrect = actualAnswerable === expectedAnswerable
  if (!answerabilityCorrect) failureReasons.push(expectedAnswerable ? "expected_answer_but_refused" : "expected_refusal_but_answered")

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

  const retrievalRecallAt20 =
    expectedFiles.length > 0 || expectedDocumentIds.length > 0
      ? hasRetrievalRecallAt20([...retrieved, ...citations], expectedFiles, expectedDocumentIds)
      : null
  if (retrievalRecallAt20 === false) failureReasons.push("retrieval_recall_at_20_miss")

  const factSlotResult = evaluateFactSlots(row.expectedFactSlots ?? [], answer, [...citations, ...retrieved], expectedAnswerable)
  if (factSlotResult.coverage !== null && factSlotResult.coverage < 1) failureReasons.push("fact_slot_not_covered")

  const supportResult = evaluateUnsupportedSentences(body)
  if (supportResult.rate !== null && supportResult.rate > 0) failureReasons.push("unsupported_sentence_detected")

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

  const abstentionCorrect = expectedAnswerable ? null : !actualAnswerable || isNoAnswerText(answer)
  if (abstentionCorrect === false) failureReasons.push("unsupported_answer")

  return {
    expectedAnswerable,
    actualAnswerable,
    answerabilityCorrect,
    answerContainsExpected,
    regexMatched,
    answerCorrect,
    abstentionCorrect,
    unsupportedAnswer: !expectedAnswerable && actualAnswerable && !isNoAnswerText(answer),
    citationHit,
    expectedFileHit: expectedFileHit ?? expectedDocumentHit,
    expectedPageHit,
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
    topCitationScore: citations.length > 0 ? Math.max(...citations.map((citation) => citation.score ?? 0)) : null,
    retrievedCount: retrieved.length,
    citationCount: citations.length,
    failureReasons
  }
}

function summarize(results: BenchmarkResultRow[]): Summary {
  const answerableRows = results.filter((row) => row.evaluation.expectedAnswerable)
  const unanswerableRows = results.filter((row) => !row.evaluation.expectedAnswerable)
  const latencies = results.map((row) => row.latencyMs).sort((a, b) => a - b)
  const citationEvaluated = results.filter((row) => row.evaluation.citationHit !== null)
  const fileEvaluated = results.filter((row) => row.evaluation.expectedFileHit !== null)
  const retrievalRecallEvaluated = results.filter((row) => row.evaluation.retrievalRecallAt20 !== null)
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

  const summary = {
    datasetPath,
    outputPath,
    reportPath,
    summaryPath,
    apiBaseUrl,
    generatedAt: new Date().toISOString(),
    total: results.length,
    succeeded: results.filter((row) => row.status >= 200 && row.status < 300).length,
    failedHttp: results.filter((row) => row.status < 200 || row.status >= 300).length,
    answerableTotal: answerableRows.length,
    unanswerableTotal: unanswerableRows.length,
    metrics: {
      answerableAccuracy: rate(answerableRows.filter((row) => row.evaluation.answerCorrect).length, answerableRows.length),
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
      retrievalRecallAt20: rate(
        retrievalRecallEvaluated.filter((row) => row.evaluation.retrievalRecallAt20 === true).length,
        retrievalRecallEvaluated.length
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
      failures: summary.failures
    })
  }
}

function renderMarkdownReport(summary: Summary, results: BenchmarkResultRow[]): string {
  const metricRows = [
    ["answerable_accuracy", formatRate(summary.metrics.answerableAccuracy)],
    ["abstention_recall", formatRate(summary.metrics.abstentionRecall)],
    ["unsupported_answer_rate", formatRate(summary.metrics.unsupportedAnswerRate)],
    ["answer_contains_rate", formatRate(summary.metrics.answerContainsRate)],
    ["citation_hit_rate", formatRate(summary.metrics.citationHitRate)],
    ["expected_file_hit_rate", formatRate(summary.metrics.expectedFileHitRate)],
    ["retrieval_recall_at_20", formatRate(summary.metrics.retrievalRecallAt20)],
    ["expected_page_hit_rate", formatRate(summary.metrics.expectedPageHitRate)],
    ["fact_slot_coverage", formatRate(summary.metrics.factSlotCoverage)],
    ["refusal_precision", formatRate(summary.metrics.refusalPrecision)],
    ["refusal_recall", formatRate(summary.metrics.refusalRecall)],
    ["unsupported_sentence_rate", formatRate(summary.metrics.unsupportedSentenceRate)],
    ["avg_iterations", formatNumber(summary.metrics.avgIterations)],
    ["avg_retrieval_calls", formatNumber(summary.metrics.avgRetrievalCalls)],
    ["p50_latency_ms", formatNumber(summary.metrics.p50LatencyMs)],
    ["p95_latency_ms", formatNumber(summary.metrics.p95LatencyMs)],
    ["average_latency_ms", formatNumber(summary.metrics.averageLatencyMs)]
  ]

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
    "| id | expected | actual | fact_slots | iterations | retrieval_calls | latency_ms | citations | retrieved | result |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...results.map((row) => {
      const passed = row.evaluation.failureReasons.length === 0 ? "pass" : row.evaluation.failureReasons.join(", ")
      return `| ${escapeMarkdown(row.id ?? "")} | ${row.evaluation.expectedAnswerable ? "answer" : "refuse"} | ${row.evaluation.refused ? "refuse" : "answer"} | ${formatRate(row.evaluation.factSlotCoverage)} | ${formatNumber(row.evaluation.iterationCount)} | ${formatNumber(row.evaluation.retrievalCallCount)} | ${row.latencyMs} | ${row.evaluation.citationCount} | ${row.evaluation.retrievedCount} | ${escapeMarkdown(passed)} |`
    })
  ].join("\n")

  return `# MemoRAG Benchmark Report

- Generated at: ${summary.generatedAt}
- API base URL: ${summary.apiBaseUrl}
- Dataset: ${summary.datasetPath}
- Raw results: ${summary.outputPath}
- Summary JSON: ${summary.summaryPath}

## Summary

- Total rows: ${summary.total}
- HTTP success: ${summary.succeeded}
- HTTP failed: ${summary.failedHttp}
- Answerable rows: ${summary.answerableTotal}
- Unanswerable rows: ${summary.unanswerableTotal}

## Metrics

| metric | value |
| --- | ---: |
${metricRows.map(([name, value]) => `| ${name} | ${value} |`).join("\n")}

## Quality Review

- Status: ${summary.qualityReview.status}
- Baseline summary: ${baselineSummaryPath ?? "n/a"}

### Regressions

${regressionRows}

### Alias Candidates

${aliasCandidateRows}

## Failures

${failureRows}

## Row Details

${detailRows}
`
}

function inferExpectedAnswerable(row: DatasetRow): boolean {
  if (typeof row.answerable === "boolean") return row.answerable
  const expected = normalize(row.expected ?? row.expectedAnswer ?? "")
  if (!expected) return true
  return !isNoAnswerText(expected)
}

function isNoAnswerText(value: string): boolean {
  const normalized = normalize(value)
  return normalized.includes("資料からは回答できません") || normalized.includes("回答できません") || normalized.includes("noanswer")
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

function hasRetrievalRecallAt20(citations: Citation[], expectedFiles: string[], expectedDocumentIds: string[]): boolean {
  const top20 = citations.slice(0, 20)
  const fileHit = expectedFiles.length === 0 || hasExpectedFileHit(top20, expectedFiles)
  const documentHit = expectedDocumentIds.length === 0 || hasExpectedDocumentHit(top20, expectedDocumentIds)
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
  if (value === null) return "n/a"
  return `${(value * 100).toFixed(1)}%`
}

function formatNumber(value: number | null): string {
  return value === null ? "n/a" : String(value)
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
