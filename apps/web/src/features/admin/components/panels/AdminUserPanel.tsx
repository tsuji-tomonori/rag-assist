import { type FormEvent, useEffect, useMemo, useState } from "react"
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog.js"
import {
  EmptyState,
  OperationFeedback,
  StatusBadge,
  confirmedOperation,
  failedOperation,
  feedbackFromOutcome,
  processingOperationFeedback,
  upsertOperationFeedback,
  type OperationFeedbackEntry,
  type OperationOutcome
} from "../../../../shared/ui/index.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { managedUserStatusLabel } from "../../../../shared/utils/format.js"
import { managedUserStatusPresentation } from "../../../../shared/ui/displayMetadata.js"
import type { AccessRoleDefinition, ManagedUser, ManagedUserDeletionPreflight } from "../../types.js"

export function AdminUserPanel({
  managedUsers,
  accessRoles,
  usersLoadFailed = false,
  rolesLoadFailed = false,
  loading,
  canCreateUsers,
  canAssignRoles,
  canSuspendUsers,
  canUnsuspendUsers,
  canDeleteUsers,
  onCreateUser,
  onAssignRoles,
  onPrepareUserDelete,
  onSetUserStatus,
  onRefreshAdminData
}: {
  managedUsers: ManagedUser[] | null
  accessRoles: AccessRoleDefinition[] | null
  usersLoadFailed?: boolean
  rolesLoadFailed?: boolean
  loading: boolean
  canCreateUsers: boolean
  canAssignRoles: boolean
  canSuspendUsers: boolean
  canUnsuspendUsers: boolean
  canDeleteUsers: boolean
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
  onAssignRoles: (userId: string, groups: string[], reason: string) => Promise<OperationOutcome<ManagedUser> | void>
  onPrepareUserDelete: (userId: string) => Promise<ManagedUserDeletionPreflight | null>
  onSetUserStatus: (userId: string, action: "suspend" | "unsuspend" | "delete", successorUserId?: string) => Promise<OperationOutcome<ManagedUser> | void>
  onRefreshAdminData: () => Promise<void>
}) {
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackEntry[]>([])

  function recordOperationFeedback(entry: OperationFeedbackEntry) {
    setOperationFeedback((current) => upsertOperationFeedback(current, entry))
  }

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
        <AdminCreateUserForm roles={accessRoles} rolesLoadFailed={rolesLoadFailed} loading={loading} onCreateUser={onCreateUser} />
      )}
      {operationFeedback.length > 0 && (
        <div className="admin-operation-feedback" aria-label="ユーザー管理操作結果">
          {operationFeedback.slice(0, 3).map((entry) => <OperationFeedback key={entry.id} entry={entry} />)}
        </div>
      )}
      <div className="admin-data-table" role="table" aria-label="ユーザー一覧">
        <div className="admin-user-row admin-user-head" role="row">
          <span role="columnheader">ユーザー</span>
          <span role="columnheader">状態</span>
          <span role="columnheader">ロール</span>
          <span role="columnheader">操作</span>
        </div>
        {managedUsers === null ? (
          <EmptyState
            title={usersLoadFailed ? "管理対象ユーザーを取得できませんでした。" : "管理対象ユーザー API field は未提供です。"}
            description={usersLoadFailed ? "画面上部の状態メッセージから再試行してください。" : "権限内の API response に users field がありません。"}
          />
        ) : managedUsers.length === 0 ? (
          <EmptyState title="管理対象ユーザーはありません。" />
        ) : (
          managedUsers.map((managedUser) => (
            <ManagedUserRow
              key={managedUser.userId}
              user={managedUser}
              roles={accessRoles}
              rolesLoadFailed={rolesLoadFailed}
              loading={loading}
              canAssignRoles={canAssignRoles}
              canSuspend={canSuspendUsers}
              canUnsuspend={canUnsuspendUsers}
              canDelete={canDeleteUsers}
              onAssignRoles={onAssignRoles}
              onPrepareDelete={onPrepareUserDelete}
              onSetStatus={onSetUserStatus}
              onOperationFeedback={recordOperationFeedback}
            />
          ))
        )}
      </div>
    </section>
  )
}

