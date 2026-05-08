import { type FormEvent, useState } from "react"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../shared/utils/format.js"

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
    if (!shareGroupId || !canWrite) return
    const groups = shareGroups.split(",").map((item) => item.trim()).filter(Boolean)
    await onShareGroup(shareGroupId, { visibility: groups.length > 0 ? "shared" : "private", sharedGroups: groups })
    setShareGroups("")
  }

  return (
    <section className="admin-workspace" aria-label="ドキュメント管理">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="管理者設定へ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>ドキュメント管理</h2>
          <span>{documents.length} 件の登録文書</span>
        </div>
      </header>
      {loading && <LoadingStatus label="ドキュメントAPIを処理中" />}

      <div className="document-admin-grid">
        <section className="document-admin-panel" aria-label="文書アップロード">
          <h3>アップロード</h3>
          <form className="document-upload-form" onSubmit={onSubmit}>
            <label>
              <span>保存先フォルダ</span>
              <select value={uploadGroupId} disabled={!canWrite || loading} onChange={(event) => onUploadGroupChange(event.target.value)}>
                <option value="">フォルダなし</option>
                {documentGroups.map((group) => (
                  <option value={group.groupId} key={group.groupId}>{group.name}</option>
                ))}
              </select>
            </label>
            <label className="document-upload-drop">
              <Icon name="paperclip" />
              <span>{uploadFile ? uploadFile.name : "ファイルを選択"}</span>
              <input type="file" disabled={!canWrite || loading} onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </label>
            <button type="submit" className="button-with-spinner" disabled={!canWrite || !uploadFile || loading}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>アップロード</span>
            </button>
          </form>
        </section>

        <section className="document-admin-panel" aria-label="フォルダ管理">
          <h3>フォルダ</h3>
          <form className="document-upload-form" onSubmit={onCreateGroupSubmit}>
            <label>
              <span>新規フォルダ</span>
              <input value={groupName} disabled={!canWrite || loading} onChange={(event) => setGroupName(event.target.value)} placeholder="社内規定" />
            </label>
            <button type="submit" disabled={!canWrite || !groupName.trim() || loading}>作成</button>
          </form>
          <form className="document-upload-form" onSubmit={onShareSubmit}>
            <label>
              <span>共有フォルダ</span>
              <select value={shareGroupId} disabled={!canWrite || loading} onChange={(event) => setShareGroupId(event.target.value)}>
                <option value="">選択してください</option>
                {documentGroups.map((group) => (
                  <option value={group.groupId} key={group.groupId}>{group.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>共有 Cognito group</span>
              <input value={shareGroups} disabled={!canWrite || loading} onChange={(event) => setShareGroups(event.target.value)} placeholder="CHAT_USER,RAG_GROUP_MANAGER" />
            </label>
            <button type="submit" disabled={!canWrite || !shareGroupId || loading}>共有更新</button>
          </form>
          <div className="document-table" role="table" aria-label="フォルダ一覧">
            {documentGroups.length === 0 ? (
              <div className="empty-question-panel">フォルダはありません。</div>
            ) : (
              documentGroups.map((group) => (
                <div className="document-table-row" role="row" key={group.groupId}>
                  <span role="cell">{group.name}</span>
                  <span role="cell">{group.visibility}</span>
                  <span role="cell">{group.sharedGroups.join(", ") || "-"}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="document-admin-panel document-list-panel" aria-label="登録文書一覧">
          <div className="document-list-head">
            <h3>登録文書</h3>
            <span>{documents.length} 件</span>
          </div>
          <div className="document-table" role="table" aria-label="登録文書">
            <div className="document-table-row document-table-head" role="row">
              <span role="columnheader">ファイル名</span>
              <span role="columnheader">フォルダ</span>
              <span role="columnheader">チャンク</span>
              <span role="columnheader">メモリ</span>
              <span role="columnheader">登録日時</span>
              <span role="columnheader">操作</span>
            </div>
            {documents.length === 0 ? (
              <div className="empty-question-panel">登録済みドキュメントはありません。</div>
            ) : (
              documents.map((document) => (
                <div className="document-table-row" role="row" key={document.documentId}>
                  <span role="cell">{document.fileName}</span>
                  <span role="cell">{groupNamesForDocument(document, documentGroups)}</span>
                  <span role="cell">{document.chunkCount}</span>
                  <span role="cell">{document.memoryCardCount}</span>
                  <span role="cell">{formatDateTime(document.createdAt)}</span>
                  <span role="cell">
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
        </section>

        {canReindex && (
          <section className="document-admin-panel document-list-panel" aria-label="再インデックス移行一覧">
            <div className="document-list-head">
              <h3>Blue-green reindex</h3>
              <span>{migrations.length} 件</span>
            </div>
            <div className="migration-list">
              {migrations.length === 0 ? (
                <div className="empty-question-panel">ステージング中の再インデックスはありません。</div>
              ) : (
                migrations.map((migration) => (
                  <article className="migration-card" key={migration.migrationId}>
                    <div>
                      <strong>{migration.status}</strong>
                      <span>{migration.sourceDocumentId} → {migration.stagedDocumentId}</span>
                      <small>{formatDateTime(migration.updatedAt)}</small>
                    </div>
                    <div className="inline-action-group">
                      <button
                        type="button"
                        disabled={loading || migration.status !== "staged"}
                        onClick={() => void onCutoverReindex(migration.migrationId)}
                      >
                        {loading && <LoadingSpinner className="button-spinner" />}
                        <span>切替</span>
                      </button>
                      <button
                        type="button"
                        disabled={loading || migration.status !== "cutover"}
                        onClick={() => void onRollbackReindex(migration.migrationId)}
                      >
                        {loading && <LoadingSpinner className="button-spinner" />}
                        <span>戻す</span>
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

function groupNamesForDocument(document: DocumentManifest, groups: DocumentGroup[]): string {
  const raw = document.metadata?.groupIds ?? document.metadata?.groupId
  const groupIds = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
  if (groupIds.length === 0) return "-"
  return groupIds.map((groupId) => groups.find((group) => group.groupId === groupId)?.name ?? groupId).join(", ")
}
