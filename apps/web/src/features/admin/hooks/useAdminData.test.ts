import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { listAccessRoles } from "../api/accessRolesApi.js"
import { assignUserRoles, createManagedUser, deleteManagedUser, listManagedUsers, suspendManagedUser, unsuspendManagedUser } from "../api/adminUsersApi.js"
import { createAlias, disableAlias, listAliasAuditLog, listAliases, publishAliases, reviewAlias, updateAlias } from "../api/aliasesApi.js"
import { listAdminAuditLog } from "../api/auditLogApi.js"
import { getCostAuditSummary } from "../api/costApi.js"
import { listUsageSummaries } from "../api/usageApi.js"
import { useAdminData } from "./useAdminData.js"

vi.mock("../api/accessRolesApi.js", () => ({ listAccessRoles: vi.fn().mockResolvedValue([]) }))
vi.mock("../api/adminUsersApi.js", () => ({
  assignUserRoles: vi.fn(),
  createManagedUser: vi.fn(),
  deleteManagedUser: vi.fn(),
  listManagedUsers: vi.fn().mockResolvedValue([]),
  suspendManagedUser: vi.fn(),
  unsuspendManagedUser: vi.fn()
}))
vi.mock("../api/aliasesApi.js", () => ({
  createAlias: vi.fn(),
  disableAlias: vi.fn(),
  listAliasAuditLog: vi.fn(),
  listAliases: vi.fn(),
  publishAliases: vi.fn(),
  reviewAlias: vi.fn(),
  updateAlias: vi.fn()
}))
vi.mock("../api/auditLogApi.js", () => ({ listAdminAuditLog: vi.fn().mockResolvedValue([]) }))
vi.mock("../api/costApi.js", () => ({ getCostAuditSummary: vi.fn().mockResolvedValue(null) }))
vi.mock("../api/usageApi.js", () => ({ listUsageSummaries: vi.fn().mockResolvedValue([]) }))

function createProps(overrides: Partial<Parameters<typeof useAdminData>[0]> = {}): Parameters<typeof useAdminData>[0] {
  return {
    canReadAdminAuditLog: false,
    canReadUsage: false,
    canReadCosts: false,
    canReadUsers: false,
    canOpenAdminSettings: false,
    canReadAliases: true,
    canWriteAliases: true,
    canReviewAliases: true,
    canDisableAliases: true,
    canPublishAliases: true,
    setLoading: vi.fn(),
    setError: vi.fn(),
    ...overrides
  }
}

