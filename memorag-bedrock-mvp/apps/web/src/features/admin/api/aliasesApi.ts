import { get, post } from "../../../shared/api/http.js"
import type { AliasAuditLogItem, AliasDefinition } from "../types.js"

export async function listAliases(): Promise<AliasDefinition[]> {
  const result = await get<{ aliases?: AliasDefinition[] }>("/admin/aliases")
  return result.aliases ?? []
}

export async function createAlias(input: {
  term: string
  expansions: string[]
  scope?: AliasDefinition["scope"]
}): Promise<AliasDefinition> {
  return post<AliasDefinition>("/admin/aliases", input)
}

export async function updateAlias(aliasId: string, input: {
  term?: string
  expansions?: string[]
  scope?: AliasDefinition["scope"]
}): Promise<AliasDefinition> {
  return post<AliasDefinition>(`/admin/aliases/${encodeURIComponent(aliasId)}/update`, input)
}

export async function reviewAlias(aliasId: string, decision: "approve" | "reject", comment?: string): Promise<AliasDefinition> {
  return post<AliasDefinition>(`/admin/aliases/${encodeURIComponent(aliasId)}/review`, { decision, comment })
}

export async function disableAlias(aliasId: string): Promise<AliasDefinition> {
  return post<AliasDefinition>(`/admin/aliases/${encodeURIComponent(aliasId)}/disable`, {})
}

export async function publishAliases(): Promise<{ version: string; publishedAt: string; aliasCount: number }> {
  return post<{ version: string; publishedAt: string; aliasCount: number }>("/admin/aliases/publish", {})
}

export async function listAliasAuditLog(): Promise<AliasAuditLogItem[]> {
  const result = await get<{ auditLog?: AliasAuditLogItem[] }>("/admin/aliases/audit-log")
  return result.auditLog ?? []
}
