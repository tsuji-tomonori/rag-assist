import { useState } from "react"
import { createDocumentGroup, cutoverReindexMigration, deleteDocument, getDocumentShare, getFolderSharePolicy, listDocumentGroups, listDocuments, listReindexMigrations, moveDocument, moveDocumentGroup, replaceFolderSharePolicy, requestDocumentExtractedTextDownload, rollbackReindexMigration, saveDocumentExtractedTextDownload, stageReindexMigration, updateDocumentGroup, updateDocumentShare, uploadDocumentFile } from "../api/documentsApi.js"
import type { DocumentShareGrantInput, DocumentShareInfo, DocumentUploadProgress, FolderPolicyEntry, MoveDocumentGroupInput, UpdateDocumentGroupInput, VersionedFolderPolicy } from "../api/documentsApi.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"

export type DocumentOperationState = {
  isUploading: boolean
  creatingGroup: boolean
  sharingGroupId: string | null
  movingGroupId?: string | null
  sharingDocumentId?: string | null
  movingDocumentId?: string | null
  downloadingDocumentId?: string | null
  deletingDocumentId: string | null
  stagingReindexDocumentId: string | null
  cutoverMigrationId: string | null
  rollbackMigrationId: string | null
}

export type DocumentUploadState = {
  fileName: string
  groupId?: string
  phase: DocumentUploadProgress["phase"] | "failed"
  runId?: string
  updatedAt?: string
  errorKind?: "fileType" | "extraction" | "timeout" | "permission" | "network" | "unknown"
  errorMessage?: string
} | null

export type DocumentOperationResult =
  | { ok: true }
  | { ok: false; error: string }

export type DocumentUploadResult =
  | { ok: true; document: DocumentManifest }
  | { ok: false; error: string }

export type CreateDocumentGroupInput = {
  name: string
  description?: string
  parentGroupId?: string
}

