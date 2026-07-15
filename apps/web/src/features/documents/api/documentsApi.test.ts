import { afterEach, describe, expect, it, vi } from "vitest"
import { resetRuntimeConfigForTests } from "../../../shared/api/runtimeConfig.js"
import {
  createDocumentGroup,
  deleteDocument,
  getDocumentShare,
  getFolderSharePolicy,
  listDocumentGroups,
  listDocuments,
  moveDocumentGroup,
  requestDocumentExtractedTextDownload,
  saveDocumentExtractedTextDownload,
  replaceFolderSharePolicy,
  updateDocumentShare
} from "./documentsApi.js"

describe("documents API authorized collection and extracted-text download", () => {
  afterEach(() => {
    resetRuntimeConfigForTests()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("server-issued authorized-only cursorsだけを辿って文書とフォルダを集約する", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce(jsonResponse({
        documents: [{ detailLevel: "reader", documentId: "doc-visible-1", fileName: "one.txt", createdAt: "2026-07-11T00:00:00.000Z" }],
        count: 1,
        nextCursor: "MQ",
        responseProfileVersion: "resource-non-enumeration-v1"
      }))
      .mockResolvedValueOnce(jsonResponse({
        documents: [{ detailLevel: "reader", documentId: "doc-visible-2", fileName: "two.txt", createdAt: "2026-07-11T00:00:01.000Z" }],
        count: 1,
        responseProfileVersion: "resource-non-enumeration-v1"
      }))
      .mockResolvedValueOnce(jsonResponse({
        groups: [{ detailLevel: "reader", groupId: "group-visible", name: "共有資料", effectivePermission: "readOnly", capabilities: { canRead: true, canManage: false } }],
        count: 1,
        responseProfileVersion: "resource-non-enumeration-v1"
      }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listDocuments()).resolves.toEqual([
      expect.objectContaining({ documentId: "doc-visible-1" }),
      expect.objectContaining({ documentId: "doc-visible-2" })
    ])
    await expect(listDocumentGroups()).resolves.toEqual([
      expect.objectContaining({ groupId: "group-visible" })
    ])

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/documents", { headers: {} })
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://api.example.test/documents?cursor=MQ", { headers: {} })
    expect(fetchMock).toHaveBeenNthCalledWith(4, "http://api.example.test/document-groups", { headers: {} })
    expect(JSON.stringify(await listFromMockResults(fetchMock))).not.toContain("hidden")
  })

  it("フォルダ作成は name、任意 description、任意 parentGroupId だけを送る", async () => {
    const created = {
      groupId: "folder-created",
      name: "安全な子フォルダ",
      description: "共有設定は作成後に行う",
      parentGroupId: "folder-parent"
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce(jsonResponse(created))
    vi.stubGlobal("fetch", fetchMock)

    await expect(createDocumentGroup({
      name: "安全な子フォルダ",
      description: "共有設定は作成後に行う",
      parentGroupId: "folder-parent"
    })).resolves.toEqual(created)

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/document-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "安全な子フォルダ",
        description: "共有設定は作成後に行う",
        parentGroupId: "folder-parent"
      })
    })
  })

  it("実際の text/plain 本文と server filename を保存処理へ渡す", async () => {
    const headers = new Headers({
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": "attachment; filename=\"policy.txt\"; filename*=UTF-8''%E5%B0%B1%E6%A5%AD%E8%A6%8F%E5%89%87.txt"
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce({
        ok: true,
        headers,
        blob: vi.fn().mockResolvedValue(new Blob(["抽出済み本文"], { type: "text/plain" }))
      })
    vi.stubGlobal("fetch", fetchMock)

    const download = await requestDocumentExtractedTextDownload("doc/visible")
    expect(download.fileName).toBe("就業規則.txt")
    await expect(download.blob.text()).resolves.toBe("抽出済み本文")
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/documents/doc%2Fvisible/extracted-text", { headers: {} })

    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    const createObjectURL = vi.fn().mockReturnValue("blob:download")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }))
    saveDocumentExtractedTextDownload(download)
    expect(click).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledWith(download.blob)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download")
  })

  it("取得した文書共有 policy version を PUT の expectedVersion として送る", async () => {
    const loaded = {
      inheritedFolderGrants: [],
      directDocumentGrants: [],
      currentUserEffectivePermission: "full",
      version: "share-version-7"
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce(jsonResponse(loaded))
      .mockResolvedValueOnce(jsonResponse({ ...loaded, version: "share-version-8" }))
    vi.stubGlobal("fetch", fetchMock)

    const share = await getDocumentShare("doc/versioned")
    const updated = await updateDocumentShare("doc/versioned", {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
      expectedVersion: share.version,
      reason: "review access"
    })

    expect(updated.version).toBe("share-version-8")
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/documents/doc%2Fversioned/share", { headers: {} })
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://api.example.test/documents/doc%2Fversioned/share", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
        expectedVersion: "share-version-7",
        reason: "review access"
      })
    })
  })

  it("文書削除の API 確定結果を破棄せず対象と削除件数を返す", async () => {
    const deleted = { documentId: "doc/versioned", deletedVectorCount: 12 }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce(jsonResponse(deleted))
    vi.stubGlobal("fetch", fetchMock)

    await expect(deleteDocument("doc/versioned", {
      expectedUpdatedAt: "2026-07-11T00:00:00.000Z",
      reason: "重複資料を整理"
    })).resolves.toEqual(deleted)

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/documents/doc%2Fversioned", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedUpdatedAt: "2026-07-11T00:00:00.000Z",
        reason: "重複資料を整理"
      })
    })
  })

  it("フォルダ共有の complete entries、expectedVersion、reason を versioned PUT へ送る", async () => {
    const loaded = { policy: null, version: "folder-version-1" }
    const replaced = {
      policy: {
        policyId: "folder-policy-folder/versioned",
        tenantId: "default",
        folderId: "folder/versioned",
        entries: [
          { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
          { principalType: "group", principalId: "reviewers", permissionLevel: "readOnly" }
        ],
        createdBy: "owner-1",
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:01:00.000Z"
      },
      version: "folder-version-2",
      auditIntentId: "audit-1"
    } as const
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce(jsonResponse(loaded))
      .mockResolvedValueOnce(jsonResponse(replaced))
    vi.stubGlobal("fetch", fetchMock)

    const policy = await getFolderSharePolicy("folder/versioned")
    const entries = [
      { principalType: "user" as const, principalId: "owner-1", permissionLevel: "full" as const },
      { principalType: "group" as const, principalId: "reviewers", permissionLevel: "readOnly" as const }
    ]
    await expect(replaceFolderSharePolicy("folder/versioned", {
      expectedVersion: policy.version,
      entries,
      reason: "review access"
    })).resolves.toEqual(replaced)

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/document-groups/folder%2Fversioned/share", { headers: {} })
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://api.example.test/document-groups/folder%2Fversioned/share", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: "folder-version-1", entries, reason: "review access" })
    })
  })

  it("フォルダ subtree 移動を専用 endpoint へ version と理由付きで送る", async () => {
    const response = {
      operationId: "folder-move-1",
      folder: { groupId: "folder/versioned", name: "改定規定", updatedAt: "version-2" },
      subtree: [{ groupId: "folder/versioned", name: "改定規定", updatedAt: "version-2" }],
      affectedDocumentCount: 4,
      directDocumentGrantsPreserved: true,
      folderLocalPoliciesPreserved: true,
      documentVersionsPreserved: true
    } as const
    const input = {
      destinationParentId: "destination-1",
      newName: "改定規定",
      reason: "部門構成の変更",
      expectedVersion: "version-1"
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce(jsonResponse(response))
    vi.stubGlobal("fetch", fetchMock)

    await expect(moveDocumentGroup("folder/versioned", input)).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/document-groups/folder%2Fversioned/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  })

  it("フォルダ移動競合を再読込可能な日本語メッセージへ変換する", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ apiBaseUrl: "http://api.example.test" }))
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: "Folder move conflict" })),
        headers: new Headers({ "content-type": "application/json" })
      })
    vi.stubGlobal("fetch", fetchMock)

    await expect(moveDocumentGroup("folder-1", {
      destinationParentId: null,
      reason: "ルートへ整理",
      expectedVersion: "stale"
    })).rejects.toThrow("フォルダが他の操作で更新されました。最新状態を再読み込みしてから再実行してください。")
  })
})

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers({ "content-type": "application/json" })
  }
}

async function listFromMockResults(fetchMock: ReturnType<typeof vi.fn>): Promise<unknown[]> {
  return Promise.all(fetchMock.mock.results.map(async (result) => {
    const response = await result.value as { json?: () => Promise<unknown> }
    return response.json ? response.json() : undefined
  }))
}
