import { type FormEvent, useMemo, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type { CreateDocumentGroupInput, DocumentOperationState, DocumentUploadState } from "../hooks/useDocuments.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { DocumentConfirmDialog } from "./workspace/DocumentConfirmDialog.js"
import { DocumentDetailDrawer } from "./workspace/DocumentDetailDrawer.js"
import { DocumentDetailPanel } from "./workspace/DocumentDetailPanel.js"
import { DocumentFilePanel } from "./workspace/DocumentFilePanel.js"
import { DocumentFolderTree } from "./workspace/DocumentFolderTree.js"
import {
  buildShareDiff,
  compareDocuments,
  countDocumentsForGroup,
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
  const [selectedFolderId, setSelectedFolderId] = useState("all")
  const [folderSearch, setFolderSearch] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [documentQuery, setDocumentQuery] = useState("")
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all")
  const [documentStatusFilter, setDocumentStatusFilter] = useState("all")
  const [documentGroupFilter, setDocumentGroupFilter] = useState("all")
  const [documentSort, setDocumentSort] = useState<DocumentSortKey>("updatedDesc")
  const [selectedDocument, setSelectedDocument] = useState<DocumentManifest | null>(null)
  const [copiedDocumentId, setCopiedDocumentId] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)

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
  const latestDocuments = [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 3)
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canUploadToDestination) return
    await onUpload(uploadFile)
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
    if (!shareTargetGroupId || !canWrite || shareHasValidationError) return
    await onShareGroup(shareTargetGroupId, { visibility: shareDraft.groups.length > 0 ? "shared" : "private", sharedGroups: shareDraft.groups })
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
    if (action.kind === "delete") await onDelete(action.document.documentId)
    if (action.kind === "stage") await onStageReindex(action.document.documentId)
    if (action.kind === "cutover") await onCutoverReindex(action.migration.migrationId)
    if (action.kind === "rollback") await onRollbackReindex(action.migration.migrationId)
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
          uploadInputRef={uploadInputRef}
          shareSelectRef={shareSelectRef}
          onDocumentQueryChange={setDocumentQuery}
          onDocumentTypeFilterChange={setDocumentTypeFilter}
          onDocumentStatusFilterChange={setDocumentStatusFilter}
          onDocumentGroupFilterChange={setDocumentGroupFilter}
          onDocumentSortChange={setDocumentSort}
          onSelectDocument={setSelectedDocument}
          onConfirmAction={setConfirmAction}
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
          latestDocuments={latestDocuments}
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
          onClose={() => setSelectedDocument(null)}
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
