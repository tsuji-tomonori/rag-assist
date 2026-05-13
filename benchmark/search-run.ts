import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"
import {
  average,
  countAccessLeaks,
  evaluateRetrieval,
  percentile,
  rate,
  type RelevanceItem,
  type RetrievalMetrics
} from "./metrics/retrieval.js"
import {
  assertComparableProfiles,
  assertSuiteEvaluatorProfile,
  profileKey,
  resolveEvaluatorProfile,
  type EvaluatorProfile
} from "./evaluator-profile.js"
import { benchmarkCorpusDirFromEnv, benchmarkCorpusSkipMemoryFromEnv, benchmarkIngestRunPollIntervalMsFromEnv, benchmarkIngestRunTimeoutMsFromEnv, seedBenchmarkCorpus, type SeededDocument } from "./corpus.js"
import { createBenchmarkApiClient } from "./api-client.js"
import type { BenchmarkSearchResponse, SearchResult } from "@memorag-mvp/contract"

type SearchDatasetRow = {
  id: string
  query: string
  topK?: number
  lexicalTopK?: number
  semanticTopK?: number
  embeddingModelId?: string
  filters?: {
    tenantId?: string
    department?: string
    source?: string
    docType?: string
    benchmarkSuiteId?: string
    documentId?: string
  }
  user?: {
    userId?: string
    groups?: string[]
  }
  relevant?: RelevanceItem[]
  forbidden?: RelevanceItem[]
  caseType?: string
  evaluatorProfile?: string
}

type SearchResponse = Partial<BenchmarkSearchResponse> & { error?: string }

type SearchResultRow = {
  id: string
  query: string
  caseType?: string
  status: number
  latencyMs: number
  metrics: RetrievalMetrics
  noAccessLeakCount: number
  failureReasons: string[]
  diagnostics: SearchResponse["diagnostics"]
  evaluatorProfile: string
  recallK: number
  results: SearchResult[]
}

type SearchMetrics = {
  recallAtK: number | null
  recallAt1: number | null
  recallAt3: number | null
  recallAt5: number | null
  recallAt10: number | null
  recallAt20: number | null
  mrrAt10: number | null
  ndcgAt10: number | null
  precisionAt5: number | null
  precisionAt10: number | null
  expectedFileHitRate: number | null
  expectedDocumentHitRate: number | null
  expectedChunkHitRate: number | null
  noAccessLeakCount: number
  noAccessLeakRate: number | null
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
  averageLatencyMs: number | null
  errorRate: number | null
  lexicalCountAvg: number | null
  semanticCountAvg: number | null
  fusedCountAvg: number | null
}

