import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { AccessRoleDefinition, AliasAuditLogItem, AliasDefinition, CostAuditSummary, ManagedUser, UserUsageSummary } from "../types.js"
import { AdminWorkspace } from "./AdminWorkspace.js"

const user: CurrentUser = {
  userId: "user-1",
  email: "admin@example.com",
  groups: ["SYSTEM_ADMIN"],
  permissions: []
}

const roles: AccessRoleDefinition[] = [
  {
    role: "CHAT_USER",
    permissions: ["chat:create"]
  },
  {
    role: "SYSTEM_ADMIN",
    permissions: ["user:read", "access:role:assign"]
  }
]

const aliases: AliasDefinition[] = [
  {
    aliasId: "alias-1",
    term: "pto",
    expansions: ["有給休暇", "休暇申請"],
    scope: { department: "総務部" },
    status: "draft",
    createdBy: "user-1",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z"
  },
  {
    aliasId: "alias-2",
    term: "slo",
    expansions: ["サービスレベル目標"],
    status: "approved",
    createdBy: "user-1",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
    publishedVersion: "alias-v1"
  }
]

const aliasAuditLog: AliasAuditLogItem[] = [
  {
    auditId: "audit-1",
    aliasId: "alias-1",
    action: "create",
    actorUserId: "user-1",
    createdAt: "2026-05-02T00:00:00.000Z",
    detail: "created alias"
  }
]

const managedUser: ManagedUser = {
  userId: "managed-1",
  email: "managed@example.com",
  displayName: "管理対象ユーザー",
  status: "active",
  groups: ["CHAT_USER"],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z"
}

const usageSummary: UserUsageSummary = {
  userId: "managed-1",
  email: "managed@example.com",
  displayName: "管理対象ユーザー",
  chatMessages: 3,
  conversationCount: 2,
  questionCount: 1,
  documentCount: 4,
  benchmarkRunCount: 0,
  debugRunCount: 1
}

const costAudit: CostAuditSummary = {
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T00:00:00.000Z",
  currency: "USD",
  totalEstimatedUsd: 12.34,
  items: [
    {
      service: "bedrock",
      category: "chat",
      usage: 1200,
      unit: "tokens",
      unitCostUsd: 0.001,
      estimatedCostUsd: 1.2,
      confidence: "estimated_usage"
    }
  ],
  users: [{ userId: "managed-1", email: "managed@example.com", estimatedCostUsd: 1.2 }],
  pricingCatalogUpdatedAt: "2026-05-01T00:00:00.000Z"
}

function renderAdminWorkspace(overrides: Partial<Parameters<typeof AdminWorkspace>[0]> = {}) {
  const props: Parameters<typeof AdminWorkspace>[0] = {
    user,
    documentsCount: 2,
    openQuestionsCount: 1,
    debugRunsCount: 3,
    benchmarkRunsCount: 4,
    managedUsers: [],
    adminAuditLog: [],
    accessRoles: roles,
    usageSummaries: [],
    costAudit: null,
    aliases,
    aliasAuditLog,
    loading: false,
    canManageDocuments: true,
    canAnswerQuestions: true,
    canReadDebugRuns: true,
    canReadBenchmarkRuns: true,
    canOpenAdminSettings: true,
    canReadUsers: false,
    canCreateUsers: false,
    canSuspendUsers: false,
    canUnsuspendUsers: false,
    canDeleteUsers: false,
    canAssignRoles: false,
    canReadUsage: false,
    canReadCosts: false,
    canReadAdminAuditLog: false,
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
    onAssignRoles: vi.fn().mockResolvedValue(undefined),
    onSetUserStatus: vi.fn().mockResolvedValue(undefined),
    onRefreshAdminData: vi.fn().mockResolvedValue(undefined),
    onCreateAlias: vi.fn().mockResolvedValue(undefined),
    onUpdateAlias: vi.fn().mockResolvedValue(undefined),
    onReviewAlias: vi.fn().mockResolvedValue(undefined),
    onDisableAlias: vi.fn().mockResolvedValue(undefined),
    onPublishAliases: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
    ...overrides
  }

  render(<AdminWorkspace {...props} />)
  return props
}

