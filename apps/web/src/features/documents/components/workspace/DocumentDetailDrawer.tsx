import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Icon } from "../../../../shared/components/Icon.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import { documentLifecycleStatusPresentation } from "../../../../shared/ui/displayMetadata.js"
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
  onDownload,
  isDownloading,
  onShare,
  onMove,
  onDelete,
  onStageReindex,
  canManage,
  canShare,
  canMove,
  canDelete,
  canReindex,
  shareBusy,
  moveBusy,
  deleteBusy,
  reindexBusy
}: {
  document: DocumentManifest
  documentGroups: DocumentGroup[]
  copied: boolean
  onCopyDocumentId: () => void
  onClose: () => void
  onAskDocument?: () => void
  onDownload?: () => Promise<unknown> | void
  isDownloading: boolean
  onShare?: () => void
  onMove?: () => void
  onDelete: () => void
  onStageReindex: () => void
  canManage: boolean
  canShare: boolean
  canMove: boolean
  canDelete: boolean
  canReindex: boolean
  shareBusy: boolean
  moveBusy: boolean
  deleteBusy: boolean
  reindexBusy: boolean
}) {
  const groupIds = documentGroupIds(document)
  const owningGroups = groupIds.map((groupId) => documentGroups.find((group) => group.groupId === groupId)).filter((group): group is DocumentGroup => Boolean(group))
  const groupNames = groupIds.map((groupId) => documentGroups.find((group) => group.groupId === groupId)?.name ?? groupId)
  const latestMigrationStatus = document.reindexMigrationId && document.lifecycleStatus
    ? documentLifecycleStatusPresentation(document.lifecycleStatus).label
    : "利用不可"
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
  const [technicalExpanded, setTechnicalExpanded] = useState(false)
  const [managementExpanded, setManagementExpanded] = useState(false)
  const technicalRegionId = useId()
  const managementRegionId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocusRef.current = globalThis.document.activeElement instanceof HTMLElement
      ? globalThis.document.activeElement
      : null
    closeButtonRef.current?.focus()
    return () => returnFocusRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && globalThis.document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && globalThis.document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="document-drawer-backdrop" role="presentation">
      <div ref={dialogRef} className="document-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="document-detail-title" onKeyDown={trapFocus}>
        <header>
          <div>
            <span className="upload-destination-chip">{fileTypeLabel(document)}</span>
            <h3 id="document-detail-title">{document.fileName}</h3>
          </div>
          <button ref={closeButtonRef} type="button" title="文書詳細を閉じる" aria-label="文書詳細を閉じる" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="document-drawer-body">
          <dl className="document-detail-list">
            <DetailRow label="所属フォルダ" value={groupNames.join(", ") || "未設定"} />
            <DetailRow label="ファイル形式" value={document.mimeType ?? "利用不可"} />
            <DetailRow label="登録日時" value={formatDateTime(document.createdAt)} />
            {canManage && <>
              <DetailRow label="更新日時" value={updatedAt ? formatDateTime(updatedAt) : "利用不可"} />
              <DetailRow label="利用状態" value={documentStatusLabel(document)} />
              <DetailRow label="公開範囲" value={owningGroups.map(visibilityLabel).join(", ") || "利用不可"} />
              <DetailRow label="共有グループ" value={owningGroups.flatMap((group) => group.sharedGroups ?? []).join(", ") || "未設定"} />
            </>}
          </dl>
          {canManage && (
            <section className="document-detail-disclosure">
              <button
                type="button"
                aria-expanded={technicalExpanded}
                aria-controls={technicalRegionId}
                onClick={() => setTechnicalExpanded((current) => !current)}
              >
                {technicalExpanded ? "技術・品質詳細を閉じる" : "技術・品質詳細を表示"}
              </button>
              {technicalExpanded && (
                <dl className="document-detail-list" id={technicalRegionId}>
                  <DetailRow label="文書識別子" value={document.documentId} />
                  <DetailRow label="ファイルサイズ" value={fileSize === undefined ? "利用不可" : formatFileSize(fileSize)} />
                  <DetailRow label="チャンク数" value={document.chunkCount === undefined ? "利用不可" : String(document.chunkCount)} />
                  <DetailRow label="メモリカード数" value={document.memoryCardCount === undefined ? "利用不可" : String(document.memoryCardCount)} />
                  <DetailRow label="取り込み実行識別子" value={ingestRunId ?? "利用不可"} />
                  <DetailRow label="埋め込みモデル" value={embeddingModel ?? "利用不可"} />
                  <DetailRow label="メモリモデル" value={memoryModel ?? "利用不可"} />
                  <DetailRow label="最新の再インデックス状態" value={latestMigrationStatus} />
                  <DetailRow label="抽出品質" value={qualityItems.length > 0 ? <InlineList items={qualityItems} /> : "利用不可"} />
                  <DetailRow label="抽出警告" value={extractionWarnings && extractionWarnings.length > 0 ? <WarningList warnings={extractionWarnings} /> : extractionWarnings ? "警告はありません。" : "利用不可"} />
                  <DetailRow label="抽出カウンター" value={extractionCounters && Object.keys(extractionCounters).length > 0 ? <CounterList counters={extractionCounters} /> : extractionCounters ? "カウンターはありません。" : "利用不可"} />
                  <DetailRow label="ParsedDocument summary" value={document.parsedDocument ? <ParsedDocumentSummary document={document} countItems={parsedCountItems} /> : "利用不可"} />
                  <DetailRow label="抽出テキスト preview" value={parsedPreview ? truncateText(parsedPreview, 360) : document.parsedDocument ? "抽出テキストは空です。" : "利用不可"} />
                </dl>
              )}
              <button type="button" onClick={onCopyDocumentId}>
                <Icon name={copied ? "check" : "copy"} />
                <span>{copied ? "コピー済み" : "文書識別子をコピー"}</span>
              </button>
            </section>
          )}
        </div>
        <footer className="document-drawer-actions">
          <div className="document-drawer-primary-actions">
            <button className="primary" type="button" disabled={!onAskDocument} onClick={() => onAskDocument?.()}>
              <Icon name="chat" />
              <span>この資料に質問する</span>
            </button>
            {onDownload && <button type="button" disabled={isDownloading} onClick={() => void onDownload()}>
              <Icon name="download" />
              <span>{isDownloading ? "ダウンロード中" : "抽出テキストをダウンロード"}</span>
            </button>}
          </div>
          {canManage && (canShare || canMove || canReindex || canDelete) && (
            <section className="document-management-disclosure">
              <p>管理操作: 共有・移動は文書の利用範囲を変更し、再インデックス・削除は確認後に実行します。</p>
              <button
                type="button"
                aria-expanded={managementExpanded}
                aria-controls={managementRegionId}
                onClick={() => setManagementExpanded((current) => !current)}
              >
                {managementExpanded ? "管理操作を閉じる" : "管理操作を表示"}
              </button>
              {managementExpanded && (
                <div id={managementRegionId} className="document-management-actions">
                  {(canShare || canMove) && <div role="group" aria-label="詳細操作">
                    <strong>詳細操作</strong>
                    {canShare && <button type="button" disabled={shareBusy} onClick={onShare}>共有</button>}
                    {canMove && <button type="button" disabled={moveBusy} onClick={onMove}>移動</button>}
                  </div>}
                  {(canReindex || canDelete) && <div className="risky" role="group" aria-label="高影響操作">
                    <strong>高影響操作</strong>
                    {canReindex && <button type="button" disabled={reindexBusy} onClick={onStageReindex}>
                      <Icon name="gauge" />
                      <span>再インデックス</span>
                    </button>}
                    {canDelete && <button type="button" className="danger" disabled={deleteBusy} onClick={onDelete}>
                      <Icon name="trash" />
                      <span>削除</span>
                    </button>}
                  </div>}
                </div>
              )}
            </section>
          )}
        </footer>
      </div>
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
