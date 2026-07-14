import type {
  ApplicationPermission,
  ResourceOperationFeaturePermission
} from "@memorag-mvp/contract/access-control"

/**
 * Canonical resource-operation authorization kernel for FR-057/059/076/077.
 *
 * The kernel is deliberately independent from route roles and persistence. A
 * caller must resolve current identity, account, tenant, feature, resource and
 * policy evidence before calling it. Missing or unreadable evidence is denied.
 */

export const RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION = "resource-operation-authorization-v1" as const

export type ProtectedResourceType = "document" | "folder" | "resourceGroup"
export type ProtectedResourceOperation = "create" | "read" | "update" | "delete" | "move" | "share" | "searchUse"
export type ResourcePermissionLevel = "none" | "readOnly" | "full"

export type ResourcePermissionScope =
  | "target"
  | "sourceContainer"
  | "destinationContainer"
  | "tenantCreateScope"
  | "targetResource"

export type ResourceOperationGuard =
  | "activeSameTenantMembership"
  | "administrativePrincipalPreserved"
  | "admissionApproved"
  | "authoritativeOwnerConfirmed"
  | "canonicalNameConfirmed"
  | "coherentDerivedMetadata"
  | "currentEligibilityConfirmed"
  | "danglingGrantsDisabledFirst"
  | "denyFirstLifecycleApplied"
  | "descendantImpactConfirmed"
  | "documentPermissionsReevaluated"
  | "expectedVersionMatched"
  | "immutableIdConfirmed"
  | "impactPreviewConfirmed"
  | "nonCyclicPath"
  | "principalsActiveSameTenant"
  | "responseAllowlistApplied"
  | "retentionPolicySatisfied"
  | "roleNamespaceSeparated"
  | "sameTenantMove"
  | "sameTenantPath"
  | "serverManagedFieldsProtected"
  | "targetResourcePermissionReevaluated"

export type ResourcePermissionRequirement = Readonly<{
  scope: ResourcePermissionScope
  minimum: Exclude<ResourcePermissionLevel, "none">
}>

export type ResourceAuthorizationPath = Readonly<{
  key: string
  permissions: readonly ResourcePermissionRequirement[]
}>

type EnabledResourceOperationCell = Readonly<{
  enabled: true
  logicalOperationKey: string
  /** Version-local logical feature key; a role adapter must map it exactly. */
  featurePermission: ResourceOperationFeaturePermission
  authorizationPaths: readonly ResourceAuthorizationPath[]
  requiredGuards: readonly ResourceOperationGuard[]
}>

type DisabledResourceOperationCell = Readonly<{
  enabled: false
  logicalOperationKey: string
  featurePermission: null
  authorizationPaths: readonly []
  requiredGuards: readonly []
}>

export type ResourceOperationAuthorizationCell = EnabledResourceOperationCell | DisabledResourceOperationCell

type ResourceOperationCatalogKey = `${ProtectedResourceType}:${ProtectedResourceOperation}`

