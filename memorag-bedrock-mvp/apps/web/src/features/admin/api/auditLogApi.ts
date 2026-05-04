import { get } from "../../../shared/api/http.js"
import type { ManagedUserAuditLogEntry } from "../types.js"

export async function listAdminAuditLog(): Promise<ManagedUserAuditLogEntry[]> {
  const result = await get<{ auditLog?: ManagedUserAuditLogEntry[] }>("/admin/audit-log")
  return result.auditLog ?? []
}
