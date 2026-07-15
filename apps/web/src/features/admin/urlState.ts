import type { AliasAuditLogItem, AliasDefinition, ManagedUserAuditAction } from "./types.js"

export type AdminSectionId = "overview" | "users" | "roles" | "usage-cost" | "audit" | "alias"

export type AdminAuditActionFilter = ManagedUserAuditAction | AliasAuditLogItem["action"]

export type AdminWorkspaceUrlState = {
  section?: AdminSectionId
  query?: string
  aliasStatus?: AliasDefinition["status"]
  auditAction?: AdminAuditActionFilter
  sort?: "updatedDesc" | "termAsc"
  selected?: string
}

export const adminSections = new Set<AdminSectionId>(["overview", "users", "roles", "usage-cost", "audit", "alias"])
export const aliasStatuses = new Set<AliasDefinition["status"]>(["draft", "approved", "disabled"])
export const aliasSortKeys = new Set<NonNullable<AdminWorkspaceUrlState["sort"]>>(["updatedDesc", "termAsc"])
export const adminAuditActions = new Set<ManagedUserAuditAction>(["user:create", "role:assign", "user:suspend", "user:unsuspend", "user:delete"])
export const aliasAuditActions = new Set<AliasAuditLogItem["action"]>(["create", "update", "review", "transition", "disable", "publish"])
