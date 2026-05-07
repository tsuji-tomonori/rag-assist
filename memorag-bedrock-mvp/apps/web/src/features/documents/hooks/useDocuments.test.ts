import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { cutoverReindexMigration, deleteDocument, listDocuments, listReindexMigrations, rollbackReindexMigration, stageReindexMigration, uploadDocumentFile } from "../api/documentsApi.js"
import { useDocuments } from "./useDocuments.js"

vi.mock("../api/documentsApi.js", () => ({
  cutoverReindexMigration: vi.fn(),
  deleteDocument: vi.fn(),
  listDocuments: vi.fn(),
  listReindexMigrations: vi.fn(),
  rollbackReindexMigration: vi.fn(),
  stageReindexMigration: vi.fn(),
  uploadDocumentFile: vi.fn()
}))

function createProps(overrides: Partial<Parameters<typeof useDocuments>[0]> = {}): Parameters<typeof useDocuments>[0] {
  return {
    modelId: "model",
    embeddingModelId: "embedding",
    canWriteDocuments: true,
    canReindexDocuments: true,
    setLoading: vi.fn(),
    setError: vi.fn(),
    ...overrides
  }
}

describe("useDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listDocuments).mockResolvedValue([{ documentId: "doc-1", fileName: "a.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }])
    vi.mocked(listReindexMigrations).mockResolvedValue([])
    vi.mocked(uploadDocumentFile).mockResolvedValue({ documentId: "doc-2", fileName: "b.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" })
    vi.mocked(deleteDocument).mockResolvedValue(undefined)
    vi.mocked(stageReindexMigration).mockResolvedValue({
      migrationId: "migration-1",
      sourceDocumentId: "doc-1",
      stagedDocumentId: "doc-1-staged",
      status: "staged",
      createdBy: "user-1",
      createdAt: "now",
      updatedAt: "now",
      previousManifestObjectKey: "manifests/doc-1.json",
      stagedManifestObjectKey: "manifests/doc-1-staged.json"
    })
    vi.mocked(cutoverReindexMigration).mockResolvedValue({
      migrationId: "migration-1",
      sourceDocumentId: "doc-1",
      stagedDocumentId: "doc-1-staged",
      status: "cutover",
      createdBy: "user-1",
      createdAt: "now",
      updatedAt: "now",
      previousManifestObjectKey: "manifests/doc-1.json",
      stagedManifestObjectKey: "manifests/doc-1-staged.json"
    })
    vi.mocked(rollbackReindexMigration).mockResolvedValue({
      migrationId: "migration-1",
      sourceDocumentId: "doc-1",
      stagedDocumentId: "doc-1-staged",
      status: "rolled_back",
      createdBy: "user-1",
      createdAt: "now",
      updatedAt: "now",
      previousManifestObjectKey: "manifests/doc-1.json",
      stagedManifestObjectKey: "manifests/doc-1-staged.json"
    })
  })

  it("再インデックス操作後に文書と migration を再取得する", async () => {
    const props = createProps()
    const { result } = renderHook(() => useDocuments(props))

    await act(() => result.current.onStageReindex("doc-1"))
    await act(() => result.current.onCutoverReindex("migration-1"))
    await act(() => result.current.onRollbackReindex("migration-1"))

    expect(stageReindexMigration).toHaveBeenCalledWith("doc-1")
    expect(cutoverReindexMigration).toHaveBeenCalledWith("migration-1")
    expect(rollbackReindexMigration).toHaveBeenCalledWith("migration-1")
    expect(listDocuments).toHaveBeenCalledTimes(3)
    expect(listReindexMigrations).toHaveBeenCalledTimes(3)
    expect(props.setError).toHaveBeenCalledWith(null)
  })

  it("権限がない場合は再インデックス API を呼ばない", async () => {
    const { result } = renderHook(() => useDocuments(createProps({ canReindexDocuments: false })))

    await act(() => result.current.onStageReindex("doc-1"))

    expect(stageReindexMigration).not.toHaveBeenCalled()
  })

  it("再インデックス失敗時はエラーを設定する", async () => {
    const props = createProps()
    vi.mocked(stageReindexMigration).mockRejectedValueOnce(new Error("stage failed"))
    const { result } = renderHook(() => useDocuments(props))

    await act(() => result.current.onStageReindex("doc-1"))

    expect(props.setError).toHaveBeenCalledWith("stage failed")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("文書一覧更新時に消えた選択中文書を all に戻す", async () => {
    const { result } = renderHook(() => useDocuments(createProps()))

    act(() => result.current.setSelectedDocumentId("missing-doc"))
    await act(() => result.current.refreshDocuments())

    expect(result.current.selectedDocumentId).toBe("all")
  })

  it("アップロード権限と削除確認に応じて API 呼び出しを分岐する", async () => {
    const props = createProps()
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "b.txt", { type: "" })

    await act(() => result.current.onUploadDocumentFile(file))
    expect(uploadDocumentFile).toHaveBeenCalledWith(expect.objectContaining({
      file,
      memoryModelId: "model",
      embeddingModelId: "embedding"
    }))

    const readonly = renderHook(() => useDocuments(createProps({ canWriteDocuments: false })))
    await act(() => readonly.result.current.onUploadDocumentFile(file))
    expect(uploadDocumentFile).toHaveBeenCalledTimes(1)

    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true)
    await act(() => result.current.onDelete(undefined))
    await act(() => result.current.onDelete("doc-1"))
    await act(() => result.current.onDelete("missing-doc"))

    expect(deleteDocument).toHaveBeenCalledWith("missing-doc")
    expect(result.current.selectedDocumentId).toBe("all")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("削除、cutover、rollback の失敗時は文字列エラーも設定する", async () => {
    const props = createProps()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.mocked(deleteDocument).mockRejectedValueOnce("delete failed")
    vi.mocked(cutoverReindexMigration).mockRejectedValueOnce("cutover failed")
    vi.mocked(rollbackReindexMigration).mockRejectedValueOnce("rollback failed")
    const { result } = renderHook(() => useDocuments(props))

    await act(() => result.current.onDelete("doc-1"))
    await act(() => result.current.onCutoverReindex("migration-1"))
    await act(() => result.current.onRollbackReindex("migration-1"))

    expect(props.setError).toHaveBeenCalledWith("delete failed")
    expect(props.setError).toHaveBeenCalledWith("cutover failed")
    expect(props.setError).toHaveBeenCalledWith("rollback failed")
  })
})
