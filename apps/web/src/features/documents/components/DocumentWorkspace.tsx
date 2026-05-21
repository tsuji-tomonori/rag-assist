import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type { DocumentShareGrantInput, DocumentShareInfo, UpdateDocumentGroupInput } from "../api/documentsApi.js"
import type { CreateDocumentGroupInput, DocumentOperationResult, DocumentOperationState, DocumentUploadResult, DocumentUploadState } from "../hooks/useDocuments.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { DocumentConfirmDialog } from "./workspace/DocumentConfirmDialog.js"
import { DocumentDetailDrawer } from "./workspace/DocumentDetailDrawer.js"
import { DocumentFilePanel } from "./workspace/DocumentFilePanel.js"
import { DocumentFolderTree } from "./workspace/DocumentFolderTree.js"
import {
  buildShareDiff,
  buildWorkspaceFolders,
  compareDocuments,
  documentGroupIds,
  documentStatusLabel,
  emptyOperationState,
  fileTypeLabel,
  parseSharedGroups,
  rootFolderParentValue,
  uniqueSorted,
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
  uploadState: _uploadState = null,
  migrations,
  onUploadGroupChange,
  onUpload,
  onCreateGroup: _onCreateGroup,
  onShareGroup,
  onLoadDocumentShare,
  onShareDocument,
  onMoveDocument,
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
  onShareGroup: (groupId: string, input: UpdateDocumentGroupInput) => Promise<DocumentOperationResult | void>
  onLoadDocumentShare?: (documentId: string) => Promise<DocumentShareInfo | undefined>
  onShareDocument?: (documentId: string, input: { grants: DocumentShareGrantInput[]; reason: string }) => Promise<DocumentOperationResult | void>
  onMoveDocument?: (documentId: string, input: { destinationFolderId: string; newTitle?: string; reason: string; expectedUpdatedAt?: string }) => Promise<DocumentOperationResult | void>
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
  const [shareGroupId, setShareGroupId] = useState("")
  const [shareGroups, setShareGroups] = useState("")
  const [shareClearConfirmed, setShareClearConfirmed] = useState(false)
  const [editGroupName, setEditGroupName] = useState("")
  const [editGroupDescription, setEditGroupDescription] = useState("")
  const [editGroupParentId, setEditGroupParentId] = useState(rootFolderParentValue)
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
  const [activeFolderModal, setActiveFolderModal] = useState<"info" | "share" | "rename" | "move" | "upload" | null>(null)
  const [documentShareTarget, setDocumentShareTarget] = useState<DocumentManifest | null>(null)
  const [documentMoveTarget, setDocumentMoveTarget] = useState<DocumentManifest | null>(null)
  const [documentShareInfo, setDocumentShareInfo] = useState<DocumentShareInfo | null>(null)
  const [documentShareDraftGrants, setDocumentShareDraftGrants] = useState<DocumentShareGrantInput[]>([])
  const [documentSharePrincipalType, setDocumentSharePrincipalType] = useState<"user" | "group">("user")
  const [documentSharePrincipalId, setDocumentSharePrincipalId] = useState("")
  const [documentSharePermissionLevel, setDocumentSharePermissionLevel] = useState<"readOnly" | "full">("readOnly")
  const [documentShareReason, setDocumentShareReason] = useState("")
  const [documentMoveDestinationId, setDocumentMoveDestinationId] = useState("")
  const [documentMoveNewTitle, setDocumentMoveNewTitle] = useState("")
  const [documentMoveReason, setDocumentMoveReason] = useState("")
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)

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
  const selectedFolderCanManage = !selectedFolder.group || canManageDocumentGroup(selectedFolder.group)
  const canWriteSelectedFolder = canWrite && selectedFolderCanManage
  const canDeleteSelectedFolder = canDelete && selectedFolderCanManage
  const canReindexSelectedFolder = canReindex && selectedFolderCanManage
  const canUploadToDestination = canWrite && Boolean(uploadGroupId) && Boolean(uploadDestination && canManageDocumentGroup(uploadDestination))
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
  const shareTargetGroupId = shareGroupId || selectedGroupId
  const shareTargetGroup = documentGroups.find((group) => group.groupId === shareTargetGroupId)
  const shareTargetCanManage = Boolean(shareTargetGroup && canManageDocumentGroup(shareTargetGroup))
  const currentShareGroups = shareTargetGroup?.sharedGroups ?? []
  const currentShareGroupsValue = currentShareGroups.join(", ")
  const shareDraft = parseSharedGroups(shareGroups)
  const shareDiff = buildShareDiff(currentShareGroups, shareDraft.groups)
  const shareHasDuplicate = shareDraft.duplicates.length > 0
  const shareHasEmptyToken = shareDraft.hasEmptyToken
  const shareHasValidationError = shareHasDuplicate || shareHasEmptyToken
  const shareHasChanges = shareDiff.added.length > 0 || shareDiff.removed.length > 0
  const shareClearsAllExistingGroups = currentShareGroups.length > 0 && shareDraft.groups.length === 0
  const shareRequiresClearConfirmation = shareClearsAllExistingGroups && shareHasChanges
  const canSubmitShare = canWrite &&
    shareTargetCanManage &&
    Boolean(shareTargetGroupId) &&
    !shareHasValidationError &&
    shareHasChanges &&
    operationState.sharingGroupId === null &&
    (!shareRequiresClearConfirmation || shareClearConfirmed)
  const editTargetGroup = selectedFolder.group
  const editDescendantGroupIds = descendantGroupIds(documentGroups, selectedGroupId)
  const editMoveTargetGroups = documentGroups.filter((group) => group.groupId !== selectedGroupId && !editDescendantGroupIds.has(group.groupId))
  const editParentGroup = editGroupParentId === rootFolderParentValue ? undefined : documentGroups.find((group) => group.groupId === editGroupParentId)
  const editParentCanManage = editGroupParentId === rootFolderParentValue || Boolean(editParentGroup && canManageDocumentGroup(editParentGroup))
  const editParentInvalid = Boolean(
    editTargetGroup &&
    editGroupParentId !== rootFolderParentValue &&
    (!editParentGroup || editGroupParentId === editTargetGroup.groupId || editDescendantGroupIds.has(editGroupParentId))
  )
  const editName = editGroupName.trim()
  const editDescription = editGroupDescription.trim()
  const editCurrentParentId = editTargetGroup?.parentGroupId ?? rootFolderParentValue
  const editHasChanges = Boolean(editTargetGroup) && (
    editName !== editTargetGroup?.name ||
    (editDescription || undefined) !== editTargetGroup?.description ||
    editGroupParentId !== editCurrentParentId
  )
  const editCanSubmit = canWriteSelectedFolder &&
    Boolean(editTargetGroup) &&
    Boolean(editName) &&
    editHasChanges &&
    !editParentInvalid &&
    editParentCanManage &&
    operationState.sharingGroupId === null
  const editDestinationLabel = editGroupParentId === rootFolderParentValue ? "ルート" : editParentGroup?.canonicalPath ?? "選択不可"
  const documentMoveTitle = documentMoveNewTitle.trim() || documentMoveTarget?.fileName || ""
  const documentMoveNameConflict = Boolean(documentMoveTarget && documentMoveDestinationId && documents.some((document) => (
    document.documentId !== documentMoveTarget.documentId &&
    document.fileName === documentMoveTitle &&
    documentGroupIds(document).includes(documentMoveDestinationId)
  )))

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

  useEffect(() => {
    if (!editTargetGroup) {
      setEditGroupName("")
      setEditGroupDescription("")
      setEditGroupParentId(rootFolderParentValue)
      return
    }
    setEditGroupName(editTargetGroup.name)
    setEditGroupDescription(editTargetGroup.description ?? "")
    setEditGroupParentId(editTargetGroup.parentGroupId ?? rootFolderParentValue)
  }, [editTargetGroup, editTargetGroup?.description, editTargetGroup?.groupId, editTargetGroup?.name, editTargetGroup?.parentGroupId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canUploadToDestination) return
    const result = normalizeUploadResult(await onUpload(uploadFile))
    if (result.ok) {
      setLastUploadedDocument(result.document ?? null)
      setUploadFile(null)
    } else {
      setLastUploadedDocument(null)
    }
  }

  function onUploadFileChange(file: File | null) {
    setUploadFile(file)
    if (file) setLastUploadedDocument(null)
  }

  async function onShareSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmitShare) return
    await onShareGroup(shareTargetGroupId, { visibility: shareDraft.groups.length > 0 ? "shared" : "private", sharedGroups: shareDraft.groups })
    setShareClearConfirmed(false)
  }

  function onDocumentConfirmAction(action: ConfirmAction) {
    if ((action.kind === "delete" || action.kind === "stage") && !canManageDocument(action.document, documentGroups)) return
    if (action.kind === "cutover" || action.kind === "rollback") setSelectedMigrationId(action.migration.migrationId)
    setConfirmError(null)
    setConfirmAction(action)
  }

  async function onEditGroupSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editTargetGroup || !editCanSubmit) return
    const input: UpdateDocumentGroupInput = {}
    if (editName !== editTargetGroup.name) input.name = editName
    if ((editDescription || undefined) !== editTargetGroup.description) input.description = editDescription
    if (editGroupParentId !== editCurrentParentId) input.parentGroupId = editGroupParentId === rootFolderParentValue ? null : editGroupParentId
    await onShareGroup(editTargetGroup.groupId, input)
  }

  function updateShareGroups(value: string) {
    setShareGroups(value)
    setShareClearConfirmed(false)
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
    let result: DocumentOperationResult
    if (action.kind === "delete") {
      result = normalizeOperationResult(await onDelete(action.document.documentId))
    } else if (action.kind === "stage") {
      result = normalizeOperationResult(await onStageReindex(action.document.documentId))
    } else if (action.kind === "cutover") {
      result = normalizeOperationResult(await onCutoverReindex(action.migration.migrationId))
    } else {
      result = normalizeOperationResult(await onRollbackReindex(action.migration.migrationId))
    }

    if (result.ok) {
      setConfirmAction(null)
      return
    }
    setConfirmError(result.error)
  }

  function selectFolder(folderId: string, groupId: string) {
    setSelectedFolderId(folderId)
    onUploadGroupChange(groupId)
  }

  async function openDocumentShare(document: DocumentManifest) {
    setDocumentShareTarget(document)
    setDocumentShareReason("")
    setDocumentSharePrincipalId("")
    const info = await onLoadDocumentShare?.(document.documentId) ?? null
    setDocumentShareInfo(info)
    setDocumentShareDraftGrants(info?.directDocumentGrants.map((grant) => ({
      principalType: grant.principalType,
      principalId: grant.principalId,
      permissionLevel: grant.permissionLevel
    })) ?? [])
  }

  function openDocumentMove(document: DocumentManifest) {
    setDocumentMoveTarget(document)
    setDocumentMoveDestinationId("")
    setDocumentMoveNewTitle(document.fileName)
    setDocumentMoveReason("")
  }

  async function onDocumentShareSubmit(event: FormEvent) {
    event.preventDefault()
    if (!documentShareTarget || !onShareDocument) return
    const next = documentSharePrincipalId.trim()
      ? [
          ...documentShareDraftGrants.filter((grant) => !(grant.principalType === documentSharePrincipalType && grant.principalId === documentSharePrincipalId.trim())),
          { principalType: documentSharePrincipalType, principalId: documentSharePrincipalId.trim(), permissionLevel: documentSharePermissionLevel }
        ]
      : documentShareDraftGrants
    const result = normalizeOperationResult(await onShareDocument(documentShareTarget.documentId, { grants: next, reason: documentShareReason }))
    if (result.ok) {
      setDocumentShareTarget(null)
      setDocumentShareInfo(null)
      setDocumentShareDraftGrants([])
    }
  }

  async function onDocumentMoveSubmit(event: FormEvent) {
    event.preventDefault()
    if (!documentMoveTarget || !documentMoveDestinationId || !onMoveDocument) return
    const result = normalizeOperationResult(await onMoveDocument(documentMoveTarget.documentId, {
      destinationFolderId: documentMoveDestinationId,
      ...(documentMoveNewTitle.trim() && documentMoveNewTitle.trim() !== documentMoveTarget.fileName ? { newTitle: documentMoveNewTitle.trim() } : {}),
      reason: documentMoveReason,
      expectedUpdatedAt: documentMoveTarget.updatedAt ?? documentMoveTarget.createdAt
    }))
    if (result.ok) {
      setDocumentMoveTarget(null)
    }
  }

  const selectedDocumentCanManage = selectedDocument ? canManageDocument(selectedDocument, documentGroups) : selectedFolderCanManage

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
          canWrite={canWriteSelectedFolder}
          canDelete={canDeleteSelectedFolder}
          canReindex={canReindexSelectedFolder}
          canDeleteDocument={(document) => canDelete && canDeleteDocument(document, documentGroups)}
          canReindexDocument={(document) => canReindex && canReindexDocument(document, documentGroups)}
          canShareDocument={(document) => canWrite && canShareDocument(document, documentGroups)}
          canMoveDocument={(document) => canWrite && canMoveDocument(document, documentGroups)}
          migrations={migrations}
          selectedMigrationId={selectedMigrationId}
          uploadInputRef={uploadInputRef}
          onOpenFolderInfo={() => setActiveFolderModal("info")}
          onOpenFolderShare={() => setActiveFolderModal("share")}
          onOpenFolderRename={() => setActiveFolderModal("rename")}
          onOpenFolderMove={() => setActiveFolderModal("move")}
          onOpenUpload={() => setActiveFolderModal("upload")}
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
          onConfirmAction={onDocumentConfirmAction}
          onShareDocument={(document) => void openDocumentShare(document)}
          onMoveDocument={openDocumentMove}
        />
      </div>
      {activeFolderModal === "info" && (
        <WorkspaceModal title="フォルダ情報" onClose={() => setActiveFolderModal(null)}>
          <dl className="folder-stats modal-stats">
            <div><dt>パス</dt><dd>{selectedFolder.path}</dd></div>
            <div><dt>管理者</dt><dd>{selectedFolder.group?.adminPrincipalId ?? "未設定"}</dd></div>
            <div><dt>ファイル数</dt><dd>{visibleDocuments.length}</dd></div>
            <div><dt>トークン数</dt><dd>{visibleChunkCount}</dd></div>
            <div><dt>状態</dt><dd>{selectedFolder.group?.status ?? "active"}</dd></div>
          </dl>
        </WorkspaceModal>
      )}
      {activeFolderModal === "share" && (
        <WorkspaceModal title="フォルダ共有" onClose={() => setActiveFolderModal(null)}>
          <form className="compact-form" onSubmit={(event) => void onShareSubmit(event)}>
            <label><span>共有フォルダ</span><select ref={shareSelectRef} value={shareGroupId || selectedGroupId} disabled={!canWrite || operationState.sharingGroupId !== null} onChange={(event) => setShareGroupId(event.target.value)}><option value="">選択してください</option>{documentGroups.map((group) => <option value={group.groupId} key={group.groupId}>{group.name}</option>)}</select></label>
            <label><span>共有 group</span><input value={shareGroups} disabled={!canWrite || operationState.sharingGroupId !== null} onChange={(event) => updateShareGroups(event.target.value)} placeholder="group をカンマ区切りで入力" /></label>
            <div className="share-diff-preview"><span>追加: {shareDiff.added.join(", ") || "なし"}</span><span>削除: {shareDiff.removed.join(", ") || "なし"}</span></div>
            {shareRequiresClearConfirmation && <label className="share-clear-confirm"><input type="checkbox" checked={shareClearConfirmed} onChange={(event) => setShareClearConfirmed(event.target.checked)} /><span>既存共有をすべて削除することを確認しました</span></label>}
            <button type="submit" disabled={!canSubmitShare}>保存</button>
          </form>
        </WorkspaceModal>
      )}
      {(activeFolderModal === "rename" || activeFolderModal === "move") && (
        <WorkspaceModal title={activeFolderModal === "rename" ? "フォルダ名変更" : "フォルダ移動"} onClose={() => setActiveFolderModal(null)}>
          <form className="compact-form" onSubmit={(event) => void onEditGroupSubmit(event)}>
            {activeFolderModal === "rename" && <label><span>フォルダ名</span><input value={editGroupName} disabled={!canWrite || !editTargetGroup} onChange={(event) => setEditGroupName(event.target.value)} /></label>}
            {activeFolderModal === "move" && <label><span>移動先フォルダ</span><select value={editGroupParentId} disabled={!canWrite || !editTargetGroup} onChange={(event) => setEditGroupParentId(event.target.value)}><option value={rootFolderParentValue}>ルート</option>{editMoveTargetGroups.map((group) => <option value={group.groupId} key={group.groupId}>{group.canonicalPath ?? group.name}</option>)}</select></label>}
            <p className="modal-note">移動先: {editDestinationLabel}</p>
            <button type="submit" disabled={!editCanSubmit}>保存</button>
          </form>
        </WorkspaceModal>
      )}
      {activeFolderModal === "upload" && (
        <WorkspaceModal title="アップロード" onClose={() => setActiveFolderModal(null)}>
          <form className="compact-form" onSubmit={(event) => void onSubmit(event)}>
            <label>
              <span>保存先フォルダ</span>
              <select value={uploadGroupId} disabled={!canWrite || operationState.isUploading} onChange={(event) => onUploadGroupChange(event.target.value)}>
                <option value="">選択してください</option>
                {documentGroups.filter(canManageDocumentGroup).map((group) => (
                  <option value={group.groupId} key={group.groupId}>{group.canonicalPath ?? group.name}</option>
                ))}
              </select>
            </label>
            <p className="modal-note">アップロード先: {uploadDestinationLabel}</p>
            <label>
              <span>文書アップロード</span>
              <input ref={uploadInputRef} type="file" onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)} />
            </label>
            <button type="submit" disabled={!uploadFile || !canUploadToDestination || operationState.isUploading}>アップロード</button>
          </form>
        </WorkspaceModal>
      )}
      {documentShareTarget && (
        <WorkspaceModal title="ファイル共有" onClose={() => setDocumentShareTarget(null)}>
          <form className="compact-form" onSubmit={(event) => void onDocumentShareSubmit(event)}>
            <p className="modal-note">ファイル名: {documentShareTarget.fileName}</p>
            <div className="share-diff-preview">
              <span>現在の権限: {documentShareInfo?.currentUserEffectivePermission ?? "確認中"}</span>
              <span>継承: {documentShareInfo?.inheritedFolderGrants.map((grant) => `${grant.folderId} ${grant.permissionLevel}`).join(", ") || "なし"}</span>
            </div>
            <ul className="share-grant-list" aria-label="直接共有">
              {documentShareDraftGrants.length === 0 && <li>直接共有はありません。</li>}
              {documentShareDraftGrants.map((grant) => (
                <li key={`${grant.principalType}:${grant.principalId}`}>
                  <span>直接: {grant.principalType}:{grant.principalId} {grant.permissionLevel}</span>
                  <button
                    type="button"
                    onClick={() => setDocumentShareDraftGrants((current) => current.filter((item) => !(item.principalType === grant.principalType && item.principalId === grant.principalId)))}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
            <label><span>共有先種別</span><select value={documentSharePrincipalType} onChange={(event) => setDocumentSharePrincipalType(event.target.value as "user" | "group")}><option value="user">user</option><option value="group">group</option></select></label>
            <label><span>共有先ID</span><input value={documentSharePrincipalId} onChange={(event) => setDocumentSharePrincipalId(event.target.value)} /></label>
            <label><span>権限</span><select value={documentSharePermissionLevel} onChange={(event) => setDocumentSharePermissionLevel(event.target.value as "readOnly" | "full")}><option value="readOnly">readOnly</option><option value="full">full</option></select></label>
            <label><span>理由</span><textarea value={documentShareReason} onChange={(event) => setDocumentShareReason(event.target.value)} /></label>
            <button type="submit" disabled={!documentShareReason.trim() || operationState.sharingDocumentId === documentShareTarget.documentId}>保存</button>
          </form>
        </WorkspaceModal>
      )}
      {documentMoveTarget && (
        <WorkspaceModal title="ファイル移動" onClose={() => setDocumentMoveTarget(null)}>
          <form className="compact-form" onSubmit={(event) => void onDocumentMoveSubmit(event)}>
            <p className="modal-note">ファイル名: {documentMoveTarget.fileName}</p>
            <label><span>移動先フォルダ</span><select value={documentMoveDestinationId} onChange={(event) => setDocumentMoveDestinationId(event.target.value)}><option value="">選択してください</option>{documentGroups.filter(canManageDocumentGroup).map((group) => <option value={group.groupId} key={group.groupId}>{group.canonicalPath ?? group.name}</option>)}</select></label>
            <label><span>移動後の表示名</span><input value={documentMoveNewTitle} onChange={(event) => setDocumentMoveNewTitle(event.target.value)} /></label>
            <p className="modal-note">直接共有は維持され、継承共有は移動先フォルダの設定に変わります。</p>
            {documentMoveNameConflict && <p className="modal-note" role="alert">移動先に同名ファイルが存在します。別の表示名を入力してください。</p>}
            <label><span>理由</span><textarea value={documentMoveReason} onChange={(event) => setDocumentMoveReason(event.target.value)} /></label>
            <button type="submit" disabled={!documentMoveDestinationId || documentMoveNameConflict || !documentMoveReason.trim() || operationState.movingDocumentId === documentMoveTarget.documentId}>移動</button>
          </form>
        </WorkspaceModal>
      )}
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
            if (selectedDocumentCanManage) setConfirmAction({ kind: "delete", document: selectedDocument })
            setSelectedDocumentId("")
          }}
          onStageReindex={() => {
            setConfirmError(null)
            if (selectedDocumentCanManage) setConfirmAction({ kind: "stage", document: selectedDocument })
            setSelectedDocumentId("")
          }}
          canDelete={canDelete && selectedDocumentCanManage}
          canReindex={canReindex && selectedDocumentCanManage}
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

function WorkspaceModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="document-modal-backdrop" role="presentation">
      <section className="document-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label={`${title}を閉じる`}>×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

function isConfirmActionRunning(action: ConfirmAction | null, operationState: DocumentOperationState): boolean {
  if (!action) return false
  if (action.kind === "delete") return operationState.deletingDocumentId === action.document.documentId
  if (action.kind === "stage") return operationState.stagingReindexDocumentId === action.document.documentId
  if (action.kind === "cutover") return operationState.cutoverMigrationId === action.migration.migrationId
  return operationState.rollbackMigrationId === action.migration.migrationId
}

function descendantGroupIds(groups: DocumentGroup[], rootGroupId: string): Set<string> {
  const result = new Set<string>()
  if (!rootGroupId) return result
  const childrenByParentId = new Map<string, DocumentGroup[]>()
  for (const group of groups) {
    if (!group.parentGroupId) continue
    childrenByParentId.set(group.parentGroupId, [...(childrenByParentId.get(group.parentGroupId) ?? []), group])
  }
  const queue = [...(childrenByParentId.get(rootGroupId) ?? [])]
  while (queue.length > 0) {
    const group = queue.shift()
    if (!group || result.has(group.groupId)) continue
    result.add(group.groupId)
    queue.push(...(childrenByParentId.get(group.groupId) ?? []))
  }
  return result
}

function canManageDocumentGroup(group: DocumentGroup): boolean {
  return group.effectivePermission === undefined || group.effectivePermission === "full"
}

function canManageDocument(document: DocumentManifest, groups: DocumentGroup[]): boolean {
  if (document.currentUserEffectivePermission) return document.currentUserEffectivePermission === "full"
  const groupIds = documentGroupIds(document)
  if (groupIds.length === 0) return true
  return groupIds.every((groupId) => {
    const group = groups.find((candidate) => candidate.groupId === groupId)
    return Boolean(group && canManageDocumentGroup(group))
  })
}

function canShareDocument(document: DocumentManifest, groups: DocumentGroup[]): boolean {
  return document.capabilities?.canShare ?? canManageDocument(document, groups)
}

function canMoveDocument(document: DocumentManifest, groups: DocumentGroup[]): boolean {
  return document.capabilities?.canMove ?? canManageDocument(document, groups)
}

function canDeleteDocument(document: DocumentManifest, groups: DocumentGroup[]): boolean {
  return document.capabilities?.canDelete ?? canManageDocument(document, groups)
}

function canReindexDocument(document: DocumentManifest, groups: DocumentGroup[]): boolean {
  return document.capabilities?.canReindex ?? canManageDocument(document, groups)
}
