import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { WorkerEventSchema, WorkerResultSchema } from "./schemas.js"
import type { ChatRun, WorkerEvent, WorkerResult } from "./types.js"
import { ProductionRagObservationProducer, bestEffortCapture } from "./rag/quality-control/production-rag-observation-producer.js"
import { minimizedRevokedWorkerResult } from "./security/public-resource-response.js"

type ChatRunWorkerEvent = Partial<WorkerEvent>

const deps = createDependencies()
const service = new MemoRagService(deps)
const observationProducer = new ProductionRagObservationProducer(deps.objectStore)

export async function handler(event: ChatRunWorkerEvent): Promise<WorkerResult> {
  const parsed = WorkerEventSchema.safeParse({ ...event, targetType: event.targetType ?? "chat_run" })
  if (!parsed.success) throw new Error("tenantId and runId are required")
  const runId = parsed.data.runId
  const run = await service.executeChatRun(parsed.data.tenantId, runId)
  const result = toChatWorkerResult(run)
  await bestEffortCapture("chat_worker_outcome", () => observationProducer.captureWorkerOutcome({ result, run }))
  return result
}

export function toChatWorkerResult(run: ChatRun): WorkerResult {
  const revoked = run.errorCode === "permission_revoked" ? minimizedRevokedWorkerResult() : undefined
  return WorkerResultSchema.parse({
    runId: run.runId,
    targetType: "chat_run",
    status: revoked?.status ?? run.status,
    resultType: run.status === "failed" ? "failed" : "succeeded",
    responseProfileVersion: revoked?.responseProfileVersion,
    error: run.errorCode
      ? { code: run.errorCode, message: revoked?.status ?? run.error ?? run.errorCode, retryable: false }
      : undefined
  })
}
