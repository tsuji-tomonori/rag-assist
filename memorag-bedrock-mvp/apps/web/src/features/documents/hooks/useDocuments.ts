import { useState } from "react"
import { cutoverReindexMigration, deleteDocument, listDocuments, listReindexMigrations, rollbackReindexMigration, stageReindexMigration, uploadDocumentFile } from "../api/documentsApi.js"
import type { DocumentManifest, ReindexMigration } from "../types.js"

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
  const [reindexMigrations, setReindexMigrations] = useState<ReindexMigration[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState("all")
  const [file, setFile] = useState<File | null>(null)

  async function refreshDocuments() {
    const nextDocuments = await listDocuments()
    setDocuments(nextDocuments)
    setSelectedDocumentId((current) =>
      current !== "all" && !nextDocuments.some((document) => document.documentId === current) ? "all" : current
    )
  }

  async function ingestDocument(uploadFile: File) {
    await uploadDocumentFile({
      file: uploadFile,
      memoryModelId: modelId,
      embeddingModelId
    })
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
      await ingestDocument(uploadFile)
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
    reindexMigrations,
    selectedDocumentId,
    file,
    setFile,
    setSelectedDocumentId,
    refreshDocuments,
    refreshReindexMigrations,
    ingestDocument,
    onDelete,
    onUploadDocumentFile,
    onStageReindex,
    onCutoverReindex,
    onRollbackReindex
  }
}
