import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../../types.js"
import type { DocumentOperationState, DocumentUploadState } from "../../hooks/useDocuments.js"

export type WorkspaceFolder = {
  id: string
  name: string
  path: string
  count: number
  group?: DocumentGroup
}

export type ConfirmAction =
  | { kind: "delete"; document: DocumentManifest }
  | { kind: "stage"; document: DocumentManifest }
  | { kind: "cutover"; migration: ReindexMigration }
  | { kind: "rollback"; migration: ReindexMigration }

export type DocumentSortKey = "updatedDesc" | "updatedAsc" | "fileNameAsc" | "chunkDesc" | "typeAsc"

export type DocumentOperationEvent = {
  id: string
  actionLabel: string
  target: string
  occurredAt?: string
  actor?: string
  result: "反映済み" | "要求済み" | "進行中" | "失敗"
  detail?: string
}

export const emptyOperationState: DocumentOperationState = {
  isUploading: false,
  creatingGroup: false,
  sharingGroupId: null,
  deletingDocumentId: null,
  stagingReindexDocumentId: null,
  cutoverMigrationId: null,
  rollbackMigrationId: null
}

export function fileTypeLabel(document: DocumentManifest): string {
  if (document.mimeType) return mimeTypeLabel(document.mimeType)
  const extension = document.fileName.split(".").pop()?.toLowerCase()
  if (extension === "md" || extension === "markdown") return "Markdown"
  if (extension === "tex") return "TeX"
  if (extension === "pdf") return "PDF"
  if (extension === "doc" || extension === "docx") return "Word"
  if (extension === "ppt" || extension === "pptx") return "PowerPoint"
  return extension?.toUpperCase() ?? "File"
}

export function fileTypeClassName(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file"
}

export function compareDocuments(left: DocumentManifest, right: DocumentManifest, sort: DocumentSortKey): number {
  if (sort === "updatedAsc") return compareDocumentUpdatedAt(left, right) || left.fileName.localeCompare(right.fileName, "ja")
  if (sort === "fileNameAsc") return left.fileName.localeCompare(right.fileName, "ja")
  if (sort === "chunkDesc") return right.chunkCount - left.chunkCount
  if (sort === "typeAsc") return fileTypeLabel(left).localeCompare(fileTypeLabel(right), "ja") || left.fileName.localeCompare(right.fileName, "ja")
  return compareDocumentUpdatedAt(right, left) || left.fileName.localeCompare(right.fileName, "ja")
}

export function documentUpdatedAt(document: DocumentManifest): string {
  const metadataUpdatedAt = metadataString(document, "updatedAt")
  if (metadataUpdatedAt) return metadataUpdatedAt
  return typeof document.updatedAt === "string" && document.updatedAt.trim() ? document.updatedAt : document.createdAt
}

export function countDocumentsForGroup(documents: DocumentManifest[], groupId: string): number {
  return documents.filter((document) => documentGroupIds(document).includes(groupId)).length
}

export function documentGroupIds(document: DocumentManifest): string[] {
  const raw = document.metadata?.groupIds ?? document.metadata?.groupId
  return typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
}

export function documentGroupNames(document: DocumentManifest, documentGroups: DocumentGroup[]): string[] {
  return documentGroupIds(document).map((groupId) => documentGroups.find((group) => group.groupId === groupId)?.name ?? groupId)
}

export function sharedEntries(group: DocumentGroup): Array<{ kind: string; value: string }> {
  const entries = [
    ...group.sharedGroups.map((value) => ({ kind: "Cognito group", value })),
    ...group.sharedUserIds.map((value) => ({ kind: "User ID", value }))
  ]
  if (group.visibility === "org") entries.unshift({ kind: "公開範囲", value: "組織全体" })
  return entries
}

export function uploadStepClassName(index: number, activeIndex: number, phase: NonNullable<DocumentUploadState>["phase"]): string {
  if (phase === "failed") return "failed"
  if (index < activeIndex) return "done"
  if (index === activeIndex) return "active"
  return ""
}

export function uploadErrorLabel(errorKind: NonNullable<DocumentUploadState>["errorKind"]): string {
  if (errorKind === "fileType") return "ファイル形式"
  if (errorKind === "extraction") return "抽出失敗"
  if (errorKind === "timeout") return "タイムアウト"
  if (errorKind === "permission") return "権限不足"
  if (errorKind === "network") return "ネットワーク失敗"
  return "不明"
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "ja"))
}

export function documentStatusLabel(document: DocumentManifest): string {
  return document.lifecycleStatus ?? "active"
}

