import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import {
  ResourceStateBoundary,
  type UiResourceState
} from "../../../shared/ui/ResourceState.js"
import {
  createContentResourceState,
  hasConfirmedResourceResult,
  isResourcePartAvailable,
  isResourceStateBusy
} from "../../../shared/ui/resourceStateModel.js"
import { documentPermissionLabel, principalTypeLabel } from "../../../shared/ui/displayMetadata.js"
import {
  OperationFeedback,
  confirmedOperation,
  failedOperation,
  feedbackFromOutcome,
  processingOperationFeedback,
  upsertOperationFeedback,
  type OperationFeedbackEntry,
  type OperationStatus
} from "../../../shared/ui/index.js"
import type { DocumentShareGrantInput, DocumentShareInfo, FolderPolicyEntry, MoveDocumentGroupInput, UpdateDocumentGroupInput, VersionedFolderPolicy } from "../api/documentsApi.js"
import type { CreateDocumentGroupInput, DocumentOperationOutcome, DocumentOperationResult, DocumentOperationState, DocumentUploadResult, DocumentUploadState } from "../hooks/useDocuments.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { DocumentConfirmDialog } from "./workspace/DocumentConfirmDialog.js"
import { DocumentAddDialog, type DocumentUploadDestination } from "./workspace/DocumentAddDialog.js"
import { DocumentDetailDrawer } from "./workspace/DocumentDetailDrawer.js"
import { DocumentDetailPanel } from "./workspace/DocumentDetailPanel.js"
import { DocumentFilePanel } from "./workspace/DocumentFilePanel.js"
import { DocumentFolderTree } from "./workspace/DocumentFolderTree.js"
import {
  buildShareDiff,
  buildOperationEvents,
  buildWorkspaceFolders,
  compareDocuments,
  descendantGroupIds,
  type DocumentOperationEvent,
  documentGroupIds,
  documentStatusLabel,
  emptyOperationState,
  fileTypeLabel,
  getCreateFolderDisabledReason,
  parseSharedGroups,
  rootFolderParentValue,
  sharedEntries,
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
  dataState,
  documents,
  documentGroups = [],
  loading,
  canWrite: legacyCanWrite,
  canDelete,
  canCreateGroup: canCreateGroupProp,
  canShareGroup: canShareGroupProp,
  canMoveGroup: canMoveGroupProp,
  canUpload: canUploadProp,
  canCreateGroups: legacyCanCreateGroups,
  canShareGroups: legacyCanShareGroups,
  canReindex,
  uploadGroupId = "",
  operationState = emptyOperationState,
  uploadState = null,
  migrations,
  onRetryLoad,
  onUploadGroupChange,
  onUpload,
  onCreateGroup,
  onShareGroup,
  onMoveGroup,
  onLoadFolderShare,
  onReplaceFolderShare,
  onLoadDocumentShare,
  onShareDocument,
  onMoveDocument,
  onDownloadExtractedText,
  onDelete,
  onStageReindex,
  onCutoverReindex,
  onRollbackReindex,
  onAskDocument,
  onBack,
  urlState,
  onUrlStateChange
}: {
  dataState?: UiResourceState
  documents: DocumentManifest[]
  documentGroups?: DocumentGroup[]
  loading: boolean
  canWrite?: boolean
  canDelete: boolean
  canCreateGroup?: boolean
  canShareGroup?: boolean
  canMoveGroup?: boolean
  canUpload?: boolean
  canCreateGroups?: boolean
  canShareGroups?: boolean
  canReindex: boolean
  uploadGroupId?: string
  operationState?: DocumentOperationState
  uploadState?: DocumentUploadState
  migrations: ReindexMigration[]
  onRetryLoad?: () => void
  onUploadGroupChange: (groupId: string) => void
  onUpload: (file: File) => Promise<DocumentUploadResult | DocumentOperationResult | void>
  onCreateGroup: (input: CreateDocumentGroupInput) => Promise<DocumentGroup | void>
  onShareGroup: (groupId: string, input: UpdateDocumentGroupInput) => Promise<DocumentOperationResult | void>
  onMoveGroup?: (groupId: string, input: MoveDocumentGroupInput) => Promise<DocumentOperationResult | void>
  onLoadFolderShare?: (groupId: string) => Promise<VersionedFolderPolicy | undefined>
  onReplaceFolderShare?: (groupId: string, input: { expectedVersion: string; entries: FolderPolicyEntry[]; reason: string }) => Promise<DocumentOperationResult | void>
  onLoadDocumentShare?: (documentId: string) => Promise<DocumentShareInfo | undefined>
  onShareDocument?: (documentId: string, input: { grants: DocumentShareGrantInput[]; expectedVersion: string; reason: string }) => Promise<DocumentOperationResult | void>
  onMoveDocument?: (documentId: string, input: { destinationFolderId: string; newTitle?: string; reason: string; expectedUpdatedAt?: string }) => Promise<DocumentOperationResult | void>
  onDownloadExtractedText?: (documentId: string) => Promise<DocumentOperationResult | void>
  onDelete: (documentId: string, input: { expectedUpdatedAt: string; reason: string }) => Promise<DocumentOperationResult | void>
  onStageReindex: (documentId: string) => Promise<DocumentOperationResult | void>
  onCutoverReindex: (migrationId: string) => Promise<DocumentOperationResult | void>
  onRollbackReindex: (migrationId: string) => Promise<DocumentOperationResult | void>
  onAskDocument?: (document: DocumentManifest) => void
  onBack: () => void
  urlState?: DocumentWorkspaceUrlState
  onUrlStateChange?: (state: DocumentWorkspaceUrlState) => void
}) {
  const resolvedDataState = dataState ?? createContentResourceState({
    id: "documents",
    label: "文書ワークスペース",
    regionId: "documents-resource-region",
    source: "文書 API"
  })
  const hasCatalogResult = resolvedDataState.parts.length === 0
    ? hasConfirmedResourceResult(resolvedDataState)
    : isResourcePartAvailable(resolvedDataState, "catalog")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [documentAddOpen, setDocumentAddOpen] = useState(false)
  const [quickGroupName, setQuickGroupName] = useState("")
  const [quickCreateExpanded, setQuickCreateExpanded] = useState(false)
  const [quickCreateMessage, setQuickCreateMessage] = useState<string | null>(null)
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null)
  const [uploadSubmissionError, setUploadSubmissionError] = useState<string | null>(null)
  const [quickCreatedDestination, setQuickCreatedDestination] = useState<DocumentUploadDestination | null>(null)
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [groupParentId, setGroupParentId] = useState("")
  const [moveToCreatedGroup, setMoveToCreatedGroup] = useState(true)
  const [shareGroupId, setShareGroupId] = useState("")
  const [shareGroups, setShareGroups] = useState("")
  const [shareClearConfirmed, setShareClearConfirmed] = useState(false)
  const [folderSharePolicy, setFolderSharePolicy] = useState<VersionedFolderPolicy | null>(null)
  const [folderShareLoading, setFolderShareLoading] = useState(false)
  const [folderShareLoadError, setFolderShareLoadError] = useState<string | null>(null)
  const [folderShareReason, setFolderShareReason] = useState("")
  const [editGroupName, setEditGroupName] = useState("")
  const [editGroupDescription, setEditGroupDescription] = useState("")
  const [editGroupParentId, setEditGroupParentId] = useState(rootFolderParentValue)
  const [editGroupMoveReason, setEditGroupMoveReason] = useState("")
  const [folderSettingsOpen, setFolderSettingsOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(urlState?.folderId ?? "all")
  const [folderSearch, setFolderSearch] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
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
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackEntry[]>([])
  const [documentShareTarget, setDocumentShareTarget] = useState<DocumentManifest | null>(null)
  const [documentMoveTarget, setDocumentMoveTarget] = useState<DocumentManifest | null>(null)
  const [documentShareInfo, setDocumentShareInfo] = useState<DocumentShareInfo | null>(null)
  const [documentShareDraftGrants, setDocumentShareDraftGrants] = useState<DocumentShareGrantInput[]>([])
  const [documentShareLoading, setDocumentShareLoading] = useState(false)
  const [documentSharePrincipalType, setDocumentSharePrincipalType] = useState<"user" | "group">("user")
  const [documentSharePrincipalId, setDocumentSharePrincipalId] = useState("")
  const [documentSharePermissionLevel, setDocumentSharePermissionLevel] = useState<"deny" | "readOnly" | "full">("readOnly")
  const [documentShareReason, setDocumentShareReason] = useState("")
  const [documentMoveDestinationId, setDocumentMoveDestinationId] = useState("")
  const [documentMoveNewTitle, setDocumentMoveNewTitle] = useState("")
  const [documentMoveReason, setDocumentMoveReason] = useState("")
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const createGroupNameRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)
  const operationEventSeqRef = useRef(0)
  const folderShareRequestRef = useRef(0)
  const documentShareRequestRef = useRef<string | null>(null)
  const canWrite = canUploadProp ?? legacyCanWrite ?? false
  const canCreateGroups = canCreateGroupProp ?? legacyCanCreateGroups ?? false
  const canShareGroups = canShareGroupProp ?? legacyCanShareGroups ?? false
  const canMoveGroups = canMoveGroupProp ?? false
  const hasWorkspaceManagement = canWrite || canDelete || canCreateGroups || canShareGroups || canMoveGroups || canReindex

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
  const uploadableDocumentGroups = documentGroups.filter(canManageDocumentGroup)
  const uploadDestinations: DocumentUploadDestination[] = uploadableDocumentGroups.map((group) => ({
    groupId: group.groupId,
    name: group.name,
    label: group.canonicalPath || group.name
  }))
  const authoritativeQuickCreatedGroup = quickCreatedDestination
    ? documentGroups.find((group) => group.groupId === quickCreatedDestination.groupId)
    : undefined
  const hasPendingQuickCreatedDestination = Boolean(quickCreatedDestination && !authoritativeQuickCreatedGroup)
  if (quickCreatedDestination && hasPendingQuickCreatedDestination) {
    uploadDestinations.push(quickCreatedDestination)
  }
  const uploadDestination = uploadGroupId ? documentGroups.find((group) => group.groupId === uploadGroupId) : undefined
  const isQuickCreatedUploadDestination = Boolean(
    quickCreatedDestination && hasPendingQuickCreatedDestination && uploadGroupId === quickCreatedDestination.groupId
  )
  const uploadDestinationLabel = uploadDestination?.name ?? (isQuickCreatedUploadDestination ? quickCreatedDestination?.name : undefined) ?? "未選択"
  const selectedFolderCanManage = !selectedFolder.group || canManageDocumentGroup(selectedFolder.group)
  const canWriteSelectedFolder = canWrite && selectedFolderCanManage
  const canDeleteSelectedFolder = canDelete && selectedFolderCanManage
  const canReindexSelectedFolder = canReindex && selectedFolderCanManage
  const canUploadToDestination = canWrite && Boolean(uploadGroupId) && Boolean(
    (uploadDestination && canManageDocumentGroup(uploadDestination)) || isQuickCreatedUploadDestination
  )
  const uploadDisabledReason = getUploadDisabledReason({
    canUpload: canWrite,
    uploadGroupId,
    hasUploadDestination: Boolean(uploadDestination || isQuickCreatedUploadDestination),
    canUploadToDestination,
    isUploading: operationState.isUploading
  })
  const documentAddUploadGroupId = canUploadToDestination ? uploadGroupId : ""
  const documentAddUploadDestinationLabel = documentAddUploadGroupId ? uploadDestinationLabel : "未選択"
  const documentAddUploadDisabledReason = getUploadDisabledReason({
    canUpload: canWrite,
    uploadGroupId: documentAddUploadGroupId,
    hasUploadDestination: Boolean(documentAddUploadGroupId),
    canUploadToDestination,
    isUploading: operationState.isUploading
  })
  const canOpenDocumentAdd = canWrite && !operationState.isUploading && (canCreateGroups || uploadDestinations.length > 0)
  const addDocumentDisabledReason = getAddDocumentDisabledReason({
    canUpload: canWrite,
    canCreateGroups,
    uploadDestinationCount: uploadDestinations.length,
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
  const visibleChunkCount = visibleDocuments.reduce((sum, document) => sum + (document.chunkCount ?? 0), 0)
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
  const shareTargetGroupId = shareGroupId || selectedGroupId
  const shareTargetGroup = documentGroups.find((group) => group.groupId === shareTargetGroupId)
  const shareTargetCanManage = Boolean(shareTargetGroup && canManageDocumentGroup(shareTargetGroup))
  const folderShareBaseEntries: FolderPolicyEntry[] = folderSharePolicy?.policy?.entries ?? (
    folderSharePolicy && shareTargetGroup?.adminPrincipalType && shareTargetGroup.adminPrincipalId
      ? [{
          principalType: shareTargetGroup.adminPrincipalType,
          principalId: shareTargetGroup.adminPrincipalId,
          permissionLevel: "full"
        }]
      : []
  )
  const selectedSharedEntries = folderSharePolicy
    ? folderShareBaseEntries.map((entry) => ({
        kind: `${principalTypeLabel(entry.principalType)} / ${documentPermissionLabel(entry.permissionLevel)}`,
        value: entry.principalId
      }))
    : selectedFolder.group ? sharedEntries(selectedFolder.group) : []
  const currentShareGroups = folderShareBaseEntries
    .filter((entry) => entry.principalType === "group" && entry.permissionLevel === "readOnly")
    .map((entry) => entry.principalId)
  const currentShareGroupsValue = currentShareGroups.join(", ")
  const shareDraft = parseSharedGroups(shareGroups)
  const shareGroupOptions = uniqueSorted([...currentShareGroups, ...shareDraft.groups])
  const shareDiff = buildShareDiff(currentShareGroups, shareDraft.groups)
  const shareHasDuplicate = shareDraft.duplicates.length > 0
  const shareHasEmptyToken = shareDraft.hasEmptyToken
  const shareHasValidationError = shareHasDuplicate || shareHasEmptyToken
  const shareHasChanges = folderSharePolicy?.policy === null || shareDiff.added.length > 0 || shareDiff.removed.length > 0
  const shareClearsAllExistingGroups = currentShareGroups.length > 0 && shareDraft.groups.length === 0
  const shareRequiresClearConfirmation = shareClearsAllExistingGroups && shareHasChanges
  const nextFolderShareEntries = [
    ...folderShareBaseEntries.filter((entry) => entry.principalType !== "group" || entry.permissionLevel !== "readOnly"),
    ...shareDraft.groups.map((principalId): FolderPolicyEntry => ({ principalType: "group", principalId, permissionLevel: "readOnly" }))
  ]
  const canSubmitShare = canShareGroups &&
    Boolean(onReplaceFolderShare) &&
    shareTargetCanManage &&
    Boolean(shareTargetGroupId) &&
    Boolean(folderSharePolicy) &&
    Boolean(folderShareReason.trim()) &&
    !folderShareLoading &&
    !shareHasValidationError &&
    shareHasChanges &&
    operationState.sharingGroupId === null &&
    (!shareRequiresClearConfirmation || shareClearConfirmed)
  const createParentGroup = documentGroups.find((group) => group.groupId === groupParentId)
  const createParentCanManage = groupParentId ? Boolean(createParentGroup && canManageDocumentGroup(createParentGroup)) : true
  const createGroupDisabledReason = getCreateFolderDisabledReason({
    canCreateGroup: canCreateGroups,
    groupParentId,
    createParentGroup,
    createParentCanManage,
    hasName: Boolean(groupName.trim()),
    hasValidationError: false,
    creatingGroup: operationState.creatingGroup
  })
  const canCreateGroup = createGroupDisabledReason === null
  const editTargetGroup = selectedFolder.group
  const editName = editGroupName.trim()
  const editDescription = editGroupDescription.trim()
  const editNameChanged = Boolean(editTargetGroup) && editName !== editTargetGroup?.name
  const editDescriptionChanged = Boolean(editTargetGroup) && (editDescription || undefined) !== editTargetGroup?.description
  const currentEditParentId = editTargetGroup?.parentGroupId ?? rootFolderParentValue
  const editParentChanged = Boolean(editTargetGroup) && editGroupParentId !== currentEditParentId
  const editPathHasChanges = editNameChanged || editParentChanged
  const editHasChanges = editPathHasChanges || editDescriptionChanged
  const editDescendants = editTargetGroup
    ? descendantGroupIds(documentGroups, editTargetGroup.groupId)
    : new Set<string>()
  const editMoveTargetGroups = documentGroups.filter((group) => (
    group.groupId !== editTargetGroup?.groupId && !editDescendants.has(group.groupId)
  ))
  const editDestinationGroup = editGroupParentId === rootFolderParentValue
    ? undefined
    : documentGroups.find((group) => group.groupId === editGroupParentId)
  const editDestinationLabel = editGroupParentId === rootFolderParentValue
    ? "ルート"
    : editDestinationGroup?.canonicalPath ?? editDestinationGroup?.name ?? "未選択"
  const editParentInvalid = editGroupParentId !== rootFolderParentValue && (
    !editDestinationGroup || !canManageDocumentGroup(editDestinationGroup)
  )
  const editVersionAvailable = Boolean(editTargetGroup?.updatedAt)
  const editCanSubmit = Boolean(editTargetGroup) &&
    Boolean(editTargetGroup && canManageDocumentGroup(editTargetGroup)) &&
    Boolean(editName) &&
    editHasChanges &&
    (!editDescriptionChanged || canShareGroups) &&
    (!editPathHasChanges || (
      canMoveGroups &&
      Boolean(onMoveGroup) &&
      Boolean(editGroupMoveReason.trim()) &&
      editVersionAvailable &&
      !editParentInvalid
    )) &&
    operationState.sharingGroupId === null &&
    (operationState.movingGroupId ?? null) === null
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
      setEditGroupMoveReason("")
      return
    }
    setEditGroupName(editTargetGroup.name)
    setEditGroupDescription(editTargetGroup.description ?? "")
    setEditGroupParentId(editTargetGroup.parentGroupId ?? rootFolderParentValue)
    setEditGroupMoveReason("")
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
    setUploadSubmissionError(null)
    const fileName = uploadFile.name
    const destination = uploadDestinationLabel
    const result = normalizeUploadResult(await onUpload(uploadFile))
    if (result.ok) {
      setLastUploadedDocument(result.document ?? null)
      recordSessionOperation("アップロード", fileName, `保存先: ${destination}`, "反映済み")
      setUploadFile(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ""
    } else {
      setLastUploadedDocument(null)
      setUploadSubmissionError(result.error)
      recordSessionOperation("アップロード", fileName, `保存先: ${destination} / error: ${result.error}`, "失敗")
    }
  }

  function onUploadFileChange(file: File | null) {
    setUploadFile(file)
    setUploadSubmissionError(null)
    if (file) setLastUploadedDocument(null)
  }

  function openUploadedDocument(document: DocumentManifest) {
    setDocumentAddOpen(false)
    setSelectedDocumentId(document.documentId)
    setSelectedMigrationId("")
  }

  function showUploadedFolder(groupId: string) {
    setDocumentAddOpen(false)
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
      ...(groupParentId ? { parentGroupId: groupParentId } : {})
    }
    const createdGroup = await onCreateGroup(input)
    recordSessionOperation("フォルダ作成", name, "非公開 / 共有は作成後に設定", createdGroup?.groupId ? "反映済み" : "失敗")
    if (createdGroup?.groupId && moveToCreatedGroup) {
      setSelectedFolderId(createdGroup.groupId)
      onUploadGroupChange(createdGroup.groupId)
    }
    if (createdGroup?.groupId) setFolderSettingsOpen(false)
    setGroupName("")
    setGroupDescription("")
    setGroupParentId("")
  }

  async function loadFolderShare(groupId: string) {
    const requestId = folderShareRequestRef.current + 1
    folderShareRequestRef.current = requestId
    setFolderSharePolicy(null)
    setFolderShareLoadError(null)
    setFolderShareReason("")
    setShareGroups("")
    setShareClearConfirmed(false)
    if (!onLoadFolderShare) {
      setFolderShareLoadError("フォルダ共有 policy API を利用できません")
      return
    }
    setFolderShareLoading(true)
    try {
      const policy = await onLoadFolderShare(groupId)
      if (folderShareRequestRef.current !== requestId) return
      if (!policy) {
        setFolderShareLoadError("フォルダ共有 policy を取得できませんでした")
        return
      }
      setFolderSharePolicy(policy)
    } catch (error) {
      if (folderShareRequestRef.current === requestId) {
        setFolderShareLoadError(error instanceof Error ? error.message : String(error))
      }
    } finally {
      if (folderShareRequestRef.current === requestId) setFolderShareLoading(false)
    }
  }

  async function onQuickCreateGroupSubmit(event: FormEvent) {
    event.preventDefault()
    const name = quickGroupName.trim()
    if (!canCreateGroups || !name || operationState.creatingGroup) return
    setQuickCreateMessage(null)
    setQuickCreateError(null)
    const createdGroup = await onCreateGroup({ name })
    if (!createdGroup?.groupId) {
      setQuickCreateError("フォルダを作成できませんでした。入力内容と権限を確認して、もう一度お試しください。")
      recordSessionOperation("フォルダ作成", name, "簡易作成 / ルート直下", "失敗")
      return
    }
    const destination: DocumentUploadDestination = {
      groupId: createdGroup.groupId,
      name: createdGroup.name || name,
      label: createdGroup.canonicalPath || createdGroup.name || name
    }
    setQuickCreatedDestination(destination)
    onUploadGroupChange(createdGroup.groupId)
    setQuickGroupName("")
    setQuickCreateExpanded(false)
    setQuickCreateMessage(`${destination.name}を作成し、保存先に選択しました。次にファイルを選んでください。`)
    recordSessionOperation("フォルダ作成", destination.name, "簡易作成 / ルート直下 / 非公開", "反映済み")
    window.setTimeout(() => uploadInputRef.current?.focus(), 0)
  }

  async function onShareSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmitShare || !folderSharePolicy || !onReplaceFolderShare) return
    const target = shareTargetGroup?.name ?? shareTargetGroupId
    const detail = `resource groups: ${shareDraft.groups.join(", ") || "なし"}`
    const feedbackBase = {
      id: `folder-share-${shareTargetGroupId}`,
      actionLabel: "フォルダ共有更新",
      targetLabel: target,
      targetId: shareTargetGroupId,
      reason: folderShareReason.trim(),
      details: [
        { label: "影響", value: "フォルダ配下の継承共有を変更" },
        { label: "回復条件", value: "新しい policy version を確認して再更新" }
      ],
      showUnavailableEvidence: true
    }
    setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(feedbackBase)))
    const result = normalizeOperationResult(await onReplaceFolderShare(shareTargetGroupId, {
      expectedVersion: folderSharePolicy.version,
      entries: nextFolderShareEntries,
      reason: folderShareReason.trim()
    }))
    setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(feedbackBase, result)))
    if (result.ok) {
      recordSessionOperation("共有更新", target, detail, documentOperationResultLabel(result.status))
      setShareClearConfirmed(false)
      setFolderSettingsOpen(false)
    } else {
      recordSessionOperation("共有更新", target, `${detail} / error: ${result.error}`, documentOperationResultLabel(result.status))
    }
  }

  function onDocumentConfirmAction(action: ConfirmAction) {
    if (action.kind === "delete" && !canDeleteDocument(action.document)) return
    if (action.kind === "stage" && !canReindexDocument(action.document)) return
    if (action.kind === "cutover" || action.kind === "rollback") setSelectedMigrationId(action.migration.migrationId)
    setConfirmError(null)
    if (action.kind === "delete") setDeleteReason("")
    setConfirmAction(action)
  }

  async function onEditGroupSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editTargetGroup || !editCanSubmit) return
    const detail = [
      editNameChanged ? `名前: ${editName}` : undefined,
      editParentChanged ? `移動先: ${editDestinationLabel}` : undefined,
      editDescriptionChanged ? `説明: ${editDescription || "未設定"}` : undefined
    ].filter(Boolean).join(" / ")

    if (editPathHasChanges && onMoveGroup && editTargetGroup.updatedAt) {
      const moveInput: MoveDocumentGroupInput = {
        destinationParentId: editGroupParentId === rootFolderParentValue ? null : editGroupParentId,
        ...(editNameChanged ? { newName: editName } : {}),
        reason: editGroupMoveReason.trim(),
        expectedVersion: editTargetGroup.updatedAt
      }
      const moveResult = normalizeOperationResult(await onMoveGroup(editTargetGroup.groupId, moveInput))
      if (!moveResult.ok) {
        recordSessionOperation("フォルダ移動", editTargetGroup.name, `${detail || "path 更新"} / error: ${moveResult.error}`, "失敗")
        return
      }
    }

    if (editDescriptionChanged) {
      const descriptionResult = normalizeOperationResult(await onShareGroup(editTargetGroup.groupId, {
        description: editDescription
      }))
      if (!descriptionResult.ok) {
        recordSessionOperation("フォルダ更新", editTargetGroup.name, `${detail || "説明更新"} / error: ${descriptionResult.error}`, "失敗")
        return
      }
    }

    recordSessionOperation(editPathHasChanges ? "フォルダ移動" : "フォルダ更新", editTargetGroup.name, detail || "設定変更", "反映済み")
    setFolderSettingsOpen(false)
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
    let targetId: string
    let detail: string
    let reason: string | undefined
    let result: DocumentOperationOutcome
    if (action.kind === "delete") {
      actionLabel = "文書削除"
      target = action.document.fileName
      targetId = action.document.documentId
      detail = `documentId: ${action.document.documentId}`
      if (!deleteReason.trim()) {
        setConfirmError("削除理由を入力してください")
        return
      }
      reason = deleteReason.trim()
      const feedbackBase = documentActionFeedbackBase(actionLabel, target, targetId, reason, "元資料・manifest・検索ベクトルを削除", "再利用には再アップロードが必要")
      setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(feedbackBase)))
      result = normalizeOperationResult(await onDelete(action.document.documentId, {
        expectedUpdatedAt: action.document.updatedAt ?? action.document.createdAt,
        reason: deleteReason.trim()
      }))
    } else if (action.kind === "stage") {
      actionLabel = "reindex stage"
      target = action.document.fileName
      targetId = action.document.documentId
      detail = `documentId: ${action.document.documentId}`
      const feedbackBase = documentActionFeedbackBase(actionLabel, target, targetId, undefined, "staged document を作成", "切替前は現行 document を継続利用")
      setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(feedbackBase)))
      result = normalizeOperationResult(await onStageReindex(action.document.documentId))
    } else if (action.kind === "cutover") {
      actionLabel = "reindex cutover"
      target = action.migration.migrationId
      targetId = action.migration.migrationId
      detail = `${action.migration.sourceDocumentId} → ${action.migration.stagedDocumentId}`
      const feedbackBase = documentActionFeedbackBase(actionLabel, target, targetId, undefined, "検索対象を staged document へ切替", "切替済み状態なら rollback 可能")
      setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(feedbackBase)))
      result = normalizeOperationResult(await onCutoverReindex(action.migration.migrationId))
    } else {
      actionLabel = "reindex rollback"
      target = action.migration.migrationId
      targetId = action.migration.migrationId
      detail = `${action.migration.sourceDocumentId} → ${action.migration.stagedDocumentId}`
      const feedbackBase = documentActionFeedbackBase(actionLabel, target, targetId, undefined, "検索対象を切替前へ戻す", "再切替は状態確認後に実行")
      setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(feedbackBase)))
      result = normalizeOperationResult(await onRollbackReindex(action.migration.migrationId))
    }

    const feedbackBase = action.kind === "delete"
      ? documentActionFeedbackBase(actionLabel, target, targetId, reason, "元資料・manifest・検索ベクトルを削除", "再利用には再アップロードが必要")
      : action.kind === "stage"
        ? documentActionFeedbackBase(actionLabel, target, targetId, undefined, "staged document を作成", "切替前は現行 document を継続利用")
        : action.kind === "cutover"
          ? documentActionFeedbackBase(actionLabel, target, targetId, undefined, "検索対象を staged document へ切替", "切替済み状態なら rollback 可能")
          : documentActionFeedbackBase(actionLabel, target, targetId, undefined, "検索対象を切替前へ戻す", "再切替は状態確認後に実行")
    setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(feedbackBase, result)))

    if (result.ok) {
      recordSessionOperation(actionLabel, target, detail, documentOperationResultLabel(result.status))
      setDeleteReason("")
      setConfirmAction(null)
      return
    }
    setConfirmError(result.message)
    recordSessionOperation(actionLabel, target, `${detail} / error: ${result.error}`, documentOperationResultLabel(result.status))
  }

  function selectFolder(folderId: string, groupId: string) {
    setSelectedFolderId(folderId)
    onUploadGroupChange(groupId)
  }

  function openFolderSettingsModal() {
    setFolderSettingsOpen(true)
    setShareGroupId(selectedGroupId)
    if (selectedGroupId) void loadFolderShare(selectedGroupId)
  }

  function openDocumentAddDialog() {
    setQuickCreateExpanded(uploadDestinations.length === 0)
    setQuickCreateMessage(null)
    setQuickCreateError(null)
    setUploadSubmissionError(null)
    setDocumentAddOpen(true)
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
    if (!documentShareTarget || !onShareDocument || documentShareLoading || !documentShareInfo) return
    const next = documentSharePrincipalId.trim()
      ? [
          ...documentShareDraftGrants.filter((grant) => !(grant.principalType === documentSharePrincipalType && grant.principalId === documentSharePrincipalId.trim())),
          { principalType: documentSharePrincipalType, principalId: documentSharePrincipalId.trim(), permissionLevel: documentSharePermissionLevel }
        ]
      : documentShareDraftGrants
    const feedbackBase = {
      id: `document-share-${documentShareTarget.documentId}`,
      actionLabel: "文書共有更新",
      targetLabel: documentShareTarget.fileName,
      targetId: documentShareTarget.documentId,
      reason: documentShareReason.trim(),
      details: [
        { label: "影響", value: `${next.length} 件の直接 grant を完全置換` },
        { label: "回復条件", value: "最新 policy version を再取得して再更新" }
      ],
      showUnavailableEvidence: true
    }
    setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(feedbackBase)))
    const result = normalizeOperationResult(await onShareDocument(documentShareTarget.documentId, {
      grants: next,
      expectedVersion: documentShareInfo.version,
      reason: documentShareReason
    }))
    setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(feedbackBase, result)))
    if (result.ok) {
      recordSessionOperation("ファイル共有", documentShareTarget.fileName, `direct grants: ${next.length}`, documentOperationResultLabel(result.status))
      closeDocumentShareModal()
    } else {
      recordSessionOperation("ファイル共有", documentShareTarget.fileName, `error: ${result.error}`, documentOperationResultLabel(result.status))
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

  const selectedDocumentCanRead = selectedDocument?.capabilities?.canRead === true
  const selectedDocumentCanDelete = selectedDocument?.capabilities?.canDelete === true
  const selectedDocumentCanReindex = selectedDocument?.capabilities?.canReindex === true
  const selectedDocumentCanManage = selectedDocumentCanDelete || selectedDocumentCanReindex || selectedDocument?.capabilities?.canShare === true || selectedDocument?.capabilities?.canMove === true

  return (
    <section className="document-workspace" aria-label={hasWorkspaceManagement ? "ドキュメント管理" : "ドキュメント閲覧"}>
      <header className="document-page-header">
        <div>
          <button className="document-back-button" type="button" onClick={onBack} title="前の画面へ戻る" aria-label="前の画面へ戻る">
            <Icon name="chevron" />
          </button>
          <div>
            <h2>{hasWorkspaceManagement ? "ドキュメント管理" : "共有ドキュメント"}</h2>
            <nav aria-label="パンくず">
              <span>ホーム</span>
              <span>/</span>
              <span>ドキュメント</span>
              <span>/</span>
              <strong>{selectedFolder.name}</strong>
            </nav>
          </div>
        </div>
        {loading && !isResourceStateBusy(resolvedDataState) && <LoadingStatus label="ドキュメント一覧を更新中" />}
      </header>

      {operationFeedback.length > 0 && (
        <div className="document-operation-feedback" aria-label="文書操作結果">
          {operationFeedback.slice(0, 3).map((entry) => <OperationFeedback key={entry.id} entry={entry} />)}
        </div>
      )}

      <ResourceStateBoundary state={resolvedDataState} onRetry={onRetryLoad} onBack={onBack}>
      {hasCatalogResult ? (
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
          canMoveGroups={canMoveGroups}
          canReindex={canReindexSelectedFolder}
          canOpenDocumentAdd={canOpenDocumentAdd}
          addDocumentDisabledReason={addDocumentDisabledReason}
          showManagementControls={hasWorkspaceManagement}
          canDeleteDocument={(document) => canDelete && canDeleteDocument(document)}
          canReindexDocument={(document) => canReindex && canReindexDocument(document)}
          canShareDocument={(document) => Boolean(onShareDocument) && canShareDocument(document)}
          canMoveDocument={(document) => Boolean(onMoveDocument) && canMoveDocument(document)}
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
          onOpenFolderSettings={openFolderSettingsModal}
          onOpenDocumentAdd={openDocumentAddDialog}
          onClearFilters={() => {
            setDocumentQuery("")
            setDocumentTypeFilter("all")
            setDocumentStatusFilter("all")
            setDocumentGroupFilter("all")
            setDocumentPage(1)
          }}
        />
      </div>
      ) : (
        <div className="empty-question-panel">文書とフォルダは未取得です。状態メッセージから再試行してください。</div>
      )}
      </ResourceStateBoundary>

      {documentAddOpen && hasWorkspaceManagement && (
        <DocumentAddDialog
          destinations={uploadDestinations}
          uploadGroupId={documentAddUploadGroupId}
          uploadDestinationLabel={documentAddUploadDestinationLabel}
          uploadFile={uploadFile}
          uploadState={uploadState}
          uploadedDocument={lastUploadedDocument}
          uploadedDocumentGroupId={uploadedDocumentGroupId(lastUploadedDocument, uploadState?.groupId, documentAddUploadGroupId)}
          quickGroupName={quickGroupName}
          quickCreateExpanded={quickCreateExpanded}
          quickCreateMessage={quickCreateMessage}
          quickCreateError={quickCreateError}
          uploadSubmissionError={uploadSubmissionError}
          canCreateGroups={canCreateGroups}
          canUploadToDestination={canUploadToDestination}
          uploadDisabledReason={documentAddUploadDisabledReason}
          operationState={operationState}
          uploadInputRef={uploadInputRef}
          onClose={() => setDocumentAddOpen(false)}
          onUploadGroupChange={(groupId) => {
            setQuickCreateMessage(null)
            setQuickCreateError(null)
            setUploadSubmissionError(null)
            onUploadGroupChange(groupId)
          }}
          onUploadFileChange={onUploadFileChange}
          onQuickGroupNameChange={setQuickGroupName}
          onQuickCreateExpandedChange={setQuickCreateExpanded}
          onQuickCreateSubmit={(event) => void onQuickCreateGroupSubmit(event)}
          onUploadSubmit={(event) => void onSubmit(event)}
          onOpenUploadedDocument={openUploadedDocument}
          onAskUploadedDocument={onAskDocument
            ? (document) => {
                setDocumentAddOpen(false)
                onAskDocument(document)
              }
            : undefined}
          onShowUploadedFolder={showUploadedFolder}
        />
      )}

      {folderSettingsOpen && hasWorkspaceManagement && (
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
              moveToCreatedGroup={moveToCreatedGroup}
              createParentGroup={createParentGroup}
              canCreateGroup={canCreateGroup}
              createGroupDisabledReason={createGroupDisabledReason}
              shareGroupId={shareGroupId}
              shareGroups={shareGroups}
              folderSharePolicyVersion={folderSharePolicy?.version}
              folderSharePolicyInitialized={Boolean(folderSharePolicy?.policy)}
              folderShareLoading={folderShareLoading}
              folderShareLoadError={folderShareLoadError}
              folderShareReason={folderShareReason}
              editTargetGroup={editTargetGroup}
              editGroupName={editGroupName}
              editGroupDescription={editGroupDescription}
              editGroupParentId={editGroupParentId}
              editGroupMoveReason={editGroupMoveReason}
              editMoveTargetGroups={editMoveTargetGroups}
              editDestinationLabel={editDestinationLabel}
              editParentInvalid={editParentInvalid}
              editPathHasChanges={editPathHasChanges}
              editDescriptionChanged={editDescriptionChanged}
              editVersionAvailable={editVersionAvailable}
              editHasChanges={editHasChanges}
              editCanSubmit={editCanSubmit}
              canWrite={canWrite}
              canCreateGroups={canCreateGroups}
              canShareGroups={canShareGroups}
              canMoveGroups={canMoveGroups}
              canManageSelectedFolder={selectedFolderCanManage}
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
              onMoveToCreatedGroupChange={setMoveToCreatedGroup}
              onShareGroupIdChange={(groupId) => {
                setShareGroupId(groupId)
                if (groupId) void loadFolderShare(groupId)
                else {
                  folderShareRequestRef.current += 1
                  setFolderSharePolicy(null)
                  setFolderShareLoadError(null)
                  setFolderShareLoading(false)
                }
              }}
              onShareGroupsChange={updateShareGroups}
              onFolderShareReasonChange={setFolderShareReason}
              onShareClearConfirmedChange={setShareClearConfirmed}
              onShareGroupOptionChange={toggleShareGroupOption}
              onEditGroupNameChange={setEditGroupName}
              onEditGroupDescriptionChange={setEditGroupDescription}
              onEditGroupParentIdChange={setEditGroupParentId}
              onEditGroupMoveReasonChange={setEditGroupMoveReason}
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
            {!documentShareLoading && documentShareInfo === null && (
              <p className="modal-note" role="alert">共有設定を取得できませんでした。再度開き直してください。</p>
            )}
            <div className="share-diff-preview">
              <span>現在の権限: {documentShareInfo?.currentUserEffectivePermission ? documentPermissionLabel(documentShareInfo.currentUserEffectivePermission) : "確認中"}</span>
              <span>継承: {documentShareLoading ? "確認中" : documentShareInfo?.inheritedFolderGrants.map((grant) => `${grant.folderId} ${documentPermissionLabel(grant.permissionLevel)}`).join(", ") || "なし"}</span>
            </div>
            <ul className="share-grant-list" aria-label="直接共有">
              {documentShareLoading && <li>直接共有を読み込み中です。</li>}
              {!documentShareLoading && documentShareDraftGrants.length === 0 && <li>直接共有はありません。</li>}
              {documentShareDraftGrants.map((grant) => (
                <li key={`${grant.principalType}:${grant.principalId}`}>
                  <span>直接: {principalTypeLabel(grant.principalType)} {grant.principalId} / {documentPermissionLabel(grant.permissionLevel)}</span>
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
                <option value="user">ユーザー</option>
                <option value="group">グループ</option>
              </select>
            </label>
            <label><span>共有先識別子（管理者向け）</span><input value={documentSharePrincipalId} onChange={(event) => setDocumentSharePrincipalId(event.target.value)} /></label>
            <label>
              <span>権限</span>
              <select value={documentSharePermissionLevel} onChange={(event) => setDocumentSharePermissionLevel(event.target.value as "deny" | "readOnly" | "full")}>
                <option value="deny">権限なし</option>
                <option value="readOnly">閲覧のみ</option>
                <option value="full">管理可能</option>
              </select>
            </label>
            <label><span>理由</span><textarea value={documentShareReason} onChange={(event) => setDocumentShareReason(event.target.value)} /></label>
            <button type="submit" disabled={documentShareLoading || documentShareInfo === null || !documentShareReason.trim() || operationState.sharingDocumentId === documentShareTarget.documentId}>保存</button>
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
          deleteReason={deleteReason}
          onDeleteReasonChange={setDeleteReason}
          onCancel={() => {
            setConfirmError(null)
            setDeleteReason("")
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
          onAskDocument={selectedDocumentCanRead && onAskDocument ? () => onAskDocument(selectedDocument) : undefined}
          onDownload={selectedDocumentCanRead && onDownloadExtractedText ? () => onDownloadExtractedText(selectedDocument.documentId) : undefined}
          isDownloading={operationState.downloadingDocumentId === selectedDocument.documentId}
          onClose={() => setSelectedDocumentId("")}
          onDelete={() => {
            setConfirmError(null)
            setDeleteReason("")
            if (selectedDocumentCanDelete) setConfirmAction({ kind: "delete", document: selectedDocument })
            setSelectedDocumentId("")
          }}
          onStageReindex={() => {
            setConfirmError(null)
            if (selectedDocumentCanReindex) setConfirmAction({ kind: "stage", document: selectedDocument })
            setSelectedDocumentId("")
          }}
          canManage={selectedDocumentCanManage}
          canDelete={canDelete && selectedDocumentCanDelete}
          canReindex={canReindex && selectedDocumentCanReindex}
        />
      )}
    </section>
  )
}

function normalizeOperationResult(result: DocumentOperationResult | void) {
  if (!result) return confirmedOperation()
  if ("status" in result) return result
  return result.ok ? confirmedOperation() : failedOperation(new Error(result.error))
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

function documentActionFeedbackBase(
  actionLabel: string,
  targetLabel: string,
  targetId: string,
  reason: string | undefined,
  impact: string,
  recovery: string
) {
  return {
    id: `document-action-${actionLabel}-${targetId}`,
    actionLabel,
    targetLabel,
    targetId,
    ...(reason ? { reason } : {}),
    details: [
      { label: "影響", value: impact },
      { label: "回復条件", value: recovery }
    ],
    showUnavailableEvidence: true
  }
}

function documentOperationResultLabel(status: Exclude<OperationStatus, "processing">): DocumentOperationEvent["result"] {
  if (status === "success") return "反映済み"
  if (status === "partial") return "一部確認済み"
  if (status === "unknown") return "結果未確認"
  return "失敗"
}

function canManageDocumentGroup(group: DocumentGroup): boolean {
  return group.effectivePermission === "full"
}

function canShareDocument(document: DocumentManifest): boolean {
  return document.capabilities?.canShare === true
}

function canMoveDocument(document: DocumentManifest): boolean {
  return document.capabilities?.canMove === true
}

function canDeleteDocument(document: DocumentManifest): boolean {
  return document.capabilities?.canDelete === true
}

function canReindexDocument(document: DocumentManifest): boolean {
  return document.capabilities?.canReindex === true
}

function getUploadDisabledReason({
  canUpload,
  uploadGroupId,
  hasUploadDestination,
  canUploadToDestination,
  isUploading
}: {
  canUpload: boolean
  uploadGroupId: string
  hasUploadDestination: boolean
  canUploadToDestination: boolean
  isUploading: boolean
}): string | null {
  if (!canUpload) return "文書をアップロードする権限がありません。"
  if (isUploading) return "アップロード中です。"
  if (!uploadGroupId) return "保存先フォルダを選択するとアップロードできます。"
  if (!hasUploadDestination) return "保存先フォルダを選択してください。"
  if (!canUploadToDestination) return "保存先フォルダの管理権限が必要です。"
  return null
}

function getAddDocumentDisabledReason({
  canUpload,
  canCreateGroups,
  uploadDestinationCount,
  isUploading
}: {
  canUpload: boolean
  canCreateGroups: boolean
  uploadDestinationCount: number
  isUploading: boolean
}): string | null {
  if (!canUpload) return "文書をアップロードする権限がありません。"
  if (isUploading) return "アップロード中です。"
  if (!canCreateGroups && uploadDestinationCount === 0) return "アップロード可能なフォルダがありません。フォルダ管理者へ権限を依頼してください。"
  return null
}
