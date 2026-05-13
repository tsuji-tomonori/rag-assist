import { createHeaders, del, get, post } from "../../../shared/api/http.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"

export async function uploadDocument(input: {
  fileName: string
  text?: string
  contentBase64?: string
  textractJson?: string
  mimeType?: string
  memoryModelId?: string
  embeddingModelId?: string
  scope?: {
    scopeType?: "personal" | "group" | "chat" | "benchmark"
    groupIds?: string[]
    temporaryScopeId?: string
    expiresAt?: string
  }
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

type DocumentIngestRun = {
  runId: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  eventsPath?: string
  manifest?: DocumentManifest
  error?: string
}

export type DocumentUploadProgress = {
  phase: "preparing" | "transferring" | "creatingRun" | "extracting" | "chunking" | "embedding" | "indexing" | "complete"
  runId?: string
}

export async function createDocumentUpload(input: {
  fileName: string
  mimeType?: string
  purpose?: "document" | "benchmarkSeed" | "chatAttachment"
}): Promise<UploadSession> {
  return post<UploadSession>("/documents/uploads", input)
}

export async function ingestUploadedDocument(uploadId: string, input: {
  fileName: string
  mimeType?: string
  memoryModelId?: string
  embeddingModelId?: string
  scope?: {
    scopeType?: "personal" | "group" | "chat" | "benchmark"
    groupIds?: string[]
    temporaryScopeId?: string
    expiresAt?: string
  }
}): Promise<DocumentManifest> {
  return post<DocumentManifest>(`/documents/uploads/${encodeURIComponent(uploadId)}/ingest`, input)
}

export async function startDocumentIngestRun(input: {
  uploadId: string
  fileName: string
  mimeType?: string
  memoryModelId?: string
  embeddingModelId?: string
  scope?: {
    scopeType?: "personal" | "group" | "chat" | "benchmark"
    groupIds?: string[]
    temporaryScopeId?: string
    expiresAt?: string
  }
}): Promise<DocumentIngestRun> {
  return post<DocumentIngestRun>("/document-ingest-runs", input)
}

export async function getDocumentIngestRun(runId: string): Promise<DocumentIngestRun> {
  return get<DocumentIngestRun>(`/document-ingest-runs/${encodeURIComponent(runId)}`)
}

export async function uploadDocumentFile(input: {
  file: File
  memoryModelId?: string
  embeddingModelId?: string
  purpose?: "document" | "chatAttachment"
  scope?: {
    scopeType?: "personal" | "group" | "chat"
    groupIds?: string[]
    temporaryScopeId?: string
    expiresAt?: string
  }
  onProgress?: (progress: DocumentUploadProgress) => void
}): Promise<DocumentManifest> {
  const mimeType = input.file.type || undefined
  input.onProgress?.({ phase: "preparing" })
  const upload = await createDocumentUpload({
    fileName: input.file.name,
    mimeType,
    purpose: input.purpose ?? "document"
  })
  const uploadHeaders = {
    ...upload.headers,
    ...(upload.requiresAuth ? createHeaders() : {})
  }
  input.onProgress?.({ phase: "transferring" })
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: uploadHeaders,
    body: input.file
  })
  if (!uploadResponse.ok) throw new Error(await uploadResponse.text())
  input.onProgress?.({ phase: "creatingRun" })
  const run = await startDocumentIngestRun({
    uploadId: upload.uploadId,
    fileName: input.file.name,
    mimeType,
    memoryModelId: input.memoryModelId,
    embeddingModelId: input.embeddingModelId,
    scope: input.scope
  })
  return waitForDocumentIngestRun(run, input.onProgress)
}

async function waitForDocumentIngestRun(initialRun: DocumentIngestRun, onProgress?: (progress: DocumentUploadProgress) => void): Promise<DocumentManifest> {
  let run = initialRun
  const deadline = Date.now() + 15 * 60 * 1000
  const pollPhases: DocumentUploadProgress["phase"][] = ["extracting", "chunking", "embedding", "indexing"]
  let pollCount = 0
  while (Date.now() < deadline) {
    if (run.status === "succeeded" && run.manifest) {
      onProgress?.({ phase: "complete", runId: run.runId })
      return run.manifest
    }
    if (run.status === "failed" || run.status === "cancelled") throw new Error(run.error ?? `document ingest run ${run.status}`)
    onProgress?.({ phase: pollPhases[Math.min(pollCount, pollPhases.length - 1)]!, runId: run.runId })
    await sleep(1000)
    run = await getDocumentIngestRun(run.runId)
    pollCount += 1
  }
  throw new Error("document ingest run timed out")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function listDocuments(): Promise<DocumentManifest[]> {
  const result = await get<{ documents: DocumentManifest[] }>("/documents")
  return result.documents
}

export async function listDocumentGroups(): Promise<DocumentGroup[]> {
  const result = await get<{ groups: DocumentGroup[] }>("/document-groups")
  return result.groups
}

export async function createDocumentGroup(input: {
  name: string
  description?: string
  parentGroupId?: string
  visibility?: "private" | "shared" | "org"
  sharedUserIds?: string[]
  sharedGroups?: string[]
  managerUserIds?: string[]
}): Promise<DocumentGroup> {
  return post<DocumentGroup>("/document-groups", input)
}

export async function shareDocumentGroup(groupId: string, input: {
  visibility?: "private" | "shared" | "org"
  parentGroupId?: string
  sharedUserIds?: string[]
  sharedGroups?: string[]
  managerUserIds?: string[]
}): Promise<DocumentGroup> {
  return post<DocumentGroup>(`/document-groups/${encodeURIComponent(groupId)}/share`, input)
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
