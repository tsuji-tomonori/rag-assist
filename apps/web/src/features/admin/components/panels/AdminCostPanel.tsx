import { type FormEvent, useEffect, useState } from "react"
import { EmptyState } from "../../../../shared/ui/index.js"
import { formatCurrency, formatDateTime } from "../../../../shared/utils/format.js"
import type { UiResourcePartState } from "../../../../shared/ui/ResourceState.js"
import type { AdminExportArtifact, CostAuditSummary, UsageQuery } from "../../types.js"
import { AdminPanelDataStatus } from "../AdminPanelDataStatus.js"
import { UsageQueryForm } from "./AdminUsagePanel.js"

export function AdminCostPanel({ costAudit, part, loading, canExport, onApplyQuery, onRefresh, onLoadMore, onCreateExport }: {
  costAudit: CostAuditSummary | null
  part?: UiResourcePartState
  loading: boolean
  canExport: boolean
  onApplyQuery: (query: UsageQuery) => Promise<void>
  onRefresh: () => Promise<void>
  onLoadMore: () => Promise<void>
  onCreateExport: (reason: string) => Promise<AdminExportArtifact>
}) {
  const [query, setQuery] = useState<UsageQuery>({})
  const [exportReason, setExportReason] = useState("")
  const [exportArtifact, setExportArtifact] = useState<AdminExportArtifact | null>(null)
  const [exportError, setExportError] = useState("")
  const loadFailed = part?.status === "failed" || part?.status === "permission"
  useEffect(() => { if (costAudit?.query) setQuery(costAudit.query) }, [costAudit?.query])

  return <section className="admin-section-panel" aria-label="コスト監査一覧">
    <div className="document-list-head"><h3>コスト監査</h3><span>{costAudit ? formatCurrency(costAudit.pricedCostUsd) : loadFailed ? "取得失敗" : "未確認"}</span></div>
    <AdminPanelDataStatus label="コスト監査" part={part} source={costAudit?.source} asOf={costAudit?.asOf ?? part?.asOf} loading={loading} onRefresh={onRefresh} />
    {costAudit?.rolloutMode !== "active" && costAudit && <p role="status" className="admin-panel-note">usage accounting は {costAudit.rolloutMode} mode です。価格監査と export は active cutover まで利用できません。</p>}
    <UsageQueryForm query={query} loading={loading} onChange={setQuery} onSubmit={(event) => { event.preventDefault(); void onApplyQuery(query) }} />
    <p className="admin-panel-note">表示合計は price catalog で価格付けできた部分だけです。actual / estimate / unpriced と catalog version/source を明細で区別し、実請求とはみなしません。</p>
    {costAudit && <dl className="admin-stat-grid" aria-label="コスト完全性">
      <div><dt>priced 部分</dt><dd>{formatCurrency(costAudit.pricedCostUsd)}</dd></div>
      <div><dt>catalog version</dt><dd>{costAudit.catalogVersions.join(", ") || "未設定"}</dd></div>
      <div><dt>unpriced</dt><dd>{costAudit.completeness.unpricedQuantityCount}</dd></div>
      <div><dt>完全性</dt><dd>{costAudit.completeness.state}</dd></div>
    </dl>}
    {canExport && costAudit?.rolloutMode === "active" && <form className="admin-filter-form" aria-label="現在のコスト条件を export" onSubmit={async (event: FormEvent) => {
      event.preventDefault(); if (!exportReason.trim()) return; setExportArtifact(null); setExportError("")
      try { setExportArtifact(await onCreateExport(exportReason.trim())); setExportReason(""); await onRefresh() }
      catch (error) { setExportError(error instanceof Error ? error.message : "コスト export を作成できませんでした。") }
    }}>
      <label><span>export 理由（必須）</span><input value={exportReason} maxLength={500} onChange={(event) => setExportReason(event.target.value)} /></label>
      <button type="submit" disabled={loading || !exportReason.trim()}>同じ条件の全ページを export</button>
    </form>}
    {exportError && <p role="alert">{exportError}</p>}
    {exportArtifact && <p role="status">sanitize 済み export を作成しました。<a href={exportArtifact.url}>有効期限内に取得</a></p>}
    {!costAudit ? <EmptyState title={loadFailed ? "コスト監査を取得できませんでした。" : "コスト監査をまだ確認できません。"} />
      : costAudit.items.length === 0 ? <EmptyState title="条件に一致する cost item はありません。" description="0 USD ではなく、usage event または価格情報が未計測の可能性があります。" />
      : <div className="cost-item-list">{costAudit.items.map((item) => <article className="cost-item" key={`${item.eventId}:${item.unit}`}>
        <div><strong>{item.feature}</strong><span>{item.modelId} / {item.unit}</span></div>
        <div><span>{item.quantity ?? "missing"} ({item.measurementSource})</span><strong>{item.costUsd === undefined ? "unpriced" : formatCurrency(item.costUsd)}</strong></div>
        <i>{item.pricingState} / {item.catalogVersion ?? "catalog unavailable"}</i>
        <small>{item.priceSource ?? "price source unavailable"} / {formatDateTime(item.occurredAt)}</small>
      </article>)}</div>}
    {costAudit?.nextCursor && <button type="button" className="admin-load-more" disabled={loading} onClick={() => void onLoadMore()}>次の cost item を読み込む</button>}
  </section>
}
