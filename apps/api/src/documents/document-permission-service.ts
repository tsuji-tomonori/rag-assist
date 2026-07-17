import { createHash, randomUUID } from "node:crypto"
import { isApplicationRole } from "@memorag-mvp/contract/access-control"
import type { AppUser } from "../auth.js"
import { folderPermissionSatisfies, hasPermission, isActiveAccount, type EffectiveFolderPermission } from "../authorization.js"
import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import type { FolderPolicyStore } from "../adapters/folder-policy-store.js"
import { FolderPermissionService } from "../folders/folder-permission-service.js"
import type { ResourceUserPrincipalDirectory } from "../security/resource-group-membership-service.js"
import type { SecurityMutationAuditOutboxPort } from "../security/security-mutation-audit-outbox.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import {
  createResourcePermissionDecision,
  type ResourcePermissionContribution,
  type ResourcePermissionDecision,
  type ResourcePermissionDecisionReasonCode
} from "../security/resource-permission-decision.js"
import {
  enforceResourceGroupSearchUse,
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "../security/production-resource-operation-authorizer.js"
import type { ProtectedResourceOperation, ResourceOperationGuard } from "../security/resource-operation-authorization.js"
import type {
  DocumentManifest,
  DocumentPolicyPermissionLevel,
  DocumentShareAuditAction,
  DocumentShareAuditLogEntry,
  DocumentShareGrant,
  DocumentShareLedger,
  EffectiveDocumentPermission,
  FolderPrincipalType
} from "../types.js"

export type DocumentPermissionServiceDeps = {
  objectStore: ObjectStore
  documentGroupStore: DocumentGroupStore
  folderPolicyStore: FolderPolicyStore
  userGroupStore: UserGroupStore
  groupMembershipStore: GroupMembershipStore
  resourceUserPrincipalDirectory?: ResourceUserPrincipalDirectory
  securityAuditOutbox?: SecurityMutationAuditOutboxPort
}

export type DocumentShareGrantInput = {
  principalType: FolderPrincipalType
  principalId: string
  permissionLevel: DocumentPolicyPermissionLevel
}

export type DocumentShareInfo = {
  inheritedFolderGrants: Array<{
    folderId: string
    permissionLevel: EffectiveFolderPermission
  }>
  directDocumentGrants: DocumentShareGrant[]
  currentUserEffectivePermission: EffectiveDocumentPermission
}

export type VersionedDocumentSharePolicyState = Readonly<{
  grants: readonly DocumentShareGrant[]
  version: string
}>

export type ReplaceVersionedDocumentSharePolicyInput = Readonly<{
  grants: readonly DocumentShareGrantInput[]
  expectedVersion: string
  reason: string
}>

export const DOCUMENT_SHARE_POLICY_VERSION = "document-share-policy-v1" as const

const documentShareLegacyLedgerKey = "documents/share-grants.json"
const documentShareGrantPrefix = "documents/share-grants"
const documentShareAuditPrefix = "documents/share-audit"
const maxAuditAppendAttempts = 5

const permissionRank: Record<EffectiveDocumentPermission, number> = {
  none: 0,
  readOnly: 1,
  full: 2
}

const permissionByRank = ["none", "readOnly", "full"] as const

type DocumentPermissionResolution = {
  permission: EffectiveDocumentPermission
  integrity: "valid" | "invalid"
  explicitDeny: boolean
}

export class DocumentPermissionService {
  private readonly folderPermissionService: FolderPermissionService

  constructor(private readonly deps: DocumentPermissionServiceDeps) {
    this.folderPermissionService = new FolderPermissionService(deps)
  }

  async getShareInfo(user: AppUser, manifest: DocumentManifest): Promise<DocumentShareInfo> {
    const tenantId = requireManifestTenantId(manifest)
    const folderIds = this.folderIds(manifest)
    const [directDocumentGrants, folderDetails, decision] = await Promise.all([
      this.loadDocumentGrants(tenantId, manifest.documentId),
      Promise.all(folderIds.map((folderId) => this.folderPermissionService.resolveEffectiveFolderPermissionDetail(user, folderId))),
      this.resolveEffectiveDocumentPermissionDecision(user, manifest)
    ])
    return {
      inheritedFolderGrants: folderDetails.map((detail) => ({ folderId: detail.folderId, permissionLevel: detail.permission })),
      directDocumentGrants,
      currentUserEffectivePermission: decision.permission
    }
  }

  async resolveEffectiveDocumentPermission(user: AppUser, manifest: DocumentManifest): Promise<EffectiveDocumentPermission> {
    return (await this.resolveEffectiveDocumentPermissionDecision(user, manifest)).permission
  }

  async assertDocumentOperation(
    user: AppUser,
    manifest: DocumentManifest,
    operation: Extract<ProtectedResourceOperation, "read" | "update" | "share" | "searchUse">,
    satisfiedGuards: readonly ResourceOperationGuard[]
  ): Promise<void> {
    const tenantId = authoritativeManifestTenantId(manifest)
    const permission = await this.resolveEffectiveDocumentPermission(user, manifest)
    const authorizationPath = operation === "searchUse" ? "document" : "target"
    enforceResolvedResourceOperation(user, {
      resourceType: "document",
      operation,
      authorizationPath,
      resourceScopes: {
        target: resolvedResourceScope({
          tenantId,
          permission,
          lifecycle: manifest.lifecycleStatus === undefined || manifest.lifecycleStatus === "active" ? "active" : "inactive",
          integrity: manifest.derivedIntegrity?.verified === false ? "invalid" : "valid",
          administrativePrincipal: documentOwnerUserId(manifest) === user.userId
        })
      },
      satisfiedGuards
    })
  }

  async resolveEffectiveDocumentPermissionDecision(user: AppUser, manifest: DocumentManifest): Promise<ResourcePermissionDecision> {
    const tenantId = authoritativeManifestTenantId(manifest)
    if (!isCanonicalIdentifier(user.userId)) return documentDenied(user, manifest, "identity_unverified")
    if (!isActiveAccount(user)) return documentDenied(user, manifest, "account_not_active")
    if (!isCanonicalIdentifier(user.tenantId)) return documentDenied(user, manifest, "actor_tenant_unresolved")
    if (!isCanonicalIdentifier(tenantId)) return documentDenied(user, manifest, "resource_tenant_unresolved")
    if (user.tenantId !== tenantId) return documentDenied(user, manifest, "tenant_mismatch")
    if (manifest.lifecycleStatus !== undefined && manifest.lifecycleStatus !== "active") {
      return documentDenied(user, manifest, "resource_not_active")
    }
    if (!isCanonicalIdentifier(manifest.documentId) || manifest.derivedIntegrity?.verified === false) {
      return documentDenied(user, manifest, "resource_integrity_unverified")
    }
    const folderIds = this.folderIds(manifest)
    if (documentOwnerUserId(manifest) === user.userId) {
      return documentDecision(user, manifest, "full", "administrative_principal", [{
        sourceType: "administrativePrincipal",
        sourceId: `user:${user.userId}`,
        policyVersion: "document-administrative-principal-v1",
        effect: "allow",
        permission: "full",
        reasonCode: "administrative_principal"
      }])
    }

    const folderDetails = await Promise.all(folderIds.map((folderId) => this.folderPermissionService.resolveEffectiveFolderPermissionDetail(user, folderId)))
    let directGrants: DocumentShareGrant[]
    try {
      directGrants = await this.loadDocumentGrants(tenantId, manifest.documentId)
    } catch {
      return documentDenied(user, manifest, "ordinary_policy_unavailable", [{
        sourceType: "directDocumentPolicy",
        sourceId: manifest.documentId,
        policyVersion: DOCUMENT_SHARE_POLICY_VERSION,
        effect: "unavailable",
        permission: "none",
        reasonCode: "ordinary_policy_unavailable"
      }])
    }
    const directPermission = await this.resolveDirectDocumentPermission(
      user,
      manifest.documentId,
      tenantId,
      directGrants
    )
    const directPolicyVersion = `${DOCUMENT_SHARE_POLICY_VERSION}:${documentSharePolicyStateVersion(directGrants)}`
    const directContribution: ResourcePermissionContribution = {
      sourceType: "directDocumentPolicy",
      sourceId: manifest.documentId,
      policyVersion: directPolicyVersion,
      effect: directPermission.integrity === "invalid"
        ? "unavailable"
        : directPermission.explicitDeny
          ? "deny"
          : directPermission.permission === "none" ? "notApplicable" : "allow",
      permission: directPermission.permission,
      reasonCode: directPermission.integrity === "invalid"
        ? "ordinary_policy_unavailable"
        : directPermission.explicitDeny
          ? "ordinary_policy_denied"
          : directPermission.permission === "none" ? "no_matching_allow" : "allowed"
    }
    const legacyPermission = this.legacyMetadataPermission(user, manifest)
    const legacyContribution = legacyPermission === undefined ? [] : [{
      sourceType: "legacyPolicy" as const,
      sourceId: manifest.documentId,
      policyVersion: "legacy-document-metadata-acl-v1",
      effect: legacyPermission === "none" ? "notApplicable" as const : "allow" as const,
      permission: legacyPermission,
      reasonCode: legacyPermission === "none" ? "no_matching_allow" as const : "allowed" as const
    }]
    const contributions = [directContribution, ...folderDetails.flatMap((detail) => detail.decision.contributions), ...legacyContribution]
    const mandatoryFolderDeny = folderDetails.find((detail) => isMandatoryDenyDecision(detail.decision))
    if (mandatoryFolderDeny) {
      return documentDenied(user, manifest, mandatoryFolderDeny.decision.reasonCode, contributions)
    }
    if (directPermission.integrity === "invalid" || folderDetails.some((detail) => isUnavailableDecision(detail.decision))) {
      return documentDenied(user, manifest, "ordinary_policy_unavailable", contributions)
    }
    if (directPermission.explicitDeny || folderDetails.some((detail) => detail.decision.reasonCode === "ordinary_policy_denied")) {
      return documentDenied(user, manifest, "ordinary_policy_denied", contributions)
    }
    const permission = calculateEffectiveDocumentPermission(
      maxPermission(folderDetails.map((detail) => detail.permission)),
      maxPermission([directPermission.permission, legacyPermission ?? "none"])
    )
    return documentDecision(
      user,
      manifest,
      permission,
      permission === "none" ? "no_matching_allow" : "allowed",
      contributions
    )
  }

  async getVersionedDocumentSharePolicy(manifest: DocumentManifest): Promise<VersionedDocumentSharePolicyState> {
    const tenantId = requireManifestTenantId(manifest)
    const current = await this.loadDocumentGrantFile(tenantId, manifest.documentId)
    const grants = current?.grants ?? (await this.loadLegacyDocumentGrants(tenantId, manifest.documentId))
    return { grants, version: documentSharePolicyStateVersion(grants) }
  }

  async replaceVersionedDocumentSharePolicy(
    actor: AppUser,
    manifest: DocumentManifest,
    input: ReplaceVersionedDocumentSharePolicyInput
  ): Promise<VersionedDocumentSharePolicyState> {
    const auditOutbox = this.deps.securityAuditOutbox
    const principalDirectory = this.deps.resourceUserPrincipalDirectory
    if (!auditOutbox || !principalDirectory) throw new Error("Versioned document share policy security dependencies are not configured")
    const tenantId = requireManifestTenantId(manifest)
    const currentFile = await this.loadDocumentGrantFile(tenantId, manifest.documentId)
    const before = currentFile?.grants ?? (await this.loadLegacyDocumentGrants(tenantId, manifest.documentId))
    const currentVersion = documentSharePolicyStateVersion(before)
    let normalizedInputs = [...input.grants]
    const auditIntent = await auditOutbox.prepare({
      actorId: actor.userId,
      tenantId,
      targetType: "document",
      targetId: manifest.documentId,
      operation: "share.replace",
      before: auditDocumentGrants(before),
      proposedAfter: auditGrantInputs(input.grants),
      reason: input.reason.trim() || "missing_reason",
      policyVersion: DOCUMENT_SHARE_POLICY_VERSION
    })

    try {
      normalizedInputs = normalizeGrantInputs(normalizedInputs)
      validateDocumentShareRequest(normalizedInputs, input.reason)
      if (input.expectedVersion !== currentVersion) throw new DocumentShareConflictError("document share policy version conflict")
      const effectivePermission = await this.resolveEffectiveDocumentPermission(actor, manifest)
      if (!canShareDocument(effectivePermission, actor) || actor.tenantId !== tenantId) {
        throw new DocumentShareValidationError("actor cannot replace document share policy")
      }
      await this.validateSharePrincipals(manifest, normalizedInputs, principalDirectory)
      await this.assertDocumentOperation(actor, manifest, "share", [
        "principalsActiveSameTenant",
        "administrativePrincipalPreserved",
        "expectedVersionMatched"
      ])
    } catch (error) {
      const result = error instanceof DocumentShareConflictError ? "conflict" : "denied"
      await auditOutbox.complete(auditIntent.intentId, tenantId, result, auditDocumentGrants(before))
      throw error
    }

    const now = new Date().toISOString()
    const nextGrants: DocumentShareGrant[] = normalizedInputs.map((grant) => ({
      documentShareGrantId: `docshare_${randomUUID().slice(0, 12)}`,
      itemType: "documentShareGrant",
      tenantId,
      documentId: manifest.documentId,
      principalType: grant.principalType,
      principalId: grant.principalId,
      permissionLevel: grant.permissionLevel,
      createdBy: actor.userId,
      reason: input.reason,
      createdAt: now,
      updatedAt: now
    }))
    const cleanupRepairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    if (documentSharePolicyIncreases(before, nextGrants)) {
      try {
        await cleanupRepairOutbox.assertResourceFenceReleased(tenantId, "document", manifest.documentId)
      } catch {
        await auditOutbox.complete(auditIntent.intentId, tenantId, "conflict", auditDocumentGrants(before))
        throw new DocumentShareConflictError("document revocation cleanup is still fenced")
      }
    }
    const revokedCandidates = revokedDocumentGrants(before, nextGrants)
    const revoked: Array<{ grant: DocumentShareGrant; ceiling: "none" | "readOnly" }> = []
    for (const revokedGrant of revokedCandidates) {
      const grant = revokedGrant.grant
      if (grant.principalType === "user") {
        const remaining = await this.resolveEffectiveDocumentPermissionWithDirectGrants({
          userId: grant.principalId,
          cognitoGroups: [],
          accountStatus: "active",
          tenantId
        }, manifest, nextGrants)
        if (remaining === undefined || permissionRank[remaining] > permissionRank[revokedGrant.ceiling]) continue
      }
      revoked.push(revokedGrant)
    }
    const cleanupRegistration = revoked.length > 0 ? {
      operationId: `document-share:${auditIntent.intentId}`,
      tenantId,
      resourceType: "document" as const,
      resourceId: manifest.documentId,
      trigger: "share_revoked" as const,
      deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
      authoritativeDenyVersion: documentSharePolicyStateVersion(nextGrants),
      authoritativeDenyConfirmedAt: now,
      knownTargets: revoked.flatMap(({ grant, ceiling }) => {
        const principal = `${grant.principalType}:${grant.principalId}`
        const principalReference = `document:${manifest.documentId}:principal:${principal}`
        return [
          { scope: "grant" as const, reference: `${principalReference}:ceiling:${ceiling}` },
          { scope: "cache" as const, reference: principalReference },
          { scope: "session" as const, reference: `${principalReference}/session` },
          { scope: "queued_run" as const, reference: principalReference }
        ]
      })
    } : undefined
    if (cleanupRegistration) {
      try {
        await cleanupRepairOutbox.prepare({
          expectedBeforeDenyVersion: currentVersion,
          cleanupRegistration,
          preparedAt: now
        })
      } catch {
        await auditOutbox.complete(auditIntent.intentId, tenantId, "failed", auditDocumentGrants(before))
        throw new Error("Document revocation cleanup repair intent could not be persisted")
      }
    }
    try {
      await this.saveDocumentGrants(tenantId, manifest.documentId, nextGrants, currentFile?.version)
    } catch (error) {
      if (cleanupRegistration) {
        await cleanupRepairOutbox.markAbandoned({
          tenantId,
          resourceType: "document",
          resourceId: manifest.documentId,
          operationId: cleanupRegistration.operationId
        }, now).catch(() => undefined)
      }
      const result = error instanceof DocumentShareConflictError ? "conflict" : "failed"
      await auditOutbox.complete(auditIntent.intentId, tenantId, result, auditDocumentGrants(before))
      throw error
    }
    if (cleanupRegistration) {
      try {
        const committed = await cleanupRepairOutbox.markDenyCommitted({
          tenantId,
          resourceType: "document",
          resourceId: manifest.documentId,
          operationId: cleanupRegistration.operationId
        }, now)
        await new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore).register(committed.cleanupRegistration)
        await cleanupRepairOutbox.markCleanupRegistered(committed, now)
      } catch (error) {
        await auditOutbox.complete(auditIntent.intentId, tenantId, "failed", auditDocumentGrants(nextGrants))
        throw error
      }
    }
    await auditOutbox.complete(auditIntent.intentId, tenantId, "success", auditDocumentGrants(nextGrants))
    return { grants: nextGrants, version: documentSharePolicyStateVersion(nextGrants) }
  }

  async replaceDocumentShareGrants(
    actor: AppUser,
    manifest: DocumentManifest,
    grants: DocumentShareGrantInput[],
    reason: string
  ): Promise<DocumentShareInfo> {
    validateDocumentShareRequest(grants, reason)
    const tenantId = requireManifestTenantId(manifest)
    const current = await this.loadDocumentGrantFile(tenantId, manifest.documentId)
    const before = current?.grants ?? (await this.loadLegacyDocumentGrants(tenantId, manifest.documentId))
    const now = new Date().toISOString()
    const normalized = normalizeGrantInputs(grants)
    const ownerUserId = documentOwnerUserId(manifest)
    if (ownerUserId && normalized.some((grant) => (
      grant.principalType === "user" && grant.principalId === ownerUserId && grant.permissionLevel === "deny"
    ))) throw new DocumentShareValidationError("document policy cannot deny the administrative principal")
    const nextGrants: DocumentShareGrant[] = normalized.map((grant) => ({
      documentShareGrantId: `docshare_${randomUUID().slice(0, 12)}`,
      itemType: "documentShareGrant",
      tenantId,
      documentId: manifest.documentId,
      principalType: grant.principalType,
      principalId: grant.principalId,
      permissionLevel: grant.permissionLevel,
      createdBy: actor.userId,
      reason,
      createdAt: now,
      updatedAt: now
    }))
    await this.saveDocumentGrants(tenantId, manifest.documentId, nextGrants, current?.version)
    await this.appendDocumentAudit(actor, "document:share", tenantId, manifest.documentId, before, nextGrants, reason, now)
    return this.getShareInfo(actor, manifest)
  }

  async appendDocumentAudit(
    actor: AppUser,
    action: DocumentShareAuditAction,
    tenantId: string,
    documentId: string,
    before: unknown,
    after: unknown,
    reason: string,
    createdAt = new Date().toISOString()
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAuditAppendAttempts; attempt += 1) {
      const current = await this.loadDocumentAudit(tenantId, documentId)
      const auditLog = current?.auditLog ?? []
      auditLog.unshift(buildAuditEntry(actor, action, tenantId, documentId, before, after, reason, createdAt))
      try {
        await this.saveDocumentAudit(tenantId, documentId, auditLog.slice(0, 500), current?.version)
        return
      } catch (err) {
        if (!isConditionalWriteError(err) || attempt === maxAuditAppendAttempts) throw err
      }
    }
  }

  private async validateSharePrincipals(
    manifest: DocumentManifest,
    grants: readonly DocumentShareGrantInput[],
    principalDirectory: ResourceUserPrincipalDirectory
  ): Promise<void> {
    const tenantId = requireManifestTenantId(manifest)
    const ownerUserId = documentOwnerUserId(manifest)
    if (!ownerUserId) throw new DocumentShareValidationError("document administrative principal is missing")
    const owner = await principalDirectory.getUser(ownerUserId)
    if (!owner || owner.status !== "active" || owner.tenantId !== tenantId) {
      throw new DocumentShareValidationError("document administrative principal is inactive or cross-tenant")
    }
    for (const grant of grants) {
      if (!isCanonicalIdentifier(grant.principalId)) throw new DocumentShareValidationError("principalId is invalid")
      if (grant.principalType === "user" && grant.principalId === ownerUserId && grant.permissionLevel === "deny") {
        throw new DocumentShareValidationError("document policy cannot deny the administrative principal")
      }
      if (grant.principalType === "user") {
        const user = await principalDirectory.getUser(grant.principalId)
        if (!user || user.status !== "active" || user.tenantId !== tenantId) {
          throw new DocumentShareValidationError("document share user principal is missing, inactive, or cross-tenant")
        }
        continue
      }
      if (isApplicationRole(grant.principalId)) throw new DocumentShareValidationError("application roles cannot be document share principals")
      const group = await this.deps.userGroupStore.get(tenantId, grant.principalId)
      if (!group || group.status !== "active" || group.tenantId !== tenantId) {
        throw new DocumentShareValidationError("document share group principal is missing, inactive, or cross-tenant")
      }
    }
  }

  async listAuditLog(): Promise<DocumentShareAuditLogEntry[]> {
    const ledger = await this.loadLedger()
    return [...ledger.auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
  }

  async loadLedger(): Promise<DocumentShareLedger> {
    const [grants, auditLog] = await Promise.all([
      this.loadAllDocumentGrants(),
      this.loadAllDocumentAudit()
    ])
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(documentShareLegacyLedgerKey)) as Partial<DocumentShareLedger>
      return {
        schemaVersion: 1,
        grants: mergeGrants(grants, Array.isArray(raw.grants) ? raw.grants : []),
        auditLog: mergeAuditEntries(auditLog, Array.isArray(raw.auditLog) ? raw.auditLog : [])
      }
    } catch (err) {
      if (isMissingObjectError(err) || err instanceof SyntaxError) return { schemaVersion: 1, grants, auditLog }
      throw err
    }
  }

  private async loadDocumentGrants(tenantId: string, documentId: string): Promise<DocumentShareGrant[]> {
    const current = await this.loadDocumentGrantFile(tenantId, documentId)
    if (current) return current.grants
    return this.loadLegacyDocumentGrants(tenantId, documentId)
  }

  private async loadDocumentGrantFile(tenantId: string, documentId: string): Promise<{ grants: DocumentShareGrant[]; version: string } | undefined> {
    try {
      const file = await getTextWithVersion(this.deps.objectStore, documentShareGrantKey(tenantId, documentId))
      const raw = JSON.parse(file.text) as Partial<DocumentShareLedger>
      return {
        grants: sortGrants(Array.isArray(raw.grants) ? raw.grants.filter((grant) => grant.tenantId === tenantId && grant.documentId === documentId) : []),
        version: file.version
      }
    } catch (err) {
      if (isMissingObjectError(err)) return undefined
      throw err
    }
  }

  private async loadLegacyDocumentGrants(tenantId: string, documentId: string): Promise<DocumentShareGrant[]> {
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(documentShareLegacyLedgerKey)) as Partial<DocumentShareLedger>
      return sortGrants(Array.isArray(raw.grants) ? raw.grants.filter((grant) => grant.tenantId === tenantId && grant.documentId === documentId) : [])
    } catch (err) {
      if (isMissingObjectError(err)) return []
      throw err
    }
  }

  private async saveDocumentGrants(tenantId: string, documentId: string, grants: DocumentShareGrant[], expectedVersion: string | undefined): Promise<void> {
    try {
      await putTextIfVersion(this.deps.objectStore, documentShareGrantKey(tenantId, documentId), JSON.stringify({
        schemaVersion: 1,
        grants: sortGrants(grants)
      }, null, 2), expectedVersion, "application/json")
    } catch (err) {
      if (isConditionalWriteError(err)) throw new DocumentShareConflictError("document share grants changed concurrently")
      throw err
    }
  }

  private async loadDocumentAudit(tenantId: string, documentId: string): Promise<{ auditLog: DocumentShareAuditLogEntry[]; version: string } | undefined> {
    try {
      const file = await getTextWithVersion(this.deps.objectStore, documentShareAuditKey(tenantId, documentId))
      const raw = JSON.parse(file.text) as Partial<DocumentShareLedger>
      return { auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : [], version: file.version }
    } catch (err) {
      if (isMissingObjectError(err)) return undefined
      if (err instanceof SyntaxError) return { auditLog: [], version: "" }
      throw err
    }
  }

  private async saveDocumentAudit(tenantId: string, documentId: string, auditLog: DocumentShareAuditLogEntry[], expectedVersion: string | undefined): Promise<void> {
    await putTextIfVersion(this.deps.objectStore, documentShareAuditKey(tenantId, documentId), JSON.stringify({
      schemaVersion: 1,
      auditLog
    }, null, 2), expectedVersion, "application/json")
  }

  private async loadAllDocumentGrants(): Promise<DocumentShareGrant[]> {
    const keys = await this.deps.objectStore.listKeys(`${documentShareGrantPrefix}/`)
    const entries = await Promise.all(keys.filter((key) => key.endsWith(".json")).map(async (key) => {
      try {
        const raw = JSON.parse(await this.deps.objectStore.getText(key)) as Partial<DocumentShareLedger>
        return Array.isArray(raw.grants) ? raw.grants : []
      } catch (err) {
        if (isMissingObjectError(err) || err instanceof SyntaxError) return []
        throw err
      }
    }))
    return sortGrants(entries.flat())
  }

  private async loadAllDocumentAudit(): Promise<DocumentShareAuditLogEntry[]> {
    const keys = await this.deps.objectStore.listKeys(`${documentShareAuditPrefix}/`)
    const entries = await Promise.all(keys.filter((key) => key.endsWith(".json")).map(async (key) => {
      try {
        const raw = JSON.parse(await this.deps.objectStore.getText(key)) as Partial<DocumentShareLedger>
        return Array.isArray(raw.auditLog) ? raw.auditLog : []
      } catch (err) {
        if (isMissingObjectError(err) || err instanceof SyntaxError) return []
        throw err
      }
    }))
    return entries.flat()
  }

  private async resolveDirectDocumentPermission(
    user: AppUser,
    documentId: string,
    tenantId: string,
    grants: DocumentShareGrant[]
  ): Promise<DocumentPermissionResolution> {
    const permissions = await Promise.all(grants.map((grant) => this.evaluateGrant(user, grant, tenantId, documentId)))
    if (permissions.some((permission) => permission.integrity === "invalid")) return invalidDocumentResolution()
    if (permissions.some((permission) => permission.explicitDeny)) return deniedDocumentResolution()
    return validDocumentResolution(maxPermission(permissions.map((permission) => permission.permission), documentId))
  }

  private async resolveEffectiveDocumentPermissionWithDirectGrants(
    user: AppUser,
    manifest: DocumentManifest,
    directGrants: DocumentShareGrant[]
  ): Promise<EffectiveDocumentPermission | undefined> {
    const tenantId = authoritativeManifestTenantId(manifest)
    if (!tenantId) return undefined
    if (documentOwnerUserId(manifest) === user.userId) return "full"
    const folderDetails = await Promise.all(this.folderIds(manifest).map((folderId) => (
      this.folderPermissionService.resolveEffectiveFolderPermissionDetail(user, folderId)
    )))
    const direct = await this.resolveDirectDocumentPermission(user, manifest.documentId, tenantId, directGrants)
    if (direct.integrity === "invalid" || folderDetails.some((detail) => isUnavailableDecision(detail.decision))) return undefined
    if (direct.explicitDeny || folderDetails.some((detail) => detail.decision.reasonCode === "ordinary_policy_denied")) return "none"
    const legacy = this.legacyMetadataPermission(user, manifest) ?? "none"
    return calculateEffectiveDocumentPermission(
      maxPermission(folderDetails.map((detail) => detail.permission)),
      maxPermission([direct.permission, legacy])
    )
  }

  private async evaluateGrant(
    user: AppUser,
    grant: DocumentShareGrant,
    tenantId: string,
    documentId: string
  ): Promise<DocumentPermissionResolution> {
    if (
      grant.tenantId !== tenantId ||
      grant.documentId !== documentId ||
      !isCanonicalIdentifier(grant.principalId)
    ) return invalidDocumentResolution()
    if (grant.principalType === "user") {
      if (user.userId !== grant.principalId) return validDocumentResolution("none")
      return grant.permissionLevel === "deny" ? deniedDocumentResolution() : validDocumentResolution(grant.permissionLevel)
    }
    const membership = await this.resolveUserMembershipPermission(user, grant.principalId, tenantId, new Set())
    if (membership.integrity === "invalid") return membership
    if (grant.permissionLevel === "deny") return membership.permission === "none" ? validDocumentResolution("none") : deniedDocumentResolution()
    const permission = minPermission(grant.permissionLevel, membership.permission)
    if (permission === "none") return validDocumentResolution("none")
    try {
      enforceResourceGroupSearchUse({
        actor: user,
        tenantId,
        targetPermission: permission,
        activeSameTenantMembership: true
      })
      return validDocumentResolution(permission)
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) return invalidDocumentResolution()
      throw error
    }
  }

  private async resolveUserMembershipPermission(
    user: AppUser,
    groupId: string,
    tenantId: string,
    path: Set<string>
  ): Promise<DocumentPermissionResolution> {
    if (path.has(groupId)) return invalidDocumentResolution()
    const nextPath = new Set(path)
    nextPath.add(groupId)
    let group
    let memberships
    try {
      group = await this.deps.userGroupStore.get(tenantId, groupId)
      memberships = await this.deps.groupMembershipStore.listByGroupId(tenantId, groupId)
    } catch {
      return invalidDocumentResolution()
    }
    if (!group || group.status !== "active" || group.tenantId !== tenantId) return invalidDocumentResolution()

    const grants: EffectiveDocumentPermission[] = []
    for (const membership of memberships) {
      if (membership.groupId !== groupId || membership.tenantId !== tenantId || !isCanonicalIdentifier(membership.memberId)) {
        return invalidDocumentResolution()
      }
      if (membership.memberType === "user") {
        if (membership.memberId === user.userId) grants.push(membership.permissionLevel)
        continue
      }
      const child = await this.resolveUserMembershipPermission(user, membership.memberId, tenantId, nextPath)
      if (child.integrity === "invalid") return child
      grants.push(minPermission(membership.permissionLevel, child.permission))
    }
    return validDocumentResolution(maxPermission(grants, groupId))
  }

  private folderIds(manifest: DocumentManifest): string[] {
    return stringArray(manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId)
  }

  private legacyMetadataPermission(user: AppUser, manifest: DocumentManifest): EffectiveDocumentPermission | undefined {
    const localFixture = Boolean((this.deps as DocumentPermissionServiceDeps & { localTestIngestAdmissionContext?: unknown }).localTestIngestAdmissionContext)
    if (!localFixture) return undefined
    const allowedUsers = stringArray(manifest.metadata?.allowedUsers ?? manifest.metadata?.userIds)
    if (allowedUsers.length === 0) return undefined
    return allowedUsers.includes(user.userId) ? "readOnly" : "none"
  }
}

