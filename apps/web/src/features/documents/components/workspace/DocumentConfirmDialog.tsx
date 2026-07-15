import { ConfirmDialog } from "../../../../shared/ui/index.js"
import { documentLifecycleStatusPresentation, reindexMigrationStatusPresentation } from "../../../../shared/ui/displayMetadata.js"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import { documentGroupIds, type ConfirmAction } from "./documentWorkspaceUtils.js"

export function DocumentConfirmDialog({
  action,
  documents,
  documentGroups,
  loading = false,
  errorMessage,
  deleteReason = "",
  onDeleteReasonChange,
  onCancel,
  onConfirm
}: {
  action: ConfirmAction
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  loading?: boolean
  errorMessage?: string | null
  deleteReason?: string
  onDeleteReasonChange?: (value: string) => void
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
      confirmDisabled={action.kind === "delete" && !deleteReason.trim()}
      errorMessage={errorMessage}
      danger={details.danger}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {action.kind === "delete" && (
        <label className="confirm-dialog-field">
          <span>削除理由</span>
          <textarea
            value={deleteReason}
            onChange={(event) => onDeleteReasonChange?.(event.target.value)}
            required
            maxLength={500}
            disabled={loading}
          />
        </label>
      )}
    </ConfirmDialog>
  )
}

function confirmDetails(action: ConfirmAction, documents: DocumentManifest[], documentGroups: DocumentGroup[]) {
  if (action.kind === "delete") {
    return {
      title: "文書を削除しますか",
      message: "元資料、manifest、検索ベクトルが削除されます。復元が必要な場合は再アップロードが必要です。",
      confirmLabel: "削除",
      danger: true,
      rows: [
        ...documentRows(action.document, documentGroups),
        { label: "影響", value: "元資料、manifest、検索ベクトルを削除" },
        { label: "回復条件", value: "再利用には元資料の再アップロードが必要" },
        { label: "確認が必要な理由", value: "検索・回答の根拠から対象を恒久的に除外するため" }
      ]
    }
  }
  if (action.kind === "stage") {
    return {
      title: "再インデックスをステージングしますか",
      message: "現在の文書とは別に staged document を作成します。検索結果への反映は切替後です。",
      confirmLabel: "ステージング",
      danger: false,
      rows: [
        ...documentRows(action.document, documentGroups),
        { label: "影響", value: "staged document を作成し、切替前の検索対象は維持" },
        { label: "回復条件", value: "切替前は staged document を破棄して現行状態を維持可能" },
        { label: "確認が必要な理由", value: "追加リソースと後続の切替判断が必要になるため" }
      ]
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
      { label: "移行識別子", value: action.migration.migrationId },
      { label: "現在の文書識別子", value: action.migration.sourceDocumentId },
      { label: "切替先の文書識別子", value: action.migration.stagedDocumentId },
      { label: "対象ファイル", value: sourceDocument?.fileName ?? "未取得" },
      { label: "現在の状態", value: reindexMigrationStatusPresentation(action.migration.status).label },
      { label: "影響", value: action.kind === "cutover" ? "検索対象を staged document へ切替" : "検索対象を切替前の document へ戻す" },
      { label: "切戻し可否", value: action.kind === "cutover" ? "切替後に切替済み状態なら可能" : "切戻し後は切戻し済み状態" },
      { label: "確認が必要な理由", value: "検索・回答が参照する document version を変更するため" }
    ]
  }
}

function documentRows(document: DocumentManifest, documentGroups: DocumentGroup[]): Array<{ label: string; value: string }> {
  const groupNames = documentGroupIds(document)
    .map((groupId) => documentGroups.find((group) => group.groupId === groupId)?.name ?? groupId)
    .join(", ")
  return [
    { label: "ファイル名", value: document.fileName },
    { label: "文書識別子", value: document.documentId },
    { label: "チャンク数", value: String(document.chunkCount) },
    { label: "所属フォルダ", value: groupNames || "未設定" },
    { label: "利用状態", value: document.lifecycleStatus ? documentLifecycleStatusPresentation(document.lifecycleStatus).label : "利用不可" }
  ]
}
