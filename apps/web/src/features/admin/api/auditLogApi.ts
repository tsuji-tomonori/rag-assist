import { get, post } from "../../../shared/api/http.js"
import type { AdminAuditLogQuery, AdminExportArtifact, ManagedUserAuditLogPage } from "../types.js"
import { buildAdminQuery, decodeManagedUserAuditLogPage } from "./adminContract.js"

export async function listAdminAuditLog(query: AdminAuditLogQuery = {}): Promise<ManagedUserAuditLogPage> {
  return decodeManagedUserAuditLogPage(await get<unknown>(`/admin/audit-log${buildAdminQuery(query)}`))
}

export async function createAdminAuditExport(
  query: Omit<AdminAuditLogQuery, "cursor" | "limit">,
  reason: string
): Promise<AdminExportArtifact> {
  return post<AdminExportArtifact>("/admin/audit-log/export", { query, reason })
}