describe("useAdminData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAliases).mockResolvedValue([{ aliasId: "alias-1", term: "pto", expansions: ["有給休暇"], status: "draft", createdBy: "user-1", createdAt: "now", updatedAt: "now" }])
    vi.mocked(listAliasAuditLog).mockResolvedValue([{ auditId: "audit-1", action: "create", actorUserId: "user-1", createdAt: "now", detail: "created" }])
    vi.mocked(listManagedUsers).mockResolvedValue([{ userId: "user-1", email: "b@example.com", status: "active", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" }])
    vi.mocked(listAccessRoles).mockResolvedValue([{ role: "CHAT_USER", permissions: ["chat:create"] }])
    vi.mocked(listAdminAuditLog).mockResolvedValue([{ auditId: "audit-1", action: "user:create", actorUserId: "admin", targetUserId: "user-1", targetEmail: "b@example.com", beforeGroups: [], afterGroups: [], createdAt: "now" }])
    vi.mocked(listUsageSummaries).mockResolvedValue([{ userId: "user-1", email: "b@example.com", chatMessages: 1, conversationCount: 1, questionCount: 0, documentCount: 0, benchmarkRunCount: 0, debugRunCount: 0 }])
    vi.mocked(getCostAuditSummary).mockResolvedValue({ periodStart: "2026-05-01", periodEnd: "2026-05-31", currency: "USD", totalEstimatedUsd: 1, items: [], users: [], pricingCatalogUpdatedAt: "now" })
    vi.mocked(assignUserRoles).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "active", groups: ["SYSTEM_ADMIN"], createdAt: "now", updatedAt: "now" })
    vi.mocked(createManagedUser).mockResolvedValue({ userId: "user-2", email: "c@example.com", status: "active", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(suspendManagedUser).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "suspended", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(unsuspendManagedUser).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "active", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(deleteManagedUser).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "deleted", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(createAlias).mockResolvedValue({ aliasId: "alias-2", term: "rto", expansions: ["復旧時間目標"], status: "draft", createdBy: "user-1", createdAt: "now", updatedAt: "now" })
    vi.mocked(updateAlias).mockResolvedValue({ aliasId: "alias-1", term: "pto", expansions: ["有給休暇"], status: "draft", createdBy: "user-1", createdAt: "now", updatedAt: "now" })
    vi.mocked(reviewAlias).mockResolvedValue({ aliasId: "alias-1", term: "pto", expansions: ["有給休暇"], status: "approved", createdBy: "user-1", createdAt: "now", updatedAt: "now" })
    vi.mocked(disableAlias).mockResolvedValue({ aliasId: "alias-1", term: "pto", expansions: ["有給休暇"], status: "disabled", createdBy: "user-1", createdAt: "now", updatedAt: "now" })
    vi.mocked(publishAliases).mockResolvedValue({ version: "alias-v1", publishedAt: "now", aliasCount: 1 })
  })

  it("Alias 管理操作後に alias 一覧と監査ログを再取得する", async () => {
    const props = createProps()
    const { result } = renderHook(() => useAdminData(props))

    await act(() => result.current.onCreateAlias({ term: "rto", expansions: ["復旧時間目標"] }))
    await act(() => result.current.onUpdateAlias("alias-1", { expansions: ["有給休暇"] }))
    await act(() => result.current.onReviewAlias("alias-1", "approve"))
    await act(() => result.current.onDisableAlias("alias-1"))
    await act(() => result.current.onPublishAliases())

    expect(createAlias).toHaveBeenCalledWith({ term: "rto", expansions: ["復旧時間目標"] })
    expect(updateAlias).toHaveBeenCalledWith("alias-1", { expansions: ["有給休暇"] })
    expect(reviewAlias).toHaveBeenCalledWith("alias-1", "approve", undefined)
    expect(disableAlias).toHaveBeenCalledWith("alias-1")
    expect(publishAliases).toHaveBeenCalledTimes(1)
    expect(listAliases).toHaveBeenCalledTimes(5)
    expect(listAliasAuditLog).toHaveBeenCalledTimes(5)
    expect(props.setError).toHaveBeenCalledWith(null)
  })

  it("Alias 権限がない操作は API を呼ばない", async () => {
    const { result } = renderHook(() => useAdminData(createProps({ canWriteAliases: false, canReviewAliases: false, canDisableAliases: false, canPublishAliases: false })))

    await act(() => result.current.onCreateAlias({ term: "rto", expansions: ["復旧時間目標"] }))
    await act(() => result.current.onReviewAlias("alias-1", "reject"))
    await act(() => result.current.onDisableAlias("alias-1"))
    await act(() => result.current.onPublishAliases())

    expect(createAlias).not.toHaveBeenCalled()
    expect(reviewAlias).not.toHaveBeenCalled()
    expect(disableAlias).not.toHaveBeenCalled()
    expect(publishAliases).not.toHaveBeenCalled()
  })

  it("権限に応じて admin データをまとめて再取得する", async () => {
    const { result } = renderHook(() => useAdminData(createProps({
      canReadUsers: true,
      canReadAdminAuditLog: true,
      canOpenAdminSettings: true,
      canReadUsage: true,
      canReadCosts: true,
      canReadAliases: true
    })))

    await act(() => result.current.refreshAdminData())

    expect(listManagedUsers).toHaveBeenCalledTimes(1)
    expect(listAdminAuditLog).toHaveBeenCalledTimes(1)
    expect(listAccessRoles).toHaveBeenCalledTimes(1)
    expect(listUsageSummaries).toHaveBeenCalledTimes(1)
    expect(getCostAuditSummary).toHaveBeenCalledTimes(1)
    expect(listAliases).toHaveBeenCalledTimes(1)
    expect(result.current.costAudit?.totalEstimatedUsd).toBe(1)
  })

  it("API field が未提供の場合は空配列に変換せず null のまま保持する", async () => {
    vi.mocked(listManagedUsers).mockResolvedValueOnce(null)
    vi.mocked(listAdminAuditLog).mockResolvedValueOnce(null)
    vi.mocked(listAccessRoles).mockResolvedValueOnce(null)
    vi.mocked(listUsageSummaries).mockResolvedValueOnce(null)
    vi.mocked(getCostAuditSummary).mockResolvedValueOnce(null)
    vi.mocked(listAliases).mockResolvedValueOnce(null)
    vi.mocked(listAliasAuditLog).mockResolvedValueOnce(null)
    const { result } = renderHook(() => useAdminData(createProps({
      canReadUsers: true,
      canReadAdminAuditLog: true,
      canOpenAdminSettings: true,
      canReadUsage: true,
      canReadCosts: true,
      canReadAliases: true
    })))

    await act(() => result.current.refreshAdminData())

    expect(result.current.managedUsers).toBeNull()
    expect(result.current.adminAuditLog).toBeNull()
    expect(result.current.accessRoles).toBeNull()
    expect(result.current.usageSummaries).toBeNull()
    expect(result.current.costAudit).toBeNull()
    expect(result.current.aliases).toBeNull()
    expect(result.current.aliasAuditLog).toBeNull()
  })

  it("読み取り権限がない admin データは再取得しない", async () => {
    const { result } = renderHook(() => useAdminData(createProps({ canReadAliases: false })))

    await act(() => result.current.refreshAdminData())

    expect(listManagedUsers).not.toHaveBeenCalled()
    expect(listAdminAuditLog).not.toHaveBeenCalled()
    expect(listAccessRoles).not.toHaveBeenCalled()
    expect(listUsageSummaries).not.toHaveBeenCalled()
    expect(getCostAuditSummary).not.toHaveBeenCalled()
    expect(listAliases).not.toHaveBeenCalled()
    expect(listAliasAuditLog).not.toHaveBeenCalled()
  })

  it("ユーザー管理操作後に一覧と副作用データを更新する", async () => {
    const props = createProps({ canReadAdminAuditLog: true, canReadUsage: true, canReadCosts: true, canReadAliases: true })
    const { result } = renderHook(() => useAdminData(props))

    await act(() => result.current.onAssignUserRoles("user-1", ["SYSTEM_ADMIN"]))
    await act(() => result.current.onCreateManagedUser({ email: "c@example.com", groups: ["CHAT_USER"] }))
    await act(() => result.current.onSetManagedUserStatus("user-1", "suspend"))
    await act(() => result.current.onSetManagedUserStatus("user-1", "unsuspend"))
    await act(() => result.current.onSetManagedUserStatus("user-1", "delete"))

    expect(assignUserRoles).toHaveBeenCalledWith("user-1", ["SYSTEM_ADMIN"])
    expect(createManagedUser).toHaveBeenCalledWith({ email: "c@example.com", groups: ["CHAT_USER"] })
    expect(suspendManagedUser).toHaveBeenCalledWith("user-1")
    expect(unsuspendManagedUser).toHaveBeenCalledWith("user-1")
    expect(deleteManagedUser).toHaveBeenCalledTimes(1)
    expect(result.current.managedUsers?.some((user) => user.userId === "user-1")).toBe(false)
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("管理操作失敗時はエラーを設定する", async () => {
    const props = createProps()
    vi.mocked(assignUserRoles).mockRejectedValueOnce(new Error("assign failed"))
    const { result } = renderHook(() => useAdminData(props))

    await act(() => result.current.onAssignUserRoles("user-1", ["SYSTEM_ADMIN"]))

    expect(props.setError).toHaveBeenCalledWith("assign failed")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("管理操作失敗時は文字列エラーも設定する", async () => {
    const props = createProps()
    vi.mocked(assignUserRoles).mockRejectedValueOnce("assign failed")
    vi.mocked(createManagedUser).mockRejectedValueOnce("create user failed")
    vi.mocked(suspendManagedUser).mockRejectedValueOnce("suspend failed")
    const { result } = renderHook(() => useAdminData(props))

    await act(() => result.current.onAssignUserRoles("user-1", ["SYSTEM_ADMIN"]))
    await act(() => result.current.onCreateManagedUser({ email: "c@example.com" }))
    await act(() => result.current.onSetManagedUserStatus("user-1", "suspend"))

    expect(props.setError).toHaveBeenCalledWith("assign failed")
    expect(props.setError).toHaveBeenCalledWith("create user failed")
    expect(props.setError).toHaveBeenCalledWith("suspend failed")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("ユーザー作成と状態変更失敗時は Error の message も設定する", async () => {
    const props = createProps()
    vi.mocked(createManagedUser).mockRejectedValueOnce(new Error("create user failed"))
    vi.mocked(unsuspendManagedUser).mockRejectedValueOnce(new Error("unsuspend failed"))
    vi.mocked(deleteManagedUser).mockRejectedValueOnce(new Error("delete failed"))
    const { result } = renderHook(() => useAdminData(props))

    await act(() => result.current.onCreateManagedUser({ email: "c@example.com" }))
    await act(() => result.current.onSetManagedUserStatus("user-1", "unsuspend"))
    await act(() => result.current.onSetManagedUserStatus("user-1", "delete"))

    expect(props.setError).toHaveBeenCalledWith("create user failed")
    expect(props.setError).toHaveBeenCalledWith("unsuspend failed")
    expect(props.setError).toHaveBeenCalledWith("delete failed")
  })

  it("Alias 管理操作失敗時は文字列エラーも設定する", async () => {
    const props = createProps()
    vi.mocked(createAlias).mockRejectedValueOnce("create alias failed")
    vi.mocked(updateAlias).mockRejectedValueOnce("update alias failed")
    vi.mocked(reviewAlias).mockRejectedValueOnce("review alias failed")
    vi.mocked(disableAlias).mockRejectedValueOnce("disable alias failed")
    vi.mocked(publishAliases).mockRejectedValueOnce("publish alias failed")
    const { result } = renderHook(() => useAdminData(props))

    await act(() => result.current.onCreateAlias({ term: "rto", expansions: ["復旧時間目標"] }))
    await act(() => result.current.onUpdateAlias("alias-1", { expansions: ["有給休暇"] }))
    await act(() => result.current.onReviewAlias("alias-1", "reject", "重複"))
    await act(() => result.current.onDisableAlias("alias-1"))
    await act(() => result.current.onPublishAliases())

    expect(props.setError).toHaveBeenCalledWith("create alias failed")
    expect(props.setError).toHaveBeenCalledWith("update alias failed")
    expect(props.setError).toHaveBeenCalledWith("review alias failed")
    expect(props.setError).toHaveBeenCalledWith("disable alias failed")
    expect(props.setError).toHaveBeenCalledWith("publish alias failed")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("Alias 管理操作失敗時は Error の message も設定する", async () => {
    const props = createProps()
    vi.mocked(createAlias).mockRejectedValueOnce(new Error("create alias failed"))
    vi.mocked(updateAlias).mockRejectedValueOnce(new Error("update alias failed"))
    vi.mocked(reviewAlias).mockRejectedValueOnce(new Error("review alias failed"))
    vi.mocked(disableAlias).mockRejectedValueOnce(new Error("disable alias failed"))
    vi.mocked(publishAliases).mockRejectedValueOnce(new Error("publish alias failed"))
    const { result } = renderHook(() => useAdminData(props))

    await act(() => result.current.onCreateAlias({ term: "rto", expansions: ["復旧時間目標"] }))
    await act(() => result.current.onUpdateAlias("alias-1", { expansions: ["有給休暇"] }))
    await act(() => result.current.onReviewAlias("alias-1", "reject"))
    await act(() => result.current.onDisableAlias("alias-1"))
    await act(() => result.current.onPublishAliases())

    expect(props.setError).toHaveBeenCalledWith("create alias failed")
    expect(props.setError).toHaveBeenCalledWith("update alias failed")
    expect(props.setError).toHaveBeenCalledWith("review alias failed")
    expect(props.setError).toHaveBeenCalledWith("disable alias failed")
    expect(props.setError).toHaveBeenCalledWith("publish alias failed")
  })
})
