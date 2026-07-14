import type { BenchmarkRun } from "../types.js"

export type CreateBenchmarkRunInput = BenchmarkRun

export type UpdateBenchmarkRunInput = Partial<Omit<BenchmarkRun, "tenantId" | "runId" | "createdAt" | "createdBy">>

export interface BenchmarkRunStore {
  create(input: CreateBenchmarkRunInput): Promise<BenchmarkRun>
  list(tenantId: string, limit?: number): Promise<BenchmarkRun[]>
  listAll?(tenantId: string): Promise<BenchmarkRun[]>
  /** Strongly consistent primary-table enumeration used by deny cleanup; includes legacy rows pending backfill. */
  listAllAuthoritative?(tenantId: string): Promise<BenchmarkRun[]>
  get(tenantId: string, runId: string): Promise<BenchmarkRun | undefined>
  update(tenantId: string, runId: string, input: UpdateBenchmarkRunInput): Promise<BenchmarkRun>
}
