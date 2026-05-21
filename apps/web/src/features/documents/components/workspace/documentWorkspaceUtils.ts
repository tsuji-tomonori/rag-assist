import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../../types.js"
import type { DocumentOperationState } from "../../hooks/useDocuments.js"

export type WorkspaceFolder = {
  id: string
  name: string
  path: string
  count: number
  depth: number
  group?: DocumentGroup
}

export type ConfirmAction =
  | { kind: "delete"; document: DocumentManifest }
  | { kind: "stage"; document: DocumentManifest }
  | { kind: "cutover"; migration: ReindexMigration }
  | { kind: "rollback"; migration: ReindexMigration }

export type DocumentSortKey = "updatedDesc" | "updatedAsc" | "fileNameAsc" | "chunkDesc" | "typeAsc"

export const rootFolderParentValue = "__root__"

export const emptyOperationState: DocumentOperationState = {
  isUploading: false,
  creatingGroup: false,
  sharingGroupId: null,
  sharingDocumentId: null,
  movingDocumentId: null,
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

export function buildWorkspaceFolders(documentGroups: DocumentGroup[], documents: DocumentManifest[]): WorkspaceFolder[] {
  const groupsById = new Map(documentGroups.map((group) => [group.groupId, group]))
  const childrenByParentId = new Map<string, DocumentGroup[]>()
  const roots: DocumentGroup[] = []
  for (const group of documentGroups) {
    if (group.parentGroupId && groupsById.has(group.parentGroupId)) {
      childrenByParentId.set(group.parentGroupId, [...(childrenByParentId.get(group.parentGroupId) ?? []), group])
    } else {
      roots.push(group)
    }
  }

  const folders: WorkspaceFolder[] = []
  const visited = new Set<string>()
  const appendGroup = (group: DocumentGroup, depth: number) => {
    if (visited.has(group.groupId)) return
    visited.add(group.groupId)
    const canonicalPath = group.canonicalPath
    folders.push({
      id: group.groupId,
      name: group.name,
      path: `/ ドキュメントグループ${canonicalPath}`,
      count: countDocumentsForGroup(documents, group.groupId),
      depth,
      group
    })
    for (const child of sortedGroups(childrenByParentId.get(group.groupId) ?? [])) {
      appendGroup(child, depth + 1)
    }
  }

  for (const root of sortedGroups(roots)) appendGroup(root, 0)
  for (const group of sortedGroups(documentGroups)) appendGroup(group, 0)
  return folders
}

export function documentGroupIds(document: DocumentManifest): string[] {
  const raw = document.metadata?.groupIds ?? document.metadata?.groupId
  return typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
}

export function documentGroupNames(document: DocumentManifest, documentGroups: DocumentGroup[]): string[] {
  return documentGroupIds(document).map((groupId) => documentGroups.find((group) => group.groupId === groupId)?.name ?? groupId)
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "ja"))
}

function sortedGroups(groups: DocumentGroup[]): DocumentGroup[] {
  return [...groups].sort((left, right) => left.name.localeCompare(right.name, "ja") || left.groupId.localeCompare(right.groupId, "ja"))
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