function validDocumentResolution(permission: EffectiveDocumentPermission): DocumentPermissionResolution {
  return { permission, integrity: "valid", explicitDeny: false }
}

function deniedDocumentResolution(): DocumentPermissionResolution {
  return { permission: "none", integrity: "valid", explicitDeny: true }
}

function invalidDocumentResolution(): DocumentPermissionResolution {
  return { permission: "none", integrity: "invalid", explicitDeny: false }
}

function documentOwnerUserId(manifest: DocumentManifest): string | undefined {
  const metadataOwner = manifest.metadata?.ownerUserId
  if (typeof metadataOwner === "string" && isCanonicalIdentifier(metadataOwner)) return metadataOwner
  return isCanonicalIdentifier(manifest.admission?.ownerUserId) ? manifest.admission.ownerUserId : undefined
}

function authoritativeManifestTenantId(manifest: DocumentManifest): string | undefined {
  const metadataTenantValue = manifest.metadata?.tenantId
  const admissionTenantValue: unknown = manifest.admission?.tenantId
  if (metadataTenantValue !== undefined && typeof metadataTenantValue !== "string") return undefined
  if (admissionTenantValue !== undefined && typeof admissionTenantValue !== "string") return undefined
  const metadataTenant = metadataTenantValue
  const admissionTenant = admissionTenantValue
  if (metadataTenant !== undefined && !isCanonicalIdentifier(metadataTenant)) return undefined
  if (admissionTenant !== undefined && !isCanonicalIdentifier(admissionTenant)) return undefined
  if (metadataTenant !== undefined && admissionTenant !== undefined && metadataTenant !== admissionTenant) return undefined
  return metadataTenant ?? admissionTenant
}

