import { get, post } from "../../../shared/api/http.js"
import type { DebugDownloadResponse } from "../../debug/types.js"
import type { BenchmarkMode, BenchmarkRun, BenchmarkRunner, BenchmarkSuite } from "../types.js"

export type BenchmarkDownloadArtifact = "report" | "summary" | "results" | "logs"

export async function listBenchmarkSuites(): Promise<BenchmarkSuite[]> {
  const result = await get<{ suites?: BenchmarkSuite[] }>("/benchmark-suites")
  return result.suites ?? []
}

export async function listBenchmarkRuns(): Promise<BenchmarkRun[]> {
  const result = await get<{ benchmarkRuns?: BenchmarkRun[] }>("/benchmark-runs")
  return result.benchmarkRuns ?? []
}

export async function startBenchmarkRun(input: {
  suiteId: string
  mode: BenchmarkMode
  runner: BenchmarkRunner
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
}): Promise<BenchmarkRun> {
  return post<BenchmarkRun>("/benchmark-runs", input)
}

export async function cancelBenchmarkRun(runId: string): Promise<BenchmarkRun> {
  return post<BenchmarkRun>(`/benchmark-runs/${encodeURIComponent(runId)}/cancel`, {})
}

export async function createBenchmarkDownload(runId: string, artifact: BenchmarkDownloadArtifact = "report"): Promise<DebugDownloadResponse> {
  return post<DebugDownloadResponse>(`/benchmark-runs/${encodeURIComponent(runId)}/download`, { artifact })
}
