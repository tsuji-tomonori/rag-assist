import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type { DocumentShareGrantInput, DocumentShareInfo, UpdateDocumentGroupInput } from "../api/documentsApi.js"
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
  getCreateFolderDisabledReason,
  parseListInput,
  parseSharedGroups,
  rootFolderParentValue,
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
  canWrite: legacyCanWrite,
  canDelete,
  canCreateGroup: canCreateGroupProp,
  canShareGroup: canShareGroupProp,
  canUpload: canUploadProp,
  canCreateGroups: legacyCanCreateGroups,
  canShareGroups: legacyCanShareGroups,
  canReindex,
  uploadGroupId = "",
  operationState = emptyOperationState,
  uploadState = null,
  migrations,
  onUploadGroupChange,
  onUpload,
  onCreateGroup,
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
  canWrite?: boolean
  canDelete: boolean
  canCreateGroup?: boolean
  canShareGroup?: boolean
  canUpload?: boolean
  canCreateGroups?: boolean
  canShareGroups?: boolean
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
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [groupParentId, setGroupParentId] = useState("")
  const [groupVisibility, setGroupVisibility] = useState<"inherit" | "private" | "shared" | "org">("private")
  const [groupSharedGroups, setGroupSharedGroups] = useState("")
  const [groupManagerUserIds, setGroupManagerUserIds] = useState("")
  const [moveToCreatedGroup, setMoveToCreatedGroup] = useState(true)
  const [shareGroupId, setShareGroupId] = useState("")
  const [shareGroups, setShareGroups] = useState("")
  const [shareClearConfirmed, setShareClearConfirmed] = useState(false)
  const [editGroupName, setEditGroupName] = useState("")
  const [editGroupDescription, setEditGroupDescription] = useState("")
  const [folderSettingsOpen, setFolderSettingsOpen] = useState(false)
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
  const [sessionOperationEvents, setSessionOperationEvents] = useState<DocumentOperationEvent[]>([])
  const [documentShareTarget, setDocumentShareTarget] = useState<DocumentManifest | null>(null)
  const [documentMoveTarget, setDocumentMoveTarget] = useState<DocumentManifest | null>(null)
  const [documentShareInfo, setDocumentShareInfo] = useState<DocumentShareInfo | null>(null)
  const [documentShareDraftGrants, setDocumentShareDraftGrants] = useState<DocumentShareGrantInput[]>([])
  const [documentShareLoading, setDocumentShareLoading] = useState(false)
  const [documentSharePrincipalType, setDocumentSharePrincipalType] = useState<"user" | "group">("user")
  const [documentSharePrincipalId, setDocumentSharePrincipalId] = useState("")
  const [documentSharePermissionLevel, setDocumentSharePermissionLevel] = useState<"readOnly" | "full">("readOnly")
  const [documentShareReason, setDocumentShareReason] = useState("")
  const [documentMoveDestinationId, setDocumentMoveDestinationId] = useState("")
  const [documentMoveNewTitle, setDocumentMoveNewTitle] = useState("")
  const [documentMoveReason, setDocumentMoveReason] = useState("")
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const createGroupNameRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)
  const operationEventSeqRef = useRef(0)
  const documentShareRequestRef = useRef<string | null>(null)
  const canWrite = canUploadProp ?? legacyCanWrite ?? false
  const canCreateGroups = canCreateGroupProp ?? legacyCanCreateGroups ?? false
  const canShareGroups = canShareGroupProp ?? legacyCanShareGroups ?? false

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
  const uploadDisabledReason = getUploadDisabledReason({
    canUpload: canWrite,
    uploadGroupId,
    uploadDestination,
    canUploadToDestination,
    isUploading: operationState.isUploading
  })
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
  const shareTargetCanManage = Boolean(shareTargetGroup && canManageDocumentGroup(shareTargetGroup))
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
  const canSubmitShare = canShareGroups &&
    shareTargetCanManage &&
    Boolean(shareTargetGroupId) &&
    !shareHasValidationError &&
    shareHasChanges &&
    operationState.sharingGroupId === null &&
    (!shareRequiresClearConfirmation || shareClearConfirmed)
  const canSetCreateSharing = canCreateGroups && canShareGroups
  const createSharedDraft = parseListInput(groupSharedGroups)
  const createShareGroupOptions = uniqueSorted([...documentGroups.flatMap((group) => group.sharedGroups), ...createSharedDraft.groups])
  const createManagerDraft = parseListInput(groupManagerUserIds)
  const validatesCreateSharedGroups = canSetCreateSharing && groupVisibility === "shared"
  const validatesCreateManagers = canSetCreateSharing && groupVisibility !== "inherit"
  const createHasValidationError =
    (validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken || createSharedDraft.duplicates.length > 0)) ||
    (validatesCreateManagers && (createManagerDraft.hasEmptyToken || createManagerDraft.duplicates.length > 0))
  const createParentGroup = documentGroups.find((group) => group.groupId === groupParentId)
  const createParentCanManage = groupParentId ? Boolean(createParentGroup && canManageDocumentGroup(createParentGroup)) : true
  const createGroupDisabledReason = getCreateFolderDisabledReason({
    canCreateGroup: canCreateGroups,
    groupParentId,
    createParentGroup,
    createParentCanManage,
    hasName: Boolean(groupName.trim()),
    hasValidationError: createHasValidationError,
    creatingGroup: operationState.creatingGroup
  })
  const canOpenCreateFolderForm = canCreateGroups && !operationState.creatingGroup
  const canCreateGroup = createGroupDisabledReason === null
  const createVisibilityLabel = groupVisibility === "inherit" ? "親フォルダから継承" : visibilityLabelValue(groupVisibility)
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
  const editCanSubmit = canShareGroups &&
    Boolean(editTargetGroup) &&
    Boolean(editTargetGroup && canManageDocumentGroup(editTargetGroup)) &&
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
    if (!canCreateGroup) return
    const input: CreateDocumentGroupInput = {
      name,
      ...(groupDescription.trim() ? { description: groupDescription.trim() } : {}),
      ...(groupParentId ? { parentGroupId: groupParentId } : {}),
      ...(canSetCreateSharing && groupVisibility !== "inherit" ? { visibility: groupVisibility } : {}),
      ...(canSetCreateSharing && groupVisibility === "shared" && createSharedDraft.groups.length > 0 ? { sharedGroups: createSharedDraft.groups } : {}),
      ...(canSetCreateSharing && groupVisibility !== "inherit" && createManagerDraft.groups.length > 0 ? { managerUserIds: createManagerDraft.groups } : {})
    }
    const createdGroup = await onCreateGroup(input)
    recordSessionOperation("フォルダ作成", name, `公開範囲: ${createVisibilityLabel}`, createdGroup?.groupId ? "反映済み" : "失敗")
    if (createdGroup?.groupId && moveToCreatedGroup) {
      setSelectedFolderId(createdGroup.groupId)
      onUploadGroupChange(createdGroup.groupId)
    }
    if (createdGroup?.groupId) setFolderSettingsOpen(false)
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
      setFolderSettingsOpen(false)
    } else {
      recordSessionOperation("共有更新", target, `${detail} / error: ${result.error}`, "失敗")
    }
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
    const detail = [
      input.name !== undefined ? `名前: ${input.name}` : undefined,
      input.description !== undefined ? `説明: ${input.description || "未設定"}` : undefined,
      input.parentGroupId !== undefined ? `移動先: ${editDestinationLabel}` : undefined
    ].filter(Boolean).join(" / ")
    const result = normalizeOperationResult(await onShareGroup(editTargetGroup.groupId, input))
    if (result.ok) {
      recordSessionOperation("フォルダ更新", editTargetGroup.name, detail || "設定変更", "反映済み")
      setFolderSettingsOpen(false)
    } else {
      recordSessionOperation("フォルダ更新", editTargetGroup.name, `${detail || "設定変更"} / error: ${result.error}`, "失敗")
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

  function openCreateFolderModal() {
    setGroupParentId(selectedGroupId)
    setFolderSettingsOpen(true)
    window.setTimeout(() => createGroupNameRef.current?.focus(), 0)
  }

  function openFolderSettingsModal() {
    setFolderSettingsOpen(true)
  }

  function openUploadPicker() {
    setFolderSettingsOpen(true)
  }

  async function openDocumentShare(document: DocumentManifest) {
    const loadedDocumentId = document.documentId
    documentShareRequestRef.current = loadedDocumentId
    setDocumentShareTarget(document)
    setDocumentShareInfo(null)
    setDocumentShareDraftGrants([])
    setDocumentShareReason("")
    setDocumentSharePrincipalId("")
    setDocumentSharePrincipalType("user")
    setDocumentSharePermissionLevel("readOnly")
    setDocumentShareLoading(true)
    const info = await onLoadDocumentShare?.(loadedDocumentId) ?? null
    if (documentShareRequestRef.current !== loadedDocumentId) return
    setDocumentShareInfo(info)
    setDocumentShareDraftGrants(info?.directDocumentGrants.map((grant) => ({
      principalType: grant.principalType,
      principalId: grant.principalId,
      permissionLevel: grant.permissionLevel
    })) ?? [])
    setDocumentShareLoading(false)
  }

  function closeDocumentShareModal() {
    documentShareRequestRef.current = null
    setDocumentShareTarget(null)
    setDocumentShareInfo(null)
    setDocumentShareDraftGrants([])
    setDocumentShareLoading(false)
    setDocumentShareReason("")
    setDocumentSharePrincipalId("")
    setDocumentSharePrincipalType("user")
    setDocumentSharePermissionLevel("readOnly")
  }

  function openDocumentMove(document: DocumentManifest) {
    setDocumentMoveTarget(document)
    setDocumentMoveDestinationId("")
    setDocumentMoveNewTitle(document.fileName)
    setDocumentMoveReason("")
  }

  async function onDocumentShareSubmit(event: FormEvent) {
    event.preventDefault()
    if (!documentShareTarget || !onShareDocument || documentShareLoading) return
    const next = documentSharePrincipalId.trim()
      ? [
          ...documentShareDraftGrants.filter((grant) => !(grant.principalType === documentSharePrincipalType && grant.principalId === documentSharePrincipalId.trim())),
          { principalType: documentSharePrincipalType, principalId: documentSharePrincipalId.trim(), permissionLevel: documentSharePermissionLevel }
        ]
      : documentShareDraftGrants
    const result = normalizeOperationResult(await onShareDocument(documentShareTarget.documentId, { grants: next, reason: documentShareReason }))
    if (result.ok) {
      recordSessionOperation("ファイル共有", documentShareTarget.fileName, `direct grants: ${next.length}`, "反映済み")
      closeDocumentShareModal()
    } else {
      recordSessionOperation("ファイル共有", documentShareTarget.fileName, `error: ${result.error}`, "失敗")
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
      recordSessionOperation("ファイル移動", documentMoveTarget.fileName, `移動先: ${documentMoveDestinationId}`, "反映済み")
      setDocumentMoveTarget(null)
    } else {
      recordSessionOperation("ファイル移動", documentMoveTarget.fileName, `移動先: ${documentMoveDestinationId} / error: ${result.error}`, "失敗")
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
          canCreateGroups={canCreateGroups}
          canShareGroups={canShareGroups}
          canReindex={canReindexSelectedFolder}
          canUploadToDestination={canUploadToDestination}
          uploadDisabledReason={uploadDisabledReason}
          canOpenCreateFolderForm={canOpenCreateFolderForm}
          canDeleteDocument={(document) => canDelete && canDeleteDocument(document, documentGroups)}
          canReindexDocument={(document) => canReindex && canReindexDocument(document, documentGroups)}
          canShareDocument={(document) => Boolean(onShareDocument) && canShareDocument(document, documentGroups)}
          canMoveDocument={(document) => Boolean(onMoveDocument) && canMoveDocument(document, documentGroups)}
          migrations={migrations}
          selectedMigrationId={selectedMigrationId}
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
          onOpenCreateFolder={openCreateFolderModal}
          onOpenFolderSettings={openFolderSettingsModal}
          onOpenUploadPicker={openUploadPicker}
        />
      </div>

      {folderSettingsOpen && (
        <div
          className="document-settings-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFolderSettingsOpen(false)
          }}
        >
          <section className="document-settings-modal" role="dialog" aria-modal="true" aria-labelledby="document-settings-title">
            <header className="document-settings-modal-head">
              <div>
                <h3 id="document-settings-title">フォルダ設定</h3>
                <span>{selectedFolder.path}</span>
              </div>
              <button type="button" aria-label="フォルダ設定を閉じる" onClick={() => setFolderSettingsOpen(false)}>
                <Icon name="close" />
              </button>
            </header>
            <DocumentDetailPanel
              documentGroups={documentGroups}
              selectedFolder={selectedFolder}
              selectedGroupId={selectedGroupId}
              selectedSharedEntries={selectedSharedEntries}
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
              validatesCreateManagers={validatesCreateManagers}
              createHasValidationError={createHasValidationError}
              createParentGroup={createParentGroup}
              canCreateGroup={canCreateGroup}
              createGroupDisabledReason={createGroupDisabledReason}
              createVisibilityLabel={createVisibilityLabel}
              shareGroupId={shareGroupId}
              shareGroups={shareGroups}
              editTargetGroup={editTargetGroup}
              editGroupName={editGroupName}
              editGroupDescription={editGroupDescription}
              editGroupParentId={editGroupParentId}
              editMoveTargetGroups={editMoveTargetGroups}
              editParentInvalid={editParentInvalid}
              editHasChanges={editHasChanges}
              editCanSubmit={editCanSubmit}
              editDestinationLabel={editDestinationLabel}
              canWrite={canWrite}
              canCreateGroups={canCreateGroups}
              canShareGroups={canShareGroups}
              canSubmitShare={canSubmitShare}
              canUploadToDestination={canUploadToDestination}
              uploadDisabledReason={uploadDisabledReason}
              operationState={operationState}
              uploadInputRef={uploadInputRef}
              createGroupNameRef={createGroupNameRef}
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
              onEditGroupNameChange={setEditGroupName}
              onEditGroupDescriptionChange={setEditGroupDescription}
              onEditGroupParentIdChange={setEditGroupParentId}
              onUploadGroupChange={onUploadGroupChange}
              onUploadSubmit={(event) => void onSubmit(event)}
              onOpenUploadedDocument={openUploadedDocument}
              onAskUploadedDocument={onAskDocument}
              onShowUploadedFolder={showUploadedFolder}
              onCreateGroupSubmit={(event) => void onCreateGroupSubmit(event)}
              onShareSubmit={(event) => void onShareSubmit(event)}
              onEditGroupSubmit={(event) => void onEditGroupSubmit(event)}
            />
          </section>
        </div>
      )}
      {documentShareTarget && (
        <WorkspaceModal title="ファイル共有" onClose={closeDocumentShareModal}>
          <form className="compact-form" onSubmit={(event) => void onDocumentShareSubmit(event)}>
            <p className="modal-note">ファイル名: {documentShareTarget.fileName}</p>
            <div className="share-diff-preview">
              <span>現在の権限: {documentShareInfo?.currentUserEffectivePermission ?? "確認中"}</span>
              <span>継承: {documentShareLoading ? "確認中" : documentShareInfo?.inheritedFolderGrants.map((grant) => `${grant.folderId} ${grant.permissionLevel}`).join(", ") || "なし"}</span>
            </div>
            <ul className="share-grant-list" aria-label="直接共有">
              {documentShareLoading && <li>直接共有を読み込み中です。</li>}
              {!documentShareLoading && documentShareDraftGrants.length === 0 && <li>直接共有はありません。</li>}
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
            <label>
              <span>共有先種別</span>
              <select value={documentSharePrincipalType} onChange={(event) => setDocumentSharePrincipalType(event.target.value as "user" | "group")}>
                <option value="user">user</option>
                <option value="group">group</option>
              </select>
            </label>
            <label><span>共有先ID</span><input value={documentSharePrincipalId} onChange={(event) => setDocumentSharePrincipalId(event.target.value)} /></label>
            <label>
              <span>権限</span>
              <select value={documentSharePermissionLevel} onChange={(event) => setDocumentSharePermissionLevel(event.target.value as "readOnly" | "full")}>
                <option value="readOnly">readOnly</option>
                <option value="full">full</option>
              </select>
            </label>
            <label><span>理由</span><textarea value={documentShareReason} onChange={(event) => setDocumentShareReason(event.target.value)} /></label>
            <button type="submit" disabled={documentShareLoading || !documentShareReason.trim() || operationState.sharingDocumentId === documentShareTarget.documentId}>保存</button>
          </form>
        </WorkspaceModal>
      )}
      {documentMoveTarget && (
        <WorkspaceModal title="ファイル移動" onClose={() => setDocumentMoveTarget(null)}>
          <form className="compact-form" onSubmit={(event) => void onDocumentMoveSubmit(event)}>
            <p className="modal-note">ファイル名: {documentMoveTarget.fileName}</p>
            <label>
              <span>移動先フォルダ</span>
              <select value={documentMoveDestinationId} onChange={(event) => setDocumentMoveDestinationId(event.target.value)}>
                <option value="">選択してください</option>
                {documentGroups.filter(canManageDocumentGroup).map((group) => (
                  <option value={group.groupId} key={group.groupId}>{group.canonicalPath ?? group.name}</option>
                ))}
              </select>
            </label>
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

function uploadedDocumentGroupId(document: DocumentManifest | null, uploadStateGroupId: string | undefined, uploadGroupId: string): string {
  return document ? documentGroupIds(document)[0] ?? uploadStateGroupId ?? uploadGroupId : ""
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
  return group.effectivePermission === "full"
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

function getUploadDisabledReason({
  canUpload,
  uploadGroupId,
  uploadDestination,
  canUploadToDestination,
  isUploading
}: {
  canUpload: boolean
  uploadGroupId: string
  uploadDestination?: DocumentGroup
  canUploadToDestination: boolean
  isUploading: boolean
}): string | null {
  if (!canUpload) return "文書をアップロードする権限がありません。"
  if (isUploading) return "アップロード中です。"
  if (!uploadGroupId) return "保存先フォルダを選択するとアップロードできます。"
  if (!uploadDestination) return "保存先フォルダを選択してください。"
  if (!canUploadToDestination) return "保存先フォルダの管理権限が必要です。"
  return null
}
