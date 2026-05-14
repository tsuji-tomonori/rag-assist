import { EmptyState } from "../../../../shared/ui/index.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { UserUsageSummary } from "../../types.js"

export function AdminUsagePanel({ usageSummaries }: { usageSummaries: UserUsageSummary[] }) {
  return (
    <section className="admin-section-panel" aria-label="利用状況一覧">
      <div className="document-list-head">
        <h3>利用状況</h3>
        <span>{usageSummaries.length} users</span>
      </div>
      <p className="admin-panel-note">現行 API が返すユーザー別 summary の read-only 表示です。グループ別、モデル別、export は未提供です。</p>
      <div className="usage-table" role="table" aria-label="利用状況">
        <div className="usage-row usage-head" role="row">
          <span role="columnheader">ユーザー</span>
          <span role="columnheader">chat</span>
          <span role="columnheader">文書</span>
          <span role="columnheader">問い合わせ</span>
          <span role="columnheader">benchmark</span>
          <span role="columnheader">debug</span>
          <span role="columnheader">最終利用</span>
        </div>
        {usageSummaries.length === 0 ? (
          <EmptyState title="利用状況はありません。" description="権限内の API から返された user-level usage summary は空です。" />
        ) : (
          usageSummaries.map((item) => (
            <div className="usage-row" role="row" key={item.userId}>
              <span role="cell">{item.email}</span>
              <span role="cell">{item.chatMessages}</span>
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
