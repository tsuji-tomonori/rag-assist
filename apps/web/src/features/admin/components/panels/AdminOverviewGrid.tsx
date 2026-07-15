import { Icon } from "../../../../shared/components/Icon.js"
import type { IconName } from "../../../../shared/components/Icon.js"
import { EmptyState } from "../../../../shared/ui/index.js"
import { formatCurrency } from "../../../../shared/utils/format.js"
import type { AccessRoleDefinition, AliasDefinition, CostAuditSummary, ManagedUser, UsageSummaryPage } from "../../types.js"

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
      onSelect: () => void
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
  failedParts = new Set<string>(),
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
  onOpenBenchmark,
  onOpenUsers,
  onOpenRoles,
  onOpenUsageCost,
  onOpenAliases
}: {
  documentsCount: number | null
  openQuestionsCount: number | null
  debugRunsCount: number | null
  benchmarkRunsCount: number | null
  managedUsers: ManagedUser[] | null
  accessRoles: AccessRoleDefinition[] | null
  usageSummaries: UsageSummaryPage | null
  costAudit: CostAuditSummary | null
  aliases: AliasDefinition[] | null
  failedParts?: ReadonlySet<string>
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
  onOpenUsers: () => void
  onOpenRoles: () => void
  onOpenUsageCost: () => void
  onOpenAliases: () => void
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
            value: accessRoles ? `${accessRoles.length} 件` : failedParts.has("roles") ? "取得失敗" : "未提供",
            note: accessRoles ? "ロール定義は読み取り専用" : failedParts.has("roles") ? "状態メッセージから再試行できます" : "ロール定義データは未提供",
            icon: "settings" as const,
            onSelect: onOpenRoles
          }
        ]
      : []),
    ...(canReadUsers
      ? [
          {
            kind: "kpi" as const,
            id: "users",
            label: "ユーザー管理",
            value: managedUsers ? `${managedUsers.length} 人` : failedParts.has("users") ? "取得失敗" : "未提供",
            note: managedUsers ? "管理対象ユーザー" : failedParts.has("users") ? "状態メッセージから再試行できます" : "管理対象ユーザーデータは未提供",
            icon: "settings" as const,
            onSelect: onOpenUsers
          }
        ]
      : []),
    ...(canReadUsage
      ? [
          {
            kind: "kpi" as const,
            id: "usage",
            label: "利用状況",
            value: usageSummaries ? `${usageSummaries.completeness.eventCount} event` : failedParts.has("usage") ? "取得失敗" : "未提供",
            note: usageSummaries ? `完全性: ${usageSummaries.completeness.state}` : failedParts.has("usage") ? "状態メッセージから再試行できます" : "利用状況データは未提供",
            icon: "gauge" as const,
            onSelect: onOpenUsageCost
          }
        ]
      : []),
    ...(canReadCosts
      ? [
          {
            kind: "kpi" as const,
            id: "cost",
            label: "コスト監査",
            value: costAudit ? formatCurrency(costAudit.pricedCostUsd) : failedParts.has("cost") ? "取得失敗" : "利用不可",
            note: costAudit ? `priced 部分 / 完全性: ${costAudit.completeness.state}` : failedParts.has("cost") ? "状態メッセージから再試行できます" : "料金表または利用実績は未提供",
            icon: "warning" as const,
            onSelect: onOpenUsageCost
          }
        ]
      : []),
    ...(canManageAliases
      ? [
          {
            kind: "kpi" as const,
            id: "alias",
            label: "用語展開管理",
            value: aliases ? `${aliases.length} 件` : failedParts.has("aliases") ? "取得失敗" : "未提供",
            note: aliases ? "レビューと公開は用語展開セクションで操作" : failedParts.has("aliases") ? "状態メッセージから再試行できます" : "用語展開データは未提供",
            icon: "settings" as const,
            onSelect: onOpenAliases
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
          <button type="button" className="admin-overview-tile kpi-card" aria-label={`${card.label}を開く`} onClick={card.onSelect} key={card.id}>
            <Icon name={card.icon} />
            <strong>{card.label}</strong>
            <span>{card.value}</span>
            <small>{card.note}</small>
          </button>
        )
      )}
    </div>
  )
}
