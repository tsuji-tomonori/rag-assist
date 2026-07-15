import type {
  AccessRoleDefinition,
  AccessRoleList,
  AdminListPageMetadata,
  AliasAuditLogItem,
  AliasAuditLogPage,
  AliasDefinition,
  AliasListPage,
  ManagedUserAuditLogEntry,
  ManagedUserAuditLogPage
} from "../types.js"

type JsonObject = Record<string, unknown>

export class AdminContractError extends Error {
  constructor(resource: string) {
    super(`${resource} API の応答形式を確認できませんでした。更新しても解消しない場合は管理者へ連絡してください。`)
    this.name = "AdminContractError"
  }
}

export function decodeAliasDefinition(value: unknown): AliasDefinition {
  const record = objectValue(value, "用語展開")
  if (
    !hasStrings(record, ["aliasId", "version", "term", "createdBy", "createdAt", "updatedAt"])
    || !isStringArray(record.expansions)
    || !isOneOf(record.status, ["draft", "approved", "disabled"])
    || !isOptionalAliasScope(record.scope)
    || !hasOptionalStrings(record, ["reviewedBy", "reviewedAt", "reviewComment", "publishedVersion"])
  ) throw new AdminContractError("用語展開")
  return record as AliasDefinition
}

export function decodeAliasListPage(value: unknown): AliasListPage {
  const record = objectValue(value, "用語展開一覧")
  const metadata = decodePageMetadata(record, "用語展開一覧", true)
  if (!Array.isArray(record.aliases)) throw new AdminContractError("用語展開一覧")
  return { ...metadata, aliases: record.aliases.map(decodeAliasDefinition) }
}

export function decodeAliasAuditLogPage(value: unknown): AliasAuditLogPage {
  const record = objectValue(value, "用語展開監査ログ")
  const metadata = decodePageMetadata(record, "用語展開監査ログ")
  if (!Array.isArray(record.auditLog)) throw new AdminContractError("用語展開監査ログ")
  return { ...metadata, auditLog: record.auditLog.map(decodeAliasAuditLogItem) }
}

export function decodeManagedUserAuditLogPage(value: unknown): ManagedUserAuditLogPage {
  const record = objectValue(value, "管理操作履歴")
  const metadata = decodePageMetadata(record, "管理操作履歴")
  if (!Array.isArray(record.auditLog)) throw new AdminContractError("管理操作履歴")
  return { ...metadata, auditLog: record.auditLog.map(decodeManagedUserAuditLogEntry) }
}

export function decodeAccessRoleList(value: unknown): AccessRoleList {
  const record = objectValue(value, "ロール定義")
  if (
    !Array.isArray(record.roles)
    || !hasStrings(record, ["catalogVersion", "source", "asOf"])
  ) throw new AdminContractError("ロール定義")
  return {
    roles: record.roles.map(decodeAccessRoleDefinition),
    catalogVersion: record.catalogVersion,
    source: record.source,
    asOf: record.asOf
  }
}

export function buildAdminQuery(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

function decodeAccessRoleDefinition(value: unknown): AccessRoleDefinition {
  const record = objectValue(value, "ロール定義")
  if (
    !hasStrings(record, ["role", "displayName", "description"])
    || record.kind !== "systemPreset"
    || !isStringArray(record.permissions)
  ) throw new AdminContractError("ロール定義")
  return record as AccessRoleDefinition
}

function decodeAliasAuditLogItem(value: unknown): AliasAuditLogItem {
  const record = objectValue(value, "用語展開監査ログ")
  if (
    !hasStrings(record, ["auditId", "tenantId", "actorUserId", "reason", "createdAt", "detail"])
    || !hasOptionalStrings(record, ["aliasId", "aliasVersion"])
    || !isOneOf(record.action, ["create", "update", "review", "transition", "disable", "publish"])
    || !isOneOf(record.result, ["success", "denied", "conflict", "failed"])
    || !isOptionalAliasStatus(record.beforeStatus)
    || !isOptionalAliasStatus(record.afterStatus)
  ) throw new AdminContractError("用語展開監査ログ")
  return record as AliasAuditLogItem
}

function decodeManagedUserAuditLogEntry(value: unknown): ManagedUserAuditLogEntry {
  const record = objectValue(value, "管理操作履歴")
  if (
    !hasStrings(record, ["auditId", "actorUserId", "targetUserId", "targetEmail", "createdAt"])
    || !hasOptionalStrings(record, ["actorEmail"])
    || !isOneOf(record.action, ["user:create", "role:assign", "user:suspend", "user:unsuspend", "user:delete"])
    || !isOptionalManagedUserStatus(record.beforeStatus)
    || !isOptionalManagedUserStatus(record.afterStatus)
    || !isStringArray(record.beforeGroups)
    || !isStringArray(record.afterGroups)
  ) throw new AdminContractError("管理操作履歴")
  return record as ManagedUserAuditLogEntry
}

function decodePageMetadata(record: JsonObject, resource: string, requireVersion = false): AdminListPageMetadata {
  if (
    typeof record.total !== "number"
    || !Number.isSafeInteger(record.total)
    || record.total < 0
    || typeof record.truncated !== "boolean"
    || !hasStrings(record, ["source", "asOf"])
    || !hasOptionalStrings(record, ["nextCursor", "version"])
    || requireVersion && typeof record.version !== "string"
  ) throw new AdminContractError(resource)
  return {
    total: record.total,
    nextCursor: record.nextCursor as string | undefined,
    truncated: record.truncated,
    source: record.source,
    asOf: record.asOf,
    version: record.version as string | undefined
  }
}

function objectValue(value: unknown, resource: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminContractError(resource)
  return value as JsonObject
}

function hasStrings<T extends string>(record: JsonObject, keys: readonly T[]): record is JsonObject & Record<T, string> {
  return keys.every((key) => typeof record[key] === "string" && record[key].length > 0)
}

function hasOptionalStrings<T extends string>(record: JsonObject, keys: readonly T[]): record is JsonObject & Partial<Record<T, string>> {
  return keys.every((key) => record[key] === undefined || typeof record[key] === "string")
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isOptionalAliasScope(value: unknown): value is AliasDefinition["scope"] {
  if (value === undefined) return true
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return hasOptionalStrings(value as JsonObject, ["tenantId", "department", "source", "docType"])
}

function isOptionalAliasStatus(value: unknown): value is AliasDefinition["status"] | undefined {
  return value === undefined || isOneOf(value, ["draft", "approved", "disabled"])
}

function isOptionalManagedUserStatus(value: unknown): value is "active" | "suspended" | "deleted" | undefined {
  return value === undefined || isOneOf(value, ["active", "suspended", "deleted"])
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T)
}
