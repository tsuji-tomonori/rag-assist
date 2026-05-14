import { type FormEvent, useEffect, useState } from "react"
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog.js"
import { EmptyState } from "../../../../shared/ui/index.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { managedUserStatusLabel } from "../../../../shared/utils/format.js"
import type { AccessRoleDefinition, ManagedUser } from "../../types.js"

export function AdminUserPanel({
  managedUsers,
  accessRoles,
  loading,
  canCreateUsers,
  canAssignRoles,
  canSuspendUsers,
  canUnsuspendUsers,
  canDeleteUsers,
  onCreateUser,
  onAssignRoles,
  onSetUserStatus,
  onRefreshAdminData
}: {
  managedUsers: ManagedUser[]
  accessRoles: AccessRoleDefinition[]
  loading: boolean
  canCreateUsers: boolean
  canAssignRoles: boolean
  canSuspendUsers: boolean
  canUnsuspendUsers: boolean
  canDeleteUsers: boolean
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
  onAssignRoles: (userId: string, groups: string[]) => Promise<void>
  onSetUserStatus: (userId: string, action: "suspend" | "unsuspend" | "delete") => Promise<void>
  onRefreshAdminData: () => Promise<void>
}) {
  return (
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
          <EmptyState title="管理対象ユーザーはありません。" />
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
  const [statusCandidate, setStatusCandidate] = useState<"suspend" | "delete" | null>(null)
  const [roleAssignOpen, setRoleAssignOpen] = useState(false)
  const nextGroups = [selectedRole]
  const roleChanged = !user.groups.includes(selectedRole) || user.groups.length !== nextGroups.length

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
          <button type="button" disabled={!canAssignRoles || loading || !roleChanged} onClick={() => setRoleAssignOpen(true)}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>付与</span>
          </button>
        </div>
        {roleChanged && (
          <small className="role-diff-preview">変更前: {formatGroupList(user.groups)} / 変更後: {formatGroupList(nextGroups)}</small>
        )}
        <small>{formatGroupList(user.groups)}</small>
      </span>
      <span role="cell">
        <div className="user-row-actions">
          {user.status === "suspended" ? (
            <button type="button" disabled={!canUnsuspend || loading} onClick={() => void onSetStatus(user.userId, "unsuspend")}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>再開</span>
            </button>
          ) : (
            <button type="button" disabled={!canSuspend || loading} onClick={() => setStatusCandidate("suspend")}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>停止</span>
            </button>
          )}
          <button type="button" disabled={!canDelete || loading} onClick={() => setStatusCandidate("delete")}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>削除</span>
          </button>
        </div>
      </span>
      {statusCandidate && (
        <ConfirmDialog
          title={statusCandidate === "suspend" ? "このユーザーを停止しますか？" : "このユーザーを削除状態にしますか？"}
          description={statusCandidate === "suspend" ? "停止するとこのユーザーはアプリを利用できなくなります。" : "削除するとこのユーザーの管理対象レコードを削除します。"}
          details={[`ユーザー: ${user.displayName || user.email}`, `メール: ${user.email}`, `現在の状態: ${managedUserStatusLabel(user.status)}`]}
          confirmLabel={statusCandidate === "suspend" ? "停止" : "削除"}
          tone="danger"
          loading={loading}
          onCancel={() => setStatusCandidate(null)}
          onConfirm={async () => {
            await onSetStatus(user.userId, statusCandidate)
            setStatusCandidate(null)
          }}
        />
      )}
      {roleAssignOpen && (
        <ConfirmDialog
          title="ロールを付与しますか？"
          description="変更前後の差分を確認してから付与します。理由入力と保存は API 未対応のため、この画面では保存しません。"
          details={[
            `ユーザー: ${user.displayName || user.email}`,
            `メール: ${user.email}`,
            `変更前: ${formatGroupList(user.groups)}`,
            `変更後: ${formatGroupList(nextGroups)}`
          ]}
          confirmLabel="付与"
          tone="warning"
          loading={loading}
          onCancel={() => setRoleAssignOpen(false)}
          onConfirm={async () => {
            await onAssignRoles(user.userId, nextGroups)
            setRoleAssignOpen(false)
          }}
        />
      )}
    </div>
  )
}

function formatGroupList(groups: string[]) {
  return groups.length > 0 ? groups.join(" / ") : "未設定"
}