export function parseListInput(value: string): { groups: string[]; duplicates: string[]; hasEmptyToken: boolean } {
  const raw = value.split(",")
  const hasEmptyToken = raw.length > 1 && raw.some((item) => item.trim().length === 0)
  const groups: string[] = []
  const duplicates = new Set<string>()
  for (const item of raw) {
    const group = item.trim()
    if (!group) continue
    if (groups.includes(group)) duplicates.add(group)
    else groups.push(group)
  }
  return { groups, duplicates: [...duplicates], hasEmptyToken }
}

export function parseSharedGroups(value: string): { groups: string[]; duplicates: string[]; hasEmptyToken: boolean } {
  return parseListInput(value)
}

export function buildShareDiff(currentGroups: string[], draftGroups: string[]): { added: string[]; removed: string[]; unchanged: string[] } {
  return {
    added: draftGroups.filter((group) => !currentGroups.includes(group)),
    removed: currentGroups.filter((group) => !draftGroups.includes(group)),
    unchanged: draftGroups.filter((group) => currentGroups.includes(group))
  }
}

export function metadataString(document: DocumentManifest, key: string): string | undefined {
  const value = document.metadata?.[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

export function metadataNumber(document: DocumentManifest, key: string): number | undefined {
  const value = document.metadata?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function visibilityLabel(group: DocumentGroup): string {
  if (group.visibility === "org") return `${group.name}: 組織全体`
  if (group.visibility === "shared") return `${group.name}: shared`
  return `${group.name}: private`
}

export function visibilityLabelValue(visibility: "private" | "shared" | "org"): string {
  if (visibility === "org") return "組織全体"
  if (visibility === "shared") return "指定 group 共有"
  return "非公開"
}

export function buildOperationEvents({
  documents,
  documentGroups,
  migrations,
  uploadState,
  sessionOperationEvents
}: {
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  migrations: ReindexMigration[]
  uploadState: DocumentUploadState
  sessionOperationEvents: DocumentOperationEvent[]
}): DocumentOperationEvent[] {
  const documentEvents = documents.map((document) => ({
    id: `document-${document.documentId}`,
    actionLabel: "文書更新",
    target: document.fileName,
    occurredAt: documentUpdatedAt(document),
    result: "反映済み" as const,
    detail: `documentId: ${document.documentId}`
  }))
  const groupEvents = documentGroups.map((group) => ({
    id: `group-${group.groupId}`,
    actionLabel: group.updatedAt === group.createdAt ? "フォルダ作成" : "フォルダ更新",
    target: group.name,
    occurredAt: group.updatedAt,
    actor: group.ownerUserId,
    result: "反映済み" as const,
    detail: `公開範囲: ${visibilityLabelValue(group.visibility)}`
  }))
  const migrationEvents = migrations.map((migration) => ({
    id: `migration-${migration.migrationId}`,
    actionLabel: migrationActionLabel(migration.status),
    target: `${migration.sourceDocumentId} → ${migration.stagedDocumentId}`,
    occurredAt: migration.updatedAt,
    actor: migration.createdBy,
    result: "反映済み" as const,
    detail: `migrationId: ${migration.migrationId}`
  }))
  const uploadEvent = uploadState ? [{
    id: `upload-${uploadState.fileName}`,
    actionLabel: "アップロード",
    target: uploadState.fileName,
    occurredAt: uploadState.updatedAt,
    result: uploadState.phase === "failed" ? "失敗" as const : uploadState.phase === "complete" ? "反映済み" as const : "進行中" as const,
    detail: uploadState.runId ? `run ID: ${uploadState.runId}` : undefined
  }] : []

  return [...sessionOperationEvents, ...uploadEvent, ...migrationEvents, ...groupEvents, ...documentEvents]
    .sort((left, right) => (right.occurredAt ?? "").localeCompare(left.occurredAt ?? ""))
    .slice(0, 8)
}

export function operationResultClassName(result: DocumentOperationEvent["result"]): string {
  if (result === "失敗") return "failed"
  if (result === "進行中") return "active"
  if (result === "要求済み") return "requested"
  return "done"
}

function migrationActionLabel(status: ReindexMigration["status"]): string {
  if (status === "cutover") return "reindex cutover"
  if (status === "rolled_back") return "reindex rollback"
  return "reindex stage"
}

function compareDocumentUpdatedAt(left: DocumentManifest, right: DocumentManifest): number {
  return documentUpdatedAt(left).localeCompare(documentUpdatedAt(right))
}

function mimeTypeLabel(mimeType: string): string {
  if (mimeType === "text/markdown") return "Markdown"
  if (mimeType === "text/plain") return "Text"
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word"
  if (mimeType === "application/vnd.ms-powerpoint" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "PowerPoint"
  return mimeType
}
