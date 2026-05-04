import { get } from "../../../shared/api/http.js"
import type { AccessRoleDefinition } from "../types.js"

export async function listAccessRoles(): Promise<AccessRoleDefinition[]> {
  const result = await get<{ roles?: AccessRoleDefinition[] }>("/admin/roles")
  return result.roles ?? []
}
