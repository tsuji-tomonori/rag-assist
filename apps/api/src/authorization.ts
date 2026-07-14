import { HTTPException } from "hono/http-exception"
import {
  APPLICATION_ROLES,
  ROLE_CATALOG_VERSION,
  ROLE_PERMISSION_CATALOG,
  isApplicationRole,
  type ApplicationPermission,
  type ApplicationRole
} from "@memorag-mvp/contract/access-control"
import type { AppUser } from "./auth.js"
import {
  authorizeResourceOperation,
  type ActorResourceAuthorizationContext,
  type ResourceOperationAuthorizationDecision,
  type ResourceOperationAuthorizationRequest
} from "./security/resource-operation-authorization.js"

export type AccountStatus = "active" | "suspended" | "deleted"

export type EffectiveFolderPermission = "none" | "readOnly" | "full"

export type AuthorizationResourceCondition =
  | "none"
  | "self"
  | "requester"
  | "ownedRun"
  | "agentRunSelfOrManaged"
  | "agentWorkspaceReadOnly"
  | "agentWritebackFull"
  | "documentGroupRead"
  | "documentGroupFull"
  | "resourceGroupFull"
  | "documentEffectiveFull"
  | "documentMove"
  | "folderMove"
  | "documentUploadSession"
  | "tenantCollection"
  | "tenantRun"
  | "benchmarkSeedScope"
  | "benchmarkEvaluationScope"
  | "documentIngestRun"
  | "adminManagedUser"
  | "roleAssignment"
  | "publicNonSensitive"

export type AuthorizationErrorDisclosure = "generic" | "resource-hidden" | "permission-detail"

export type Permission = ApplicationPermission

export type Role = ApplicationRole

export { ROLE_CATALOG_VERSION }

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
  allowedRoles?: Role[]
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

export const rolePermissions: Readonly<Record<Role, readonly Permission[]>> = ROLE_PERMISSION_CATALOG

export const applicationRoles: Role[] = [...APPLICATION_ROLES]

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

/** Maps only a middleware-verified AppUser shape into the canonical resource kernel context. */
export function resourceAuthorizationActorFromAppUser(user: AppUser): ActorResourceAuthorizationContext {
  return {
    identityVerified: isCanonicalIdentifier(user.userId) && user.accountStatus !== undefined,
    accountStatus: user.accountStatus ?? "unknown",
    tenantId: user.tenantId,
    featurePermissions: getPermissionsForGroups(user.cognitoGroups),
    roleLabels: user.cognitoGroups.filter(isApplicationRole)
  }
}

export function authorizeAppUserResourceOperation(
  user: AppUser,
  request: Omit<ResourceOperationAuthorizationRequest, "actor">
): ResourceOperationAuthorizationDecision {
  return authorizeResourceOperation({
    ...request,
    actor: resourceAuthorizationActorFromAppUser(user)
  })
}

export function rolesWithAnyPermission(permissions: Permission[]): Role[] {
  if (permissions.length === 0) return []
  return applicationRoles.filter((role) => permissions.some((permission) => rolePermissions[role]?.includes(permission) ?? false))
}

export function routeAuthorization(policy: RouteAuthorizationPolicy): RouteAuthorizationMetadata {
  const requiredPermissions = policy.permissions ?? (policy.permission ? [policy.permission] : [])
  const conditionalPermissions = policy.conditionalPermissions ?? []
  const effectivePermissions = [...requiredPermissions, ...conditionalPermissions]
  const allowedRoles = policy.allowedRoles
    ? [...policy.allowedRoles]
    : policy.mode === "public" || policy.mode === "authenticated"
      ? [...applicationRoles]
      : rolesWithAnyPermission(effectivePermissions)
  const deniedRoles = applicationRoles.filter((role) => !allowedRoles.includes(role))
  const conditionalDeniedRoles = conditionalPermissions.length === 0
    ? []
    : allowedRoles.filter((role) => !conditionalPermissions.some((permission) => rolePermissions[role]?.includes(permission) ?? false))
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

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}