const resourceOperationAuthorizationCatalog = {
  "document:create": {
    enabled: true,
    logicalOperationKey: "document.create",
    featurePermission: "document.create",
    authorizationPaths: [
      { key: "destinationFolder", permissions: [{ scope: "destinationContainer", minimum: "full" }] },
      { key: "tenantRoot", permissions: [{ scope: "tenantCreateScope", minimum: "full" }] }
    ],
    requiredGuards: ["admissionApproved", "authoritativeOwnerConfirmed"]
  },
  "document:read": {
    enabled: true,
    logicalOperationKey: "document.read",
    featurePermission: "document.read",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "readOnly" }] }],
    requiredGuards: ["responseAllowlistApplied"]
  },
  "document:update": {
    enabled: true,
    logicalOperationKey: "document.update",
    featurePermission: "document.update",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "full" }] }],
    requiredGuards: ["serverManagedFieldsProtected"]
  },
  "document:delete": {
    enabled: true,
    logicalOperationKey: "document.delete",
    featurePermission: "document.delete",
    authorizationPaths: [{ key: "sourceFolder", permissions: [{ scope: "sourceContainer", minimum: "full" }] }],
    requiredGuards: ["denyFirstLifecycleApplied", "retentionPolicySatisfied"]
  },
  "document:move": {
    enabled: true,
    logicalOperationKey: "document.move",
    featurePermission: "document.move",
    authorizationPaths: [{
      key: "sourceAndDestinationFolders",
      permissions: [
        { scope: "sourceContainer", minimum: "full" },
        { scope: "destinationContainer", minimum: "full" }
      ]
    }],
    requiredGuards: ["sameTenantMove", "coherentDerivedMetadata"]
  },
  "document:share": {
    enabled: true,
    logicalOperationKey: "document.share",
    featurePermission: "document.share",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "full" }] }],
    requiredGuards: ["principalsActiveSameTenant", "administrativePrincipalPreserved", "expectedVersionMatched"]
  },
  "document:searchUse": {
    enabled: true,
    logicalOperationKey: "document.useInSearch",
    featurePermission: "document.useInSearch",
    authorizationPaths: [
      { key: "document", permissions: [{ scope: "target", minimum: "readOnly" }] },
      {
        key: "folderAndDocument",
        permissions: [
          { scope: "sourceContainer", minimum: "readOnly" },
          { scope: "target", minimum: "readOnly" }
        ]
      }
    ],
    requiredGuards: ["currentEligibilityConfirmed"]
  },
  "folder:create": {
    enabled: true,
    logicalOperationKey: "folder.create",
    featurePermission: "folder.create",
    authorizationPaths: [
      { key: "parentFolder", permissions: [{ scope: "destinationContainer", minimum: "full" }] },
      { key: "tenantRoot", permissions: [{ scope: "tenantCreateScope", minimum: "full" }] }
    ],
    requiredGuards: ["sameTenantPath", "nonCyclicPath", "canonicalNameConfirmed"]
  },
  "folder:read": {
    enabled: true,
    logicalOperationKey: "folder.read",
    featurePermission: "folder.read",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "readOnly" }] }],
    requiredGuards: ["responseAllowlistApplied"]
  },
  "folder:update": {
    enabled: true,
    logicalOperationKey: "folder.update",
    featurePermission: "folder.update",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "full" }] }],
    requiredGuards: ["expectedVersionMatched"]
  },
  "folder:delete": {
    enabled: true,
    logicalOperationKey: "folder.delete",
    featurePermission: "folder.delete",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "full" }] }],
    requiredGuards: ["descendantImpactConfirmed", "denyFirstLifecycleApplied"]
  },
  "folder:move": {
    enabled: true,
    logicalOperationKey: "folder.move",
    featurePermission: "folder.move",
    authorizationPaths: [{
      key: "sourceAndDestinationFolders",
      permissions: [
        { scope: "target", minimum: "full" },
        { scope: "destinationContainer", minimum: "full" }
      ]
    }],
    requiredGuards: ["sameTenantMove", "nonCyclicPath", "descendantImpactConfirmed"]
  },
  "folder:share": {
    enabled: true,
    logicalOperationKey: "folder.share",
    featurePermission: "folder.share",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "full" }] }],
    requiredGuards: ["principalsActiveSameTenant", "administrativePrincipalPreserved", "expectedVersionMatched"]
  },
  "folder:searchUse": {
    enabled: true,
    logicalOperationKey: "folder.useInSearch",
    featurePermission: "folder.useInSearch",
    authorizationPaths: [{ key: "folder", permissions: [{ scope: "target", minimum: "readOnly" }] }],
    requiredGuards: ["currentEligibilityConfirmed", "documentPermissionsReevaluated"]
  },
  "resourceGroup:create": {
    enabled: true,
    logicalOperationKey: "resourceGroup.create",
    featurePermission: "resourceGroup.create",
    authorizationPaths: [{ key: "tenant", permissions: [{ scope: "tenantCreateScope", minimum: "full" }] }],
    requiredGuards: ["immutableIdConfirmed", "roleNamespaceSeparated"]
  },
  "resourceGroup:read": {
    enabled: true,
    logicalOperationKey: "resourceGroup.read",
    featurePermission: "resourceGroup.read",
    authorizationPaths: [{ key: "target", permissions: [{ scope: "target", minimum: "readOnly" }] }],
    requiredGuards: ["responseAllowlistApplied"]
  },
  "resourceGroup:update": {
    enabled: true,
    logicalOperationKey: "resourceGroup.update",
    featurePermission: "resourceGroup.update",
    authorizationPaths: [{ key: "groupManager", permissions: [{ scope: "target", minimum: "full" }] }],
    requiredGuards: ["expectedVersionMatched"]
  },
  "resourceGroup:delete": {
    enabled: true,
    logicalOperationKey: "resourceGroup.delete",
    featurePermission: "resourceGroup.delete",
    authorizationPaths: [{ key: "groupManager", permissions: [{ scope: "target", minimum: "full" }] }],
    requiredGuards: ["impactPreviewConfirmed", "danglingGrantsDisabledFirst"]
  },
  "resourceGroup:move": {
    enabled: false,
    logicalOperationKey: "resourceGroup.move",
    featurePermission: null,
    authorizationPaths: [],
    requiredGuards: []
  },
  "resourceGroup:share": {
    enabled: false,
    logicalOperationKey: "resourceGroup.share",
    featurePermission: null,
    authorizationPaths: [],
    requiredGuards: []
  },
  "resourceGroup:searchUse": {
    enabled: true,
    logicalOperationKey: "resourceGroup.useInSearch",
    featurePermission: "resourceGroup.useInSearch",
    authorizationPaths: [{ key: "targetResource", permissions: [{ scope: "targetResource", minimum: "readOnly" }] }],
    requiredGuards: ["activeSameTenantMembership", "targetResourcePermissionReevaluated"]
  }
} as const satisfies Record<ResourceOperationCatalogKey, ResourceOperationAuthorizationCell>

