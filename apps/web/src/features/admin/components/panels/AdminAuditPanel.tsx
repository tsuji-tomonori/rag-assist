import { EmptyState } from "../../../../shared/ui/index.js"
import { adminAuditActionLabel, adminAuditSummary, formatDateTime } from "../../../../shared/utils/format.js"
import type { ManagedUserAuditLogEntry } from "../../types.js"

export function AdminAuditPanel({ adminAuditLog }: { adminAuditLog: ManagedUserAuditLogEntry[] }) {
  return (
    <section className="admin-section-panel admin-audit-panel" aria-label="管理操作履歴">
      <div className="document-list-head">
        <h3>管理操作履歴</h3>
        <span>{adminAuditLog.length} 件</span>
      </div>
      <p className="admin-panel-note">現行 API の managed user / role assign 監査ログです。横断 audit、reason、export は未提供です。</p>
      <div className="admin-audit-list">
        {adminAuditLog.length === 0 ? (
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
