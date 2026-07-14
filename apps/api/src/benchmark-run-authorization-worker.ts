import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import type { WorkerAuthorizationBoundary } from "./security/current-worker-authorization.js"

const service = new MemoRagService(createDependencies())

type BenchmarkRunAuthorizationService = Pick<MemoRagService, "reauthorizeBenchmarkRunExecution">

export function createBenchmarkRunAuthorizationHandler(targetService: BenchmarkRunAuthorizationService) {
  return async (event: { tenantId?: unknown; runId?: unknown; boundary?: unknown }) => {
    if (typeof event.tenantId !== "string" || !event.tenantId.trim() || typeof event.runId !== "string" || !event.runId.trim()) {
      throw new Error("tenantId and runId are required")
    }
    if (!isWorkerAuthorizationBoundary(event.boundary)) throw new Error("authorization boundary is invalid")
    const run = await targetService.reauthorizeBenchmarkRunExecution(event.tenantId, event.runId, event.boundary)
    return { tenantId: run.tenantId, runId: run.runId, status: run.status, boundary: event.boundary, authorized: true }
  }
}

export const handler = createBenchmarkRunAuthorizationHandler(service)

function isWorkerAuthorizationBoundary(value: unknown): value is WorkerAuthorizationBoundary {
  return value === "start"
    || value === "protected_read"
    || value === "external_side_effect"
    || value === "durable_commit"
}
