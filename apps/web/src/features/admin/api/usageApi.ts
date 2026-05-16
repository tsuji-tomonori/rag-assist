import { get } from "../../../shared/api/http.js"
import type { UserUsageSummary } from "../types.js"

export async function listUsageSummaries(): Promise<UserUsageSummary[] | null> {
  const result = await get<{ users?: UserUsageSummary[] }>("/admin/usage")
  return Array.isArray(result.users) ? result.users : null
}
