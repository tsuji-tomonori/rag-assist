import { EmptyState } from "../../../../shared/ui/index.js"
import { Icon } from "../../../../shared/components/Icon.js"
import { costConfidenceLabel, formatCurrency, formatDate } from "../../../../shared/utils/format.js"
import type { CostAuditSummary } from "../../types.js"

export function AdminCostPanel({ costAudit, onExportCostSummary }: { costAudit: CostAuditSummary | null; onExportCostSummary: () => Promise<void> }) {
  return (
    <section className="admin-section-panel" aria-label="コスト監査一覧">
      <div className="document-list-head">
        <h3>コスト監査</h3>
        <div className="inline-action-group">
          <span>{costAudit ? formatCurrency(costAudit.totalEstimatedUsd) : "未提供"}</span>
          <button type="button" onClick={() => void onExportCostSummary()} title="コスト summary をエクスポート" aria-label="コスト summary をエクスポート">
            <Icon name="download" />
          </button>
        </div>
      </div>
      <p className="admin-panel-note">金額は usage event と pricingVersion に基づく推定です。未計測 event は cost に混ぜず、計測状態として表示します。</p>
      {!costAudit ? (
        <EmptyState title="コスト summary は未提供です。" description="権限内の API から cost audit summary が返されていません。" />
      ) : (
        <>
          <div className="cost-summary-line">
            <span>{formatDate(costAudit.periodStart)} - {formatDate(costAudit.periodEnd)}</span>
            <span>version: {costAudit.pricingVersion}</span>
            <span>pricing: {formatDate(costAudit.pricingCatalogUpdatedAt)}</span>
            <span>{measurementSummary(costAudit)}</span>
          </div>
          <div className="cost-item-list">
            {costAudit.items.length === 0 ? (
              <EmptyState title="コスト明細はありません。" description="推定 summary はありますが、service/category 別 item は空です。" />
            ) : (
              costAudit.items.map((item) => (
                <article className="cost-item" key={`${item.service}-${item.category}`}>
                  <div>
                    <strong>{item.service}</strong>
                    <span>{item.category}</span>
                  </div>
                  <div>
                    <span>{item.usage} {item.unit}</span>
                    <strong>{formatCurrency(item.estimatedCostUsd)}</strong>
                  </div>
                  <i>{costConfidenceLabel(item.confidence)}</i>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  )
}

function measurementSummary(costAudit: CostAuditSummary): string {
  const completeness = costAudit.dataCompleteness
  if (completeness.actualTokenEventCount + completeness.estimatedTokenEventCount + completeness.missingTokenEventCount === 0) return "未計測または利用なし"
  if (completeness.missingTokenEventCount > 0) return `一部未計測: ${completeness.missingTokenEventCount}`
  if (completeness.estimatedTokenEventCount > 0) return `推定: ${completeness.estimatedTokenEventCount}`
  return `実測: ${completeness.actualTokenEventCount}`
}