function AdminCreateUserForm({
  roles,
  rolesLoadFailed,
  loading,
  onCreateUser
}: {
  roles: AccessRoleDefinition[] | null
  rolesLoadFailed: boolean
  loading: boolean
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
}) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState("")

  useEffect(() => {
    if (!roles) {
      setRole("")
      return
    }
    if (roles.some((candidate) => candidate.role === role)) return
    setRole(roles[0]?.role ?? "")
  }, [role, roles])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return
    await onCreateUser({
      email: normalizedEmail,
      displayName: displayName.trim() || undefined,
      groups: role ? [role] : undefined
    })
    setEmail("")
    setDisplayName("")
    setRole(roles?.[0]?.role ?? "")
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
        {roles === null ? (
          <span className="admin-field-unavailable">{rolesLoadFailed ? "取得失敗" : "未提供"}</span>
        ) : roles.length === 0 ? (
          <span className="admin-field-unavailable">選択可能なロールはありません</span>
        ) : (
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {roles.map((roleDefinition) => (
              <option value={roleDefinition.role} key={roleDefinition.role}>{roleDefinition.role}</option>
            ))}
          </select>
        )}
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
  rolesLoadFailed,
  loading,
  canAssignRoles,
  canSuspend,
  canUnsuspend,
  canDelete,
  onAssignRoles,
  onPrepareDelete,
  onSetStatus,
  onOperationFeedback
}: {
  user: ManagedUser
  roles: AccessRoleDefinition[] | null
  rolesLoadFailed: boolean
  loading: boolean
  canAssignRoles: boolean
  canSuspend: boolean
  canUnsuspend: boolean
  canDelete: boolean
  onAssignRoles: (userId: string, groups: string[], reason: string) => Promise<OperationOutcome<ManagedUser> | void>
  onPrepareDelete: (userId: string) => Promise<ManagedUserDeletionPreflight | null>
  onSetStatus: (userId: string, action: "suspend" | "unsuspend" | "delete", successorUserId?: string) => Promise<OperationOutcome<ManagedUser> | void>
  onOperationFeedback: (entry: OperationFeedbackEntry) => void
}) {
  const availableRoles = useMemo(() => roles ?? [], [roles])
  const [selectedRole, setSelectedRole] = useState(user.groups[0] ?? availableRoles[0]?.role ?? "")
  const [statusCandidate, setStatusCandidate] = useState<"suspend" | "delete" | null>(null)
  const [deletionPreflight, setDeletionPreflight] = useState<ManagedUserDeletionPreflight | null>(null)
  const [successorUserId, setSuccessorUserId] = useState("")
  const [roleAssignOpen, setRoleAssignOpen] = useState(false)
  const [roleReason, setRoleReason] = useState("")
  const canShowRoleAssignment = canAssignRoles && availableRoles.length > 0
  const nextGroups = selectedRole ? [selectedRole] : []
  const roleChanged = canShowRoleAssignment && selectedRole !== "" && (!user.groups.includes(selectedRole) || user.groups.length !== nextGroups.length)
  const canShowSuspendAction = user.status === "suspended" ? canUnsuspend : canSuspend
  const canShowDeleteAction = canDelete
  const eligibleSuccessors = useMemo(
    () => (deletionPreflight?.eligibleSuccessors ?? []).filter((candidate) => candidate.status === "active" && candidate.userId !== user.userId),
    [deletionPreflight, user.userId]
  )

  async function prepareDelete() {
    const preflight = await onPrepareDelete(user.userId)
    if (!preflight || preflight.targetUserId !== user.userId) return
    setDeletionPreflight(preflight)
    setSuccessorUserId("")
    setStatusCandidate("delete")
  }

  function closeStatusDialog() {
    setStatusCandidate(null)
    setDeletionPreflight(null)
    setSuccessorUserId("")
  }

  async function applyStatus(action: "suspend" | "unsuspend" | "delete", successor?: string) {
    const actionLabel = action === "suspend" ? "ユーザー停止" : action === "unsuspend" ? "ユーザー再開" : "ユーザー削除"
    const impact = action === "suspend"
      ? "対象ユーザーのアプリ利用を停止"
      : action === "unsuspend"
        ? "対象ユーザーのアプリ利用を再開"
        : "所有資源を確認・移管して恒久削除"
    const recovery = action === "delete" ? "恒久削除後はこの画面から復元不可" : action === "suspend" ? "再開権限を持つ管理者が再開可能" : "再度停止可能"
    const base = {
      id: `admin-user-${action}-${user.userId}`,
      actionLabel,
      targetLabel: user.displayName || user.email,
      targetId: user.userId,
      details: [
        { label: "影響", value: impact },
        { label: "回復条件", value: recovery }
      ],
      showUnavailableEvidence: true
    }
    onOperationFeedback(processingOperationFeedback(base))
    const outcome = await resolveOperation(() => successor
      ? onSetStatus(user.userId, action, successor)
      : onSetStatus(user.userId, action))
    onOperationFeedback(feedbackFromOutcome(base, outcome))
    return outcome
  }

  useEffect(() => {
    const currentRole = user.groups[0]
    if (currentRole && availableRoles.some((role) => role.role === currentRole)) {
      setSelectedRole(currentRole)
      return
    }
    setSelectedRole(availableRoles[0]?.role ?? "")
  }, [availableRoles, user.groups])

  return (
    <div className="admin-user-row" role="row">
      <span role="cell">
        <strong>{user.displayName || user.email}</strong>
        <small>{user.email}</small>
      </span>
      <span role="cell">
        <StatusBadge presentation={managedUserStatusPresentation(user.status)} />
      </span>
      <span role="cell">
        {canShowRoleAssignment && (
          <div className="role-assignment">
            <select value={selectedRole} disabled={loading} aria-label={`${user.email}に付与するロール`} onChange={(event) => setSelectedRole(event.target.value)}>
              {availableRoles.map((role) => (
                <option value={role.role} key={role.role}>{role.role}</option>
              ))}
            </select>
            <button type="button" disabled={loading || !roleChanged || roleReason.trim().length === 0} onClick={() => setRoleAssignOpen(true)}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>付与</span>
            </button>
            <input
              value={roleReason}
              maxLength={1000}
              disabled={loading}
              aria-label={`${user.email}のロール変更理由`}
              placeholder="変更理由（必須）"
              onChange={(event) => setRoleReason(event.target.value)}
            />
          </div>
        )}
        {roles === null && <small>{rolesLoadFailed ? "ロール定義を取得できませんでした" : "ロール定義は未提供"}</small>}
        {roleChanged && (
          <small className="role-diff-preview">変更前: {formatGroupList(user.groups)} / 変更後: {formatGroupList(nextGroups)}</small>
        )}
        <small>{formatGroupList(user.groups)}</small>
      </span>
      <span role="cell">
        <div className="user-row-actions">
          {canShowSuspendAction && (user.status === "suspended" ? (
            <button type="button" disabled={loading} onClick={() => void applyStatus("unsuspend")}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>再開</span>
            </button>
          ) : (
            <button type="button" disabled={loading} onClick={() => setStatusCandidate("suspend")}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>停止</span>
            </button>
          ))}
          {canShowDeleteAction && <button type="button" disabled={loading} onClick={() => void prepareDelete()}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>削除</span>
          </button>}
          {!canShowSuspendAction && !canShowDeleteAction && <span className="admin-field-unavailable">利用可能な操作はありません</span>}
        </div>
      </span>
      {statusCandidate && (
        <ConfirmDialog
          title={statusCandidate === "suspend" ? "このユーザーを停止しますか？" : "このユーザーを削除状態にしますか？"}
          description={statusCandidate === "suspend"
            ? "停止するとこのユーザーはアプリを利用できなくなります。"
            : deletionPreflight?.requiresSuccessor
              ? "所有資源を後継管理者へ移管した後、このユーザーを恒久削除します。"
              : "所有資源がないことを確認済みです。このユーザーを恒久削除します。"}
          details={[
            `ユーザー: ${user.displayName || user.email}`,
            `メール: ${user.email}`,
            `現在の状態: ${managedUserStatusLabel(user.status)}`,
            statusCandidate === "suspend"
              ? "回復条件: 再開権限を持つ管理者が再開できます"
              : "回復条件: 恒久削除後はこの画面から復元できません",
            statusCandidate === "suspend"
              ? "確認が必要な理由: 対象ユーザーの利用を直ちに停止するため"
              : "確認が必要な理由: 所有資源と管理主体を失わないため",
            ...(statusCandidate === "delete" && deletionPreflight
              ? [
                  `所有フォルダ: ${deletionPreflight.ownedResources.folders}`,
                  `所有リソースグループ: ${deletionPreflight.ownedResources.resourceGroups}`,
                  `所有文書: ${deletionPreflight.ownedResources.documents}`
                ]
              : [])
          ]}
          confirmLabel={statusCandidate === "suspend" ? "停止" : "削除"}
          tone="danger"
          loading={loading}
          confirmDisabled={statusCandidate === "delete" && (
            !deletionPreflight || deletionPreflight.requiresSuccessor && successorUserId.length === 0
          )}
          onCancel={closeStatusDialog}
          onConfirm={async () => {
            if (statusCandidate === "delete" && deletionPreflight?.requiresSuccessor && !successorUserId) return
            const outcome = await applyStatus(statusCandidate, statusCandidate === "delete" ? successorUserId || undefined : undefined)
            if (outcome.ok) closeStatusDialog()
          }}
        >
          {statusCandidate === "delete" && deletionPreflight?.requiresSuccessor && (
            <div className="admin-successor-selection">
              <label htmlFor={`successor-${user.userId}`}>後継管理者</label>
              {eligibleSuccessors.length > 0 ? (
                <select
                  id={`successor-${user.userId}`}
                  aria-label={`${user.email}の後継管理者`}
                  value={successorUserId}
                  disabled={loading}
                  onChange={(event) => setSuccessorUserId(event.target.value)}
                  required
                >
                  <option value="">選択してください</option>
                  {eligibleSuccessors.map((candidate) => (
                    <option value={candidate.userId} key={candidate.userId}>
                      {candidate.displayName ? `${candidate.displayName} (${candidate.email})` : candidate.email}
                    </option>
                  ))}
                </select>
              ) : (
                <span role="status">有効かつ同一テナントの後継候補がありません。削除は実行できません。</span>
              )}
            </div>
          )}
        </ConfirmDialog>
      )}
      {roleAssignOpen && (
        <ConfirmDialog
          title="ロールを付与しますか？"
          description="変更前後の差分と監査に記録する理由を確認してから確定します。"
          details={[
            `ユーザー: ${user.displayName || user.email}`,
            `メール: ${user.email}`,
            `変更前: ${formatGroupList(user.groups)}`,
            `変更後: ${formatGroupList(nextGroups)}`,
            `理由: ${roleReason.trim() || "未入力"}`,
            "影響: 対象ユーザーの利用可能な管理・操作権限が変わります",
            "回復条件: 最新 role set を確認し、理由付きで再変更できます",
            "確認が必要な理由: 自己昇格や管理者不在を server guard で拒否する高権限操作のため"
          ]}
          confirmLabel="付与"
          tone="warning"
          loading={loading}
          onCancel={() => setRoleAssignOpen(false)}
          onConfirm={async () => {
            const reason = roleReason.trim()
            if (!reason) return
            const base = {
              id: `admin-role-${user.userId}`,
              actionLabel: "ロール変更",
              targetLabel: user.displayName || user.email,
              targetId: user.userId,
              reason,
              details: [
                { label: "影響", value: `${formatGroupList(user.groups)} から ${formatGroupList(nextGroups)} へ権限を変更` },
                { label: "回復条件", value: "最新 role set を確認して理由付きで再変更" }
              ],
              showUnavailableEvidence: true
            }
            onOperationFeedback(processingOperationFeedback(base))
            const outcome = await resolveOperation(() => onAssignRoles(user.userId, nextGroups, reason))
            onOperationFeedback(feedbackFromOutcome(base, outcome))
            if (outcome.ok) {
              setRoleReason("")
              setRoleAssignOpen(false)
            }
          }}
        />
      )}
    </div>
  )
}

function formatGroupList(groups: string[]) {
  return groups.length > 0 ? groups.join(" / ") : "未設定"
}

async function resolveOperation<T>(operation: () => Promise<OperationOutcome<T> | void>): Promise<OperationOutcome<T>> {
  try {
    return await operation() ?? confirmedOperation<T>()
  } catch (error) {
    return failedOperation(error)
  }
}
