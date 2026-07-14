import type { DocumentIngestRunEvent } from "../types.js"

export type CreateDocumentIngestRunEventInput = Omit<DocumentIngestRunEvent, "seq" | "createdAt"> & {
  seq?: number
  createdAt?: string
}

export interface DocumentIngestRunEventStore {
  append(tenantId: string, input: CreateDocumentIngestRunEventInput): Promise<DocumentIngestRunEvent>
  listAfter(tenantId: string, runId: string, afterSeq: number, limit?: number): Promise<DocumentIngestRunEvent[]>
}
