import { HTTPException } from "hono/http-exception"
import type { AppUser } from "./auth.js"

export type AccountStatus = "active" | "suspended" | "deleted"

export type EffectiveFolderPermission = "none" | "readOnly" | "full"

export type AuthorizationResourceCondition =
  | "none"
  | "self"
  | "requester"
  | "ownedRun"
  | "documentGroupRead"
  | "documentGroupFull"
  | "documentUploadSession"
  | "benchmarkSeedScope"
  | "documentIngestRun"
  | "adminManagedUser"
  | "roleAssignment"
  | "publicNonSensitive"

export type AuthorizationErrorDisclosure = "generic" | "resource-hidden" | "permission-detail"

export type Permission =
  | "chat:create"
  | "chat:read:own"
  | "chat:read:shared"
  | "chat:share:own"
  | "chat:delete:own"
  | "chat:admin:read_all"
  | "answer:edit"
  | "answer:publish"
  | "rag:group:create"
  | "rag:group:assign_manager"
  | "rag:doc:read"
  | "rag:doc:write:group"
  | "rag:doc:delete:group"
  | "rag:index:rebuild:group"
  | "rag:alias:read"
  | "rag:alias:write:group"
  | "rag:alias:review:group"
  | "rag:alias:disable:group"
  | "rag:alias:publish:group"
  | "benchmark:read"
  | "benchmark:query"
  | "benchmark:run"
  | "benchmark:seed_corpus"
  | "benchmark:cancel"
  | "benchmark:download"
  | "debug:trace:read:self"
  | "debug:trace:read:sanitized"
  | "debug:trace:read:internal"
  | "debug:trace:export"
  | "debug:ingest:read"
  | "debug:chunk:read"
  | "debug:replay"
  | "debug:settings:update"
  | "debug:answer_generation:read"
  | "debug:answer_generation:export"
  | "usage:read:own"
  | "usage:read:all_users"
  | "cost:read:own"
  | "cost:read:all"
  | "user:create"
  | "user:read"
  | "user:suspend"
  | "user:unsuspend"
  | "user:delete"
  | "access:role:create"
  | "access:role:update"
  | "access:role:assign"
  | "access:policy:read"

export type Role =
  | "CHAT_USER"
  | "ANSWER_EDITOR"
  | "RAG_GROUP_MANAGER"
  | "BENCHMARK_OPERATOR"
  | "BENCHMARK_RUNNER"
  | "USER_ADMIN"
  | "ACCESS_ADMIN"
  | "COST_AUDITOR"
  | "SYSTEM_ADMIN"

export type RouteAuthorizationMode =
  | "public"
  | "authenticated"
  | "required"
  | "requesterOrPermission"
  | "ownedRun"
  | "benchmarkSeedRunOrOwnedRun"
  | "benchmarkSeedOrPermission"
  | "benchmarkSeedListOrPermission"
  | "benchmarkSeedDeleteOrPermission"
  | "documentUploadSession"

export type RouteAuthorizationPolicy = {
  mode: RouteAuthorizationMode
  permission?: Permission
  permissions?: Permission[]
  conditionalPermissions?: Permission[]
  operationKey?: string
  resourceCondition?: AuthorizationResourceCondition
  errorDisclosure?: AuthorizationErrorDisclosure
  notes?: string[]
}

export type RouteAuthorizationMetadata = {
  mode: RouteAuthorizationMode
  requiredPermissions: Permission[]
  conditionalPermissions: Permission[]
  operationKey?: string
  resourceCondition: AuthorizationResourceCondition
  errorDisclosure: AuthorizationErrorDisclosure
  allowedRoles: Role[]
  deniedRoles: Role[]
  conditionalDeniedRoles: Role[]
  notes: string[]
  errors: Array<{
    status: 401 | 403
    when: string
    body: { error: string; details?: string }
  }>
}

export const rolePermissions: Record<Role, Permission[]> = {
  CHAT_USER: ["chat:create", "chat:read:own", "chat:read:shared", "chat:share:own", "chat:delete:own", "usage:read:own", "cost:read:own", "rag:doc:read"],
  ANSWER_EDITOR: ["answer:edit", "answer:publish"],
  RAG_GROUP_MANAGER: [
    "rag:group:create","rag:group:assign_manager","rag:doc:read","rag:doc:write:group","rag:doc:delete:group","rag:index:rebuild:group",
    "rag:alias:read","rag:alias:write:group","rag:alias:review:group","rag:alias:disable:group","rag:alias:publish:group",
    "benchmark:read","benchmark:run"
  ],
  BENCHMARK_OPERATOR: ["benchmark:read", "benchmark:run"],
  BENCHMARK_RUNNER: ["benchmark:query", "benchmark:seed_corpus"],
  USER_ADMIN: ["user:create", "user:read", "user:suspend", "user:unsuspend", "user:delete", "usage:read:all_users"],
  ACCESS_ADMIN: ["access:role:create", "access:role:update", "access:role:assign", "access:policy:read"],
  COST_AUDITOR: ["cost:read:all"],
  SYSTEM_ADMIN: [
    "chat:create","chat:read:own","chat:read:shared","chat:share:own","chat:delete:own","chat:admin:read_all",
    "answer:edit","answer:publish","rag:group:create","rag:group:assign_manager","rag:doc:read","rag:doc:write:group","rag:doc:delete:group","rag:index:rebuild:group",
    "rag:alias:read","rag:alias:write:group","rag:alias:review:group","rag:alias:disable:group","rag:alias:publish:group",
    "benchmark:read","benchmark:query","benchmark:run","benchmark:seed_corpus","benchmark:cancel","benchmark:download",
    "debug:trace:read:self","debug:trace:read:sanitized","debug:trace:read:internal","debug:trace:export","debug:ingest:read","debug:chunk:read","debug:replay","debug:settings:update","debug:answer_generation:read","debug:answer_generation:export",
    "usage:read:own","usage:read:all_users","cost:read:own","cost:read:all","user:create","user:read","user:suspend","user:unsuspend","user:delete",
    "access:role:create","access:role:update","access:role:assign","access:policy:read"
  ]
}

