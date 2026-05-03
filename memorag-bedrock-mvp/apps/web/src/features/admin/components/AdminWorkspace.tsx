import { type FormEvent, useEffect, useState } from "react"
import type { AccessRoleDefinition, CostAuditSummary, CurrentUser, ManagedUser, ManagedUserAuditLogEntry, UserUsageSummary } from "../../../api.js"
import { Icon } from "../../../shared/components/Icon.js"
import { adminAuditActionLabel, adminAuditSummary, costConfidenceLabel, formatCurrency, formatDate, formatDateTime, managedUserStatusLabel } from "../../../shared/utils/format.js"

export function AdminWorkspace({
  user,
  documentsCount,
  openQuestionsCount,
  debugRunsCount,
  benchmarkRunsCount,
  managedUsers,
  adminAuditLog,
  accessRoles,
  usageSummaries,
  costAudit,
  loading,
  canManageDocuments,
  canAnswerQuestions,
  canReadDebugRuns,
  canReadBenchmarkRuns,
  canOpenAdminSettings,
  canReadUsers,
  canCreateUsers,
  canSuspendUsers,
  canUnsuspendUsers,
  canDeleteUsers,
  canAssignRoles,
  canReadUsage,
  canReadCosts,
  canReadAdminAuditLog,
  onOpenDocuments,
  onOpenAssignee,
  onOpenDebug,
  onOpenBenchmark,
  onCreateUser,
  onAssignRoles,
  onSetUserStatus,
  onRefreshAdminData,
  onBack
}: {
  user: CurrentUser | null
  documentsCount: number
  openQuestionsCount: number
  debugRunsCount: number
  benchmarkRunsCount: number
  managedUsers: ManagedUser[]
  adminAuditLog: ManagedUserAuditLogEntry[]
  accessRoles: AccessRoleDefinition[]
  usageSummaries: UserUsageSummary[]
  costAudit: CostAuditSummary | null
  loading: boolean
  canManageDocuments: boolean
  canAnswerQuestions: boolean
  canReadDebugRuns: boolean
  canReadBenchmarkRuns: boolean
  canOpenAdminSettings: boolean
  canReadUsers: boolean
  canCreateUsers: boolean
  canSuspendUsers: boolean
  canUnsuspendUsers: boolean
  canDeleteUsers: boolean
  canAssignRoles: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  canReadAdminAuditLog: boolean
  onOpenDocuments: () => void
  onOpenAssignee: () => void
  onOpenDebug: () => void
  onOpenBenchmark: () => void
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
  onAssignRoles: (userId: string, groups: string[]) => Promise<void>
  onSetUserStatus: (userId: string, action: "suspend" | "unsuspend" | "delete") => Promise<void>
  onRefreshAdminData: () => Promise<void>
  onBack: () => void
}) {
  return (
    <section className="admin-workspace" aria-label="管理者設定">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>管理者設定</h2>
          <span>{user?.groups.join(" / ") || "権限未取得"}</span>
        </div>
      </header>

      <div className="admin-overview-grid">
        {canManageDocuments && (
          <button type="button" className="admin-overview-tile" onClick={onOpenDocuments}>
            <Icon name="document" />
            <strong>ドキュメント管理</strong>
            <span>{documentsCount} 件</span>
          </button>
        )}
        {canAnswerQuestions && (
          <button type="button" className="admin-overview-tile" onClick={onOpenAssignee}>
            <Icon name="inbox" />
            <strong>担当者対応</strong>
            <span>{openQuestionsCount} 件が対応待ち</span>
          </button>
        )}
        {canReadDebugRuns && (
          <button type="button" className="admin-overview-tile" onClick={onOpenDebug}>
            <Icon name="warning" />
            <strong>デバッグ / 評価</strong>
            <span>{debugRunsCount} 件の実行履歴</span>
          </button>
        )}
        {canReadBenchmarkRuns && (
          <button type="button" className="admin-overview-tile" onClick={onOpenBenchmark}>
            <Icon name="gauge" />
            <strong>性能テスト</strong>
            <span>{benchmarkRunsCount} 件の実行履歴</span>
          </button>
        )}
        {canOpenAdminSettings && (
          <div className="admin-overview-tile" aria-label="アクセス管理">
            <Icon name="settings" />
            <strong>アクセス管理</strong>
            <span>{accessRoles.length} role</span>
          </div>
        )}
        {canReadUsers && (
          <div className="admin-overview-tile" aria-label="ユーザー管理">
            <Icon name="settings" />
            <strong>ユーザー管理</strong>
            <span>{managedUsers.length} users</span>
          </div>
        )}
        {canReadUsage && (
          <div className="admin-overview-tile" aria-label="利用状況">
            <Icon name="gauge" />
            <strong>利用状況</strong>
            <span>{usageSummaries.length} users</span>
          </div>
        )}
        {canReadCosts && (
          <div className="admin-overview-tile" aria-label="コスト監査">
            <Icon name="warning" />
            <strong>コスト監査</strong>
            <span>{formatCurrency(costAudit?.totalEstimatedUsd ?? 0)}</span>
          </div>
        )}
      </div>

      <div className="phase2-admin-grid">
        {canReadUsers && (
          <section className="admin-section-panel user-admin-panel" aria-label="ユーザー管理一覧">
            <div className="document-list-head">
              <h3>ユーザー管理</h3>
              <button type="button" onClick={() => void onRefreshAdminData()} disabled={loading}>更新</button>
            </div>
            {canCreateUsers && (
              <AdminCreateUserForm roles={accessRoles} loading={loading} onCreateUser={onCreateUser} />
            )}
            <div className="admin-data-table" role="table" aria-label="ユーザー一覧">
              <div className="admin-user-row admin-user-head" role="row">
                <span role="columnheader">ユーザー</span>
                <span role="columnheader">状態</span>
                <span role="columnheader">ロール</span>
                <span role="columnheader">操作</span>
              </div>
              {managedUsers.length === 0 ? (
                <div className="empty-question-panel">管理対象ユーザーはありません。</div>
              ) : (
                managedUsers.map((managedUser) => (
                  <ManagedUserRow
                    key={managedUser.userId}
                    user={managedUser}
                    roles={accessRoles}
                    loading={loading}
                    canAssignRoles={canAssignRoles}
                    canSuspend={canSuspendUsers}
                    canUnsuspend={canUnsuspendUsers}
                    canDelete={canDeleteUsers}
                    onAssignRoles={onAssignRoles}
                    onSetStatus={onSetUserStatus}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {canOpenAdminSettings && (
          <section className="admin-section-panel" aria-label="ロール定義">
            <div className="document-list-head">
              <h3>ロール定義</h3>
              <span>{accessRoles.length} 件</span>
            </div>
            <div className="role-definition-list">
              {accessRoles.map((role) => (
                <article className="role-definition-card" key={role.role}>
                  <strong>{role.role}</strong>
                  <span>{role.permissions.length} permissions</span>
                  <p>{role.permissions.join(", ")}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {canReadUsage && (
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
        )}

        {canReadCosts && costAudit && (
          <section className="admin-section-panel" aria-label="コスト監査一覧">
            <div className="document-list-head">
              <h3>コスト監査</h3>
              <span>{formatCurrency(costAudit.totalEstimatedUsd)}</span>
            </div>
            <div className="cost-summary-line">
              <span>{formatDate(costAudit.periodStart)} - {formatDate(costAudit.periodEnd)}</span>
              <span>pricing: {formatDate(costAudit.pricingCatalogUpdatedAt)}</span>
            </div>
            <div className="cost-item-list">
              {costAudit.items.map((item) => (
                <article className="cost-item" key={`${item.service}-${item.category}`}>
                  <div>
                    <strong>{item.service}</strong>
                    <span>{item.category}</span>
                  </div>
                  <div>
                    <span>{item.usage} {item.unit}</span>
                    <strong>{formatCurrency(item.estimatedCostUsd)}</strong>
                  </div>
                  <i>{costConfidenceLabel(item.confidence)}</i>
                </article>
              ))}
            </div>
          </section>
        )}

        {canReadAdminAuditLog && (
          <section className="admin-section-panel admin-audit-panel" aria-label="管理操作履歴">
            <div className="document-list-head">
              <h3>管理操作履歴</h3>
              <span>{adminAuditLog.length} 件</span>
            </div>
            <div className="admin-audit-list">
              {adminAuditLog.length === 0 ? (
                <div className="empty-question-panel">管理操作履歴はありません。</div>
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
        )}
      </div>
    </section>
  )
}

function AdminCreateUserForm({
  roles,
  loading,
  onCreateUser
}: {
  roles: AccessRoleDefinition[]
  loading: boolean
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
}) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState("CHAT_USER")

  useEffect(() => {
    if (roles.some((candidate) => candidate.role === role)) return
    setRole(roles[0]?.role ?? "CHAT_USER")
  }, [role, roles])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return
    await onCreateUser({
      email: normalizedEmail,
      displayName: displayName.trim() || undefined,
      groups: [role]
    })
    setEmail("")
    setDisplayName("")
    setRole("CHAT_USER")
  }

  return (
    <form className="admin-create-user-form" aria-label="管理対象ユーザー作成" onSubmit={(event) => void submit(event)}>
      <label>
        <span>メール</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="new-user@example.com" required />
      </label>
      <label>
        <span>表示名</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="任意" />
      </label>
      <label>
        <span>初期ロール</span>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((roleDefinition) => (
            <option value={roleDefinition.role} key={roleDefinition.role}>{roleDefinition.role}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={loading || email.trim().length === 0}>作成</button>
    </form>
  )
}

function ManagedUserRow({
  user,
  roles,
  loading,
  canAssignRoles,
  canSuspend,
  canUnsuspend,
  canDelete,
  onAssignRoles,
  onSetStatus
}: {
  user: ManagedUser
  roles: AccessRoleDefinition[]
  loading: boolean
  canAssignRoles: boolean
  canSuspend: boolean
  canUnsuspend: boolean
  canDelete: boolean
  onAssignRoles: (userId: string, groups: string[]) => Promise<void>
  onSetStatus: (userId: string, action: "suspend" | "unsuspend" | "delete") => Promise<void>
}) {
  const [selectedRole, setSelectedRole] = useState(user.groups[0] ?? "CHAT_USER")

  useEffect(() => {
    setSelectedRole(user.groups[0] ?? "CHAT_USER")
  }, [user.groups])

  return (
    <div className="admin-user-row" role="row">
      <span role="cell">
        <strong>{user.displayName || user.email}</strong>
        <small>{user.email}</small>
      </span>
      <span role="cell">
        <i className={`user-status ${user.status}`}>{managedUserStatusLabel(user.status)}</i>
      </span>
      <span role="cell">
        <div className="role-assignment">
          <select value={selectedRole} disabled={!canAssignRoles || loading} onChange={(event) => setSelectedRole(event.target.value)}>
            {roles.map((role) => (
              <option value={role.role} key={role.role}>{role.role}</option>
            ))}
          </select>
          <button type="button" disabled={!canAssignRoles || loading || user.groups.includes(selectedRole)} onClick={() => void onAssignRoles(user.userId, [selectedRole])}>
            付与
          </button>
        </div>
        <small>{user.groups.join(" / ")}</small>
      </span>
      <span role="cell">
        <div className="user-row-actions">
          {user.status === "suspended" ? (
            <button type="button" disabled={!canUnsuspend || loading} onClick={() => void onSetStatus(user.userId, "unsuspend")}>再開</button>
          ) : (
            <button type="button" disabled={!canSuspend || loading} onClick={() => void onSetStatus(user.userId, "suspend")}>停止</button>
          )}
          <button type="button" disabled={!canDelete || loading} onClick={() => void onSetStatus(user.userId, "delete")}>削除</button>
        </div>
      </span>
    </div>
  )
}
