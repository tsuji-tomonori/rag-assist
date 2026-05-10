import type { FormEvent, RefObject } from "react"
import { Icon } from "../../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import type { DocumentOperationState, DocumentUploadState } from "../../hooks/useDocuments.js"
import { uploadErrorLabel, uploadStepClassName, type WorkspaceFolder } from "./documentWorkspaceUtils.js"
import type { sharedEntries } from "./documentWorkspaceUtils.js"

export function DocumentDetailPanel({
  documentGroups,
  selectedFolder,
  selectedGroupId,
  selectedSharedEntries,
  visibleDocuments,
  visibleChunkCount,
  uploadGroupId,
  uploadFile,
  uploadDestinationLabel,
  uploadState,
  latestDocuments,
  groupName,
  shareGroupId,
  shareGroups,
  canWrite,
  canUploadToDestination,
  operationState,
  uploadInputRef,
  shareSelectRef,
  onUploadFileChange,
  onGroupNameChange,
  onShareGroupIdChange,
  onShareGroupsChange,
  onUploadGroupChange,
  onUploadSubmit,
  onCreateGroupSubmit,
  onShareSubmit
}: {
  documentGroups: DocumentGroup[]
  selectedFolder: WorkspaceFolder
  selectedGroupId: string
  selectedSharedEntries: ReturnType<typeof sharedEntries>
  visibleDocuments: DocumentManifest[]
  visibleChunkCount: number
  uploadGroupId: string
  uploadFile: File | null
  uploadDestinationLabel: string
  uploadState: DocumentUploadState
  latestDocuments: DocumentManifest[]
  groupName: string
  shareGroupId: string
  shareGroups: string
  canWrite: boolean
  canUploadToDestination: boolean
  operationState: DocumentOperationState
  uploadInputRef: RefObject<HTMLInputElement | null>
  shareSelectRef: RefObject<HTMLSelectElement | null>
  onUploadFileChange: (file: File | null) => void
  onGroupNameChange: (value: string) => void
  onShareGroupIdChange: (value: string) => void
  onShareGroupsChange: (value: string) => void
  onUploadGroupChange: (groupId: string) => void
  onUploadSubmit: (event: FormEvent) => void
  onCreateGroupSubmit: (event: FormEvent) => void
  onShareSubmit: (event: FormEvent) => void
}) {
  return (
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
            <select ref={shareSelectRef} value={shareGroupId || selectedGroupId} disabled={!canWrite || operationState.sharingGroupId !== null} onChange={(event) => onShareGroupIdChange(event.target.value)}>
              <option value="">選択してください</option>
              {documentGroups.map((group) => (
                <option value={group.groupId} key={group.groupId}>{group.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>共有 Cognito group</span>
            <input value={shareGroups} disabled={!canWrite || operationState.sharingGroupId !== null} onChange={(event) => onShareGroupsChange(event.target.value)} placeholder="Cognito group をカンマ区切りで入力" />
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
        <form className="compact-form" onSubmit={onUploadSubmit}>
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
            <input ref={uploadInputRef} type="file" aria-label="アップロードする文書を選択" disabled={!canUploadToDestination || operationState.isUploading} onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)} />
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
            <input value={groupName} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => onGroupNameChange(event.target.value)} placeholder="フォルダ名" />
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
  )
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
