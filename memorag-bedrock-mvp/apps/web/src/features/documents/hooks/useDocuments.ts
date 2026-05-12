import { useState } from "react"
import { createDocumentGroup, cutoverReindexMigration, deleteDocument, listDocumentGroups, listDocuments, listReindexMigrations, rollbackReindexMigration, shareDocumentGroup, stageReindexMigration, uploadDocumentFile } from "../api/documentsApi.js"
import type { DocumentUploadProgress } from "../api/documentsApi.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"

export type DocumentOperationState = {
  isUploading: boolean
  creatingGroup: boolean
  sharingGroupId: string | null
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

export type CreateDocumentGroupInput = {
  name: string
  description?: string
  parentGroupId?: string
  visibility: "private" | "shared" | "org"
  sharedGroups?: string[]
  managerUserIds?: string[]
}

export function useDocuments({
  modelId,
  embeddingModelId,
  canWriteDocuments,
  canReindexDocuments,
  setError
}: {
  modelId: string
  embeddingModelId: string
  canWriteDocuments: boolean
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
  } = {}) {
    await uploadDocumentFile({
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
      return
    }
    await refreshDocuments()
  }

  async function refreshReindexMigrations() {
    setReindexMigrations(await listReindexMigrations())
  }

  function operationError(err: unknown): DocumentOperationResult {
    const error = err instanceof Error ? err.message : String(err)
    setError(error)
    return { ok: false, error }
  }

  async function onDelete(documentId?: string): Promise<DocumentOperationResult> {
    if (!documentId) return { ok: false, error: "削除対象の documentId が未指定です" }

    updateOperationState({ deletingDocumentId: documentId })
    setError(null)
    try {
      await deleteDocument(documentId)
      setSelectedDocumentId("all")
      await refreshDocuments()
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ deletingDocumentId: null })
    }
  }

  async function onUploadDocumentFile(uploadFile: File): Promise<DocumentOperationResult> {
    if (!canWriteDocuments) return { ok: false, error: "文書をアップロードする権限がありません" }
    updateOperationState({ isUploading: true })
    setUploadState({ fileName: uploadFile.name, groupId: uploadGroupId || undefined, phase: "preparing", updatedAt: new Date().toISOString() })
    setError(null)
    try {
      await ingestDocument(uploadFile, { groupId: uploadGroupId || undefined })
      setUploadState((current) => current && current.fileName === uploadFile.name ? { ...current, phase: "complete", updatedAt: new Date().toISOString() } : current)
      return { ok: true }
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
    if (!canWriteDocuments) return undefined
    updateOperationState({ creatingGroup: true })
    setError(null)
    try {
      const group = await createDocumentGroup(input)
      await refreshDocumentGroups()
      return group
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return undefined
    } finally {
      updateOperationState({ creatingGroup: false })
    }
  }

  async function onShareDocumentGroup(groupId: string, input: { visibility?: "private" | "shared" | "org"; sharedGroups?: string[]; sharedUserIds?: string[] }): Promise<DocumentOperationResult> {
    if (!canWriteDocuments) return { ok: false, error: "共有設定を更新する権限がありません" }
    updateOperationState({ sharingGroupId: groupId })
    setError(null)
    try {
      await shareDocumentGroup(groupId, input)
      await refreshDocumentGroups()
      return { ok: true }
    } catch (err) {
      return operationError(err)
    } finally {
      updateOperationState({ sharingGroupId: null })
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
    onUploadDocumentFile,
    onStageReindex,
    onCutoverReindex,
    onRollbackReindex,
    onCreateDocumentGroup,
    onShareDocumentGroup
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
