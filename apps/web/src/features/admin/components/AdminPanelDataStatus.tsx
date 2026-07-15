import type { UiResourcePartState } from "../../../shared/ui/ResourceState.js"
import { formatDateTime } from "../../../shared/utils/format.js"

export function AdminPanelDataStatus({
  label,
  part,
  source,
  asOf,
  loading,
  onRefresh
}: {
  label: string
  part?: UiResourcePartState
  source?: string
  asOf?: string
  loading: boolean
  onRefresh: () => Promise<void>
}) {
  const isUnavailable = part?.status === "failed" || part?.status === "permission"
  const isStale = part?.status === "stale"
  const isBusy = part?.status === "loading" || part?.status === "retrying"
  return (
    <div
      className={`admin-panel-data-status${isStale ? " stale" : ""}${isUnavailable ? " unavailable" : ""}`}
      role={isUnavailable ? "alert" : "status"}
      aria-live={isUnavailable ? "assertive" : "polite"}
    >
      <div>
        <strong>{label}</strong>
        <span>取得元: {source || "管理 API"}</span>
        <span>
          取得時点: {asOf ? <time dateTime={asOf}>{formatDateTime(asOf)}</time> : "未確認"}
        </span>
        {isStale && <span>最新情報の取得に失敗したため、最後に確認できた内容です。</span>}
        {part?.status === "failed" && <span>取得に失敗しました。</span>}
        {part?.status === "permission" && <span>この情報を参照する権限がありません。</span>}
      </div>
      <button type="button" disabled={loading || isBusy} onClick={() => void onRefresh()} aria-label={`${label}を更新`}>
        {isBusy ? "更新中" : "更新"}
      </button>
    </div>
  )
}
