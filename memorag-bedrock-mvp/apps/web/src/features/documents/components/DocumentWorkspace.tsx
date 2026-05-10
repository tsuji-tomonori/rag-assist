import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type { CreateDocumentGroupInput, DocumentOperationState, DocumentUploadState } from "../hooks/useDocuments.js"
import { documentRouteKey, type DocumentRouteChangeOptions, type DocumentRouteState } from "../routeState.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { DocumentConfirmDialog } from "./workspace/DocumentConfirmDialog.js"
import { DocumentDetailDrawer } from "./workspace/DocumentDetailDrawer.js"
import { DocumentDetailPanel } from "./workspace/DocumentDetailPanel.js"
import { DocumentFilePanel } from "./workspace/DocumentFilePanel.js"
import { DocumentFolderTree } from "./workspace/DocumentFolderTree.js"
import {
  buildShareDiff,
  buildOperationEvents,
  compareDocuments,
  countDocumentsForGroup,
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
  initialRouteState = {},
  onRouteStateChange,
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
  initialRouteState?: DocumentRouteState
  onRouteStateChange?: (state: DocumentRouteState, options?: DocumentRouteChangeOptions) => void
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
  const [selectedFolderId, setSelectedFolderId] = useState(initialRouteState.groupId ?? "all")
  const [folderSearch, setFolderSearch] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [documentQuery, setDocumentQuery] = useState(initialRouteState.query ?? "")
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all")
  const [documentStatusFilter, setDocumentStatusFilter] = useState(initialRouteState.status ?? "all")
  const [documentGroupFilter, setDocumentGroupFilter] = useState("all")
  const [documentSort, setDocumentSort] = useState<DocumentSortKey>("updatedDesc")
  const [selectedDocument, setSelectedDocument] = useState<DocumentManifest | null>(null)
  const [copiedDocumentId, setCopiedDocumentId] = useState<string | null>(null)
  const [sessionOperationEvents, setSessionOperationEvents] = useState<DocumentOperationEvent[]>([])
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)
  const operationEventSeqRef = useRef(0)
  const initialRouteStateKey = documentRouteKey(initialRouteState)

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
  const visibleChunkCount = visibleDocuments.reduce((sum, document) => sum + document.chunkCount, 0)
  const recentOperationEvents = useMemo(
    () => buildOperationEvents({ documents, documentGroups, migrations, uploadState, sessionOperationEvents }),
    [documents, documentGroups, migrations, uploadState, sessionOperationEvents]
  )
  const selectedSharedEntries = selectedFolder.group ? sharedEntries(selectedFolder.group) : []
  const shareTargetGroupId = shareGroupId || selectedGroupId
  const shareTargetGroup = documentGroups.find((group) => group.groupId === shareTargetGroupId)
  const shareDraft = parseSharedGroups(shareGroups)
  const shareDiff = buildShareDiff(shareTargetGroup?.sharedGroups ?? [], shareDraft.groups)
  const shareHasDuplicate = shareDraft.duplicates.length > 0
  const shareHasEmptyToken = shareDraft.hasEmptyToken
  const shareHasValidationError = shareHasDuplicate || shareHasEmptyToken
  const createSharedDraft = parseListInput(groupSharedGroups)
  const createManagerDraft = parseListInput(groupManagerUserIds)
  const validatesCreateSharedGroups = groupVisibility === "shared"
  const createHasValidationError =
    (validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken || createSharedDraft.duplicates.length > 0)) ||
    createManagerDraft.hasEmptyToken ||
    createManagerDraft.duplicates.length > 0
  const createParentGroup = documentGroups.find((group) => group.groupId === groupParentId)
  const createVisibilityLabel = visibilityLabelValue(groupVisibility)

  useEffect(() => {
    setSelectedFolderId(initialRouteState.groupId ?? "all")
    setDocumentQuery(initialRouteState.query ?? "")
    setDocumentStatusFilter(initialRouteState.status ?? "all")
    if (initialRouteState.groupId && documentGroups.some((group) => group.groupId === initialRouteState.groupId)) {
      onUploadGroupChange(initialRouteState.groupId)
    } else if (!initialRouteState.groupId) {
      onUploadGroupChange("")
    }
    if (initialRouteState.documentId) {
      setSelectedDocument(documents.find((document) => document.documentId === initialRouteState.documentId) ?? null)
    } else {
      setSelectedDocument(null)
    }
  }, [initialRouteStateKey, documents, documentGroups, initialRouteState.groupId, initialRouteState.documentId, initialRouteState.query, initialRouteState.status, onUploadGroupChange])

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

  function routeStateWithFilters(next: DocumentRouteState = {}): DocumentRouteState {
    return {
      ...next,
      ...(documentQuery.trim() ? { query: documentQuery.trim() } : {}),
      ...(documentStatusFilter !== "all" ? { status: documentStatusFilter } : {})
    }
  }

  function updateRouteState(next: DocumentRouteState, options?: DocumentRouteChangeOptions) {
    onRouteStateChange?.(routeStateWithFilters(next), options)
  }

  function updateRouteFilters(nextQuery: string, nextStatus: string) {
    const base: DocumentRouteState = selectedDocument
      ? { documentId: selectedDocument.documentId }
      : initialRouteState.migrationId
        ? { migrationId: initialRouteState.migrationId }
        : selectedGroupId
          ? { groupId: selectedGroupId }
          : {}
    onRouteStateChange?.({
      ...base,
      ...(nextQuery.trim() ? { query: nextQuery.trim() } : {}),
      ...(nextStatus !== "all" ? { status: nextStatus } : {})
    }, { replace: true })
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
      updateRouteState({ groupId: createdGroup.groupId })
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

  function selectFolder(folderId: string, groupId: string) {
    setSelectedFolderId(folderId)
    onUploadGroupChange(groupId)
    updateRouteState(groupId ? { groupId } : {})
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
          visibleDocuments={visibleDocuments}
          folderDocumentsCount={folderDocuments.length}
          documentQuery={documentQuery}
          documentTypeFilter={documentTypeFilter}
          documentStatusFilter={documentStatusFilter}
          documentGroupFilter={documentGroupFilter}
          documentSort={documentSort}
          documentTypeOptions={documentTypeOptions}
          documentStatusOptions={documentStatusOptions}
          selectedDocument={selectedDocument}
          operationState={operationState}
          canWrite={canWrite}
          canDelete={canDelete}
          canReindex={canReindex}
          canUploadToDestination={canUploadToDestination}
          migrations={migrations}
          selectedMigrationId={initialRouteState.migrationId}
          uploadInputRef={uploadInputRef}
          shareSelectRef={shareSelectRef}
          onDocumentQueryChange={(value) => {
            setDocumentQuery(value)
            updateRouteFilters(value, documentStatusFilter)
          }}
          onDocumentTypeFilterChange={setDocumentTypeFilter}
          onDocumentStatusFilterChange={(value) => {
            setDocumentStatusFilter(value)
            updateRouteFilters(documentQuery, value)
          }}
          onDocumentGroupFilterChange={setDocumentGroupFilter}
          onDocumentSortChange={setDocumentSort}
          onSelectDocument={(document) => {
            setSelectedDocument(document)
            updateRouteState({ documentId: document.documentId })
          }}
          onConfirmAction={(action) => {
            if (action.kind === "cutover" || action.kind === "rollback") updateRouteState({ migrationId: action.migration.migrationId })
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
          visibleDocuments={visibleDocuments}
          visibleChunkCount={visibleChunkCount}
          uploadGroupId={uploadGroupId}
          uploadFile={uploadFile}
          uploadDestinationLabel={uploadDestinationLabel}
          uploadState={uploadState}
          recentOperationEvents={recentOperationEvents}
          groupName={groupName}
          groupDescription={groupDescription}
          groupParentId={groupParentId}
          groupVisibility={groupVisibility}
          groupSharedGroups={groupSharedGroups}
          groupManagerUserIds={groupManagerUserIds}
          moveToCreatedGroup={moveToCreatedGroup}
          createSharedDraft={createSharedDraft}
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
          onUploadFileChange={setUploadFile}
          onGroupNameChange={setGroupName}
          onGroupDescriptionChange={setGroupDescription}
          onGroupParentIdChange={setGroupParentId}
          onGroupVisibilityChange={setGroupVisibility}
          onGroupSharedGroupsChange={setGroupSharedGroups}
          onGroupManagerUserIdsChange={setGroupManagerUserIds}
          onMoveToCreatedGroupChange={setMoveToCreatedGroup}
          onShareGroupIdChange={setShareGroupId}
          onShareGroupsChange={setShareGroups}
          onUploadGroupChange={onUploadGroupChange}
          onUploadSubmit={(event) => void onSubmit(event)}
          onCreateGroupSubmit={(event) => void onCreateGroupSubmit(event)}
          onShareSubmit={(event) => void onShareSubmit(event)}
        />
      </div>
      {confirmAction && (
        <DocumentConfirmDialog
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
          onClose={() => {
            setSelectedDocument(null)
            updateRouteState(selectedGroupId ? { groupId: selectedGroupId } : {})
          }}
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
