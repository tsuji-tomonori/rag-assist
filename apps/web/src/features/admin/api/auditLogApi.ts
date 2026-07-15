import { get } from "../../../shared/api/http.js"
import type { AdminAuditLogQuery, ManagedUserAuditLogPage } from "../types.js"
import { buildAdminQuery, decodeManagedUserAuditLogPage } from "./adminContract.js"

export async function listAdminAuditLog(query: AdminAuditLogQuery = {}): Promise<ManagedUserAuditLogPage> {
  return decodeManagedUserAuditLogPage(await get<unknown>(`/admin/audit-log${buildAdminQuery(query)}`))
}
