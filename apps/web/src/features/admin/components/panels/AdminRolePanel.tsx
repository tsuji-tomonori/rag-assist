import { EmptyState } from "../../../../shared/ui/index.js"
import type { AccessRoleDefinition } from "../../types.js"

export function AdminRolePanel({ accessRoles, loadFailed = false }: { accessRoles: AccessRoleDefinition[] | null; loadFailed?: boolean }) {
  return (
    <section className="admin-section-panel" aria-label="ロール定義">
      <div className="document-list-head">
        <h3>ロール定義</h3>
        <span>{accessRoles ? `${accessRoles.length} 件` : loadFailed ? "取得失敗" : "未提供"}</span>
      </div>
      <p className="admin-panel-note">ロール定義は現行 API の read-only preset です。custom role editor と resource-level folder permission は未提供です。</p>
      <div className="role-definition-list">
        {accessRoles === null ? (
          <EmptyState
            title={loadFailed ? "ロール定義を取得できませんでした。" : "ロール定義 API field は未提供です。"}
            description={loadFailed ? "画面上部の状態メッセージから再試行してください。" : "権限内の API response に roles field がありません。"}
          />
        ) : accessRoles.length === 0 ? (
          <EmptyState title="ロール定義はありません。" />
        ) : accessRoles.map((role) => (
          <article className="role-definition-card" key={role.role}>
            <strong>{role.role}</strong>
            <span>{role.permissions.length} permissions</span>
            <p>{role.permissions.join(", ")}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
