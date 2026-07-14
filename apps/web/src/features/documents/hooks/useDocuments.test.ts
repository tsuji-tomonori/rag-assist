import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createDocumentGroup, cutoverReindexMigration, deleteDocument, getDocumentShare, getFolderSharePolicy, listDocumentGroups, listDocuments, listReindexMigrations, moveDocument, moveDocumentGroup, replaceFolderSharePolicy, requestDocumentExtractedTextDownload, rollbackReindexMigration, saveDocumentExtractedTextDownload, stageReindexMigration, updateDocumentGroup, updateDocumentShare, uploadDocumentFile } from "../api/documentsApi.js"
import type { DocumentGroup } from "../types.js"
import { useDocuments } from "./useDocuments.js"

vi.mock("../api/documentsApi.js", () => ({
  createDocumentGroup: vi.fn(),
  cutoverReindexMigration: vi.fn(),
  deleteDocument: vi.fn(),
  getDocumentShare: vi.fn(),
  getFolderSharePolicy: vi.fn(),
  listDocumentGroups: vi.fn(),
  listDocuments: vi.fn(),
  listReindexMigrations: vi.fn(),
  moveDocument: vi.fn(),
  moveDocumentGroup: vi.fn(),
  replaceFolderSharePolicy: vi.fn(),
  requestDocumentExtractedTextDownload: vi.fn(),
  rollbackReindexMigration: vi.fn(),
  saveDocumentExtractedTextDownload: vi.fn(),
  stageReindexMigration: vi.fn(),
  updateDocumentGroup: vi.fn(),
  updateDocumentShare: vi.fn(),
  uploadDocumentFile: vi.fn()
}))

function createProps(overrides: Partial<Parameters<typeof useDocuments>[0]> = {}): Parameters<typeof useDocuments>[0] {
  return {
    modelId: "model",
    embeddingModelId: "embedding",
    canWriteDocuments: true,
    canCreateDocumentGroups: true,
    canShareDocumentGroups: true,
    canMoveDocumentGroups: true,
    canDeleteDocuments: true,
    canReindexDocuments: true,
    setLoading: vi.fn(),
    setError: vi.fn(),
    ...overrides
  }
}

function documentGroupFixture(overrides: Partial<DocumentGroup> = {}): DocumentGroup {
  const name = overrides.name ?? "社内規定"
  const ownerUserId = overrides.ownerUserId ?? "user-1"
  const canonicalPath = overrides.canonicalPath ?? `/${name}`
  const normalizedName = overrides.normalizedName ?? name.normalize("NFKC").toLocaleLowerCase("ja-JP")
  const normalizedCanonicalPath = overrides.normalizedCanonicalPath ?? canonicalPath.normalize("NFKC").toLocaleLowerCase("ja-JP")
  const adminPathPk = overrides.adminPathPk ?? `default#user#${ownerUserId}`
  return {
    groupId: "group-1",
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: ownerUserId,
    name,
    normalizedName,
    canonicalPath,
    normalizedCanonicalPath,
    adminPathPk,
    parentPathPk: `${adminPathPk}#ROOT`,
    visibility: "private",
    ownerUserId,
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [ownerUserId],
    createdAt: "now",
    updatedAt: "now",
    ...overrides
  }
}

