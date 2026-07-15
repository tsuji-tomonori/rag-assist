import { EmptyState } from "../../../../shared/ui/index.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { UiResourcePartState } from "../../../../shared/ui/ResourceState.js"
import type { UserUsageSummary } from "../../types.js"
import { AdminPanelDataStatus } from "../AdminPanelDataStatus.js"

export function AdminUsagePanel({ usageSummaries, part, loading, onRefresh }: {
  usageSummaries: UserUsageSummary[] | null
  part?: UiResourcePartState
  loading: boolean
  onRefresh: () => Promise<void>
}) {
  const loadFailed = part?.status === "failed" || part?.status === "permission"
  return (
    <section className="admin-section-panel" aria-label="利用状況一覧">
      <div className="document-list-head">
        <h3>利用状況</h3>
        <span>{usageSummaries ? `${usageSummaries.length} 人` : loadFailed ? "取得失敗" : "未確認"}</span>
      </div>
      <AdminPanelDataStatus label="利用状況" part={part} source="利用状況 API" asOf={part?.asOf} loading={loading} onRefresh={onRefresh} />
      <p className="admin-panel-note">現行 API が返すユーザー別 summary の read-only 表示です。グループ別、モデル別、export は未提供です。</p>
      <table className="usage-table" aria-label="利用状況">
        <thead><tr className="usage-row usage-head">
          <th scope="col">ユーザー</th>
          <th scope="col">chat</th>
          <th scope="col">文書</th>
          <th scope="col">問い合わせ</th>
          <th scope="col">benchmark</th>
          <th scope="col">debug</th>
          <th scope="col">最終利用</th>
        </tr></thead>
        <tbody>
        {usageSummaries === null ? (
          <tr><td colSpan={7}><EmptyState
            title={loadFailed ? "利用状況を取得できませんでした。" : "利用状況をまだ確認できません。"}
            description={loadFailed ? "このパネルの更新を試してください。" : "管理 API の取得完了後に表示します。"}
          /></td></tr>
        ) : usageSummaries.length === 0 ? (
          <tr><td colSpan={7}><EmptyState title="利用状況はありません。" description="権限内の API から返された user-level usage summary は空です。" /></td></tr>
        ) : (
          usageSummaries.map((item) => (
            <tr className="usage-row" key={item.userId}>
              <th scope="row" data-label="ユーザー">{item.email}</th>
              <td data-label="chat">{item.chatMessages ?? "利用不可"}</td>
              <td data-label="文書">{item.documentCount ?? "利用不可"}</td>
              <td data-label="問い合わせ">{item.questionCount ?? "利用不可"}</td>
              <td data-label="benchmark">{item.benchmarkRunCount ?? "利用不可"}</td>
              <td data-label="debug">{item.debugRunCount ?? "利用不可"}</td>
              <td data-label="最終利用">{item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "未設定"}</td>
            </tr>
          ))
        )}
        </tbody>
      </table>
    </section>
  )
}
