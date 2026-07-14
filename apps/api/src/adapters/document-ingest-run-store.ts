import type { DocumentIngestRun } from "../types.js"

export type CreateDocumentIngestRunInput = DocumentIngestRun

export type UpdateDocumentIngestRunInput = Partial<Omit<DocumentIngestRun, "tenantId" | "runId" | "createdAt" | "createdBy">>

export interface DocumentIngestRunStore {
  create(input: CreateDocumentIngestRunInput): Promise<DocumentIngestRun>
  list?(tenantId: string, limit?: number): Promise<DocumentIngestRun[]>
  listAll?(tenantId: string): Promise<DocumentIngestRun[]>
  /** Strongly consistent primary-table enumeration used by deny cleanup; includes legacy rows pending backfill. */
  listAllAuthoritative?(tenantId: string): Promise<DocumentIngestRun[]>
  get(tenantId: string, runId: string): Promise<DocumentIngestRun | undefined>
  update(tenantId: string, runId: string, input: UpdateDocumentIngestRunInput): Promise<DocumentIngestRun>
}
