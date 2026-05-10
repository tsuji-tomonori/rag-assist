import { formatDateTime } from "../../../../shared/utils/format.js"
import type { UserUsageSummary } from "../../types.js"

export function AdminUsagePanel({ usageSummaries }: { usageSummaries: UserUsageSummary[] }) {
  return (
    <section className="admin-section-panel" aria-label="利用状況一覧">
      <div className="document-list-head">
        <h3>利用状況</h3>
        <span>{usageSummaries.length} users</span>
      </div>
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
        {usageSummaries.map((item) => (
          <div className="usage-row" role="row" key={item.userId}>
            <span role="cell">{item.email}</span>
            <span role="cell">{item.chatMessages}</span>
            <span role="cell">{item.documentCount}</span>
            <span role="cell">{item.questionCount}</span>
            <span role="cell">{item.benchmarkRunCount}</span>
            <span role="cell">{item.debugRunCount}</span>
            <span role="cell">{item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "-"}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
