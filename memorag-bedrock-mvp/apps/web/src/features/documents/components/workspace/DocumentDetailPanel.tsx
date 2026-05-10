import type { FormEvent, RefObject } from "react"
import { Icon } from "../../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import type { DocumentOperationState, DocumentUploadState } from "../../hooks/useDocuments.js"
import { operationResultClassName, uploadErrorLabel, uploadStepClassName, type DocumentOperationEvent, type WorkspaceFolder } from "./documentWorkspaceUtils.js"
import type { sharedEntries } from "./documentWorkspaceUtils.js"

export function DocumentDetailPanel({
  documentGroups,
  selectedFolder,
  selectedGroupId,
  selectedSharedEntries,
  shareTargetGroupId,
  shareHasValidationError,
  shareHasEmptyToken,
  shareHasDuplicate,
  shareDuplicates,
  shareDiff,
  visibleDocuments,
  visibleChunkCount,
  uploadGroupId,
  uploadFile,
  uploadDestinationLabel,
  uploadState,
  recentOperationEvents,
  groupName,
  groupDescription,
  groupParentId,
  groupVisibility,
  groupSharedGroups,
  groupManagerUserIds,
  moveToCreatedGroup,
  createSharedDraft,
  createManagerDraft,
  validatesCreateSharedGroups,
  createHasValidationError,
  createParentGroup,
  createVisibilityLabel,
  shareGroupId,
  shareGroups,
  canWrite,
  canUploadToDestination,
  operationState,
  uploadInputRef,
  shareSelectRef,
  onUploadFileChange,
  onGroupNameChange,
  onGroupDescriptionChange,
  onGroupParentIdChange,
  onGroupVisibilityChange,
  onGroupSharedGroupsChange,
  onGroupManagerUserIdsChange,
  onMoveToCreatedGroupChange,
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
  shareTargetGroupId: string
  shareHasValidationError: boolean
  shareHasEmptyToken: boolean
  shareHasDuplicate: boolean
  shareDuplicates: string[]
  shareDiff: { added: string[]; removed: string[]; unchanged: string[] }
  visibleDocuments: DocumentManifest[]
  visibleChunkCount: number
  uploadGroupId: string
  uploadFile: File | null
  uploadDestinationLabel: string
  uploadState: DocumentUploadState
  recentOperationEvents: DocumentOperationEvent[]
  groupName: string
  groupDescription: string
  groupParentId: string
  groupVisibility: "private" | "shared" | "org"
  groupSharedGroups: string
  groupManagerUserIds: string
  moveToCreatedGroup: boolean
  createSharedDraft: { groups: string[]; duplicates: string[]; hasEmptyToken: boolean }
  createManagerDraft: { groups: string[]; duplicates: string[]; hasEmptyToken: boolean }
  validatesCreateSharedGroups: boolean
  createHasValidationError: boolean
  createParentGroup?: DocumentGroup
  createVisibilityLabel: string
  shareGroupId: string
  shareGroups: string
  canWrite: boolean
  canUploadToDestination: boolean
  operationState: DocumentOperationState
  uploadInputRef: RefObject<HTMLInputElement | null>
  shareSelectRef: RefObject<HTMLSelectElement | null>
  onUploadFileChange: (file: File | null) => void
  onGroupNameChange: (value: string) => void
  onGroupDescriptionChange: (value: string) => void
  onGroupParentIdChange: (value: string) => void
  onGroupVisibilityChange: (value: "private" | "shared" | "org") => void
  onGroupSharedGroupsChange: (value: string) => void
  onGroupManagerUserIdsChange: (value: string) => void
  onMoveToCreatedGroupChange: (value: boolean) => void
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
            <input
              value={shareGroups}
              disabled={!canWrite || operationState.sharingGroupId !== null}
              onChange={(event) => onShareGroupsChange(event.target.value)}
              placeholder="Cognito group をカンマ区切りで入力"
              aria-invalid={shareHasValidationError || undefined}
              aria-describedby="share-groups-validation share-groups-diff"
            />
          </label>
          <div className="share-validation" id="share-groups-validation" aria-live="polite">
            {shareHasEmptyToken && <p className="error">空の group 指定があります。余分なカンマを削除してください。</p>}
            {shareHasDuplicate && <p className="error">重複している group: {shareDuplicates.join(", ")}</p>}
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
            <span>新規フォルダ名</span>
            <input value={groupName} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => onGroupNameChange(event.target.value)} placeholder="フォルダ名" />
          </label>
          <label>
            <span>説明</span>
            <textarea value={groupDescription} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => onGroupDescriptionChange(event.target.value)} placeholder="フォルダの用途や対象資料" />
          </label>
          <label>
            <span>親フォルダ</span>
            <select value={groupParentId} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => onGroupParentIdChange(event.target.value)}>
              <option value="">親フォルダなし</option>
              {documentGroups.map((group) => (
                <option value={group.groupId} key={group.groupId}>{group.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>公開範囲</span>
            <select value={groupVisibility} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => onGroupVisibilityChange(event.target.value as "private" | "shared" | "org")}>
              <option value="private">非公開</option>
              <option value="shared">指定 group 共有</option>
              <option value="org">組織全体</option>
            </select>
          </label>
          <label>
            <span>初期 shared groups</span>
            <input
              value={groupSharedGroups}
              disabled={!canWrite || operationState.creatingGroup || groupVisibility !== "shared"}
              onChange={(event) => onGroupSharedGroupsChange(event.target.value)}
              placeholder="Cognito group をカンマ区切りで入力"
              aria-invalid={(validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken || createSharedDraft.duplicates.length > 0)) || undefined}
              aria-describedby="create-group-validation create-group-preview"
            />
          </label>
          <label>
            <span>管理者 user IDs</span>
            <input
              value={groupManagerUserIds}
              disabled={!canWrite || operationState.creatingGroup}
              onChange={(event) => onGroupManagerUserIdsChange(event.target.value)}
              placeholder="User ID をカンマ区切りで入力"
              aria-invalid={(createManagerDraft.hasEmptyToken || createManagerDraft.duplicates.length > 0) || undefined}
              aria-describedby="create-group-validation create-group-preview"
            />
          </label>
          <label className="compact-checkbox">
            <input type="checkbox" checked={moveToCreatedGroup} disabled={!canWrite || operationState.creatingGroup} onChange={(event) => onMoveToCreatedGroupChange(event.target.checked)} />
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
