import type { AppUser } from "../auth.js"
import { authorizeAppUserResourceOperation } from "../authorization.js"
import {
  RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
  type ProtectedResourceOperation,
  type ProtectedResourceType,
  type ResourceOperationAuthorizationDecision,
  type ResourceOperationGuard,
  type ResourcePermissionLevel,
  type ResourcePermissionScope,
  type ResourcePermissionScopeContext
} from "./resource-operation-authorization.js"

/**
 * Production adapter for the FR-076 authorization kernel.
 *
 * Persistence and policy services must resolve current evidence before calling
 * this boundary. The adapter deliberately does not infer missing evidence and
 * exposes only a throwing form to mutation/read paths so a denied decision can
 * never be accidentally ignored.
 */
export class ResourceOperationAuthorizationError extends Error {
  constructor(readonly decision: ResourceOperationAuthorizationDecision) {
    super("Forbidden")
    this.name = "ResourceOperationAuthorizationError"
  }
}

export type ResolvedResourceOperation = Readonly<{
  resourceType: ProtectedResourceType
  operation: ProtectedResourceOperation
  authorizationPath: string
  resourceScopes: Readonly<Partial<Record<ResourcePermissionScope, ResourcePermissionScopeContext>>>
  satisfiedGuards: readonly ResourceOperationGuard[]
}>

export function enforceResolvedResourceOperation(
  actor: AppUser,
  input: ResolvedResourceOperation
): ResourceOperationAuthorizationDecision {
  const decision = authorizeAppUserResourceOperation(actor, {
    policyVersion: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
    resourceType: input.resourceType,
    operation: input.operation,
    authorizationPath: input.authorizationPath,
    resourceScopes: input.resourceScopes,
    satisfiedGuards: input.satisfiedGuards
  })
  if (!decision.allowed) throw new ResourceOperationAuthorizationError(decision)
  return decision
}

export function resolvedResourceScope(input: Readonly<{
  tenantId: string | undefined
  permission: ResourcePermissionLevel
  lifecycle?: ResourcePermissionScopeContext["lifecycle"]
  integrity?: ResourcePermissionScopeContext["integrity"]
  administrativePrincipal?: boolean
  policyStatus?: "allow" | "deny" | "unknown" | "unreadable"
}>): ResourcePermissionScopeContext {
  const policyStatus = input.policyStatus ?? "allow"
  return {
    tenantId: input.tenantId,
    lifecycle: input.lifecycle ?? "active",
    integrity: input.integrity ?? "valid",
    administrativePrincipal: input.administrativePrincipal ?? false,
    ordinaryPolicy: policyStatus === "allow"
      ? { status: "allow", permission: input.permission }
      : { status: policyStatus }
  }
}

/** Runtime membership-to-document/folder use boundary for resource groups. */
export function enforceResourceGroupSearchUse(input: Readonly<{
  actor: AppUser
  tenantId: string | undefined
  targetPermission: ResourcePermissionLevel
  activeSameTenantMembership: boolean
}>): ResourceOperationAuthorizationDecision {
  return enforceResolvedResourceOperation(input.actor, {
    resourceType: "resourceGroup",
    operation: "searchUse",
    authorizationPath: "targetResource",
    resourceScopes: {
      targetResource: resolvedResourceScope({
        tenantId: input.tenantId,
        permission: input.targetPermission
      })
    },
    satisfiedGuards: [
      ...(input.activeSameTenantMembership ? ["activeSameTenantMembership" as const] : []),
      "targetResourcePermissionReevaluated"
    ]
  })
}
