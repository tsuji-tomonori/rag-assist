import type { RetrievedVector, VectorKind, VectorRecord } from "../types.js"

export type VectorFilter = {
  kind?: VectorKind
  documentId?: string
  documentIds?: string[]
  tenantId?: string
  department?: string
  source?: string
  docType?: string
  benchmarkSuiteId?: string
  lifecycleStatus?: "active" | "staging" | "superseded"
  ragEligibility?: VectorRecord["metadata"]["ragEligibility"]
  allowedGroups?: string[]
}

export interface VectorStore {
  put(records: VectorRecord[]): Promise<void>
  getByKeys?(keys: string[]): Promise<VectorRecord[]>
  query(vector: number[], topK: number, filter?: VectorFilter): Promise<RetrievedVector[]>
  delete(keys: string[]): Promise<void>
  updateMetadataForDocument?(documentId: string, metadata: Partial<VectorRecord["metadata"]>): Promise<void>
}
