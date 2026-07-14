import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"

type DocumentIngestRunMarkFailedEvent = {
  tenantId?: string
  runId?: string
  errorInfo?: {
    Error?: string
    Cause?: string
  }
}

const service = new MemoRagService(createDependencies())

export async function handler(event: DocumentIngestRunMarkFailedEvent): Promise<{ runId: string; status: string; traceId?: string; replayVersionManifest?: unknown }> {
  const runId = event.runId
  if (!event.tenantId || !runId) throw new Error("tenantId and runId are required")
  const run = await service.markDocumentIngestRunFailed(event.tenantId, runId, failureMessage(event.errorInfo))
  return {
    runId: run.runId,
    status: run.status,
    traceId: run.traceId,
    replayVersionManifest: run.replayVersionManifest
  }
}

function failureMessage(errorInfo?: DocumentIngestRunMarkFailedEvent["errorInfo"]): string {
  if (!errorInfo) return "Document ingest worker failed"
  return [errorInfo.Error, errorInfo.Cause].filter(Boolean).join(": ") || "Document ingest worker failed"
}
