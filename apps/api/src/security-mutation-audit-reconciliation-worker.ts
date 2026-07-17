import { config } from "./config.js"
import { createDependencies } from "./dependencies.js"
import { SourceGovernanceAuditAuthoritativeResolver } from "./rag/offline/pre-retrieval/admission/source-governance-audit-reconciler.js"
import {
  SecurityMutationAuditReconciler,
  type SecurityMutationAuditReconciliationResult
} from "./security/security-mutation-audit-reconciler.js"
import { ResourceGroupMembershipAuditAuthoritativeResolver } from "./security/resource-group-membership-audit-reconciler.js"
import { ResourceGroupUpdateAuditAuthoritativeResolver } from "./security/resource-group-update-audit-reconciler.js"
import { ResourceGroupCreateAuditAuthoritativeResolver } from "./security/resource-group-create-audit-reconciler.js"
import { ResourceGroupDeleteAuditAuthoritativeResolver } from "./security/resource-group-delete-audit-reconciler.js"
import { ApplicationRoleAuditAuthoritativeResolver } from "./security/application-role-audit-reconciler.js"

export type SecurityMutationAuditReconciliationEvent = Readonly<{
  tenantId?: unknown
  limit?: unknown
}>

type AuditReconciliationTarget = Pick<SecurityMutationAuditReconciler, "reconcileTenant">

export function createSecurityMutationAuditReconciliationHandler(input: Readonly<{
  authorizedTenantId: string
  reconciler: AuditReconciliationTarget
}>) {
  return async (
    event: SecurityMutationAuditReconciliationEvent
  ): Promise<SecurityMutationAuditReconciliationResult> => {
    if (!input.authorizedTenantId || input.authorizedTenantId.trim() !== input.authorizedTenantId) {
      throw new Error("Security mutation audit worker tenant is not configured")
    }
    if (typeof event.tenantId !== "string" || event.tenantId !== input.authorizedTenantId) {
      throw new Error("Security mutation audit worker tenant is not authorized")
    }
    const limit = event.limit === undefined ? 100 : event.limit
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Security mutation audit worker limit is invalid")
    }
    return input.reconciler.reconcileTenant(input.authorizedTenantId, limit)
  }
}

export async function handler(
  event: SecurityMutationAuditReconciliationEvent
): Promise<SecurityMutationAuditReconciliationResult> {
  const deps = createDependencies()
  const outbox = deps.securityAuditReconciliationOutbox
  if (!outbox) throw new Error("Security mutation audit reconciliation outbox is not configured")
  const identityProvider = deps.verifiedIdentityProvider
  if (!identityProvider) throw new Error("Security mutation audit reconciliation identity provider is not configured")
  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new SourceGovernanceAuditAuthoritativeResolver(deps.objectStore, outbox),
    new ResourceGroupMembershipAuditAuthoritativeResolver(deps.groupMembershipStore),
    new ResourceGroupUpdateAuditAuthoritativeResolver(deps.userGroupStore),
    new ResourceGroupCreateAuditAuthoritativeResolver(deps.objectStore, deps.userGroupStore, deps.groupMembershipStore),
    new ResourceGroupDeleteAuditAuthoritativeResolver(deps.objectStore, deps.userGroupStore, deps.groupMembershipStore),
    new ApplicationRoleAuditAuthoritativeResolver(identityProvider)
  ])
  return createSecurityMutationAuditReconciliationHandler({
    authorizedTenantId: config.authTenantId,
    reconciler
  })(event)
}
