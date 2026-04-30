import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"

type DatasetRow = {
  id?: string
  question: string
  expected?: string
  expectedAnswer?: string
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
  answerable?: boolean
  expectedFiles?: string[]
  expectedFileNames?: string[]
  expectedDocumentIds?: string[]
  expectedPages?: Array<number | string>
  modelId?: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  strictGrounded?: boolean
  useMemory?: boolean
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
    steps?: Array<{ label: string; latencyMs: number; status: string; summary?: string }>
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
    expectedPageHitRate: number | null
    p50LatencyMs: number | null
    p95LatencyMs: number | null
    averageLatencyMs: number | null
  }
  failures: Array<{
    id?: string
    question: string
    reasons: string[]
    answerPreview: string
  }>
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const defaultModelId = process.env.MODEL_ID ?? "amazon.nova-lite-v1:0"
const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const datasetPath = resolveExistingPath(process.env.DATASET ?? "dataset.sample.jsonl", [process.cwd(), benchmarkDir, repoRoot])
const outputPath = resolveOutputPath(process.env.OUTPUT ?? ".local-data/benchmark-results.jsonl")
const reportPath = resolveOutputPath(process.env.REPORT ?? outputPath.replace(/\.jsonl$/i, ".report.md"))
const summaryPath = resolveOutputPath(process.env.SUMMARY ?? outputPath.replace(/\.jsonl$/i, ".summary.json"))

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
      headers: { "Content-Type": "application/json" },
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
  const answerabilityCorrect = actualAnswerable === expectedAnswerable
  if (!answerabilityCorrect) failureReasons.push(expectedAnswerable ? "expected_answer_but_refused" : "expected_refusal_but_answered")

  const answerContainsExpected =
    expectedAnswerable && expectedContains.length > 0
      ? expectedContains.every((expected) => normalize(answer).includes(normalize(expected)))
      : null
  if (answerContainsExpected === false) failureReasons.push("answer_missing_expected_text")

  const regexMatched =
    expectedAnswerable && expectedRegex.length > 0
      ? expectedRegex.every((pattern) => new RegExp(pattern, "iu").test(answer))
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
  const pageEvaluated = results.filter((row) => row.evaluation.expectedPageHit !== null)
  const containsEvaluated = results.filter((row) => row.evaluation.answerContainsExpected !== null)

  return {
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
      expectedPageHitRate: rate(
        pageEvaluated.filter((row) => row.evaluation.expectedPageHit === true).length,
        pageEvaluated.length
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
        answerPreview: (row.result.answer ?? row.result.error ?? "").slice(0, 180)
      }))
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
    ["expected_page_hit_rate", formatRate(summary.metrics.expectedPageHitRate)],
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

  const detailRows = [
    "| id | expected | actual | latency_ms | citations | retrieved | result |",
    "| --- | --- | --- | ---: | ---: | ---: | --- |",
    ...results.map((row) => {
      const passed = row.evaluation.failureReasons.length === 0 ? "pass" : row.evaluation.failureReasons.join(", ")
      return `| ${escapeMarkdown(row.id ?? "")} | ${row.evaluation.expectedAnswerable ? "answer" : "refuse"} | ${row.evaluation.actualAnswerable ? "answer" : "refuse"} | ${row.latencyMs} | ${row.evaluation.citationCount} | ${row.evaluation.retrievedCount} | ${escapeMarkdown(passed)} |`
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
