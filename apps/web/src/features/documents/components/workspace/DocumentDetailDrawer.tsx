import type { ReactNode } from "react"
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
  const extractionWarnings = document.extractionWarnings ?? document.parsedDocument?.warnings
  const extractionCounters = document.extractionCounters ?? document.parsedDocument?.counters
  const parsedPreview = document.parsedDocument?.text.trim()
  const parsedCountItems = parsedDocumentCountItems(document)
  const qualityItems = documentQualityItems(document)

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
          <DetailRow label="抽出品質" value={qualityItems.length > 0 ? <InlineList items={qualityItems} /> : "利用不可"} />
          <DetailRow label="抽出警告" value={extractionWarnings && extractionWarnings.length > 0 ? <WarningList warnings={extractionWarnings} /> : extractionWarnings ? "警告はありません。" : "利用不可"} />
          <DetailRow label="抽出カウンター" value={extractionCounters && Object.keys(extractionCounters).length > 0 ? <CounterList counters={extractionCounters} /> : extractionCounters ? "カウンターはありません。" : "利用不可"} />
          <DetailRow label="ParsedDocument summary" value={document.parsedDocument ? <ParsedDocumentSummary document={document} countItems={parsedCountItems} /> : "利用不可"} />
          <DetailRow label="抽出テキスト preview" value={parsedPreview ? truncateText(parsedPreview, 360) : document.parsedDocument ? "抽出テキストは空です。" : "利用不可"} />
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function ParsedDocumentSummary({ document, countItems }: { document: DocumentManifest; countItems: string[] }) {
  const parsedDocument = document.parsedDocument
  if (!parsedDocument) return null

  return (
    <span>
      schemaVersion: {parsedDocument.schemaVersion} / extractor: {parsedDocument.sourceExtractorVersion}
      {(document.fileProfile ?? parsedDocument.fileProfile) ? ` / fileProfile: ${document.fileProfile ?? parsedDocument.fileProfile}` : ""}
      {countItems.length > 0 ? ` / ${countItems.join(" / ")}` : ""}
    </span>
  )
}

function WarningList({ warnings }: { warnings: NonNullable<DocumentManifest["extractionWarnings"]> }) {
  return (
    <ul>
      {warnings.map((warning, index) => (
        <li key={`${warning.code}-${index}`}>
          {warning.severity}: {warning.code} - {warning.message}
          {warning.page ? `（page ${warning.page}）` : ""}
          {typeof warning.confidence === "number" ? ` confidence ${formatNumber(warning.confidence)}` : ""}
        </li>
      ))}
    </ul>
  )
}

function CounterList({ counters }: { counters: Record<string, number> }) {
  return <InlineList items={Object.entries(counters).map(([key, value]) => `${key}: ${formatNumber(value)}`)} />
}

function InlineList({ items }: { items: string[] }) {
  return <span>{items.join(" / ")}</span>
}

function parsedDocumentCountItems(document: DocumentManifest): string[] {
  const parsedDocument = document.parsedDocument
  if (!parsedDocument) return []
  return [
    arrayCountItem("pages", parsedDocument.pages),
    arrayCountItem("blocks", parsedDocument.blocks),
    arrayCountItem("tables", parsedDocument.tables),
    arrayCountItem("figures", parsedDocument.figures)
  ].filter((item): item is string => Boolean(item))
}

function documentQualityItems(document: DocumentManifest): string[] {
  const profile = document.qualityProfile
  if (!profile) return []
  return [
    profile.knowledgeQualityStatus ? `knowledge: ${profile.knowledgeQualityStatus}` : undefined,
    profile.verificationStatus ? `verification: ${profile.verificationStatus}` : undefined,
    profile.freshnessStatus ? `freshness: ${profile.freshnessStatus}` : undefined,
    profile.supersessionStatus ? `supersession: ${profile.supersessionStatus}` : undefined,
    profile.extractionQualityStatus ? `extraction: ${profile.extractionQualityStatus}` : undefined,
    profile.ragEligibility ? `RAG: ${profile.ragEligibility}` : undefined,
    typeof profile.confidence === "number" ? `confidence: ${formatNumber(profile.confidence)}` : undefined,
    profile.flags && profile.flags.length > 0 ? `flags: ${profile.flags.join(", ")}` : undefined,
    profile.updatedAt ? `updated: ${formatDateTime(profile.updatedAt)}` : undefined,
    profile.updatedBy ? `updatedBy: ${profile.updatedBy}` : undefined
  ].filter((item): item is string => Boolean(item))
}

function arrayCountItem(label: string, value: unknown[] | undefined): string | undefined {
  return Array.isArray(value) ? `${label}: ${value.length}` : undefined
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
