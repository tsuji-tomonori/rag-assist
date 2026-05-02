import type { BenchmarkRun } from "../types.js"

export type CreateBenchmarkRunInput = BenchmarkRun

export type UpdateBenchmarkRunInput = Partial<Omit<BenchmarkRun, "runId" | "createdAt" | "createdBy">>

export interface BenchmarkRunStore {
  create(input: CreateBenchmarkRunInput): Promise<BenchmarkRun>
  list(limit?: number): Promise<BenchmarkRun[]>
  get(runId: string): Promise<BenchmarkRun | undefined>
  update(runId: string, input: UpdateBenchmarkRunInput): Promise<BenchmarkRun>
}
