import { del, get, post } from "../../../shared/api/http.js"
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
