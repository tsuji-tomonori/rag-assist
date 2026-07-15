import { type FormEvent, useEffect, useState } from "react"
import { EmptyState } from "../../../../shared/ui/index.js"
import type { UiResourcePartState } from "../../../../shared/ui/ResourceState.js"
import { adminAuditActionLabel, adminAuditSummary, formatDateTime } from "../../../../shared/utils/format.js"
import type { AdminExportArtifact, ManagedUserAuditAction, ManagedUserAuditLogPage } from "../../types.js"
import { adminAuditActions, type AdminWorkspaceUrlState } from "../../urlState.js"
import { AdminPanelDataStatus } from "../AdminPanelDataStatus.js"

const actionOptions: Array<{ value: ManagedUserAuditAction; label: string }> = [
  { value: "user:create", label: "ユーザー作成" },
  { value: "role:assign", label: "ロール変更" },
  { value: "user:suspend", label: "ユーザー停止" },
  { value: "user:unsuspend", label: "ユーザー再開" },
  { value: "user:delete", label: "ユーザー削除" },
  { value: "audit.export", label: "監査 export" }
]

export function AdminAuditPanel({
  page,
  part,
  loading,
  urlState,
  onUrlStateChange,
  onRefresh,
  onLoadMore,
  canExport,
  onCreateExport
}: {
  page: ManagedUserAuditLogPage | null
  part?: UiResourcePartState
  loading: boolean
  urlState: AdminWorkspaceUrlState
  onUrlStateChange: (state: AdminWorkspaceUrlState, mode?: "push" | "replace") => void
  onRefresh: () => Promise<void>
  onLoadMore: () => Promise<void>
  canExport: boolean
  onCreateExport: (reason: string) => Promise<AdminExportArtifact>
}) {
  const [query, setQuery] = useState(urlState.query ?? "")
  const [exportReason, setExportReason] = useState("")
  const [exportArtifact, setExportArtifact] = useState<AdminExportArtifact | null>(null)
  const [exportError, setExportError] = useState("")
  const action = urlState.auditAction && adminAuditActions.has(urlState.auditAction as ManagedUserAuditAction)
    ? urlState.auditAction as ManagedUserAuditAction
    : ""
  const loadFailed = part?.status === "failed" || part?.status === "permission"

  useEffect(() => setQuery(urlState.query ?? ""), [urlState.query])

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    onUrlStateChange({ ...urlState, section: "audit", query: query.trim() || undefined, auditAction: action || undefined }, "push")
  }

  return (
    <section className="admin-section-panel admin-audit-panel" aria-label="管理操作履歴">
      <div className="document-list-head">
        <h3>管理操作履歴</h3>
        <span>{page ? `${page.auditLog.length} / ${page.total} 件` : loadFailed ? "取得失敗" : "未確認"}</span>
      </div>
      <AdminPanelDataStatus label="管理操作履歴" part={part} source={page?.source} asOf={page?.asOf} loading={loading} onRefresh={onRefresh} />
      <form className="admin-filter-form" onSubmit={applyFilters} role="search" aria-label="管理操作履歴を絞り込む">
        <label>
          <span>対象・実行者を検索</span>
          <input value={query} maxLength={200} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          <span>操作</span>
          <select
            value={action}
            onChange={(event) => onUrlStateChange({
              ...urlState,
              section: "audit",
              auditAction: event.target.value as ManagedUserAuditAction || undefined
            })}
          >
            <option value="">すべて</option>
            {actionOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loading}>検索</button>
        {(urlState.query || action) && (
          <button type="button" disabled={loading} onClick={() => {
            setQuery("")
            onUrlStateChange({ ...urlState, section: "audit", query: undefined, auditAction: undefined }, "push")
          }}>条件を解除</button>
        )}
      </form>
      <p className="admin-panel-note">security audit outbox と legacy 管理台帳を統合した tenant-scoped read model です。pending / denied / conflict / failed も成功と区別して表示します。</p>
      {canExport && <form className="admin-filter-form" aria-label="現在の監査条件を export" onSubmit={async (event) => {
        event.preventDefault()
        const reason = exportReason.trim()
        if (!reason) return
        setExportArtifact(null)
        setExportError("")
        try {
          setExportArtifact(await onCreateExport(reason))
          setExportReason("")
          await onRefresh()
        } catch (error) {
          setExportError(error instanceof Error ? error.message : "監査 export を作成できませんでした。")
        }
      }}>
        <label><span>export 理由（必須）</span><input value={exportReason} maxLength={1000} onChange={(event) => setExportReason(event.target.value)} /></label>
        <button type="submit" disabled={loading || exportReason.trim().length === 0}>現在の条件を export</button>
      </form>}
      {exportError && <p role="alert">{exportError}</p>}
      {exportArtifact && <p role="status">
        sanitize 済み export を作成しました（redaction: {exportArtifact.redaction.policyVersion}）。
        <a href={exportArtifact.url}>有効期限内に取得</a>
      </p>}
      <div className="admin-audit-list">
        {page === null ? (
          <EmptyState
            title={loadFailed ? "管理操作履歴を取得できませんでした。" : "管理操作履歴をまだ確認できません。"}
            description={loadFailed ? "このパネルの更新を試してください。" : "管理 API の取得完了後に表示します。"}
          />
        ) : page.auditLog.length === 0 ? (
          <EmptyState title="条件に一致する管理操作履歴はありません。" />
        ) : (
          page.auditLog.map((entry) => (
            <article className="admin-audit-entry" key={entry.auditId}>
              <div>
                <strong>{adminAuditActionLabel(entry.action)}</strong>
                <span>{entry.targetEmail || entry.targetUserId}</span>
              </div>
              <div>
                <span>実行者: {entry.actorEmail || entry.actorUserId}</span>
                <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
              </div>
              <small>{adminAuditSummary(entry)}</small>
              <small>結果: {entry.result ?? "legacy success"} / 理由: {entry.reason ?? "legacy record"}</small>
              <small>対象種別: {entry.targetType ?? "managedUser"} / policy: <code>{entry.policyVersion ?? "legacy"}</code> / source: {entry.source ?? "legacy_admin_ledger"}</small>
              <small>監査 ID: <code>{entry.auditId}</code></small>
            </article>
          ))
        )}
      </div>
      {page?.nextCursor && (
        <button type="button" className="admin-load-more" disabled={loading} onClick={() => void onLoadMore()}>
          次の履歴を読み込む（残り {Math.max(0, page.total - page.auditLog.length)} 件）
        </button>
      )}
    </section>
  )
}
