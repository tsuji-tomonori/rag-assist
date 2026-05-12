import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createDocumentGroup, cutoverReindexMigration, deleteDocument, listDocumentGroups, listDocuments, listReindexMigrations, rollbackReindexMigration, shareDocumentGroup, stageReindexMigration, uploadDocumentFile } from "../api/documentsApi.js"
import { useDocuments } from "./useDocuments.js"

vi.mock("../api/documentsApi.js", () => ({
  createDocumentGroup: vi.fn(),
  cutoverReindexMigration: vi.fn(),
  deleteDocument: vi.fn(),
  listDocumentGroups: vi.fn(),
  listDocuments: vi.fn(),
  listReindexMigrations: vi.fn(),
  rollbackReindexMigration: vi.fn(),
  shareDocumentGroup: vi.fn(),
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
    vi.mocked(listDocumentGroups).mockResolvedValue([{
      groupId: "group-1",
      name: "社内規定",
      visibility: "private",
      ownerUserId: "user-1",
      sharedUserIds: [],
      sharedGroups: [],
      managerUserIds: ["user-1"],
      createdAt: "now",
      updatedAt: "now"
    }])
    vi.mocked(listDocuments).mockResolvedValue([{ documentId: "doc-1", fileName: "a.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }])
    vi.mocked(listReindexMigrations).mockResolvedValue([])
    vi.mocked(uploadDocumentFile).mockResolvedValue({ documentId: "doc-2", fileName: "b.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" })
    vi.mocked(createDocumentGroup).mockResolvedValue({
      groupId: "group-2",
      name: "個人メモ",
      visibility: "private",
      ownerUserId: "user-1",
      sharedUserIds: [],
      sharedGroups: [],
      managerUserIds: ["user-1"],
      createdAt: "now",
      updatedAt: "now"
    })
    vi.mocked(shareDocumentGroup).mockResolvedValue({
      groupId: "group-1",
      name: "社内規定",
      visibility: "shared",
      ownerUserId: "user-1",
      sharedUserIds: [],
      sharedGroups: ["HR"],
      managerUserIds: ["user-1"],
      createdAt: "now",
      updatedAt: "now"
    })
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

    const stageResult = await act(() => result.current.onStageReindex("doc-1"))
    const cutoverResult = await act(() => result.current.onCutoverReindex("migration-1"))
    const rollbackResult = await act(() => result.current.onRollbackReindex("migration-1"))

    expect(stageReindexMigration).toHaveBeenCalledWith("doc-1")
    expect(cutoverReindexMigration).toHaveBeenCalledWith("migration-1")
    expect(rollbackReindexMigration).toHaveBeenCalledWith("migration-1")
    expect(stageResult).toEqual({ ok: true })
    expect(cutoverResult).toEqual({ ok: true })
    expect(rollbackResult).toEqual({ ok: true })
    expect(listDocuments).toHaveBeenCalledTimes(3)
    expect(listReindexMigrations).toHaveBeenCalledTimes(3)
    expect(props.setError).toHaveBeenCalledWith(null)
  })

  it("権限がない場合は再インデックス API を呼ばない", async () => {
    const { result } = renderHook(() => useDocuments(createProps({ canReindexDocuments: false })))

    const stageResult = await act(() => result.current.onStageReindex("doc-1"))
    const cutoverResult = await act(() => result.current.onCutoverReindex("migration-1"))
    const rollbackResult = await act(() => result.current.onRollbackReindex("migration-1"))

    expect(stageReindexMigration).not.toHaveBeenCalled()
    expect(cutoverReindexMigration).not.toHaveBeenCalled()
    expect(rollbackReindexMigration).not.toHaveBeenCalled()
    expect(stageResult).toEqual({ ok: false, error: "再インデックスを実行する権限がありません" })
    expect(cutoverResult).toEqual({ ok: false, error: "再インデックスを実行する権限がありません" })
    expect(rollbackResult).toEqual({ ok: false, error: "再インデックスを実行する権限がありません" })
  })

  it("再インデックス失敗時はエラーを設定する", async () => {
    const props = createProps()
    vi.mocked(stageReindexMigration).mockRejectedValueOnce(new Error("stage failed"))
    const { result } = renderHook(() => useDocuments(props))

    const operationResult = await act(() => result.current.onStageReindex("doc-1"))

    expect(operationResult).toEqual({ ok: false, error: "stage failed" })
    expect(props.setError).toHaveBeenCalledWith("stage failed")
    expect(result.current.operationState.stagingReindexDocumentId).toBeNull()
  })

  it("文書一覧更新時に消えた選択中文書を all に戻す", async () => {
    const { result } = renderHook(() => useDocuments(createProps()))

    act(() => result.current.setSelectedDocumentId("missing-doc"))
    await act(() => result.current.refreshDocuments())

    expect(result.current.selectedDocumentId).toBe("all")
  })

  it("資料グループ一覧更新時に消えた選択と保存先を初期値へ戻す", async () => {
    vi.mocked(listDocumentGroups).mockResolvedValueOnce([{
      groupId: "group-2",
      name: "公開資料",
      visibility: "shared",
      ownerUserId: "user-1",
      sharedUserIds: [],
      sharedGroups: ["HR"],
      managerUserIds: ["user-1"],
      createdAt: "now",
      updatedAt: "now"
    }])
    const { result } = renderHook(() => useDocuments(createProps()))

    act(() => {
      result.current.setSelectedGroupId("missing-group")
      result.current.setUploadGroupId("missing-group")
    })
    await act(() => result.current.refreshDocumentGroups())

    expect(result.current.selectedGroupId).toBe("all")
    expect(result.current.uploadGroupId).toBe("")
  })

  it("アップロード権限と削除操作に応じて API 呼び出しを分岐する", async () => {
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
    const readonlyUploadResult = await act(() => readonly.result.current.onUploadDocumentFile(file))
    await act(() => readonly.result.current.onCreateDocumentGroup({ name: "readonly", visibility: "private" }))
    const readonlyShareResult = await act(() => readonly.result.current.onShareDocumentGroup("group-1", { visibility: "shared" }))
    expect(uploadDocumentFile).toHaveBeenCalledTimes(1)
    expect(createDocumentGroup).not.toHaveBeenCalled()
    expect(shareDocumentGroup).not.toHaveBeenCalled()
    expect(readonlyUploadResult).toEqual({ ok: false, error: "文書をアップロードする権限がありません" })
    expect(readonlyShareResult).toEqual({ ok: false, error: "共有設定を更新する権限がありません" })

    const missingTargetResult = await act(() => result.current.onDelete(undefined))
    const deleteResult = await act(() => result.current.onDelete("doc-1"))
    await act(() => result.current.onDelete("missing-doc"))

    expect(deleteDocument).toHaveBeenCalledWith("missing-doc")
    expect(missingTargetResult).toEqual({ ok: false, error: "削除対象の documentId が未指定です" })
    expect(deleteResult).toEqual({ ok: true })
    expect(result.current.selectedDocumentId).toBe("all")
    expect(result.current.operationState.deletingDocumentId).toBeNull()
  })

  it("資料グループの取得、保存先指定、一時添付、共有更新を扱う", async () => {
    const props = createProps()
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "scope.txt", { type: "text/plain" })

    await act(() => result.current.refreshDocumentGroups())
    expect(result.current.documentGroups).toHaveLength(1)

    act(() => result.current.setUploadGroupId("group-1"))
    await act(() => result.current.onUploadDocumentFile(file))
    expect(uploadDocumentFile).toHaveBeenCalledWith(expect.objectContaining({
      scope: { scopeType: "group", groupIds: ["group-1"] }
    }))

    act(() => result.current.setSelectedDocumentId("doc-1"))
    await act(() => result.current.ingestDocument(file, { purpose: "chatAttachment", temporaryScopeId: "conv-1" }))
    expect(uploadDocumentFile).toHaveBeenLastCalledWith(expect.objectContaining({
      purpose: "chatAttachment",
      scope: { scopeType: "chat", temporaryScopeId: "conv-1" }
    }))
    expect(result.current.selectedDocumentId).toBe("all")

    await act(() => result.current.onCreateDocumentGroup({ name: "個人メモ", visibility: "private" }))
    await act(() => result.current.onShareDocumentGroup("group-1", { visibility: "shared", sharedGroups: ["HR"] }))

    expect(createDocumentGroup).toHaveBeenCalledWith({ name: "個人メモ", visibility: "private" })
    expect(shareDocumentGroup).toHaveBeenCalledWith("group-1", { visibility: "shared", sharedGroups: ["HR"] })
    expect(listDocumentGroups).toHaveBeenCalledTimes(3)
  })

  it("アップロード進捗と失敗原因を操作単位の状態に反映する", async () => {
    const props = createProps()
    vi.mocked(uploadDocumentFile).mockImplementationOnce(async (input) => {
      input.onProgress?.({ phase: "transferring" })
      input.onProgress?.({ phase: "embedding", runId: "run-1" })
      return { documentId: "doc-progress", fileName: input.file.name, chunkCount: 2, memoryCardCount: 0, createdAt: "now" }
    })
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "progress.pdf", { type: "application/pdf" })

    act(() => result.current.setUploadGroupId("group-1"))
    const uploadResult = await act(() => result.current.onUploadDocumentFile(file))

    expect(result.current.uploadState).toEqual(expect.objectContaining({
      fileName: "progress.pdf",
      groupId: "group-1",
      phase: "complete",
      runId: "run-1"
    }))
    expect(uploadResult).toEqual({ ok: true })
    expect(result.current.operationState.isUploading).toBe(false)

    vi.mocked(uploadDocumentFile).mockRejectedValueOnce(new Error("document ingest run timed out"))
    const failedUploadResult = await act(() => result.current.onUploadDocumentFile(file))

    expect(result.current.uploadState).toEqual(expect.objectContaining({
      phase: "failed",
      errorKind: "timeout"
    }))
    expect(failedUploadResult).toEqual({ ok: false, error: "document ingest run timed out" })
  })

  it("削除、cutover、rollback の失敗時は文字列エラーも設定する", async () => {
    const props = createProps()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.mocked(deleteDocument).mockRejectedValueOnce("delete failed")
    vi.mocked(uploadDocumentFile).mockRejectedValueOnce("upload failed")
    vi.mocked(createDocumentGroup).mockRejectedValueOnce("create group failed")
    vi.mocked(shareDocumentGroup).mockRejectedValueOnce("share group failed")
    vi.mocked(stageReindexMigration).mockRejectedValueOnce("stage failed")
    vi.mocked(cutoverReindexMigration).mockRejectedValueOnce("cutover failed")
    vi.mocked(rollbackReindexMigration).mockRejectedValueOnce("rollback failed")
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "error.txt", { type: "text/plain" })

    const deleteResult = await act(() => result.current.onDelete("doc-1"))
    const uploadResult = await act(() => result.current.onUploadDocumentFile(file))
    await act(() => result.current.onCreateDocumentGroup({ name: "個人メモ", visibility: "private" }))
    const shareResult = await act(() => result.current.onShareDocumentGroup("group-1", { visibility: "shared" }))
    const stageResult = await act(() => result.current.onStageReindex("doc-1"))
    const cutoverResult = await act(() => result.current.onCutoverReindex("migration-1"))
    const rollbackResult = await act(() => result.current.onRollbackReindex("migration-1"))

    expect(deleteResult).toEqual({ ok: false, error: "delete failed" })
    expect(uploadResult).toEqual({ ok: false, error: "upload failed" })
    expect(shareResult).toEqual({ ok: false, error: "share group failed" })
    expect(stageResult).toEqual({ ok: false, error: "stage failed" })
    expect(cutoverResult).toEqual({ ok: false, error: "cutover failed" })
    expect(rollbackResult).toEqual({ ok: false, error: "rollback failed" })
    expect(props.setError).toHaveBeenCalledWith("delete failed")
    expect(props.setError).toHaveBeenCalledWith("upload failed")
    expect(props.setError).toHaveBeenCalledWith("create group failed")
    expect(props.setError).toHaveBeenCalledWith("share group failed")
    expect(props.setError).toHaveBeenCalledWith("stage failed")
    expect(props.setError).toHaveBeenCalledWith("cutover failed")
    expect(props.setError).toHaveBeenCalledWith("rollback failed")
  })

  it("資料管理操作失敗時は Error の message も設定する", async () => {
    const props = createProps()
    vi.mocked(uploadDocumentFile).mockRejectedValueOnce(new Error("upload failed"))
    vi.mocked(createDocumentGroup).mockRejectedValueOnce(new Error("create group failed"))
    vi.mocked(shareDocumentGroup).mockRejectedValueOnce(new Error("share group failed"))
    vi.mocked(cutoverReindexMigration).mockRejectedValueOnce(new Error("cutover failed"))
    vi.mocked(rollbackReindexMigration).mockRejectedValueOnce(new Error("rollback failed"))
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "error.txt", { type: "text/plain" })

    await act(() => result.current.onUploadDocumentFile(file))
    await act(() => result.current.onCreateDocumentGroup({ name: "個人メモ", visibility: "private" }))
    await act(() => result.current.onShareDocumentGroup("group-1", { visibility: "shared" }))
    await act(() => result.current.onCutoverReindex("migration-1"))
    await act(() => result.current.onRollbackReindex("migration-1"))

    expect(props.setError).toHaveBeenCalledWith("upload failed")
    expect(props.setError).toHaveBeenCalledWith("create group failed")
    expect(props.setError).toHaveBeenCalledWith("share group failed")
    expect(props.setError).toHaveBeenCalledWith("cutover failed")
    expect(props.setError).toHaveBeenCalledWith("rollback failed")
  })
})
