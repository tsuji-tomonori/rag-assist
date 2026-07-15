import { EmptyState } from "../../../../shared/ui/index.js"
import type { UiResourcePartState } from "../../../../shared/ui/ResourceState.js"
import type { AccessRoleList } from "../../types.js"
import { AdminPanelDataStatus } from "../AdminPanelDataStatus.js"

export function AdminRolePanel({
  accessRoleList,
  part,
  loading,
  onRefresh
}: {
  accessRoleList: AccessRoleList | null
  part?: UiResourcePartState
  loading: boolean
  onRefresh: () => Promise<void>
}) {
  const roles = accessRoleList?.roles ?? null
  const loadFailed = part?.status === "failed" || part?.status === "permission"
  return (
    <section className="admin-section-panel" aria-label="アプリケーションロール定義">
      <div className="document-list-head">
        <h3>アプリケーションロール</h3>
        <span>{roles ? `${roles.length} 件` : loadFailed ? "取得失敗" : "未確認"}</span>
      </div>
      <AdminPanelDataStatus
        label="ロール定義"
        part={part}
        source={accessRoleList?.source}
        asOf={accessRoleList?.asOf}
        loading={loading}
        onRefresh={onRefresh}
      />
      <p className="admin-panel-note">
        ここではアプリケーションロールの system preset を読み取り専用で表示します。リソースグループは文書へのアクセス範囲を表す別の概念で、この一覧の編集対象ではありません。
      </p>
      <ul className="role-definition-list">
        {roles === null ? (
          <li>
            <EmptyState
              title={loadFailed ? "ロール定義を取得できませんでした。" : "ロール定義をまだ確認できません。"}
              description={loadFailed ? "ロール定義の更新を試してください。" : "管理 API の取得完了後に表示します。"}
            />
          </li>
        ) : roles.length === 0 ? (
          <li><EmptyState title="ロール定義はありません。" /></li>
        ) : roles.map((role) => {
          const categories = [...new Set(role.permissions.map(permissionCategory))]
          return (
            <li className="role-definition-card" key={role.role}>
              <strong>{role.displayName}</strong>
              <span>{role.description}</span>
              <small>種別: system preset / 識別子: <code>{role.role}</code></small>
              <small>権限カテゴリ: {categories.length > 0 ? categories.join("、") : "なし"}</small>
              <details>
                <summary>権限 ID {role.permissions.length} 件を表示</summary>
                <ul>
                  {role.permissions.map((permission) => <li key={permission}><code>{permission}</code></li>)}
                </ul>
              </details>
            </li>
          )
        })}
      </ul>
      {accessRoleList && <small>カタログ version: <code>{accessRoleList.catalogVersion}</code></small>}
    </section>
  )
}

function permissionCategory(permission: string): string {
  return permission.split(/[:.]/, 1)[0] || "その他"
}
