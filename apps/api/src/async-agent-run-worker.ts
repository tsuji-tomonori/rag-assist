import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { WorkerEventSchema, WorkerResultSchema } from "./schemas.js"
import type { WorkerEvent, WorkerResult } from "./types.js"

type AsyncAgentRunWorkerEvent = Partial<WorkerEvent> & {
  agentRunId?: string
}

const service = new MemoRagService(createDependencies())

export async function handler(event: AsyncAgentRunWorkerEvent): Promise<WorkerResult> {
  const runId = event.runId ?? event.agentRunId
  const parsed = WorkerEventSchema.safeParse({ ...event, runId, targetType: event.targetType ?? "async_agent_run" })
  if (!parsed.success) throw new Error("runId is required")
  const run = await service.executeAsyncAgentRun(parsed.data.runId)
  return WorkerResultSchema.parse({
    runId: run.runId,
    targetType: "async_agent_run",
    status: run.status,
    resultType: run.status === "failed" || run.status === "blocked" || run.status === "cancelled" ? "failed" : "succeeded",
    error: run.failureReasonCode
      ? {
          code: run.failureReasonCode === "cancelled" ? "execution_error" : "execution_error",
          message: run.failureReason ?? run.failureReasonCode,
          retryable: false
        }
      : undefined
  })
}
