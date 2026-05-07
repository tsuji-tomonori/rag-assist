import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"

type DocumentIngestRunWorkerEvent = {
  runId?: string
}

const service = new MemoRagService(createDependencies())

export async function handler(event: DocumentIngestRunWorkerEvent): Promise<{ runId: string; status: string }> {
  const runId = event.runId
  if (!runId) throw new Error("runId is required")
  const run = await service.executeDocumentIngestRun(runId)
  return { runId: run.runId, status: run.status }
}
