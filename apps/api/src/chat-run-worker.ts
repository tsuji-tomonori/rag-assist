import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"

type ChatRunWorkerEvent = {
  runId?: string
}

const service = new MemoRagService(createDependencies())

export async function handler(event: ChatRunWorkerEvent): Promise<{ runId: string; status: string }> {
  const runId = event.runId
  if (!runId) throw new Error("runId is required")
  const run = await service.executeChatRun(runId)
  return { runId: run.runId, status: run.status }
}
