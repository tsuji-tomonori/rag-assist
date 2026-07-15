import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { listAccessRoles } from "../api/accessRolesApi.js"
import { assignUserRoles, createManagedUser, deleteManagedUser, getManagedUserDeletionPreflight, listManagedUsers, suspendManagedUser, unsuspendManagedUser } from "../api/adminUsersApi.js"
import { createAlias, disableAlias, listAliasAuditLog, listAliases, publishAliases, reviewAlias, transitionAliasToDraft, updateAlias } from "../api/aliasesApi.js"
import { listAdminAuditLog } from "../api/auditLogApi.js"
import { createCostExport, getCostAuditSummary } from "../api/costApi.js"
import { createUsageExport, listUsageSummaries } from "../api/usageApi.js"
import type { AliasAuditLogPage, AliasDefinition, AliasListPage } from "../types.js"
import { useAdminData } from "./useAdminData.js"

vi.mock("../api/accessRolesApi.js", () => ({ listAccessRoles: vi.fn() }))
vi.mock("../api/adminUsersApi.js", () => ({
  assignUserRoles: vi.fn(),
  createManagedUser: vi.fn(),
  deleteManagedUser: vi.fn(),
  getManagedUserDeletionPreflight: vi.fn(),
  listManagedUsers: vi.fn(),
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
  transitionAliasToDraft: vi.fn(),
  updateAlias: vi.fn()
}))
vi.mock("../api/auditLogApi.js", () => ({ listAdminAuditLog: vi.fn() }))
vi.mock("../api/costApi.js", () => ({ createCostExport: vi.fn(), getCostAuditSummary: vi.fn() }))
vi.mock("../api/usageApi.js", () => ({ createUsageExport: vi.fn(), listUsageSummaries: vi.fn() }))

const aliasDraft: AliasDefinition = {
  aliasId: "alias-1",
  version: "alias-version-1",
  term: "pto",
  expansions: ["有給休暇"],
  scope: { tenantId: "tenant-1" },
  status: "draft",
  createdBy: "user-1",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z"
}

function aliasListPage(aliases = [aliasDraft], overrides: Partial<AliasListPage> = {}): AliasListPage {
  return {
    aliases,
    total: aliases.length,
    truncated: false,
    source: "alias-governance-ledger",
    asOf: "2026-05-10T00:00:00.000Z",
    version: "ledger-version-1",
    ...overrides
  }
}

