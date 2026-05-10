import type { CurrentUser } from "../../../shared/types/common.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type { AccessRoleDefinition, AliasAuditLogItem, AliasDefinition, CostAuditSummary, ManagedUser, ManagedUserAuditLogEntry, UserUsageSummary } from "../types.js"
import { AdminAuditPanel } from "./panels/AdminAuditPanel.js"
import { AdminCostPanel } from "./panels/AdminCostPanel.js"
import { AdminOverviewGrid } from "./panels/AdminOverviewGrid.js"
import { AdminRolePanel } from "./panels/AdminRolePanel.js"
import { AdminUsagePanel } from "./panels/AdminUsagePanel.js"
import { AdminUserPanel } from "./panels/AdminUserPanel.js"
import { AliasAdminPanel } from "./panels/AliasAdminPanel.js"

export function AdminWorkspace({
  user,
  documentsCount,
  openQuestionsCount,
  debugRunsCount,
  benchmarkRunsCount,
  managedUsers,
  adminAuditLog,
  accessRoles,
  usageSummaries,
  costAudit,
  aliases,
  aliasAuditLog,
  loading,
  canManageDocuments,
  canAnswerQuestions,
  canReadDebugRuns,
  canReadBenchmarkRuns,
  canOpenAdminSettings,
  canReadUsers,
  canCreateUsers,
  canSuspendUsers,
  canUnsuspendUsers,
  canDeleteUsers,
  canAssignRoles,
  canReadUsage,
  canReadCosts,
  canReadAdminAuditLog,
  canManageAliases,
  canReadAliases,
  canWriteAliases,
  canReviewAliases,
  canDisableAliases,
  canPublishAliases,
  onOpenDocuments,
  onOpenAssignee,
  onOpenDebug,
  onOpenBenchmark,
  onCreateUser,
  onAssignRoles,
  onSetUserStatus,
  onRefreshAdminData,
  onCreateAlias,
  onUpdateAlias,
  onReviewAlias,
  onDisableAlias,
  onPublishAliases,
  onBack
}: {
  user: CurrentUser | null
  documentsCount: number
  openQuestionsCount: number
  debugRunsCount: number
  benchmarkRunsCount: number
  managedUsers: ManagedUser[]
  adminAuditLog: ManagedUserAuditLogEntry[]
  accessRoles: AccessRoleDefinition[]
  usageSummaries: UserUsageSummary[]
  costAudit: CostAuditSummary | null
  aliases: AliasDefinition[]
  aliasAuditLog: AliasAuditLogItem[]
  loading: boolean
  canManageDocuments: boolean
  canAnswerQuestions: boolean
  canReadDebugRuns: boolean
  canReadBenchmarkRuns: boolean
  canOpenAdminSettings: boolean
  canReadUsers: boolean
  canCreateUsers: boolean
  canSuspendUsers: boolean
  canUnsuspendUsers: boolean
  canDeleteUsers: boolean
  canAssignRoles: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  canReadAdminAuditLog: boolean
  canManageAliases: boolean
  canReadAliases: boolean
  canWriteAliases: boolean
  canReviewAliases: boolean
  canDisableAliases: boolean
  canPublishAliases: boolean
  onOpenDocuments: () => void
  onOpenAssignee: () => void
  onOpenDebug: () => void
  onOpenBenchmark: () => void
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
  onAssignRoles: (userId: string, groups: string[]) => Promise<void>
  onSetUserStatus: (userId: string, action: "suspend" | "unsuspend" | "delete") => Promise<void>
  onRefreshAdminData: () => Promise<void>
  onCreateAlias: (input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onUpdateAlias: (aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onReviewAlias: (aliasId: string, decision: "approve" | "reject", comment?: string) => Promise<void>
  onDisableAlias: (aliasId: string) => Promise<void>
  onPublishAliases: () => Promise<void>
  onBack: () => void
}) {
  return (
    <section className="admin-workspace" aria-label="管理者設定">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>管理者設定</h2>
          <span>{user?.groups.join(" / ") || "権限未取得"}</span>
        </div>
      </header>
      {loading && <LoadingStatus label="管理APIを処理中" />}

      <AdminOverviewGrid
        documentsCount={documentsCount}
        openQuestionsCount={openQuestionsCount}
        debugRunsCount={debugRunsCount}
        benchmarkRunsCount={benchmarkRunsCount}
        managedUsers={managedUsers}
        accessRoles={accessRoles}
        usageSummaries={usageSummaries}
        costAudit={costAudit}
        aliases={aliases}
        canManageDocuments={canManageDocuments}
        canAnswerQuestions={canAnswerQuestions}
        canReadDebugRuns={canReadDebugRuns}
        canReadBenchmarkRuns={canReadBenchmarkRuns}
        canOpenAdminSettings={canOpenAdminSettings}
        canReadUsers={canReadUsers}
        canReadUsage={canReadUsage}
        canReadCosts={canReadCosts}
        canManageAliases={canManageAliases}
        onOpenDocuments={onOpenDocuments}
        onOpenAssignee={onOpenAssignee}
        onOpenDebug={onOpenDebug}
        onOpenBenchmark={onOpenBenchmark}
      />

      <div className="phase2-admin-grid">
        {canReadAliases && (
          <AliasAdminPanel
            aliases={aliases}
            auditLog={aliasAuditLog}
            loading={loading}
            canWrite={canWriteAliases}
            canReview={canReviewAliases}
            canDisable={canDisableAliases}
            canPublish={canPublishAliases}
            onCreate={onCreateAlias}
            onUpdate={onUpdateAlias}
            onReview={onReviewAlias}
            onDisable={onDisableAlias}
            onPublish={onPublishAliases}
          />
        )}

        {canReadUsers && (
          <AdminUserPanel
            managedUsers={managedUsers}
            accessRoles={accessRoles}
            loading={loading}
            canCreateUsers={canCreateUsers}
            canAssignRoles={canAssignRoles}
            canSuspendUsers={canSuspendUsers}
            canUnsuspendUsers={canUnsuspendUsers}
            canDeleteUsers={canDeleteUsers}
            onCreateUser={onCreateUser}
            onAssignRoles={onAssignRoles}
            onSetUserStatus={onSetUserStatus}
            onRefreshAdminData={onRefreshAdminData}
          />
        )}

        {canOpenAdminSettings && <AdminRolePanel accessRoles={accessRoles} />}
        {canReadUsage && <AdminUsagePanel usageSummaries={usageSummaries} />}
        {canReadCosts && costAudit && <AdminCostPanel costAudit={costAudit} />}
        {canReadAdminAuditLog && <AdminAuditPanel adminAuditLog={adminAuditLog} />}
      </div>
    </section>
  )
}
