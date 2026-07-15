import { EmptyState, StatusBadge } from "../../../../shared/ui/index.js"
import { Icon } from "../../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import { reindexMigrationStatusPresentation } from "../../../../shared/ui/displayMetadata.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../../types.js"
import type { DocumentOperationState } from "../../hooks/useDocuments.js"
import {
  documentStatusLabel,
  documentUpdatedAt,
  documentGroupNames,
  fileTypeClassName,
  fileTypeLabel,
  type ConfirmAction,
  type DocumentSortKey,
  type WorkspaceFolder
} from "./documentWorkspaceUtils.js"

export function DocumentFilePanel({
  documents,
  documentGroups,
  selectedFolder,
  uploadGroupId,
  uploadDestinationLabel,
  pagedDocuments,
  folderDocumentsCount,
  filteredDocumentsCount,
  documentQuery,
  documentTypeFilter,
  documentStatusFilter,
  documentGroupFilter,
  documentSort,
  documentPage,
  documentPageCount,
  documentPageSize,
  documentPageSizeOptions,
  documentPageStart,
  documentPageEnd,
  documentTypeOptions,
  documentStatusOptions,
  selectedDocument,
  operationState,
  canWrite,
  canDelete,
  canCreateGroups,
  canShareGroups,
  canMoveGroups,
  canReindex,
  canOpenDocumentAdd,
  addDocumentDisabledReason,
  showManagementControls,
  canDeleteDocument,
  canReindexDocument,
  canShareDocument,
  canMoveDocument,
  migrations,
  selectedMigrationId,
  onDocumentQueryChange,
  onDocumentTypeFilterChange,
  onDocumentStatusFilterChange,
  onDocumentGroupFilterChange,
  onDocumentSortChange,
  onDocumentPageChange,
  onDocumentPageSizeChange,
  onSelectDocument,
  onConfirmAction,
  onShareDocument,
  onMoveDocument,
  onOpenFolderSettings,
  onOpenDocumentAdd,
  onClearFilters
}: {
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  selectedFolder: WorkspaceFolder
  uploadGroupId: string
  uploadDestinationLabel: string
  pagedDocuments: DocumentManifest[]
  folderDocumentsCount: number
  filteredDocumentsCount: number
  documentQuery: string
  documentTypeFilter: string
  documentStatusFilter: string
  documentGroupFilter: string
  documentSort: DocumentSortKey
  documentPage: number
  documentPageCount: number
  documentPageSize: number
  documentPageSizeOptions: number[]
  documentPageStart: number
  documentPageEnd: number
  documentTypeOptions: string[]
  documentStatusOptions: string[]
  selectedDocument: DocumentManifest | null
  operationState: DocumentOperationState
  canWrite: boolean
  canDelete: boolean
  canCreateGroups: boolean
  canShareGroups: boolean
  canMoveGroups: boolean
  canReindex: boolean
  canOpenDocumentAdd: boolean
  addDocumentDisabledReason: string | null
  showManagementControls: boolean
  canDeleteDocument: (document: DocumentManifest) => boolean
  canReindexDocument: (document: DocumentManifest) => boolean
  canShareDocument: (document: DocumentManifest) => boolean
  canMoveDocument: (document: DocumentManifest) => boolean
  migrations: ReindexMigration[]
  selectedMigrationId?: string
  onDocumentQueryChange: (value: string) => void
  onDocumentTypeFilterChange: (value: string) => void
  onDocumentStatusFilterChange: (value: string) => void
  onDocumentGroupFilterChange: (value: string) => void
  onDocumentSortChange: (value: DocumentSortKey) => void
  onDocumentPageChange: (page: number) => void
  onDocumentPageSizeChange: (pageSize: number) => void
  onSelectDocument: (document: DocumentManifest) => void
  onConfirmAction: (action: ConfirmAction) => void
  onShareDocument: (document: DocumentManifest) => void
  onMoveDocument: (document: DocumentManifest) => void
  onOpenFolderSettings: () => void
  onOpenDocumentAdd: () => void
  onClearFilters: () => void
}) {
  return (
    <section className="document-file-panel" aria-label="登録文書一覧">
      <div className="document-file-panel-head">
        <div>
          <h3>{selectedFolder.name}</h3>
          {showManagementControls && <span className={uploadGroupId ? "upload-destination-chip" : "upload-destination-chip missing"}>保存先: {uploadDestinationLabel}</span>}
          {showManagementControls && addDocumentDisabledReason && <p className="field-hint" id="document-add-disabled-reason">{addDocumentDisabledReason}</p>}
        </div>
        <span className="sr-only">登録文書</span>
        {showManagementControls && <div className="document-folder-actions" aria-label="フォルダ操作ショートカット">
          <button
            className="document-add-button"
            type="button"
            title={addDocumentDisabledReason ?? "ドキュメントを追加"}
            aria-describedby={addDocumentDisabledReason ? "document-add-disabled-reason" : undefined}
            disabled={!canOpenDocumentAdd}
            onClick={onOpenDocumentAdd}
          >
            <Icon name="upload" />
            <span>ドキュメントを追加</span>
          </button>
          <button
            type="button"
            title="フォルダ設定を開く"
            aria-label="フォルダ設定を開く"
            disabled={
              (!canShareGroups && !canMoveGroups && !canCreateGroups && !canWrite) ||
              operationState.sharingGroupId !== null ||
              (operationState.movingGroupId ?? null) !== null
            }
            onClick={onOpenFolderSettings}
          >
            <Icon name="settings" />
          </button>
        </div>}
      </div>
      {documents.length > 0 && <div className="document-filter-bar" aria-label="文書検索と絞り込み">
        <label>
          <span>ファイル名検索</span>
          <input type="search" value={documentQuery} onChange={(event) => onDocumentQueryChange(event.target.value)} placeholder="ファイル名 / documentId" autoComplete="off" />
        </label>
        <label>
          <span>種別</span>
          <select value={documentTypeFilter} onChange={(event) => onDocumentTypeFilterChange(event.target.value)}>
            <option value="all">すべて</option>
            {documentTypeOptions.map((type) => (
              <option value={type} key={type}>{type}</option>
            ))}
          </select>
        </label>
        {showManagementControls && <label>
          <span>状態</span>
          <select value={documentStatusFilter} onChange={(event) => onDocumentStatusFilterChange(event.target.value)}>
            <option value="all">すべて</option>
            {documentStatusOptions.map((status) => (
              <option value={status} key={status}>{status}</option>
            ))}
          </select>
        </label>}
        <label>
          <span>所属フォルダ</span>
          <select value={documentGroupFilter} onChange={(event) => onDocumentGroupFilterChange(event.target.value)}>
            <option value="all">すべて</option>
            <option value="unassigned">未設定</option>
            {documentGroups.map((group) => (
              <option value={group.groupId} key={group.groupId}>{group.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>並び替え</span>
          <select value={documentSort} onChange={(event) => onDocumentSortChange(event.target.value as DocumentSortKey)}>
            <option value="updatedDesc">更新日 新しい順</option>
            <option value="updatedAsc">更新日 古い順</option>
            <option value="fileNameAsc">ファイル名順</option>
            {showManagementControls && <option value="chunkDesc">チャンク数順</option>}
            <option value="typeAsc">種別順</option>
          </select>
        </label>
      </div>}

      <div className="document-file-table" role={folderDocumentsCount > 0 ? "table" : undefined} aria-label={folderDocumentsCount > 0 ? "登録文書" : undefined}>
        {folderDocumentsCount > 0 && <div className="document-file-row document-file-head" role="row">
          <span role="columnheader">ファイル名</span>
          <span role="columnheader">種別</span>
          <span role="columnheader">更新日</span>
          {showManagementControls && <span role="columnheader">チャンク数</span>}
          {showManagementControls && <span role="columnheader">状態</span>}
          <span role="columnheader">所属フォルダ</span>
          {showManagementControls && <span role="columnheader">操作</span>}
        </div>}
        {folderDocumentsCount === 0 ? (
          <EmptyState
            title={showManagementControls
              ? documents.length === 0 && documentGroups.length === 0
                ? "ドキュメントを登録しましょう"
                : `${selectedFolder.name}にドキュメントはありません`
              : "利用できるドキュメントはありません。"}
            description={showManagementControls
              ? documents.length === 0 && documentGroups.length === 0
                ? "1. 保存先を用意 → 2. ファイルを選択、の順に登録できます。"
                : "保存先を確認してドキュメントを追加してください。"
              : "現在の権限で閲覧できる共有ドキュメントはありません。"}
            action={showManagementControls
              ? <button className="ui-button-primary" type="button" disabled={!canOpenDocumentAdd} onClick={onOpenDocumentAdd}>ドキュメントを追加</button>
              : undefined}
          />
        ) : filteredDocumentsCount === 0 ? (
          <EmptyState
            title="条件に一致するドキュメントはありません。"
            description="検索語、種別、状態、所属フォルダの条件を変更してください。"
            action={<button type="button" onClick={onClearFilters}>条件をクリア</button>}
          />
        ) : (
          pagedDocuments.map((document) => {
            const groupLabel = documentGroupNames(document, documentGroups).join(", ") || "未設定"
            const canDeleteRow = canDelete && canDeleteDocument(document)
            const canReindexRow = canReindex && canReindexDocument(document)
            const canShareRow = canShareDocument(document)
            const canMoveRow = canMoveDocument(document)
            return (
              <div
                className={`document-file-row ${selectedDocument?.documentId === document.documentId ? "selected" : ""}`}
                role="row"
                key={document.documentId}
                tabIndex={0}
                aria-label={`${document.fileName}の詳細を表示`}
                onClick={() => onSelectDocument(document)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelectDocument(document)
                  }
                }}
              >
                <span role="cell" className="document-name-cell" data-label="ファイル名">
                  <FileIcon document={document} />
                  <span title={document.fileName}>{document.fileName}</span>
                </span>
                <span role="cell" data-label="種別">{fileTypeLabel(document)}</span>
                <span role="cell" data-label="更新日">{formatDateTime(documentUpdatedAt(document))}</span>
                {showManagementControls && <span role="cell" data-label="チャンク数">{document.chunkCount ?? "利用不可"}</span>}
                {showManagementControls && <span role="cell" data-label="状態">{documentStatusLabel(document)}</span>}
                <span role="cell" data-label="所属フォルダ">{groupLabel}</span>
                {showManagementControls && <span role="cell" className="document-actions-cell" data-label="操作">
                  <span className="document-action-buttons">
                    {canShareRow && (
                      <button
                        type="button"
                        title={`${document.fileName}を共有`}
                        aria-label={`${document.fileName}を共有`}
                        disabled={operationState.sharingDocumentId === document.documentId}
                        onClick={(event) => {
                          event.stopPropagation()
                          onShareDocument(document)
                        }}
                      >
                        共有
                      </button>
                    )}
                    {canMoveRow && (
                      <button
                        type="button"
                        title={`${document.fileName}を移動`}
                        aria-label={`${document.fileName}を移動`}
                        disabled={operationState.movingDocumentId === document.documentId}
                        onClick={(event) => {
                          event.stopPropagation()
                          onMoveDocument(document)
                        }}
                      >
                        移動
                      </button>
                    )}
                    {canReindexRow && <button
                      type="button"
                      title={`${document.fileName}の再インデックスをステージング`}
                      aria-label={`${document.fileName}の再インデックスをステージング`}
                      disabled={!canReindexRow || operationState.stagingReindexDocumentId === document.documentId}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!canReindexRow) return
                        onConfirmAction({ kind: "stage", document })
                      }}
                    >
                      {operationState.stagingReindexDocumentId === document.documentId ? <LoadingSpinner className="button-spinner" /> : <Icon name="gauge" />}
                    </button>}
                    {canDeleteRow && <button
                      type="button"
                      className="delete-document-button"
                      title={`${document.fileName}を削除`}
                      aria-label={`${document.fileName}を削除`}
                      disabled={!canDeleteRow || operationState.deletingDocumentId === document.documentId}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!canDeleteRow) return
                        onConfirmAction({ kind: "delete", document })
                      }}
                    >
                      {operationState.deletingDocumentId === document.documentId ? <LoadingSpinner className="button-spinner" /> : <Icon name="trash" />}
                    </button>}
                  </span>
                </span>}
              </div>
            )
          })
        )}
      </div>

      <footer className="document-table-footer">
        <div className="document-pagination-summary" aria-live="polite">
          <span>
            {filteredDocumentsCount === 0
              ? `0 / ${folderDocumentsCount} 件を表示（全体 ${documents.length} 件）`
              : `${documentPageStart}-${documentPageEnd} / ${filteredDocumentsCount} 件を表示（フォルダ内 ${folderDocumentsCount} 件 / 全体 ${documents.length} 件）`}
          </span>
          <span>ページ {documentPage} / {documentPageCount}</span>
        </div>
        <div className="document-pagination-controls" aria-label="文書一覧ページ操作">
          <label>
            <span>表示件数</span>
            <select value={documentPageSize} onChange={(event) => onDocumentPageSizeChange(Number(event.target.value))}>
              {documentPageSizeOptions.map((pageSize) => (
                <option value={pageSize} key={pageSize}>{pageSize}件</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            title="前のページ"
            aria-label="前のページ"
            disabled={documentPage <= 1 || filteredDocumentsCount === 0}
            onClick={() => onDocumentPageChange(Math.max(1, documentPage - 1))}
          >
            <Icon name="chevron" />
          </button>
          <button
            type="button"
            title="次のページ"
            aria-label="次のページ"
            disabled={documentPage >= documentPageCount || filteredDocumentsCount === 0}
            onClick={() => onDocumentPageChange(Math.min(documentPageCount, documentPage + 1))}
          >
            <Icon name="chevron" />
          </button>
        </div>
      </footer>

      <ReindexMigrationStrip
        canReindex={canReindex}
        migrations={migrations}
        selectedMigrationId={selectedMigrationId}
        operationState={operationState}
        onConfirmAction={onConfirmAction}
      />
    </section>
  )
}

function FileIcon({ document }: { document: DocumentManifest }) {
  const type = fileTypeLabel(document)
  return <span className={`file-type-icon file-type-${fileTypeClassName(type)}`}>{type.slice(0, 1)}</span>
}

function ReindexMigrationStrip({
  canReindex,
  migrations,
  selectedMigrationId,
  operationState,
  onConfirmAction
}: {
  canReindex: boolean
  migrations: ReindexMigration[]
  selectedMigrationId?: string
  operationState: DocumentOperationState
  onConfirmAction: (action: ConfirmAction) => void
}) {
  if (!canReindex || migrations.length === 0) return null

  return (
    <div className="migration-strip" aria-label="再インデックス移行一覧">
      {migrations.map((migration) => (
        <article className={`migration-chip ${selectedMigrationId === migration.migrationId ? "selected" : ""}`} key={migration.migrationId} aria-current={selectedMigrationId === migration.migrationId ? "true" : undefined}>
          <StatusBadge presentation={reindexMigrationStatusPresentation(migration.status)} />
          <span>{migration.sourceDocumentId} → {migration.stagedDocumentId}</span>
          <button type="button" disabled={operationState.cutoverMigrationId === migration.migrationId || migration.status !== "staged"} onClick={() => onConfirmAction({ kind: "cutover", migration })}>
            {operationState.cutoverMigrationId === migration.migrationId ? <LoadingSpinner className="button-spinner" /> : "切替"}
          </button>
          <button type="button" disabled={operationState.rollbackMigrationId === migration.migrationId || migration.status !== "cutover"} onClick={() => onConfirmAction({ kind: "rollback", migration })}>
            {operationState.rollbackMigrationId === migration.migrationId ? <LoadingSpinner className="button-spinner" /> : "戻す"}
          </button>
        </article>
      ))}
    </div>
  )
}
