import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { UiResourcePartState } from "../../../shared/ui/ResourceState.js"
import type { AccessRoleList, CostAuditSummary, ManagedUserAuditLogPage, UsageCompleteness, UsageSummaryPage } from "../types.js"
import { AdminAuditPanel } from "./panels/AdminAuditPanel.js"
import { AdminCostPanel } from "./panels/AdminCostPanel.js"
import { AdminOverviewGrid } from "./panels/AdminOverviewGrid.js"
import { AdminRolePanel } from "./panels/AdminRolePanel.js"
import { AdminUsagePanel } from "./panels/AdminUsagePanel.js"

const asOf = "2026-07-15T00:00:00.000Z"

function part(status: UiResourcePartState["status"] = "ready"): UiResourcePartState {
  return { id: "test", label: "test", status, asOf }
}

const completeness: UsageCompleteness = {
  eventCount: 0,
  actualQuantityCount: 0,
  estimatedQuantityCount: 0,
  missingQuantityCount: 0,
  unknownSubjectCount: 0,
  unknownRunCount: 0,
  unknownModelCount: 0,
  unknownFeatureCount: 0,
  unpricedQuantityCount: 0,
  state: "complete"
}

function usagePage(overrides: Partial<UsageSummaryPage> = {}): UsageSummaryPage {
  return {
    query: { periodStart: "2026-07-01T00:00:00.000Z", periodEnd: asOf },
    events: [],
    truncated: false,
    asOf,
    source: "usage_event_store",
    rolloutMode: "active",
    completeness,
    breakdowns: { bySubject: [], byFeature: [], byProvider: [], byModel: [] },
    ...overrides
  }
}

function costSummary(overrides: Partial<CostAuditSummary> = {}): CostAuditSummary {
  return {
    query: { periodStart: "2026-07-01T00:00:00.000Z", periodEnd: asOf },
    currency: "USD",
    pricedCostUsd: 0,
    items: [],
    truncated: false,
    asOf,
    source: "usage_event_store+versioned_price_catalog",
    rolloutMode: "active",
    catalogVersions: [],
    completeness,
    ...overrides
  }
}

const panelActions = {
  canExport: false,
  onApplyQuery: vi.fn().mockResolvedValue(undefined),
  onRefresh: vi.fn().mockResolvedValue(undefined),
  onLoadMore: vi.fn().mockResolvedValue(undefined),
  onCreateExport: vi.fn()
}

