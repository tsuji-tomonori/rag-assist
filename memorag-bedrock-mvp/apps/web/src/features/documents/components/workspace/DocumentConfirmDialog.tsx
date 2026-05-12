import { ConfirmDialog } from "../../../../shared/ui/index.js"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import { documentGroupIds, type ConfirmAction } from "./documentWorkspaceUtils.js"

export function DocumentConfirmDialog({
  action,
  documents,
  documentGroups,
  loading = false,
  errorMessage,
  onCancel,
  onConfirm
}: {
  action: ConfirmAction
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  loading?: boolean
  errorMessage?: string | null
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}) {
  const details = confirmDetails(action, documents, documentGroups)
  return (
    <ConfirmDialog
      title={details.title}
      message={details.message}
      rows={details.rows}
      confirmLabel={details.confirmLabel}
      loading={loading}
      errorMessage={errorMessage}
      danger={details.danger}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function confirmDetails(action: ConfirmAction, documents: DocumentManifest[], documentGroups: DocumentGroup[]) {
  if (action.kind === "delete") {
    return {
      title: "文書を削除しますか",
      message: "元資料、manifest、検索ベクトルが削除されます。復元が必要な場合は再アップロードが必要です。",
      confirmLabel: "削除",
      danger: true,
      rows: documentRows(action.document, documentGroups)
    }
  }
  if (action.kind === "stage") {
    return {
      title: "再インデックスをステージングしますか",
      message: "現在の文書とは別に staged document を作成します。検索結果への反映は切替後です。",
      confirmLabel: "ステージング",
      danger: false,
      rows: documentRows(action.document, documentGroups)
    }
  }
  const sourceDocument = documents.find((document) => document.documentId === action.migration.sourceDocumentId)
  return {
    title: action.kind === "cutover" ? "再インデックス結果へ切り替えますか" : "再インデックス切替を戻しますか",
    message: action.kind === "cutover"
      ? "検索対象を staged document に切り替えます。切替後は rollback 操作で戻せる状態を確認してください。"
      : "検索対象を戻します。戻した後の状態と対象 document ID を確認してください。",
    confirmLabel: action.kind === "cutover" ? "切替" : "戻す",
    danger: false,
    rows: [
      { label: "migrationId", value: action.migration.migrationId },
      { label: "現行 documentId", value: action.migration.sourceDocumentId },
      { label: "staged documentId", value: action.migration.stagedDocumentId },
      { label: "対象ファイル", value: sourceDocument?.fileName ?? "未取得" },
      { label: "現在の状態", value: action.migration.status },
      { label: "rollback 可否", value: action.kind === "cutover" ? "切替後に migration が cutover 状態なら可能" : "戻し後は rolled_back 状態" }
    ]
  }
}

function documentRows(document: DocumentManifest, documentGroups: DocumentGroup[]): Array<{ label: string; value: string }> {
  const groupNames = documentGroupIds(document)
    .map((groupId) => documentGroups.find((group) => group.groupId === groupId)?.name ?? groupId)
    .join(", ")
  return [
    { label: "ファイル名", value: document.fileName },
    { label: "documentId", value: document.documentId },
    { label: "チャンク数", value: String(document.chunkCount) },
    { label: "所属フォルダ", value: groupNames || "未設定" },
    { label: "lifecycle", value: document.lifecycleStatus ?? "active" }
  ]
}