export function useDocuments({
  modelId,
  embeddingModelId,
  canWriteDocuments,
  canCreateDocumentGroups,
  canShareDocumentGroups,
  canMoveDocumentGroups,
  canDeleteDocuments,
  canReindexDocuments,
  setError
}: {
  modelId: string
  embeddingModelId: string
  canWriteDocuments: boolean
  canCreateDocumentGroups: boolean
  canShareDocumentGroups: boolean
  canMoveDocumentGroups: boolean
  canDeleteDocuments: boolean
  canReindexDocuments: boolean
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [documents, setDocuments] = useState<DocumentManifest[]>([])
  const [documentGroups, setDocumentGroups] = useState<DocumentGroup[]>([])
  const [reindexMigrations, setReindexMigrations] = useState<ReindexMigration[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState("all")
  const [selectedGroupId, setSelectedGroupId] = useState("all")
  const [uploadGroupId, setUploadGroupId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [operationState, setOperationState] = useState<DocumentOperationState>({
    isUploading: false,
    creatingGroup: false,
    sharingGroupId: null,
    movingGroupId: null,
    sharingDocumentId: null,
    movingDocumentId: null,
    downloadingDocumentId: null,
    deletingDocumentId: null,
    stagingReindexDocumentId: null,
    cutoverMigrationId: null,
    rollbackMigrationId: null
  })
  const [uploadState, setUploadState] = useState<DocumentUploadState>(null)

  function updateOperationState(next: Partial<DocumentOperationState>) {
    setOperationState((current) => ({ ...current, ...next }))
  }

  async function refreshDocuments() {
    const nextDocuments = await listDocuments()
    setDocuments(nextDocuments)
    setSelectedDocumentId((current) =>
      current !== "all" && !nextDocuments.some((document) => document.documentId === current) ? "all" : current
    )
  }

  async function refreshDocumentGroups() {
    const groups = await listDocumentGroups()
    setDocumentGroups(groups)
    setSelectedGroupId((current) => current !== "all" && !groups.some((group) => group.groupId === current) ? "all" : current)
    setUploadGroupId((current) => current && !groups.some((group) => group.groupId === current) ? "" : current)
  }

  async function ingestDocument(uploadFile: File, options: {
    purpose?: "document" | "chatAttachment"
    groupId?: string
    temporaryScopeId?: string
  } = {}): Promise<DocumentManifest> {
    const document = await uploadDocumentFile({
      file: uploadFile,
      memoryModelId: modelId,
      embeddingModelId,
      purpose: options.purpose,
      scope: options.purpose === "chatAttachment"
        ? { scopeType: "chat", temporaryScopeId: options.temporaryScopeId }
        : options.groupId
          ? { scopeType: "group", groupIds: [options.groupId] }
          : undefined,
      onProgress: (progress) => {
        if (options.purpose !== "chatAttachment") {
          setUploadState({ fileName: uploadFile.name, groupId: options.groupId, phase: progress.phase, runId: progress.runId, updatedAt: new Date().toISOString() })
        }
      }
    })
    if (options.purpose === "chatAttachment") {
      setSelectedDocumentId("all")
      return document
    }
    await refreshDocuments()
    return document
  }

  async function refreshReindexMigrations() {
    setReindexMigrations(await listReindexMigrations())
  }

  function operationError(err: unknown): DocumentOperationResult {
    const error = err instanceof Error ? err.message : String(err)
    setError(error)
    return { ok: false, error }
  }

  async function onDelete(
    documentId?: string,
    input?: { expectedUpdatedAt: string; reason: string }
  ): Promise<DocumentOperationResult> {
    if (!documentId) return { ok: false, error: "削除対象の documentId が未指定です" }
    if (!canDeleteDocuments) return { ok: false, error: "文書を削除する権限がありません" }
    if (!input?.expectedUpdatedAt || !input.reason.trim()) return { ok: false, error: "文書 version と削除理由が必要です" }

    updateOperationState({ deletingDocumentId: documentId })
    setError(null)
    try {
      await deleteDocument(documentId, { ...input, reason: input.reason.trim() })
      setSelectedDocumentId("all")
      await refreshDocuments()
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ deletingDocumentId: null })
    }
  }

  async function onDownloadExtractedText(documentId?: string): Promise<DocumentOperationResult> {
    if (!documentId) return { ok: false, error: "ダウンロード対象の documentId が未指定です" }
    updateOperationState({ downloadingDocumentId: documentId })
    setError(null)
    try {
      saveDocumentExtractedTextDownload(await requestDocumentExtractedTextDownload(documentId))
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ downloadingDocumentId: null })
    }
  }

  async function onUploadDocumentFile(uploadFile: File): Promise<DocumentUploadResult> {
    if (!canWriteDocuments) return { ok: false, error: "文書をアップロードする権限がありません" }
    if (!uploadGroupId) return { ok: false, error: "アップロード先フォルダが未指定です" }
    updateOperationState({ isUploading: true })
    setUploadState({ fileName: uploadFile.name, groupId: uploadGroupId, phase: "preparing", updatedAt: new Date().toISOString() })
    setError(null)
    try {
      const document = await ingestDocument(uploadFile, { groupId: uploadGroupId })
      setUploadState((current) => current && current.fileName === uploadFile.name ? { ...current, phase: "complete", updatedAt: new Date().toISOString() } : current)
      return { ok: true, document }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setUploadState((current) => current && current.fileName === uploadFile.name ? { ...current, phase: "failed", updatedAt: new Date().toISOString(), errorKind: classifyUploadError(message), errorMessage: message } : current)
      return { ok: false, error: message }
    } finally {
      updateOperationState({ isUploading: false })
    }
  }

  async function onCreateDocumentGroup(input: CreateDocumentGroupInput): Promise<DocumentGroup | undefined> {
    if (!canCreateDocumentGroups) return undefined
    updateOperationState({ creatingGroup: true })
    setError(null)
    try {
      const group = await createDocumentGroup(input)
      try {
        await refreshDocumentGroups()
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
      }
      return group
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return undefined
    } finally {
      updateOperationState({ creatingGroup: false })
    }
  }

  async function onUpdateDocumentGroup(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentOperationResult> {
    if (!canShareDocumentGroups) return { ok: false, error: "フォルダ設定を更新する権限がありません" }
    updateOperationState({ sharingGroupId: groupId })
    setError(null)
    try {
      await updateDocumentGroup(groupId, input)
      await refreshDocumentGroups()
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ sharingGroupId: null })
    }
  }

  async function onShareDocumentGroup(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentOperationResult> {
    return onUpdateDocumentGroup(groupId, input)
  }

  async function onMoveDocumentGroup(groupId: string, input: MoveDocumentGroupInput): Promise<DocumentOperationResult> {
    if (!canMoveDocumentGroups) return { ok: false, error: "フォルダを移動する権限がありません" }
    updateOperationState({ movingGroupId: groupId })
    setError(null)
    try {
      await moveDocumentGroup(groupId, input)
      await Promise.all([refreshDocumentGroups(), refreshDocuments()])
      return { ok: true }
    } catch (err) {
      try {
        await refreshDocumentGroups()
      } catch {
        // Keep the move error as the user-visible cause; a later refresh can retry the read.
      }
      return operationError(err)
    } finally {
      updateOperationState({ movingGroupId: null })
    }
  }

  async function onLoadFolderShare(groupId: string): Promise<VersionedFolderPolicy | undefined> {
    if (!canShareDocumentGroups) return undefined
    try {
      return await getFolderSharePolicy(groupId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return undefined
    }
  }

  async function onReplaceFolderShare(groupId: string, input: {
    expectedVersion: string
    entries: FolderPolicyEntry[]
    reason: string
  }): Promise<DocumentOperationResult> {
    if (!canShareDocumentGroups) return { ok: false, error: "フォルダ共有を更新する権限がありません" }
    updateOperationState({ sharingGroupId: groupId })
    setError(null)
    try {
      await replaceFolderSharePolicy(groupId, input)
      await refreshDocumentGroups()
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ sharingGroupId: null })
    }
  }

  async function onLoadDocumentShare(documentId: string): Promise<DocumentShareInfo | undefined> {
    try {
      return await getDocumentShare(documentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return undefined
    }
  }

  async function onShareDocument(documentId: string, input: {
    grants: DocumentShareGrantInput[]
    expectedVersion: string
    reason: string
  }): Promise<DocumentOperationResult> {
    updateOperationState({ sharingDocumentId: documentId })
    setError(null)
    try {
      await updateDocumentShare(documentId, input)
      await refreshDocuments()
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ sharingDocumentId: null })
    }
  }

  async function onMoveDocument(documentId: string, input: {
    destinationFolderId: string
    newTitle?: string
    reason: string
    expectedUpdatedAt?: string
  }): Promise<DocumentOperationResult> {
    updateOperationState({ movingDocumentId: documentId })
    setError(null)
    try {
      await moveDocument(documentId, input)
      setSelectedDocumentId("all")
      await refreshDocuments()
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ movingDocumentId: null })
    }
  }

  async function onStageReindex(documentId: string): Promise<DocumentOperationResult> {
    if (!canReindexDocuments) return { ok: false, error: "再インデックスを実行する権限がありません" }
    updateOperationState({ stagingReindexDocumentId: documentId })
    setError(null)
    try {
      await stageReindexMigration(documentId)
      await Promise.all([refreshDocuments(), refreshReindexMigrations()])
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ stagingReindexDocumentId: null })
    }
  }

  async function onCutoverReindex(migrationId: string): Promise<DocumentOperationResult> {
    if (!canReindexDocuments) return { ok: false, error: "再インデックスを実行する権限がありません" }
    updateOperationState({ cutoverMigrationId: migrationId })
    setError(null)
    try {
      await cutoverReindexMigration(migrationId)
      await Promise.all([refreshDocuments(), refreshReindexMigrations()])
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ cutoverMigrationId: null })
    }
  }

  async function onRollbackReindex(migrationId: string): Promise<DocumentOperationResult> {
    if (!canReindexDocuments) return { ok: false, error: "再インデックスを実行する権限がありません" }
    updateOperationState({ rollbackMigrationId: migrationId })
    setError(null)
    try {
      await rollbackReindexMigration(migrationId)
      await Promise.all([refreshDocuments(), refreshReindexMigrations()])
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ rollbackMigrationId: null })
    }
  }

  return {
    documents,
    documentGroups,
    reindexMigrations,
    selectedDocumentId,
    selectedGroupId,
    uploadGroupId,
    file,
    operationState,
    uploadState,
    setFile,
    setSelectedDocumentId,
    setSelectedGroupId,
    setUploadGroupId,
    refreshDocuments,
    refreshDocumentGroups,
    refreshReindexMigrations,
    ingestDocument,
    onDelete,
    onDownloadExtractedText,
    onUploadDocumentFile,
    onStageReindex,
    onCutoverReindex,
    onRollbackReindex,
    onCreateDocumentGroup,
    onShareDocumentGroup,
    onMoveDocumentGroup,
    onLoadFolderShare,
    onReplaceFolderShare,
    onLoadDocumentShare,
    onShareDocument,
    onMoveDocument,
    onUpdateDocumentGroup
  }
}

function classifyUploadError(message: string): NonNullable<NonNullable<DocumentUploadState>["errorKind"]> {
  const normalized = message.toLowerCase()
  if (normalized.includes("unsupported") || normalized.includes("mime") || normalized.includes("file type") || normalized.includes("format")) return "fileType"
  if (normalized.includes("extract") || normalized.includes("textract") || normalized.includes("parse")) return "extraction"
  if (normalized.includes("timeout") || normalized.includes("timed out")) return "timeout"
  if (normalized.includes("401") || normalized.includes("403") || normalized.includes("permission") || normalized.includes("unauthorized") || normalized.includes("forbidden")) return "permission"
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("failed to fetch")) return "network"
  return "unknown"
}
