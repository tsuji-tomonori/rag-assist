import { createBenchmarkDownload } from "../../features/benchmark/api/benchmarkApi.js"
import { createDebugDownload } from "../../features/debug/api/debugApi.js"
import type { DebugTrace } from "../../features/debug/types.js"
import { sanitizeFileName } from "./format.js"

export async function downloadDebugTrace(trace?: DebugTrace) {
  if (!trace) return

  const signed = await createDebugDownload(trace.runId)
  const link = document.createElement("a")
  link.href = signed.url
  link.download = `debug-trace-${sanitizeFileName(trace.runId)}.json`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function downloadBenchmarkArtifact(runId: string, artifact: "report" | "summary" | "results") {
  const signed = await createBenchmarkDownload(runId, artifact)
  const link = document.createElement("a")
  link.href = signed.url
  link.download = `benchmark-${artifact}-${sanitizeFileName(runId)}`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}
