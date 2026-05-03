import { useState } from "react"
import { deleteDocument, listDocuments, uploadDocument } from "../api/documentsApi.js"
import type { DocumentManifest } from "../types.js"
import { fileToBase64 } from "../../../shared/utils/fileToBase64.js"

export function useDocuments({
  modelId,
  embeddingModelId,
  canWriteDocuments,
  setLoading,
  setError
}: {
  modelId: string
  embeddingModelId: string
  canWriteDocuments: boolean
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [documents, setDocuments] = useState<DocumentManifest[]>([])
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
    await uploadDocument({
      fileName: uploadFile.name,
      contentBase64: await fileToBase64(uploadFile),
      mimeType: uploadFile.type || undefined,
      memoryModelId: modelId,
      embeddingModelId
    })
    await refreshDocuments()
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

  return {
    documents,
    selectedDocumentId,
    file,
    setFile,
    setSelectedDocumentId,
    refreshDocuments,
    ingestDocument,
    onDelete,
    onUploadDocumentFile
  }
}
