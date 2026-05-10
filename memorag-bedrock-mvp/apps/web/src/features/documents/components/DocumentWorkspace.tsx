import { type FormEvent, useMemo, useRef, useState } from "react"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import type { CreateDocumentGroupInput, DocumentOperationState, DocumentUploadState } from "../hooks/useDocuments.js"
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

type DocumentSortKey = "updatedDesc" | "updatedAsc" | "fileNameAsc" | "chunkDesc" | "typeAsc"

type DocumentOperationEvent = {
  id: string
  actionLabel: string
  target: string
  occurredAt?: string
  actor?: string
  result: "反映済み" | "要求済み" | "進行中" | "失敗"
  detail?: string
}

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
  onCreateGroup: (input: CreateDocumentGroupInput) => Promise<DocumentGroup | void>
  onShareGroup: (groupId: string, input: { visibility?: "private" | "shared" | "org"; sharedGroups?: string[]; sharedUserIds?: string[] }) => Promise<void>
  onDelete: (documentId: string) => Promise<void>
  onStageReindex: (documentId: string) => Promise<void>
  onCutoverReindex: (migrationId: string) => Promise<void>
  onRollbackReindex: (migrationId: string) => Promise<void>
  onBack: () => void
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [groupParentId, setGroupParentId] = useState("")
  const [groupVisibility, setGroupVisibility] = useState<"private" | "shared" | "org">("private")
  const [groupSharedGroups, setGroupSharedGroups] = useState("")
  const [groupManagerUserIds, setGroupManagerUserIds] = useState("")
  const [moveToCreatedGroup, setMoveToCreatedGroup] = useState(true)
  const [shareGroupId, setShareGroupId] = useState("")
  const [shareGroups, setShareGroups] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState("all")
  const [folderSearch, setFolderSearch] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [documentQuery, setDocumentQuery] = useState("")
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all")
  const [documentStatusFilter, setDocumentStatusFilter] = useState("all")
  const [documentGroupFilter, setDocumentGroupFilter] = useState("all")
  const [documentSort, setDocumentSort] = useState<DocumentSortKey>("updatedDesc")
  const [selectedDocument, setSelectedDocument] = useState<DocumentManifest | null>(null)
  const [copiedDocumentId, setCopiedDocumentId] = useState<string | null>(null)
  const [sessionOperationEvents, setSessionOperationEvents] = useState<DocumentOperationEvent[]>([])
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)
  const operationEventSeqRef = useRef(0)

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
  const folderDocuments = selectedGroupId ? documents.filter((document) => documentGroupIds(document).includes(selectedGroupId)) : documents
  const documentTypeOptions = uniqueSorted(folderDocuments.map(fileTypeLabel))
  const documentStatusOptions = uniqueSorted(folderDocuments.map(documentStatusLabel))
  const normalizedDocumentQuery = documentQuery.trim().toLowerCase()
  const visibleDocuments = folderDocuments
    .filter((document) => {
      const groupIds = documentGroupIds(document)
      const groupNames = groupIds.map((groupId) => documentGroups.find((group) => group.groupId === groupId)?.name ?? groupId)
      const searchable = [document.fileName, document.documentId, fileTypeLabel(document), documentStatusLabel(document), ...groupNames].join(" ").toLowerCase()
      if (normalizedDocumentQuery && !searchable.includes(normalizedDocumentQuery)) return false
      if (documentTypeFilter !== "all" && fileTypeLabel(document) !== documentTypeFilter) return false
      if (documentStatusFilter !== "all" && documentStatusLabel(document) !== documentStatusFilter) return false
      if (documentGroupFilter === "unassigned" && groupIds.length > 0) return false
      if (documentGroupFilter !== "all" && documentGroupFilter !== "unassigned" && !groupIds.includes(documentGroupFilter)) return false
      return true
    })
    .sort((left, right) => compareDocuments(left, right, documentSort))
  const visibleChunkCount = visibleDocuments.reduce((sum, document) => sum + document.chunkCount, 0)
  const recentOperationEvents = useMemo(
    () => buildOperationEvents({ documents, documentGroups, migrations, uploadState, sessionOperationEvents }),
    [documents, documentGroups, migrations, uploadState, sessionOperationEvents]
  )
  const selectedSharedEntries = selectedFolder.group ? sharedEntries(selectedFolder.group) : []
  const shareTargetGroupId = shareGroupId || selectedGroupId
  const shareTargetGroup = documentGroups.find((group) => group.groupId === shareTargetGroupId)
  const shareDraft = parseListInput(shareGroups)
  const shareDiff = buildShareDiff(shareTargetGroup?.sharedGroups ?? [], shareDraft.groups)
  const shareHasDuplicate = shareDraft.duplicates.length > 0
  const shareHasEmptyToken = shareDraft.hasEmptyToken
  const shareHasValidationError = shareHasDuplicate || shareHasEmptyToken
  const createSharedDraft = parseListInput(groupSharedGroups)
  const createManagerDraft = parseListInput(groupManagerUserIds)
  const validatesCreateSharedGroups = groupVisibility === "shared"
  const createHasValidationError = (validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken || createSharedDraft.duplicates.length > 0)) || createManagerDraft.hasEmptyToken || createManagerDraft.duplicates.length > 0
  const createParentGroup = documentGroups.find((group) => group.groupId === groupParentId)
  const createVisibilityLabel = visibilityLabelValue(groupVisibility)

  function recordSessionOperation(actionLabel: string, target: string, detail?: string, result: DocumentOperationEvent["result"] = "要求済み") {
    operationEventSeqRef.current += 1
    const event: DocumentOperationEvent = {
      id: `session-${operationEventSeqRef.current}`,
      actionLabel,
      target,
      detail,
      result,
      occurredAt: new Date().toISOString()
    }
    setSessionOperationEvents((current) => [event, ...current].slice(0, 8))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canUploadToDestination) return
    const fileName = uploadFile.name
    const destination = uploadDestinationLabel
    await onUpload(uploadFile)
    recordSessionOperation("アップロード", fileName, `保存先: ${destination}`)
    setUploadFile(null)
  }

  async function onCreateGroupSubmit(event: FormEvent) {
    event.preventDefault()
    const name = groupName.trim()
    if (!name || !canWrite || createHasValidationError) return
    const input: CreateDocumentGroupInput = {
      name,
      visibility: groupVisibility,
      ...(groupDescription.trim() ? { description: groupDescription.trim() } : {}),
      ...(groupParentId ? { parentGroupId: groupParentId } : {}),
      ...(groupVisibility === "shared" && createSharedDraft.groups.length > 0 ? { sharedGroups: createSharedDraft.groups } : {}),
      ...(createManagerDraft.groups.length > 0 ? { managerUserIds: createManagerDraft.groups } : {})
    }
    const createdGroup = await onCreateGroup(input)
    recordSessionOperation("フォルダ作成", name, `公開範囲: ${createVisibilityLabel}`, createdGroup?.groupId ? "反映済み" : "要求済み")
    if (createdGroup?.groupId && moveToCreatedGroup) {
      setSelectedFolderId(createdGroup.groupId)
      onUploadGroupChange(createdGroup.groupId)
    }
    setGroupName("")
    setGroupDescription("")
    setGroupParentId("")
    setGroupVisibility("private")
    setGroupSharedGroups("")
    setGroupManagerUserIds("")
  }

  async function onShareSubmit(event: FormEvent) {
    event.preventDefault()
    if (!shareTargetGroupId || !canWrite || shareHasValidationError) return
    await onShareGroup(shareTargetGroupId, { visibility: shareDraft.groups.length > 0 ? "shared" : "private", sharedGroups: shareDraft.groups })
    recordSessionOperation("共有更新", shareTargetGroup?.name ?? shareTargetGroupId, `shared groups: ${shareDraft.groups.join(", ") || "なし"}`)
    setShareGroups("")
  }

  async function copyDocumentId(documentId: string) {
    try {
      await navigator.clipboard.writeText(documentId)
      setCopiedDocumentId(documentId)
    } catch {
      setCopiedDocumentId(null)
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    if (action.kind === "delete") {
      await onDelete(action.document.documentId)
      recordSessionOperation("文書削除", action.document.fileName, `documentId: ${action.document.documentId}`)
    }
    if (action.kind === "stage") {
      await onStageReindex(action.document.documentId)
      recordSessionOperation("reindex stage", action.document.fileName, `documentId: ${action.document.documentId}`)
    }
    if (action.kind === "cutover") {
      await onCutoverReindex(action.migration.migrationId)
      recordSessionOperation("reindex cutover", action.migration.migrationId, `${action.migration.sourceDocumentId} → ${action.migration.stagedDocumentId}`)
    }
    if (action.kind === "rollback") {
      await onRollbackReindex(action.migration.migrationId)
      recordSessionOperation("reindex rollback", action.migration.migrationId, `${action.migration.sourceDocumentId} → ${action.migration.stagedDocumentId}`)
    }
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

          <div className="document-filter-bar" aria-label="文書検索と絞り込み">
            <label>
              <span>ファイル名検索</span>
              <input type="search" value={documentQuery} onChange={(event) => setDocumentQuery(event.target.value)} placeholder="ファイル名 / documentId" autoComplete="off" />
            </label>
            <label>
              <span>種別</span>
              <select value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value)}>
                <option value="all">すべて</option>
                {documentTypeOptions.map((type) => (
                  <option value={type} key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              <span>状態</span>
              <select value={documentStatusFilter} onChange={(event) => setDocumentStatusFilter(event.target.value)}>
                <option value="all">すべて</option>
                {documentStatusOptions.map((status) => (
                  <option value={status} key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>所属フォルダ</span>
              <select value={documentGroupFilter} onChange={(event) => setDocumentGroupFilter(event.target.value)}>
                <option value="all">すべて</option>
                <option value="unassigned">未設定</option>
                {documentGroups.map((group) => (
                  <option value={group.groupId} key={group.groupId}>{group.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>並び替え</span>
              <select value={documentSort} onChange={(event) => setDocumentSort(event.target.value as DocumentSortKey)}>
                <option value="updatedDesc">更新日 新しい順</option>
                <option value="updatedAsc">更新日 古い順</option>
                <option value="fileNameAsc">ファイル名順</option>
                <option value="chunkDesc">チャンク数順</option>
                <option value="typeAsc">種別順</option>
              </select>
            </label>
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
            {folderDocuments.length === 0 ? (
              <div className="empty-question-panel">
                <strong>登録済みドキュメントはありません。</strong>
                <span>{documentGroups.length === 0 ? "まずフォルダを作成し、保存先を選択してからファイルをアップロードしてください。" : "保存先フォルダを選択してファイルをアップロードしてください。"}</span>
                <button type="button" disabled={!canWrite || !uploadGroupId} onClick={() => uploadInputRef.current?.click()}>
                  ファイルをアップロード
                </button>
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="empty-question-panel">
                <strong>条件に一致するドキュメントはありません。</strong>
                <span>検索語、種別、状態、所属フォルダの条件を変更してください。</span>
              </div>
            ) : (
              visibleDocuments.map((document) => (
                <div
                  className={`document-file-row ${selectedDocument?.documentId === document.documentId ? "selected" : ""}`}
                  role="row"
                  key={document.documentId}
                  tabIndex={0}
                  aria-label={`${document.fileName}の詳細を表示`}
                  onClick={() => setSelectedDocument(document)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedDocument(document)
                    }
                  }}
                >
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
                      onClick={(event) => {
                        event.stopPropagation()
                        setConfirmAction({ kind: "stage", document })
                      }}
                    >
                      {operationState.stagingReindexDocumentId === document.documentId ? <LoadingSpinner className="button-spinner" /> : <Icon name="gauge" />}
                    </button>
                    <button
                      type="button"
                      className="delete-document-button"
                      title={`${document.fileName}を削除`}
                      aria-label={`${document.fileName}を削除`}
                      disabled={!canDelete || operationState.deletingDocumentId === document.documentId}
                      onClick={(event) => {
                        event.stopPropagation()
                        setConfirmAction({ kind: "delete", document })
                      }}
                    >
                      {operationState.deletingDocumentId === document.documentId ? <LoadingSpinner className="button-spinner" /> : <Icon name="trash" />}
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          <footer className="document-table-footer">
            <span>{visibleDocuments.length} / {folderDocuments.length} 件を表示（全体 {documents.length} 件）</span>
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
                <input value={shareGroups} disabled={!canWrite || operationState.sharingGroupId !== null} onChange={(event) => setShareGroups(event.target.value)} placeholder="Cognito group をカンマ区切りで入力" aria-invalid={shareHasValidationError || undefined} aria-describedby="share-groups-validation share-groups-diff" />
              </label>
              <div className="share-validation" id="share-groups-validation" aria-live="polite">
                {shareHasEmptyToken && <p className="error">空の group 指定があります。余分なカンマを削除してください。</p>}
                {shareHasDuplicate && <p className="error">重複している group: {shareDraft.duplicates.join(", ")}</p>}
                {!shareHasValidationError && <p>入力された group 名だけを共有先として送信します。存在確認は API 更新時に行われます。</p>}
              </div>
              <div className="share-diff-preview" id="share-groups-diff" aria-label="共有変更差分">
                <span>追加: {shareDiff.added.length > 0 ? shareDiff.added.join(", ") : "なし"}</span>
                <span>削除: {shareDiff.removed.length > 0 ? shareDiff.removed.join(", ") : "なし"}</span>
                <span>変更なし: {shareDiff.unchanged.length > 0 ? shareDiff.unchanged.join(", ") : "なし"}</span>
              </div>
              <button type="submit" disabled={!canWrite || !shareTargetGroupId || shareHasValidationError || operationState.sharingGroupId !== null}>
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
                <span>新規フォルダ名</span>
                <input value={groupName} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => setGroupName(event.target.value)} placeholder="フォルダ名" />
              </label>
              <label>
                <span>説明</span>
                <textarea value={groupDescription} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => setGroupDescription(event.target.value)} placeholder="フォルダの用途や対象資料" />
              </label>
              <label>
                <span>親フォルダ</span>
                <select value={groupParentId} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => setGroupParentId(event.target.value)}>
                  <option value="">親フォルダなし</option>
                  {documentGroups.map((group) => (
                    <option value={group.groupId} key={group.groupId}>{group.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>公開範囲</span>
                <select value={groupVisibility} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => setGroupVisibility(event.target.value as "private" | "shared" | "org")}>
                  <option value="private">非公開</option>
                  <option value="shared">指定 group 共有</option>
                  <option value="org">組織全体</option>
                </select>
              </label>
              <label>
                <span>初期 shared groups</span>
                <input value={groupSharedGroups} disabled={!canWrite || operationState.creatingGroup || groupVisibility !== "shared"} onChange={(event) => setGroupSharedGroups(event.target.value)} placeholder="Cognito group をカンマ区切りで入力" aria-invalid={(validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken || createSharedDraft.duplicates.length > 0)) || undefined} aria-describedby="create-group-validation create-group-preview" />
              </label>
              <label>
                <span>管理者 user IDs</span>
                <input value={groupManagerUserIds} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => setGroupManagerUserIds(event.target.value)} placeholder="User ID をカンマ区切りで入力" aria-invalid={(createManagerDraft.hasEmptyToken || createManagerDraft.duplicates.length > 0) || undefined} aria-describedby="create-group-validation create-group-preview" />
              </label>
              <label className="compact-checkbox">
                <input type="checkbox" checked={moveToCreatedGroup} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => setMoveToCreatedGroup(event.target.checked)} />
                <span>作成後にこのフォルダへ移動</span>
              </label>
              <div className="share-validation" id="create-group-validation" aria-live="polite">
                {validatesCreateSharedGroups && createSharedDraft.hasEmptyToken && <p className="error">shared groups に空の指定があります。余分なカンマを削除してください。</p>}
                {validatesCreateSharedGroups && createSharedDraft.duplicates.length > 0 && <p className="error">重複している shared group: {createSharedDraft.duplicates.join(", ")}</p>}
                {createManagerDraft.hasEmptyToken && <p className="error">管理者 user IDs に空の指定があります。余分なカンマを削除してください。</p>}
                {createManagerDraft.duplicates.length > 0 && <p className="error">重複している管理者 user ID: {createManagerDraft.duplicates.join(", ")}</p>}
                {!createHasValidationError && <p>入力値だけを作成 payload に含めます。group / user の存在確認は API 作成時に行われます。</p>}
              </div>
              <div className="share-diff-preview" id="create-group-preview" aria-label="新規フォルダ作成プレビュー">
                <span>公開範囲: {createVisibilityLabel}</span>
                <span>親フォルダ: {createParentGroup?.name ?? "なし"}</span>
                <span>共有先: {groupVisibility === "shared" && createSharedDraft.groups.length > 0 ? createSharedDraft.groups.join(", ") : "なし"}</span>
                <span>管理者: {createManagerDraft.groups.length > 0 ? createManagerDraft.groups.join(", ") : "未指定"}</span>
                <span>作成後移動: {moveToCreatedGroup ? "する" : "しない"}</span>
              </div>
              <button type="submit" disabled={!canWrite || !groupName.trim() || createHasValidationError || operationState.creatingGroup}>
                {operationState.creatingGroup && <LoadingSpinner className="button-spinner" />}
                新規フォルダ
              </button>
            </form>
          </section>

          <section className="recent-update-card">
            <div className="card-title-row">
              <h3>最近の操作</h3>
            </div>
            <p className="field-hint">監査ログ API は未接続です。表示は文書・フォルダ・reindex 状態と現在セッションの操作要求に基づきます。</p>
            <ul aria-label="最近の操作">
              {recentOperationEvents.length === 0 ? (
                <li>最近の操作はありません。</li>
              ) : (
                recentOperationEvents.map((operation) => (
                  <li key={operation.id}>
                    <span className={`update-avatar ${operationResultClassName(operation.result)}`}>{operation.actionLabel.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{operation.actionLabel}</strong>
                      <span>{operation.target}</span>
                      {operation.detail && <small>{operation.detail}</small>}
                      <dl className="operation-log-meta">
                        <div>
                          <dt>時刻</dt>
                          <dd>{operation.occurredAt ? formatDateTime(operation.occurredAt) : "未取得"}</dd>
                        </div>
                        <div>
                          <dt>操作者</dt>
                          <dd>{operation.actor ?? "未取得"}</dd>
                        </div>
                        <div>
                          <dt>状態</dt>
                          <dd>{operation.result}</dd>
                        </div>
                      </dl>
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
      {selectedDocument && (
        <DocumentDetailDrawer
          document={selectedDocument}
          documentGroups={documentGroups}
          copied={copiedDocumentId === selectedDocument.documentId}
          onCopyDocumentId={() => void copyDocumentId(selectedDocument.documentId)}
          onClose={() => setSelectedDocument(null)}
          onDelete={() => {
            setConfirmAction({ kind: "delete", document: selectedDocument })
            setSelectedDocument(null)
          }}
          onStageReindex={() => {
            setConfirmAction({ kind: "stage", document: selectedDocument })
            setSelectedDocument(null)
          }}
          canDelete={canDelete}
          canReindex={canReindex}
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

function DocumentDetailDrawer({
  document,
  documentGroups,
  copied,
  onCopyDocumentId,
  onClose,
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

function compareDocuments(left: DocumentManifest, right: DocumentManifest, sort: DocumentSortKey): number {
  if (sort === "updatedAsc") return left.createdAt.localeCompare(right.createdAt)
  if (sort === "fileNameAsc") return left.fileName.localeCompare(right.fileName, "ja")
  if (sort === "chunkDesc") return right.chunkCount - left.chunkCount
  if (sort === "typeAsc") return fileTypeLabel(left).localeCompare(fileTypeLabel(right), "ja") || left.fileName.localeCompare(right.fileName, "ja")
  return right.createdAt.localeCompare(left.createdAt)
}

function buildOperationEvents({
  documents,
  documentGroups,
  migrations,
  uploadState,
  sessionOperationEvents
}: {
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  migrations: ReindexMigration[]
  uploadState: DocumentUploadState
  sessionOperationEvents: DocumentOperationEvent[]
}): DocumentOperationEvent[] {
  const documentEvents = documents.map((document) => ({
    id: `document-${document.documentId}`,
    actionLabel: "文書更新",
    target: document.fileName,
    occurredAt: metadataString(document, "updatedAt") ?? document.createdAt,
    result: "反映済み" as const,
    detail: `documentId: ${document.documentId}`
  }))
  const groupEvents = documentGroups.map((group) => ({
    id: `group-${group.groupId}`,
    actionLabel: group.updatedAt === group.createdAt ? "フォルダ作成" : "フォルダ更新",
    target: group.name,
    occurredAt: group.updatedAt,
    actor: group.ownerUserId,
    result: "反映済み" as const,
    detail: `公開範囲: ${visibilityLabelValue(group.visibility)}`
  }))
  const migrationEvents = migrations.map((migration) => ({
    id: `migration-${migration.migrationId}`,
    actionLabel: migrationActionLabel(migration.status),
    target: `${migration.sourceDocumentId} → ${migration.stagedDocumentId}`,
    occurredAt: migration.updatedAt,
    actor: migration.createdBy,
    result: "反映済み" as const,
    detail: `migrationId: ${migration.migrationId}`
  }))
  const uploadEvent = uploadState ? [{
    id: `upload-${uploadState.fileName}`,
    actionLabel: "アップロード",
    target: uploadState.fileName,
    occurredAt: uploadState.updatedAt,
    result: uploadState.phase === "failed" ? "失敗" as const : uploadState.phase === "complete" ? "反映済み" as const : "進行中" as const,
    detail: uploadState.runId ? `run ID: ${uploadState.runId}` : undefined
  }] : []

  return [...sessionOperationEvents, ...uploadEvent, ...migrationEvents, ...groupEvents, ...documentEvents]
    .sort((left, right) => (right.occurredAt ?? "").localeCompare(left.occurredAt ?? ""))
    .slice(0, 8)
}

function migrationActionLabel(status: ReindexMigration["status"]): string {
  if (status === "cutover") return "reindex cutover"
  if (status === "rolled_back") return "reindex rollback"
  return "reindex stage"
}

function operationResultClassName(result: DocumentOperationEvent["result"]): string {
  if (result === "失敗") return "failed"
  if (result === "進行中") return "active"
  if (result === "要求済み") return "requested"
  return "done"
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "ja"))
}

function documentStatusLabel(document: DocumentManifest): string {
  return document.lifecycleStatus ?? "active"
}

function parseListInput(value: string): { groups: string[]; duplicates: string[]; hasEmptyToken: boolean } {
  const raw = value.split(",")
  const hasEmptyToken = raw.length > 1 && raw.some((item) => item.trim().length === 0)
  const groups: string[] = []
  const duplicates = new Set<string>()
  for (const item of raw) {
    const group = item.trim()
    if (!group) continue
    if (groups.includes(group)) duplicates.add(group)
    else groups.push(group)
  }
  return { groups, duplicates: [...duplicates], hasEmptyToken }
}

function buildShareDiff(currentGroups: string[], draftGroups: string[]): { added: string[]; removed: string[]; unchanged: string[] } {
  return {
    added: draftGroups.filter((group) => !currentGroups.includes(group)),
    removed: currentGroups.filter((group) => !draftGroups.includes(group)),
    unchanged: draftGroups.filter((group) => currentGroups.includes(group))
  }
}

function metadataString(document: DocumentManifest, key: string): string | undefined {
  const value = document.metadata?.[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function metadataNumber(document: DocumentManifest, key: string): number | undefined {
  const value = document.metadata?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function visibilityLabel(group: DocumentGroup): string {
  if (group.visibility === "org") return `${group.name}: 組織全体`
  if (group.visibility === "shared") return `${group.name}: shared`
  return `${group.name}: private`
}

function visibilityLabelValue(visibility: "private" | "shared" | "org"): string {
  if (visibility === "org") return "組織全体"
  if (visibility === "shared") return "指定 group 共有"
  return "非公開"
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
