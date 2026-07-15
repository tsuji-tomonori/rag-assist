import { get } from "../../../shared/api/http.js"
import type { AccessRoleList } from "../types.js"
import { decodeAccessRoleList } from "./adminContract.js"

export async function listAccessRoles(): Promise<AccessRoleList> {
  return decodeAccessRoleList(await get<unknown>("/admin/roles"))
}
