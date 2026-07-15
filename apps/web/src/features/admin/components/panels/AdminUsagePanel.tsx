import { type FormEvent, useEffect, useState } from "react"
import { EmptyState } from "../../../../shared/ui/index.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { UiResourcePartState } from "../../../../shared/ui/ResourceState.js"
import type { AdminExportArtifact, UsageQuery, UsageSummaryPage } from "../../types.js"
import { AdminPanelDataStatus } from "../AdminPanelDataStatus.js"

export function AdminUsagePanel({ usageSummary, part, loading, canExport, onApplyQuery, onRefresh, onLoadMore, onCreateExport }: {
  usageSummary: UsageSummaryPage | null
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

  useEffect(() => { if (usageSummary?.query) setQuery(usageSummary.query) }, [usageSummary?.query])

  async function applyFilters(event: FormEvent) {
    event.preventDefault()
    await onApplyQuery(cleanQuery(query))
  }

  async function exportCurrent(event: FormEvent) {
    event.preventDefault()
    if (!exportReason.trim()) return
    setExportArtifact(null)
    setExportError("")
    try {
      setExportArtifact(await onCreateExport(exportReason.trim()))
      setExportReason("")
      await onRefresh()
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "利用状況 export を作成できませんでした。")
    }
  }

  return (
    <section className="admin-section-panel" aria-label="利用状況一覧">
      <div className="document-list-head">
        <h3>利用状況</h3>
        <span>{usageSummary ? `${usageSummary.events.length} event / ${usageSummary.completeness.state}` : loadFailed ? "取得失敗" : "未確認"}</span>
      </div>
      <AdminPanelDataStatus label="利用状況" part={part} source={usageSummary?.source} asOf={usageSummary?.asOf ?? part?.asOf} loading={loading} onRefresh={onRefresh} />
      {usageSummary?.rolloutMode !== "active" && usageSummary && <p role="status" className="admin-panel-note">usage accounting は {usageSummary.rolloutMode} mode です。収集値を既定の参照・export 経路として公開していません。</p>}
      <UsageQueryForm query={query} loading={loading} onChange={setQuery} onSubmit={applyFilters} />
      <p className="admin-panel-note">期間は開始を含み終了を含まない half-open interval です。provider 実測、tokenizer 推定、missing を分離し、unknown attribution を完全性へ含めます。</p>
      {usageSummary && <CompletenessSummary page={usageSummary} />}
      {canExport && usageSummary?.rolloutMode === "active" && <form className="admin-filter-form" aria-label="現在の利用状況条件を export" onSubmit={exportCurrent}>
        <label><span>export 理由（必須）</span><input value={exportReason} maxLength={500} onChange={(event) => setExportReason(event.target.value)} /></label>
        <button type="submit" disabled={loading || !exportReason.trim()}>同じ条件の全ページを export</button>
      </form>}
      {exportError && <p role="alert">{exportError}</p>}
      {exportArtifact && <p role="status">sanitize 済み export を作成しました。<a href={exportArtifact.url}>有効期限内に取得</a></p>}
      {!usageSummary ? (
        <EmptyState title={loadFailed ? "利用状況を取得できませんでした。" : "利用状況をまだ確認できません。"} description={loadFailed ? "このパネルの更新を試してください。" : "管理 API の取得完了後に表示します。"} />
      ) : usageSummary.events.length === 0 ? (
        <EmptyState title="条件に一致する usage event はありません。" description="0 件は計測済み zero を意味しません。完全性の状態も確認してください。" />
      ) : (
        <table className="usage-table" aria-label="利用状況">
          <thead><tr><th scope="col">時刻</th><th scope="col">subject / run</th><th scope="col">feature / model</th><th scope="col">provider</th><th scope="col">quantity</th></tr></thead>
          <tbody>{usageSummary.events.map((event) => <tr key={event.eventId}>
            <td><time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></td>
            <td>{event.subjectId ?? "unknown"} / {event.runId ?? "unknown"}</td>
            <td>{event.feature ?? "unknown"} / {event.modelId ?? "unknown"}</td>
            <td>{event.provider ?? "unknown"} / {event.region ?? "unknown"} / {event.status}</td>
            <td>{event.quantities.map((quantity) => `${quantity.unit}: ${quantity.value ?? "missing"} (${quantity.source})`).join(" / ")}</td>
          </tr>)}</tbody>
        </table>
      )}
      {usageSummary?.nextCursor && <button type="button" className="admin-load-more" disabled={loading} onClick={() => void onLoadMore()}>次の usage event を読み込む</button>}
    </section>
  )
}

export function UsageQueryForm({ query, loading, onChange, onSubmit }: { query: UsageQuery; loading: boolean; onChange: (query: UsageQuery) => void; onSubmit: (event: FormEvent) => void }) {
  return <form className="admin-filter-form" role="search" aria-label="利用量とコストを絞り込む" onSubmit={onSubmit}>
    <label><span>期間開始（ISO 8601）</span><input required value={query.periodStart ?? ""} onChange={(event) => onChange({ ...query, periodStart: event.target.value })} /></label>
    <label><span>期間終了（ISO 8601・含まない）</span><input required value={query.periodEnd ?? ""} onChange={(event) => onChange({ ...query, periodEnd: event.target.value })} /></label>
    <label><span>subject</span><input value={query.subjectId ?? ""} onChange={(event) => onChange({ ...query, subjectId: event.target.value })} /></label>
    <label><span>run</span><input value={query.runId ?? ""} onChange={(event) => onChange({ ...query, runId: event.target.value })} /></label>
    <label><span>model</span><input value={query.modelId ?? ""} onChange={(event) => onChange({ ...query, modelId: event.target.value })} /></label>
    <label><span>feature</span><input value={query.feature ?? ""} onChange={(event) => onChange({ ...query, feature: event.target.value })} /></label>
    <label><span>provider</span><input value={query.provider ?? ""} onChange={(event) => onChange({ ...query, provider: event.target.value })} /></label>
    <button type="submit" disabled={loading}>条件を適用</button>
  </form>
}

function CompletenessSummary({ page }: { page: UsageSummaryPage }) {
  const completeness = page.completeness
  return <dl className="admin-stat-grid" aria-label="利用量の完全性と比較">
    <div><dt>実測 quantity</dt><dd>{completeness.actualQuantityCount}</dd></div>
    <div><dt>推定 quantity</dt><dd>{completeness.estimatedQuantityCount}</dd></div>
    <div><dt>missing quantity</dt><dd>{completeness.missingQuantityCount}</dd></div>
    <div><dt>unknown attribution</dt><dd>{completeness.unknownSubjectCount + completeness.unknownRunCount + completeness.unknownModelCount + completeness.unknownFeatureCount}</dd></div>
  </dl>
}

function cleanQuery(query: UsageQuery): UsageQuery {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined)) as UsageQuery
}