describe("AdminWorkspace", () => {
  it("overview で action card と read-only KPI を分けて表示する", () => {
    renderAdminWorkspace({
      managedUsers: [managedUser],
      canReadUsers: true,
      canReadUsage: true,
      canReadCosts: true,
      usageSummaries: [usageSummary],
      costAudit
    })

    expect(screen.getByRole("button", { name: /ドキュメント管理/ })).toBeInTheDocument()
    expect(screen.getByLabelText("ユーザー管理")).toHaveTextContent("1 users")
    expect(screen.getByLabelText("コスト監査")).toHaveTextContent("$12.3400")
    expect(screen.queryByRole("button", { name: /ユーザー管理/ })).not.toBeInTheDocument()
  })

  it("overview は API field が未提供の action card と count を表示しない", () => {
    renderAdminWorkspace({
      documentsCount: null,
      openQuestionsCount: null,
      debugRunsCount: null,
      benchmarkRunsCount: null,
      managedUsers: null,
      accessRoles: null,
      usageSummaries: null,
      aliases: null,
      canReadUsers: true,
      canReadUsage: true
    })

    expect(screen.queryByRole("button", { name: /ドキュメント管理/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /担当者対応/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /デバッグ/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /性能テスト/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText("ユーザー管理")).toHaveTextContent("未提供")
    expect(screen.getByLabelText("アクセス管理")).toHaveTextContent("ロール定義 API field は未提供")
    expect(screen.getByLabelText("Alias管理")).toHaveTextContent("Alias API field は未提供")
    expect(screen.queryByText("0 users")).not.toBeInTheDocument()
    expect(screen.queryByText("0 aliases")).not.toBeInTheDocument()
  })

  it("Alias 管理を表示し、作成と公開操作を通知する", async () => {
    const onCreateAlias = vi.fn().mockResolvedValue(undefined)
    const onPublishAliases = vi.fn().mockResolvedValue(undefined)

    renderAdminWorkspace({ onCreateAlias, onPublishAliases })
    await userEvent.click(screen.getByRole("button", { name: "Alias" }))

    const panel = screen.getByLabelText("Alias管理一覧")
    expect(panel).toHaveTextContent("2 件")
    expect(within(panel).getByText("pto")).toBeInTheDocument()
    expect(within(panel).getByText("create")).toBeInTheDocument()

    await userEvent.type(within(panel).getByLabelText("用語"), "rto")
    await userEvent.type(within(panel).getByLabelText("展開語"), "復旧時間目標, 障害復旧")
    await userEvent.type(within(panel).getByLabelText("部署 scope"), "SRE")
    await userEvent.click(within(panel).getByRole("button", { name: "追加" }))
    await userEvent.click(within(panel).getByRole("button", { name: "公開" }))
    const dialog = screen.getByRole("dialog", { name: "Alias を公開しますか？" })
    expect(dialog).toHaveTextContent("承認済み")
    expect(onPublishAliases).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "公開" }))

    expect(onCreateAlias).toHaveBeenCalledWith({
      term: "rto",
      expansions: ["復旧時間目標", "障害復旧"],
      scope: { department: "SRE" }
    })
    expect(onPublishAliases).toHaveBeenCalledTimes(1)
  })

  it("Alias API field 未提供または公開対象なしでは公開 control を表示しない", async () => {
    renderAdminWorkspace({ aliases: null, aliasAuditLog: null })
    await userEvent.click(screen.getByRole("button", { name: "Alias" }))

    expect(screen.getByText("Alias API field は未提供です。")).toBeInTheDocument()
    expect(screen.getByText("Alias監査ログ API field は未提供です。")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "公開" })).not.toBeInTheDocument()

    cleanup()
    renderAdminWorkspace({ aliases: aliases.filter((alias) => alias.status !== "approved"), aliasAuditLog: [] })
    await userEvent.click(screen.getByRole("button", { name: "Alias" }))
    expect(screen.queryByRole("button", { name: "公開" })).not.toBeInTheDocument()
  })

  it("Alias の下書き化、承認、差戻、無効化操作を通知する", async () => {
    const onUpdateAlias = vi.fn().mockResolvedValue(undefined)
    const onReviewAlias = vi.fn().mockResolvedValue(undefined)
    const onDisableAlias = vi.fn().mockResolvedValue(undefined)

    renderAdminWorkspace({ onUpdateAlias, onReviewAlias, onDisableAlias })
    await userEvent.click(screen.getByRole("button", { name: "Alias" }))

    const panel = screen.getByLabelText("Alias管理一覧")

    await userEvent.click(within(panel).getAllByRole("button", { name: "下書き化" })[0]!)
    await userEvent.click(within(panel).getAllByRole("button", { name: "承認" })[0]!)
    await userEvent.click(within(panel).getAllByRole("button", { name: "差戻" })[0]!)
    await userEvent.click(within(panel).getAllByRole("button", { name: "無効" })[0]!)
    const dialog = screen.getByRole("dialog", { name: "この alias を無効化しますか？" })
    expect(dialog).toHaveTextContent("pto")
    expect(onDisableAlias).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "無効化" }))

    expect(onUpdateAlias).toHaveBeenCalledWith("alias-1", { expansions: ["有給休暇", "休暇申請"] })
    expect(onReviewAlias).toHaveBeenCalledWith("alias-1", "approve")
    expect(onReviewAlias).toHaveBeenCalledWith("alias-1", "reject", "Rejected from UI")
    expect(onDisableAlias).toHaveBeenCalledWith("alias-1")
  })

  it("ユーザー停止と削除は確認後に実行する", async () => {
    const onSetUserStatus = vi.fn().mockResolvedValue(undefined)

    renderAdminWorkspace({
      managedUsers: [managedUser],
      canReadUsers: true,
      canSuspendUsers: true,
      canDeleteUsers: true,
      onSetUserStatus
    })
    await userEvent.click(screen.getByRole("button", { name: "Users" }))

    await userEvent.click(screen.getByRole("button", { name: "停止" }))
    const suspendDialog = screen.getByRole("dialog", { name: "このユーザーを停止しますか？" })
    expect(suspendDialog).toHaveTextContent("managed@example.com")
    expect(onSetUserStatus).not.toHaveBeenCalled()
    await userEvent.click(within(suspendDialog).getByRole("button", { name: "停止" }))
    expect(onSetUserStatus).toHaveBeenCalledWith("managed-1", "suspend")

    await userEvent.click(screen.getByRole("button", { name: "削除" }))
    const deleteDialog = screen.getByRole("dialog", { name: "このユーザーを削除状態にしますか？" })
    expect(deleteDialog).toHaveTextContent("管理対象ユーザー")
    await userEvent.click(within(deleteDialog).getByRole("button", { name: "削除" }))
    expect(onSetUserStatus).toHaveBeenCalledWith("managed-1", "delete")
  })

  it("ロール付与前に変更前後の差分を表示する", async () => {
    const onAssignRoles = vi.fn().mockResolvedValue(undefined)

    renderAdminWorkspace({
      managedUsers: [managedUser],
      canReadUsers: true,
      canAssignRoles: true,
      onAssignRoles
    })
    await userEvent.click(screen.getByRole("button", { name: "Users" }))

    await userEvent.selectOptions(screen.getByLabelText("managed@example.comに付与するロール"), "SYSTEM_ADMIN")
    expect(screen.getByText("変更前: CHAT_USER / 変更後: SYSTEM_ADMIN")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "付与" }))
    const dialog = screen.getByRole("dialog", { name: "ロールを付与しますか？" })
    expect(dialog).toHaveTextContent("変更前")
    expect(dialog).toHaveTextContent("SYSTEM_ADMIN")
    expect(dialog).toHaveTextContent("理由入力と保存は API 未対応")
    expect(onAssignRoles).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "付与" }))

    expect(onAssignRoles).toHaveBeenCalledWith("managed-1", ["SYSTEM_ADMIN"])
  })

  it("ロール API field が未提供のとき fake group を作成・付与しない", async () => {
    const onCreateUser = vi.fn().mockResolvedValue(undefined)
    const onAssignRoles = vi.fn().mockResolvedValue(undefined)

    renderAdminWorkspace({
      managedUsers: [{ ...managedUser, groups: [] }],
      accessRoles: null,
      canReadUsers: true,
      canCreateUsers: true,
      canAssignRoles: true,
      onCreateUser,
      onAssignRoles
    })
    await userEvent.click(screen.getByRole("button", { name: "Users" }))

    expect(screen.getAllByText("未提供").length).toBeGreaterThan(0)
    expect(screen.getByText("ロール定義は未提供")).toBeInTheDocument()
    expect(screen.queryByLabelText("managed@example.comに付与するロール")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "付与" })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("メール"), "new@example.com")
    await userEvent.click(screen.getByRole("button", { name: "作成" }))

    expect(onCreateUser).toHaveBeenCalledWith({
      email: "new@example.com",
      displayName: undefined,
      groups: undefined
    })
    expect(onAssignRoles).not.toHaveBeenCalled()
  })

  it("usage/cost/audit の未提供と空状態を正直に表示する", async () => {
    renderAdminWorkspace({
      canReadUsage: true,
      canReadCosts: true,
      canReadAdminAuditLog: true,
      usageSummaries: [],
      costAudit: null,
      adminAuditLog: []
    })

    await userEvent.click(screen.getByRole("button", { name: "Usage / Cost" }))
    expect(screen.getByText("利用状況はありません。")).toBeInTheDocument()
    expect(screen.getByText("コスト summary は未提供です。")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Audit" }))
    expect(screen.getByText(/横断 audit、reason、export は未提供です。/)).toBeInTheDocument()
    expect(screen.getByText("管理操作履歴はありません。")).toBeInTheDocument()
  })

  it("usage/audit API field 未提供を空件数に変換しない", async () => {
    renderAdminWorkspace({
      canReadUsage: true,
      canReadAdminAuditLog: true,
      usageSummaries: null,
      adminAuditLog: null
    })

    await userEvent.click(screen.getByRole("button", { name: "Usage / Cost" }))
    expect(screen.getByText("利用状況 API field は未提供です。")).toBeInTheDocument()
    expect(screen.queryByText("0 users")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Audit" }))
    expect(screen.getByText("管理操作履歴 API field は未提供です。")).toBeInTheDocument()
    expect(screen.queryByText("0 件")).not.toBeInTheDocument()
  })
})
