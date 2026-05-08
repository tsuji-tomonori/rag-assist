import { type FormEvent, useEffect, useState } from "react"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { AccessRoleDefinition, AliasAuditLogItem, AliasDefinition, CostAuditSummary, ManagedUser, ManagedUserAuditLogEntry, UserUsageSummary } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
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
  aliases,
  aliasAuditLog,
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
  canManageAliases,
  canReadAliases,
  canWriteAliases,
  canReviewAliases,
  canDisableAliases,
  canPublishAliases,
  onOpenDocuments,
  onOpenAssignee,
  onOpenDebug,
  onOpenBenchmark,
  onCreateUser,
  onAssignRoles,
  onSetUserStatus,
  onRefreshAdminData,
  onCreateAlias,
  onUpdateAlias,
  onReviewAlias,
  onDisableAlias,
  onPublishAliases,
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
  aliases: AliasDefinition[]
  aliasAuditLog: AliasAuditLogItem[]
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
  canManageAliases: boolean
  canReadAliases: boolean
  canWriteAliases: boolean
  canReviewAliases: boolean
  canDisableAliases: boolean
  canPublishAliases: boolean
  onOpenDocuments: () => void
  onOpenAssignee: () => void
  onOpenDebug: () => void
  onOpenBenchmark: () => void
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
  onAssignRoles: (userId: string, groups: string[]) => Promise<void>
  onSetUserStatus: (userId: string, action: "suspend" | "unsuspend" | "delete") => Promise<void>
  onRefreshAdminData: () => Promise<void>
  onCreateAlias: (input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onUpdateAlias: (aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onReviewAlias: (aliasId: string, decision: "approve" | "reject", comment?: string) => Promise<void>
  onDisableAlias: (aliasId: string) => Promise<void>
  onPublishAliases: () => Promise<void>
  onBack: () => void
}) {
  return (
    <section className="admin-workspace" aria-label="管理者設定">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>管理者設定</h2>
          <span>{user?.groups.join(" / ") || "権限未取得"}</span>
        </div>
      </header>
      {loading && <LoadingStatus label="管理APIを処理中" />}

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
        {canManageAliases && (
          <div className="admin-overview-tile" aria-label="Alias管理">
            <Icon name="settings" />
            <strong>Alias管理</strong>
            <span>{aliases.length} aliases</span>
          </div>
        )}
      </div>

      <div className="phase2-admin-grid">
        {canReadAliases && (
          <AliasAdminPanel
            aliases={aliases}
            auditLog={aliasAuditLog}
            loading={loading}
            canWrite={canWriteAliases}
            canReview={canReviewAliases}
            canDisable={canDisableAliases}
            canPublish={canPublishAliases}
            onCreate={onCreateAlias}
            onUpdate={onUpdateAlias}
            onReview={onReviewAlias}
            onDisable={onDisableAlias}
            onPublish={onPublishAliases}
          />
        )}

        {canReadUsers && (
          <section className="admin-section-panel user-admin-panel" aria-label="ユーザー管理一覧">
            <div className="document-list-head">
              <h3>ユーザー管理</h3>
              <button type="button" onClick={() => void onRefreshAdminData()} disabled={loading}>
                {loading && <LoadingSpinner className="button-spinner" />}
                <span>更新</span>
              </button>
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

function AliasAdminPanel({
  aliases,
  auditLog,
  loading,
  canWrite,
  canReview,
  canDisable,
  canPublish,
  onCreate,
  onUpdate,
  onReview,
  onDisable,
  onPublish
}: {
  aliases: AliasDefinition[]
  auditLog: AliasAuditLogItem[]
  loading: boolean
  canWrite: boolean
  canReview: boolean
  canDisable: boolean
  canPublish: boolean
  onCreate: (input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onUpdate: (aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onReview: (aliasId: string, decision: "approve" | "reject", comment?: string) => Promise<void>
  onDisable: (aliasId: string) => Promise<void>
  onPublish: () => Promise<void>
}) {
  const [term, setTerm] = useState("")
  const [expansions, setExpansions] = useState("")
  const [department, setDepartment] = useState("")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    const normalizedTerm = term.trim()
    const values = parseExpansionList(expansions)
    if (!normalizedTerm || values.length === 0) return
    await onCreate({
      term: normalizedTerm,
      expansions: values,
      scope: department.trim() ? { department: department.trim() } : undefined
    })
    setTerm("")
    setExpansions("")
    setDepartment("")
  }

  return (
    <section className="admin-section-panel alias-admin-panel" aria-label="Alias管理一覧">
      <div className="document-list-head">
        <h3>Alias管理</h3>
        <div className="inline-action-group">
          <span>{aliases.length} 件</span>
          <button type="button" disabled={!canPublish || loading} onClick={() => void onPublish()}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>公開</span>
          </button>
        </div>
      </div>

      {canWrite && (
        <form className="alias-editor-form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            <span>用語</span>
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="pto" disabled={loading} />
          </label>
          <label>
            <span>展開語</span>
            <input value={expansions} onChange={(event) => setExpansions(event.target.value)} placeholder="有給休暇, 休暇申請" disabled={loading} />
          </label>
          <label>
            <span>部署 scope</span>
            <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="任意" disabled={loading} />
          </label>
          <button type="submit" disabled={loading || !term.trim() || parseExpansionList(expansions).length === 0}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>追加</span>
          </button>
        </form>
      )}

      <div className="alias-list">
        {aliases.length === 0 ? (
          <div className="empty-question-panel">登録済み alias はありません。</div>
        ) : (
          aliases.map((alias) => (
            <article className={`alias-card ${alias.status}`} key={alias.aliasId}>
              <div>
                <strong>{alias.term}</strong>
                <span>{alias.expansions.join(", ")}</span>
                <small>{alias.scope?.department ? `department: ${alias.scope.department}` : "global"} / {alias.publishedVersion ?? alias.status}</small>
              </div>
              <div className="inline-action-group">
                <button type="button" disabled={!canWrite || loading || alias.status === "disabled"} onClick={() => void onUpdate(alias.aliasId, { expansions: alias.expansions })}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>下書き化</span>
                </button>
                <button type="button" disabled={!canReview || loading || alias.status === "disabled"} onClick={() => void onReview(alias.aliasId, "approve")}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>承認</span>
                </button>
                <button type="button" disabled={!canReview || loading || alias.status === "disabled"} onClick={() => void onReview(alias.aliasId, "reject", "Rejected from UI")}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>差戻</span>
                </button>
                <button type="button" disabled={!canDisable || loading || alias.status === "disabled"} onClick={() => void onDisable(alias.aliasId)}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>無効</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="alias-audit-list" aria-label="Alias監査ログ">
        {auditLog.slice(0, 8).map((item) => (
          <div key={item.auditId}>
            <span>{formatDateTime(item.createdAt)}</span>
            <strong>{item.action}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
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
      <button type="submit" disabled={loading || email.trim().length === 0}>
        {loading && <LoadingSpinner className="button-spinner" />}
        <span>作成</span>
      </button>
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
          <select value={selectedRole} disabled={!canAssignRoles || loading} aria-label={`${user.email}に付与するロール`} onChange={(event) => setSelectedRole(event.target.value)}>
            {roles.map((role) => (
              <option value={role.role} key={role.role}>{role.role}</option>
            ))}
          </select>
          <button type="button" disabled={!canAssignRoles || loading || user.groups.includes(selectedRole)} onClick={() => void onAssignRoles(user.userId, [selectedRole])}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>付与</span>
          </button>
        </div>
        <small>{user.groups.join(" / ")}</small>
      </span>
      <span role="cell">
        <div className="user-row-actions">
          {user.status === "suspended" ? (
            <button type="button" disabled={!canUnsuspend || loading} onClick={() => void onSetStatus(user.userId, "unsuspend")}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>再開</span>
            </button>
          ) : (
            <button type="button" disabled={!canSuspend || loading} onClick={() => void onSetStatus(user.userId, "suspend")}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>停止</span>
            </button>
          )}
          <button type="button" disabled={!canDelete || loading} onClick={() => void onSetStatus(user.userId, "delete")}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>削除</span>
          </button>
        </div>
      </span>
    </div>
  )
}

function parseExpansionList(value: string): string[] {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))]
}
