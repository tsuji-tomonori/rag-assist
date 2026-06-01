import { EmptyState } from "../../../../shared/ui/index.js"
import { formatCurrency } from "../../../../shared/utils/format.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { UsageDataCompleteness, UsageSummaryBreakdown, UsageSummaryResponse, UserUsageSummary } from "../../types.js"

export function AdminUsagePanel({ usageSummaries, usageSummary }: { usageSummaries: UserUsageSummary[]; usageSummary?: UsageSummaryResponse | null }) {
  return (
    <section className="admin-section-panel" aria-label="利用状況一覧">
      <div className="document-list-head">
        <h3>利用状況</h3>
        <span>{usageSummaries.length} users</span>
      </div>
      <p className="admin-panel-note">ユーザー別 summary は実 usage event を優先し、provider usage がない場合は推定または未計測として表示します。</p>
      {usageSummary && (
        <div className="cost-summary-line" aria-label="利用状況サマリー">
          <span>{formatDateTime(usageSummary.periodStart)} - {formatDateTime(usageSummary.periodEnd)}</span>
          <span>{usageSummary.totals.totalTokens.toLocaleString()} tokens</span>
          <span>{formatCurrency(usageSummary.totals.estimatedCostUsd)}</span>
          <span>{usageMeasurementSummaryLabel(usageSummary.dataCompleteness)}</span>
        </div>
      )}
      {usageSummary && (
        <div className="usage-breakdown-grid" aria-label="利用状況内訳">
          <UsageBreakdownList title="機能別" items={usageSummary.breakdowns.byFeature} />
          <UsageBreakdownList title="モデル別" items={usageSummary.breakdowns.byModel} />
          <UsageBreakdownList title="グループ別" items={usageSummary.breakdowns.byGroup} />
        </div>
      )}
      <div className="usage-table" role="table" aria-label="利用状況">
        <div className="usage-row usage-head" role="row">
          <span role="columnheader">ユーザー</span>
          <span role="columnheader">chat</span>
          <span role="columnheader">tokens</span>
          <span role="columnheader">計測</span>
          <span role="columnheader">文書</span>
          <span role="columnheader">問い合わせ</span>
          <span role="columnheader">benchmark</span>
          <span role="columnheader">debug</span>
          <span role="columnheader">最終利用</span>
        </div>
        {usageSummaries.length === 0 ? (
          <EmptyState title="未計測または利用なし" description="権限内の API から返された user-level usage summary は空です。" />
        ) : (
          usageSummaries.map((item) => (
            <div className="usage-row" role="row" key={item.userId}>
              <span role="cell">{item.email}</span>
              <span role="cell">{item.chatRequestCount}</span>
              <span role="cell">{item.llmCallCount === 0 ? "未計測または利用なし" : item.totalTokens.toLocaleString()}</span>
              <span role="cell">{usageMeasurementLabel(item)}</span>
              <span role="cell">{item.documentCount}</span>
              <span role="cell">{item.questionCount}</span>
              <span role="cell">{item.benchmarkRunCount}</span>
              <span role="cell">{item.debugRunCount}</span>
              <span role="cell">{item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "未設定"}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function UsageBreakdownList({ title, items }: { title: string; items: UsageSummaryBreakdown[] }) {
  return (
    <section className="usage-breakdown-list" aria-label={title}>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p>未計測または利用なし</p>
      ) : (
        items.slice(0, 5).map((item) => (
          <div className="usage-breakdown-item" key={item.key}>
            <strong>{item.label}</strong>
            <span>{item.totalTokens.toLocaleString()} tokens</span>
            <span>{formatCurrency(item.estimatedCostUsd)}</span>
            <span>{usageMeasurementSummaryLabel(item)}</span>
          </div>
        ))
      )}
    </section>
  )
}

function usageMeasurementSummaryLabel(completeness: UsageDataCompleteness): string {
  if (completeness.actualTokenEventCount + completeness.estimatedTokenEventCount + completeness.missingTokenEventCount === 0) return "未計測または利用なし"
  if (completeness.missingTokenEventCount > 0) return `一部未計測 ${completeness.missingTokenEventCount}`
  if (completeness.estimatedTokenEventCount > 0) return `推定 ${completeness.estimatedTokenEventCount}`
  return `実測 ${completeness.actualTokenEventCount}`
}

function usageMeasurementLabel(item: UserUsageSummary): string {
  if (item.missingTokenEventCount > 0) return `一部未計測 ${item.missingTokenEventCount}`
  if (item.estimatedTokenEventCount > 0) return `推定 ${item.estimatedTokenEventCount}`
  if (item.actualTokenEventCount > 0) return `実測 ${item.actualTokenEventCount}`
  return "未計測または利用なし"
}