for (const cell of Object.values(resourceOperationAuthorizationCatalog) as ResourceOperationAuthorizationCell[]) {
  Object.freeze(cell.requiredGuards)
  for (const path of cell.authorizationPaths) {
    for (const requirement of path.permissions) Object.freeze(requirement)
    Object.freeze(path.permissions)
    Object.freeze(path)
  }
  Object.freeze(cell.authorizationPaths)
  Object.freeze(cell)
}
Object.freeze(resourceOperationAuthorizationCatalog)

export type ActorResourceAuthorizationContext = Readonly<{
  identityVerified: boolean
  accountStatus: "active" | "suspended" | "deleted" | "unknown"
  tenantId?: string
  featurePermissions: readonly ApplicationPermission[]
  /** Audit-only labels. Role names never grant resource permission in this kernel. */
  roleLabels?: readonly string[]
}>

export type OrdinaryResourcePolicyDecision =
  | Readonly<{ status: "allow"; permission: ResourcePermissionLevel }>
  | Readonly<{ status: "deny" }>
  | Readonly<{ status: "unknown" | "unreadable" }>

export type ResourcePermissionScopeContext = Readonly<{
  tenantId?: string
  lifecycle: "active" | "inactive" | "archived" | "deleted" | "unknown"
  integrity: "valid" | "invalid" | "unknown"
  administrativePrincipal: boolean
  ordinaryPolicy?: OrdinaryResourcePolicyDecision
}>

export type ResourceOperationAuthorizationRequest = Readonly<{
  policyVersion: string
  resourceType: string
  operation: string
  authorizationPath: string
  actor: ActorResourceAuthorizationContext
  resourceScopes: Readonly<Partial<Record<ResourcePermissionScope, ResourcePermissionScopeContext>>>
  satisfiedGuards: readonly string[]
}>

export type ResourceAuthorizationReasonCode =
  | "allowed"
  | "account_not_active"
  | "actor_tenant_unresolved"
  | "additional_guard_missing"
  | "authorization_path_undefined"
  | "feature_permission_missing"
  | "identity_unverified"
  | "ordinary_policy_denied"
  | "ordinary_policy_unavailable"
  | "policy_version_unsupported"
  | "resource_integrity_unverified"
  | "resource_not_active"
  | "resource_operation_explicit_deny"
  | "resource_operation_undefined"
  | "resource_permission_insufficient"
  | "resource_scope_missing"
  | "resource_tenant_unresolved"
  | "tenant_mismatch"

export type EffectiveScopePermission = Readonly<{
  scope: ResourcePermissionScope
  permission: ResourcePermissionLevel
  source: "administrativePrincipal" | "ordinaryPolicy"
}>

export type ResourceOperationAuthorizationDecision = Readonly<{
  allowed: boolean
  policyVersion: typeof RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION
  logicalOperationKey?: string
  reasonCode: ResourceAuthorizationReasonCode
  failedScope?: ResourcePermissionScope
  missingGuard?: string
  effectivePermissions: readonly EffectiveScopePermission[]
}>

const permissionRank: Readonly<Record<ResourcePermissionLevel, number>> = Object.freeze({
  none: 0,
  readOnly: 1,
  full: 2
})

/** Returns only an exact version/type/operation catalog match. */
export function getResourceOperationAuthorizationCell(
  policyVersion: string,
  resourceType: string,
  operation: string
): ResourceOperationAuthorizationCell | undefined {
  if (policyVersion !== RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION) return undefined
  const key = `${resourceType}:${operation}`
  if (!Object.prototype.hasOwnProperty.call(resourceOperationAuthorizationCatalog, key)) return undefined
  return resourceOperationAuthorizationCatalog[key as ResourceOperationCatalogKey]
}

/**
 * Evaluates one operation without I/O or role-based resource bypasses.
 *
 * Priority is: exact catalog -> verified/active actor -> exact feature ->
 * authoritative tenant/resource mandatory state -> administrative principal ->
 * ordinary policy -> required permission -> additional guards.
 */
