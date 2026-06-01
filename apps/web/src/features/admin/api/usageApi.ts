import { get } from "../../../shared/api/http.js"
import type { UsageSummaryResponse, UserUsageSummary } from "../types.js"

export async function getUsageSummary(): Promise<UsageSummaryResponse> {
  return get<UsageSummaryResponse>("/admin/usage")
}

export async function listUsageSummaries(): Promise<UserUsageSummary[]> {
  return (await getUsageSummary()).users
}
