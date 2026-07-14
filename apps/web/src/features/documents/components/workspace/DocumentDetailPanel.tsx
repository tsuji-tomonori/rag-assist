import type { FormEvent, RefObject } from "react"
import { Icon } from "../../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import type { DocumentOperationState, DocumentUploadState } from "../../hooks/useDocuments.js"
import { operationResultClassName, rootFolderParentValue, uploadErrorLabel, uploadStepClassName, type DocumentOperationEvent, type WorkspaceFolder } from "./documentWorkspaceUtils.js"

export function DocumentDetailPanel({
  documentGroups,
  selectedFolder,
  selectedGroupId,
  selectedSharedEntries,
  shareHasValidationError,
  shareHasEmptyToken,
  shareHasDuplicate,
  shareDuplicates,
  shareDiff,
  shareDraftGroups,
  shareGroupOptions,
  shareHasChanges,
  shareRequiresClearConfirmation,
  shareClearConfirmed,
  visibleDocuments,
  visibleChunkCount,
  uploadGroupId,
  uploadFile,
  uploadDestinationLabel,
  uploadState,
  uploadedDocument,
  uploadedDocumentGroupId,
  recentOperationEvents,
  groupName,
  groupDescription,
  groupParentId,
  moveToCreatedGroup,
  createParentGroup,
  canCreateGroup,
  createGroupDisabledReason,
  shareGroupId,
  shareGroups,
  folderSharePolicyVersion,
  folderSharePolicyInitialized,
  folderShareLoading,
  folderShareLoadError,
  folderShareReason,
  editTargetGroup,
  editGroupName,
  editGroupDescription,
  editGroupParentId,
  editGroupMoveReason,
  editMoveTargetGroups,
  editDestinationLabel,
  editParentInvalid,
  editPathHasChanges,
  editDescriptionChanged,
  editVersionAvailable,
  editHasChanges,
  editCanSubmit,
  canWrite,
  canCreateGroups,
  canShareGroups,
  canMoveGroups,
  canManageSelectedFolder,
  canSubmitShare,
  canUploadToDestination,
  uploadDisabledReason,
  operationState,
  uploadInputRef,
  createGroupNameRef,
  shareSelectRef,
  onUploadFileChange,
  onGroupNameChange,
  onGroupDescriptionChange,
  onGroupParentIdChange,
  onMoveToCreatedGroupChange,
  onShareGroupIdChange,
  onShareGroupsChange,
  onFolderShareReasonChange,
  onShareClearConfirmedChange,
  onShareGroupOptionChange,
  onEditGroupNameChange,
  onEditGroupDescriptionChange,
  onEditGroupParentIdChange,
  onEditGroupMoveReasonChange,
  onUploadGroupChange,
  onUploadSubmit,
  onOpenUploadedDocument,
  onAskUploadedDocument,
  onShowUploadedFolder,
  onCreateGroupSubmit,
  onShareSubmit,
  onEditGroupSubmit
}: {
  documentGroups: DocumentGroup[]
  selectedFolder: WorkspaceFolder
  selectedGroupId: string
  selectedSharedEntries: Array<{ kind: string; value: string }>
  shareHasValidationError: boolean
  shareHasEmptyToken: boolean
  shareHasDuplicate: boolean
  shareDuplicates: string[]
  shareDiff: { added: string[]; removed: string[]; unchanged: string[] }
  shareDraftGroups: string[]
  shareGroupOptions: string[]
  shareHasChanges: boolean
  shareRequiresClearConfirmation: boolean
  shareClearConfirmed: boolean
  visibleDocuments: DocumentManifest[]
  visibleChunkCount: number
  uploadGroupId: string
  uploadFile: File | null
  uploadDestinationLabel: string
  uploadState: DocumentUploadState
  uploadedDocument: DocumentManifest | null
  uploadedDocumentGroupId: string
  recentOperationEvents: DocumentOperationEvent[]
  groupName: string
  groupDescription: string
  groupParentId: string
  moveToCreatedGroup: boolean
  createParentGroup?: DocumentGroup
  canCreateGroup: boolean
  createGroupDisabledReason: string | null
  shareGroupId: string
  shareGroups: string
  folderSharePolicyVersion?: string
  folderSharePolicyInitialized: boolean
  folderShareLoading: boolean
  folderShareLoadError: string | null
  folderShareReason: string
  editTargetGroup?: DocumentGroup
  editGroupName: string
  editGroupDescription: string
  editGroupParentId: string
  editGroupMoveReason: string
  editMoveTargetGroups: DocumentGroup[]
  editDestinationLabel: string
  editParentInvalid: boolean
  editPathHasChanges: boolean
  editDescriptionChanged: boolean
  editVersionAvailable: boolean
  editHasChanges: boolean
  editCanSubmit: boolean
  canWrite: boolean
  canCreateGroups: boolean
  canShareGroups: boolean
  canMoveGroups: boolean
  canManageSelectedFolder: boolean
  canSubmitShare: boolean
  canUploadToDestination: boolean
  uploadDisabledReason: string | null
  operationState: DocumentOperationState
  uploadInputRef: RefObject<HTMLInputElement | null>
  createGroupNameRef: RefObject<HTMLInputElement | null>
  shareSelectRef: RefObject<HTMLSelectElement | null>
  onUploadFileChange: (file: File | null) => void
  onGroupNameChange: (value: string) => void
  onGroupDescriptionChange: (value: string) => void
  onGroupParentIdChange: (value: string) => void
  onMoveToCreatedGroupChange: (value: boolean) => void
  onShareGroupIdChange: (value: string) => void
  onShareGroupsChange: (value: string) => void
  onFolderShareReasonChange: (value: string) => void
  onShareClearConfirmedChange: (value: boolean) => void
  onShareGroupOptionChange: (groupName: string, checked: boolean) => void
  onEditGroupNameChange: (value: string) => void
  onEditGroupDescriptionChange: (value: string) => void
  onEditGroupParentIdChange: (value: string) => void
  onEditGroupMoveReasonChange: (value: string) => void
  onUploadGroupChange: (groupId: string) => void
  onUploadSubmit: (event: FormEvent) => void
  onOpenUploadedDocument: (document: DocumentManifest) => void
  onAskUploadedDocument?: (document: DocumentManifest) => void
  onShowUploadedFolder: (groupId: string) => void
  onCreateGroupSubmit: (event: FormEvent) => void
  onShareSubmit: (event: FormEvent) => void
  onEditGroupSubmit: (event: FormEvent) => void
}) {
  const editBusy = operationState.sharingGroupId !== null || (operationState.movingGroupId ?? null) !== null

  return (
    <aside className="document-detail-panel" aria-label="フォルダ情報と共有設定">
      <section className="folder-info-card">
        <h3>{canManageSelectedFolder ? "フォルダ情報 / 共有設定" : "フォルダ情報"}</h3>
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

      {canManageSelectedFolder && <>
      <section className="sharing-card">
        <div className="card-title-row">
          <h3>共有設定（フォルダレベル）</h3>
        </div>
        <form className="compact-form" onSubmit={onShareSubmit}>
          <label>
            <span>共有フォルダ</span>
            <select ref={shareSelectRef} value={shareGroupId || selectedGroupId} disabled={!canShareGroups || operationState.sharingGroupId !== null} onChange={(event) => onShareGroupIdChange(event.target.value)}>
              <option value="">選択してください</option>
              {documentGroups.map((group) => (
                <option value={group.groupId} key={group.groupId}>{group.name}</option>
              ))}
            </select>
          </label>
          {folderShareLoading && <p className="field-hint" aria-live="polite">versioned 共有 policy を読み込み中です。</p>}
          {folderShareLoadError && <p className="error" role="alert">{folderShareLoadError}</p>}
          {folderSharePolicyVersion && (
            <p className="field-hint">
              policy version: {folderSharePolicyVersion} / {folderSharePolicyInitialized ? "明示 policy" : "未設定（管理 principal の full grant から初期化）"}
            </p>
          )}
          <label>
            <span>共有 resource group ID</span>
            <input
              value={shareGroups}
              disabled={!canShareGroups || folderShareLoading || !folderSharePolicyVersion || operationState.sharingGroupId !== null}
              onChange={(event) => onShareGroupsChange(event.target.value)}
              placeholder="resource group ID をカンマ区切りで入力"
              aria-invalid={shareHasValidationError || undefined}
              aria-describedby="share-groups-validation share-groups-diff"
            />
          </label>
          <div className="share-validation" id="share-groups-validation" aria-live="polite">
            {shareHasEmptyToken && <p className="error">空の group 指定があります。余分なカンマを削除してください。</p>}
            {shareHasDuplicate && <p className="error">重複している group: {shareDuplicates.join(", ")}</p>}
            {!shareHasValidationError && !shareHasChanges && <p>既存の共有設定から変更はありません。</p>}
            {!shareHasValidationError && <p>入力した readOnly resource group と、表示中の user/full/deny entry を complete policy として送信します。active・同一 tenant の存在確認は API 更新時に行われます。</p>}
          </div>
          <fieldset className="share-group-selector" aria-label="共有 resource group 候補">
            <legend>現行 policy の readOnly resource group</legend>
            {shareGroupOptions.length === 0 ? (
              <p>候補はありません。必要な resource group ID を入力してください。</p>
            ) : (
              <div className="share-group-options">
                {shareGroupOptions.map((groupName) => {
                  const checked = shareDraftGroups.includes(groupName)
                  return (
                    <label key={groupName}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canShareGroups || folderShareLoading || !folderSharePolicyVersion || operationState.sharingGroupId !== null}
                        onChange={(event) => onShareGroupOptionChange(groupName, event.target.checked)}
                      />
                      <span>{groupName}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>
          <div className="share-diff-preview" id="share-groups-diff" aria-label="共有変更差分">
            <span>追加: {shareDiff.added.length > 0 ? shareDiff.added.join(", ") : "なし"}</span>
            <span>削除: {shareDiff.removed.length > 0 ? shareDiff.removed.join(", ") : "なし"}</span>
            <span>変更なし: {shareDiff.unchanged.length > 0 ? shareDiff.unchanged.join(", ") : "なし"}</span>
          </div>
          {shareRequiresClearConfirmation && (
            <label className="share-clear-confirm">
              <input
                type="checkbox"
                checked={shareClearConfirmed}
                disabled={!canShareGroups || folderShareLoading || !folderSharePolicyVersion || operationState.sharingGroupId !== null}
                onChange={(event) => onShareClearConfirmedChange(event.target.checked)}
              />
              <span>既存共有をすべて削除することを確認しました</span>
            </label>
          )}
          <label>
            <span>変更理由</span>
            <textarea
              value={folderShareReason}
              disabled={!canShareGroups || folderShareLoading || !folderSharePolicyVersion || operationState.sharingGroupId !== null}
              onChange={(event) => onFolderShareReasonChange(event.target.value)}
              placeholder="共有 policy を変更する理由"
              required
            />
          </label>
          <button type="submit" disabled={!canSubmitShare}>
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

      <section className="sharing-card">
        <div className="card-title-row">
          <h3>選択フォルダ更新</h3>
        </div>
        <form className="compact-form" onSubmit={onEditGroupSubmit}>
          <label>
            <span>編集後フォルダ名</span>
            <input
              value={editGroupName}
              disabled={!canMoveGroups || !editTargetGroup || editBusy}
              onChange={(event) => onEditGroupNameChange(event.target.value)}
              placeholder="フォルダ名"
              aria-invalid={(Boolean(editTargetGroup) && !editGroupName.trim()) || undefined}
              aria-describedby="edit-folder-validation edit-folder-preview"
            />
          </label>
          <label>
            <span>移動先フォルダ</span>
            <select
              value={editGroupParentId}
              disabled={!canMoveGroups || !editTargetGroup || editBusy}
              onChange={(event) => onEditGroupParentIdChange(event.target.value)}
              aria-invalid={editParentInvalid || undefined}
              aria-describedby="edit-folder-validation edit-folder-preview"
            >
              <option value={rootFolderParentValue}>ルート</option>
              {editMoveTargetGroups.map((group) => (
                <option
                  value={group.groupId}
                  key={group.groupId}
                  disabled={group.effectivePermission !== "full"}
                >
                  {group.canonicalPath ?? group.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>編集後説明</span>
            <textarea
              value={editGroupDescription}
              disabled={!canShareGroups || !editTargetGroup || editBusy}
              onChange={(event) => onEditGroupDescriptionChange(event.target.value)}
              placeholder="フォルダの用途や対象資料"
              aria-describedby="edit-folder-preview"
            />
          </label>
          <label>
            <span>フォルダ移動理由</span>
            <textarea
              value={editGroupMoveReason}
              disabled={!canMoveGroups || !editTargetGroup || !editPathHasChanges || editBusy}
              onChange={(event) => onEditGroupMoveReasonChange(event.target.value)}
              placeholder="名前または格納先を変更する理由"
              required={editPathHasChanges}
              aria-describedby="edit-folder-validation"
            />
          </label>
          <div className="share-validation" id="edit-folder-validation" aria-live="polite">
            {!editTargetGroup && <p>フォルダを選択すると名前、格納先、説明を更新できます。</p>}
            {editTargetGroup && !editGroupName.trim() && <p className="error">フォルダ名を入力してください。</p>}
            {editTargetGroup && editPathHasChanges && !canMoveGroups && <p className="error">フォルダを移動する権限がありません。</p>}
            {editTargetGroup && editPathHasChanges && !editGroupMoveReason.trim() && <p className="error">フォルダ移動理由を入力してください。</p>}
            {editTargetGroup && editPathHasChanges && !editVersionAvailable && <p className="error">フォルダ version を取得できないため移動できません。</p>}
            {editTargetGroup && editPathHasChanges && editParentInvalid && <p className="error">移動先フォルダの full 権限が必要です。</p>}
            {editTargetGroup && !editHasChanges && <p>選択フォルダの設定から変更はありません。</p>}
          </div>
          <div className="share-diff-preview" id="edit-folder-preview" aria-label="フォルダ更新プレビュー">
            <span>現在 path: {editTargetGroup?.canonicalPath ?? "未選択"}</span>
            <span>移動先: {editDestinationLabel}</span>
            <span>folder version: {editTargetGroup?.updatedAt ?? "未取得"}</span>
            <span>path 更新: {editPathHasChanges ? "専用 folder.move API" : "なし"}</span>
            <span>説明更新: {editDescriptionChanged ? "あり" : "なし"}</span>
          </div>
          <button type="submit" disabled={!editCanSubmit}>
            {editBusy && <LoadingSpinner className="button-spinner" />}
            フォルダ更新
          </button>
        </form>
      </section>
      </>}

      <section className="folder-operation-card">
        <h3>フォルダ操作</h3>
        <form className="compact-form" onSubmit={onUploadSubmit}>
          <label>
            <span>保存先フォルダ</span>
            <select value={uploadGroupId} disabled={!canWrite || operationState.isUploading} onChange={(event) => onUploadGroupChange(event.target.value)}>
              <option value="">保存先を選択</option>
              {documentGroups.filter(canUploadToGroup).map((group) => (
                <option value={group.groupId} key={group.groupId}>{group.name}</option>
              ))}
            </select>
          </label>
          <label className="compact-file-input" aria-label="文書アップロード">
            <Icon name="upload" />
            <span>{uploadFile ? `一時選択: ${uploadFile.name} / 保存先: ${uploadDestinationLabel}` : "ファイルをアップロード"}</span>
            <input ref={uploadInputRef} type="file" aria-label="アップロードする文書を選択" disabled={!canUploadToDestination || operationState.isUploading} onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)} />
          </label>
          {uploadDisabledReason && <p className="field-hint">{uploadDisabledReason}</p>}
          <button type="submit" disabled={!canUploadToDestination || !uploadFile || operationState.isUploading}>
            {operationState.isUploading && <LoadingSpinner className="button-spinner" />}
            <span>アップロード</span>
          </button>
        </form>
        {uploadState && (
          <UploadProgressPanel
            uploadState={uploadState}
            destinationLabel={uploadState.groupId ? documentGroups.find((group) => group.groupId === uploadState.groupId)?.name ?? uploadState.groupId : "未選択"}
            uploadedDocument={uploadedDocument}
            uploadedDocumentGroupId={uploadedDocumentGroupId}
            onOpenUploadedDocument={onOpenUploadedDocument}
            onAskUploadedDocument={onAskUploadedDocument}
            onShowUploadedFolder={onShowUploadedFolder}
          />
        )}
        <form className="compact-form" onSubmit={onCreateGroupSubmit}>
          <label>
            <span>新規フォルダ名</span>
            <input ref={createGroupNameRef} value={groupName} disabled={!canCreateGroups || operationState.creatingGroup} onChange={(event) => onGroupNameChange(event.target.value)} placeholder="フォルダ名" />
          </label>
          <label>
            <span>説明</span>
            <textarea value={groupDescription} disabled={!canCreateGroups || operationState.creatingGroup} onChange={(event) => onGroupDescriptionChange(event.target.value)} placeholder="フォルダの用途や対象資料" />
          </label>
          <label>
            <span>親フォルダ</span>
            <select value={groupParentId} disabled={!canCreateGroups || operationState.creatingGroup} onChange={(event) => onGroupParentIdChange(event.target.value)}>
              <option value="">親フォルダなし</option>
              {documentGroups.map((group) => (
                <option value={group.groupId} key={group.groupId}>{group.name}</option>
              ))}
            </select>
          </label>
          <label className="compact-checkbox">
            <input type="checkbox" checked={moveToCreatedGroup} disabled={!canCreateGroups || operationState.creatingGroup} onChange={(event) => onMoveToCreatedGroupChange(event.target.checked)} />
            <span>作成後にこのフォルダへ移動</span>
          </label>
          <div className="share-validation" id="create-group-validation" aria-live="polite">
            {createGroupDisabledReason && createGroupDisabledReason !== "新規フォルダ名を入力してください。" && <p className="error">{createGroupDisabledReason}</p>}
            <p>新規フォルダは作成者が管理する非公開状態で作成されます。共有は作成後に共有設定から更新してください。</p>
          </div>
          <div className="share-diff-preview" id="create-group-preview" aria-label="新規フォルダ作成プレビュー">
            <span>公開範囲: 非公開</span>
            <span>親フォルダ: {createParentGroup?.name ?? "なし"}</span>
            <span>共有先: 作成後に設定</span>
            <span>管理者: 作成者</span>
            <span>作成後移動: {moveToCreatedGroup ? "する" : "しない"}</span>
          </div>
          <button type="submit" disabled={!canCreateGroup}>
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

export function UploadProgressPanel({
  uploadState,
  destinationLabel,
  uploadedDocument,
  uploadedDocumentGroupId,
  onOpenUploadedDocument,
  onAskUploadedDocument,
  onShowUploadedFolder
}: {
  uploadState: NonNullable<DocumentUploadState>
  destinationLabel: string
  uploadedDocument: DocumentManifest | null
  uploadedDocumentGroupId: string
  onOpenUploadedDocument: (document: DocumentManifest) => void
  onAskUploadedDocument?: (document: DocumentManifest) => void
  onShowUploadedFolder: (groupId: string) => void
}) {
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
        uploadedDocument ? (
          <div className="upload-complete-actions" aria-label="アップロード完了後の操作">
            <button type="button" onClick={() => onOpenUploadedDocument(uploadedDocument)}>詳細を開く</button>
            {onAskUploadedDocument && <button type="button" onClick={() => onAskUploadedDocument(uploadedDocument)}>この資料に質問する</button>}
            {uploadedDocumentGroupId && <button type="button" onClick={() => onShowUploadedFolder(uploadedDocumentGroupId)}>フォルダ内で表示</button>}
          </div>
        ) : (
          <p className="field-hint">アップロードは完了しました。文書一覧の更新後に詳細を開けます。</p>
        )
      )}
    </div>
  )
}

function canUploadToGroup(group: DocumentGroup): boolean {
  return group.effectivePermission === "full"
}
