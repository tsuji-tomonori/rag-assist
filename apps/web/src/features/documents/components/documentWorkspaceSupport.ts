import {
confirmedOperation,
failedOperation,
type OperationStatus
} from "../../../shared/ui/index.js"
import type { UiResourceState } from "../../../shared/ui/ResourceState.js"
import type { DocumentOperationResult,DocumentOperationState,DocumentUploadResult } from "../hooks/useDocuments.js"
import type { DocumentGroup,DocumentManifest } from "../types.js"
import {
documentGroupIds,
type ConfirmAction,
type DocumentOperationEvent
} from "./workspace/documentWorkspaceUtils.js"


export function resourceStateAsOf(state: UiResourceState): string | undefined {
  if ("asOf" in state && state.asOf) return state.asOf
  return state.parts
    .map((part) => part.asOf)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0]
}

export function resourceStateLabel(state: UiResourceState): string {
  if (state.kind === "content") return "取得済み"
  if (state.kind === "empty") return "0 件を確認済み"
  if (state.kind === "partial") return "一部未取得"
  if (state.kind === "stale") return "更新が必要"
  if (state.kind === "recovered") return "再取得済み"
  if (state.kind === "loading" || state.kind === "retrying") return "更新中"
  if (state.kind === "permission") return "権限を確認できません"
  return "取得失敗"
}

export function normalizeOperationResult(result: DocumentOperationResult | void) {
  if (!result) return confirmedOperation()
  if ("status" in result) return result
  return result.ok ? confirmedOperation() : failedOperation(new Error(result.error))
}

export function normalizeUploadResult(result: DocumentUploadResult | DocumentOperationResult | void): { ok: true; document?: DocumentManifest } | { ok: false; error: string } {
  return result ?? { ok: true }
}

export function uploadedDocumentGroupId(document: DocumentManifest | null, uploadStateGroupId: string | undefined, uploadGroupId: string): string {
  return document ? documentGroupIds(document)[0] ?? uploadStateGroupId ?? uploadGroupId : ""
}

export function isConfirmActionRunning(action: ConfirmAction | null, operationState: DocumentOperationState): boolean {
  if (!action) return false
  if (action.kind === "delete") return operationState.deletingDocumentId === action.document.documentId
  if (action.kind === "stage") return operationState.stagingReindexDocumentId === action.document.documentId
  if (action.kind === "cutover") return operationState.cutoverMigrationId === action.migration.migrationId
  return operationState.rollbackMigrationId === action.migration.migrationId
}

export function documentActionFeedbackBase(
  actionLabel: string,
  targetLabel: string,
  targetId: string,
  reason: string | undefined,
  impact: string,
  recovery: string
) {
  return {
    id: `document-action-${actionLabel}-${targetId}`,
    actionLabel,
    targetLabel,
    targetId,
    ...(reason ? { reason } : {}),
    details: [
      { label: "影響", value: impact },
      { label: "回復条件", value: recovery }
    ],
    showUnavailableEvidence: true
  }
}

export function documentOperationResultLabel(status: Exclude<OperationStatus, "processing">): DocumentOperationEvent["result"] {
  if (status === "success") return "反映済み"
  if (status === "partial") return "一部確認済み"
  if (status === "unknown") return "結果未確認"
  return "失敗"
}

export function canManageDocumentGroup(group: DocumentGroup): boolean {
  return group.effectivePermission === "full"
}

export function canDeleteDocument(document: DocumentManifest): boolean {
  return document.capabilities?.canDelete === true
}

export function canReindexDocument(document: DocumentManifest): boolean {
  return document.capabilities?.canReindex === true
}

export function getUploadDisabledReason({
  canUpload,
  uploadGroupId,
  hasUploadDestination,
  canUploadToDestination,
  isUploading
}: {
  canUpload: boolean
  uploadGroupId: string
  hasUploadDestination: boolean
  canUploadToDestination: boolean
  isUploading: boolean
}): string | null {
  if (!canUpload) return "文書をアップロードする権限がありません。"
  if (isUploading) return "アップロード中です。"
  if (!uploadGroupId) return "保存先フォルダを選択するとアップロードできます。"
  if (!hasUploadDestination) return "保存先フォルダを選択してください。"
  if (!canUploadToDestination) return "保存先フォルダの管理権限が必要です。"
  return null
}

export function getAddDocumentDisabledReason({
  canUpload,
  canCreateGroups,
  uploadDestinationCount,
  isUploading
}: {
  canUpload: boolean
  canCreateGroups: boolean
  uploadDestinationCount: number
  isUploading: boolean
}): string | null {
  if (!canUpload) return "文書をアップロードする権限がありません。"
  if (isUploading) return "アップロード中です。"
  if (!canCreateGroups && uploadDestinationCount === 0) return "アップロード可能なフォルダがありません。フォルダ管理者へ権限を依頼してください。"
  return null
}
