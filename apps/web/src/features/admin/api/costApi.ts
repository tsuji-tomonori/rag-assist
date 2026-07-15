import { get, post } from "../../../shared/api/http.js"
import type { AdminExportArtifact, CostAuditSummary, UsageQuery } from "../types.js"
import { buildUsageQuery } from "./usageApi.js"

export async function getCostAuditSummary(query: UsageQuery = {}): Promise<CostAuditSummary | null> {
  const result = await get<Partial<CostAuditSummary> | null>(`/admin/costs${buildUsageQuery(query)}`)
  if (!result) return null
  if (
    result.currency !== "USD" ||
    typeof result.pricedCostUsd !== "number" ||
    !Array.isArray(result.items) ||
    !Array.isArray(result.catalogVersions) ||
    !result.completeness ||
    !result.query
  ) {
    return null
  }
  return result as CostAuditSummary
}

export async function createCostExport(query: Omit<UsageQuery, "cursor" | "limit">, reason: string): Promise<AdminExportArtifact> {
  return post<AdminExportArtifact>("/admin/costs/export", { query, reason })
}
