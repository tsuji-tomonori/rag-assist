import type { BenchmarkRunStore } from "../adapters/benchmark-run-store.js"
import type { AppUser } from "../auth.js"
import type { BenchmarkRun } from "../types.js"

export type BenchmarkExecutionStopInput = {
  executionArn: string
  cause: string
}

export type BenchmarkRunCancellationPorts = {
  benchmarkRunStore: Pick<BenchmarkRunStore, "get" | "update">
  tenantIdForActor: (actor: AppUser) => string
  stopExecution: (input: BenchmarkExecutionStopInput) => Promise<void>
  now: () => string
}

const benchmarkCancellationCause = "Cancelled from MemoRAG admin benchmark view"

export class BenchmarkRunCancellationService {
  constructor(private readonly ports: BenchmarkRunCancellationPorts) {}

  async cancel(actor: AppUser, runId: string): Promise<BenchmarkRun | undefined> {
    const tenantId = this.ports.tenantIdForActor(actor)
    const run = await this.ports.benchmarkRunStore.get(tenantId, runId)
    if (!run) return undefined

    if (run.executionArn) {
      await this.ports.stopExecution({
        executionArn: run.executionArn,
        cause: benchmarkCancellationCause
      })
    }

    return this.ports.benchmarkRunStore.update(tenantId, runId, {
      status: "cancelled",
      completedAt: this.ports.now()
    })
  }
}
