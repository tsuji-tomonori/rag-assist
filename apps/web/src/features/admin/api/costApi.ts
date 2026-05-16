import { get } from "../../../shared/api/http.js"
import type { CostAuditSummary } from "../types.js"

export async function getCostAuditSummary(): Promise<CostAuditSummary | null> {
  const result = await get<Partial<CostAuditSummary> | null>("/admin/costs")
  if (!result) return null
  if (
    typeof result.periodStart !== "string" ||
    typeof result.periodEnd !== "string" ||
    result.currency !== "USD" ||
    typeof result.totalEstimatedUsd !== "number" ||
    !Array.isArray(result.items) ||
    !Array.isArray(result.users) ||
    typeof result.pricingCatalogUpdatedAt !== "string"
  ) {
    return null
  }
  return result as CostAuditSummary
}
