import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../../types.js"
import type { DocumentWorkspaceUrlState } from "../DocumentWorkspace.js"
import { documentStatusLabel, fileTypeLabel } from "./documentWorkspaceUtils.js"

export type DocumentWorkspaceStateNormalization = Readonly<{
  state: DocumentWorkspaceUrlState
  reasons: ReadonlyArray<"folder" | "document" | "migration" | "type" | "status" | "group" | "sort" | "page" | "pageSize">
}>

export function normalizeDocumentWorkspaceUrlState({
  state,
  documents,
  documentGroups,
  migrations,
  lastUploadedDocument,
  showManagementControls
}: {
  state: DocumentWorkspaceUrlState
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  migrations: ReindexMigration[]
  lastUploadedDocument?: DocumentManifest | null
  showManagementControls: boolean
}): DocumentWorkspaceStateNormalization {
  const next = { ...state }
  const reasons: DocumentWorkspaceStateNormalization["reasons"][number][] = []
  const folderIds = new Set(documentGroups.map((group) => group.groupId))
  const documentIds = new Set(documents.map((document) => document.documentId))
  if (lastUploadedDocument) documentIds.add(lastUploadedDocument.documentId)
  const migrationIds = new Set(migrations.map((migration) => migration.migrationId))
  const types = new Set(documents.map(fileTypeLabel))
  const statuses = new Set(documents.map(documentStatusLabel))

  if (next.folderId && !folderIds.has(next.folderId)) {
    delete next.folderId
    reasons.push("folder")
  }
  if (next.documentId && !documentIds.has(next.documentId)) {
    delete next.documentId
    reasons.push("document")
  }
  if (next.migrationId && !migrationIds.has(next.migrationId)) {
    delete next.migrationId
    reasons.push("migration")
  }
  if (next.groupFilter && next.groupFilter !== "unassigned" && !folderIds.has(next.groupFilter)) {
    delete next.groupFilter
    reasons.push("group")
  }
  if (next.type && !types.has(next.type)) {
    delete next.type
    reasons.push("type")
  }
  if (next.status && (!showManagementControls || !statuses.has(next.status))) {
    delete next.status
    reasons.push("status")
  }
  if (next.sort === "chunkDesc" && !showManagementControls) {
    delete next.sort
    reasons.push("sort")
  }
  if (next.page !== undefined && (!Number.isInteger(next.page) || next.page < 1 || next.page > 999999)) {
    delete next.page
    reasons.push("page")
  }
  if (next.pageSize !== undefined && next.pageSize !== 25 && next.pageSize !== 50 && next.pageSize !== 100) {
    delete next.pageSize
    reasons.push("pageSize")
  }

  return { state: next, reasons }
}

export function documentWorkspaceNormalizationMessage(reasons: DocumentWorkspaceStateNormalization["reasons"]): string | null {
  if (reasons.length === 0) return null
  const selectionChanged = reasons.some((reason) => reason === "folder" || reason === "document" || reason === "migration")
  const filterChanged = reasons.some((reason) => reason === "type" || reason === "status" || reason === "group" || reason === "sort")
  const pagingChanged = reasons.some((reason) => reason === "page" || reason === "pageSize")
  const changes = [
    selectionChanged ? "選択対象" : undefined,
    filterChanged ? "絞り込み・並び替え" : undefined,
    pagingChanged ? "ページ" : undefined
  ].filter((value): value is string => Boolean(value))
  return `${changes.join("、")}が削除済み・利用不可・権限外の可能性があるため、許可された既定値へ戻しました。`
}
