import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createAlias, disableAlias, listAliasAuditLog, listAliases, publishAliases, reviewAlias, updateAlias } from "../api/aliasesApi.js"
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
})
