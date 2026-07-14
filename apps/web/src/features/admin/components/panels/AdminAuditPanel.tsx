import { EmptyState } from "../../../../shared/ui/index.js"
import { adminAuditActionLabel, adminAuditSummary, formatDateTime } from "../../../../shared/utils/format.js"
import type { ManagedUserAuditLogEntry } from "../../types.js"

export function AdminAuditPanel({ adminAuditLog, loadFailed = false }: { adminAuditLog: ManagedUserAuditLogEntry[] | null; loadFailed?: boolean }) {
  return (
    <section className="admin-section-panel admin-audit-panel" aria-label="管理操作履歴">
      <div className="document-list-head">
        <h3>管理操作履歴</h3>
        <span>{adminAuditLog ? `${adminAuditLog.length} 件` : loadFailed ? "取得失敗" : "未提供"}</span>
      </div>
      <p className="admin-panel-note">現行 API の managed user / role assign 監査ログです。横断 audit、reason、export は未提供です。</p>
      <div className="admin-audit-list">
        {adminAuditLog === null ? (
          <EmptyState
            title={loadFailed ? "管理操作履歴を取得できませんでした。" : "管理操作履歴 API field は未提供です。"}
            description={loadFailed ? "画面上部の状態メッセージから再試行してください。" : "権限内の API response に auditLog field がありません。"}
          />
        ) : adminAuditLog.length === 0 ? (
          <EmptyState title="管理操作履歴はありません。" />
        ) : (
          adminAuditLog.map((entry) => (
            <article className="admin-audit-entry" key={entry.auditId}>
              <div>
                <strong>{adminAuditActionLabel(entry.action)}</strong>
                <span>{entry.targetEmail}</span>
              </div>
              <div>
                <span>{entry.actorEmail || entry.actorUserId}</span>
                <time>{formatDateTime(entry.createdAt)}</time>
              </div>
              <small>{adminAuditSummary(entry)}</small>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
