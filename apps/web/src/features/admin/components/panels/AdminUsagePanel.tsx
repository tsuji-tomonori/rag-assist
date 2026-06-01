import { EmptyState } from "../../../../shared/ui/index.js"
import { formatCurrency, formatDateTime } from "../../../../shared/utils/format.js"
import type { UsageDataCompleteness, UsageSummaryBreakdown, UsageSummaryResponse } from "../../types.js"

export function AdminUsagePanel({ usageSummary }: { usageSummary: UsageSummaryResponse | null }) {
  const users = usageSummary?.users ?? null
  return (
    <section className="admin-section-panel" aria-label="利用状況一覧">
      <div className="document-list-head">
        <h3>利用状況</h3>
        <span>{users ? `${users.length} users` : "未提供"}</span>
      </div>
      <p className="admin-panel-note">利用量は usage event の token 集計です。0、未計測、推定は別の状態として表示します。</p>
      {usageSummary && (
        <>
          <div className="cost-summary-line">
            <span>{formatDateTime(usageSummary.periodStart)} - {formatDateTime(usageSummary.periodEnd)}</span>
            <span>{usageSummary.totals.totalTokens.toLocaleString()} tokens</span>
            <span>{formatCurrency(usageSummary.totals.estimatedCostUsd)}</span>
            <span>{measurementSummary(usageSummary.dataCompleteness)}</span>
          </div>
          <div className="usage-breakdown-grid" aria-label="利用量 breakdown">
            <BreakdownList title="feature" items={usageSummary.breakdowns.byFeature} />
            <BreakdownList title="model" items={usageSummary.breakdowns.byModel} />
            <BreakdownList title="group" items={usageSummary.breakdowns.byGroup} />
          </div>
        </>
      )}
      <div className="usage-table" role="table" aria-label="利用状況">
        <div className="usage-row usage-head" role="row">
          <span role="columnheader">ユーザー</span>
          <span role="columnheader">chat</span>
          <span role="columnheader">LLM</span>
          <span role="columnheader">tokens</span>
          <span role="columnheader">cost</span>
          <span role="columnheader">計測</span>
          <span role="columnheader">最終利用</span>
        </div>
        {users === null ? (
          <EmptyState title="利用状況 API field は未提供です。" description="権限内の API response に users field がありません。" />
        ) : users.length === 0 ? (
          <EmptyState title="未計測または利用なし" description="権限内の usage event は空です。" />
        ) : (
          users.map((item) => (
            <div className="usage-row" role="row" key={item.userId}>
              <span role="cell">{item.email}</span>
              <span role="cell">{item.chatRequestCount}</span>
              <span role="cell">{item.llmCallCount}</span>
              <span role="cell">{item.totalTokens.toLocaleString()}</span>
              <span role="cell">{formatCurrency(item.estimatedCostUsd)}</span>
              <span role="cell">{measurementSummary(item)}</span>
              <span role="cell">{item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "未設定"}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function BreakdownList({ title, items }: { title: string; items: UsageSummaryBreakdown[] }) {
  return (
    <div className="usage-breakdown-list">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p>未計測または利用なし</p>
      ) : items.slice(0, 5).map((item) => (
        <article className="usage-breakdown-item" key={item.key}>
          <strong>{item.label}</strong>
          <span>{item.totalTokens.toLocaleString()} tokens</span>
          <span>{formatCurrency(item.estimatedCostUsd)}</span>
          <span>{measurementSummary(item)}</span>
        </article>
      ))}
    </div>
  )
}

function measurementSummary(completeness: UsageDataCompleteness): string {
  const total = completeness.actualTokenEventCount + completeness.estimatedTokenEventCount + completeness.missingTokenEventCount
  if (total === 0) return "未計測または利用なし"
  if (completeness.missingTokenEventCount > 0) return `一部未計測: ${completeness.missingTokenEventCount}`
  if (completeness.estimatedTokenEventCount > 0) return `推定: ${completeness.estimatedTokenEventCount}`
  return `実測: ${completeness.actualTokenEventCount}`
}
