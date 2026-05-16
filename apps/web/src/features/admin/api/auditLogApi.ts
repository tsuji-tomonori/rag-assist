import { get } from "../../../shared/api/http.js"
import type { ManagedUserAuditLogEntry } from "../types.js"

export async function listAdminAuditLog(): Promise<ManagedUserAuditLogEntry[] | null> {
  const result = await get<{ auditLog?: ManagedUserAuditLogEntry[] }>("/admin/audit-log")
  return Array.isArray(result.auditLog) ? result.auditLog : null
}
