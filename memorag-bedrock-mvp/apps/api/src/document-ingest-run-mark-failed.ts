import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"

type DocumentIngestRunMarkFailedEvent = {
  runId?: string
  errorInfo?: {
    Error?: string
    Cause?: string
  }
}

const service = new MemoRagService(createDependencies())

export async function handler(event: DocumentIngestRunMarkFailedEvent): Promise<{ runId: string; status: string }> {
  const runId = event.runId
  if (!runId) throw new Error("runId is required")
  const run = await service.markDocumentIngestRunFailed(runId, failureMessage(event.errorInfo))
  return { runId: run.runId, status: run.status }
}

function failureMessage(errorInfo?: DocumentIngestRunMarkFailedEvent["errorInfo"]): string {
  if (!errorInfo) return "Document ingest worker failed"
  return [errorInfo.Error, errorInfo.Cause].filter(Boolean).join(": ") || "Document ingest worker failed"
}
