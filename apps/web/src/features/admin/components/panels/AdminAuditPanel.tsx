import { EmptyState } from "../../../../shared/ui/index.js"
import { Icon } from "../../../../shared/components/Icon.js"
import { adminAuditActionLabel, adminAuditSummary, formatDateTime } from "../../../../shared/utils/format.js"
import type { ManagedUserAuditLogEntry } from "../../types.js"

export function AdminAuditPanel({ adminAuditLog, onExportAdminAuditLog }: { adminAuditLog: ManagedUserAuditLogEntry[]; onExportAdminAuditLog: () => Promise<void> }) {
  return (
    <section className="admin-section-panel admin-audit-panel" aria-label="管理操作履歴">
      <div className="document-list-head">
        <h3>管理操作履歴</h3>
        <div className="inline-action-group">
          <span>{adminAuditLog.length} 件</span>
          <button type="button" onClick={() => void onExportAdminAuditLog()} title="監査ログをエクスポート" aria-label="監査ログをエクスポート">
            <Icon name="download" />
          </button>
        </div>
      </div>
      <p className="admin-panel-note">現行 API の managed user / role assign 監査ログです。横断 audit と reason は未提供です。</p>
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
