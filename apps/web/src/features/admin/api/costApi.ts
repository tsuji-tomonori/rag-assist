import { get, post } from "../../../shared/api/http.js"
import type { AdminExportArtifact, CostAuditSummary } from "../types.js"

export async function getCostAuditSummary(): Promise<CostAuditSummary> {
  return get<CostAuditSummary>("/admin/costs")
}

export async function createCostSummaryExport(): Promise<AdminExportArtifact> {
  return post<AdminExportArtifact>("/admin/costs/export", {})
}