function requireManifestTenantId(manifest: DocumentManifest): string {
  const tenantId = authoritativeManifestTenantId(manifest)
  if (!tenantId) throw new DocumentShareValidationError("document tenant is missing, invalid, or conflicting")
  return tenantId
}

function documentDecision(
  user: AppUser,
  manifest: DocumentManifest,
  permission: EffectiveDocumentPermission,
  reasonCode: ResourcePermissionDecisionReasonCode,
  contributions: readonly ResourcePermissionContribution[]
): ResourcePermissionDecision {
  return createResourcePermissionDecision({
    resourceType: "document",
    resourceId: manifest.documentId,
    actorId: user.userId,
    permission,
    reasonCode,
    contributions
  })
}

function documentDenied(
  user: AppUser,
  manifest: DocumentManifest,
  reasonCode: ResourcePermissionDecisionReasonCode,
  contributions: readonly ResourcePermissionContribution[] = []
): ResourcePermissionDecision {
  return documentDecision(user, manifest, "none", reasonCode, contributions)
}

function isUnavailableDecision(decision: ResourcePermissionDecision): boolean {
  return decision.reasonCode === "ordinary_policy_unavailable"
}

function isMandatoryDenyDecision(decision: ResourcePermissionDecision): boolean {
  return [
    "account_not_active",
    "actor_tenant_unresolved",
    "identity_unverified",
    "resource_integrity_unverified",
    "resource_not_active",
    "resource_tenant_unresolved",
    "tenant_mismatch"
  ].includes(decision.reasonCode)
}

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

