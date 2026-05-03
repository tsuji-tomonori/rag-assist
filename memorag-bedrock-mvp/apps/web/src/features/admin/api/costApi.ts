import { get } from "../../../shared/api/http.js"
import type { CostAuditSummary } from "../types.js"

export async function getCostAuditSummary(): Promise<CostAuditSummary> {
  return get<CostAuditSummary>("/admin/costs")
}
