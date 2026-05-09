import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"
import {
  benchmarkCorpusDirFromEnv,
  benchmarkCorpusSkipMemoryFromEnv,
  benchmarkIngestRunPollIntervalMsFromEnv,
  benchmarkIngestRunTimeoutMsFromEnv,
  seedBenchmarkCorpus,
  type SeededDocument
} from "./corpus.js"
import {
  evaluateConversationTurn,
  renderConversationReport,
  summarizeConversationResults,
  type ConversationBenchmarkResponse,
  type ConversationTurnResult
} from "./metrics/conversation.js"
import { createBenchmarkApiClient } from "./api-client.js"

type ConversationDatasetRow = {
  conversationId: string
  sourceDataset: string
  language?: string
  turns: ConversationTurn[]
  metadata?: Record<string, unknown>
}

type ConversationTurn = {
  turnId: string
  question: string
  answerable?: boolean
  referenceAnswer?: string
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
  expectedFiles?: string[]
  expectedFileNames?: string[]
  expectedDocumentIds?: string[]
  expectedResponseType?: "answer" | "refusal" | "clarification"
  requiresHistory?: boolean
  goldStandaloneQuestion?: string
  metadata?: Record<string, unknown>
}

type HistoryTurn = {
  role: "user" | "assistant"
  text: string
  turnId?: string
}

type ResultRow = ConversationTurnResult & {
  sourceDataset: string
  language?: string
  turnIndex: number
  question: string
  latencyMs: number
  expectedContains?: string | string[]
  expectedFiles?: string[]
  goldStandaloneQuestion?: string
  result: ConversationBenchmarkResponse
  metadata?: Record<string, unknown>
}

type SummaryOutput = ReturnType<typeof summarizeConversationResults> & {
  datasetPath: string
  outputPath: string
  summaryPath: string
  reportPath: string
  apiBaseUrl: string
  benchmarkSuiteId: string
  corpusSeed: SeededDocument[]
  generatedAt: string
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const apiAuthToken = process.env.API_AUTH_TOKEN
const api = createBenchmarkApiClient({ apiBaseUrl, authToken: apiAuthToken })
const defaultModelId = process.env.MODEL_ID ?? "amazon.nova-lite-v1:0"
const benchmarkSuiteId = process.env.BENCHMARK_SUITE_ID ?? "mtrag-v1"
const datasetPath = process.env.DATASET ?? "benchmark/datasets/conversation/mtrag-v1.jsonl"
const outputPath = process.env.OUTPUT ?? ".local-data/conversation-results.jsonl"
const summaryPath = process.env.SUMMARY ?? ".local-data/conversation-summary.json"
const reportPath = process.env.REPORT ?? ".local-data/conversation-report.md"

if (isMainModule()) {
  await runConversationBenchmark()
}

export async function runConversationBenchmark(): Promise<SummaryOutput> {
  const corpusSeed = await seedBenchmarkCorpus({
    apiBaseUrl,
    authToken: apiAuthToken,
    corpusDir: benchmarkCorpusDirFromEnv(process.env),
    suiteId: process.env.BENCHMARK_CORPUS_SUITE_ID ?? benchmarkSuiteId,
    skipMemory: benchmarkCorpusSkipMemoryFromEnv(process.env),
    embeddingModelId: process.env.EMBEDDING_MODEL_ID,
    ingestRunPollIntervalMs: benchmarkIngestRunPollIntervalMsFromEnv(process.env),
    ingestRunTimeoutMs: benchmarkIngestRunTimeoutMsFromEnv(process.env),
    log: (message) => console.log(message)
  })

  await mkdir(path.dirname(outputPath), { recursive: true })
  const out = createWriteStream(outputPath, { encoding: "utf-8" })
  const results: ResultRow[] = []

  try {
    for await (const conversation of readConversationDataset(datasetPath)) {
      const history: HistoryTurn[] = []

      for (const [turnIndex, turn] of conversation.turns.entries()) {
        const startedAt = Date.now()
        const { status, body } = await runBenchmarkQuery({
            id: turn.turnId,
            question: turn.question,
            conversationHistory: history,
            modelId: defaultModelId,
            benchmarkSuiteId,
            includeDebug: true
        })
        const evaluation = evaluateConversationTurn(turn, body, status)
        const result: ResultRow = {
          conversationId: conversation.conversationId,
          sourceDataset: conversation.sourceDataset,
          language: conversation.language,
          turnIndex,
          turnId: turn.turnId,
          question: turn.question,
          requiresHistory: turn.requiresHistory ?? turnIndex > 0,
          expectedContains: turn.expectedContains,
          expectedFiles: turn.expectedFiles,
          goldStandaloneQuestion: turn.goldStandaloneQuestion,
          status,
          latencyMs: Date.now() - startedAt,
          evaluation,
          result: body,
          metadata: { ...conversation.metadata, ...turn.metadata }
        }

        out.write(`${JSON.stringify(result)}\n`)
        results.push(result)

        history.push({ role: "user", text: turn.question, turnId: turn.turnId })
        history.push({
          role: "assistant",
          text: typeof body.answer === "string" ? body.answer : "",
          turnId: `${turn.turnId}:assistant`
        })
      }
    }
  } finally {
    out.end()
  }

  const summarized = summarizeConversationResults(results)
  const summary: SummaryOutput = {
    ...summarized,
    datasetPath,
    outputPath,
    summaryPath,
    reportPath,
    apiBaseUrl,
    benchmarkSuiteId,
    corpusSeed,
    generatedAt: new Date().toISOString()
  }
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8")
  await writeFile(reportPath, renderConversationReport(summary), "utf-8")
  return summary
}

export async function* readConversationDataset(filePath: string): AsyncGenerator<ConversationDatasetRow> {
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity
  })
  for await (const line of rl) {
    if (!line.trim()) continue
    yield JSON.parse(line) as ConversationDatasetRow
  }
}

async function runBenchmarkQuery(input: Parameters<typeof api.benchmark.query>[0]): Promise<{
  status: number
  body: ConversationBenchmarkResponse
}> {
  try {
    return { status: 200, body: await api.benchmark.query(input) }
  } catch (error) {
    return {
      status: 0,
      body: { error: error instanceof Error ? error.message : String(error) }
    }
  }
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === new URL(`file://${process.argv[1]}`).href : false
}