export function documentSharePolicyStateVersion(grants: readonly DocumentShareGrant[]): string {
  return createHash("sha256").update(JSON.stringify(sortGrants([...grants]))).digest("hex")
}

function auditDocumentGrants(grants: readonly DocumentShareGrant[]) {
  return grants.map((grant) => ({
    tenantId: grant.tenantId,
    documentId: grant.documentId,
    principalType: grant.principalType,
    principalId: grant.principalId,
    permissionLevel: grant.permissionLevel,
    updatedAt: grant.updatedAt
  }))
}

function auditGrantInputs(grants: readonly DocumentShareGrantInput[]) {
  return grants.map((grant) => ({
    principalType: grant.principalType,
    principalId: grant.principalId,
    permissionLevel: grant.permissionLevel
  }))
}

export function calculateEffectiveDocumentPermission(
  folderPermission: EffectiveFolderPermission,
  directDocumentPermission: EffectiveDocumentPermission
): EffectiveDocumentPermission {
  return maxPermission([folderPermission, directDocumentPermission])
}

export function canShareDocument(permission: EffectiveDocumentPermission, user: AppUser): boolean {
  return permission === "full" && hasPermission(user, "rag:doc:share")
}

export function canMoveDocument(
  documentPermission: EffectiveDocumentPermission,
  destinationFolderPermission: EffectiveFolderPermission,
  user: AppUser
): boolean {
  return documentPermission === "full" && folderPermissionSatisfies(destinationFolderPermission, "full") && hasPermission(user, "rag:doc:move")
}

