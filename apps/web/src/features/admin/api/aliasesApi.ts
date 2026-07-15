import { get, post } from "../../../shared/api/http.js"
import type { AliasAuditLogPage, AliasAuditLogQuery, AliasDefinition, AliasListPage, AliasListQuery } from "../types.js"
import { buildAdminQuery, decodeAliasAuditLogPage, decodeAliasDefinition, decodeAliasListPage } from "./adminContract.js"

export async function listAliases(query: AliasListQuery = {}): Promise<AliasListPage> {
  return decodeAliasListPage(await get<unknown>(`/admin/aliases${buildAdminQuery(query)}`))
}

export async function createAlias(input: {
  term: string
  expansions: string[]
  scope?: AliasDefinition["scope"]
}): Promise<AliasDefinition> {
  return decodeAliasDefinition(await post<unknown>("/admin/aliases", input))
}

export async function updateAlias(aliasId: string, input: {
  term?: string
  expansions?: string[]
  scope?: AliasDefinition["scope"]
  expectedVersion: string
  reason: string
}): Promise<AliasDefinition> {
  return decodeAliasDefinition(await post<unknown>(`/admin/aliases/${encodeURIComponent(aliasId)}/update`, input))
}

export async function reviewAlias(aliasId: string, decision: "approve" | "reject", expectedVersion: string, reason: string): Promise<AliasDefinition> {
  return decodeAliasDefinition(await post<unknown>(`/admin/aliases/${encodeURIComponent(aliasId)}/review`, {
    decision,
    expectedVersion,
    reason,
    comment: reason
  }))
}

export async function transitionAliasToDraft(aliasId: string, expectedVersion: string, reason: string): Promise<AliasDefinition> {
  return decodeAliasDefinition(await post<unknown>(`/admin/aliases/${encodeURIComponent(aliasId)}/transition`, {
    targetStatus: "draft",
    expectedVersion,
    reason
  }))
}

export async function disableAlias(aliasId: string, expectedVersion: string, reason: string): Promise<AliasDefinition> {
  return decodeAliasDefinition(await post<unknown>(`/admin/aliases/${encodeURIComponent(aliasId)}/disable`, { expectedVersion, reason }))
}

export async function publishAliases(expectedVersion: string, reason: string): Promise<{ version: string; publishedAt: string; aliasCount: number }> {
  const result = await post<unknown>("/admin/aliases/publish", { expectedVersion, reason })
  if (
    !result
    || typeof result !== "object"
    || typeof (result as Record<string, unknown>).version !== "string"
    || typeof (result as Record<string, unknown>).publishedAt !== "string"
    || typeof (result as Record<string, unknown>).aliasCount !== "number"
  ) throw new Error("用語展開公開 API の応答形式を確認できませんでした。")
  return result as { version: string; publishedAt: string; aliasCount: number }
}

export async function listAliasAuditLog(query: AliasAuditLogQuery = {}): Promise<AliasAuditLogPage> {
  return decodeAliasAuditLogPage(await get<unknown>(`/admin/aliases/audit-log${buildAdminQuery(query)}`))
}
