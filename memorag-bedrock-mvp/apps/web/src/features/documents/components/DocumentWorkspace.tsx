import { type FormEvent, useState } from "react"
import type { DocumentManifest } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { formatDateTime } from "../../../shared/utils/format.js"

export function DocumentWorkspace({
  documents,
  loading,
  canWrite,
  canDelete,
  onUpload,
  onDelete,
  onBack
}: {
  documents: DocumentManifest[]
  loading: boolean
  canWrite: boolean
  canDelete: boolean
  onUpload: (file: File) => Promise<void>
  onDelete: (documentId: string) => Promise<void>
  onBack: () => void
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canWrite) return
    await onUpload(uploadFile)
    setUploadFile(null)
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

      <div className="document-admin-grid">
        <section className="document-admin-panel" aria-label="文書アップロード">
          <h3>アップロード</h3>
          <form className="document-upload-form" onSubmit={onSubmit}>
            <label className="document-upload-drop">
              <Icon name="paperclip" />
              <span>{uploadFile ? uploadFile.name : "ファイルを選択"}</span>
              <input type="file" disabled={!canWrite || loading} onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </label>
            <button type="submit" disabled={!canWrite || !uploadFile || loading}>
              アップロード
            </button>
          </form>
        </section>

        <section className="document-admin-panel document-list-panel" aria-label="登録文書一覧">
          <div className="document-list-head">
            <h3>登録文書</h3>
            <span>{documents.length} 件</span>
          </div>
          <div className="document-table" role="table" aria-label="登録文書">
            <div className="document-table-row document-table-head" role="row">
              <span role="columnheader">ファイル名</span>
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
                  <span role="cell">{document.chunkCount}</span>
                  <span role="cell">{document.memoryCardCount}</span>
                  <span role="cell">{formatDateTime(document.createdAt)}</span>
                  <span role="cell">
                    <button
                      type="button"
                      className="delete-document-button"
                      title={`${document.fileName}を削除`}
                      disabled={!canDelete || loading}
                      onClick={() => onDelete(document.documentId)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
