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
import { FolderShareAuditAuthoritativeResolver } from "./security/folder-share-audit-reconciler.js"
import { DocumentShareAuditAuthoritativeResolver } from "./security/document-share-audit-reconciler.js"
import { FolderMoveAuditAuthoritativeResolver } from "./security/folder-move-audit-reconciler.js"
import { FolderDeleteAuditAuthoritativeResolver } from "./security/folder-delete-audit-reconciler.js"
import { DocumentMoveAuditAuthoritativeResolver } from "./security/document-move-audit-reconciler.js"
import { DocumentDeleteAuditAuthoritativeResolver } from "./security/document-delete-audit-reconciler.js"

export type SecurityMutationAuditReconciliationEvent = Readonly<{
  tenantId?: unknown
  limit?: unknown
  intentIds?: unknown
}>

type AuditReconciliationTarget = Readonly<{
  reconcileTenant(tenantId: string, limit?: number): Promise<SecurityMutationAuditReconciliationResult>
}>

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

/**
 * Build the cost-priority EventBridge consumer.
 *
 * The synchronous mutation path still writes the durable audit intent. Only
 * background enumeration/finalization is deferred: this consumer validates
 * the tenant boundary and returns without constructing an S3-backed outbox or
 * listing source-governance records.
 */
export function createCostPrioritySecurityMutationAuditReconciliationHandler(authorizedTenantId: string) {
  return createSecurityMutationAuditReconciliationHandler({
    authorizedTenantId,
    reconciler: {
      reconcileTenant: async (tenantId) => ({
        tenantId,
        scanned: 0,
        completed: 0,
        repaired: 0
      })
    }
  })
}

export function validateBoundedRepairEvent(event: SecurityMutationAuditReconciliationEvent, tenantId: string): string[] {
  if (!tenantId || event.tenantId !== tenantId) throw new Error("Audit repair tenant is not authorized")
  const ids = event.intentIds
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || new Set(ids).size !== ids.length
    || ids.some((id) => typeof id !== "string" || !id || id.trim() !== id)) {
    throw new Error("Audit repair requires 1 to 100 unique intent IDs")
  }
  return ids as string[]
}

export async function handler(event: SecurityMutationAuditReconciliationEvent): Promise<SecurityMutationAuditReconciliationResult> {
  if (process.env.SECURITY_AUDIT_BOUNDED_REPAIR_ENABLED !== "true") {
    return createCostPrioritySecurityMutationAuditReconciliationHandler(config.authTenantId)(event)
  }
  const intentIds = validateBoundedRepairEvent(event, config.authTenantId)
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
    new ApplicationRoleAuditAuthoritativeResolver(identityProvider),
    new FolderShareAuditAuthoritativeResolver(deps.folderPolicyStore, deps.objectStore),
    new DocumentShareAuditAuthoritativeResolver(deps.objectStore),
    new FolderMoveAuditAuthoritativeResolver({
      objects: deps.objectStore,
      groups: deps.documentGroupStore,
      policies: deps.folderPolicyStore,
      userGroups: deps.userGroupStore,
      memberships: deps.groupMembershipStore,
      identities: identityProvider
    }),
    new FolderDeleteAuditAuthoritativeResolver(deps.objectStore, deps.documentGroupStore),
    new DocumentMoveAuditAuthoritativeResolver({
      objects: deps.objectStore,
      groups: deps.documentGroupStore,
      policies: deps.folderPolicyStore,
      userGroups: deps.userGroupStore,
      memberships: deps.groupMembershipStore,
      identities: identityProvider
    }),
    new DocumentDeleteAuditAuthoritativeResolver({
      objects: deps.objectStore,
      localTestIngestAdmissionContext: deps.localTestIngestAdmissionContext,
      legacyGlobalDocumentArtifacts: deps.legacyGlobalDocumentArtifacts
    })
  ])
  return reconciler.reconcileIntents(config.authTenantId, intentIds)
}
