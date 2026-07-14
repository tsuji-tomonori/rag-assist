import { type FormEvent, type KeyboardEvent, type RefObject, useEffect, useRef } from "react"
import { Icon } from "../../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import type { DocumentManifest } from "../../types.js"
import type { DocumentOperationState, DocumentUploadState } from "../../hooks/useDocuments.js"
import { UploadProgressPanel } from "./DocumentDetailPanel.js"

export type DocumentUploadDestination = {
  groupId: string
  name: string
  label: string
}

export function DocumentAddDialog({
  destinations,
  uploadGroupId,
  uploadDestinationLabel,
  uploadFile,
  uploadState,
  uploadedDocument,
  uploadedDocumentGroupId,
  quickGroupName,
  quickCreateExpanded,
  quickCreateMessage,
  quickCreateError,
  uploadSubmissionError,
  canCreateGroups,
  canUploadToDestination,
  uploadDisabledReason,
  operationState,
  uploadInputRef,
  onClose,
  onUploadGroupChange,
  onUploadFileChange,
  onQuickGroupNameChange,
  onQuickCreateExpandedChange,
  onQuickCreateSubmit,
  onUploadSubmit,
  onOpenUploadedDocument,
  onAskUploadedDocument,
  onShowUploadedFolder
}: {
  destinations: DocumentUploadDestination[]
  uploadGroupId: string
  uploadDestinationLabel: string
  uploadFile: File | null
  uploadState: DocumentUploadState
  uploadedDocument: DocumentManifest | null
  uploadedDocumentGroupId: string
  quickGroupName: string
  quickCreateExpanded: boolean
  quickCreateMessage: string | null
  quickCreateError: string | null
  uploadSubmissionError: string | null
  canCreateGroups: boolean
  canUploadToDestination: boolean
  uploadDisabledReason: string | null
  operationState: DocumentOperationState
  uploadInputRef: RefObject<HTMLInputElement | null>
  onClose: () => void
  onUploadGroupChange: (groupId: string) => void
  onUploadFileChange: (file: File | null) => void
  onQuickGroupNameChange: (value: string) => void
  onQuickCreateExpandedChange: (expanded: boolean) => void
  onQuickCreateSubmit: (event: FormEvent) => void
  onUploadSubmit: (event: FormEvent) => void
  onOpenUploadedDocument: (document: DocumentManifest) => void
  onAskUploadedDocument?: (document: DocumentManifest) => void
  onShowUploadedFolder: (groupId: string) => void
}) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const quickGroupNameRef = useRef<HTMLInputElement | null>(null)
  const destinationSelectRef = useRef<HTMLSelectElement | null>(null)
  const showQuickCreate = quickCreateExpanded || destinations.length === 0
  const initiallyFocusQuickCreateRef = useRef(showQuickCreate && canCreateGroups)

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const timer = window.setTimeout(() => {
      if (initiallyFocusQuickCreateRef.current) quickGroupNameRef.current?.focus()
      else destinationSelectRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      returnFocus?.focus()
    }
  }, [])

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  function onDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
    )).filter((element) => !element.hidden)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  function expandQuickCreate() {
    onQuickCreateExpandedChange(true)
    window.setTimeout(() => quickGroupNameRef.current?.focus(), 0)
  }

  return (
    <div
      className="document-add-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="document-add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-add-title"
        aria-describedby="document-add-description"
        onKeyDown={onDialogKeyDown}
      >
        <header>
          <div>
            <h3 id="document-add-title">ドキュメントを追加</h3>
            <p id="document-add-description">保存先を用意してから、登録するファイルを選択します。</p>
          </div>
          <button type="button" aria-label="ドキュメント追加を閉じる" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        <ol className="document-add-steps" aria-label="ドキュメント追加の手順">
          <li className={uploadGroupId ? "complete" : "current"}>
            <span className="document-add-step-number" aria-hidden="true">1</span>
            <section aria-labelledby="document-add-destination-title">
              <div className="document-add-step-heading">
                <div>
                  <h4 id="document-add-destination-title">保存先を用意</h4>
                  <p>管理権限のある既存フォルダを選ぶか、新しく作成します。</p>
                </div>
                {uploadGroupId && <span className="document-add-step-status">選択済み</span>}
              </div>

              {destinations.length > 0 && (
                <label className="document-add-field">
                  <span>保存先フォルダ（必須）</span>
                  <select
                    ref={destinationSelectRef}
                    value={uploadGroupId}
                    disabled={operationState.isUploading}
                    onChange={(event) => onUploadGroupChange(event.target.value)}
                  >
                    <option value="">選択してください</option>
                    {destinations.map((destination) => (
                      <option value={destination.groupId} key={destination.groupId}>{destination.label}</option>
                    ))}
                  </select>
                </label>
              )}

              {canCreateGroups && destinations.length > 0 && !showQuickCreate && (
                <button className="document-add-secondary-action" type="button" onClick={expandQuickCreate}>
                  <Icon name="plus" />
                  新しいフォルダを作る
                </button>
              )}

              {showQuickCreate && canCreateGroups && (
                <form className="document-quick-folder-form" onSubmit={onQuickCreateSubmit}>
                  <label className="document-add-field">
                    <span>新しいフォルダ名（必須）</span>
                    <input
                      ref={quickGroupNameRef}
                      value={quickGroupName}
                      disabled={operationState.creatingGroup}
                      aria-describedby="document-quick-folder-help"
                      autoComplete="off"
                      onChange={(event) => onQuickGroupNameChange(event.target.value)}
                    />
                  </label>
                  <p className="field-hint" id="document-quick-folder-help">
                    ルート直下へ非公開で作成します。説明や共有設定はフォルダ設定から後で変更できます。
                  </p>
                  <div className="document-quick-folder-actions">
                    {destinations.length > 0 && (
                      <button type="button" onClick={() => onQuickCreateExpandedChange(false)}>キャンセル</button>
                    )}
                    <button className="ui-button-primary" type="submit" disabled={!quickGroupName.trim() || operationState.creatingGroup}>
                      {operationState.creatingGroup && <LoadingSpinner className="button-spinner" />}
                      フォルダを作成
                    </button>
                  </div>
                </form>
              )}

              {!canCreateGroups && destinations.length === 0 && (
                <p className="document-add-error" role="alert">アップロード可能なフォルダがありません。フォルダ管理者へ作成または管理権限を依頼してください。</p>
              )}
              {quickCreateMessage && <p className="document-add-success" role="status" aria-live="polite">{quickCreateMessage}</p>}
              {quickCreateError && <p className="document-add-error" role="alert">{quickCreateError}</p>}
            </section>
          </li>

          <li className={uploadGroupId ? "current" : "pending"}>
            <span className="document-add-step-number" aria-hidden="true">2</span>
            <section aria-labelledby="document-add-file-title">
              <div className="document-add-step-heading">
                <div>
                  <h4 id="document-add-file-title">ファイルを選択</h4>
                  <p>保存先を確認し、1ファイルずつアップロードします。</p>
                </div>
              </div>
              <form className="document-add-upload-form" onSubmit={onUploadSubmit}>
                <div className={uploadGroupId ? "document-add-destination-summary" : "document-add-destination-summary missing"}>
                  <span>保存先</span>
                  <strong>{uploadDestinationLabel}</strong>
                </div>
                <label className="compact-file-input document-add-file-input">
                  <Icon name="upload" />
                  <span>{uploadFile ? `選択済み: ${uploadFile.name}` : "アップロードするファイルを選択"}</span>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    aria-label="アップロードする文書を選択"
                    disabled={!canUploadToDestination || operationState.isUploading}
                    onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)}
                  />
                </label>
                {uploadDisabledReason && <p className="field-hint">{uploadDisabledReason}</p>}
                {uploadSubmissionError && <p className="document-add-error" role="alert">アップロードに失敗しました: {uploadSubmissionError}</p>}
                <button className="document-add-submit ui-button-primary" type="submit" disabled={!canUploadToDestination || !uploadFile || operationState.isUploading}>
                  {operationState.isUploading && <LoadingSpinner className="button-spinner" />}
                  アップロード
                </button>
              </form>
              {uploadState && (
                <UploadProgressPanel
                  uploadState={uploadState}
                  destinationLabel={uploadState.groupId ? destinations.find((destination) => destination.groupId === uploadState.groupId)?.name ?? uploadState.groupId : "未選択"}
                  uploadedDocument={uploadedDocument}
                  uploadedDocumentGroupId={uploadedDocumentGroupId}
                  onOpenUploadedDocument={onOpenUploadedDocument}
                  onAskUploadedDocument={onAskUploadedDocument}
                  onShowUploadedFolder={onShowUploadedFolder}
                />
              )}
            </section>
          </li>
        </ol>
      </section>
    </div>
  )
}
