import { type FormEvent, useMemo, useState } from "react"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
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

export function DocumentWorkspace({
  documents,
  documentGroups = [],
  loading,
  canWrite,
  canDelete,
  canReindex,
  uploadGroupId = "",
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
  const selectedFolder = selectedFolderId === "all" ? allDocumentsFolder : folders.find((folder) => folder.id === selectedFolderId) ?? allDocumentsFolder
  const selectedGroupId = selectedFolder?.group?.groupId ?? uploadGroupId
  const visibleDocuments = selectedFolder?.group ? documents.filter((document) => documentGroupIds(document).includes(selectedFolder.group!.groupId)) : documents
  const visibleChunkCount = visibleDocuments.reduce((sum, document) => sum + document.chunkCount, 0)
  const visibleMemoryCardCount = visibleDocuments.reduce((sum, document) => sum + document.memoryCardCount, 0)
  const totalChunks = documents.reduce((sum, document) => sum + document.chunkCount, 0)
  const totalMemoryCards = documents.reduce((sum, document) => sum + document.memoryCardCount, 0)
  const latestDocuments = [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 3)
  const selectedSharedEntries = selectedFolder.group ? sharedEntries(selectedFolder.group) : []

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canWrite) return
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

  return (
    <section className="document-workspace" aria-label="ドキュメント管理">
      <header className="document-page-header">
        <div>
          <button className="document-back-button" type="button" onClick={onBack} title="管理者設定へ戻る">
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
        {loading && <LoadingStatus label="ドキュメントAPIを処理中" />}
      </header>

      <div className="document-management-layout">
        <aside className="document-folder-panel" aria-label="フォルダツリー">
          <div className="folder-tree">
            <button className={`folder-tree-row ${selectedFolderId === "all" ? "active" : ""}`} type="button" onClick={() => setSelectedFolderId("all")}>
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
              {folders.map((folder) => (
                <button
                  className={`folder-tree-row child ${selectedFolder?.id === folder.id ? "active" : ""}`}
                  type="button"
                  key={folder.id}
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
              {folders.length === 0 && <p className="folder-tree-empty">登録済みグループはありません。</p>}
            </div>
          </div>
          <div className="storage-summary" aria-label="登録状況">
            <div>
              <span>登録済みドキュメント</span>
              <strong>{documents.length} 件</strong>
            </div>
            <div>
              <span>チャンク</span>
              <strong>{totalChunks} 件</strong>
            </div>
            <div>
              <span>メモリカード</span>
              <strong>{totalMemoryCards} 件</strong>
            </div>
          </div>
        </aside>

        <section className="document-file-panel" aria-label="登録文書一覧">
          <div className="document-file-panel-head">
            <h3>{selectedFolder.name}</h3>
            <span className="sr-only">登録文書</span>
          </div>

          <div className="document-file-table" role="table" aria-label="登録文書">
            <div className="document-file-row document-file-head" role="row">
              <span role="columnheader">ファイル名</span>
              <span role="columnheader">種別</span>
              <span role="columnheader">更新日</span>
              <span role="columnheader">チャンク数</span>
              <span role="columnheader">メモリカード</span>
              <span role="columnheader">状態</span>
              <span role="columnheader">操作</span>
            </div>
            {visibleDocuments.length === 0 ? (
              <div className="empty-question-panel">登録済みドキュメントはありません。</div>
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
                  <span role="cell">{document.memoryCardCount}</span>
                  <span role="cell">{document.lifecycleStatus ?? "active"}</span>
                  <span role="cell" className="document-actions-cell">
                    <button
                      type="button"
                      title={`${document.fileName}の再インデックスをステージング`}
                      disabled={!canReindex || loading}
                      onClick={() => void onStageReindex(document.documentId)}
                    >
                      {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="gauge" />}
                    </button>
                    <button
                      type="button"
                      className="delete-document-button"
                      title={`${document.fileName}を削除`}
                      disabled={!canDelete || loading}
                      onClick={() => onDelete(document.documentId)}
                    >
                      {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="trash" />}
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
                  <button type="button" disabled={loading || migration.status !== "staged"} onClick={() => void onCutoverReindex(migration.migrationId)}>切替</button>
                  <button type="button" disabled={loading || migration.status !== "cutover"} onClick={() => void onRollbackReindex(migration.migrationId)}>戻す</button>
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
              <div>
                <dt>総メモリカード数</dt>
                <dd>{visibleMemoryCardCount}</dd>
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
                <select value={shareGroupId || selectedGroupId} disabled={!canWrite || loading} onChange={(event) => setShareGroupId(event.target.value)}>
                  <option value="">選択してください</option>
                  {documentGroups.map((group) => (
                    <option value={group.groupId} key={group.groupId}>{group.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>共有 Cognito group</span>
                <input value={shareGroups} disabled={!canWrite || loading} onChange={(event) => setShareGroups(event.target.value)} placeholder="Cognito group をカンマ区切りで入力" />
              </label>
              <button type="submit" disabled={!canWrite || (!shareGroupId && !selectedGroupId) || loading}>共有更新</button>
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
                <select value={uploadGroupId} disabled={!canWrite || loading} onChange={(event) => onUploadGroupChange(event.target.value)}>
                  <option value="">フォルダなし</option>
                  {documentGroups.map((group) => (
                    <option value={group.groupId} key={group.groupId}>{group.name}</option>
                  ))}
                </select>
              </label>
              <label className="compact-file-input" aria-label="文書アップロード">
                <Icon name="download" />
                <span>{uploadFile ? uploadFile.name : "ファイルをアップロード"}</span>
                <input type="file" disabled={!canWrite || loading} onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
              </label>
              <button type="submit" disabled={!canWrite || !uploadFile || loading}>
                {loading && <LoadingSpinner className="button-spinner" />}
                <span>アップロード</span>
              </button>
            </form>
            <form className="compact-form" onSubmit={onCreateGroupSubmit}>
              <label>
                <span>新規フォルダ</span>
                <input value={groupName} disabled={!canWrite || loading} onChange={(event) => setGroupName(event.target.value)} placeholder="フォルダ名" />
              </label>
              <button type="submit" disabled={!canWrite || !groupName.trim() || loading}>新規フォルダ</button>
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
    </section>
  )
}

function FileIcon({ document }: { document: DocumentManifest }) {
  const type = fileTypeLabel(document)
  return <span className={`file-type-icon file-type-${fileTypeClassName(type)}`}>{type.slice(0, 1)}</span>
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
