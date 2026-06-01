import { get, post } from "../../../shared/api/http.js"
import type { AdminExportArtifact, ManagedUserAuditLogEntry } from "../types.js"

export async function listAdminAuditLog(): Promise<ManagedUserAuditLogEntry[] | null> {
  const result = await get<{ auditLog?: ManagedUserAuditLogEntry[] }>("/admin/audit-log")
  return Array.isArray(result.auditLog) ? result.auditLog : null
}

export async function createAdminAuditLogExport(): Promise<AdminExportArtifact> {
  return post<AdminExportArtifact>("/admin/audit-log/export", {})
}
