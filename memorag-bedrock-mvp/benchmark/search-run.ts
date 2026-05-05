import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
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
import { resolveExistingPath, resolveOutputPath } from "./paths.js"

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
    documentId?: string
  }
  user?: {
    userId?: string
    groups?: string[]
  }
  relevant?: RelevanceItem[]
  forbidden?: RelevanceItem[]
  caseType?: string
}

type SearchResult = {
  id: string
  documentId: string
  fileName: string
  chunkId?: string
  score: number
  sources?: Array<"lexical" | "semantic">
}

type SearchResponse = {
  query?: string
  results?: SearchResult[]
  diagnostics?: {
    lexicalCount?: number
    semanticCount?: number
    fusedCount?: number
    latencyMs?: number
  }
  error?: string
}

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
  results: SearchResult[]
}

type SearchSummary = {
  mode: "search"
  datasetPath: string
  outputPath: string
  reportPath: string
  summaryPath: string
  apiBaseUrl: string
  generatedAt: string
  total: number
  succeeded: number
  failedHttp: number
  metrics: Record<string, number | null>
  failures: Array<{
    id: string
    query: string
    caseType?: string
    reasons: string[]
  }>
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const datasetPath = resolveExistingPath(process.env.DATASET ?? "datasets/search.sample.jsonl", [process.cwd(), benchmarkDir, repoRoot])
const outputPath = resolveOutputPath(process.env.OUTPUT ?? ".local-data/search-benchmark-results.jsonl", repoRoot)
const reportPath = resolveOutputPath(process.env.REPORT ?? outputPath.replace(/\.jsonl$/i, ".report.md"), repoRoot)
const summaryPath = resolveOutputPath(process.env.SUMMARY ?? outputPath.replace(/\.jsonl$/i, ".summary.json"), repoRoot)

await mkdir(path.dirname(outputPath), { recursive: true })
await mkdir(path.dirname(reportPath), { recursive: true })
await mkdir(path.dirname(summaryPath), { recursive: true })

const out = createWriteStream(outputPath, { encoding: "utf-8" })
const rl = readline.createInterface({ input: createReadStream(datasetPath, { encoding: "utf-8" }), crlfDelay: Infinity })
const rows: SearchResultRow[] = []

for await (const line of rl) {
  if (!line.trim()) continue
  const row = JSON.parse(line) as SearchDatasetRow
  const startedAt = Date.now()
  const { status, body } = await runSearch(row)
  const latencyMs = body.diagnostics?.latencyMs ?? Date.now() - startedAt
  const result = evaluateRow(row, status, latencyMs, body)
  out.write(`${JSON.stringify(result)}\n`)
  rows.push(result)
}

await closeStream(out)
const summary = summarize(rows)
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8")
await writeFile(reportPath, renderMarkdownReport(summary, rows), "utf-8")

console.log(`Wrote ${rows.length} search benchmark rows to ${outputPath}`)
console.log(`Wrote search benchmark summary to ${summaryPath}`)
console.log(`Wrote search benchmark report to ${reportPath}`)

async function runSearch(row: SearchDatasetRow): Promise<{ status: number; body: SearchResponse }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (process.env.API_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.API_AUTH_TOKEN}`

  try {
    const response = await fetch(`${apiBaseUrl}/benchmark/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: row.query,
        topK: row.topK ?? envInt("TOP_K"),
        lexicalTopK: row.lexicalTopK ?? envInt("LEXICAL_TOP_K"),
        semanticTopK: row.semanticTopK ?? envInt("SEMANTIC_TOP_K"),
        embeddingModelId: row.embeddingModelId ?? process.env.EMBEDDING_MODEL_ID,
        filters: row.filters,
        user: row.user
      })
    })
    const text = await response.text()
    return { status: response.status, body: text ? (JSON.parse(text) as SearchResponse) : { error: "Empty response body" } }
  } catch (error) {
    return { status: 0, body: { error: error instanceof Error ? error.message : String(error) } }
  }
}

function evaluateRow(row: SearchDatasetRow, status: number, latencyMs: number, body: SearchResponse): SearchResultRow {
  const results = body.results ?? []
  const relevant = row.relevant ?? []
  const metrics = evaluateRetrieval(results, relevant)
  const noAccessLeakCount = row.caseType === "acl_negative"
    ? countAccessLeaks(results, relevant, row.forbidden)
    : countAccessLeaks(results, [], row.forbidden)
  const failureReasons: string[] = []

  if (status < 200 || status >= 300) failureReasons.push(`http_${status}`)
  if (row.caseType === "acl_negative") {
    if (noAccessLeakCount > 0) failureReasons.push("no_access_leak")
  } else if (relevant.length > 0 && metrics.recallAt10 === 0) {
    failureReasons.push("recall_at_10_miss")
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
    results
  }
}

function summarize(rows: SearchResultRow[]): SearchSummary {
  const latencies = rows.map((row) => row.latencyMs)
  const metricAverages = {
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

  return {
    mode: "search",
    datasetPath,
    outputPath,
    reportPath,
    summaryPath,
    apiBaseUrl,
    generatedAt: new Date().toISOString(),
    total: rows.length,
    succeeded: rows.filter((row) => row.status >= 200 && row.status < 300).length,
    failedHttp: rows.filter((row) => row.status < 200 || row.status >= 300).length,
    metrics: metricAverages,
    failures: rows
      .filter((row) => row.failureReasons.length > 0)
      .map((row) => ({ id: row.id, query: row.query, caseType: row.caseType, reasons: row.failureReasons }))
  }
}

function renderMarkdownReport(summary: SearchSummary, rows: SearchResultRow[]): string {
  const metricRows = Object.entries(summary.metrics).map(([name, value]) => `| ${name} | ${formatNumber(value)} |`).join("\n")
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
    "| id | case | recall@20 | mrr@10 | ndcg@10 | precision@10 | leak | latency_ms | lexical | semantic | fused |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((row) =>
      `| ${escapeMarkdown(row.id)} | ${escapeMarkdown(row.caseType ?? "")} | ${formatNumber(row.metrics.recallAt20)} | ${formatNumber(row.metrics.mrrAt10)} | ${formatNumber(row.metrics.ndcgAt10)} | ${formatNumber(row.metrics.precisionAt10)} | ${row.noAccessLeakCount} | ${row.latencyMs} | ${row.diagnostics?.lexicalCount ?? 0} | ${row.diagnostics?.semanticCount ?? 0} | ${row.diagnostics?.fusedCount ?? 0} |`
    )
  ].join("\n")

  return `# MemoRAG Search Benchmark Report

- Generated at: ${summary.generatedAt}
- API base URL: ${summary.apiBaseUrl}
- Dataset: ${summary.datasetPath}
- Raw results: ${summary.outputPath}
- Summary JSON: ${summary.summaryPath}

## Summary

- Total rows: ${summary.total}
- HTTP success: ${summary.succeeded}
- HTTP failed: ${summary.failedHttp}

## Metrics

| metric | value |
| --- | ---: |
${metricRows}

## Failures

${failureRows}

## Row Details

${detailRows}
`
}

function averageMetric(rows: SearchResultRow[], metric: keyof RetrievalMetrics): number | null {
  const values = rows.map((row) => row.metrics[metric]).filter((value): value is number => typeof value === "number")
  return average(values)
}

function hitRate(rows: SearchResultRow[], metric: keyof RetrievalMetrics): number | null {
  const values = rows.map((row) => row.metrics[metric]).filter((value): value is boolean => typeof value === "boolean")
  return rate(values.filter(Boolean).length, values.length)
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
