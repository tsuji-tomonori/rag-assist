import { Icon } from "../../../../shared/components/Icon.js"
import { formatCurrency } from "../../../../shared/utils/format.js"
import type { AccessRoleDefinition, AliasDefinition, CostAuditSummary, ManagedUser, UserUsageSummary } from "../../types.js"

export function AdminOverviewGrid({
  documentsCount,
  openQuestionsCount,
  debugRunsCount,
  benchmarkRunsCount,
  managedUsers,
  accessRoles,
  usageSummaries,
  costAudit,
  aliases,
  canManageDocuments,
  canAnswerQuestions,
  canReadDebugRuns,
  canReadBenchmarkRuns,
  canOpenAdminSettings,
  canReadUsers,
  canReadUsage,
  canReadCosts,
  canManageAliases,
  onOpenDocuments,
  onOpenAssignee,
  onOpenDebug,
  onOpenBenchmark
}: {
  documentsCount: number
  openQuestionsCount: number
  debugRunsCount: number
  benchmarkRunsCount: number
  managedUsers: ManagedUser[]
  accessRoles: AccessRoleDefinition[]
  usageSummaries: UserUsageSummary[]
  costAudit: CostAuditSummary | null
  aliases: AliasDefinition[]
  canManageDocuments: boolean
  canAnswerQuestions: boolean
  canReadDebugRuns: boolean
  canReadBenchmarkRuns: boolean
  canOpenAdminSettings: boolean
  canReadUsers: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  canManageAliases: boolean
  onOpenDocuments: () => void
  onOpenAssignee: () => void
  onOpenDebug: () => void
  onOpenBenchmark: () => void
}) {
  return (
    <div className="admin-overview-grid">
      {canManageDocuments && (
        <button type="button" className="admin-overview-tile" onClick={onOpenDocuments}>
          <Icon name="document" />
          <strong>ドキュメント管理</strong>
          <span>{documentsCount} 件</span>
        </button>
      )}
      {canAnswerQuestions && (
        <button type="button" className="admin-overview-tile" onClick={onOpenAssignee}>
          <Icon name="inbox" />
          <strong>担当者対応</strong>
          <span>{openQuestionsCount} 件が対応待ち</span>
        </button>
      )}
      {canReadDebugRuns && (
        <button type="button" className="admin-overview-tile" onClick={onOpenDebug}>
          <Icon name="warning" />
          <strong>デバッグ / 評価</strong>
          <span>{debugRunsCount} 件の実行履歴</span>
        </button>
      )}
      {canReadBenchmarkRuns && (
        <button type="button" className="admin-overview-tile" onClick={onOpenBenchmark}>
          <Icon name="gauge" />
          <strong>性能テスト</strong>
          <span>{benchmarkRunsCount} 件の実行履歴</span>
        </button>
      )}
      {canOpenAdminSettings && (
        <div className="admin-overview-tile" aria-label="アクセス管理">
          <Icon name="settings" />
          <strong>アクセス管理</strong>
          <span>{accessRoles.length} role</span>
        </div>
      )}
      {canReadUsers && (
        <div className="admin-overview-tile" aria-label="ユーザー管理">
          <Icon name="settings" />
          <strong>ユーザー管理</strong>
          <span>{managedUsers.length} users</span>
        </div>
      )}
      {canReadUsage && (
        <div className="admin-overview-tile" aria-label="利用状況">
          <Icon name="gauge" />
          <strong>利用状況</strong>
          <span>{usageSummaries.length} users</span>
        </div>
      )}
      {canReadCosts && (
        <div className="admin-overview-tile" aria-label="コスト監査">
          <Icon name="warning" />
          <strong>コスト監査</strong>
          <span>{formatCurrency(costAudit?.totalEstimatedUsd ?? 0)}</span>
        </div>
      )}
      {canManageAliases && (
        <div className="admin-overview-tile" aria-label="Alias管理">
          <Icon name="settings" />
          <strong>Alias管理</strong>
          <span>{aliases.length} aliases</span>
        </div>
      )}
    </div>
  )
}
