import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { AccessRoleDefinition, AliasAuditLogItem, AliasDefinition, CostAuditSummary, ManagedUser, UsageSummaryResponse, UserUsageSummary } from "../types.js"
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
  chatRequestCount: 3,
  llmCallCount: 2,
  inputTokens: 1200,
  outputTokens: 300,
  totalTokens: 1500,
  estimatedCostUsd: 0.00168,
  actualTokenEventCount: 0,
  estimatedTokenEventCount: 2,
  missingTokenEventCount: 0,
  conversationCount: 2,
  questionCount: 1,
  documentCount: 4,
  benchmarkRunCount: 0,
  debugRunCount: 1
}

const missingUsageSummary: UserUsageSummary = {
  ...usageSummary,
  userId: "missing-usage",
  email: "missing@example.com",
  chatMessages: 1,
  chatRequestCount: 1,
  llmCallCount: 1,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
  actualTokenEventCount: 0,
  estimatedTokenEventCount: 0,
  missingTokenEventCount: 1
}

const idleUsageSummary: UserUsageSummary = {
  ...usageSummary,
  userId: "idle-usage",
  email: "idle@example.com",
  chatMessages: 0,
  chatRequestCount: 0,
  llmCallCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
  actualTokenEventCount: 0,
  estimatedTokenEventCount: 0,
  missingTokenEventCount: 0
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
  pricingVersion: "bedrock-2026-06-local-v1",
  pricingCatalogUpdatedAt: "2026-05-01T00:00:00.000Z",
  dataCompleteness: {
    actualTokenEventCount: 0,
    estimatedTokenEventCount: 2,
    missingTokenEventCount: 0
  }
}

const usageSummaryResponse: UsageSummaryResponse = {
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T00:00:00.000Z",
  users: [usageSummary],
  breakdowns: {
    byFeature: [
      {
        key: "rag.generate_answer",
        label: "rag.generate_answer",
        inputTokens: 1000,
        outputTokens: 250,
        totalTokens: 1250,
        estimatedCostUsd: 0.0014,
        actualTokenEventCount: 0,
        estimatedTokenEventCount: 1,
        missingTokenEventCount: 0
      }
    ],
    byModel: [
      {
        key: "amazon.nova-lite-v1:0",
        label: "amazon.nova-lite-v1:0",
        inputTokens: 1200,
        outputTokens: 300,
        totalTokens: 1500,
        estimatedCostUsd: 0.00168,
        actualTokenEventCount: 0,
        estimatedTokenEventCount: 2,
        missingTokenEventCount: 0
      }
    ],
    byGroup: [
      {
        key: "SYSTEM_ADMIN",
        label: "SYSTEM_ADMIN",
        inputTokens: 1200,
        outputTokens: 300,
        totalTokens: 1500,
        estimatedCostUsd: 0.00168,
        actualTokenEventCount: 0,
        estimatedTokenEventCount: 2,
        missingTokenEventCount: 0
      }
    ]
  },
  totals: {
    inputTokens: 1200,
    outputTokens: 300,
    totalTokens: 1500,
    estimatedCostUsd: 0.00168
  },
  dataCompleteness: {
    actualTokenEventCount: 0,
    estimatedTokenEventCount: 2,
    missingTokenEventCount: 0
  }
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
    usageSummary: null,
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
    onExportAdminAuditLog: vi.fn().mockResolvedValue(undefined),
    onExportCostSummary: vi.fn().mockResolvedValue(undefined),
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
    expect(screen.getAllByText("未計測または利用なし").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("コスト summary は未提供です。")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Audit" }))
    expect(screen.getByText(/横断 audit と reason は未提供です。/)).toBeInTheDocument()
    expect(screen.getByText("管理操作履歴はありません。")).toBeInTheDocument()
  })

  it("usage/cost で推定、未計測、利用なしを区別して表示する", async () => {
    const onExportCostSummary = vi.fn().mockResolvedValue(undefined)
    renderAdminWorkspace({
      canReadUsage: true,
      canReadCosts: true,
      usageSummaries: [usageSummary, missingUsageSummary, idleUsageSummary],
      usageSummary: {
        ...usageSummaryResponse,
        users: [usageSummary, missingUsageSummary, idleUsageSummary],
        dataCompleteness: {
          actualTokenEventCount: 0,
          estimatedTokenEventCount: 2,
          missingTokenEventCount: 1
        }
      },
      costAudit: {
        ...costAudit,
        dataCompleteness: {
          actualTokenEventCount: 0,
          estimatedTokenEventCount: 2,
          missingTokenEventCount: 1
        },
        items: [
          ...costAudit.items,
          {
            service: "bedrock",
            category: "chat missing",
            usage: 0,
            unit: "tokens",
            unitCostUsd: 0,
            estimatedCostUsd: 0,
            confidence: "missing_usage",
            pricingVersion: "bedrock-2026-06-local-v1"
          }
        ]
      },
      onExportCostSummary
    })

    await userEvent.click(screen.getByRole("button", { name: "Usage / Cost" }))

    expect(screen.getAllByText("推定 2").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("一部未計測 1").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText("1,500 tokens").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText("機能別")).toHaveTextContent("rag.generate_answer")
    expect(screen.getByLabelText("モデル別")).toHaveTextContent("amazon.nova-lite-v1:0")
    expect(screen.getByLabelText("グループ別")).toHaveTextContent("SYSTEM_ADMIN")
    expect(screen.getAllByText("$0.0017").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("未計測または利用なし").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("一部未計測: 1")).toBeInTheDocument()
    expect(screen.getByText("version: bedrock-2026-06-local-v1")).toBeInTheDocument()
    expect(screen.getByText("未計測")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "コスト summary をエクスポート" }))
    expect(onExportCostSummary).toHaveBeenCalledTimes(1)
  })

  it("audit export 操作を通知する", async () => {
    const onExportAdminAuditLog = vi.fn().mockResolvedValue(undefined)
    renderAdminWorkspace({
      canReadAdminAuditLog: true,
      adminAuditLog: [
        {
          auditId: "audit-1",
          action: "user:create",
          actorUserId: "admin",
          targetUserId: "managed-1",
          targetEmail: "managed@example.com",
          beforeGroups: [],
          afterGroups: ["CHAT_USER"],
          createdAt: "2026-05-01T00:00:00.000Z"
        }
      ],
      onExportAdminAuditLog
    })

    await userEvent.click(screen.getByRole("button", { name: "Audit" }))
    expect(screen.getByText(/横断 audit と reason は未提供です。/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "監査ログをエクスポート" }))
    expect(onExportAdminAuditLog).toHaveBeenCalledTimes(1)
  })
})
