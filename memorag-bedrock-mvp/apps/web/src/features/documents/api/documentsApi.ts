import { del, get, post } from "../../../shared/api/http.js"
import type { DocumentManifest } from "../types.js"

export async function uploadDocument(input: {
  fileName: string
  text?: string
  contentBase64?: string
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
