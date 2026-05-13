import { get } from "../../../shared/api/http.js"
import type { UserUsageSummary } from "../types.js"

export async function listUsageSummaries(): Promise<UserUsageSummary[]> {
  const result = await get<{ users?: UserUsageSummary[] }>("/admin/usage")
  return result.users ?? []
}