export function authorizeResourceOperation(
  request: ResourceOperationAuthorizationRequest
): ResourceOperationAuthorizationDecision {
  if (request.policyVersion !== RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION) {
    return denied("policy_version_unsupported")
  }

  const cell = getResourceOperationAuthorizationCell(request.policyVersion, request.resourceType, request.operation)
  if (!cell) return denied("resource_operation_undefined")
  if (!cell.enabled) {
    return denied("resource_operation_explicit_deny", { logicalOperationKey: cell.logicalOperationKey })
  }
  if (!request.actor || request.actor.identityVerified !== true) {
    return denied("identity_unverified", { logicalOperationKey: cell.logicalOperationKey })
  }
  if (request.actor.accountStatus !== "active") {
    return denied("account_not_active", { logicalOperationKey: cell.logicalOperationKey })
  }
  if (!Array.isArray(request.actor.featurePermissions) || !request.actor.featurePermissions.includes(cell.featurePermission)) {
    return denied("feature_permission_missing", { logicalOperationKey: cell.logicalOperationKey })
  }
  if (!isCanonicalIdentifier(request.actor.tenantId)) {
    return denied("actor_tenant_unresolved", { logicalOperationKey: cell.logicalOperationKey })
  }

  const path = cell.authorizationPaths.find((candidate) => candidate.key === request.authorizationPath)
  if (!path) {
    return denied("authorization_path_undefined", { logicalOperationKey: cell.logicalOperationKey })
  }

  const resolvedScopes: Array<Readonly<{
    requirement: ResourcePermissionRequirement
    context: ResourcePermissionScopeContext
  }>> = []

  // Resolve every mandatory condition before applying an administrative-principal
  // or ordinary-policy rule. This makes a mandatory deny dominant across paths
  // with more than one resource (for example move).
  for (const requirement of path.permissions) {
    const context = request.resourceScopes?.[requirement.scope]
    if (!context) {
      return denied("resource_scope_missing", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope
      })
    }
    if (!isCanonicalIdentifier(context.tenantId)) {
      return denied("resource_tenant_unresolved", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope
      })
    }
    if (context.tenantId !== request.actor.tenantId) {
      return denied("tenant_mismatch", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope
      })
    }
    if (context.lifecycle !== "active") {
      return denied("resource_not_active", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope
      })
    }
    if (context.integrity !== "valid") {
      return denied("resource_integrity_unverified", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope
      })
    }
    resolvedScopes.push({ requirement, context })
  }

  const effectivePermissions: EffectiveScopePermission[] = []
  for (const { requirement, context } of resolvedScopes) {
    if (context.administrativePrincipal === true) {
      effectivePermissions.push({
        scope: requirement.scope,
        permission: "full",
        source: "administrativePrincipal"
      })
      continue
    }

    if (context.ordinaryPolicy?.status === "deny") {
      return denied("ordinary_policy_denied", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope,
        effectivePermissions
      })
    }
    if (context.ordinaryPolicy?.status !== "allow" || !isResourcePermissionLevel(context.ordinaryPolicy.permission)) {
      return denied("ordinary_policy_unavailable", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope,
        effectivePermissions
      })
    }

    const effectivePermission = context.ordinaryPolicy.permission
    effectivePermissions.push({
      scope: requirement.scope,
      permission: effectivePermission,
      source: "ordinaryPolicy"
    })
    if (permissionRank[effectivePermission] < permissionRank[requirement.minimum]) {
      return denied("resource_permission_insufficient", {
        logicalOperationKey: cell.logicalOperationKey,
        failedScope: requirement.scope,
        effectivePermissions
      })
    }
  }

  const satisfiedGuards = new Set(Array.isArray(request.satisfiedGuards) ? request.satisfiedGuards : [])
  for (const guard of cell.requiredGuards) {
    if (!satisfiedGuards.has(guard)) {
      return denied("additional_guard_missing", {
        logicalOperationKey: cell.logicalOperationKey,
        missingGuard: guard,
        effectivePermissions
      })
    }
  }

  return Object.freeze({
    allowed: true,
    policyVersion: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
    logicalOperationKey: cell.logicalOperationKey,
    reasonCode: "allowed",
    effectivePermissions: Object.freeze(effectivePermissions)
  })
}

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function isResourcePermissionLevel(value: unknown): value is ResourcePermissionLevel {
  return value === "none" || value === "readOnly" || value === "full"
}

function denied(
  reasonCode: Exclude<ResourceAuthorizationReasonCode, "allowed">,
  details: Readonly<{
    logicalOperationKey?: string
    failedScope?: ResourcePermissionScope
    missingGuard?: string
    effectivePermissions?: readonly EffectiveScopePermission[]
  }> = {}
): ResourceOperationAuthorizationDecision {
  return Object.freeze({
    allowed: false,
    policyVersion: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
    logicalOperationKey: details.logicalOperationKey,
    reasonCode,
    failedScope: details.failedScope,
    missingGuard: details.missingGuard,
    effectivePermissions: Object.freeze([...(details.effectivePermissions ?? [])])
  })
}
