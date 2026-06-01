import { get } from "../../../shared/api/http.js"
import type { AccessRoleDefinition } from "../types.js"

export async function listAccessRoles(): Promise<AccessRoleDefinition[] | null> {
  const result = await get<{ roles?: AccessRoleDefinition[] }>("/admin/roles")
  return Array.isArray(result.roles) ? result.roles : null
}
