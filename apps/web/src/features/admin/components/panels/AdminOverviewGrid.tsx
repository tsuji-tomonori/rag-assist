import { Icon } from "../../../../shared/components/Icon.js"
import type { IconName } from "../../../../shared/components/Icon.js"
import { EmptyState } from "../../../../shared/ui/index.js"
import { formatCurrency } from "../../../../shared/utils/format.js"
import type { AccessRoleDefinition, AliasDefinition, CostAuditSummary, ManagedUser, UserUsageSummary } from "../../types.js"

type DashboardCard =
  | {
      kind: "action"
      id: string
      label: string
      value: string
      icon: IconName
      onSelect: () => void
    }
  | {
      kind: "kpi"
      id: string
      label: string
      value: string
      note: string
      icon: IconName
    }

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
  documentsCount: number | null
  openQuestionsCount: number | null
  debugRunsCount: number | null
  benchmarkRunsCount: number | null
  managedUsers: ManagedUser[] | null
  accessRoles: AccessRoleDefinition[] | null
  usageSummaries: UserUsageSummary[] | null
  costAudit: CostAuditSummary | null
  aliases: AliasDefinition[] | null
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
  const cards: DashboardCard[] = [
    ...(canManageDocuments && documentsCount !== null
      ? [
          {
            kind: "action" as const,
            id: "documents",
            label: "ドキュメント管理",
            value: `${documentsCount} 件`,
            icon: "document" as const,
            onSelect: onOpenDocuments
          }
        ]
      : []),
    ...(canAnswerQuestions && openQuestionsCount !== null
      ? [
          {
            kind: "action" as const,
            id: "assignee",
            label: "担当者対応",
            value: `${openQuestionsCount} 件が対応待ち`,
            icon: "inbox" as const,
            onSelect: onOpenAssignee
          }
        ]
      : []),
    ...(canReadDebugRuns && debugRunsCount !== null
      ? [
          {
            kind: "action" as const,
            id: "debug",
            label: "デバッグ / 評価",
            value: `${debugRunsCount} 件の実行履歴`,
            icon: "warning" as const,
            onSelect: onOpenDebug
          }
        ]
      : []),
    ...(canReadBenchmarkRuns && benchmarkRunsCount !== null
      ? [
          {
            kind: "action" as const,
            id: "benchmark",
            label: "性能テスト",
            value: `${benchmarkRunsCount} 件の実行履歴`,
            icon: "gauge" as const,
            onSelect: onOpenBenchmark
          }
        ]
      : []),
    ...(canOpenAdminSettings
      ? [
          {
            kind: "kpi" as const,
            id: "access",
            label: "アクセス管理",
            value: accessRoles ? `${accessRoles.length} role` : "未提供",
            note: accessRoles ? "ロール定義は読み取り専用" : "ロール定義 API field は未提供",
            icon: "settings" as const
          }
        ]
      : []),
    ...(canReadUsers
      ? [
          {
            kind: "kpi" as const,
            id: "users",
            label: "ユーザー管理",
            value: managedUsers ? `${managedUsers.length} users` : "未提供",
            note: managedUsers ? "現行 API の管理対象ユーザー" : "管理対象ユーザー API field は未提供",
            icon: "settings" as const
          }
        ]
      : []),
    ...(canReadUsage
      ? [
          {
            kind: "kpi" as const,
            id: "usage",
            label: "利用状況",
            value: usageSummaries ? `${usageSummaries.length} users` : "未提供",
            note: usageSummaries ? "ユーザー別 summary のみ" : "利用状況 API field は未提供",
            icon: "gauge" as const
          }
        ]
      : []),
    ...(canReadCosts
      ? [
          {
            kind: "kpi" as const,
            id: "cost",
            label: "コスト監査",
            value: costAudit ? formatCurrency(costAudit.totalEstimatedUsd) : "未提供",
            note: costAudit ? "推定値を含む" : "コスト summary は未提供",
            icon: "warning" as const
          }
        ]
      : []),
    ...(canManageAliases
      ? [
          {
            kind: "kpi" as const,
            id: "alias",
            label: "Alias管理",
            value: aliases ? `${aliases.length} aliases` : "未提供",
            note: aliases ? "review / publish は別 section" : "Alias API field は未提供",
            icon: "settings" as const
          }
        ]
      : [])
  ]

  return (
    <div className="admin-overview-grid">
      {cards.length === 0 ? (
        <EmptyState title="表示できる管理 summary はありません。" description="権限内の API から overview に表示できる field が返されていません。" />
      ) : cards.map((card) =>
        card.kind === "action" ? (
          <button type="button" className="admin-overview-tile action-card" aria-label={`${card.label}を開く`} onClick={card.onSelect} key={card.id}>
            <Icon name={card.icon} />
            <strong>{card.label}</strong>
            <span>{card.value}</span>
            <small>開く</small>
          </button>
        ) : (
          <article className="admin-overview-tile kpi-card" aria-label={card.label} key={card.id}>
            <Icon name={card.icon} />
            <strong>{card.label}</strong>
            <span>{card.value}</span>
            <small>{card.note}</small>
          </article>
        )
      )}
    </div>
  )
}
