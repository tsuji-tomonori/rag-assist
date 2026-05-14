import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { WorkerEventSchema, WorkerResultSchema } from "./schemas.js"
import type { WorkerEvent, WorkerResult } from "./types.js"

type ChatRunWorkerEvent = Partial<WorkerEvent>

const service = new MemoRagService(createDependencies())

export async function handler(event: ChatRunWorkerEvent): Promise<WorkerResult> {
  const parsed = WorkerEventSchema.safeParse({ ...event, targetType: event.targetType ?? "chat_run" })
  if (!parsed.success) throw new Error("runId is required")
  const runId = parsed.data.runId
  const run = await service.executeChatRun(runId)
  return WorkerResultSchema.parse({ runId: run.runId, targetType: "chat_run", status: run.status, resultType: run.status === "failed" ? "failed" : "succeeded" })
}
