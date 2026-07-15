import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { AccessRoleList, AliasAuditLogItem, AliasAuditLogPage, AliasDefinition, AliasListPage, CostAuditSummary, ManagedUser, ManagedUserAuditLogPage, UsageSummaryPage } from "../types.js"
import type { AdminWorkspaceUrlState } from "../urlState.js"
import { AdminWorkspace } from "./AdminWorkspace.js"
import { appUiStateTargets } from "../../../app/uiStateTargets.js"
import { confirmedOperation } from "../../../shared/ui/operationOutcome.js"

const asOf = "2026-05-10T00:00:00.000Z"
const user: CurrentUser = { userId: "user-1", email: "admin@example.com", groups: ["SYSTEM_ADMIN"], permissions: [] }

const accessRoleList: AccessRoleList = {
  catalogVersion: "role-catalog-v2",
  source: "canonical-application-role-catalog",
  asOf,
  roles: [
    { role: "CHAT_USER", displayName: "チャット利用者", description: "チャットを利用します。", kind: "systemPreset", permissions: ["chat:create"] },
    { role: "COST_AUDITOR", displayName: "コスト監査担当", description: "コストを監査します。", kind: "systemPreset", permissions: ["cost:read:all", "cost:export"] },
    { role: "SYSTEM_ADMIN", displayName: "システム管理者", description: "システムを管理します。", kind: "systemPreset", permissions: ["user:read", "access:role:assign"] }
  ]
}

const aliases: AliasDefinition[] = [
  {
    aliasId: "alias-1",
    version: "alias-version-1",
    term: "pto",
    expansions: ["有給休暇", "休暇申請"],
    scope: { tenantId: "tenant-1", department: "総務部" },
    status: "draft",
    createdBy: "user-1",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z"
  },
  {
    aliasId: "alias-2",
    version: "alias-version-2",
    term: "slo",
    expansions: ["サービスレベル目標"],
    scope: { tenantId: "tenant-1" },
    status: "approved",
    createdBy: "user-1",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z"
  }
]

const aliasPage: AliasListPage = {
  aliases,
  total: 52,
  nextCursor: "alias-cursor-2",
  truncated: true,
  source: "alias-governance-ledger",
  asOf,
  version: "ledger-version-4"
}

const aliasAuditLog: AliasAuditLogItem[] = Array.from({ length: 10 }, (_, index) => ({
  auditId: `alias-audit-${index}`,
  aliasId: "alias-1",
  tenantId: "tenant-1",
  action: index === 0 ? "create" : "review",
  actorUserId: "user-1",
  result: "success",
  reason: index === 0 ? "用語登録" : `レビュー ${index}`,
  beforeStatus: index === 0 ? undefined : "draft",
  afterStatus: index === 0 ? "draft" : "approved",
  aliasVersion: `alias-version-${index + 1}`,
  createdAt: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
  detail: `audit detail ${index}`
}))

const aliasAuditPage: AliasAuditLogPage = {
  auditLog: aliasAuditLog,
  total: 75,
  nextCursor: "audit-cursor-2",
  truncated: true,
  source: "alias-governance-audit-ledger",
  asOf
}

const managedUser: ManagedUser = {
  userId: "managed-1",
  email: "managed@example.com",
  displayName: "管理対象ユーザー",
  status: "active",
  groups: ["CHAT_USER", "COST_AUDITOR"],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z"
}

const adminAuditPage: ManagedUserAuditLogPage = {
  auditLog: [{
    auditId: "admin-audit-1",
    action: "role:assign",
    actorUserId: "user-1",
    actorEmail: "admin@example.com",
    targetUserId: "managed-1",
    targetEmail: "managed@example.com",
    beforeGroups: ["CHAT_USER"],
    afterGroups: ["CHAT_USER", "COST_AUDITOR"],
    createdAt: asOf
  }],
  total: 61,
  nextCursor: "admin-audit-cursor-2",
  truncated: true,
  source: "admin-audit-ledger",
  asOf
}

