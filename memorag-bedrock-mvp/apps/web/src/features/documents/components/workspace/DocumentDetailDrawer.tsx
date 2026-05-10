import { Icon } from "../../../../shared/components/Icon.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import {
  documentGroupIds,
  documentStatusLabel,
  fileTypeLabel,
  formatFileSize,
  metadataNumber,
  metadataString,
  visibilityLabel
} from "./documentWorkspaceUtils.js"

export function DocumentDetailDrawer({
  document,
  documentGroups,
  copied,
  onCopyDocumentId,
  onClose,
  onAskDocument,
  onDelete,
  onStageReindex,
  canDelete,
  canReindex
}: {
  document: DocumentManifest
  documentGroups: DocumentGroup[]
  copied: boolean
  onCopyDocumentId: () => void
  onClose: () => void
  onAskDocument?: () => void
  onDelete: () => void
  onStageReindex: () => void
  canDelete: boolean
  canReindex: boolean
}) {
  const groupIds = documentGroupIds(document)
  const owningGroups = groupIds.map((groupId) => documentGroups.find((group) => group.groupId === groupId)).filter((group): group is DocumentGroup => Boolean(group))
  const groupNames = groupIds.map((groupId) => documentGroups.find((group) => group.groupId === groupId)?.name ?? groupId)
  const latestMigrationStatus = document.reindexMigrationId ? document.lifecycleStatus ?? "利用不可" : "利用不可"
  const ingestRunId = metadataString(document, "ingestRunId") ?? metadataString(document, "runId")
  const embeddingModel = metadataString(document, "embeddingModelId") ?? metadataString(document, "embeddingModel")
  const memoryModel = metadataString(document, "memoryModelId") ?? metadataString(document, "memoryModel")
  const fileSize = metadataNumber(document, "fileSizeBytes") ?? metadataNumber(document, "fileSize")
  const updatedAt = metadataString(document, "updatedAt")

  return (
    <div className="document-drawer-backdrop" role="presentation">
      <aside className="document-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="document-detail-title">
        <header>
          <div>
            <span className="upload-destination-chip">{fileTypeLabel(document)}</span>
            <h3 id="document-detail-title">{document.fileName}</h3>
          </div>
          <button type="button" title="文書詳細を閉じる" aria-label="文書詳細を閉じる" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <dl className="document-detail-list">
          <DetailRow label="documentId" value={document.documentId} />
          <DetailRow label="所属フォルダ" value={groupNames.join(", ") || "未設定"} />
          <DetailRow label="visibility" value={owningGroups.map(visibilityLabel).join(", ") || "利用不可"} />
          <DetailRow label="shared groups" value={owningGroups.flatMap((group) => group.sharedGroups).join(", ") || "未設定"} />
          <DetailRow label="mime type" value={document.mimeType ?? "利用不可"} />
          <DetailRow label="ファイルサイズ" value={fileSize === undefined ? "利用不可" : formatFileSize(fileSize)} />
          <DetailRow label="作成日時" value={formatDateTime(document.createdAt)} />
          <DetailRow label="更新日時" value={updatedAt ? formatDateTime(updatedAt) : "利用不可"} />
          <DetailRow label="chunk count" value={String(document.chunkCount)} />
          <DetailRow label="memory card count" value={String(document.memoryCardCount)} />
          <DetailRow label="lifecycle status" value={documentStatusLabel(document)} />
          <DetailRow label="ingest run ID" value={ingestRunId ?? "利用不可"} />
          <DetailRow label="embedding model" value={embeddingModel ?? "利用不可"} />
          <DetailRow label="memory model" value={memoryModel ?? "利用不可"} />
          <DetailRow label="最新 reindex 状態" value={latestMigrationStatus} />
          <DetailRow label="抽出テキスト preview" value="利用不可" />
          <DetailRow label="代表チャンク preview" value="利用不可" />
          <DetailRow label="エラー履歴" value="利用不可" />
        </dl>
        <div className="document-drawer-actions">
          <button type="button" disabled={!onAskDocument} onClick={() => onAskDocument?.()}>
            <Icon name="chat" />
            <span>この資料に質問する</span>
          </button>
          <button type="button" onClick={onCopyDocumentId}>
            <Icon name={copied ? "check" : "copy"} />
            <span>{copied ? "コピー済み" : "documentId コピー"}</span>
          </button>
          <button type="button" disabled={!canReindex} onClick={onStageReindex}>
            <Icon name="gauge" />
            <span>再インデックス</span>
          </button>
          <button type="button" className="danger" disabled={!canDelete} onClick={onDelete}>
            <Icon name="trash" />
            <span>削除</span>
          </button>
        </div>
      </aside>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
