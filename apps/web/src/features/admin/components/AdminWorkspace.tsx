import type { CurrentUser } from "../../../shared/types/common.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type {
  AccessRoleList,
  AdminExportArtifact,
  AliasAuditLogPage,
  AliasDefinition,
  AliasListPage,
  CostAuditSummary,
  ManagedUser,
  ManagedUserAuditLogPage,
  ManagedUserDeletionPreflight,
  ManagedUserListPage,
  UsageQuery,
  UsageSummaryPage
} from "../types.js"
import { AdminAuditPanel } from "./panels/AdminAuditPanel.js"
import { AdminCostPanel } from "./panels/AdminCostPanel.js"
import { AdminOverviewGrid } from "./panels/AdminOverviewGrid.js"
import { AdminRolePanel } from "./panels/AdminRolePanel.js"
import { AdminUsagePanel } from "./panels/AdminUsagePanel.js"
import { AdminUserPanel } from "./panels/AdminUserPanel.js"
import { AliasAdminPanel } from "./panels/AliasAdminPanel.js"
import { ResourceStateBoundary, type UiResourceState } from "../../../shared/ui/ResourceState.js"
import { isResourceStateBusy } from "../../../shared/ui/resourceStateModel.js"
import type { OperationOutcome } from "../../../shared/ui/operationOutcome.js"
import {
  adminAuditActions,
  aliasAuditActions,
  type AdminSectionId,
  type AdminWorkspaceUrlState
} from "../urlState.js"

export type AdminResourcePartId = "users" | "roles" | "audit" | "usage" | "cost" | "aliases" | "aliasAudit"

