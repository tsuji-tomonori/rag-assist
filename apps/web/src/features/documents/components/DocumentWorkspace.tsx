import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type { CreateDocumentGroupInput, DocumentOperationResult, DocumentOperationState, DocumentUploadResult, DocumentUploadState } from "../hooks/useDocuments.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { DocumentConfirmDialog } from "./workspace/DocumentConfirmDialog.js"
import { DocumentDetailDrawer } from "./workspace/DocumentDetailDrawer.js"
import { DocumentDetailPanel } from "./workspace/DocumentDetailPanel.js"
import { DocumentFilePanel } from "./workspace/DocumentFilePanel.js"
import { DocumentFolderTree } from "./workspace/DocumentFolderTree.js"
import {
  buildShareDiff,
  buildOperationEvents,
  buildWorkspaceFolders,
  compareDocuments,
  type DocumentOperationEvent,
  documentGroupIds,
  documentStatusLabel,
  emptyOperationState,
  fileTypeLabel,
  parseListInput,
  parseSharedGroups,
  sharedEntries,
  uniqueSorted,
  visibilityLabelValue,
  type ConfirmAction,
  type DocumentSortKey,
  type WorkspaceFolder
} from "./workspace/documentWorkspaceUtils.js"

export type DocumentWorkspaceUrlState = {
  folderId?: string | undefined
  documentId?: string | undefined
  migrationId?: string | undefined
  query?: string | undefined
  type?: string | undefined
  status?: string | undefined
  groupFilter?: string | undefined
  sort?: DocumentSortKey | undefined
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
  onAskDocument,
  onBack,
  urlState,
  onUrlStateChange
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
  onUpload: (file: File) => Promise<DocumentUploadResult | DocumentOperationResult | void>
  onCreateGroup: (input: CreateDocumentGroupInput) => Promise<DocumentGroup | void>
  onShareGroup: (groupId: string, input: { visibility?: "private" | "shared" | "org"; sharedGroups?: string[]; sharedUserIds?: string[] }) => Promise<DocumentOperationResult | void>
  onDelete: (documentId: string) => Promise<DocumentOperationResult | void>
  onStageReindex: (documentId: string) => Promise<DocumentOperationResult | void>
  onCutoverReindex: (migrationId: string) => Promise<DocumentOperationResult | void>
  onRollbackReindex: (migrationId: string) => Promise<DocumentOperationResult | void>
  onAskDocument?: (document: DocumentManifest) => void
  onBack: () => void
  urlState?: DocumentWorkspaceUrlState
  onUrlStateChange?: (state: DocumentWorkspaceUrlState) => void
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
  const [shareClearConfirmed, setShareClearConfirmed] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(urlState?.folderId ?? "all")
  const [folderSearch, setFolderSearch] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [documentQuery, setDocumentQuery] = useState(urlState?.query ?? "")
  const [documentTypeFilter, setDocumentTypeFilter] = useState(urlState?.type ?? "all")
  const [documentStatusFilter, setDocumentStatusFilter] = useState(urlState?.status ?? "all")
  const [documentGroupFilter, setDocumentGroupFilter] = useState(urlState?.groupFilter ?? "all")
  const [documentSort, setDocumentSort] = useState<DocumentSortKey>(urlState?.sort ?? "updatedDesc")
  const [documentPageSize, setDocumentPageSize] = useState(25)
  const [documentPage, setDocumentPage] = useState(1)
  const [selectedDocumentId, setSelectedDocumentId] = useState(urlState?.documentId ?? "")
  const [selectedMigrationId, setSelectedMigrationId] = useState(urlState?.migrationId ?? "")
  const [copiedDocumentId, setCopiedDocumentId] = useState<string | null>(null)
  const [lastUploadedDocument, setLastUploadedDocument] = useState<DocumentManifest | null>(null)
  const [sessionOperationEvents, setSessionOperationEvents] = useState<DocumentOperationEvent[]>([])
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)
  const operationEventSeqRef = useRef(0)

  const folders = useMemo<WorkspaceFolder[]>(() => {
    return buildWorkspaceFolders(documentGroups, documents)
  }, [documentGroups, documents])

  const allDocumentsFolder: WorkspaceFolder = { id: "all", name: "すべてのドキュメント", path: "/ すべてのドキュメント", count: documents.length, depth: 0 }
  const normalizedFolderSearch = folderSearch.trim().toLowerCase()
  const filteredFolders = normalizedFolderSearch
    ? folders.filter((folder) => `${folder.name} ${folder.path}`.toLowerCase().includes(normalizedFolderSearch))
    : folders
  const selectedFolder = selectedFolderId === "all" ? allDocumentsFolder : folders.find((folder) => folder.id === selectedFolderId) ?? allDocumentsFolder
  const selectedGroupId = selectedFolder.group?.groupId ?? ""
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
  const selectedDocument = selectedDocumentId
    ? documents.find((document) => document.documentId === selectedDocumentId) ?? (lastUploadedDocument?.documentId === selectedDocumentId ? lastUploadedDocument : null)
    : null
  const visibleChunkCount = visibleDocuments.reduce((sum, document) => sum + document.chunkCount, 0)
  const documentPageSizeOptions = [25, 50, 100]
  const documentPageCount = Math.max(1, Math.ceil(visibleDocuments.length / documentPageSize))
  const clampedDocumentPage = Math.min(documentPage, documentPageCount)
  const documentPageStartIndex = visibleDocuments.length === 0 ? 0 : (clampedDocumentPage - 1) * documentPageSize
  const documentPageEndIndex = Math.min(documentPageStartIndex + documentPageSize, visibleDocuments.length)
  const pagedDocuments = visibleDocuments.slice(documentPageStartIndex, documentPageEndIndex)
  const recentOperationEvents = useMemo(
    () => buildOperationEvents({ documents, documentGroups, migrations, uploadState, sessionOperationEvents }),
    [documents, documentGroups, migrations, uploadState, sessionOperationEvents]
  )
  const selectedSharedEntries = selectedFolder.group ? sharedEntries(selectedFolder.group) : []
  const shareTargetGroupId = shareGroupId || selectedGroupId
  const shareTargetGroup = documentGroups.find((group) => group.groupId === shareTargetGroupId)
  const currentShareGroups = shareTargetGroup?.sharedGroups ?? []
  const currentShareGroupsValue = currentShareGroups.join(", ")
  const shareDraft = parseSharedGroups(shareGroups)
  const shareGroupOptions = uniqueSorted([...documentGroups.flatMap((group) => group.sharedGroups), ...shareDraft.groups])
  const shareDiff = buildShareDiff(currentShareGroups, shareDraft.groups)
  const shareHasDuplicate = shareDraft.duplicates.length > 0
  const shareHasEmptyToken = shareDraft.hasEmptyToken
  const shareHasValidationError = shareHasDuplicate || shareHasEmptyToken
  const shareHasChanges = shareDiff.added.length > 0 || shareDiff.removed.length > 0
  const shareClearsAllExistingGroups = currentShareGroups.length > 0 && shareDraft.groups.length === 0
  const shareRequiresClearConfirmation = shareClearsAllExistingGroups && shareHasChanges
  const canSubmitShare = canWrite &&
    Boolean(shareTargetGroupId) &&
    !shareHasValidationError &&
    shareHasChanges &&
    operationState.sharingGroupId === null &&
    (!shareRequiresClearConfirmation || shareClearConfirmed)
  const createSharedDraft = parseListInput(groupSharedGroups)
  const createShareGroupOptions = uniqueSorted([...documentGroups.flatMap((group) => group.sharedGroups), ...createSharedDraft.groups])
  const createManagerDraft = parseListInput(groupManagerUserIds)
  const validatesCreateSharedGroups = groupVisibility === "shared"
  const createHasValidationError =
    (validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken || createSharedDraft.duplicates.length > 0)) ||
    createManagerDraft.hasEmptyToken ||
    createManagerDraft.duplicates.length > 0
  const createParentGroup = documentGroups.find((group) => group.groupId === groupParentId)
  const createVisibilityLabel = visibilityLabelValue(groupVisibility)

  useEffect(() => {
    if (!urlState) return
    setSelectedFolderId(urlState.folderId ?? "all")
    setDocumentQuery(urlState.query ?? "")
    setDocumentTypeFilter(urlState.type ?? "all")
    setDocumentStatusFilter(urlState.status ?? "all")
    setDocumentGroupFilter(urlState.groupFilter ?? "all")
    setDocumentSort(urlState.sort ?? "updatedDesc")
    setSelectedDocumentId(urlState.documentId ?? "")
    setSelectedMigrationId(urlState.migrationId ?? "")
  }, [urlState, urlState?.documentId, urlState?.folderId, urlState?.groupFilter, urlState?.migrationId, urlState?.query, urlState?.sort, urlState?.status, urlState?.type])

  useEffect(() => {
    onUrlStateChange?.({
      folderId: selectedFolderId === "all" ? undefined : selectedFolderId,
      documentId: selectedDocumentId || undefined,
      migrationId: selectedMigrationId || undefined,
      query: documentQuery.trim() || undefined,
      type: documentTypeFilter === "all" ? undefined : documentTypeFilter,
      status: documentStatusFilter === "all" ? undefined : documentStatusFilter,
      groupFilter: documentGroupFilter === "all" ? undefined : documentGroupFilter,
      sort: documentSort === "updatedDesc" ? undefined : documentSort
    })
  }, [
    documentGroupFilter,
    documentQuery,
    documentSort,
    documentStatusFilter,
    documentTypeFilter,
    onUrlStateChange,
    selectedDocumentId,
    selectedMigrationId,
    selectedFolderId
  ])

  useEffect(() => {
    setDocumentPage(1)
  }, [documentGroupFilter, documentQuery, documentSort, documentStatusFilter, documentTypeFilter, selectedFolderId])

  useEffect(() => {
    if (documentPage > documentPageCount) setDocumentPage(documentPageCount)
  }, [documentPage, documentPageCount])

  useEffect(() => {
    setShareGroups(currentShareGroupsValue)
    setShareClearConfirmed(false)
  }, [currentShareGroupsValue, shareTargetGroupId])

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
    const result = normalizeUploadResult(await onUpload(uploadFile))
    if (result.ok) {
      setLastUploadedDocument(result.document ?? null)
      recordSessionOperation("アップロード", fileName, `保存先: ${destination}`, "反映済み")
      setUploadFile(null)
    } else {
      setLastUploadedDocument(null)
      recordSessionOperation("アップロード", fileName, `保存先: ${destination} / error: ${result.error}`, "失敗")
    }
  }

  function onUploadFileChange(file: File | null) {
    setUploadFile(file)
    if (file) setLastUploadedDocument(null)
  }

  function openUploadedDocument(document: DocumentManifest) {
    setSelectedDocumentId(document.documentId)
    setSelectedMigrationId("")
  }

  function showUploadedFolder(groupId: string) {
    setSelectedFolderId(groupId)
    setDocumentGroupFilter("all")
    setDocumentPage(1)
    onUploadGroupChange(groupId)
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
    recordSessionOperation("フォルダ作成", name, `公開範囲: ${createVisibilityLabel}`, createdGroup?.groupId ? "反映済み" : "失敗")
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
    if (!canSubmitShare) return
    const target = shareTargetGroup?.name ?? shareTargetGroupId
    const detail = `shared groups: ${shareDraft.groups.join(", ") || "なし"}`
    const result = normalizeOperationResult(await onShareGroup(shareTargetGroupId, { visibility: shareDraft.groups.length > 0 ? "shared" : "private", sharedGroups: shareDraft.groups }))
    if (result.ok) {
      recordSessionOperation("共有更新", target, detail, "反映済み")
      setShareClearConfirmed(false)
    } else {
      recordSessionOperation("共有更新", target, `${detail} / error: ${result.error}`, "失敗")
    }
  }

  function toggleShareGroupOption(groupName: string, checked: boolean) {
    const nextGroups = checked
      ? uniqueSorted([...shareDraft.groups, groupName])
      : shareDraft.groups.filter((group) => group !== groupName)
    setShareGroups(nextGroups.join(", "))
    setShareClearConfirmed(false)
  }

  function updateShareGroups(value: string) {
    setShareGroups(value)
    setShareClearConfirmed(false)
  }

  function toggleCreateShareGroupOption(groupName: string, checked: boolean) {
    const nextGroups = checked
      ? uniqueSorted([...createSharedDraft.groups, groupName])
      : createSharedDraft.groups.filter((group) => group !== groupName)
    setGroupSharedGroups(nextGroups.join(", "))
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
    setConfirmError(null)
    let actionLabel: string
    let target: string
    let detail: string
    let result: DocumentOperationResult
    if (action.kind === "delete") {
      actionLabel = "文書削除"
      target = action.document.fileName
      detail = `documentId: ${action.document.documentId}`
      result = normalizeOperationResult(await onDelete(action.document.documentId))
    } else if (action.kind === "stage") {
      actionLabel = "reindex stage"
      target = action.document.fileName
      detail = `documentId: ${action.document.documentId}`
      result = normalizeOperationResult(await onStageReindex(action.document.documentId))
    } else if (action.kind === "cutover") {
      actionLabel = "reindex cutover"
      target = action.migration.migrationId
      detail = `${action.migration.sourceDocumentId} → ${action.migration.stagedDocumentId}`
      result = normalizeOperationResult(await onCutoverReindex(action.migration.migrationId))
    } else {
      actionLabel = "reindex rollback"
      target = action.migration.migrationId
      detail = `${action.migration.sourceDocumentId} → ${action.migration.stagedDocumentId}`
      result = normalizeOperationResult(await onRollbackReindex(action.migration.migrationId))
    }

    if (result.ok) {
      recordSessionOperation(actionLabel, target, detail, "反映済み")
      setConfirmAction(null)
      return
    }
    setConfirmError(result.error)
    recordSessionOperation(actionLabel, target, `${detail} / error: ${result.error}`, "失敗")
  }

  function selectFolder(folderId: string, groupId: string) {
    setSelectedFolderId(folderId)
    onUploadGroupChange(groupId)
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
        <DocumentFolderTree
          documents={documents}
          documentGroups={documentGroups}
          filteredFolders={filteredFolders}
          selectedFolder={selectedFolder}
          selectedFolderId={selectedFolderId}
          folderSearch={folderSearch}
          onFolderSearchChange={setFolderSearch}
          onSelectFolder={selectFolder}
        />
        <DocumentFilePanel
          documents={documents}
          documentGroups={documentGroups}
          selectedFolder={selectedFolder}
          uploadGroupId={uploadGroupId}
          uploadDestinationLabel={uploadDestinationLabel}
          pagedDocuments={pagedDocuments}
          folderDocumentsCount={folderDocuments.length}
          filteredDocumentsCount={visibleDocuments.length}
          documentQuery={documentQuery}
          documentTypeFilter={documentTypeFilter}
          documentStatusFilter={documentStatusFilter}
          documentGroupFilter={documentGroupFilter}
          documentSort={documentSort}
          documentPage={clampedDocumentPage}
          documentPageCount={documentPageCount}
          documentPageSize={documentPageSize}
          documentPageSizeOptions={documentPageSizeOptions}
          documentPageStart={visibleDocuments.length === 0 ? 0 : documentPageStartIndex + 1}
          documentPageEnd={documentPageEndIndex}
          documentTypeOptions={documentTypeOptions}
          documentStatusOptions={documentStatusOptions}
          selectedDocument={selectedDocument}
          operationState={operationState}
          canWrite={canWrite}
          canDelete={canDelete}
          canReindex={canReindex}
          canUploadToDestination={canUploadToDestination}
          migrations={migrations}
          selectedMigrationId={selectedMigrationId}
          uploadInputRef={uploadInputRef}
          shareSelectRef={shareSelectRef}
          onDocumentQueryChange={setDocumentQuery}
          onDocumentTypeFilterChange={setDocumentTypeFilter}
          onDocumentStatusFilterChange={setDocumentStatusFilter}
          onDocumentGroupFilterChange={setDocumentGroupFilter}
          onDocumentSortChange={setDocumentSort}
          onDocumentPageChange={setDocumentPage}
          onDocumentPageSizeChange={(pageSize) => {
            setDocumentPageSize(pageSize)
            setDocumentPage(1)
          }}
          onSelectDocument={(document) => {
            setSelectedDocumentId(document.documentId)
            setSelectedMigrationId("")
          }}
          onConfirmAction={(action) => {
            if (action.kind === "cutover" || action.kind === "rollback") setSelectedMigrationId(action.migration.migrationId)
            setConfirmError(null)
            setConfirmAction(action)
          }}
        />
        <DocumentDetailPanel
          documentGroups={documentGroups}
          selectedFolder={selectedFolder}
          selectedGroupId={selectedGroupId}
          selectedSharedEntries={selectedSharedEntries}
          shareTargetGroupId={shareTargetGroupId}
          shareHasValidationError={shareHasValidationError}
          shareHasEmptyToken={shareHasEmptyToken}
          shareHasDuplicate={shareHasDuplicate}
          shareDuplicates={shareDraft.duplicates}
          shareDiff={shareDiff}
          shareDraftGroups={shareDraft.groups}
          shareGroupOptions={shareGroupOptions}
          shareHasChanges={shareHasChanges}
          shareRequiresClearConfirmation={shareRequiresClearConfirmation}
          shareClearConfirmed={shareClearConfirmed}
          visibleDocuments={visibleDocuments}
          visibleChunkCount={visibleChunkCount}
          uploadGroupId={uploadGroupId}
          uploadFile={uploadFile}
          uploadDestinationLabel={uploadDestinationLabel}
          uploadState={uploadState}
          uploadedDocument={lastUploadedDocument}
          uploadedDocumentGroupId={uploadedDocumentGroupId(lastUploadedDocument, uploadState?.groupId, uploadGroupId)}
          recentOperationEvents={recentOperationEvents}
          groupName={groupName}
          groupDescription={groupDescription}
          groupParentId={groupParentId}
          groupVisibility={groupVisibility}
          groupSharedGroups={groupSharedGroups}
          groupManagerUserIds={groupManagerUserIds}
          moveToCreatedGroup={moveToCreatedGroup}
          createSharedDraft={createSharedDraft}
          createShareGroupOptions={createShareGroupOptions}
          createManagerDraft={createManagerDraft}
          validatesCreateSharedGroups={validatesCreateSharedGroups}
          createHasValidationError={createHasValidationError}
          createParentGroup={createParentGroup}
          createVisibilityLabel={createVisibilityLabel}
          shareGroupId={shareGroupId}
          shareGroups={shareGroups}
          canWrite={canWrite}
          canUploadToDestination={canUploadToDestination}
          operationState={operationState}
          uploadInputRef={uploadInputRef}
          shareSelectRef={shareSelectRef}
          onUploadFileChange={onUploadFileChange}
          onGroupNameChange={setGroupName}
          onGroupDescriptionChange={setGroupDescription}
          onGroupParentIdChange={setGroupParentId}
          onGroupVisibilityChange={setGroupVisibility}
          onGroupSharedGroupsChange={setGroupSharedGroups}
          onGroupManagerUserIdsChange={setGroupManagerUserIds}
          onMoveToCreatedGroupChange={setMoveToCreatedGroup}
          onShareGroupIdChange={setShareGroupId}
          onShareGroupsChange={updateShareGroups}
          onShareClearConfirmedChange={setShareClearConfirmed}
          onShareGroupOptionChange={toggleShareGroupOption}
          onCreateShareGroupOptionChange={toggleCreateShareGroupOption}
          onUploadGroupChange={onUploadGroupChange}
          onUploadSubmit={(event) => void onSubmit(event)}
          onOpenUploadedDocument={openUploadedDocument}
          onAskUploadedDocument={onAskDocument}
          onShowUploadedFolder={showUploadedFolder}
          onCreateGroupSubmit={(event) => void onCreateGroupSubmit(event)}
          onShareSubmit={(event) => void onShareSubmit(event)}
        />
      </div>
      {confirmAction && (
        <DocumentConfirmDialog
          action={confirmAction}
          documents={documents}
          documentGroups={documentGroups}
          loading={isConfirmActionRunning(confirmAction, operationState)}
          errorMessage={confirmError}
          onCancel={() => {
            setConfirmError(null)
            setConfirmAction(null)
          }}
          onConfirm={runConfirmedAction}
        />
      )}
      {selectedDocument && (
        <DocumentDetailDrawer
          document={selectedDocument}
          documentGroups={documentGroups}
          copied={copiedDocumentId === selectedDocument.documentId}
          onCopyDocumentId={() => void copyDocumentId(selectedDocument.documentId)}
          onAskDocument={() => onAskDocument?.(selectedDocument)}
          onClose={() => setSelectedDocumentId("")}
          onDelete={() => {
            setConfirmError(null)
            setConfirmAction({ kind: "delete", document: selectedDocument })
            setSelectedDocumentId("")
          }}
          onStageReindex={() => {
            setConfirmError(null)
            setConfirmAction({ kind: "stage", document: selectedDocument })
            setSelectedDocumentId("")
          }}
          canDelete={canDelete}
          canReindex={canReindex}
        />
      )}
    </section>
  )
}

function normalizeOperationResult(result: DocumentOperationResult | void): DocumentOperationResult {
  return result ?? { ok: true }
}

function normalizeUploadResult(result: DocumentUploadResult | DocumentOperationResult | void): { ok: true; document?: DocumentManifest } | { ok: false; error: string } {
  return result ?? { ok: true }
}

function uploadedDocumentGroupId(document: DocumentManifest | null, uploadStateGroupId: string | undefined, uploadGroupId: string): string {
  return document ? documentGroupIds(document)[0] ?? uploadStateGroupId ?? uploadGroupId : ""
}

function isConfirmActionRunning(action: ConfirmAction | null, operationState: DocumentOperationState): boolean {
  if (!action) return false
  if (action.kind === "delete") return operationState.deletingDocumentId === action.document.documentId
  if (action.kind === "stage") return operationState.stagingReindexDocumentId === action.document.documentId
  if (action.kind === "cutover") return operationState.cutoverMigrationId === action.migration.migrationId
  return operationState.rollbackMigrationId === action.migration.migrationId
}
