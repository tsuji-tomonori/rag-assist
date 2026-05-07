import { createHeaders, del, get, post } from "../../../shared/api/http.js"
import type { DocumentManifest, ReindexMigration } from "../types.js"

export async function uploadDocument(input: {
  fileName: string
  text?: string
  contentBase64?: string
  textractJson?: string
  mimeType?: string
  memoryModelId?: string
  embeddingModelId?: string
}): Promise<DocumentManifest> {
  return post<DocumentManifest>("/documents", input)
}

type UploadSession = {
  uploadId: string
  objectKey: string
  uploadUrl: string
  method: "PUT" | "POST"
  headers: Record<string, string>
  expiresInSeconds: number
  requiresAuth: boolean
}

export async function createDocumentUpload(input: {
  fileName: string
  mimeType?: string
  purpose?: "document" | "benchmarkSeed"
}): Promise<UploadSession> {
  return post<UploadSession>("/documents/uploads", input)
}

export async function ingestUploadedDocument(uploadId: string, input: {
  fileName: string
  mimeType?: string
  memoryModelId?: string
  embeddingModelId?: string
}): Promise<DocumentManifest> {
  return post<DocumentManifest>(`/documents/uploads/${encodeURIComponent(uploadId)}/ingest`, input)
}

export async function uploadDocumentFile(input: {
  file: File
  memoryModelId?: string
  embeddingModelId?: string
}): Promise<DocumentManifest> {
  const mimeType = input.file.type || undefined
  const upload = await createDocumentUpload({
    fileName: input.file.name,
    mimeType,
    purpose: "document"
  })
  const uploadHeaders = {
    ...upload.headers,
    ...(upload.requiresAuth ? createHeaders() : {})
  }
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: uploadHeaders,
    body: input.file
  })
  if (!uploadResponse.ok) throw new Error(await uploadResponse.text())
  return ingestUploadedDocument(upload.uploadId, {
    fileName: input.file.name,
    mimeType,
    memoryModelId: input.memoryModelId,
    embeddingModelId: input.embeddingModelId
  })
}

export async function listDocuments(): Promise<DocumentManifest[]> {
  const result = await get<{ documents: DocumentManifest[] }>("/documents")
  return result.documents
}

export async function deleteDocument(documentId: string): Promise<void> {
  return del(`/documents/${encodeURIComponent(documentId)}`)
}

export async function reindexDocument(documentId: string): Promise<DocumentManifest> {
  return post<DocumentManifest>(`/documents/${encodeURIComponent(documentId)}/reindex`, {})
}

export async function stageReindexMigration(documentId: string): Promise<ReindexMigration> {
  return post<ReindexMigration>(`/documents/${encodeURIComponent(documentId)}/reindex/stage`, {})
}

export async function cutoverReindexMigration(migrationId: string): Promise<ReindexMigration> {
  return post<ReindexMigration>(`/documents/reindex-migrations/${encodeURIComponent(migrationId)}/cutover`, {})
}

export async function rollbackReindexMigration(migrationId: string): Promise<ReindexMigration> {
  return post<ReindexMigration>(`/documents/reindex-migrations/${encodeURIComponent(migrationId)}/rollback`, {})
}

export async function listReindexMigrations(): Promise<ReindexMigration[]> {
  const result = await get<{ migrations?: ReindexMigration[] }>("/documents/reindex-migrations")
  return result.migrations ?? []
}
