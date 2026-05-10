import { type FormEvent, useMemo, useRef, useState } from "react"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import type { DocumentOperationState, DocumentUploadState } from "../hooks/useDocuments.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../shared/utils/format.js"

type WorkspaceFolder = {
  id: string
  name: string
  path: string
  count: number
  group?: DocumentGroup
}

type ConfirmAction =
  | { kind: "delete"; document: DocumentManifest }
  | { kind: "stage"; document: DocumentManifest }
  | { kind: "cutover"; migration: ReindexMigration }
  | { kind: "rollback"; migration: ReindexMigration }

const emptyOperationState: DocumentOperationState = {
  isUploading: false,
  creatingGroup: false,
  sharingGroupId: null,
  deletingDocumentId: null,
  stagingReindexDocumentId: null,
  cutoverMigrationId: null,
  rollbackMigrationId: null
}

export function DocumentWorkspace({
  documents,
  documentGroups = [],
  loading,
  canWrite,
  canDelete,
  canReindex,
  uploadGroupId = "",
  operationState = emptyOperationState,
  uploadState = null,
  migrations,
  onUploadGroupChange,
  onUpload,
  onCreateGroup,
  onShareGroup,
  onDelete,
  onStageReindex,
  onCutoverReindex,
  onRollbackReindex,
  onBack
}: {
  documents: DocumentManifest[]
  documentGroups?: DocumentGroup[]
  loading: boolean
  canWrite: boolean
  canDelete: boolean
  canReindex: boolean
  uploadGroupId?: string
  operationState?: DocumentOperationState
  uploadState?: DocumentUploadState
  migrations: ReindexMigration[]
  onUploadGroupChange: (groupId: string) => void
  onUpload: (file: File) => Promise<void>
  onCreateGroup: (input: { name: string; visibility: "private" | "shared" | "org" }) => Promise<void>
  onShareGroup: (groupId: string, input: { visibility?: "private" | "shared" | "org"; sharedGroups?: string[]; sharedUserIds?: string[] }) => Promise<void>
  onDelete: (documentId: string) => Promise<void>
  onStageReindex: (documentId: string) => Promise<void>
  onCutoverReindex: (migrationId: string) => Promise<void>
  onRollbackReindex: (migrationId: string) => Promise<void>
  onBack: () => void
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [groupName, setGroupName] = useState("")
  const [shareGroupId, setShareGroupId] = useState("")
  const [shareGroups, setShareGroups] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState("all")
  const [folderSearch, setFolderSearch] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)

  const folders = useMemo<WorkspaceFolder[]>(() => {
    return documentGroups.map((group) => ({
      id: group.groupId,
      name: group.name,
      path: `/ ドキュメントグループ / ${group.name}`,
      count: countDocumentsForGroup(documents, group.groupId),
      group
    }))
  }, [documentGroups, documents])

  const allDocumentsFolder: WorkspaceFolder = { id: "all", name: "すべてのドキュメント", path: "/ すべてのドキュメント", count: documents.length }
  const normalizedFolderSearch = folderSearch.trim().toLowerCase()
  const filteredFolders = normalizedFolderSearch
    ? folders.filter((folder) => `${folder.name} ${folder.path}`.toLowerCase().includes(normalizedFolderSearch))
    : folders
  const selectedFolder = selectedFolderId === "all" ? allDocumentsFolder : folders.find((folder) => folder.id === selectedFolderId) ?? allDocumentsFolder
  const selectedGroupId = selectedFolder?.group?.groupId ?? ""
  const uploadDestination = uploadGroupId ? documentGroups.find((group) => group.groupId === uploadGroupId) : undefined
  const uploadDestinationLabel = uploadDestination?.name ?? "未選択"
  const canUploadToDestination = canWrite && Boolean(uploadGroupId)
  const visibleDocuments = selectedFolder?.group ? documents.filter((document) => documentGroupIds(document).includes(selectedFolder.group!.groupId)) : documents
  const visibleChunkCount = visibleDocuments.reduce((sum, document) => sum + document.chunkCount, 0)
  const latestDocuments = [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 3)
  const selectedSharedEntries = selectedFolder.group ? sharedEntries(selectedFolder.group) : []

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canUploadToDestination) return
    await onUpload(uploadFile)
    setUploadFile(null)
  }

  async function onCreateGroupSubmit(event: FormEvent) {
    event.preventDefault()
    const name = groupName.trim()
    if (!name || !canWrite) return
    await onCreateGroup({ name, visibility: "private" })
    setGroupName("")
  }

  async function onShareSubmit(event: FormEvent) {
    event.preventDefault()
    const targetGroupId = shareGroupId || selectedGroupId
    if (!targetGroupId || !canWrite) return
    const groups = shareGroups.split(",").map((item) => item.trim()).filter(Boolean)
    await onShareGroup(targetGroupId, { visibility: groups.length > 0 ? "shared" : "private", sharedGroups: groups })
    setShareGroups("")
  }

  async function runConfirmedAction() {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    if (action.kind === "delete") await onDelete(action.document.documentId)
    if (action.kind === "stage") await onStageReindex(action.document.documentId)
    if (action.kind === "cutover") await onCutoverReindex(action.migration.migrationId)
    if (action.kind === "rollback") await onRollbackReindex(action.migration.migrationId)
  }

  return (
    <section className="document-workspace" aria-label="ドキュメント管理">
      <header className="document-page-header">
        <div>
          <button className="document-back-button" type="button" onClick={onBack} title="管理者設定へ戻る" aria-label="管理者設定へ戻る">
            <Icon name="chevron" />
          </button>
          <div>
            <h2>ドキュメント管理</h2>
            <nav aria-label="パンくず">
              <span>ホーム</span>
              <span>/</span>
              <span>ドキュメント</span>
              <span>/</span>
              <strong>{selectedFolder.name}</strong>
            </nav>
          </div>
        </div>
        {loading && <LoadingStatus label="ドキュメント一覧を更新中" />}
      </header>

      <div className="document-management-layout">
        <aside className="document-folder-panel" aria-label="フォルダツリー">
          <div className="folder-search-row" role="search">
            <label className="sr-only" htmlFor="document-folder-search">フォルダを検索</label>
            <input
              id="document-folder-search"
              type="search"
              value={folderSearch}
              onChange={(event) => setFolderSearch(event.target.value)}
              placeholder="フォルダを検索"
              autoComplete="off"
            />
            <button type="button" title="フォルダ検索をクリア" aria-label="フォルダ検索をクリア" disabled={!folderSearch} onClick={() => setFolderSearch("")}>
              <Icon name="close" />
            </button>
          </div>
          <div className="folder-tree">
            <button
              className={`folder-tree-row ${selectedFolderId === "all" ? "active" : ""}`}
              type="button"
              aria-current={selectedFolderId === "all" ? "true" : undefined}
              onClick={() => {
                setSelectedFolderId("all")
                onUploadGroupChange("")
              }}
            >
              <Icon name="folder" />
              <span>すべてのドキュメント</span>
              <strong>{documents.length}</strong>
            </button>
            <div className="folder-tree-group">
              <div className="folder-tree-row parent">
                <Icon name="folder" />
                <span>ドキュメントグループ</span>
                <strong>{documentGroups.length}</strong>
              </div>
              {filteredFolders.map((folder) => (
                <button
                  className={`folder-tree-row child ${selectedFolder?.id === folder.id ? "active" : ""}`}
                  type="button"
                  key={folder.id}
                  aria-current={selectedFolder?.id === folder.id ? "true" : undefined}
                  onClick={() => {
                    setSelectedFolderId(folder.id)
                    if (folder.group) onUploadGroupChange(folder.group.groupId)
                  }}
                >
                  <Icon name="folder" />
                  <span>{folder.name}</span>
                  <strong>{folder.count}</strong>
                </button>
              ))}
              {documentGroups.length === 0 ? (
                <p className="folder-tree-empty">登録済みグループはありません。</p>
              ) : filteredFolders.length === 0 ? (
                <p className="folder-tree-empty">一致するフォルダはありません。</p>
              ) : null}
            </div>
          </div>
        </aside>

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
              <div className="empty-question-panel">
                <strong>登録済みドキュメントはありません。</strong>
                <span>{documentGroups.length === 0 ? "まずフォルダを作成し、保存先を選択してからファイルをアップロードしてください。" : "保存先フォルダを選択してファイルをアップロードしてください。"}</span>
                <button type="button" disabled={!canWrite || !uploadGroupId} onClick={() => uploadInputRef.current?.click()}>
                  ファイルをアップロード
                </button>
              </div>
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
                      onClick={() => setConfirmAction({ kind: "stage", document })}
                    >
                      {operationState.stagingReindexDocumentId === document.documentId ? <LoadingSpinner className="button-spinner" /> : <Icon name="gauge" />}
                    </button>
                    <button
                      type="button"
                      className="delete-document-button"
                      title={`${document.fileName}を削除`}
                      aria-label={`${document.fileName}を削除`}
                      disabled={!canDelete || operationState.deletingDocumentId === document.documentId}
                      onClick={() => setConfirmAction({ kind: "delete", document })}
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

          {canReindex && migrations.length > 0 && (
            <div className="migration-strip" aria-label="再インデックス移行一覧">
              {migrations.map((migration) => (
                <article className="migration-chip" key={migration.migrationId}>
                  <strong>{migration.status}</strong>
                  <span>{migration.sourceDocumentId} → {migration.stagedDocumentId}</span>
                  <button type="button" disabled={operationState.cutoverMigrationId === migration.migrationId || migration.status !== "staged"} onClick={() => setConfirmAction({ kind: "cutover", migration })}>
                    {operationState.cutoverMigrationId === migration.migrationId ? <LoadingSpinner className="button-spinner" /> : "切替"}
                  </button>
                  <button type="button" disabled={operationState.rollbackMigrationId === migration.migrationId || migration.status !== "cutover"} onClick={() => setConfirmAction({ kind: "rollback", migration })}>
                    {operationState.rollbackMigrationId === migration.migrationId ? <LoadingSpinner className="button-spinner" /> : "戻す"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="document-detail-panel" aria-label="フォルダ情報と共有設定">
          <section className="folder-info-card">
            <h3>フォルダ情報 / 共有設定</h3>
            <div className="folder-info-box">
              <Icon name="folder" />
              <div>
                <strong>{selectedFolder.name}</strong>
                <span>パス: {selectedFolder.path}</span>
              </div>
            </div>
            <dl className="folder-stats">
              <div>
                <dt>ファイル数</dt>
                <dd>{visibleDocuments.length}</dd>
              </div>
              <div>
                <dt>総チャンク数</dt>
                <dd>{visibleChunkCount}</dd>
              </div>
            </dl>
          </section>

          <section className="sharing-card">
            <div className="card-title-row">
              <h3>共有設定（フォルダレベル）</h3>
            </div>
            <form className="compact-form" onSubmit={onShareSubmit}>
              <label>
                <span>共有フォルダ</span>
                <select ref={shareSelectRef} value={shareGroupId || selectedGroupId} disabled={!canWrite || operationState.sharingGroupId !== null} onChange={(event) => setShareGroupId(event.target.value)}>
                  <option value="">選択してください</option>
                  {documentGroups.map((group) => (
                    <option value={group.groupId} key={group.groupId}>{group.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>共有 Cognito group</span>
                <input value={shareGroups} disabled={!canWrite || operationState.sharingGroupId !== null} onChange={(event) => setShareGroups(event.target.value)} placeholder="Cognito group をカンマ区切りで入力" />
              </label>
              <button type="submit" disabled={!canWrite || (!shareGroupId && !selectedGroupId) || operationState.sharingGroupId !== null}>
                {operationState.sharingGroupId !== null && <LoadingSpinner className="button-spinner" />}
                共有更新
              </button>
            </form>
            <ul className="sharing-member-list">
              {selectedFolder.group ? (
                selectedSharedEntries.length === 0 ? (
                  <li>共有先は設定されていません。</li>
                ) : (
                  selectedSharedEntries.map((entry) => (
                    <li key={`${entry.kind}-${entry.value}`}>
                      <Icon name="inbox" />
                      <span>{entry.value}</span>
                      <strong>{entry.kind}</strong>
                    </li>
                  ))
                )
              ) : (
                <li>グループを選択すると共有先を確認できます。</li>
              )}
            </ul>
          </section>

          <section className="folder-operation-card">
            <h3>フォルダ操作</h3>
            <form className="compact-form" onSubmit={onSubmit}>
              <label>
                <span>保存先フォルダ</span>
                <select value={uploadGroupId} disabled={!canWrite || operationState.isUploading} onChange={(event) => onUploadGroupChange(event.target.value)}>
                  <option value="">保存先を選択</option>
                  {documentGroups.map((group) => (
                    <option value={group.groupId} key={group.groupId}>{group.name}</option>
                  ))}
                </select>
              </label>
              <label className="compact-file-input" aria-label="文書アップロード">
                <Icon name="download" />
                <span>{uploadFile ? `一時選択: ${uploadFile.name} / 保存先: ${uploadDestinationLabel}` : "ファイルをアップロード"}</span>
                <input ref={uploadInputRef} type="file" aria-label="アップロードする文書を選択" disabled={!canUploadToDestination || operationState.isUploading} onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
              </label>
              {!uploadGroupId && <p className="field-hint">保存先フォルダを選択するとアップロードできます。</p>}
              <button type="submit" disabled={!canUploadToDestination || !uploadFile || operationState.isUploading}>
                {operationState.isUploading && <LoadingSpinner className="button-spinner" />}
                <span>アップロード</span>
              </button>
            </form>
            {uploadState && (
              <UploadProgressPanel uploadState={uploadState} destinationLabel={uploadState.groupId ? documentGroups.find((group) => group.groupId === uploadState.groupId)?.name ?? uploadState.groupId : "未選択"} />
            )}
            <form className="compact-form" onSubmit={onCreateGroupSubmit}>
              <label>
                <span>新規フォルダ</span>
                <input value={groupName} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => setGroupName(event.target.value)} placeholder="フォルダ名" />
              </label>
              <button type="submit" disabled={!canWrite || !groupName.trim() || operationState.creatingGroup}>
                {operationState.creatingGroup && <LoadingSpinner className="button-spinner" />}
                新規フォルダ
              </button>
            </form>
          </section>

          <section className="recent-update-card">
            <div className="card-title-row">
              <h3>最近の更新</h3>
            </div>
            <ul>
              {latestDocuments.length === 0 ? (
                <li>最近の更新はありません。</li>
              ) : (
                latestDocuments.map((document) => (
                  <li key={document.documentId}>
                    <span className="update-avatar">{document.fileName.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{document.fileName}</strong>
                      <span>を更新しました</span>
                      <small>{formatDateTime(document.createdAt)}</small>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>
      {confirmAction && (
        <ConfirmDialog
          action={confirmAction}
          documents={documents}
          documentGroups={documentGroups}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmedAction()}
        />
      )}
    </section>
  )
}

function FileIcon({ document }: { document: DocumentManifest }) {
  const type = fileTypeLabel(document)
  return <span className={`file-type-icon file-type-${fileTypeClassName(type)}`}>{type.slice(0, 1)}</span>
}

function UploadProgressPanel({ uploadState, destinationLabel }: { uploadState: NonNullable<DocumentUploadState>; destinationLabel: string }) {
  const steps: Array<{ phase: NonNullable<DocumentUploadState>["phase"]; label: string }> = [
    { phase: "preparing", label: "アップロード準備中" },
    { phase: "transferring", label: "ファイル転送中" },
    { phase: "creatingRun", label: "取り込みジョブ作成中" },
    { phase: "extracting", label: "テキスト抽出中" },
    { phase: "chunking", label: "チャンク作成中" },
    { phase: "embedding", label: "ベクトル化中" },
    { phase: "indexing", label: "検索インデックス反映中" },
    { phase: "complete", label: "完了" }
  ]
  const activeIndex = uploadState.phase === "failed" ? -1 : steps.findIndex((step) => step.phase === uploadState.phase)

  return (
    <div className="upload-progress-panel" role="status" aria-live="polite">
      <div>
        <strong>{uploadState.fileName}</strong>
        <span>保存先: {destinationLabel}</span>
        {uploadState.runId && <code>run ID: {uploadState.runId}</code>}
      </div>
      <ol>
        {steps.map((step, index) => (
          <li className={uploadStepClassName(index, activeIndex, uploadState.phase)} key={step.phase}>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      {uploadState.phase === "failed" && (
        <p className="upload-error-message">失敗原因: {uploadErrorLabel(uploadState.errorKind)}{uploadState.errorMessage ? `（${uploadState.errorMessage}）` : ""}</p>
      )}
      {uploadState.phase !== "failed" && uploadState.phase !== "complete" && (
        <p className="field-hint">取り込み run の詳細ステップは API status から推定しています。</p>
      )}
      {uploadState.phase === "complete" && (
        <div className="upload-complete-actions" aria-label="アップロード完了後の操作">
          <span>この資料に質問できます</span>
          <span>アップロード先フォルダを確認できます</span>
          <span>再インデックス状況を確認できます</span>
        </div>
      )}
    </div>
  )
}

function ConfirmDialog({
  action,
  documents,
  documentGroups,
  onCancel,
  onConfirm
}: {
  action: ConfirmAction
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  onCancel: () => void
  onConfirm: () => void
}) {
  const details = confirmDetails(action, documents, documentGroups)
  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="document-confirm-title">
        <h3 id="document-confirm-title">{details.title}</h3>
        <p>{details.message}</p>
        <dl>
          {details.rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="confirm-dialog-actions">
          <button type="button" onClick={onCancel}>キャンセル</button>
          <button type="button" className={details.danger ? "danger" : ""} onClick={onConfirm}>{details.confirmLabel}</button>
        </div>
      </div>
    </div>
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

function uploadStepClassName(index: number, activeIndex: number, phase: NonNullable<DocumentUploadState>["phase"]): string {
  if (phase === "failed") return "failed"
  if (index < activeIndex) return "done"
  if (index === activeIndex) return "active"
  return ""
}

function uploadErrorLabel(errorKind: NonNullable<DocumentUploadState>["errorKind"]): string {
  if (errorKind === "fileType") return "ファイル形式"
  if (errorKind === "extraction") return "抽出失敗"
  if (errorKind === "timeout") return "タイムアウト"
  if (errorKind === "permission") return "権限不足"
  if (errorKind === "network") return "ネットワーク失敗"
  return "不明"
}

function fileTypeLabel(document: DocumentManifest): string {
  if (document.mimeType) return mimeTypeLabel(document.mimeType)
  const extension = document.fileName.split(".").pop()?.toLowerCase()
  if (extension === "md" || extension === "markdown") return "Markdown"
  if (extension === "tex") return "TeX"
  if (extension === "pdf") return "PDF"
  if (extension === "doc" || extension === "docx") return "Word"
  if (extension === "ppt" || extension === "pptx") return "PowerPoint"
  return extension?.toUpperCase() ?? "File"
}

function mimeTypeLabel(mimeType: string): string {
  if (mimeType === "text/markdown") return "Markdown"
  if (mimeType === "text/plain") return "Text"
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word"
  if (mimeType === "application/vnd.ms-powerpoint" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "PowerPoint"
  return mimeType
}

function fileTypeClassName(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file"
}

function countDocumentsForGroup(documents: DocumentManifest[], groupId: string): number {
  return documents.filter((document) => documentGroupIds(document).includes(groupId)).length
}

function documentGroupIds(document: DocumentManifest): string[] {
  const raw = document.metadata?.groupIds ?? document.metadata?.groupId
  return typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
}

function sharedEntries(group: DocumentGroup): Array<{ kind: string; value: string }> {
  const entries = [
    ...group.sharedGroups.map((value) => ({ kind: "Cognito group", value })),
    ...group.sharedUserIds.map((value) => ({ kind: "User ID", value }))
  ]
  if (group.visibility === "org") entries.unshift({ kind: "公開範囲", value: "組織全体" })
  return entries
}
