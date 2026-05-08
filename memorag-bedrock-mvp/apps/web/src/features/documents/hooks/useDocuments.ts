import { useState } from "react"
import { createDocumentGroup, cutoverReindexMigration, deleteDocument, listDocumentGroups, listDocuments, listReindexMigrations, rollbackReindexMigration, shareDocumentGroup, stageReindexMigration, uploadDocumentFile } from "../api/documentsApi.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"

export function useDocuments({
  modelId,
  embeddingModelId,
  canWriteDocuments,
  canReindexDocuments,
  setLoading,
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
          : undefined
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

  async function onDelete(documentId?: string) {
    if (!documentId) return
    const document = documents.find((item) => item.documentId === documentId)
    const label = document?.fileName ?? documentId
    if (!window.confirm(`「${label}」を削除します。元資料、manifest、検索ベクトルが削除されます。`)) return

    setLoading(true)
    setError(null)
    try {
      await deleteDocument(documentId)
      setSelectedDocumentId("all")
      await refreshDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onUploadDocumentFile(uploadFile: File) {
    if (!canWriteDocuments) return
    setLoading(true)
    setError(null)
    try {
      await ingestDocument(uploadFile, { groupId: uploadGroupId || undefined })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onCreateDocumentGroup(input: { name: string; visibility: "private" | "shared" | "org" }) {
    if (!canWriteDocuments) return
    setLoading(true)
    setError(null)
    try {
      await createDocumentGroup(input)
      await refreshDocumentGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onShareDocumentGroup(groupId: string, input: { visibility?: "private" | "shared" | "org"; sharedGroups?: string[]; sharedUserIds?: string[] }) {
    if (!canWriteDocuments) return
    setLoading(true)
    setError(null)
    try {
      await shareDocumentGroup(groupId, input)
      await refreshDocumentGroups()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onStageReindex(documentId: string) {
    if (!canReindexDocuments) return
    setLoading(true)
    setError(null)
    try {
      await stageReindexMigration(documentId)
      await Promise.all([refreshDocuments(), refreshReindexMigrations()])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onCutoverReindex(migrationId: string) {
    if (!canReindexDocuments) return
    setLoading(true)
    setError(null)
    try {
      await cutoverReindexMigration(migrationId)
      await Promise.all([refreshDocuments(), refreshReindexMigrations()])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onRollbackReindex(migrationId: string) {
    if (!canReindexDocuments) return
    setLoading(true)
    setError(null)
    try {
      await rollbackReindexMigration(migrationId)
      await Promise.all([refreshDocuments(), refreshReindexMigrations()])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
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
