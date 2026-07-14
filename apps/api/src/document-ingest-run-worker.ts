import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { WorkerEventSchema, WorkerResultSchema } from "./schemas.js"
import type { DocumentIngestRun, WorkerEvent, WorkerResult } from "./types.js"
import { ProductionRagObservationProducer, bestEffortCapture } from "./rag/quality-control/production-rag-observation-producer.js"
import { minimizedRevokedWorkerResult } from "./security/public-resource-response.js"

type DocumentIngestRunWorkerEvent = Partial<WorkerEvent>

const deps = createDependencies()
const service = new MemoRagService(deps)
const observationProducer = new ProductionRagObservationProducer(deps.objectStore)

export async function handler(event: DocumentIngestRunWorkerEvent): Promise<WorkerResult> {
  const parsed = WorkerEventSchema.safeParse({ ...event, targetType: event.targetType ?? "document_ingest_run" })
  if (!parsed.success) throw new Error("tenantId and runId are required")
  const runId = parsed.data.runId
  const run = await service.executeDocumentIngestRun(parsed.data.tenantId, runId)
  const result = toDocumentIngestWorkerResult(run)
  await bestEffortCapture("document_ingest_worker_outcome", () => observationProducer.captureWorkerOutcome({ result, run }))
  return result
}

export function toDocumentIngestWorkerResult(run: DocumentIngestRun): WorkerResult {
  const revoked = run.errorCode === "permission_revoked" ? minimizedRevokedWorkerResult() : undefined
  return WorkerResultSchema.parse({
    runId: run.runId,
    targetType: "document_ingest_run",
    status: revoked?.status ?? run.status,
    resultType: run.status === "failed" ? "failed" : "succeeded",
    traceId: revoked ? undefined : run.traceId,
    replayVersionManifest: revoked ? undefined : run.replayVersionManifest,
    responseProfileVersion: revoked?.responseProfileVersion,
    error: run.errorCode
      ? { code: run.errorCode, message: revoked?.status ?? run.error ?? run.errorCode, retryable: false }
      : undefined
  })
}