export function validateDocumentShareRequest(grants: DocumentShareGrantInput[], reason: string): void {
  if (!reason.trim()) throw new DocumentShareValidationError("reason is required")
  normalizeGrantInputs(grants)
}

export function validateDocumentMoveRequest(input: { destinationFolderId?: string; reason?: string }): void {
  if (!input.destinationFolderId?.trim()) throw new Error("destinationFolderId is required")
  if (!input.reason?.trim()) throw new Error("reason is required")
}

function normalizeGrantInputs(grants: DocumentShareGrantInput[]): DocumentShareGrantInput[] {
  const seen = new Set<string>()
  return grants.map((grant) => ({
    principalType: grant.principalType,
    principalId: grant.principalId.trim(),
    permissionLevel: grant.permissionLevel
  })).filter((grant) => {
    if (!grant.principalId) throw new DocumentShareValidationError("principalId is required")
    const key = `${grant.principalType}:${grant.principalId}`
    if (seen.has(key)) throw new DocumentShareValidationError(`duplicate grant: ${key}`)
    seen.add(key)
    return true
  })
}

function minPermission(left: EffectiveDocumentPermission, right: EffectiveDocumentPermission): EffectiveDocumentPermission {
  return permissionByRank[Math.min(permissionRank[left], permissionRank[right])] ?? "none"
}

