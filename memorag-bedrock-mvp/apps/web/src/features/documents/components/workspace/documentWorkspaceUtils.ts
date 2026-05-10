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

export function countDocumentsForGroup(documents: DocumentManifest[], groupId: string): number {
  return documents.filter((document) => documentGroupIds(document).includes(groupId)).length
}

export function documentGroupIds(document: DocumentManifest): string[] {
  const raw = document.metadata?.groupIds ?? document.metadata?.groupId
  return typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
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

function mimeTypeLabel(mimeType: string): string {
  if (mimeType === "text/markdown") return "Markdown"
  if (mimeType === "text/plain") return "Text"
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word"
  if (mimeType === "application/vnd.ms-powerpoint" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "PowerPoint"
  return mimeType
}
