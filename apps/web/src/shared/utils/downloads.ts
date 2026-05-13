import { createBenchmarkDownload, getBenchmarkCodeBuildLogs } from "../../features/benchmark/api/benchmarkApi.js"
import type { BenchmarkDownloadArtifact } from "../../features/benchmark/api/benchmarkApi.js"
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

export async function downloadBenchmarkArtifact(runId: string, artifact: BenchmarkDownloadArtifact) {
  if (artifact === "logs") {
    await downloadBenchmarkLogs(runId)
    return
  }

  const signed = await createBenchmarkDownload(runId, artifact)
  const extension = artifact === "report" ? ".md" : artifact === "summary" ? ".json" : ".jsonl"
  const link = document.createElement("a")
  link.href = signed.url
  link.download = `benchmark-${artifact}-${sanitizeFileName(runId)}${extension}`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadBenchmarkLogs(runId: string) {
  const text = await getBenchmarkCodeBuildLogs(runId)
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = `benchmark-logs-${sanitizeFileName(runId)}.txt`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
