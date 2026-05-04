import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"

type ChatRunMarkFailedEvent = {
  runId?: string
  errorInfo?: {
    Error?: string
    Cause?: string
  }
}

const service = new MemoRagService(createDependencies())

export async function handler(event: ChatRunMarkFailedEvent): Promise<{ runId: string; status: string }> {
  const runId = event.runId
  if (!runId) throw new Error("runId is required")
  const run = await service.markChatRunFailed(runId, failureMessage(event.errorInfo))
  return { runId: run.runId, status: run.status }
}

function failureMessage(errorInfo?: ChatRunMarkFailedEvent["errorInfo"]): string {
  const errorName = errorInfo?.Error ?? "States.TaskFailed"
  const cause = parseCause(errorInfo?.Cause)
  if (cause) return `${errorName}: ${cause}`
  return `${errorName}: chat run worker failed`
}

function parseCause(cause?: string): string | undefined {
  if (!cause) return undefined
  try {
    const parsed = JSON.parse(cause) as { errorMessage?: unknown; Cause?: unknown }
    if (typeof parsed.errorMessage === "string") return parsed.errorMessage
    if (typeof parsed.Cause === "string") return parsed.Cause
  } catch {
    return cause
  }
  return cause
}