const usageSummary: UsageSummaryPage = {
  query: { periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-06-01T00:00:00.000Z", limit: 50 },
  events: [{
    schemaVersion: 1, eventId: "usage-1", tenantId: "tenant-1", subjectId: "managed-1", runId: "run-1", feature: "chat", provider: "bedrock", region: "ap-northeast-1", modelId: "model-a",
    quantities: [{ unit: "input_token", value: 1200, source: "provider" }], status: "succeeded", idempotencyKey: "run-1:0", occurredAt: asOf, recordedAt: asOf
  }],
  truncated: false,
  asOf,
      source: "usage_event_store",
      rolloutMode: "active",
  completeness: { eventCount: 1, actualQuantityCount: 1, estimatedQuantityCount: 0, missingQuantityCount: 0, unknownSubjectCount: 0, unknownRunCount: 0, unknownModelCount: 0, unknownFeatureCount: 0, unpricedQuantityCount: 0, state: "complete" },
  breakdowns: { bySubject: [], byFeature: [], byProvider: [], byModel: [] }
}

const costAudit: CostAuditSummary = {
  query: usageSummary.query,
  currency: "USD",
  pricedCostUsd: 0.0000012,
  items: [{ eventId: "usage-1", subjectId: "managed-1", runId: "run-1", feature: "chat", provider: "bedrock", region: "ap-northeast-1", modelId: "model-a", unit: "input_token", quantity: 1200, measurementSource: "provider", pricingState: "actual", catalogVersion: "catalog-v1", priceSource: "approved-billing-sheet", unitCostUsd: 0.000000001, costUsd: 0.0000012, occurredAt: asOf }],
  truncated: false,
  asOf,
      source: "usage_event_store+versioned_price_catalog",
      rolloutMode: "active",
  catalogVersions: ["catalog-v1"],
  completeness: usageSummary.completeness
}

function readyDataState() {
  return {
    kind: "content" as const,
    target: appUiStateTargets.admin,
    asOf,
    parts: ["users", "roles", "audit", "usage", "cost", "aliases", "aliasAudit"].map((id) => ({
      id,
      label: id,
      status: "ready" as const,
      asOf
    }))
  }
}

function renderAdminWorkspace(overrides: Partial<Parameters<typeof AdminWorkspace>[0]> = {}) {
  const spies = {
    onUrlStateChange: vi.fn(),
    onAssignRoles: vi.fn().mockResolvedValue(confirmedOperation(managedUser)),
    onReviewAlias: vi.fn().mockResolvedValue(confirmedOperation({ ...aliases[0]!, status: "approved" as const, version: "alias-version-3" })),
    onTransitionAlias: vi.fn().mockResolvedValue(confirmedOperation({ ...aliases[1]!, status: "draft" as const, version: "alias-version-3" })),
    onDisableAlias: vi.fn().mockResolvedValue(confirmedOperation({ ...aliases[0]!, status: "disabled" as const, version: "alias-version-3" })),
    onPublishAliases: vi.fn().mockResolvedValue(confirmedOperation({ version: "published-1", publishedAt: asOf, aliasCount: 1 })),
    onCreateAlias: vi.fn().mockResolvedValue(confirmedOperation(aliases[0]!)),
    onUpdateAlias: vi.fn().mockResolvedValue(confirmedOperation(aliases[0]!)),
    onLoadMoreAliases: vi.fn().mockResolvedValue(undefined),
    onLoadMoreAliasAudit: vi.fn().mockResolvedValue(undefined),
    onLoadMoreAdminAudit: vi.fn().mockResolvedValue(undefined),
    onLoadMoreManagedUsers: vi.fn().mockResolvedValue(undefined),
    onRefreshAdminPart: vi.fn().mockResolvedValue(undefined)
  }
  const initialUrlState = overrides.urlState ?? {}

  function Harness() {
    const [urlState, setUrlState] = useState<AdminWorkspaceUrlState>(initialUrlState)
    const props: Parameters<typeof AdminWorkspace>[0] = {
      dataState: readyDataState(),
      user,
      documentsCount: 2,
      openQuestionsCount: 1,
      debugRunsCount: 3,
      benchmarkRunsCount: 4,
      managedUsers: [managedUser],
      managedUserPage: { users: [managedUser], total: 1, truncated: false, source: "authoritative_identity", asOf, version: "ledger-version-1" },
      adminAuditPage,
      accessRoleList,
      usageSummaries: usageSummary,
      costAudit,
      aliasPage,
      aliasAuditPage,
      loading: false,
      canManageDocuments: true,
      canAnswerQuestions: true,
      canReadDebugRuns: true,
      canReadBenchmarkRuns: true,
      canOpenAdminSettings: true,
      canReadUsers: true,
      canCreateUsers: true,
      canSuspendUsers: true,
      canUnsuspendUsers: true,
      canDeleteUsers: true,
      canAssignRoles: true,
      canReadUsage: true,
      canReadCosts: true,
      canReadAdminAuditLog: true,
      canManageAliases: true,
      canReadAliases: true,
      canWriteAliases: true,
      canReviewAliases: true,
      canDisableAliases: true,
      canPublishAliases: true,
      onOpenDocuments: vi.fn(),
      onOpenAssignee: vi.fn(),
      onOpenDebug: vi.fn(),
      onOpenBenchmark: vi.fn(),
      onCreateUser: vi.fn().mockResolvedValue(undefined),
      onAssignRoles: spies.onAssignRoles,
      onPrepareUserDelete: vi.fn().mockResolvedValue({ targetUserId: "managed-1", requiresSuccessor: false, ownedResources: { folders: 0, resourceGroups: 0, documents: 0, total: 0 }, eligibleSuccessors: [] }),
      onSetUserStatus: vi.fn().mockResolvedValue(confirmedOperation(managedUser)),
      onRefreshAdminData: vi.fn().mockResolvedValue(undefined),
      onRefreshAdminPart: spies.onRefreshAdminPart,
      onLoadMoreAdminAudit: spies.onLoadMoreAdminAudit,
      onLoadMoreManagedUsers: spies.onLoadMoreManagedUsers,
      onLoadMoreAliases: spies.onLoadMoreAliases,
      onLoadMoreAliasAudit: spies.onLoadMoreAliasAudit,
      onUrlStateChange: (nextState, mode) => {
        spies.onUrlStateChange(nextState, mode)
        setUrlState(nextState)
      },
      onCreateAlias: spies.onCreateAlias,
      onUpdateAlias: spies.onUpdateAlias,
      onReviewAlias: spies.onReviewAlias,
      onTransitionAlias: spies.onTransitionAlias,
      onDisableAlias: spies.onDisableAlias,
      onPublishAliases: spies.onPublishAliases,
      onBack: vi.fn(),
      ...overrides,
      urlState
    }
    return <AdminWorkspace {...props} />
  }

  render(<Harness />)
  return spies
}

describe("AdminWorkspace", () => {
  it("overview の permission-aware KPI から対応 section へ遷移する", async () => {
    const spies = renderAdminWorkspace()
    expect(screen.getByRole("button", { name: "ユーザー管理を開く" })).toHaveTextContent("1 人")
    expect(screen.getByRole("button", { name: "アクセス管理を開く" })).toHaveTextContent("3 件")
    expect(screen.getByRole("button", { name: "用語展開管理を開く" })).toHaveTextContent("2 件")

    await userEvent.click(screen.getByRole("button", { name: "ユーザー管理を開く" }))
    expect(screen.getByLabelText("ユーザー管理一覧")).toBeVisible()
    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ section: "users" }), "push")
  })

  it("Alias mutation は expected version と必須 reason を送り、client で状態を捏造しない", async () => {
    const spies = renderAdminWorkspace({ urlState: { section: "alias" } })
    const panel = screen.getByLabelText("用語展開管理一覧")

    await userEvent.click(within(panel).getByRole("button", { name: "ptoを承認" }))
    const reviewDialog = screen.getByRole("dialog", { name: "承認しますか？" })
    expect(within(reviewDialog).getByRole("button", { name: "承認" })).toBeDisabled()
    await userEvent.type(within(reviewDialog).getByLabelText("実行理由（必須）"), "運用用語として確認済み")
    await userEvent.click(within(reviewDialog).getByRole("button", { name: "承認" }))
    expect(spies.onReviewAlias).toHaveBeenCalledWith("alias-1", "approve", "alias-version-1", "運用用語として確認済み")

    await userEvent.click(within(panel).getByRole("button", { name: "sloを下書きへ戻す" }))
    const transitionDialog = screen.getByRole("dialog", { name: "下書きへ戻しますか？" })
    await userEvent.type(within(transitionDialog).getByLabelText("実行理由（必須）"), "内容更新が必要")
    await userEvent.click(within(transitionDialog).getByRole("button", { name: "下書きへ戻す" }))
    expect(spies.onTransitionAlias).toHaveBeenCalledWith("alias-2", "alias-version-2", "内容更新が必要")
  })

  it("Alias 公開は ledger version と理由を確認し、監査ログを固定件数で切らない", async () => {
    const spies = renderAdminWorkspace({ urlState: { section: "alias" } })
    expect(screen.getAllByText(/audit detail/)).toHaveLength(10)
    expect(screen.getByText("10 / 75 件")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /次の監査ログを読み込む/ }))
    expect(spies.onLoadMoreAliasAudit).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole("button", { name: "承認済み用語展開を公開" }))
    const dialog = screen.getByRole("dialog", { name: "承認済みの用語展開を公開しますか？" })
    await userEvent.type(within(dialog).getByLabelText("実行理由（必須）"), "検索辞書へ反映")
    await userEvent.click(within(dialog).getByRole("button", { name: "公開" }))
    expect(spies.onPublishAliases).toHaveBeenCalledWith("ledger-version-4", "検索辞書へ反映")
  })

  it("filter・sort・selection を URL state に反映する", async () => {
    const spies = renderAdminWorkspace({ urlState: { section: "alias", sort: "updatedDesc" } })
    const panel = screen.getByLabelText("用語展開管理一覧")
    await userEvent.type(within(panel).getByLabelText("用語・展開語を検索"), "休暇")
    await userEvent.selectOptions(within(panel).getByLabelText("状態"), "draft")
    await userEvent.selectOptions(within(panel).getByLabelText("並び順"), "termAsc")
    await userEvent.click(within(panel).getByRole("button", { name: "検索" }))
    await userEvent.click(within(panel).getByRole("button", { name: "ptoの監査ログを絞り込む" }))

    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ section: "alias", query: "休暇" }), "push")
    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ section: "alias", selected: "alias-1" }), undefined)
  })

  it("複数ロールの変更で既存ロールを落とさず before/after を確認する", async () => {
    const spies = renderAdminWorkspace({ urlState: { section: "users" } })
    const row = screen.getByRole("row", { name: /managed@example.com/ })
    const systemAdmin = within(row).getByRole("checkbox", { name: /システム管理者/ })
    expect(within(row).getByRole("checkbox", { name: /チャット利用者/ })).toBeChecked()
    expect(within(row).getByRole("checkbox", { name: /コスト監査担当/ })).toBeChecked()
    await userEvent.click(systemAdmin)
    await userEvent.type(within(row).getByLabelText("managed@example.comのロール変更理由"), "緊急対応のため追加")
    await userEvent.click(within(row).getByRole("button", { name: "managed@example.comのロール変更を確認" }))
    const dialog = screen.getByRole("dialog", { name: "ロール割り当てを変更しますか？" })
    expect(dialog).toHaveTextContent("CHAT_USER / COST_AUDITOR / SYSTEM_ADMIN")
    await userEvent.click(within(dialog).getByRole("button", { name: "変更" }))
    expect(spies.onAssignRoles).toHaveBeenCalledWith(
      "managed-1",
      ["CHAT_USER", "COST_AUDITOR", "SYSTEM_ADMIN"],
      "緊急対応のため追加"
    )
  })

  it("native table、対象付き操作名、panel ごとの source/as-of/refresh を提供する", async () => {
    const spies = renderAdminWorkspace({ urlState: { section: "users" } })
    expect(screen.getByRole("table", { name: "ユーザー一覧" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "managed@example.comの利用を停止" })).toBeInTheDocument()
    expect(screen.getByText("取得元: authoritative_identity")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "管理対象ユーザーを更新" }))
    expect(spies.onRefreshAdminPart).toHaveBeenCalledWith("users")

    await userEvent.click(screen.getByRole("button", { name: "利用状況・コスト" }))
    expect(screen.getByRole("table", { name: "利用状況" })).toBeInTheDocument()
  })

  it("shadow rollout は未計測を zero と装わず usage/cost export を公開しない", async () => {
    renderAdminWorkspace({
      urlState: { section: "usage-cost" },
      usageSummaries: { ...usageSummary, rolloutMode: "shadow", events: [], completeness: { ...usageSummary.completeness, eventCount: 0, actualQuantityCount: 0, state: "missing" } },
      costAudit: { ...costAudit, rolloutMode: "shadow", items: [], pricedCostUsd: 0, completeness: { ...costAudit.completeness, eventCount: 0, actualQuantityCount: 0, state: "missing" } },
      canExportUsage: true,
      canExportCosts: true,
      onCreateUsageExport: vi.fn(),
      onCreateCostExport: vi.fn()
    })

    expect(screen.getAllByText(/usage accounting は shadow mode/)).toHaveLength(2)
    expect(screen.getByText(/価格監査と export は active cutover まで利用できません/)).toBeInTheDocument()
    expect(screen.queryByRole("form", { name: "現在の利用状況条件を export" })).not.toBeInTheDocument()
    expect(screen.queryByRole("form", { name: "現在のコスト条件を export" })).not.toBeInTheDocument()
    expect(screen.getByText(/0 件は計測済み zero を意味しません/)).toBeInTheDocument()
  })

  it("対象行の mutation 中も別ユーザーの操作を無効化しない", () => {
    const second = { ...managedUser, userId: "managed-2", email: "second@example.com", displayName: "Second" }
    renderAdminWorkspace({
      urlState: { section: "users" },
      managedUsers: [managedUser, second],
      managedUserPage: { users: [managedUser, second], total: 2, truncated: false, source: "authoritative_identity", asOf, version: "ledger-version-1" },
      pendingAdminMutationKeys: ["status:managed-1"]
    })

    expect(screen.getByRole("button", { name: "managed@example.comの利用を停止" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "second@example.comの利用を停止" })).toBeEnabled()
  })

  it("server capability blocker と projection 再調整状態を操作可否へ反映する", () => {
    const blockedUser: ManagedUser = {
      ...managedUser,
      status: "suspended",
      effectivePermissions: [],
      capability: {
        canAssignRoles: false,
        canSuspend: false,
        canUnsuspend: false,
        canDelete: false,
        blockers: ["self_mutation", "target_inactive", "last_recovery_principal", "policy_denied"]
      },
      projection: { source: "local_ledger", asOf, reconciliationState: "pending" }
    }
    renderAdminWorkspace({
      urlState: { section: "users" },
      managedUsers: [blockedUser],
      managedUserPage: { users: [blockedUser], total: 1, truncated: false, source: "local_ledger", asOf, version: "ledger-version-2" }
    })
    const row = screen.getByRole("row", { name: /managed@example.com/ })
    expect(within(row).getByText(/正本: ローカル台帳 \/ 同期: 要再調整/)).toBeInTheDocument()
    expect(within(row).getByText(/自分自身は変更不可 \/ 停止中の対象 \/ 最後の復旧管理者 \/ policy_denied/)).toBeInTheDocument()
    expect(within(row).getByText("有効 permission: 0 件")).toBeInTheDocument()
    expect(within(row).getByText("利用可能な操作はありません")).toBeInTheDocument()
  })

  it("ユーザー query・状態・sort と cursor pagination を URL/API 境界へ渡す", async () => {
    const spies = renderAdminWorkspace({
      urlState: { section: "users", userSort: "emailAsc" },
      managedUserPage: { users: [managedUser], total: 3, nextCursor: "user-cursor-2", truncated: true, source: "authoritative_identity", asOf, version: "ledger-version-1" }
    })
    const panel = screen.getByLabelText("ユーザー管理一覧")
    await userEvent.type(within(panel).getByLabelText("ユーザー・ロールを検索"), "  finance  ")
    await userEvent.selectOptions(within(panel).getByLabelText("状態"), "suspended")
    await userEvent.selectOptions(within(panel).getByLabelText("並び順"), "updatedDesc")
    await userEvent.click(within(panel).getByRole("button", { name: "検索" }))
    await userEvent.click(within(panel).getByRole("button", { name: /次のユーザーを読み込む/ }))

    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ section: "users", userStatus: "suspended" }), "push")
    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ section: "users", userSort: "updatedDesc" }), "push")
    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ section: "users", query: "finance" }), "push")
    expect(spies.onLoadMoreManagedUsers).toHaveBeenCalledTimes(1)
  })

  it("ロールの日本語 metadata と raw ID、resource group との概念差を表示する", () => {
    renderAdminWorkspace({ urlState: { section: "roles" } })
    const panel = screen.getByLabelText("アプリケーションロール定義")
    expect(within(panel).getByText("チャット利用者")).toBeInTheDocument()
    expect(within(panel).getByText("CHAT_USER")).toBeInTheDocument()
    expect(within(panel).getByText(/リソースグループは文書へのアクセス範囲を表す別の概念/)).toBeInTheDocument()
    expect(within(panel).getByText(/権限カテゴリ: chat/)).toBeInTheDocument()
  })

  it("管理監査を page metadata 付きで表示し load more を行う", async () => {
    const spies = renderAdminWorkspace({ urlState: { section: "audit" } })
    expect(screen.getByText("1 / 61 件")).toBeInTheDocument()
    expect(screen.getByText("取得元: admin-audit-ledger")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /次の履歴を読み込む/ }))
    expect(spies.onLoadMoreAdminAudit).toHaveBeenCalledTimes(1)
  })

  it("監査 export は専用 capability と必須理由で現在の query を要求する", async () => {
    const onCreateAdminAuditExport = vi.fn().mockResolvedValue({
      exportType: "audit_log",
      url: "https://example.com/export",
      expiresInSeconds: 300,
      objectKey: "downloads/tenant-1/audit.json",
      generatedAt: asOf,
      redaction: { policyVersion: "admin-export-redaction-v1", redactedFields: ["credentials"], notes: [] }
    })
    renderAdminWorkspace({
      urlState: { section: "audit", query: "denied" },
      canExportAdminAuditLog: true,
      onCreateAdminAuditExport
    })
    const button = screen.getByRole("button", { name: "現在の条件を export" })
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText("export 理由（必須）"), "四半期 access review")
    await userEvent.click(button)
    expect(onCreateAdminAuditExport).toHaveBeenCalledWith("四半期 access review")
    expect(await screen.findByRole("link", { name: "有効期限内に取得" })).toHaveAttribute("href", "https://example.com/export")
  })

  it("resource ごとの failure を data と混同せず overview に反映する", () => {
    renderAdminWorkspace({
      dataState: {
        ...readyDataState(),
        parts: readyDataState().parts.map((part) => ({ ...part, status: "failed" as const }))
      }
    })
    expect(screen.getAllByText("取得失敗").length).toBeGreaterThanOrEqual(5)
    expect(screen.getAllByText("状態メッセージから再試行できます")).toHaveLength(5)
  })

  it("利用できない deep link を overview へ戻し、権限未取得と処理中を正直に示す", async () => {
    const onBack = vi.fn()
    renderAdminWorkspace({
      urlState: { section: "users" }, user: null, loading: true,
      canManageDocuments: false, canAnswerQuestions: false, canReadDebugRuns: false, canReadBenchmarkRuns: false,
      canOpenAdminSettings: false, canReadUsers: false, canReadUsage: false, canReadCosts: false,
      canReadAdminAuditLog: false, canManageAliases: false, canReadAliases: false,
      onBack
    })
    expect(screen.getByText("権限未取得")).toBeInTheDocument()
    expect(screen.getByText("表示できる管理 summary はありません。")).toBeInTheDocument()
    expect(screen.getByText("管理 API を処理中")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "チャットへ戻る" }))
    expect(onBack).toHaveBeenCalled()
  })

  it.each([
    ["audit" as const, "publish" as const, "監査"],
    ["alias" as const, "role:assign" as const, "用語展開"]
  ])("%s section へ移ると別 ledger の action filter を除去する", async (_section, auditAction, buttonName) => {
    const spies = renderAdminWorkspace({ urlState: { section: "overview", auditAction } })
    await userEvent.click(screen.getByRole("button", { name: buttonName }))
    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ auditAction: undefined }), "push")
  })

  it("監査 export 失敗を監査一覧と混同せず表示する", async () => {
    renderAdminWorkspace({
      urlState: { section: "audit" },
      canExportAdminAuditLog: true,
      onCreateAdminAuditExport: vi.fn().mockRejectedValue(new Error("export service unavailable"))
    })
    await userEvent.type(screen.getByLabelText("export 理由（必須）"), "障害調査")
    await userEvent.click(screen.getByRole("button", { name: "現在の条件を export" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("export service unavailable")
    expect(screen.getByText("1 / 61 件")).toBeInTheDocument()
  })

  it("監査 export の非 Error rejection を安全な文言へ変換する", async () => {
    renderAdminWorkspace({
      urlState: { section: "audit" },
      canExportAdminAuditLog: true,
      onCreateAdminAuditExport: vi.fn().mockRejectedValue("network-down")
    })
    await userEvent.type(screen.getByLabelText("export 理由（必須）"), "定例監査")
    await userEvent.click(screen.getByRole("button", { name: "現在の条件を export" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("監査 export を作成できませんでした。")
  })

  it("権限外 section を overview へ正規化し、取得前の actor と summary を捏造しない", () => {
    renderAdminWorkspace({
      user: null,
      urlState: { section: "alias" },
      documentsCount: null,
      openQuestionsCount: null,
      debugRunsCount: null,
      benchmarkRunsCount: null,
      managedUsers: null,
      adminAuditPage: null,
      accessRoleList: null,
      usageSummaries: null,
      costAudit: null,
      aliasPage: null,
      aliasAuditPage: null,
      canManageDocuments: false,
      canAnswerQuestions: false,
      canReadDebugRuns: false,
      canReadBenchmarkRuns: false,
      canOpenAdminSettings: false,
      canReadUsers: false,
      canCreateUsers: false,
      canSuspendUsers: false,
      canUnsuspendUsers: false,
      canDeleteUsers: false,
      canAssignRoles: false,
      canReadUsage: false,
      canReadCosts: false,
      canReadAdminAuditLog: false,
      canManageAliases: false,
      canReadAliases: false,
      canWriteAliases: false,
      canReviewAliases: false,
      canDisableAliases: false,
      canPublishAliases: false
    })
    expect(screen.getByText("権限未取得")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "概要" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("button", { name: "用語展開" })).not.toBeInTheDocument()
    expect(screen.getByText("表示できる管理 summary はありません。")).toBeInTheDocument()
  })

  it("part 単位の permission/failed は旧成功 data を隠して再試行状態を表示する", () => {
    renderAdminWorkspace({
      dataState: {
        kind: "content",
        target: appUiStateTargets.admin,
        asOf,
        parts: [
          { id: "users", label: "users", status: "permission" },
          { id: "roles", label: "roles", status: "failed" },
          { id: "audit", label: "audit", status: "failed" },
          { id: "usage", label: "usage", status: "permission" },
          { id: "cost", label: "cost", status: "failed" },
          { id: "aliases", label: "aliases", status: "permission" },
          { id: "aliasAudit", label: "aliasAudit", status: "failed" }
        ]
      }
    })
    expect(screen.getByRole("button", { name: "ユーザー管理を開く" })).toHaveTextContent("取得失敗")
    expect(screen.getByRole("button", { name: "アクセス管理を開く" })).toHaveTextContent("取得失敗")
    expect(screen.getByRole("button", { name: "利用状況を開く" })).toHaveTextContent("取得失敗")
    expect(screen.getByRole("button", { name: "コスト監査を開く" })).toHaveTextContent("取得失敗")
    expect(screen.getByRole("button", { name: "用語展開管理を開く" })).toHaveTextContent("取得失敗")
  })

  it("section 遷移時に domain 外 filter を除去する", async () => {
    const spies = renderAdminWorkspace({
      urlState: { section: "overview", aliasStatus: "draft", sort: "termAsc", selected: "alias-1", auditAction: "review" }
    })
    await userEvent.click(screen.getByRole("button", { name: "ユーザー" }))
    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({
      section: "users",
      aliasStatus: undefined,
      sort: undefined,
      selected: undefined,
      auditAction: "review"
    }), "push")

    await userEvent.click(screen.getByRole("button", { name: "監査" }))
    expect(spies.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ section: "audit", auditAction: undefined }), "push")

    await userEvent.selectOptions(screen.getByLabelText("操作"), "user:create")
    await userEvent.click(screen.getByRole("button", { name: "用語展開" }))
    expect(spies.onUrlStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ section: "alias", auditAction: undefined }), "push")
  })
})
