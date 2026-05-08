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

const supplementalFolders = [
  { id: "guidelines", name: "ガイドライン", count: 12 },
  { id: "templates", name: "テンプレート", count: 10 },
  { id: "onboarding", name: "オンボーディング", count: 34 },
  { id: "product", name: "プロダクト仕様", count: 52 },
  { id: "faq", name: "FAQ", count: 27 },
  { id: "security", name: "セキュリティ", count: 18 },
  { id: "marketing", name: "マーケティング", count: 8 }
]

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
  const [selectedFolderId, setSelectedFolderId] = useState(documentGroups[0]?.groupId ?? "2025")

  const folders = useMemo<WorkspaceFolder[]>(() => {
    const fromGroups = documentGroups.map((group) => ({
      id: group.groupId,
      name: group.name,
      path: `/ 社内規定 / ${group.name}`,
      count: countDocumentsForGroup(documents, group.groupId),
      group
    }))
    const currentYearFolder = fromGroups[0] ?? {
      id: "2025",
      name: "2025",
      path: "/ 社内規定 / 2025",
      count: documents.length
    }

    return [
      currentYearFolder,
      ...fromGroups.filter((group) => group.id !== currentYearFolder.id),
      ...supplementalFolders.map((folder) => ({
        ...folder,
        path: `/ ${folder.name}`
      }))
    ]
  }, [documentGroups, documents])

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? folders[0]
  const selectedGroupId = selectedFolder?.group?.groupId ?? uploadGroupId
  const visibleDocuments = selectedFolder?.group ? documents.filter((document) => documentGroupIds(document).includes(selectedFolder.group!.groupId)) : documents
  const totalChunks = documents.reduce((sum, document) => sum + document.chunkCount, 0)
  const totalMemoryCards = documents.reduce((sum, document) => sum + document.memoryCardCount, 0)
  const latestDocuments = [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 3)

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
              <span>社内規定</span>
              <span>/</span>
              <strong>{selectedFolder?.name ?? "すべて"}</strong>
            </nav>
          </div>
        </div>
        {loading && <LoadingStatus label="ドキュメントAPIを処理中" />}
      </header>

      <div className="document-management-layout">
        <aside className="document-folder-panel" aria-label="フォルダツリー">
          <div className="folder-search-row">
            <label>
              <span className="sr-only">フォルダを検索</span>
              <input placeholder="フォルダを検索" />
            </label>
            <button type="button" title="フォルダを絞り込み">
              <Icon name="gauge" />
            </button>
          </div>
          <div className="folder-tree">
            <button className={`folder-tree-row ${selectedFolderId === "all" ? "active" : ""}`} type="button" onClick={() => setSelectedFolderId("all")}>
              <Icon name="folder" />
              <span>すべてのドキュメント</span>
              <strong>{documents.length}</strong>
            </button>
            <div className="folder-tree-group">
              <button className="folder-tree-row parent" type="button">
                <Icon name="folder" />
                <span>社内規定</span>
                <Icon name="share" />
                <strong>{Math.max(documents.length, 86)}</strong>
              </button>
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
            </div>
          </div>
          <div className="storage-summary" aria-label="ストレージ使用状況">
            <div>
              <span>ストレージ使用状況</span>
              <strong>12.8 / 550 GB</strong>
            </div>
            <progress value="25.7" max="100">25.7%</progress>
          </div>
        </aside>

        <section className="document-file-panel" aria-label="登録文書一覧">
          <div className="document-file-panel-head">
            <h3>社内規定 / {selectedFolder?.name ?? "すべて"}</h3>
            <div>
              <button type="button" title="新規フォルダ" disabled={!canWrite || loading}>
                <Icon name="plus" />
              </button>
              <button type="button" title="共有設定">
                <Icon name="share" />
              </button>
            </div>
          </div>

          <div className="document-file-table" role="table" aria-label="登録文書">
            <div className="document-file-row document-file-head" role="row">
              <span role="columnheader" aria-label="選択" />
              <span role="columnheader">ファイル名</span>
              <span role="columnheader">種別</span>
              <span role="columnheader">更新日</span>
              <span role="columnheader">チャンク数</span>
              <span role="columnheader">メモリ</span>
              <span role="columnheader">再インデックス</span>
              <span role="columnheader">操作</span>
            </div>
            {visibleDocuments.length === 0 ? (
              <div className="empty-question-panel">登録済みドキュメントはありません。</div>
            ) : (
              visibleDocuments.map((document, index) => (
                <div className="document-file-row" role="row" key={document.documentId}>
                  <span role="cell">
                    <input type="checkbox" aria-label={`${document.fileName}を選択`} defaultChecked={index < 2} />
                  </span>
                  <span role="cell" className="document-name-cell">
                    <FileIcon fileName={document.fileName} />
                    <span>{document.fileName}</span>
                  </span>
                  <span role="cell">{fileTypeLabel(document.fileName)}</span>
                  <span role="cell">{formatDateTime(document.createdAt)}</span>
                  <span role="cell">{document.chunkCount}</span>
                  <span role="cell">{formatMemory(document)}</span>
                  <span role="cell">
                    <input
                      type="checkbox"
                      aria-label={`${document.fileName}を再インデックス対象にする`}
                      defaultChecked={index < 2}
                      disabled={!canReindex || loading}
                      onChange={(event) => {
                        if (event.target.checked) void onStageReindex(document.documentId)
                      }}
                    />
                  </span>
                  <span role="cell" className="document-actions-cell">
                    <button
                      type="button"
                      title={`${document.fileName}の再インデックスをステージング`}
                      disabled={!canReindex || loading}
                      onClick={() => void onStageReindex(document.documentId)}
                    >
                      {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="gauge" />}
                    </button>
                    <details className="document-action-menu">
                      <summary title={`${document.fileName}の操作メニュー`}>...</summary>
                      <div>
                        <button type="button">
                          <Icon name="document" />
                          <span>名前を変更</span>
                        </button>
                        <button type="button">
                          <Icon name="folder" />
                          <span>移動</span>
                        </button>
                        <button
                          type="button"
                          className="delete-document-button"
                          title={`${document.fileName}を削除`}
                          disabled={!canDelete || loading}
                          onClick={() => onDelete(document.documentId)}
                        >
                          {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="trash" />}
                          <span>削除</span>
                        </button>
                      </div>
                    </details>
                  </span>
                </div>
              ))
            )}
          </div>

          <footer className="document-table-footer">
            <span>1-{visibleDocuments.length} / {visibleDocuments.length} 件を表示</span>
            <div>
              <button type="button" title="前のページ">
                <Icon name="chevron" />
              </button>
              <strong>1</strong>
              <button type="button" title="次のページ">
                <Icon name="chevron" />
              </button>
            </div>
            <select aria-label="表示件数">
              <option>20 件/ページ</option>
              <option>50 件/ページ</option>
            </select>
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
                <strong>社内規定 / {selectedFolder?.name ?? "すべて"}</strong>
                <span>パス: {selectedFolder?.path ?? "/ すべてのドキュメント"}</span>
              </div>
            </div>
            <dl className="folder-stats">
              <div>
                <dt>ファイル数</dt>
                <dd>{visibleDocuments.length}</dd>
              </div>
              <div>
                <dt>総チャンク数</dt>
                <dd>{selectedFolder?.group ? visibleDocuments.reduce((sum, document) => sum + document.chunkCount, 0) : totalChunks}</dd>
              </div>
              <div>
                <dt>総メモリ</dt>
                <dd>{Math.max(1, totalMemoryCards)} cards</dd>
              </div>
            </dl>
          </section>

          <section className="sharing-card">
            <div className="card-title-row">
              <h3>共有設定（フォルダレベル）</h3>
              <button type="button" disabled={!canWrite || loading}>共有を編集</button>
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
                <input value={shareGroups} disabled={!canWrite || loading} onChange={(event) => setShareGroups(event.target.value)} placeholder="CHAT_USER,RAG_GROUP" />
              </label>
              <button type="submit" disabled={!canWrite || (!shareGroupId && !selectedGroupId) || loading}>共有更新</button>
            </form>
            <ul className="sharing-member-list">
              {(selectedFolder?.group?.sharedGroups.length ? selectedFolder.group.sharedGroups : ["管理部", "総務", "CHAT_USER", "RAG_GROUP"]).map((member, index) => (
                <li key={`${member}-${index}`}>
                  <Icon name="inbox" />
                  <span>{member}</span>
                  <strong>{index === 0 ? "編集者" : "閲覧者"}</strong>
                </li>
              ))}
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
              <label className="compact-file-input">
                <Icon name="download" />
                <span>{uploadFile ? uploadFile.name : "このフォルダにアップロード"}</span>
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
                <input value={groupName} disabled={!canWrite || loading} onChange={(event) => setGroupName(event.target.value)} placeholder="2026" />
              </label>
              <button type="submit" disabled={!canWrite || !groupName.trim() || loading}>新規フォルダ</button>
            </form>
          </section>

          <section className="recent-update-card">
            <div className="card-title-row">
              <h3>最近の更新</h3>
              <button type="button">すべて表示</button>
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

function FileIcon({ fileName }: { fileName: string }) {
  const type = fileTypeLabel(fileName)
  return <span className={`file-type-icon file-type-${type.toLowerCase()}`}>{type.slice(0, 1)}</span>
}

function fileTypeLabel(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase()
  if (extension === "md" || extension === "markdown") return "Markdown"
  if (extension === "tex") return "TeX"
  if (extension === "pdf") return "PDF"
  if (extension === "doc" || extension === "docx") return "Word"
  if (extension === "ppt" || extension === "pptx") return "PowerPoint"
  return extension?.toUpperCase() ?? "File"
}

function formatMemory(document: DocumentManifest): string {
  const estimatedKb = Math.max(64, document.memoryCardCount * 64 + document.chunkCount * 28)
  return estimatedKb >= 1024 ? `${(estimatedKb / 1024).toFixed(1)} MB` : `${estimatedKb} KB`
}

function countDocumentsForGroup(documents: DocumentManifest[], groupId: string): number {
  return documents.filter((document) => documentGroupIds(document).includes(groupId)).length
}

function documentGroupIds(document: DocumentManifest): string[] {
  const raw = document.metadata?.groupIds ?? document.metadata?.groupId
  return typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
}