type SearchSummary = {
  mode: "search"
  datasetPath: string
  outputPath: string
  reportPath: string
  summaryPath: string
  evaluatorProfile: EvaluatorProfile
  baselineComparisonNote?: string
  corpusSeed: SeededDocument[]
  apiBaseUrl: string
  generatedAt: string
  total: number
  succeeded: number
  failedHttp: number
  runnerError?: string
  metrics: SearchMetrics
  failures: Array<{
    id: string
    query: string
    caseType?: string
    reasons: string[]
  }>
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const apiAuthToken = process.env.API_AUTH_TOKEN
const api = createBenchmarkApiClient({ apiBaseUrl, authToken: apiAuthToken })
const defaultEmbeddingModelId = process.env.EMBEDDING_MODEL_ID?.trim() || undefined
const benchmarkCorpusSuiteId = process.env.BENCHMARK_CORPUS_SUITE_ID ?? "standard-agent-v1"
const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const datasetPath = resolveExistingPath(process.env.DATASET ?? "datasets/search.sample.jsonl", [process.cwd(), benchmarkDir, repoRoot])
const outputPath = resolveOutputPath(process.env.OUTPUT ?? ".local-data/search-benchmark-results.jsonl")
const reportPath = resolveOutputPath(process.env.REPORT ?? outputPath.replace(/\.jsonl$/i, ".report.md"))
const summaryPath = resolveOutputPath(process.env.SUMMARY ?? outputPath.replace(/\.jsonl$/i, ".summary.json"))
const baselineSummaryPath = process.env.BASELINE_SUMMARY
  ? resolveExistingPath(process.env.BASELINE_SUMMARY, [process.cwd(), benchmarkDir, repoRoot])
  : undefined

await mkdir(path.dirname(outputPath), { recursive: true })
await mkdir(path.dirname(reportPath), { recursive: true })
await mkdir(path.dirname(summaryPath), { recursive: true })

const rows: SearchResultRow[] = []
let out: ReturnType<typeof createWriteStream> | undefined
let outputClosed = false
let suiteEvaluatorProfile = resolveEvaluatorProfile()
let baselineComparisonNote: string | undefined
let corpusSeed: SeededDocument[] = []

try {
  suiteEvaluatorProfile = resolveEvaluatorProfile(process.env.EVALUATOR_PROFILE)
  const baselineSummary = baselineSummaryPath
    ? (JSON.parse(await readFile(baselineSummaryPath, "utf-8")) as { evaluatorProfile?: SearchSummary["evaluatorProfile"] })
    : undefined
  baselineComparisonNote = baselineSummary
    ? assertComparableProfiles(suiteEvaluatorProfile, baselineSummary, process.env.ALLOW_EVALUATOR_PROFILE_MISMATCH === "1")
    : undefined
  const benchmarkCorpusDir = benchmarkCorpusDirFromEnv(process.env)
  const resolvedBenchmarkCorpusDir = benchmarkCorpusDir
    ? resolveExistingPath(benchmarkCorpusDir, [process.cwd(), benchmarkDir, repoRoot])
    : undefined
  corpusSeed = await seedBenchmarkCorpus({
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

  out = createWriteStream(outputPath, { encoding: "utf-8" })
  const rl = readline.createInterface({ input: createReadStream(datasetPath, { encoding: "utf-8" }), crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue
    const row = JSON.parse(line) as SearchDatasetRow
    const rowEvaluatorProfile = resolveEvaluatorProfile(row.evaluatorProfile ?? profileKey(suiteEvaluatorProfile))
    assertSuiteEvaluatorProfile(rowEvaluatorProfile, suiteEvaluatorProfile, row.id)
    const startedAt = Date.now()
    const { status, body } = await runSearch(row)
    const latencyMs = body.diagnostics?.latencyMs ?? Date.now() - startedAt
    const result = evaluateRow(row, status, latencyMs, body, rowEvaluatorProfile)
    out.write(`${JSON.stringify(result)}\n`)
    rows.push(result)
  }

  await closeStream(out)
  outputClosed = true
  const summary = summarize(rows)
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8")
  await writeFile(reportPath, renderMarkdownReport(summary, rows), "utf-8")

  console.log(`Wrote ${rows.length} search benchmark rows to ${outputPath}`)
  console.log(`Wrote search benchmark summary to ${summaryPath}`)
  console.log(`Wrote search benchmark report to ${reportPath}`)
} catch (error) {
  if (out && !outputClosed) await closeStream(out).catch(() => undefined)
  if (!out) await writeFile(outputPath, "", "utf-8")
  const runnerError = runnerErrorMessage(error)
  const summary = summarize(rows, runnerError)
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8")
  await writeFile(reportPath, renderFatalMarkdownReport(summary, rows), "utf-8")
  console.error(runnerError)
  throw error
}

async function runSearch(row: SearchDatasetRow): Promise<{ status: number; body: SearchResponse }> {
  try {
    const body = await api.benchmark.search({
      query: row.query,
      topK: row.topK ?? envInt("TOP_K"),
      lexicalTopK: row.lexicalTopK ?? envInt("LEXICAL_TOP_K"),
      semanticTopK: row.semanticTopK ?? envInt("SEMANTIC_TOP_K"),
      embeddingModelId: row.embeddingModelId ?? process.env.EMBEDDING_MODEL_ID,
      filters: row.filters,
      benchmarkSuiteId: benchmarkCorpusSuiteId,
      user: row.user
    })
    return { status: 200, body }
  } catch (error) {
    return { status: 0, body: { error: error instanceof Error ? error.message : String(error) } }
  }
}

function evaluateRow(row: SearchDatasetRow, status: number, latencyMs: number, body: SearchResponse, evaluatorProfile: EvaluatorProfile): SearchResultRow {
  const results = body.results ?? []
  const relevant = row.relevant ?? []
  const metrics = evaluateRetrieval(results, relevant, { recallK: evaluatorProfile.retrieval.recallK })
  const noAccessLeakCount = row.caseType === "acl_negative"
    ? countAccessLeaks(results, relevant, row.forbidden)
    : countAccessLeaks(results, [], row.forbidden)
  const failureReasons: string[] = []

  if (status < 200 || status >= 300) failureReasons.push(`http_${status}`)
  if (row.caseType === "acl_negative") {
    if (noAccessLeakCount > 0) failureReasons.push("no_access_leak")
  } else if (relevant.length > 0 && metrics.recallAtK === 0) {
    failureReasons.push(`recall_at_${evaluatorProfile.retrieval.recallK}_miss`)
  }
  if (noAccessLeakCount > 0 && row.caseType !== "acl_negative") failureReasons.push("forbidden_result_leak")

  return {
    id: row.id,
    query: row.query,
    caseType: row.caseType,
    status,
    latencyMs,
    metrics,
    noAccessLeakCount,
    failureReasons,
    diagnostics: body.diagnostics,
    evaluatorProfile: profileKey(evaluatorProfile),
    recallK: evaluatorProfile.retrieval.recallK,
    results
  }
}

function summarize(rows: SearchResultRow[], runnerError?: string): SearchSummary {
  const latencies = rows.map((row) => row.latencyMs)
  const metricAverages = {
    recallAtK: averageMetric(rows, "recallAtK"),
    recallAt1: averageMetric(rows, "recallAt1"),
    recallAt3: averageMetric(rows, "recallAt3"),
    recallAt5: averageMetric(rows, "recallAt5"),
    recallAt10: averageMetric(rows, "recallAt10"),
    recallAt20: averageMetric(rows, "recallAt20"),
    mrrAt10: averageMetric(rows, "mrrAt10"),
    ndcgAt10: averageMetric(rows, "ndcgAt10"),
    precisionAt5: averageMetric(rows, "precisionAt5"),
    precisionAt10: averageMetric(rows, "precisionAt10"),
    expectedFileHitRate: hitRate(rows, "expectedFileHit"),
    expectedDocumentHitRate: hitRate(rows, "expectedDocumentHit"),
    expectedChunkHitRate: hitRate(rows, "expectedChunkHit"),
    noAccessLeakCount: rows.reduce((sum, row) => sum + row.noAccessLeakCount, 0),
    noAccessLeakRate: rate(rows.filter((row) => row.noAccessLeakCount > 0).length, rows.length),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    p99LatencyMs: percentile(latencies, 0.99),
    averageLatencyMs: average(latencies),
    errorRate: rate(rows.filter((row) => row.status < 200 || row.status >= 300).length, rows.length),
    lexicalCountAvg: average(rows.map((row) => row.diagnostics?.lexicalCount ?? 0)),
    semanticCountAvg: average(rows.map((row) => row.diagnostics?.semanticCount ?? 0)),
    fusedCountAvg: average(rows.map((row) => row.diagnostics?.fusedCount ?? 0))
  }

  const failures = rows
    .filter((row) => row.failureReasons.length > 0)
    .map((row) => ({ id: row.id, query: row.query, caseType: row.caseType, reasons: row.failureReasons }))
  if (runnerError) failures.push({ id: "__runner__", query: "search benchmark runner", caseType: undefined, reasons: [runnerError] })

  return {
    mode: "search",
    datasetPath,
    outputPath,
    reportPath,
    summaryPath,
    evaluatorProfile: suiteEvaluatorProfile,
    baselineComparisonNote,
    corpusSeed,
    apiBaseUrl,
    generatedAt: new Date().toISOString(),
    total: rows.length,
    succeeded: rows.filter((row) => row.status >= 200 && row.status < 300).length,
    failedHttp: rows.filter((row) => row.status < 200 || row.status >= 300).length,
    runnerError,
    metrics: metricAverages,
    failures
  }
}

function renderMarkdownReport(summary: SearchSummary, rows: SearchResultRow[]): string {
  const metricRows = (Object.entries(summary.metrics) as Array<[keyof SearchMetrics, number | null]>)
    .map(([name, value]) => `| ${name} | ${formatNumber(value)} | ${metricDescription(name)} |`)
    .join("\n")
  const failureRows = summary.failures.length === 0
    ? "\nNo failed search benchmark rows.\n"
    : [
        "| id | case | query | reasons |",
        "| --- | --- | --- | --- |",
        ...summary.failures.map((failure) =>
          `| ${escapeMarkdown(failure.id)} | ${escapeMarkdown(failure.caseType ?? "")} | ${escapeMarkdown(failure.query)} | ${escapeMarkdown(failure.reasons.join(", "))} |`
        )
      ].join("\n")
  const detailRows = [
    "| id | case | evaluator_profile | retrieval_profile | recall_k | recall@K | recall@20 | mrr@10 | ndcg@10 | precision@10 | leak | latency_ms | lexical | semantic | fused |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((row) =>
      `| ${escapeMarkdown(row.id)} | ${escapeMarkdown(row.caseType ?? "")} | ${escapeMarkdown(row.evaluatorProfile)} | ${escapeMarkdown(formatSearchRetrievalProfile(row))} | ${row.recallK} | ${formatNumber(row.metrics.recallAtK)} | ${formatNumber(row.metrics.recallAt20)} | ${formatNumber(row.metrics.mrrAt10)} | ${formatNumber(row.metrics.ndcgAt10)} | ${formatNumber(row.metrics.precisionAt10)} | ${row.noAccessLeakCount} | ${row.latencyMs} | ${row.diagnostics?.lexicalCount ?? 0} | ${row.diagnostics?.semanticCount ?? 0} | ${row.diagnostics?.fusedCount ?? 0} |`
    )
  ].join("\n")
  const corpusSeedRows = summary.corpusSeed.length === 0
    ? "\nNo benchmark corpus seed configured.\n"
    : [
        "| file | status | reason | chunks | source hash | ingest signature |",
        "| --- | --- | --- | ---: | --- | --- |",
        ...summary.corpusSeed.map((seed) =>
          `| ${escapeMarkdown(seed.fileName)} | ${seed.status} | ${escapeMarkdown(seed.skipReason ?? "")} | ${seed.chunkCount} | ${seed.sourceHash.slice(0, 12)} | ${seed.ingestSignature.slice(0, 12)} |`
        )
      ].join("\n")

  return `# MemoRAG Search Benchmark Report

- Generated at: ${summary.generatedAt}
- API base URL: ${summary.apiBaseUrl}
- Dataset: ${summary.datasetPath}
- Raw results: ${summary.outputPath}
- Summary JSON: ${summary.summaryPath}
- Evaluator profile: ${profileKey(summary.evaluatorProfile)}
- Retrieval profile: ${formatSearchRetrievalProfiles(rows)}
- Baseline comparison: ${summary.baselineComparisonNote ?? "same_profile_or_not_configured"}

## Summary

- Total rows: ${summary.total}
- HTTP success: ${summary.succeeded}
- HTTP failed: ${summary.failedHttp}
${summary.runnerError ? `- Runner error: ${escapeMarkdown(summary.runnerError)}\n` : ""}

## Corpus Seed

${corpusSeedRows}

## Metrics

| metric | value | 説明 |
| --- | ---: | --- |
${metricRows}

## Failures

${failureRows}

## Row Details

${detailRows}
`
}

function renderFatalMarkdownReport(summary: SearchSummary, rows: SearchResultRow[]): string {
  const failureRows = summary.failures.length === 0
    ? "\nNo failed search benchmark rows.\n"
    : [
        "| id | case | query | reasons |",
        "| --- | --- | --- | --- |",
        ...summary.failures.map((failure) =>
          `| ${escapeMarkdown(failure.id)} | ${escapeMarkdown(failure.caseType ?? "")} | ${escapeMarkdown(failure.query)} | ${escapeMarkdown(failure.reasons.join(", "))} |`
        )
      ].join("\n")

  return `# MemoRAG Search Benchmark Report

- Generated at: ${summary.generatedAt}
- API base URL: ${summary.apiBaseUrl}
- Dataset: ${summary.datasetPath}
- Raw results: ${summary.outputPath}
- Summary JSON: ${summary.summaryPath}
- Evaluator profile: ${profileKey(summary.evaluatorProfile)}
- Retrieval profile: ${formatSearchRetrievalProfiles(rows)}
- Baseline comparison: ${summary.baselineComparisonNote ?? "same_profile_or_not_configured"}

## Summary

- Total rows before runner error: ${rows.length}
- HTTP success: ${summary.succeeded}
- HTTP failed: ${summary.failedHttp}
- Runner error: ${escapeMarkdown(summary.runnerError ?? "unknown runner error")}

## Failures

${failureRows}
`
}

function metricDescription(metric: keyof SearchMetrics): string {
  switch (metric) {
    case "recallAtK":
      return "evaluator profile の retrieval.recallK で期待する relevant item が含まれた割合。"
    case "recallAt1":
      return "最上位 1 件に期待する relevant item が含まれた割合。"
    case "recallAt3":
      return "上位 3 件に期待する relevant item が含まれた割合。"
    case "recallAt5":
      return "上位 5 件に期待する relevant item が含まれた割合。"
    case "recallAt10":
      return "上位 10 件に期待する relevant item が含まれた割合。"
    case "recallAt20":
      return "上位 20 件に期待する relevant item が含まれた割合。"
    case "mrrAt10":
      return "上位 10 件で最初に relevant item が現れた順位の逆数平均。"
    case "ndcgAt10":
      return "上位 10 件の ranking 品質を、関連度と順位割引で評価した値。"
    case "precisionAt5":
      return "上位 5 件のうち relevant item が占める割合。"
    case "precisionAt10":
      return "上位 10 件のうち relevant item が占める割合。"
    case "expectedFileHitRate":
      return "期待ファイルが検索結果に含まれた割合。"
    case "expectedDocumentHitRate":
      return "期待 documentId が検索結果に含まれた割合。"
    case "expectedChunkHitRate":
      return "期待 chunkId が検索結果に含まれた割合。"
    case "noAccessLeakCount":
      return "アクセス権のない検索結果が返った件数。0 が望ましい。"
    case "noAccessLeakRate":
      return "アクセス権漏れが 1 件以上発生した行の割合。低いほどよい。"
    case "p50LatencyMs":
      return "検索 API latency の中央値。"
    case "p95LatencyMs":
      return "検索 API latency の 95 パーセンタイル。遅い tail latency を見る。"
    case "p99LatencyMs":
      return "検索 API latency の 99 パーセンタイル。"
    case "averageLatencyMs":
      return "検索 API latency の平均。"
    case "errorRate":
      return "HTTP 2xx 以外になった行の割合。低いほどよい。"
    case "lexicalCountAvg":
      return "lexical 検索候補数の平均。"
    case "semanticCountAvg":
      return "semantic 検索候補数の平均。"
    case "fusedCountAvg":
      return "lexical と semantic を統合した後の候補数の平均。"
  }
}

function formatSearchRetrievalProfile(row: SearchResultRow): string {
  const id = row.diagnostics?.profileId
  const version = row.diagnostics?.profileVersion
  return id && version ? `${id}@${version}` : "not_reported"
}

function formatSearchRetrievalProfiles(rows: SearchResultRow[]): string {
  const profiles = Array.from(new Set(rows.map(formatSearchRetrievalProfile))).sort()
  return profiles.length === 0 ? "not_reported" : profiles.join(", ")
}

function averageMetric(rows: SearchResultRow[], metric: keyof RetrievalMetrics): number | null {
  const values = rows.map((row) => row.metrics[metric]).filter((value): value is number => typeof value === "number")
  return average(values)
}

function hitRate(rows: SearchResultRow[], metric: keyof RetrievalMetrics): number | null {
  const values = rows.map((row) => row.metrics[metric]).filter((value): value is boolean => typeof value === "boolean")
  return rate(values.filter(Boolean).length, values.length)
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
  return path.isAbsolute(input) ? input : path.resolve(repoRoot, input)
}

function envInt(name: string): number | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isInteger(value) ? value : undefined
}

function closeStream(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.end(() => resolve())
    stream.on("error", reject)
  })
}

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : String(value)
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ")
}

function runnerErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return `runner_error: ${message}`
}
