import {
  APPLICATION_ROLES,
  isApplicationRole,
  type ApplicationRole
} from "@memorag-mvp/contract/access-control"
import type {
  ServerManagedIdentity,
  VerifiedIdentityProvider
} from "../adapters/verified-identity-provider.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"

/** Reconciles role audit state from Cognito without repeating the role mutation. */
export class ApplicationRoleAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(
    private readonly identities: Pick<VerifiedIdentityProvider, "getCurrentIdentityBySubject">
  ) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "applicationRolePrincipal"
      && draft.operation === "applicationRole.replace"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) {
      throw new Error("Application-role audit resolver does not support this intent")
    }
    const { tenantId, targetId } = intent.draft
    assertCanonicalIdentifier(tenantId, "tenantId")
    assertCanonicalIdentifier(targetId, "targetId")

    if (
      intent.requestedCompletion
      && intent.requestedCompletion.result !== "success"
      && intent.requestedCompletion.after === null
      && intent.draft.before === null
    ) {
      return { result: intent.requestedCompletion.result, after: null }
    }

    const current = await this.identities.getCurrentIdentityBySubject(targetId)
    if (!current) throw new Error("Authoritative application-role principal is unavailable")
    const authoritativeAfter = identityAuditValue(current, tenantId, targetId)

    if (intent.requestedCompletion) {
      const requestedAfter = storedIdentityAuditValue(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritativeAfter, requestedAfter)) {
        throw new Error("Authoritative application roles do not confirm the requested audit completion")
      }
      return {
        result: intent.requestedCompletion.result,
        after: intent.requestedCompletion.after
      }
    }

    if (current.accountStatus !== "active") {
      throw new Error("Pending application-role success target is not active")
    }
    const proposedRoles = storedRoleSet(intent.draft.proposedAfter, "proposed state")
    if (sameRoles(authoritativeAfter.roles, proposedRoles)) {
      return { result: "success", after: authoritativeAfter }
    }
    const beforeRoles = storedRoleSet(intent.draft.before, "before state")
    if (sameRoles(authoritativeAfter.roles, beforeRoles)) {
      throw new Error("Pending application-role audit has no durable non-success result")
    }
    throw new Error("Authoritative application roles match neither the before nor proposed state")
  }
}

type ApplicationRoleIdentityAudit = Readonly<{
  userId: string
  tenantId: string
  accountStatus: ServerManagedIdentity["accountStatus"]
  roles: ApplicationRole[]
}>

function identityAuditValue(
  identity: ServerManagedIdentity,
  tenantId: string,
  targetId: string
): ApplicationRoleIdentityAudit {
  if (
    identity.tenantId !== tenantId
    || identity.userId !== targetId
    || (identity.accountStatus !== "active" && identity.accountStatus !== "suspended")
  ) throw new Error("Authoritative application-role principal crossed its identity boundary")
  return {
    userId: targetId,
    tenantId,
    accountStatus: identity.accountStatus,
    roles: canonicalObservedRoles(identity.cognitoGroups)
  }
}

function storedIdentityAuditValue(
  value: unknown,
  tenantId: string,
  targetId: string,
  label: string
): ApplicationRoleIdentityAudit {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Application-role audit ${label} is invalid`)
  }
  const candidate = value as Partial<ApplicationRoleIdentityAudit>
  if (
    candidate.userId !== targetId
    || candidate.tenantId !== tenantId
    || (candidate.accountStatus !== "active" && candidate.accountStatus !== "suspended")
  ) throw new Error(`Application-role audit ${label} crossed its identity boundary`)
  return {
    userId: targetId,
    tenantId,
    accountStatus: candidate.accountStatus,
    roles: canonicalStoredRoles(candidate.roles, label)
  }
}

function storedRoleSet(value: unknown, label: string): readonly ApplicationRole[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Application-role audit ${label} is invalid`)
  }
  return canonicalStoredRoles((value as { roles?: unknown }).roles, label)
}

function canonicalStoredRoles(value: unknown, label: string): ApplicationRole[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((role) => typeof role !== "string" || !isApplicationRole(role))
    || new Set(value).size !== value.length
  ) throw new Error(`Application-role audit ${label} roles are invalid`)
  const selected = new Set(value as ApplicationRole[])
  return APPLICATION_ROLES.filter((role) => selected.has(role))
}

function canonicalObservedRoles(values: readonly string[]): ApplicationRole[] {
  const applicationRoles = values.filter(isApplicationRole)
  if (new Set(applicationRoles).size !== applicationRoles.length) {
    throw new Error("Authoritative application-role principal contains duplicate roles")
  }
  if (applicationRoles.length === 0) {
    throw new Error("Authoritative application-role principal has no application role")
  }
  const selected = new Set(applicationRoles)
  return APPLICATION_ROLES.filter((role) => selected.has(role))
}

function sameRoles(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((role, index) => role === right[index])
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!value || value.trim() !== value) {
    throw new Error(`Application-role audit ${field} is invalid`)
  }
}
