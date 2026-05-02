import type { RetrievedVector, VectorKind, VectorRecord } from "../types.js"

export type VectorFilter = {
  kind?: VectorKind
  documentId?: string
  tenantId?: string
  department?: string
  source?: string
  docType?: string
  allowedGroups?: string[]
}

export interface VectorStore {
  put(records: VectorRecord[]): Promise<void>
  query(vector: number[], topK: number, filter?: VectorFilter): Promise<RetrievedVector[]>
  delete(keys: string[]): Promise<void>
}