describe("useDocuments", () => {
  const deleteInput = { expectedUpdatedAt: "now", reason: "test cleanup" }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listDocumentGroups).mockResolvedValue([documentGroupFixture()])
    vi.mocked(listDocuments).mockResolvedValue([{ documentId: "doc-1", fileName: "a.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }])
    vi.mocked(listReindexMigrations).mockResolvedValue([])
    vi.mocked(uploadDocumentFile).mockResolvedValue({ documentId: "doc-2", fileName: "b.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" })
    vi.mocked(createDocumentGroup).mockResolvedValue(documentGroupFixture({
      groupId: "group-2",
      name: "個人メモ",
      canonicalPath: "/個人メモ",
      normalizedCanonicalPath: "/個人メモ",
      normalizedName: "個人メモ"
    }))
    vi.mocked(updateDocumentGroup).mockResolvedValue(documentGroupFixture({
      visibility: "shared",
      sharedGroups: ["HR"]
    }))
    vi.mocked(getFolderSharePolicy).mockResolvedValue({ policy: null, version: "folder-version-1" })
    vi.mocked(replaceFolderSharePolicy).mockResolvedValue({
      policy: {
        policyId: "folder-policy-1",
        tenantId: "default",
        folderId: "group-1",
        entries: [{ principalType: "user", principalId: "user-1", permissionLevel: "full" }],
        createdBy: "user-1",
        createdAt: "now",
        updatedAt: "now"
      },
      version: "folder-version-2",
      auditIntentId: "audit-1"
    })
    vi.mocked(deleteDocument).mockResolvedValue(undefined)
    vi.mocked(requestDocumentExtractedTextDownload).mockResolvedValue({ blob: new Blob(["extracted"]), fileName: "a.txt" })
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
    vi.mocked(getDocumentShare).mockResolvedValue({
      inheritedFolderGrants: [],
      directDocumentGrants: [],
      currentUserEffectivePermission: "full",
      version: "share-version-1"
    })
    vi.mocked(updateDocumentShare).mockResolvedValue({
      inheritedFolderGrants: [],
      directDocumentGrants: [],
      currentUserEffectivePermission: "full",
      version: "share-version-2"
    })
    vi.mocked(moveDocument).mockResolvedValue({
      document: { documentId: "doc-1", fileName: "a.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now", metadata: { groupId: "group-2" } }
    })
    vi.mocked(moveDocumentGroup).mockResolvedValue({
      operationId: "folder-move-1",
      folder: documentGroupFixture({ groupId: "group-1", parentGroupId: "group-2", updatedAt: "after" }),
      subtree: [documentGroupFixture({ groupId: "group-1", parentGroupId: "group-2", updatedAt: "after" })],
      affectedDocumentCount: 1,
      directDocumentGrantsPreserved: true,
      folderLocalPoliciesPreserved: true,
      documentVersionsPreserved: true
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

  it("削除権限がない場合は削除 API を呼ばない", async () => {
    const { result } = renderHook(() => useDocuments(createProps({ canDeleteDocuments: false })))

    const deleteResult = await act(() => result.current.onDelete("doc-1", deleteInput))

    expect(deleteDocument).not.toHaveBeenCalled()
    expect(deleteResult).toEqual({ ok: false, error: "文書を削除する権限がありません" })
  })

  it("閲覧可能文書の抽出テキストを実 API から取得して保存する", async () => {
    const props = createProps()
    const { result } = renderHook(() => useDocuments(props))

    const downloadResult = await act(() => result.current.onDownloadExtractedText("doc-1"))

    expect(requestDocumentExtractedTextDownload).toHaveBeenCalledWith("doc-1")
    expect(saveDocumentExtractedTextDownload).toHaveBeenCalledWith(expect.objectContaining({ fileName: "a.txt" }))
    expect(downloadResult).toEqual({ ok: true })
    expect(result.current.operationState.downloadingDocumentId).toBeNull()
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
    vi.mocked(listDocumentGroups).mockResolvedValueOnce([documentGroupFixture({
      groupId: "group-2",
      name: "公開資料",
      canonicalPath: "/公開資料",
      normalizedCanonicalPath: "/公開資料",
      normalizedName: "公開資料",
      visibility: "shared",
      sharedGroups: ["HR"]
    })])
    const { result } = renderHook(() => useDocuments(createProps()))

    act(() => {
      result.current.setSelectedGroupId("missing-group")
      result.current.setUploadGroupId("missing-group")
    })
    await act(() => result.current.refreshDocumentGroups())

    expect(result.current.selectedGroupId).toBe("all")
    expect(result.current.uploadGroupId).toBe("")
  })

  it("アップロード権限、フォルダ権限、削除操作に応じて API 呼び出しを分岐する", async () => {
    const props = createProps()
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "b.txt", { type: "" })

    act(() => result.current.setUploadGroupId("group-1"))
    await act(() => result.current.onUploadDocumentFile(file))
    expect(uploadDocumentFile).toHaveBeenCalledWith(expect.objectContaining({
      file,
      memoryModelId: "model",
      embeddingModelId: "embedding"
    }))

    const readonlyUpload = renderHook(() => useDocuments(createProps({ canWriteDocuments: false })))
    const readonlyUploadResult = await act(() => readonlyUpload.result.current.onUploadDocumentFile(file))
    const readonlyCreate = renderHook(() => useDocuments(createProps({ canCreateDocumentGroups: false })))
    await act(() => readonlyCreate.result.current.onCreateDocumentGroup({ name: "readonly" }))
    const readonlyShare = renderHook(() => useDocuments(createProps({ canShareDocumentGroups: false })))
    const readonlyShareResult = await act(() => readonlyShare.result.current.onShareDocumentGroup("group-1", { name: "updated" }))
    expect(uploadDocumentFile).toHaveBeenCalledTimes(1)
    expect(createDocumentGroup).not.toHaveBeenCalled()
    expect(updateDocumentGroup).not.toHaveBeenCalled()
    expect(readonlyUploadResult).toEqual({ ok: false, error: "文書をアップロードする権限がありません" })
    expect(readonlyShareResult).toEqual({ ok: false, error: "フォルダ設定を更新する権限がありません" })

    const missingTargetResult = await act(() => result.current.onDelete(undefined, deleteInput))
    const deleteResult = await act(() => result.current.onDelete("doc-1", deleteInput))
    await act(() => result.current.onDelete("missing-doc", deleteInput))

    expect(deleteDocument).toHaveBeenCalledWith("missing-doc", deleteInput)
    expect(missingTargetResult).toEqual({ ok: false, error: "削除対象の documentId が未指定です" })
    expect(deleteResult).toEqual({ ok: true })
    expect(result.current.selectedDocumentId).toBe("all")
    expect(result.current.operationState.deletingDocumentId).toBeNull()
  })

  it("uploadGroupId が空の場合は通常文書アップロード API を呼ばない", async () => {
    const { result } = renderHook(() => useDocuments(createProps({ canWriteDocuments: true })))
    const file = new File(["body"], "missing-folder.txt", { type: "text/plain" })

    const uploadResult = await act(() => result.current.onUploadDocumentFile(file))

    expect(uploadResult).toEqual({ ok: false, error: "アップロード先フォルダが未指定です" })
    expect(uploadDocumentFile).not.toHaveBeenCalled()
    expect(result.current.operationState.isUploading).toBe(false)
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

    await act(() => result.current.onCreateDocumentGroup({ name: "個人メモ" }))
    const folderShare = await act(() => result.current.onLoadFolderShare("group-1"))
    await act(() => result.current.onReplaceFolderShare("group-1", {
      expectedVersion: "folder-version-1",
      entries: [{ principalType: "user", principalId: "user-1", permissionLevel: "full" }],
      reason: "共有方針の更新"
    }))
    await act(() => result.current.onUpdateDocumentGroup("group-1", { name: "社内規定改定", description: "" }))

    expect(createDocumentGroup).toHaveBeenCalledWith({ name: "個人メモ" })
    expect(folderShare).toEqual({ policy: null, version: "folder-version-1" })
    expect(replaceFolderSharePolicy).toHaveBeenCalledWith("group-1", {
      expectedVersion: "folder-version-1",
      entries: [{ principalType: "user", principalId: "user-1", permissionLevel: "full" }],
      reason: "共有方針の更新"
    })
    expect(updateDocumentGroup).toHaveBeenCalledWith("group-1", { name: "社内規定改定", description: "" })
    expect(listDocumentGroups).toHaveBeenCalledTimes(4)
  })

  it("文書共有と文書移動の操作状態を更新して一覧を再取得する", async () => {
    const props = createProps()
    const { result } = renderHook(() => useDocuments(props))

    const shareInfo = await act(() => result.current.onLoadDocumentShare("doc-1"))
    const shareResult = await act(() => result.current.onShareDocument("doc-1", {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
      expectedVersion: "share-version-1",
      reason: "確認依頼"
    }))
    act(() => result.current.setSelectedDocumentId("doc-1"))
    const moveResult = await act(() => result.current.onMoveDocument("doc-1", {
      destinationFolderId: "group-2",
      newTitle: "moved.txt",
      reason: "整理",
      expectedUpdatedAt: "now"
    }))

    expect(shareInfo).toEqual(expect.objectContaining({ currentUserEffectivePermission: "full" }))
    expect(updateDocumentShare).toHaveBeenCalledWith("doc-1", {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
      expectedVersion: "share-version-1",
      reason: "確認依頼"
    })
    expect(moveDocument).toHaveBeenCalledWith("doc-1", {
      destinationFolderId: "group-2",
      newTitle: "moved.txt",
      reason: "整理",
      expectedUpdatedAt: "now"
    })
    expect(shareResult).toEqual({ ok: true })
    expect(moveResult).toEqual({ ok: true })
    expect(result.current.selectedDocumentId).toBe("all")
    expect(result.current.operationState.sharingDocumentId).toBeNull()
    expect(result.current.operationState.movingDocumentId).toBeNull()
    expect(listDocuments).toHaveBeenCalledTimes(2)
  })

  it("フォルダ移動を version と理由付きで実行し、フォルダと文書を再取得する", async () => {
    const props = createProps()
    const { result } = renderHook(() => useDocuments(props))
    const input = {
      destinationParentId: "group-2",
      newName: "改定規定",
      reason: "部門構成の変更",
      expectedVersion: "now"
    }

    const moveResult = await act(() => result.current.onMoveDocumentGroup("group-1", input))

    expect(moveDocumentGroup).toHaveBeenCalledWith("group-1", input)
    expect(moveResult).toEqual({ ok: true })
    expect(listDocumentGroups).toHaveBeenCalledTimes(1)
    expect(listDocuments).toHaveBeenCalledTimes(1)
    expect(result.current.operationState.movingGroupId).toBeNull()
    expect(props.setError).toHaveBeenCalledWith(null)
  })

  it("フォルダ移動権限を分離し、競合時は再読込後も競合理由を表示する", async () => {
    const denied = renderHook(() => useDocuments(createProps({ canMoveDocumentGroups: false })))
    const input = {
      destinationParentId: null,
      reason: "ルートへ整理",
      expectedVersion: "stale"
    }

    const deniedResult = await act(() => denied.result.current.onMoveDocumentGroup("group-1", input))
    expect(deniedResult).toEqual({ ok: false, error: "フォルダを移動する権限がありません" })
    expect(moveDocumentGroup).not.toHaveBeenCalled()

    const props = createProps()
    vi.mocked(moveDocumentGroup).mockRejectedValueOnce(new Error("フォルダが他の操作で更新されました。最新状態を再読み込みしてから再実行してください。"))
    const allowed = renderHook(() => useDocuments(props))
    const conflictResult = await act(() => allowed.result.current.onMoveDocumentGroup("group-1", input))

    expect(conflictResult).toEqual({
      ok: false,
      error: "フォルダが他の操作で更新されました。最新状態を再読み込みしてから再実行してください。"
    })
    expect(listDocumentGroups).toHaveBeenCalledTimes(1)
    expect(listDocuments).not.toHaveBeenCalled()
    expect(props.setError).toHaveBeenLastCalledWith("フォルダが他の操作で更新されました。最新状態を再読み込みしてから再実行してください。")
    expect(allowed.result.current.operationState.movingGroupId).toBeNull()
  })

  it("文書共有の stale version エラーを返し、一覧を再取得しない", async () => {
    const props = createProps()
    vi.mocked(updateDocumentShare).mockRejectedValueOnce(new Error("document share policy version conflict"))
    const { result } = renderHook(() => useDocuments(props))

    const shareResult = await act(() => result.current.onShareDocument("doc-1", {
      grants: [],
      expectedVersion: "share-version-stale",
      reason: "stale update"
    }))

    expect(updateDocumentShare).toHaveBeenCalledWith("doc-1", {
      grants: [],
      expectedVersion: "share-version-stale",
      reason: "stale update"
    })
    expect(shareResult).toEqual({ ok: false, error: "document share policy version conflict" })
    expect(listDocuments).not.toHaveBeenCalled()
    expect(result.current.operationState.sharingDocumentId).toBeNull()
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
    expect(uploadResult).toEqual({
      ok: true,
      document: expect.objectContaining({
        documentId: "doc-progress",
        fileName: "progress.pdf"
      })
    })
    expect(result.current.operationState.isUploading).toBe(false)

    vi.mocked(uploadDocumentFile).mockRejectedValueOnce(new Error("document ingest run timed out"))
    const failedUploadResult = await act(() => result.current.onUploadDocumentFile(file))

    expect(result.current.uploadState).toEqual(expect.objectContaining({
      phase: "failed",
      errorKind: "timeout"
    }))
    expect(failedUploadResult).toEqual({ ok: false, error: "document ingest run timed out" })
  })

  it("受け入れ拒否をtimeoutへ置換せず正直な失敗状態として表示する", async () => {
    const props = createProps()
    const rejectionMessage = "文書取り込みは受け入れポリシーにより拒否されました"
    vi.mocked(uploadDocumentFile).mockRejectedValueOnce(new Error(rejectionMessage))
    const { result } = renderHook(() => useDocuments(props))
    act(() => result.current.setUploadGroupId("group-1"))

    const uploadResult = await act(() => result.current.onUploadDocumentFile(
      new File(["body"], "rejected.pdf", { type: "application/pdf" })
    ))

    expect(result.current.uploadState).toEqual(expect.objectContaining({
      phase: "failed",
      errorMessage: rejectionMessage
    }))
    expect(uploadResult).toEqual({ ok: false, error: rejectionMessage })
    expect(props.setError).toHaveBeenCalledWith(rejectionMessage)
  })

  it("削除、cutover、rollback の失敗時は文字列エラーも設定する", async () => {
    const props = createProps()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.mocked(deleteDocument).mockRejectedValueOnce("delete failed")
    vi.mocked(uploadDocumentFile).mockRejectedValueOnce("upload failed")
    vi.mocked(createDocumentGroup).mockRejectedValueOnce("create group failed")
    vi.mocked(updateDocumentGroup).mockRejectedValueOnce("share group failed")
    vi.mocked(stageReindexMigration).mockRejectedValueOnce("stage failed")
    vi.mocked(cutoverReindexMigration).mockRejectedValueOnce("cutover failed")
    vi.mocked(rollbackReindexMigration).mockRejectedValueOnce("rollback failed")
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "error.txt", { type: "text/plain" })

    act(() => result.current.setUploadGroupId("group-1"))
    const deleteResult = await act(() => result.current.onDelete("doc-1", deleteInput))
    const uploadResult = await act(() => result.current.onUploadDocumentFile(file))
    await act(() => result.current.onCreateDocumentGroup({ name: "個人メモ" }))
    const shareResult = await act(() => result.current.onShareDocumentGroup("group-1", { name: "updated" }))
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
    vi.mocked(updateDocumentGroup).mockRejectedValueOnce(new Error("share group failed"))
    vi.mocked(cutoverReindexMigration).mockRejectedValueOnce(new Error("cutover failed"))
    vi.mocked(rollbackReindexMigration).mockRejectedValueOnce(new Error("rollback failed"))
    const { result } = renderHook(() => useDocuments(props))
    const file = new File(["body"], "error.txt", { type: "text/plain" })

    act(() => result.current.setUploadGroupId("group-1"))
    await act(() => result.current.onUploadDocumentFile(file))
    await act(() => result.current.onCreateDocumentGroup({ name: "個人メモ" }))
    await act(() => result.current.onShareDocumentGroup("group-1", { name: "updated" }))
    await act(() => result.current.onCutoverReindex("migration-1"))
    await act(() => result.current.onRollbackReindex("migration-1"))

    expect(props.setError).toHaveBeenCalledWith("upload failed")
    expect(props.setError).toHaveBeenCalledWith("create group failed")
    expect(props.setError).toHaveBeenCalledWith("share group failed")
    expect(props.setError).toHaveBeenCalledWith("cutover failed")
    expect(props.setError).toHaveBeenCalledWith("rollback failed")
  })

  it("共有権限がなくても新規フォルダの安全な作成 payload を送信する", async () => {
    const props = createProps({ canCreateDocumentGroups: true, canShareDocumentGroups: false })
    vi.mocked(createDocumentGroup).mockResolvedValueOnce(documentGroupFixture({ groupId: "group-created" }))
    const { result } = renderHook(() => useDocuments(props))

    await act(() => result.current.onCreateDocumentGroup({
      name: "作成のみ",
      description: "説明",
      parentGroupId: "parent-1"
    }))

    expect(createDocumentGroup).toHaveBeenCalledWith({
      name: "作成のみ",
      description: "説明",
      parentGroupId: "parent-1"
    })
  })
})