export function AdminWorkspace({
  dataState,
  user,
  documentsCount,
  openQuestionsCount,
  debugRunsCount,
  benchmarkRunsCount,
  managedUsers,
  managedUserPage,
  adminAuditPage,
  accessRoleList,
  usageSummaries,
  costAudit,
  aliasPage,
  aliasAuditPage,
  pendingAdminMutationKeys,
  urlState,
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
  canExportUsage,
  canExportCosts,
  canReadAdminAuditLog,
  canExportAdminAuditLog,
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
  onPrepareUserDelete,
  onSetUserStatus,
  onRefreshAdminData,
  onRefreshAdminPart,
  onLoadMoreAdminAudit,
  onCreateAdminAuditExport,
  onApplyUsageCostQuery,
  onLoadMoreUsage,
  onLoadMoreCosts,
  onCreateUsageExport,
  onCreateCostExport,
  onLoadMoreManagedUsers,
  onLoadMoreAliases,
  onLoadMoreAliasAudit,
  onUrlStateChange,
  onCreateAlias,
  onUpdateAlias,
  onReviewAlias,
  onTransitionAlias,
  onDisableAlias,
  onPublishAliases,
  onBack
}: {
  dataState: UiResourceState
  user: CurrentUser | null
  documentsCount: number | null
  openQuestionsCount: number | null
  debugRunsCount: number | null
  benchmarkRunsCount: number | null
  managedUsers: ManagedUser[] | null
  managedUserPage?: ManagedUserListPage | null
  adminAuditLog?: never
  adminAuditPage: ManagedUserAuditLogPage | null
  accessRoles?: never
  accessRoleList: AccessRoleList | null
  usageSummaries: UsageSummaryPage | null
  costAudit: CostAuditSummary | null
  aliases?: never
  aliasPage: AliasListPage | null
  aliasAuditLog?: never
  aliasAuditPage: AliasAuditLogPage | null
  pendingAdminMutationKeys?: string[]
  urlState: AdminWorkspaceUrlState
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
  canExportUsage?: boolean
  canExportCosts?: boolean
  canReadAdminAuditLog: boolean
  canExportAdminAuditLog?: boolean
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
  onAssignRoles: (userId: string, groups: string[], reason: string) => Promise<OperationOutcome<ManagedUser> | void>
  onPrepareUserDelete: (userId: string) => Promise<ManagedUserDeletionPreflight | null>
  onSetUserStatus: (userId: string, action: "suspend" | "unsuspend" | "delete", successorUserId?: string) => Promise<OperationOutcome<ManagedUser> | void>
  onRefreshAdminData: () => Promise<void>
  onRefreshAdminPart: (partId: AdminResourcePartId) => Promise<void>
  onLoadMoreAdminAudit: () => Promise<void>
  onCreateAdminAuditExport?: (reason: string) => Promise<AdminExportArtifact>
  onApplyUsageCostQuery?: (query: UsageQuery) => Promise<void>
  onLoadMoreUsage?: () => Promise<void>
  onLoadMoreCosts?: () => Promise<void>
  onCreateUsageExport?: (reason: string) => Promise<AdminExportArtifact>
  onCreateCostExport?: (reason: string) => Promise<AdminExportArtifact>
  onLoadMoreManagedUsers?: () => Promise<void>
  onLoadMoreAliases: () => Promise<void>
  onLoadMoreAliasAudit: () => Promise<void>
  onUrlStateChange: (state: AdminWorkspaceUrlState, mode?: "push" | "replace") => void
  onCreateAlias: (input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) => Promise<OperationOutcome<AliasDefinition> | void>
  onUpdateAlias: (aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"]; expectedVersion: string; reason: string }) => Promise<OperationOutcome<AliasDefinition> | void>
  onReviewAlias: (aliasId: string, decision: "approve" | "reject", expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
  onTransitionAlias: (aliasId: string, expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
  onDisableAlias: (aliasId: string, expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
  onPublishAliases: (expectedVersion: string, reason: string) => Promise<OperationOutcome<{ version: string; publishedAt: string; aliasCount: number }> | void>
  onBack: () => void
}) {
  const sections: Array<{ id: AdminSectionId; label: string; available: boolean }> = [
    { id: "overview", label: "概要", available: true },
    { id: "users", label: "ユーザー", available: canReadUsers },
    { id: "roles", label: "ロール", available: canOpenAdminSettings },
    { id: "usage-cost", label: "利用状況・コスト", available: canReadUsage || canReadCosts },
    { id: "audit", label: "監査", available: canReadAdminAuditLog },
    { id: "alias", label: "用語展開", available: canReadAliases }
  ]
  const availableSections = sections.filter((section) => section.available)
  const requestedSection = urlState.section ?? "overview"
  const resolvedActiveSection = availableSections.some((section) => section.id === requestedSection) ? requestedSection : "overview"
  const failedParts = new Set(dataState.parts.filter((part) => part.status === "failed" || part.status === "permission").map((part) => part.id))
  const part = (id: AdminResourcePartId) => dataState.parts.find((candidate) => candidate.id === id)
  const visibleManagedUsers = failedParts.has("users") ? null : managedUsers
  const visibleAccessRoleList = failedParts.has("roles") ? null : accessRoleList
  const visibleUsageSummaries = failedParts.has("usage") ? null : usageSummaries
  const visibleCostAudit = failedParts.has("cost") ? null : costAudit
  const visibleAdminAuditPage = failedParts.has("audit") ? null : adminAuditPage
  const visibleAliasPage = failedParts.has("aliases") ? null : aliasPage
  const visibleAliasAuditPage = failedParts.has("aliasAudit") ? null : aliasAuditPage

  function openSection(section: AdminSectionId) {
    let nextState: AdminWorkspaceUrlState = { ...urlState, section }
    if (section !== "alias") nextState = { ...nextState, aliasStatus: undefined, sort: undefined, selected: undefined }
    if (section === "audit" && nextState.auditAction && aliasAuditActions.has(nextState.auditAction as never)) {
      nextState.auditAction = undefined
    }
    if (section === "alias" && nextState.auditAction && adminAuditActions.has(nextState.auditAction as never)) {
      nextState.auditAction = undefined
    }
    onUrlStateChange(nextState, "push")
  }

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
      {loading && !isResourceStateBusy(dataState) && <LoadingStatus label="管理 API を処理中" />}

      <ResourceStateBoundary state={dataState} onRetry={() => { void onRefreshAdminData() }} onBack={onBack}>
        <nav className="admin-section-tabs" aria-label="管理セクション">
          {availableSections.map((section) => (
            <button
              type="button"
              aria-current={resolvedActiveSection === section.id ? "page" : undefined}
              onClick={() => openSection(section.id)}
              key={section.id}
            >
              {section.label}
            </button>
          ))}
        </nav>

        {resolvedActiveSection === "overview" && (
          <AdminOverviewGrid
            documentsCount={documentsCount}
            openQuestionsCount={openQuestionsCount}
            debugRunsCount={debugRunsCount}
            benchmarkRunsCount={benchmarkRunsCount}
            managedUsers={visibleManagedUsers}
            accessRoles={visibleAccessRoleList?.roles ?? null}
            usageSummaries={visibleUsageSummaries}
            costAudit={visibleCostAudit}
            aliases={visibleAliasPage?.aliases ?? null}
            failedParts={failedParts}
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
            onOpenUsers={() => openSection("users")}
            onOpenRoles={() => openSection("roles")}
            onOpenUsageCost={() => openSection("usage-cost")}
            onOpenAliases={() => openSection("alias")}
          />
        )}

        <div className="phase2-admin-grid" hidden={resolvedActiveSection === "overview"}>
          {canReadUsers && (
            <div hidden={resolvedActiveSection !== "users"}>
              <AdminUserPanel
                managedUsers={visibleManagedUsers}
                page={managedUserPage ?? null}
                accessRoles={visibleAccessRoleList?.roles ?? null}
                part={part("users")}
                usersLoadFailed={failedParts.has("users")}
                rolesLoadFailed={failedParts.has("roles")}
                loading={loading}
                pendingMutationKeys={pendingAdminMutationKeys ?? []}
                canCreateUsers={canCreateUsers}
                canAssignRoles={canAssignRoles}
                canSuspendUsers={canSuspendUsers}
                canUnsuspendUsers={canUnsuspendUsers}
                canDeleteUsers={canDeleteUsers}
                onCreateUser={onCreateUser}
                onAssignRoles={onAssignRoles}
                onPrepareUserDelete={onPrepareUserDelete}
                onSetUserStatus={onSetUserStatus}
                onRefresh={() => onRefreshAdminPart("users")}
                onLoadMore={onLoadMoreManagedUsers ?? (async () => undefined)}
                urlState={urlState}
                onUrlStateChange={onUrlStateChange}
              />
            </div>
          )}

          {canOpenAdminSettings && (
            <div hidden={resolvedActiveSection !== "roles"}>
              <AdminRolePanel accessRoleList={visibleAccessRoleList} part={part("roles")} loading={loading} onRefresh={() => onRefreshAdminPart("roles")} />
            </div>
          )}

          {(canReadUsage || canReadCosts) && (
            <div className="admin-combined-section" hidden={resolvedActiveSection !== "usage-cost"}>
              {canReadUsage && <AdminUsagePanel
                usageSummary={visibleUsageSummaries}
                part={part("usage")}
                loading={loading}
                canExport={canExportUsage ?? false}
                onApplyQuery={onApplyUsageCostQuery ?? (async () => undefined)}
                onRefresh={() => onRefreshAdminPart("usage")}
                onLoadMore={onLoadMoreUsage ?? (async () => undefined)}
                onCreateExport={onCreateUsageExport ?? (async () => { throw new Error("利用状況 export は利用できません") })}
              />}
              {canReadCosts && <AdminCostPanel
                costAudit={visibleCostAudit}
                part={part("cost")}
                loading={loading}
                canExport={canExportCosts ?? false}
                onApplyQuery={onApplyUsageCostQuery ?? (async () => undefined)}
                onRefresh={() => onRefreshAdminPart("cost")}
                onLoadMore={onLoadMoreCosts ?? (async () => undefined)}
                onCreateExport={onCreateCostExport ?? (async () => { throw new Error("コスト export は利用できません") })}
              />}
            </div>
          )}

          {canReadAdminAuditLog && (
            <div hidden={resolvedActiveSection !== "audit"}>
              <AdminAuditPanel
                page={visibleAdminAuditPage}
                part={part("audit")}
                loading={loading}
                urlState={urlState}
                onUrlStateChange={onUrlStateChange}
                onRefresh={() => onRefreshAdminPart("audit")}
                onLoadMore={onLoadMoreAdminAudit}
                canExport={canExportAdminAuditLog ?? false}
                onCreateExport={onCreateAdminAuditExport ?? (async () => { throw new Error("監査 export は利用できません") })}
              />
            </div>
          )}

          {canReadAliases && (
            <div hidden={resolvedActiveSection !== "alias"}>
              <AliasAdminPanel
                page={visibleAliasPage}
                auditPage={visibleAliasAuditPage}
                listPart={part("aliases")}
                auditPart={part("aliasAudit")}
                loading={loading}
                canWrite={canWriteAliases}
                canReview={canReviewAliases}
                canDisable={canDisableAliases}
                canPublish={canPublishAliases}
                urlState={urlState}
                onUrlStateChange={onUrlStateChange}
                onRefreshList={() => onRefreshAdminPart("aliases")}
                onRefreshAudit={() => onRefreshAdminPart("aliasAudit")}
                onLoadMore={onLoadMoreAliases}
                onLoadMoreAudit={onLoadMoreAliasAudit}
                onCreate={onCreateAlias}
                onUpdate={onUpdateAlias}
                onReview={onReviewAlias}
                onTransition={onTransitionAlias}
                onDisable={onDisableAlias}
                onPublish={onPublishAliases}
              />
            </div>
          )}
        </div>
      </ResourceStateBoundary>
    </section>
  )
}
