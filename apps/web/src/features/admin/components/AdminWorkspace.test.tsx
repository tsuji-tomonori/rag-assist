import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { AccessRoleDefinition, AliasAuditLogItem, AliasDefinition, ManagedUser } from "../types.js"
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
  it("Alias 管理を表示し、作成と公開操作を通知する", async () => {
    const onCreateAlias = vi.fn().mockResolvedValue(undefined)
    const onPublishAliases = vi.fn().mockResolvedValue(undefined)

    renderAdminWorkspace({ onCreateAlias, onPublishAliases })

    expect(screen.getByLabelText("Alias管理")).toHaveTextContent("2 aliases")
    const panel = screen.getByLabelText("Alias管理一覧")
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
})
