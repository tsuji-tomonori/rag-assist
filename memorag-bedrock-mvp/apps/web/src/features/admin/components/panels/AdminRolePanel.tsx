import type { AccessRoleDefinition } from "../../types.js"

export function AdminRolePanel({ accessRoles }: { accessRoles: AccessRoleDefinition[] }) {
  return (
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
  )
}
