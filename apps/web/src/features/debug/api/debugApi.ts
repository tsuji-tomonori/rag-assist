import { get, post } from "../../../shared/api/http.js"
import type { DebugDownloadResponse, DebugTrace } from "../types.js"

export async function listDebugRuns(): Promise<DebugTrace[]> {
  const result = await get<{ debugRuns: DebugTrace[] }>("/debug-runs")
  return result.debugRuns
}

export async function getDebugRun(runId: string): Promise<DebugTrace> {
  return get<DebugTrace>(`/debug-runs/${encodeURIComponent(runId)}`)
}

export async function createDebugDownload(runId: string): Promise<DebugDownloadResponse> {
  return post<DebugDownloadResponse>(`/debug-runs/${encodeURIComponent(runId)}/download`, {})
}
