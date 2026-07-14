import { createHeaders, delJson, get, getBlob, post, put } from "../../../shared/api/http.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"

export type UpdateDocumentGroupInput = {
  name?: string
  description?: string
}

export type MoveDocumentGroupInput = {
  destinationParentId: string | null
  newName?: string
  reason: string
  expectedVersion: string
}

export type MoveDocumentGroupResponse = {
  operationId: string
  folder: DocumentGroup
  subtree: DocumentGroup[]
  affectedDocumentCount: number
  directDocumentGrantsPreserved: true
  folderLocalPoliciesPreserved: true
  documentVersionsPreserved: true
}

export type FolderPolicyEntry = {
  principalType: "user" | "group"
  principalId: string
  permissionLevel: "deny" | "readOnly" | "full"
}

export type FolderPolicy = {
  policyId: string
  tenantId: string
  folderId: string
  entries: FolderPolicyEntry[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type VersionedFolderPolicy = {
  policy: FolderPolicy | null
  version: string
}

export type ReplacedVersionedFolderPolicy = {
  policy: FolderPolicy
  version: string
  auditIntentId: string
}

export type DocumentPermissionLevel = "readOnly" | "full"
export type DocumentPolicyPermissionLevel = "deny" | DocumentPermissionLevel

export type DocumentShareGrantInput = {
  principalType: "user" | "group"
  principalId: string
  permissionLevel: DocumentPolicyPermissionLevel
}

export type DocumentShareGrant = DocumentShareGrantInput & {
  documentShareGrantId: string
  tenantId: string
  documentId: string
  createdBy: string
  reason: string
  createdAt: string
  updatedAt: string
}

export type DocumentShareInfo = {
  inheritedFolderGrants: Array<{ folderId: string; permissionLevel: "none" | DocumentPermissionLevel }>
  directDocumentGrants: DocumentShareGrant[]
  currentUserEffectivePermission: "none" | DocumentPermissionLevel
  version: string
}

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
  status: "queued" | "running" | "succeeded" | "rejected" | "failed" | "cancelled"
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
    if (run.status === "rejected") throw new Error(run.error ?? "文書取り込みは受け入れポリシーにより拒否されました")
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

type AuthorizedCollectionPage<T, K extends string> = {
  count: number
  nextCursor?: string
  responseProfileVersion: "resource-non-enumeration-v1"
} & Record<K, T[]>

export type DocumentExtractedTextDownload = {
  blob: Blob
  fileName: string
}

export async function listDocumentsPage(options: { cursor?: string; limit?: number } = {}): Promise<AuthorizedCollectionPage<DocumentManifest, "documents">> {
  return get<AuthorizedCollectionPage<DocumentManifest, "documents">>(collectionRequestPath("/documents", options))
}

export async function listDocuments(): Promise<DocumentManifest[]> {
  return collectAuthorizedPages("documents", listDocumentsPage)
}

export async function listDocumentGroupsPage(options: { cursor?: string; limit?: number } = {}): Promise<AuthorizedCollectionPage<DocumentGroup, "groups">> {
  return get<AuthorizedCollectionPage<DocumentGroup, "groups">>(collectionRequestPath("/document-groups", options))
}

export async function listDocumentGroups(): Promise<DocumentGroup[]> {
  return collectAuthorizedPages("groups", listDocumentGroupsPage)
}

export async function requestDocumentExtractedTextDownload(documentId: string): Promise<DocumentExtractedTextDownload> {
  const response = await getBlob(`/documents/${encodeURIComponent(documentId)}/extracted-text`)
  const fileName = contentDispositionFileName(response.headers.get("content-disposition"))
  if (!fileName) throw new Error("抽出テキストのダウンロードファイル名を確認できません")
  return { blob: response.blob, fileName }
}

export function saveDocumentExtractedTextDownload(download: DocumentExtractedTextDownload): void {
  const objectUrl = URL.createObjectURL(download.blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = download.fileName
  anchor.hidden = true
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

export async function createDocumentGroup(input: {
  name: string
  description?: string
  parentGroupId?: string
}): Promise<DocumentGroup> {
  return post<DocumentGroup>("/document-groups", input)
}

export async function updateDocumentGroup(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
  return post<DocumentGroup>(`/document-groups/${encodeURIComponent(groupId)}/share`, input)
}

export async function moveDocumentGroup(groupId: string, input: MoveDocumentGroupInput): Promise<MoveDocumentGroupResponse> {
  try {
    return await post<MoveDocumentGroupResponse>(`/document-groups/${encodeURIComponent(groupId)}/move`, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("Folder move conflict")) {
      throw new Error("フォルダが他の操作で更新されました。最新状態を再読み込みしてから再実行してください。", { cause: error })
    }
    throw error
  }
}

export async function shareDocumentGroup(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
  return updateDocumentGroup(groupId, input)
}

export async function getFolderSharePolicy(groupId: string): Promise<VersionedFolderPolicy> {
  return get<VersionedFolderPolicy>(`/document-groups/${encodeURIComponent(groupId)}/share`)
}

export async function replaceFolderSharePolicy(groupId: string, input: {
  expectedVersion: string
  entries: FolderPolicyEntry[]
  reason: string
}): Promise<ReplacedVersionedFolderPolicy> {
  return put<ReplacedVersionedFolderPolicy>(`/document-groups/${encodeURIComponent(groupId)}/share`, input)
}

export async function getDocumentShare(documentId: string): Promise<DocumentShareInfo> {
  return get<DocumentShareInfo>(`/documents/${encodeURIComponent(documentId)}/share`)
}

export async function updateDocumentShare(documentId: string, input: {
  grants: DocumentShareGrantInput[]
  expectedVersion: string
  reason: string
}): Promise<DocumentShareInfo> {
  return put<DocumentShareInfo>(`/documents/${encodeURIComponent(documentId)}/share`, input)
}

export async function moveDocument(documentId: string, input: {
  destinationFolderId: string
  newTitle?: string
  reason: string
  expectedUpdatedAt?: string
}): Promise<{ document: DocumentManifest }> {
  return post<{ document: DocumentManifest }>(`/documents/${encodeURIComponent(documentId)}/move`, input)
}

export async function deleteDocument(documentId: string, input: { expectedUpdatedAt: string; reason: string }): Promise<void> {
  return delJson(`/documents/${encodeURIComponent(documentId)}`, input)
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

function collectionRequestPath(basePath: string, options: { cursor?: string; limit?: number }): string {
  const query = new URLSearchParams()
  if (options.cursor) query.set("cursor", options.cursor)
  if (options.limit !== undefined) query.set("limit", String(options.limit))
  const encoded = query.toString()
  return encoded ? `${basePath}?${encoded}` : basePath
}

async function collectAuthorizedPages<T, K extends "documents" | "groups">(
  key: K,
  loadPage: (options?: { cursor?: string; limit?: number }) => Promise<AuthorizedCollectionPage<T, K>>
): Promise<T[]> {
  const items: T[] = []
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await loadPage(cursor ? { cursor } : undefined)
    items.push(...page[key])
    cursor = page.nextCursor
    if (cursor && seenCursors.has(cursor)) throw new Error("文書一覧の cursor が繰り返されました")
    if (cursor) seenCursors.add(cursor)
  } while (cursor)
  return items
}

function contentDispositionFileName(header: string | null): string | undefined {
  if (!header) return undefined
  const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(header)?.[1]
  const quoted = /filename="([^"]+)"/iu.exec(header)?.[1]
  let candidate: string | undefined
  try {
    candidate = encoded ? decodeURIComponent(encoded) : quoted
  } catch {
    return undefined
  }
  if (!candidate) return undefined
  const leaf = candidate.split(/[\\/]/u).filter(Boolean).at(-1)
  return leaf?.trim() || undefined
}
