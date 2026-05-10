import type { RefObject } from "react"
import { EmptyState } from "../../../../shared/ui/index.js"
import { Icon } from "../../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../../types.js"
import type { DocumentOperationState } from "../../hooks/useDocuments.js"
import { fileTypeClassName, fileTypeLabel, type ConfirmAction, type WorkspaceFolder } from "./documentWorkspaceUtils.js"

export function DocumentFilePanel({
  documents,
  documentGroups,
  selectedFolder,
  uploadGroupId,
  uploadDestinationLabel,
  visibleDocuments,
  operationState,
  canWrite,
  canDelete,
  canReindex,
  canUploadToDestination,
  migrations,
  uploadInputRef,
  shareSelectRef,
  onConfirmAction
}: {
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  selectedFolder: WorkspaceFolder
  uploadGroupId: string
  uploadDestinationLabel: string
  visibleDocuments: DocumentManifest[]
  operationState: DocumentOperationState
  canWrite: boolean
  canDelete: boolean
  canReindex: boolean
  canUploadToDestination: boolean
  migrations: ReindexMigration[]
  uploadInputRef: RefObject<HTMLInputElement | null>
  shareSelectRef: RefObject<HTMLSelectElement | null>
  onConfirmAction: (action: ConfirmAction) => void
}) {
  return (
    <section className="document-file-panel" aria-label="登録文書一覧">
      <div className="document-file-panel-head">
        <div>
          <h3>{selectedFolder.name}</h3>
          <span className={uploadGroupId ? "upload-destination-chip" : "upload-destination-chip missing"}>保存先: {uploadDestinationLabel}</span>
        </div>
        <span className="sr-only">登録文書</span>
        <div className="document-folder-actions" aria-label="フォルダ操作ショートカット">
          <button
            type="button"
            title={selectedFolder.group ? "このフォルダにアップロード" : "保存先を選択してアップロード"}
            aria-label={selectedFolder.group ? "このフォルダにアップロード" : "保存先を選択してアップロード"}
            disabled={!canUploadToDestination || operationState.isUploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            title="共有設定を編集"
            aria-label="共有設定を編集"
            disabled={!canWrite || operationState.sharingGroupId !== null}
            onClick={() => shareSelectRef.current?.focus()}
          >
            <Icon name="share" />
          </button>
        </div>
      </div>

      <div className="document-file-table" role="table" aria-label="登録文書">
        <div className="document-file-row document-file-head" role="row">
          <span role="columnheader">ファイル名</span>
          <span role="columnheader">種別</span>
          <span role="columnheader">更新日</span>
          <span role="columnheader">チャンク数</span>
          <span role="columnheader">状態</span>
          <span role="columnheader">操作</span>
        </div>
        {visibleDocuments.length === 0 ? (
          <EmptyState
            title="登録済みドキュメントはありません。"
            description={documentGroups.length === 0 ? "まずフォルダを作成し、保存先を選択してからファイルをアップロードしてください。" : "保存先フォルダを選択してファイルをアップロードしてください。"}
            action={<button type="button" disabled={!canWrite || !uploadGroupId} onClick={() => uploadInputRef.current?.click()}>ファイルをアップロード</button>}
          />
        ) : (
          visibleDocuments.map((document) => (
            <div className="document-file-row" role="row" key={document.documentId}>
              <span role="cell" className="document-name-cell">
                <FileIcon document={document} />
                <span>{document.fileName}</span>
              </span>
              <span role="cell">{fileTypeLabel(document)}</span>
              <span role="cell">{formatDateTime(document.createdAt)}</span>
              <span role="cell">{document.chunkCount}</span>
              <span role="cell">{document.lifecycleStatus ?? "active"}</span>
              <span role="cell" className="document-actions-cell">
                <button
                  type="button"
                  title={`${document.fileName}の再インデックスをステージング`}
                  aria-label={`${document.fileName}の再インデックスをステージング`}
                  disabled={!canReindex || operationState.stagingReindexDocumentId === document.documentId}
                  onClick={() => onConfirmAction({ kind: "stage", document })}
                >
                  {operationState.stagingReindexDocumentId === document.documentId ? <LoadingSpinner className="button-spinner" /> : <Icon name="gauge" />}
                </button>
                <button
                  type="button"
                  className="delete-document-button"
                  title={`${document.fileName}を削除`}
                  aria-label={`${document.fileName}を削除`}
                  disabled={!canDelete || operationState.deletingDocumentId === document.documentId}
                  onClick={() => onConfirmAction({ kind: "delete", document })}
                >
                  {operationState.deletingDocumentId === document.documentId ? <LoadingSpinner className="button-spinner" /> : <Icon name="trash" />}
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <footer className="document-table-footer">
        <span>{visibleDocuments.length} / {documents.length} 件を表示</span>
      </footer>

      <ReindexMigrationStrip
        canReindex={canReindex}
        migrations={migrations}
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
  operationState,
  onConfirmAction
}: {
  canReindex: boolean
  migrations: ReindexMigration[]
  operationState: DocumentOperationState
  onConfirmAction: (action: ConfirmAction) => void
}) {
  if (!canReindex || migrations.length === 0) return null

  return (
    <div className="migration-strip" aria-label="再インデックス移行一覧">
      {migrations.map((migration) => (
        <article className="migration-chip" key={migration.migrationId}>
          <strong>{migration.status}</strong>
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
