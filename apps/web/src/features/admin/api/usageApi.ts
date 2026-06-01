import { get } from "../../../shared/api/http.js"
import type { UsageSummaryResponse, UserUsageSummary } from "../types.js"

export async function getUsageSummary(): Promise<UsageSummaryResponse | null> {
  const result = await get<Partial<UsageSummaryResponse> | null>("/admin/usage")
  if (!result) return null
  if (
    typeof result.periodStart !== "string" ||
    typeof result.periodEnd !== "string" ||
    !Array.isArray(result.users) ||
    !result.breakdowns ||
    !result.totals ||
    !result.dataCompleteness
  ) {
    return null
  }
  return result as UsageSummaryResponse
}

export async function listUsageSummaries(): Promise<UserUsageSummary[] | null> {
  const result = await getUsageSummary()
  return result?.users ?? null
}
