import { costConfidenceLabel, formatCurrency, formatDate } from "../../../../shared/utils/format.js"
import type { CostAuditSummary } from "../../types.js"

export function AdminCostPanel({ costAudit }: { costAudit: CostAuditSummary }) {
  return (
    <section className="admin-section-panel" aria-label="コスト監査一覧">
      <div className="document-list-head">
        <h3>コスト監査</h3>
        <span>{formatCurrency(costAudit.totalEstimatedUsd)}</span>
      </div>
      <div className="cost-summary-line">
        <span>{formatDate(costAudit.periodStart)} - {formatDate(costAudit.periodEnd)}</span>
        <span>pricing: {formatDate(costAudit.pricingCatalogUpdatedAt)}</span>
      </div>
      <div className="cost-item-list">
        {costAudit.items.map((item) => (
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
        ))}
      </div>
    </section>
  )
}