describe("admin panel boundary states", () => {
  it("overview は権限内の未提供・取得失敗を区別し、権限がなければ空状態を表示する", async () => {
    const onOpenRoles = vi.fn()
    const { rerender } = render(<AdminOverviewGrid
      documentsCount={null}
      openQuestionsCount={null}
      debugRunsCount={null}
      benchmarkRunsCount={null}
      managedUsers={null}
      accessRoles={null}
      usageSummaries={null}
      costAudit={null}
      aliases={null}
      failedParts={new Set(["roles", "usage", "cost", "aliases"])}
      canManageDocuments={true}
      canAnswerQuestions={true}
      canReadDebugRuns={true}
      canReadBenchmarkRuns={true}
      canOpenAdminSettings={true}
      canReadUsers={true}
      canReadUsage={true}
      canReadCosts={true}
      canManageAliases={true}
      onOpenDocuments={vi.fn()}
      onOpenAssignee={vi.fn()}
      onOpenDebug={vi.fn()}
      onOpenBenchmark={vi.fn()}
      onOpenUsers={vi.fn()}
      onOpenRoles={onOpenRoles}
      onOpenUsageCost={vi.fn()}
      onOpenAliases={vi.fn()}
    />)

    expect(screen.getByRole("button", { name: "アクセス管理を開く" })).toHaveTextContent("取得失敗")
    expect(screen.getByRole("button", { name: "ユーザー管理を開く" })).toHaveTextContent("未提供")
    expect(screen.getByRole("button", { name: "コスト監査を開く" })).toHaveTextContent("取得失敗")
    await userEvent.click(screen.getByRole("button", { name: "アクセス管理を開く" }))
    expect(onOpenRoles).toHaveBeenCalledTimes(1)

    rerender(<AdminOverviewGrid
      documentsCount={null} openQuestionsCount={null} debugRunsCount={null} benchmarkRunsCount={null}
      managedUsers={null} accessRoles={null} usageSummaries={null} costAudit={null} aliases={null}
      canManageDocuments={false} canAnswerQuestions={false} canReadDebugRuns={false} canReadBenchmarkRuns={false}
      canOpenAdminSettings={false} canReadUsers={false} canReadUsage={false} canReadCosts={false} canManageAliases={false}
      onOpenDocuments={vi.fn()} onOpenAssignee={vi.fn()} onOpenDebug={vi.fn()} onOpenBenchmark={vi.fn()}
      onOpenUsers={vi.fn()} onOpenRoles={vi.fn()} onOpenUsageCost={vi.fn()} onOpenAliases={vi.fn()}
    />)
    expect(screen.getByText("表示できる管理 summary はありません。")).toBeInTheDocument()
  })

  it("overview は実データ由来の action/KPI を表示して各導線を呼ぶ", async () => {
    const callbacks = Array.from({ length: 8 }, () => vi.fn())
    render(<AdminOverviewGrid
      documentsCount={2} openQuestionsCount={3} debugRunsCount={4} benchmarkRunsCount={5}
      managedUsers={[]} accessRoles={[]} usageSummaries={usagePage()} aliases={[]}
      costAudit={null}
      canManageDocuments canAnswerQuestions canReadDebugRuns canReadBenchmarkRuns canOpenAdminSettings canReadUsers canReadUsage canReadCosts canManageAliases
      onOpenDocuments={callbacks[0]!} onOpenAssignee={callbacks[1]!} onOpenDebug={callbacks[2]!} onOpenBenchmark={callbacks[3]!}
      onOpenUsers={callbacks[4]!} onOpenRoles={callbacks[5]!} onOpenUsageCost={callbacks[6]!} onOpenAliases={callbacks[7]!}
    />)
    for (const name of ["ドキュメント管理", "担当者対応", "デバッグ / 評価", "性能テスト", "ユーザー管理", "アクセス管理", "利用状況", "用語展開管理"]) {
      await userEvent.click(screen.getByRole("button", { name: `${name}を開く` }))
    }
    callbacks.forEach((callback) => expect(callback).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: "コスト監査を開く" })).toHaveTextContent("利用不可")
  })

  it("cost panel は取得失敗・未確認・空明細・pricing未設定を正直に表示する", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const actions = { ...panelActions, onRefresh }
    const { rerender } = render(<AdminCostPanel costAudit={null} part={part("failed")} loading={false} {...actions} />)
    expect(screen.getByText("コスト監査を取得できませんでした。")).toBeInTheDocument()

    rerender(<AdminCostPanel costAudit={null} part={part()} loading={false} {...actions} />)
    expect(screen.getByText("コスト監査をまだ確認できません。")).toBeInTheDocument()

    rerender(<AdminCostPanel costAudit={costSummary()} part={part()} loading={false} {...actions} />)
    expect(screen.getByText("条件に一致する cost item はありません。")).toBeInTheDocument()
    expect(screen.getByText("未設定")).toBeInTheDocument()
  })

  it("cost panel は根拠付き明細と pricing 更新日を API 値から表示する", () => {
    const summary = costSummary({
      pricedCostUsd: 1,
      catalogVersions: ["v1"],
      completeness: { ...completeness, eventCount: 1, estimatedQuantityCount: 1 },
      items: [{
        eventId: "event-1", subjectId: "user-1", runId: "run-1", feature: "chat", provider: "bedrock", region: "ap-northeast-1",
        modelId: "model-1", unit: "input_token", quantity: 1000, measurementSource: "tokenizer_estimate", pricingState: "estimate",
        catalogVersion: "v1", priceSource: "approved-catalog", unitCostUsd: 0.001, costUsd: 1, occurredAt: asOf
      }]
    })
    render(<AdminCostPanel costAudit={summary} part={part()} loading {...panelActions} />)
    expect(screen.getByText("chat")).toBeInTheDocument()
    expect(screen.getByText("1000 (tokenizer_estimate)")).toBeInTheDocument()
    expect(screen.getByText("estimate / v1")).toBeInTheDocument()
    expect(screen.getByText(/approved-catalog/)).toBeInTheDocument()
  })

  it("usage panel は未確認・取得失敗・空・metric未提供を区別する", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const actions = { ...panelActions, onRefresh }
    const { rerender } = render(<AdminUsagePanel usageSummary={null} part={part()} loading={false} {...actions} />)
    expect(screen.getByText("利用状況をまだ確認できません。")).toBeInTheDocument()

    rerender(<AdminUsagePanel usageSummary={null} part={part("permission")} loading={false} {...actions} />)
    expect(screen.getByText("利用状況を取得できませんでした。")).toBeInTheDocument()

    rerender(<AdminUsagePanel usageSummary={usagePage()} part={part()} loading={false} {...actions} />)
    expect(screen.getByText("条件に一致する usage event はありません。")).toBeInTheDocument()

    const summary = usagePage({
      events: [{ schemaVersion: 1, eventId: "event-1", tenantId: "tenant-1", quantities: [{ unit: "input_token", source: "missing" }], status: "succeeded", idempotencyKey: "idem-1", occurredAt: asOf, recordedAt: asOf }],
      completeness: { ...completeness, eventCount: 1, missingQuantityCount: 1, unknownSubjectCount: 1, unknownRunCount: 1, unknownModelCount: 1, unknownFeatureCount: 1, state: "partial" }
    })
    rerender(<AdminUsagePanel usageSummary={summary} part={part()} loading={false} {...actions} />)
    expect(screen.getAllByText(/unknown/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("input_token: missing (missing)")).toBeInTheDocument()
  })

  it("usage panel は提供された zero と最終利用日時を欠損扱いにしない", () => {
    const summary = usagePage({
      events: [{ schemaVersion: 1, eventId: "event-zero", tenantId: "tenant-1", subjectId: "user-2", runId: "run-2", feature: "chat", provider: "bedrock", region: "ap-northeast-1", modelId: "model-1", quantities: [{ unit: "input_token", value: 0, source: "provider" }], status: "succeeded", idempotencyKey: "idem-zero", occurredAt: asOf, recordedAt: asOf }],
      completeness: { ...completeness, eventCount: 1, actualQuantityCount: 1 }
    })
    render(<AdminUsagePanel usageSummary={summary} part={part()} loading {...panelActions} />)
    const row = screen.getByRole("row", { name: /user-2/ })
    expect(within(row).getByText("input_token: 0 (provider)")).toBeInTheDocument()
    expect(within(row).queryByText(/missing|unknown/)).not.toBeInTheDocument()
  })

  it("role panel は未確認・取得失敗・空 catalog・permissionなしを区別する", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<AdminRolePanel accessRoleList={null} part={part()} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText("ロール定義をまだ確認できません。")).toBeInTheDocument()

    rerender(<AdminRolePanel accessRoleList={null} part={part("failed")} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText("ロール定義を取得できませんでした。")).toBeInTheDocument()

    const emptyList: AccessRoleList = { catalogVersion: "v1", source: "catalog", asOf, roles: [] }
    rerender(<AdminRolePanel accessRoleList={emptyList} part={part()} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText("ロール定義はありません。")).toBeInTheDocument()

    rerender(<AdminRolePanel accessRoleList={{ ...emptyList, roles: [{ role: "EMPTY", displayName: "権限なし", description: "権限を持ちません。", kind: "systemPreset", permissions: [] }] }} part={part()} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText("権限カテゴリ: なし")).toBeInTheDocument()
  })

  it("audit panel は無効filter・検索・解除・空・取得失敗を扱う", async () => {
    const onUrlStateChange = vi.fn()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const page: ManagedUserAuditLogPage = { auditLog: [], total: 0, truncated: false, source: "audit", asOf }
    const { rerender } = render(<AdminAuditPanel
      page={page} part={part()} loading={false} urlState={{ section: "audit", auditAction: "invalid" as never, query: " old " }}
      onUrlStateChange={onUrlStateChange} onRefresh={onRefresh} onLoadMore={onLoadMore}
      canExport={false} onCreateExport={vi.fn()}
    />)
    expect(screen.getByText("条件に一致する管理操作履歴はありません。")).toBeInTheDocument()
    const search = screen.getByRole("search", { name: "管理操作履歴を絞り込む" })
    await userEvent.clear(within(search).getByLabelText("対象・実行者を検索"))
    await userEvent.type(within(search).getByLabelText("対象・実行者を検索"), " target ")
    await userEvent.selectOptions(within(search).getByLabelText("操作"), "user:delete")
    await userEvent.click(within(search).getByRole("button", { name: "検索" }))
    expect(onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ query: "target", auditAction: undefined }), "push")
    await userEvent.click(within(search).getByRole("button", { name: "条件を解除" }))
    expect(onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ query: undefined, auditAction: undefined }), "push")

    rerender(<AdminAuditPanel page={null} part={part("permission")} loading={false} urlState={{ section: "audit" }} onUrlStateChange={onUrlStateChange} onRefresh={onRefresh} onLoadMore={onLoadMore} canExport={false} onCreateExport={vi.fn()} />)
    expect(screen.getByText("管理操作履歴を取得できませんでした。")).toBeInTheDocument()
  })

  it("audit panel は valid filter、actor ID fallback、summary、pagination を扱う", async () => {
    const onUrlStateChange = vi.fn()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const page: ManagedUserAuditLogPage = {
      auditLog: [{
        auditId: "audit-1",
        action: "user:suspend",
        actorUserId: "actor-1",
        targetUserId: "target-1",
        targetEmail: "target@example.com",
        beforeGroups: ["CHAT_USER"],
        afterGroups: ["CHAT_USER"],
        createdAt: asOf
      }],
      total: 3,
      nextCursor: "cursor-2",
      truncated: true,
      source: "audit-ledger",
      asOf
    }
    render(<AdminAuditPanel
      page={page} part={part()} loading={false} urlState={{ section: "audit", auditAction: "user:suspend" }}
      onUrlStateChange={onUrlStateChange} onRefresh={vi.fn().mockResolvedValue(undefined)} onLoadMore={onLoadMore}
      canExport={false} onCreateExport={vi.fn()}
    />)
    expect(screen.getByText("実行者: actor-1")).toBeInTheDocument()
    expect(screen.getByText("監査 ID:")).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText("操作"), "")
    expect(onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ auditAction: undefined }))
    await userEvent.click(screen.getByRole("button", { name: /次の履歴を読み込む/ }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })
})