function aliasAuditPage(overrides: Partial<AliasAuditLogPage> = {}): AliasAuditLogPage {
  return {
    auditLog: [{
      auditId: "audit-1",
      aliasId: "alias-1",
      tenantId: "tenant-1",
      action: "create",
      actorUserId: "user-1",
      result: "success",
      reason: "登録",
      afterStatus: "draft",
      aliasVersion: "alias-version-1",
      createdAt: "2026-05-02T00:00:00.000Z",
      detail: "created"
    }],
    total: 1,
    truncated: false,
    source: "alias-governance-audit-ledger",
    asOf: "2026-05-10T00:00:00.000Z",
    ...overrides
  }
}

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
    vi.mocked(listAliases).mockResolvedValue(aliasListPage())
    vi.mocked(listAliasAuditLog).mockResolvedValue(aliasAuditPage())
    vi.mocked(listManagedUsers).mockResolvedValue({
      users: [{ userId: "user-1", email: "b@example.com", status: "active", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" }],
      total: 1,
      truncated: false,
      source: "authoritative_identity",
      asOf: "now",
      version: "ledger-version-1"
    })
    vi.mocked(listAccessRoles).mockResolvedValue({
      roles: [{ role: "CHAT_USER", displayName: "チャット利用者", description: "チャットを利用", kind: "systemPreset", permissions: ["chat:create"] }],
      catalogVersion: "role-v1",
      source: "role-catalog",
      asOf: "now"
    })
    vi.mocked(listAdminAuditLog).mockResolvedValue({
      auditLog: [{ auditId: "admin-audit-1", action: "user:create", actorUserId: "admin", targetUserId: "user-1", targetEmail: "b@example.com", beforeGroups: [], afterGroups: [], createdAt: "now" }],
      total: 1,
      truncated: false,
      source: "admin-audit-ledger",
      asOf: "now"
    })
    vi.mocked(listUsageSummaries).mockResolvedValue({
      query: { periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-06-01T00:00:00.000Z", limit: 50 },
      events: [], truncated: false, asOf: "2026-05-10T00:00:00.000Z", source: "usage_event_store",
      rolloutMode: "active",
      completeness: { eventCount: 0, actualQuantityCount: 0, estimatedQuantityCount: 0, missingQuantityCount: 0, unknownSubjectCount: 0, unknownRunCount: 0, unknownModelCount: 0, unknownFeatureCount: 0, unpricedQuantityCount: 0, state: "missing" },
      breakdowns: { bySubject: [], byFeature: [], byProvider: [], byModel: [] }
    })
    vi.mocked(getCostAuditSummary).mockResolvedValue(null)
    vi.mocked(createUsageExport).mockResolvedValue({ exportType: "usage_summary", url: "https://example.test/usage", expiresInSeconds: 900, objectKey: "usage.json", generatedAt: "now", redaction: { policyVersion: "admin-export-redaction-v1", redactedFields: [], notes: [] } })
    vi.mocked(createCostExport).mockResolvedValue({ exportType: "cost_summary", url: "https://example.test/cost", expiresInSeconds: 900, objectKey: "cost.json", generatedAt: "now", redaction: { policyVersion: "admin-export-redaction-v1", redactedFields: [], notes: [] } })
    vi.mocked(assignUserRoles).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "active", groups: ["CHAT_USER", "SYSTEM_ADMIN"], createdAt: "now", updatedAt: "now" })
    vi.mocked(createManagedUser).mockResolvedValue({ userId: "user-2", email: "c@example.com", status: "active", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(suspendManagedUser).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "suspended", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(unsuspendManagedUser).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "active", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(deleteManagedUser).mockResolvedValue({ userId: "user-1", email: "a@example.com", status: "deleted", groups: ["CHAT_USER"], createdAt: "now", updatedAt: "now" })
    vi.mocked(getManagedUserDeletionPreflight).mockResolvedValue({ targetUserId: "user-1", requiresSuccessor: false, ownedResources: { folders: 0, resourceGroups: 0, documents: 0, total: 0 }, eligibleSuccessors: [] })
    vi.mocked(createAlias).mockResolvedValue({ ...aliasDraft, aliasId: "alias-2", version: "alias-version-2", term: "rto" })
    vi.mocked(updateAlias).mockResolvedValue({ ...aliasDraft, version: "alias-version-2", expansions: ["有給休暇", "休暇申請"] })
    vi.mocked(reviewAlias).mockResolvedValue({ ...aliasDraft, version: "alias-version-2", status: "approved" })
    vi.mocked(transitionAliasToDraft).mockResolvedValue({ ...aliasDraft, version: "alias-version-3" })
    vi.mocked(disableAlias).mockResolvedValue({ ...aliasDraft, version: "alias-version-2", status: "disabled" })
    vi.mocked(publishAliases).mockResolvedValue({ version: "published-v1", publishedAt: "now", aliasCount: 1 })
  })

  it("page metadata を保持し filter と stable cursor の追記を API へ渡す", async () => {
    const pageTwoAlias = { ...aliasDraft, aliasId: "alias-2", version: "alias-version-2", term: "rto" }
    vi.mocked(listAliases)
      .mockResolvedValueOnce(aliasListPage([aliasDraft], { total: 2, nextCursor: "cursor-2", truncated: true }))
      .mockResolvedValueOnce(aliasListPage([pageTwoAlias], { total: 2 }))
    const { result } = renderHook(() => useAdminData(createProps()))

    await act(() => result.current.refreshAliases({ limit: 1, query: "休暇", status: "draft", sort: "termAsc" }))
    await act(() => result.current.refreshAliases({ limit: 1, query: "休暇", status: "draft", sort: "termAsc", cursor: "cursor-2" }, true))

    expect(listAliases).toHaveBeenNthCalledWith(1, { limit: 1, query: "休暇", status: "draft", sort: "termAsc" })
    expect(listAliases).toHaveBeenNthCalledWith(2, { limit: 1, query: "休暇", status: "draft", sort: "termAsc", cursor: "cursor-2" })
    expect(result.current.aliases?.map((alias) => alias.aliasId)).toEqual(["alias-1", "alias-2"])
    expect(result.current.aliasPage).toMatchObject({ total: 2, source: "alias-governance-ledger" })
  })

  it("Alias mutation に expected version・reason を渡し server 応答だけを state に使う", async () => {
    const { result } = renderHook(() => useAdminData(createProps()))
    await act(() => result.current.refreshAliases())

    const updateOutcome = await act(() => result.current.onUpdateAlias("alias-1", {
      expansions: ["有給休暇", "休暇申請"],
      expectedVersion: "alias-version-1",
      reason: "展開語追加"
    }))
    await act(() => result.current.onReviewAlias("alias-1", "approve", "alias-version-2", "レビュー済み"))
    await act(() => result.current.onTransitionAlias("alias-1", "alias-version-2", "再編集"))
    await act(() => result.current.onDisableAlias("alias-1", "alias-version-3", "廃止"))
    const publishOutcome = await act(() => result.current.onPublishAliases("ledger-version-1", "検索へ反映"))

    expect(updateAlias).toHaveBeenCalledWith("alias-1", expect.objectContaining({ expectedVersion: "alias-version-1", reason: "展開語追加" }))
    expect(reviewAlias).toHaveBeenCalledWith("alias-1", "approve", "alias-version-2", "レビュー済み")
    expect(transitionAliasToDraft).toHaveBeenCalledWith("alias-1", "alias-version-2", "再編集")
    expect(disableAlias).toHaveBeenCalledWith("alias-1", "alias-version-3", "廃止")
    expect(publishAliases).toHaveBeenCalledWith("ledger-version-1", "検索へ反映")
    expect(updateOutcome).toMatchObject({ ok: true, evidence: { version: "alias-version-2" } })
    expect(publishOutcome).toMatchObject({ ok: true, evidence: { version: "published-v1" } })
  })

  it("Alias 権限がない操作は API を呼ばず failure を返す", async () => {
    const { result } = renderHook(() => useAdminData(createProps({ canWriteAliases: false, canReviewAliases: false, canDisableAliases: false, canPublishAliases: false })))
    const outcomes = await act(() => Promise.all([
      result.current.onCreateAlias({ term: "rto", expansions: ["復旧時間目標"] }),
      result.current.onReviewAlias("alias-1", "reject", "v1", "重複"),
      result.current.onTransitionAlias("alias-1", "v1", "再編集"),
      result.current.onDisableAlias("alias-1", "v1", "廃止"),
      result.current.onPublishAliases("ledger-v1", "公開")
    ]))
    expect(outcomes.every((outcome) => !outcome.ok)).toBe(true)
    expect(createAlias).not.toHaveBeenCalled()
    expect(reviewAlias).not.toHaveBeenCalled()
    expect(transitionAliasToDraft).not.toHaveBeenCalled()
    expect(disableAlias).not.toHaveBeenCalled()
    expect(publishAliases).not.toHaveBeenCalled()
  })

  it("権限内の admin resource を独立取得し、role/page metadata を保持する", async () => {
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
    expect(listAdminAuditLog).toHaveBeenCalledWith({ limit: 50 })
    expect(listAccessRoles).toHaveBeenCalledTimes(1)
    expect(listAliases).toHaveBeenCalledWith({ limit: 50, sort: "updatedDesc" })
    expect(listAliasAuditLog).toHaveBeenCalledWith({ limit: 50 })
    expect(result.current.accessRoleList).toMatchObject({ catalogVersion: "role-v1" })
    expect(result.current.adminAuditPage).toMatchObject({ total: 1 })
  })

  it("usage と cost export は別権限で同じ cursor-free query と理由を送る", async () => {
    const query = {
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
      subjectId: "subject-1",
      provider: "bedrock",
      cursor: "stale-cursor",
      limit: 1
    }
    const { result } = renderHook(() => useAdminData(createProps({
      canReadUsage: false,
      canReadCosts: false,
      canExportUsage: true,
      canExportCosts: true
    })))
    await act(() => result.current.applyUsageCostQuery(query))
    await act(() => result.current.onCreateUsageExport("Usage reconciliation"))
    await act(() => result.current.onCreateCostExport("Cost reconciliation"))

    const normalized = {
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      subjectId: "subject-1",
      provider: "bedrock"
    }
    expect(createUsageExport).toHaveBeenCalledWith(normalized, "Usage reconciliation")
    expect(createCostExport).toHaveBeenCalledWith(normalized, "Cost reconciliation")
  })

  it("usage と cost export は read 権限だけでは API を呼ばない", async () => {
    const { result } = renderHook(() => useAdminData(createProps({ canReadUsage: true, canReadCosts: true })))
    await expect(result.current.onCreateUsageExport("Denied usage export")).rejects.toThrow("権限がありません")
    await expect(result.current.onCreateCostExport("Denied cost export")).rejects.toThrow("権限がありません")
    expect(createUsageExport).not.toHaveBeenCalled()
    expect(createCostExport).not.toHaveBeenCalled()
  })

  it("usage と cost の stable cursor page を重複なく追記し、終端では再取得しない", async () => {
    const completeness = { eventCount: 1, actualQuantityCount: 1, estimatedQuantityCount: 0, missingQuantityCount: 0, unknownSubjectCount: 0, unknownRunCount: 0, unknownModelCount: 0, unknownFeatureCount: 0, unpricedQuantityCount: 0, state: "complete" as const }
    const event = { schemaVersion: 1 as const, eventId: "event-1", tenantId: "tenant-1", quantities: [{ unit: "input_token" as const, value: 1, source: "provider" as const }], status: "succeeded" as const, idempotencyKey: "idem-1", occurredAt: "2026-05-01T00:00:00.000Z", recordedAt: "2026-05-01T00:00:01.000Z" }
    const usageBase = { query: { periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-06-01T00:00:00.000Z", limit: 50 }, truncated: true, asOf: "now", source: "usage_event_store" as const, rolloutMode: "active" as const, completeness, breakdowns: { bySubject: [], byFeature: [], byProvider: [], byModel: [] } }
    vi.mocked(listUsageSummaries)
      .mockResolvedValueOnce({ ...usageBase, events: [event], nextCursor: "usage-next" })
      .mockResolvedValueOnce({ ...usageBase, events: [event, { ...event, eventId: "event-2", idempotencyKey: "idem-2" }], truncated: false })
    const costItem = { eventId: "event-1", subjectId: "user-1", runId: "run-1", feature: "chat", provider: "bedrock", region: "ap-northeast-1", modelId: "model-1", unit: "input_token" as const, quantity: 1, measurementSource: "provider" as const, pricingState: "actual" as const, catalogVersion: "v1", priceSource: "catalog", costUsd: 0.1, occurredAt: "2026-05-01T00:00:00.000Z" }
    const costBase = { query: usageBase.query, currency: "USD" as const, truncated: true, asOf: "now", source: "usage_event_store+versioned_price_catalog" as const, rolloutMode: "active" as const, catalogVersions: ["v1"], completeness }
    vi.mocked(getCostAuditSummary)
      .mockResolvedValueOnce({ ...costBase, pricedCostUsd: 0.1, items: [costItem], nextCursor: "cost-next" })
      .mockResolvedValueOnce({ ...costBase, pricedCostUsd: 0.2, items: [costItem, { ...costItem, eventId: "event-2" }], truncated: false })

    const { result } = renderHook(() => useAdminData(createProps({ canReadUsage: true, canReadCosts: true, canReadAliases: false })))
    await act(() => result.current.refreshUsageSummaries())
    await act(() => result.current.refreshCostAudit())
    await act(() => result.current.loadMoreUsage())
    await act(() => result.current.loadMoreCosts())
    expect(result.current.usageSummaries?.events.map((item) => item.eventId)).toEqual(["event-1", "event-2"])
    expect(result.current.costAudit?.items.map((item) => item.eventId)).toEqual(["event-1", "event-2"])
    expect(result.current.costAudit?.pricedCostUsd).toBeCloseTo(0.3)
    expect(listUsageSummaries).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "usage-next" }))
    expect(getCostAuditSummary).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "cost-next" }))
    await act(() => result.current.loadMoreUsage())
    await act(() => result.current.loadMoreCosts())
    expect(listUsageSummaries).toHaveBeenCalledTimes(2)
    expect(getCostAuditSummary).toHaveBeenCalledTimes(2)
  })

  it("権限がない refreshAdminData は管理 API を呼ばない", async () => {
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

  it("確定後の監査再取得失敗は再実行を促さない partial として返す", async () => {
    vi.mocked(listAliasAuditLog).mockRejectedValueOnce(new Error("audit refresh failed"))
    const props = createProps()
    const { result } = renderHook(() => useAdminData(props))
    const outcome = await act(() => result.current.onPublishAliases("ledger-version-1", "検索へ反映"))
    expect(outcome).toMatchObject({ ok: true, status: "partial", evidence: { version: "published-v1" } })
    expect(outcome.message).toContain("再実行せず更新してください")
    expect(outcome.message).not.toContain("audit refresh failed")
  })

  it("mutation の通信断は結果不明として返す", async () => {
    vi.mocked(assignUserRoles).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const props = createProps()
    const { result } = renderHook(() => useAdminData(props))
    const outcome = await act(() => result.current.onAssignUserRoles("user-1", ["CHAT_USER", "SYSTEM_ADMIN"], "管理担当追加"))
    expect(outcome).toMatchObject({ ok: false, status: "unknown" })
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("削除 preflight と successor を user API へ引き継ぐ", async () => {
    vi.mocked(getManagedUserDeletionPreflight).mockResolvedValueOnce({
      targetUserId: "user-1",
      requiresSuccessor: true,
      ownedResources: { folders: 1, resourceGroups: 1, documents: 1, total: 3 },
      eligibleSuccessors: [{ userId: "successor-1", email: "successor@example.com", status: "active" }]
    })
    const { result } = renderHook(() => useAdminData(createProps()))
    const preflight = await act(() => result.current.onPrepareManagedUserDelete("user-1"))
    await act(() => result.current.onSetManagedUserStatus("user-1", "delete", "successor-1"))
    expect(preflight?.eligibleSuccessors).toHaveLength(1)
    expect(deleteManagedUser).toHaveBeenCalledWith("user-1", "successor-1")
  })
})