function maxPermission(values: EffectiveDocumentPermission[], _debugId?: string): EffectiveDocumentPermission {
  const rank = values.reduce((current, value) => Math.max(current, permissionRank[value]), 0)
  return permissionByRank[rank] ?? "none"
}

function stringArray(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function buildAuditEntry(
  actor: AppUser,
  action: DocumentShareAuditAction,
  tenantId: string,
  documentId: string,
  before: unknown,
  after: unknown,
  reason: string,
  createdAt: string
): DocumentShareAuditLogEntry {
  return {
    auditId: `audit_${randomUUID().slice(0, 12)}`,
    action,
    tenantId,
    actorUserId: actor.userId,
    documentId,
    before: toJsonValue(before),
    after: toJsonValue(after),
    reason,
    createdAt
  }
}

function sortGrants(grants: DocumentShareGrant[]): DocumentShareGrant[] {
  return [...grants].sort((a, b) => a.principalType.localeCompare(b.principalType) || a.principalId.localeCompare(b.principalId))
}

function mergeGrants(primary: DocumentShareGrant[], legacy: DocumentShareGrant[]): DocumentShareGrant[] {
  const byKey = new Map<string, DocumentShareGrant>()
  for (const grant of [...legacy, ...primary]) {
    byKey.set(`${grant.tenantId}:${grant.documentId}:${grant.principalType}:${grant.principalId}`, grant)
  }
  return sortGrants([...byKey.values()])
}

function mergeAuditEntries(primary: DocumentShareAuditLogEntry[], legacy: DocumentShareAuditLogEntry[]): DocumentShareAuditLogEntry[] {
  const byId = new Map<string, DocumentShareAuditLogEntry>()
  for (const entry of [...legacy, ...primary]) byId.set(entry.auditId, entry)
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function documentShareGrantKey(tenantId: string, documentId: string): string {
  return `${documentShareGrantPrefix}/${encodePathPart(tenantId)}/${encodePathPart(documentId)}.json`
}

function revokedDocumentGrants(
  before: readonly DocumentShareGrant[],
  after: readonly DocumentShareGrant[]
): Array<{ grant: DocumentShareGrant; ceiling: "none" | "readOnly" }> {
  const afterByPrincipal = new Map(after.map((grant) => [`${grant.principalType}:${grant.principalId}`, grant]))
  return before.flatMap<{ grant: DocumentShareGrant; ceiling: "none" | "readOnly" }>((grant) => {
    if (grant.permissionLevel === "deny") return []
    const replacement = afterByPrincipal.get(`${grant.principalType}:${grant.principalId}`)
    if (!replacement || replacement.permissionLevel === "deny") return [{ grant, ceiling: "none" as const }]
    if (grant.permissionLevel === "full" && replacement.permissionLevel === "readOnly") {
      return [{ grant, ceiling: "readOnly" as const }]
    }
    return []
  })
}

function documentSharePolicyIncreases(
  before: readonly DocumentShareGrant[],
  after: readonly DocumentShareGrant[]
): boolean {
  const rank: Record<DocumentPolicyPermissionLevel, number> = { deny: 0, readOnly: 1, full: 2 }
  const beforeByPrincipal = new Map(before.map((grant) => [`${grant.principalType}:${grant.principalId}`, grant.permissionLevel]))
  return after.some((grant) => rank[grant.permissionLevel] > rank[beforeByPrincipal.get(`${grant.principalType}:${grant.principalId}`) ?? "deny"])
}

function documentShareAuditKey(tenantId: string, documentId: string): string {
  return `${documentShareAuditPrefix}/${encodePathPart(tenantId)}/${encodePathPart(documentId)}.json`
}

async function getTextWithVersion(objectStore: ObjectStore, key: string): Promise<{ text: string; version: string }> {
  if (typeof objectStore.getTextWithVersion === "function") return objectStore.getTextWithVersion(key)
  const text = await objectStore.getText(key)
  return { text, version: versionForText(text) }
}

async function putTextIfVersion(
  objectStore: ObjectStore,
  key: string,
  text: string,
  expectedVersion: string | undefined,
  contentType: string
): Promise<void> {
  if (typeof objectStore.putTextIfVersion === "function") {
    await objectStore.putTextIfVersion(key, text, expectedVersion, contentType)
    return
  }
  if (expectedVersion !== undefined) {
    const current = await getTextWithVersion(objectStore, key)
    if (current.version !== expectedVersion) throw conditionalWriteError(key)
  } else {
    try {
      await objectStore.getText(key)
      throw conditionalWriteError(key)
    } catch (err) {
      if (!isMissingObjectError(err)) throw err
    }
  }
  await objectStore.putText(key, text, contentType)
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

export class DocumentShareValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DocumentShareValidationError"
  }
}

export class DocumentShareConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DocumentShareConflictError"
  }
}

function toJsonValue(value: unknown): DocumentShareAuditLogEntry["before"] {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as DocumentShareAuditLogEntry["before"]
}

function isMissingObjectError(err: unknown): boolean {
  const candidate = err as { code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate?.code === "ENOENT" ||
    candidate?.name === "NoSuchKey" ||
    candidate?.$metadata?.httpStatusCode === 404 ||
    (typeof candidate?.message === "string" && candidate.message.includes("NoSuchKey"))
}

function isConditionalWriteError(err: unknown): boolean {
  const candidate = err as { code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate?.code === "PRECONDITION_FAILED" ||
    candidate?.name === "PreconditionFailed" ||
    candidate?.$metadata?.httpStatusCode === 409 ||
    candidate?.$metadata?.httpStatusCode === 412 ||
    (typeof candidate?.message === "string" && candidate.message.includes("Conditional write failed"))
}

function conditionalWriteError(key: string): Error {
  const err = new Error(`Conditional write failed for ${key}`)
  Object.assign(err, { code: "PRECONDITION_FAILED" })
  return err
}

function versionForText(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}
