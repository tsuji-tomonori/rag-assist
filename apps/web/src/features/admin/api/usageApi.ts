import { get, post } from "../../../shared/api/http.js"
import type { AdminExportArtifact, UsageQuery, UsageSummaryPage } from "../types.js"

export async function listUsageSummaries(query: UsageQuery = {}): Promise<UsageSummaryPage | null> {
  const result = await get<UsageSummaryPage | null>(`/admin/usage${buildUsageQuery(query)}`)
  return result && Array.isArray(result.events) && result.completeness && result.breakdowns ? result : null
}

export async function createUsageExport(query: Omit<UsageQuery, "cursor" | "limit">, reason: string): Promise<AdminExportArtifact> {
  return post<AdminExportArtifact>("/admin/usage/export", { query, reason })
}

export function buildUsageQuery(query: UsageQuery): string {
  const params = new URLSearchParams()
  for (const key of ["periodStart", "periodEnd", "subjectId", "runId", "modelId", "feature", "provider", "cursor"] as const) {
    const value = query[key]
    if (value) params.set(key, value)
  }
  if (query.limit) params.set("limit", String(query.limit))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}
