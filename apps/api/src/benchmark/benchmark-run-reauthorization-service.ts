import type { BenchmarkRunStore } from "../adapters/benchmark-run-store.js"
import {
  PermissionRevokedError,
  isPermissionRevokedError,
  type WorkerAuthorizationBoundary
} from "../security/current-worker-authorization.js"
import type { BenchmarkRun } from "../types.js"

export type BenchmarkRunReauthorizationPorts = {
  benchmarkRunStore: Pick<BenchmarkRunStore, "get" | "update">
  authorizeBoundary: (run: BenchmarkRun, boundary: WorkerAuthorizationBoundary) => Promise<unknown>
  reconcileRevokedArtifacts: (
    run: BenchmarkRun,
    boundary: WorkerAuthorizationBoundary,
    revoked: PermissionRevokedError
  ) => Promise<void>
  now: () => string
}

export class BenchmarkRunReauthorizationService {
  constructor(private readonly ports: BenchmarkRunReauthorizationPorts) {}

  async reauthorize(
    tenantId: string,
    runId: string,
    boundary: WorkerAuthorizationBoundary
  ): Promise<BenchmarkRun> {
    const run = await this.ports.benchmarkRunStore.get(tenantId, runId)
    if (!run) throw new PermissionRevokedError("benchmark_run_unavailable")
    if (run.status === "failed" && run.errorCode === "permission_revoked") {
      throw new PermissionRevokedError("benchmark_run_authorization_already_revoked")
    }
    if (boundary === "start" ? run.status !== "queued" : run.status !== "running") {
      throw new Error("benchmark_run_not_active")
    }

    try {
      await this.ports.authorizeBoundary(run, boundary)
      return run
    } catch (error) {
      if (!isPermissionRevokedError(error)) throw error
      const completedAt = this.ports.now()
      const failed = await this.ports.benchmarkRunStore.update(tenantId, runId, {
        status: "failed",
        error: "permission_revoked",
        errorCode: "permission_revoked",
        completedAt,
        updatedAt: completedAt
      })
      await this.ports.reconcileRevokedArtifacts(failed, boundary, error)
      throw error
    }
  }
}