export const applicationRoles = Object.keys(rolePermissions) as Role[]

const folderPermissionRank: Record<EffectiveFolderPermission, number> = {
  none: 0,
  readOnly: 1,
  full: 2
}

export function getPermissionsForGroups(groups: string[]): Permission[] {
  const permissions = new Set<Permission>()
  for (const group of groups) {
    for (const permission of rolePermissions[group as Role] ?? []) {
      permissions.add(permission)
    }
  }
  return [...permissions]
}

export function rolesWithAnyPermission(permissions: Permission[]): Role[] {
  if (permissions.length === 0) return []
  return applicationRoles.filter((role) => permissions.some((permission) => rolePermissions[role].includes(permission)))
}

export function routeAuthorization(policy: RouteAuthorizationPolicy): RouteAuthorizationMetadata {
  const requiredPermissions = policy.permissions ?? (policy.permission ? [policy.permission] : [])
  const conditionalPermissions = policy.conditionalPermissions ?? []
  const effectivePermissions = [...requiredPermissions, ...conditionalPermissions]
  const allowedRoles = policy.mode === "public" || policy.mode === "authenticated"
    ? [...applicationRoles]
    : rolesWithAnyPermission(effectivePermissions)
  const deniedRoles = applicationRoles.filter((role) => !allowedRoles.includes(role))
  const conditionalDeniedRoles = conditionalPermissions.length === 0
    ? []
    : allowedRoles.filter((role) => !conditionalPermissions.some((permission) => rolePermissions[role].includes(permission)))
  const errors: RouteAuthorizationMetadata["errors"] = []
  if (policy.mode !== "public") {
    errors.push({ status: 401, when: "Authorization header がない、または Bearer token を検証できない場合。", body: { error: "Unauthorized" } })
  }
  if (policy.mode !== "public" && policy.mode !== "authenticated") {
    errors.push({
      status: 403,
      when: requiredPermissions.length > 0
        ? `必要 permission (${requiredPermissions.join(", ")}) または条件付き permission を満たさない場合。`
        : "認可条件を満たさない場合。",
      body: { error: policy.errorDisclosure === "permission-detail" && requiredPermissions[0] ? `Forbidden: missing ${requiredPermissions[0]}` : "Forbidden" }
    })
  }
  return {
    mode: policy.mode,
    requiredPermissions,
    conditionalPermissions,
    operationKey: policy.operationKey,
    resourceCondition: policy.resourceCondition ?? defaultResourceCondition(policy.mode),
    errorDisclosure: policy.errorDisclosure ?? "generic",
    allowedRoles,
    deniedRoles,
    conditionalDeniedRoles,
    notes: policy.notes ?? [],
    errors
  }
}

export function requirePermission(user: AppUser, permission: Permission) {
  if (!hasPermission(user, permission)) throw new HTTPException(403, { message: "Forbidden" })
}

export function hasPermission(user: AppUser, permission: Permission) {
  return isActiveAccount(user) && getPermissionsForGroups(user.cognitoGroups).includes(permission)
}

export function isActiveAccount(user: Pick<AppUser, "accountStatus">): boolean {
  return (user.accountStatus ?? "active") === "active"
}

export function requireActiveAccount(user: Pick<AppUser, "accountStatus">) {
  if (!isActiveAccount(user)) throw new HTTPException(403, { message: "Forbidden" })
}

export function folderPermissionSatisfies(actual: EffectiveFolderPermission, required: EffectiveFolderPermission): boolean {
  return folderPermissionRank[actual] >= folderPermissionRank[required]
}

export function canReadFolder(permission: EffectiveFolderPermission): boolean {
  return folderPermissionSatisfies(permission, "readOnly")
}

export function canManageFolder(permission: EffectiveFolderPermission): boolean {
  return folderPermissionSatisfies(permission, "full")
}

function defaultResourceCondition(mode: RouteAuthorizationMode): AuthorizationResourceCondition {
  if (mode === "public" || mode === "authenticated" || mode === "required") return "none"
  if (mode === "requesterOrPermission") return "requester"
  if (mode === "ownedRun") return "ownedRun"
  if (mode === "benchmarkSeedRunOrOwnedRun") return "documentIngestRun"
  if (mode === "benchmarkSeedOrPermission" || mode === "benchmarkSeedListOrPermission" || mode === "benchmarkSeedDeleteOrPermission") return "benchmarkSeedScope"
  if (mode === "documentUploadSession") return "documentUploadSession"
  return "none"
}
