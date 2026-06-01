import { get, post } from "../../../shared/api/http.js"
import type { AdminExportArtifact, ManagedUserAuditLogEntry } from "../types.js"

export async function listAdminAuditLog(): Promise<ManagedUserAuditLogEntry[]> {
  const result = await get<{ auditLog?: ManagedUserAuditLogEntry[] }>("/admin/audit-log")
  return result.auditLog ?? []
}

export async function createAdminAuditLogExport(): Promise<AdminExportArtifact> {
  return post<AdminExportArtifact>("/admin/audit-log/export", {})
}
