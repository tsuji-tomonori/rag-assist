import { EmptyState } from "../../../../shared/ui/index.js"
import { costConfidenceLabel, formatCurrency, formatDate } from "../../../../shared/utils/format.js"
import type { CostAuditSummary } from "../../types.js"

export function AdminCostPanel({ costAudit, loadFailed = false }: { costAudit: CostAuditSummary | null; loadFailed?: boolean }) {
  return (
    <section className="admin-section-panel" aria-label="コスト監査一覧">
      <div className="document-list-head">
        <h3>コスト監査</h3>
        <span>{costAudit?.available && costAudit.totalEstimatedUsd !== undefined ? formatCurrency(costAudit.totalEstimatedUsd) : loadFailed ? "取得失敗" : "利用不可"}</span>
      </div>
      <p className="admin-panel-note">承認済み price catalog と完全な usage evidence がある場合だけ金額を表示します。実請求、export、異常検知は未提供です。</p>
      {!costAudit ? (
        <EmptyState
          title={loadFailed ? "コスト summary を取得できませんでした。" : "コスト summary は未提供です。"}
          description={loadFailed ? "画面上部の状態メッセージから再試行してください。" : "権限内の API から cost audit summary が返されていません。"}
        />
      ) : !costAudit.available ? (
        <EmptyState title="コスト summary は利用できません。" description="承認済み price catalog または完全な usage evidence がないため、推定金額を表示していません。" />
      ) : (
        <>
          <div className="cost-summary-line">
            <span>{formatDate(costAudit.periodStart)} - {formatDate(costAudit.periodEnd)}</span>
            <span>pricing: {costAudit.pricingCatalogUpdatedAt ? formatDate(costAudit.pricingCatalogUpdatedAt) : "未設定"}</span>
          </div>
          <div className="cost-item-list">
            {(costAudit.items ?? []).length === 0 ? (
              <EmptyState title="コスト明細はありません。" description="推定 summary はありますが、service/category 別 item は空です。" />
            ) : (
              (costAudit.items ?? []).map((item) => (
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
