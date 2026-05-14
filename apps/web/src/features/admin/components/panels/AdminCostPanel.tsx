import { EmptyState } from "../../../../shared/ui/index.js"
import { costConfidenceLabel, formatCurrency, formatDate } from "../../../../shared/utils/format.js"
import type { CostAuditSummary } from "../../types.js"

export function AdminCostPanel({ costAudit }: { costAudit: CostAuditSummary | null }) {
  return (
    <section className="admin-section-panel" aria-label="コスト監査一覧">
      <div className="document-list-head">
        <h3>コスト監査</h3>
        <span>{costAudit ? formatCurrency(costAudit.totalEstimatedUsd) : "未提供"}</span>
      </div>
      <p className="admin-panel-note">金額は現行 API の confidence を持つ推定 summary です。実請求、export、異常検知は未提供です。</p>
      {!costAudit ? (
        <EmptyState title="コスト summary は未提供です。" description="権限内の API から cost audit summary が返されていません。" />
      ) : (
        <>
          <div className="cost-summary-line">
            <span>{formatDate(costAudit.periodStart)} - {formatDate(costAudit.periodEnd)}</span>
            <span>pricing: {formatDate(costAudit.pricingCatalogUpdatedAt)}</span>
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
