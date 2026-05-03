import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { cutoverReindexMigration, listDocuments, listReindexMigrations, rollbackReindexMigration, stageReindexMigration } from "../api/documentsApi.js"
import { useDocuments } from "./useDocuments.js"

vi.mock("../api/documentsApi.js", () => ({
  cutoverReindexMigration: vi.fn(),
  deleteDocument: vi.fn(),
  listDocuments: vi.fn(),
  listReindexMigrations: vi.fn(),
  rollbackReindexMigration: vi.fn(),
  stageReindexMigration: vi.fn(),
  uploadDocument: vi.fn()
}))

vi.mock("../../../shared/utils/fileToBase64.js", () => ({
  fileToBase64: vi.fn().mockResolvedValue("base64")
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
})
