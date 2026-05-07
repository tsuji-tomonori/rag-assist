import type { DocumentIngestRun } from "../types.js"

export type CreateDocumentIngestRunInput = DocumentIngestRun

export type UpdateDocumentIngestRunInput = Partial<Omit<DocumentIngestRun, "runId" | "createdAt" | "createdBy">>

export interface DocumentIngestRunStore {
  create(input: CreateDocumentIngestRunInput): Promise<DocumentIngestRun>
  get(runId: string): Promise<DocumentIngestRun | undefined>
  update(runId: string, input: UpdateDocumentIngestRunInput): Promise<DocumentIngestRun>
}
