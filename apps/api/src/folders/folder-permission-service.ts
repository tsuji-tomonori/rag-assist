import { HTTPException } from "hono/http-exception"
import { isApplicationRole } from "@memorag-mvp/contract/access-control"
import type { AppUser } from "../auth.js"
import { folderPermissionSatisfies, hasPermission, isActiveAccount, type EffectiveFolderPermission } from "../authorization.js"
import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import { folderPolicyStateVersion, type FolderPolicyStore } from "../adapters/folder-policy-store.js"
import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type {
  ResourceUserPrincipal,
  ResourceUserPrincipalDirectory
} from "../security/resource-group-membership-service.js"
import type {
  SecurityMutationAuditIntent,
  SecurityMutationAuditOutboxPort,
  SecurityMutationResult
} from "../security/security-mutation-audit-outbox.js"
import type { DocumentGroup, FolderPolicy, FolderPolicyEntry, FolderPolicyPermissionLevel, FolderPolicySource } from "../types.js"
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

export type EffectiveFolderPermissionDetail = {
  folderId: string
  permission: EffectiveFolderPermission
  policySource: FolderPolicySource
  policyId?: string
  inheritedFromFolderId?: string
  decision: ResourcePermissionDecision
}

export type FolderPermissionServiceDeps = {
  documentGroupStore: DocumentGroupStore
  folderPolicyStore: FolderPolicyStore
  userGroupStore: UserGroupStore
  groupMembershipStore: GroupMembershipStore
  resourceUserPrincipalDirectory?: ResourceUserPrincipalDirectory
  securityAuditOutbox?: SecurityMutationAuditOutboxPort
  objectStore?: ObjectStore
  cleanupCoordinator?: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
  now?: () => Date
}

export const FOLDER_SHARE_POLICY_VERSION = "folder-share-policy-v1" as const

export type ReplaceVersionedFolderPolicyInput = Readonly<{
  expectedVersion: string
  entries: readonly FolderPolicyEntry[]
  reason: string
}>

export type ReplaceVersionedFolderPolicyResult = Readonly<{
  policy: FolderPolicy
  version: string
  auditIntentId: string
}>

export class FolderPolicyMutationError extends Error {
  constructor(
    message: string,
    readonly result: Exclude<SecurityMutationResult, "success">
  ) {
    super(message)
    this.name = "FolderPolicyMutationError"
  }
}

type PermissionResolution = {
  permission: EffectiveFolderPermission
  integrity: "valid" | "invalid"
  explicitDeny: boolean
}

const permissionRank: Record<EffectiveFolderPermission, number> = {
  none: 0,
  readOnly: 1,
  full: 2
}

const permissionByRank = ["none", "readOnly", "full"] as const

export class FolderPermissionService {
  constructor(private readonly deps: FolderPermissionServiceDeps) {}

  async resolveEffectiveFolderPermission(user: AppUser, folderId: string): Promise<EffectiveFolderPermission> {
    return (await this.resolveEffectiveFolderPermissionDetail(user, folderId)).permission
  }

  async assertFolderOperation(
    user: AppUser,
    folderId: string,
    operation: Extract<ProtectedResourceOperation, "read" | "update" | "share" | "searchUse">,
    satisfiedGuards: readonly ResourceOperationGuard[]
  ): Promise<void> {
    const detail = await this.resolveEffectiveFolderPermissionDetail(user, folderId)
    const actorTenantId = isCanonicalIdentifier(user.tenantId) ? user.tenantId : ""
    const folder = await this.deps.documentGroupStore.get(actorTenantId, folderId)
    const tenantId = folder?.tenantId
    enforceResolvedResourceOperation(user, {
      resourceType: "folder",
      operation,
      authorizationPath: operation === "searchUse" ? "folder" : "target",
      resourceScopes: {
        target: resolvedResourceScope({
          tenantId,
          permission: detail.permission,
          lifecycle: folder?.status === "archived" ? "archived" : folder ? "active" : "unknown",
          integrity: folder && canonicalFolderIdentity(folder) ? "valid" : "unknown",
          administrativePrincipal: folder?.adminPrincipalType === "user" && folder.adminPrincipalId === user.userId
        })
      },
      satisfiedGuards
    })
  }

  async resolveEffectiveFolderPermissionDecision(user: AppUser, folderId: string): Promise<ResourcePermissionDecision> {
    return (await this.resolveEffectiveFolderPermissionDetail(user, folderId)).decision
  }

  async resolveEffectiveFolderPermissions(user: AppUser, folderIds: string[]): Promise<Record<string, EffectiveFolderPermission>> {
    const entries = await Promise.all(folderIds.map(async (folderId) => [folderId, await this.resolveEffectiveFolderPermission(user, folderId)] as const))
    return Object.fromEntries(entries)
  }

  async resolveEffectiveFolderPermissionDetail(user: AppUser, folderId: string): Promise<EffectiveFolderPermissionDetail> {
    if (!isCanonicalIdentifier(user.userId)) return noneDetail(folderId, user, "identity_unverified")
    if (!isActiveAccount(user)) return noneDetail(folderId, user, "account_not_active")
    const actorTenantId = user.tenantId
    if (!isCanonicalIdentifier(actorTenantId)) return noneDetail(folderId, user, "actor_tenant_unresolved")
    let groups: DocumentGroup[]
    try {
      groups = normalizeDocumentGroups(await this.deps.documentGroupStore.list(actorTenantId))
    } catch {
      return noneDetail(folderId, user, "ordinary_policy_unavailable", [unavailableContribution("folderPolicy", folderId, "folder-resource-store")])
    }
    const folder = groups.find((group) => group.groupId === folderId)
    if (!folder || !isCanonicalIdentifier(folder.tenantId)) return noneDetail(folderId, user, "resource_tenant_unresolved")
    if (folder.tenantId !== user.tenantId) return noneDetail(folderId, user, "tenant_mismatch")
    if (folder.status !== "active") return noneDetail(folderId, user, "resource_not_active")
    if (hasFolderCycle(groups, folder.groupId)) return noneDetail(folderId, user, "resource_integrity_unverified")

    const administrativePrincipal = await this.resolveAdminPrincipalGrant(user, folder)
    if (administrativePrincipal.integrity === "invalid") return noneDetail(folderId, user, "resource_integrity_unverified")
    if (administrativePrincipal.permission === "full") {
      const contribution: ResourcePermissionContribution = {
        sourceType: "administrativePrincipal",
        sourceId: `${folder.adminPrincipalType}:${folder.adminPrincipalId}`,
        policyVersion: "folder-administrative-principal-v1",
        effect: "allow",
        permission: "full",
        reasonCode: "administrative_principal"
      }
      return {
        folderId,
        permission: "full",
        policySource: folder.hasExplicitPolicy !== undefined || folder.policyId ? "explicit" : "ownerDefault",
        policyId: folder.policyId,
        decision: permissionDecision("folder", folderId, user, "full", "administrative_principal", [contribution])
      }
    }

    const parent = folder.parentGroupId ? groups.find((group) => group.groupId === folder.parentGroupId) : undefined
    if (folder.parentGroupId && (!parent || parent.tenantId !== user.tenantId || parent.status !== "active")) {
      return noneDetail(folderId, user, "resource_integrity_unverified")
    }

    let policyContext: Awaited<ReturnType<FolderPermissionService["resolvePolicyContext"]>>
    try {
      policyContext = await this.resolvePolicyContext(folder, groups)
    } catch {
      return noneDetail(folderId, user, "ordinary_policy_unavailable", [unavailableContribution("folderPolicy", folderId, folder.policyId ?? "missing-policy")])
    }
    const grants: EffectiveFolderPermission[] = []
    const contributions: ResourcePermissionContribution[] = []
    if (policyContext.policy) {
      if (policyContext.policy.tenantId !== user.tenantId || policyContext.policy.folderId !== (policyContext.inheritedFromFolderId ?? folder.groupId)) {
        return noneDetail(folderId, user, "resource_integrity_unverified")
      }
      const policyResolution = await this.evaluatePolicy(user, policyContext.policy)
      const policyVersion = `${FOLDER_SHARE_POLICY_VERSION}:${folderPolicyStateVersion(policyContext.policy)}`
      const sourceType = policyContext.source === "inherited" ? "inheritedFolderPolicy" : "folderPolicy"
      if (policyResolution.integrity === "invalid") {
        return noneDetail(folderId, user, "ordinary_policy_unavailable", [unavailableContribution(sourceType, policyContext.policy.policyId, policyVersion)])
      }
      if (policyResolution.explicitDeny) {
        const contribution: ResourcePermissionContribution = {
          sourceType,
          sourceId: policyContext.policy.policyId,
          policyVersion,
          effect: "deny",
          permission: "none",
          reasonCode: "ordinary_policy_denied"
        }
        return noneDetail(folderId, user, "ordinary_policy_denied", [contribution], {
          policySource: policyContext.source,
          policyId: policyContext.policy.policyId,
          inheritedFromFolderId: policyContext.inheritedFromFolderId
        })
      }
      grants.push(policyResolution.permission)
      contributions.push({
        sourceType,
        sourceId: policyContext.policy.policyId,
        policyVersion,
        effect: policyResolution.permission === "none" ? "notApplicable" : "allow",
        permission: policyResolution.permission,
        reasonCode: policyResolution.permission === "none" ? "no_matching_allow" : "allowed"
      })
    } else {
      if (policyContext.source === "none") {
        return noneDetail(folderId, user, "ordinary_policy_unavailable", [unavailableContribution("folderPolicy", folderId, folder.policyId ?? "missing-policy")])
      }
      const legacyFolder = policyContext.legacyFolder ?? folder
      const policyResolution = await this.evaluatePolicy(user, legacyDefaultPolicy(legacyFolder))
      if (policyResolution.integrity === "invalid") {
        return noneDetail(folderId, user, "ordinary_policy_unavailable", [unavailableContribution("legacyPolicy", folderId, "legacy-folder-policy-v1")])
      }
      grants.push(policyResolution.permission)
      if (legacyFolder.visibility === "org") grants.push("readOnly")
      const legacyPermission = maxPermission(grants)
      contributions.push({
        sourceType: "legacyPolicy",
        sourceId: legacyFolder.groupId,
        policyVersion: "legacy-folder-policy-v1",
        effect: legacyPermission === "none" ? "notApplicable" : "allow",
        permission: legacyPermission,
        reasonCode: legacyPermission === "none" ? "no_matching_allow" : "allowed"
      })
    }

    const permission = maxPermission(grants)

    return {
      folderId,
      permission,
      policySource: policyContext.source,
      policyId: policyContext.policy?.policyId,
      inheritedFromFolderId: policyContext.inheritedFromFolderId,
      decision: permissionDecision("folder", folderId, user, permission, permission === "none" ? "no_matching_allow" : "allowed", contributions)
    }
  }

  async assertFolderPermission(user: AppUser, folderId: string, required: Exclude<EffectiveFolderPermission, "none">): Promise<void> {
    const actual = await this.resolveEffectiveFolderPermission(user, folderId)
    if (!folderPermissionSatisfies(actual, required)) throw new HTTPException(403, { message: "Forbidden" })
  }

  async listReadableFolderIds(user: AppUser): Promise<string[]> {
    const actorTenantId = user.tenantId
    if (!isCanonicalIdentifier(actorTenantId)) return []
    const groups = await this.deps.documentGroupStore.list(actorTenantId)
    const entries = await Promise.all(groups.map(async (group) => [group.groupId, await this.resolveEffectiveFolderPermission(user, group.groupId)] as const))
    return entries.filter(([, permission]) => folderPermissionSatisfies(permission, "readOnly")).map(([folderId]) => folderId)
  }

  async listManageableFolderIds(user: AppUser): Promise<string[]> {
    const actorTenantId = user.tenantId
    if (!isCanonicalIdentifier(actorTenantId)) return []
    const groups = await this.deps.documentGroupStore.list(actorTenantId)
    const entries = await Promise.all(groups.map(async (group) => [group.groupId, await this.resolveEffectiveFolderPermission(user, group.groupId)] as const))
    return entries.filter(([, permission]) => folderPermissionSatisfies(permission, "full")).map(([folderId]) => folderId)
  }

  async saveFolderPolicy(policy: FolderPolicy): Promise<FolderPolicy> {
    await this.validatePolicyHasFullPrincipal(policy)
    const folder = await this.deps.documentGroupStore.get(policy.tenantId, policy.folderId)
    if (folder) {
      if (folder.tenantId !== policy.tenantId || folder.status !== "active") throw new Error("Folder policy tenant or lifecycle is invalid")
      const administrativePrincipalDowngrade = policy.entries.some((entry) => (
        entry.principalType === folder.adminPrincipalType && entry.principalId === folder.adminPrincipalId
          && entry.permissionLevel !== "full"
      ))
      if (administrativePrincipalDowngrade) {
        throw new Error("Folder policy cannot downgrade the administrative principal")
      }
    }
    return this.deps.folderPolicyStore.save({ ...policy, itemType: "folderPolicy" })
  }

  async getVersionedFolderPolicy(tenantId: string, folderId: string) {
    return this.deps.folderPolicyStore.getVersionedByFolderId(tenantId, folderId)
  }

  /**
   * Complete-state policy replacement. This is the production mutation path;
   * legacy saveFolderPolicy remains read-model migration compatibility only.
   */
  async replaceVersionedFolderPolicy(
    actor: AppUser,
    folderId: string,
    input: ReplaceVersionedFolderPolicyInput
  ): Promise<ReplaceVersionedFolderPolicyResult> {
    const auditOutbox = this.deps.securityAuditOutbox
    const principalDirectory = this.deps.resourceUserPrincipalDirectory
    if (!auditOutbox || !principalDirectory) {
      throw new Error("Versioned folder policy security dependencies are not configured")
    }
    const actorTenantId = actor.tenantId
    if (!isCanonicalIdentifier(actorTenantId)) {
      await this.recordEarlyPolicyFailure(actor, folderId, input, "denied", auditOutbox)
      throw new FolderPolicyMutationError("Actor tenant is not authoritative", "denied")
    }
    let folder: DocumentGroup | undefined
    try {
      folder = await this.deps.documentGroupStore.get(actorTenantId, folderId)
    } catch {
      await this.recordEarlyPolicyFailure(actor, folderId, input, "failed", auditOutbox)
      throw new FolderPolicyMutationError("Folder lookup failed", "failed")
    }
    if (!folder || !isCanonicalIdentifier(folder.tenantId)) {
      await this.recordEarlyPolicyFailure(actor, folderId, input, "denied", auditOutbox)
      throw new FolderPolicyMutationError("Folder is missing or has no authoritative tenant", "denied")
    }
    let current
    try {
      current = await this.deps.folderPolicyStore.getVersionedByFolderId(folder.tenantId, folderId)
    } catch {
      await this.recordEarlyPolicyFailure(actor, folderId, input, "failed", auditOutbox)
      throw new FolderPolicyMutationError("Folder policy lookup failed", "failed")
    }
    const now = (this.deps.now ?? (() => new Date()))().toISOString()
    const policyId = current.policy?.policyId ?? folder.policyId ?? `folder-policy-${folderId}`
    const nextPolicy: FolderPolicy = {
      policyId,
      itemType: "folderPolicy",
      tenantId: folder.tenantId,
      folderId,
      entries: input.entries.map((entry) => ({ ...entry })),
      createdBy: current.policy?.createdBy ?? actor.userId,
      createdAt: current.policy?.createdAt ?? now,
      updatedAt: now
    }
    const auditIntent = await auditOutbox.prepare({
      actorId: actor.userId,
      tenantId: folder.tenantId,
      targetType: "folder",
      targetId: folderId,
      operation: "share.replace",
      before: auditFolderPolicy(current.policy),
      proposedAfter: auditFolderPolicy(nextPolicy),
      reason: input.reason.trim() || "missing_reason",
      policyVersion: FOLDER_SHARE_POLICY_VERSION
    })

    try {
      await this.validateVersionedPolicyMutation(actor, folder, current.policy, nextPolicy, current.version, input, principalDirectory)
    } catch (error) {
      const mutationError = normalizeFolderPolicyMutationError(error)
      await this.completePolicyMutation(auditIntent, mutationError.result, current.policy)
      throw mutationError
    }

    const revokedEntries = revokedFolderPolicyEntries(current.policy?.entries ?? [], nextPolicy.entries)
    const cleanupRepairOutbox = this.deps.objectStore
      ? new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
      : undefined
    if ((revokedEntries.length > 0 || folderPolicyIncreases(current.policy?.entries ?? [], nextPolicy.entries)) && !cleanupRepairOutbox) {
      const mutationError = new FolderPolicyMutationError("Folder revocation cleanup repair outbox is not configured", "failed")
      await this.completePolicyMutation(auditIntent, mutationError.result, current.policy)
      throw mutationError
    }
    if (folderPolicyIncreases(current.policy?.entries ?? [], nextPolicy.entries)) {
      try {
        await cleanupRepairOutbox!.assertResourceFenceReleased(folder.tenantId, "folder", folderId)
      } catch {
        const mutationError = new FolderPolicyMutationError("Folder revocation cleanup is still fenced", "conflict")
        await this.completePolicyMutation(auditIntent, mutationError.result, current.policy)
        throw mutationError
      }
    }
    const cleanupRegistration = revokedEntries.length > 0 ? {
      operationId: `folder-share:${auditIntent.intentId}`,
      tenantId: folder.tenantId,
      resourceType: "folder" as const,
      resourceId: folderId,
      trigger: "share_revoked" as const,
      deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
      authoritativeDenyVersion: folderPolicyStateVersion(nextPolicy),
      authoritativeDenyConfirmedAt: now,
          knownTargets: revokedEntries.flatMap(({ entry, ceiling }) => {
            const principal = `${entry.principalType}:${entry.principalId}`
            const reference = `folder:${folderId}:principal:${principal}`
            return [
              { scope: "grant" as const, reference: `${reference}:ceiling:${ceiling}` },
          { scope: "cache" as const, reference },
          { scope: "session" as const, reference: `${reference}/session` },
          { scope: "queued_run" as const, reference }
        ]
      })
    } : undefined
    if (cleanupRegistration) {
      try {
        await cleanupRepairOutbox!.prepare({
          expectedBeforeDenyVersion: current.version,
          cleanupRegistration,
          preparedAt: now
        })
      } catch {
        const mutationError = new FolderPolicyMutationError("Folder revocation cleanup repair intent could not be persisted", "failed")
        await this.completePolicyMutation(auditIntent, mutationError.result, current.policy)
        throw mutationError
      }
    }

    let replaced
    try {
      replaced = await this.deps.folderPolicyStore.replaceForFolder(nextPolicy, input.expectedVersion)
    } catch (error) {
      if (cleanupRegistration) await cleanupRepairOutbox!.markAbandoned({
        tenantId: folder.tenantId,
        resourceType: "folder",
        resourceId: folderId,
        operationId: cleanupRegistration.operationId
      }, now).catch(() => undefined)
      const mutationError = isConflictError(error)
        ? new FolderPolicyMutationError("Folder policy version conflict", "conflict")
        : new FolderPolicyMutationError("Folder policy persistence failed", "failed")
      await this.completePolicyMutation(auditIntent, mutationError.result, current.policy)
      throw mutationError
    }
    if (!replaced.policy) {
      const mutationError = new FolderPolicyMutationError("Folder policy persistence returned no policy", "failed")
      await this.completePolicyMutation(auditIntent, mutationError.result, current.policy)
      throw mutationError
    }

    if (cleanupRegistration) {
      const cleanupCoordinator = this.deps.cleanupCoordinator
        ?? (this.deps.objectStore ? new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore) : undefined)
      if (!cleanupCoordinator) {
        await this.completePolicyMutation(auditIntent, "failed", replaced.policy)
        throw new FolderPolicyMutationError("Folder revocation cleanup is not configured", "failed")
      }
      try {
        if (replaced.version !== cleanupRegistration.authoritativeDenyVersion) {
          throw new Error("Folder deny version does not match its cleanup repair intent")
        }
        const committed = await cleanupRepairOutbox!.markDenyCommitted({
          tenantId: folder.tenantId,
          resourceType: "folder",
          resourceId: folderId,
          operationId: cleanupRegistration.operationId
        }, now)
        await cleanupCoordinator.register(committed.cleanupRegistration)
        await cleanupRepairOutbox!.markCleanupRegistered(committed, now)
      } catch {
        await this.completePolicyMutation(auditIntent, "failed", replaced.policy)
        throw new FolderPolicyMutationError("Folder revocation cleanup registration failed", "failed")
      }
    }

    await auditOutbox.complete(
      auditIntent.intentId,
      folder.tenantId,
      "success",
      auditFolderPolicy(replaced.policy)
    )
    return {
      policy: replaced.policy,
      version: replaced.version,
      auditIntentId: auditIntent.intentId
    }
  }

  async validatePolicyHasFullPrincipal(policy: Pick<FolderPolicy, "entries" | "tenantId">): Promise<void> {
    for (const entry of policy.entries) {
      if (entry.permissionLevel !== "full") continue
      if (entry.principalType === "user" && isCanonicalIdentifier(entry.principalId)) return
      if (entry.principalType === "group") {
        const group = await this.deps.userGroupStore.get(policy.tenantId, entry.principalId)
        if (group?.status === "active" && group.tenantId === policy.tenantId) return
      }
    }
    throw new Error("Folder policy must include at least one active full principal")
  }

  private async validateVersionedPolicyMutation(
    actor: AppUser,
    folder: DocumentGroup,
    currentPolicy: FolderPolicy | undefined,
    nextPolicy: FolderPolicy,
    currentVersion: string,
    input: ReplaceVersionedFolderPolicyInput,
    principalDirectory: ResourceUserPrincipalDirectory
  ): Promise<void> {
    if (!isCanonicalIdentifier(folder.tenantId)) {
      throw new FolderPolicyMutationError("Folder has no authoritative tenant", "denied")
    }
    const tenantId = folder.tenantId
    if (
      !isActiveAccount(actor) ||
      !isCanonicalIdentifier(actor.userId) ||
      !isCanonicalIdentifier(actor.tenantId) ||
      actor.tenantId !== tenantId
    ) throw new FolderPolicyMutationError("Actor identity, account, or tenant is not authoritative", "denied")
    if (!input.reason || input.reason.trim() !== input.reason) {
      throw new FolderPolicyMutationError("Mutation reason is required and must be canonical", "denied")
    }
    if (
      folder.status !== "active" ||
      !isCanonicalIdentifier(nextPolicy.policyId) ||
      (isCanonicalIdentifier(folder.policyId) && currentPolicy !== undefined && nextPolicy.policyId !== folder.policyId) ||
      (currentPolicy !== undefined && nextPolicy.policyId !== currentPolicy.policyId) ||
      (currentPolicy?.folderId !== undefined && currentPolicy.folderId !== folder.groupId) ||
      (currentPolicy?.tenantId !== undefined && currentPolicy.tenantId !== tenantId)
    ) throw new FolderPolicyMutationError("Folder lifecycle or explicit policy identity is invalid", "denied")
    if (input.expectedVersion !== currentVersion) {
      throw new FolderPolicyMutationError("Folder policy version conflict", "conflict")
    }
    if (!hasPermission(actor, "folder.share")) {
      throw new FolderPolicyMutationError("Actor lacks folder sharing feature permission", "denied")
    }
    if ((await this.resolveEffectiveFolderPermission(actor, folder.groupId)) !== "full") {
      throw new FolderPolicyMutationError("Actor lacks full permission on the target folder", "denied")
    }

    await this.validateAdministrativePrincipal(folder, principalDirectory)
    const seen = new Set<string>()
    let activeFullPrincipals = 0
    const groupIds = new Set<string>()
    for (const entry of nextPolicy.entries) {
      if (!isCanonicalIdentifier(entry.principalId)) {
        throw new FolderPolicyMutationError("Folder policy principal identity is invalid", "denied")
      }
      const key = `${entry.principalType}:${entry.principalId}`
      if (seen.has(key)) throw new FolderPolicyMutationError("Folder policy contains a duplicate principal", "denied")
      seen.add(key)
      if (
        entry.principalType === folder.adminPrincipalType &&
        entry.principalId === folder.adminPrincipalId &&
        entry.permissionLevel !== "full"
      ) throw new FolderPolicyMutationError("Folder policy cannot downgrade the administrative principal", "denied")

      if (entry.principalType === "user") {
        const principal = await principalDirectory.getUser(entry.principalId)
        assertActiveTenantUser(principal, entry.principalId, tenantId)
      } else {
        if (isApplicationRole(entry.principalId)) {
          throw new FolderPolicyMutationError("Application roles cannot be folder policy principals", "denied")
        }
        groupIds.add(entry.principalId)
      }
      if (entry.permissionLevel === "full") activeFullPrincipals += 1
    }
    if (activeFullPrincipals === 0) {
      throw new FolderPolicyMutationError("Folder policy must retain at least one active full principal", "denied")
    }

    const userCache = new Map<string, ResourceUserPrincipal | undefined>()
    for (const groupId of groupIds) {
      await this.validateResourceGroupPrincipalGraph(groupId, tenantId, principalDirectory, new Set(), userCache)
    }
    try {
      await this.assertFolderOperation(actor, folder.groupId, "share", [
        "principalsActiveSameTenant",
        "administrativePrincipalPreserved",
        "expectedVersionMatched"
      ])
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) {
        throw new FolderPolicyMutationError("Canonical resource operation authorization denied", "denied")
      }
      throw error
    }
  }

  private async validateAdministrativePrincipal(
    folder: DocumentGroup,
    principalDirectory: ResourceUserPrincipalDirectory
  ): Promise<void> {
    if (!folder.adminPrincipalType || !isCanonicalIdentifier(folder.adminPrincipalId)) {
      throw new FolderPolicyMutationError("Folder administrative principal is missing", "denied")
    }
    if (folder.adminPrincipalType === "user") {
      const principal = await principalDirectory.getUser(folder.adminPrincipalId)
      assertActiveTenantUser(principal, folder.adminPrincipalId, folder.tenantId as string)
      return
    }
    if (isApplicationRole(folder.adminPrincipalId)) {
      throw new FolderPolicyMutationError("Application roles cannot be folder administrative principals", "denied")
    }
    await this.validateResourceGroupPrincipalGraph(
      folder.adminPrincipalId,
      folder.tenantId as string,
      principalDirectory,
      new Set(),
      new Map()
    )
  }

  private async validateResourceGroupPrincipalGraph(
    groupId: string,
    tenantId: string,
    principalDirectory: ResourceUserPrincipalDirectory,
    path: Set<string>,
    userCache: Map<string, ResourceUserPrincipal | undefined>
  ): Promise<void> {
    if (path.has(groupId)) throw new FolderPolicyMutationError("Nested resource-group membership cycle", "denied")
    const group = await this.deps.userGroupStore.get(tenantId, groupId)
    if (!group || group.status !== "active" || group.tenantId !== tenantId || isApplicationRole(group.groupId)) {
      throw new FolderPolicyMutationError("Folder policy resource-group principal is missing, inactive, cross-tenant, or in the role namespace", "denied")
    }
    const memberships = await this.deps.groupMembershipStore.listByGroupId(tenantId, groupId)
    const nextPath = new Set(path)
    nextPath.add(groupId)
    for (const membership of memberships) {
      if (membership.groupId !== groupId || membership.tenantId !== tenantId || !isCanonicalIdentifier(membership.memberId)) {
        throw new FolderPolicyMutationError("Folder policy resource-group membership is invalid", "denied")
      }
      if (membership.memberType === "group") {
        if (isApplicationRole(membership.memberId)) {
          throw new FolderPolicyMutationError("Application roles cannot be nested resource groups", "denied")
        }
        await this.validateResourceGroupPrincipalGraph(membership.memberId, tenantId, principalDirectory, nextPath, userCache)
        continue
      }
      let principal = userCache.get(membership.memberId)
      if (!userCache.has(membership.memberId)) {
        principal = await principalDirectory.getUser(membership.memberId)
        userCache.set(membership.memberId, principal)
      }
      assertActiveTenantUser(principal, membership.memberId, tenantId)
    }
  }

  private async completePolicyMutation(
    auditIntent: SecurityMutationAuditIntent,
    result: Exclude<SecurityMutationResult, "success">,
    currentPolicy: FolderPolicy | undefined
  ): Promise<void> {
    const auditOutbox = this.deps.securityAuditOutbox
    if (!auditOutbox) throw new Error("Versioned folder policy audit outbox is not configured")
    await auditOutbox.complete(
      auditIntent.intentId,
      auditIntent.draft.tenantId,
      result,
      auditFolderPolicy(currentPolicy)
    )
  }

  private async recordEarlyPolicyFailure(
    actor: AppUser,
    folderId: string,
    input: ReplaceVersionedFolderPolicyInput,
    result: Extract<SecurityMutationResult, "denied" | "failed">,
    auditOutbox: SecurityMutationAuditOutboxPort
  ): Promise<void> {
    if (!isCanonicalIdentifier(actor.userId) || !isCanonicalIdentifier(actor.tenantId)) {
      throw new FolderPolicyMutationError("Actor identity or tenant is not authoritative", "denied")
    }
    const audit = await auditOutbox.prepare({
      actorId: actor.userId,
      tenantId: actor.tenantId,
      targetType: "folder",
      targetId: folderId,
      operation: "share.replace",
      before: null,
      proposedAfter: input.entries.map((entry) => ({
        principalType: entry.principalType,
        principalId: entry.principalId,
        permissionLevel: entry.permissionLevel
      })),
      reason: input.reason,
      policyVersion: FOLDER_SHARE_POLICY_VERSION
    })
    await auditOutbox.complete(audit.intentId, actor.tenantId, result, null)
  }

  private async resolvePolicyContext(folder: DocumentGroup, groups: DocumentGroup[]): Promise<{
    source: FolderPolicySource
    policy?: FolderPolicy
    inheritedFromFolderId?: string
    legacyFolder?: DocumentGroup
  }> {
    const byId = new Map(groups.map((group) => [group.groupId, group]))
    let current: DocumentGroup | undefined = folder
    let inherited = false
    const visited = new Set<string>()
    while (current) {
      if (visited.has(current.groupId)) return { source: "none" }
      visited.add(current.groupId)
      const versionedPolicy = await this.deps.folderPolicyStore.findByFolderId(folder.tenantId, current.groupId)
      if (versionedPolicy) {
        return {
          source: inherited ? "inherited" : "explicit",
          policy: versionedPolicy,
          inheritedFromFolderId: inherited ? current.groupId : undefined
        }
      }
      if (current.hasExplicitPolicy !== undefined || current.policyId) {
        if (!current.policyId) {
          return {
            source: inherited ? "inherited" : "explicit",
            inheritedFromFolderId: inherited ? current.groupId : undefined,
            legacyFolder: current
          }
        }
        const policy = await this.deps.folderPolicyStore.get(folder.tenantId, current.policyId)
        if (!policy) return { source: "none" }
        return {
          source: inherited ? "inherited" : "explicit",
          policy,
          inheritedFromFolderId: inherited ? current.groupId : undefined
        }
      }
      current = current.parentGroupId ? byId.get(current.parentGroupId) : undefined
      inherited = true
    }
    return { source: "ownerDefault" }
  }

  private async evaluatePolicy(user: AppUser, policy: Pick<FolderPolicy, "entries">): Promise<PermissionResolution> {
    const grants = await Promise.all(policy.entries.map((entry) => this.evaluatePolicyEntry(user, entry)))
    if (grants.some((grant) => grant.integrity === "invalid")) return invalidResolution()
    if (grants.some((grant) => grant.explicitDeny)) return deniedResolution()
    return { permission: maxPermission(grants.map((grant) => grant.permission)), integrity: "valid", explicitDeny: false }
  }

  private async evaluatePolicyEntry(user: AppUser, entry: FolderPolicyEntry): Promise<PermissionResolution> {
    if (!isCanonicalIdentifier(entry.principalId)) return invalidResolution()
    if (entry.principalType === "user") {
      if (!userMatchesPrincipal(user, entry.principalId)) return validResolution("none")
      return entry.permissionLevel === "deny" ? deniedResolution() : validResolution(entry.permissionLevel)
    }
    const membership = await this.resolveUserMembershipPermission(user, entry.principalId, new Set())
    if (membership.integrity === "invalid") return membership
    if (entry.permissionLevel === "deny") return membership.permission === "none" ? validResolution("none") : deniedResolution()
    const permission = minPermission(entry.permissionLevel, membership.permission)
    return this.authorizeResourceGroupUse(user, permission)
  }

  private async resolveAdminPrincipalGrant(user: AppUser, folder: DocumentGroup): Promise<PermissionResolution> {
    if (!folder.adminPrincipalType || !isCanonicalIdentifier(folder.adminPrincipalId)) return invalidResolution()
    if (folder.adminPrincipalType === "user") {
      return validResolution(folder.adminPrincipalId === user.userId ? "full" : "none")
    }
    const membership = await this.resolveUserMembershipPermission(user, folder.adminPrincipalId, new Set())
    if (membership.integrity === "invalid") return membership
    return this.authorizeResourceGroupUse(user, membership.permission)
  }

  private authorizeResourceGroupUse(user: AppUser, permission: EffectiveFolderPermission): PermissionResolution {
    if (permission === "none") return validResolution("none")
    try {
      enforceResourceGroupSearchUse({
        actor: user,
        tenantId: user.tenantId,
        targetPermission: permission,
        activeSameTenantMembership: true
      })
      return validResolution(permission)
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) return invalidResolution()
      throw error
    }
  }

  private async resolveUserMembershipPermission(user: AppUser, groupId: string, path: Set<string>): Promise<PermissionResolution> {
    if (path.has(groupId)) return invalidResolution()
    const tenantId = user.tenantId
    if (!isCanonicalIdentifier(tenantId)) return invalidResolution()
    const nextPath = new Set(path)
    nextPath.add(groupId)
    let group
    let memberships
    try {
      group = await this.deps.userGroupStore.get(tenantId, groupId)
      memberships = await this.deps.groupMembershipStore.listByGroupId(tenantId, groupId)
    } catch {
      return invalidResolution()
    }
    if (!group || group.status !== "active" || group.tenantId !== tenantId) return invalidResolution()

    const grants: EffectiveFolderPermission[] = []
    for (const membership of memberships) {
      if (
        membership.groupId !== groupId ||
        membership.tenantId !== tenantId ||
        !isCanonicalIdentifier(membership.memberId)
      ) return invalidResolution()
      if (membership.memberType === "user") {
        if (userMatchesPrincipal(user, membership.memberId)) grants.push(membership.permissionLevel)
        continue
      }
      const child = await this.resolveUserMembershipPermission(user, membership.memberId, nextPath)
      if (child.integrity === "invalid") return child
      grants.push(minPermission(membership.permissionLevel, child.permission))
    }
    return validResolution(maxPermission(grants))
  }
}

function revokedFolderPolicyEntries(
  before: readonly FolderPolicyEntry[],
  after: readonly FolderPolicyEntry[]
): Array<{ entry: FolderPolicyEntry; ceiling: "none" | "readOnly" }> {
  const afterByPrincipal = new Map(after.map((entry) => [`${entry.principalType}:${entry.principalId}`, entry]))
  return before.flatMap<{ entry: FolderPolicyEntry; ceiling: "none" | "readOnly" }>((entry) => {
    if (entry.permissionLevel === "deny") return []
    const replacement = afterByPrincipal.get(`${entry.principalType}:${entry.principalId}`)
    if (!replacement || replacement.permissionLevel === "deny") return [{ entry, ceiling: "none" }]
    if (entry.permissionLevel === "full" && replacement.permissionLevel === "readOnly") {
      return [{ entry, ceiling: "readOnly" }]
    }
    return []
  })
}

function folderPolicyIncreases(
  before: readonly FolderPolicyEntry[],
  after: readonly FolderPolicyEntry[]
): boolean {
  const rank: Record<FolderPolicyPermissionLevel, number> = { deny: 0, readOnly: 1, full: 2 }
  const beforeByPrincipal = new Map(before.map((entry) => [`${entry.principalType}:${entry.principalId}`, entry.permissionLevel]))
  return after.some((entry) => rank[entry.permissionLevel] > rank[beforeByPrincipal.get(`${entry.principalType}:${entry.principalId}`) ?? "deny"])
}

function noneDetail(
  folderId: string,
  user: AppUser,
  reasonCode: ResourcePermissionDecisionReasonCode,
  contributions: readonly ResourcePermissionContribution[] = [],
  context: Pick<EffectiveFolderPermissionDetail, "policySource" | "policyId" | "inheritedFromFolderId"> = { policySource: "none" }
): EffectiveFolderPermissionDetail {
  return {
    folderId,
    permission: "none",
    ...context,
    decision: permissionDecision("folder", folderId, user, "none", reasonCode, contributions)
  }
}

function userMatchesPrincipal(user: AppUser, principalId: string): boolean {
  return user.userId === principalId
}

function validResolution(permission: EffectiveFolderPermission): PermissionResolution {
  return { permission, integrity: "valid", explicitDeny: false }
}

function deniedResolution(): PermissionResolution {
  return { permission: "none", integrity: "valid", explicitDeny: true }
}

function invalidResolution(): PermissionResolution {
  return { permission: "none", integrity: "invalid", explicitDeny: false }
}

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function canonicalFolderIdentity(folder: DocumentGroup): boolean {
  return isCanonicalIdentifier(folder.groupId) && isCanonicalIdentifier(folder.tenantId) && folder.status !== "archived"
}

function hasFolderCycle(groups: DocumentGroup[], folderId: string): boolean {
  const byId = new Map(groups.map((group) => [group.groupId, group]))
  const visited = new Set<string>()
  let current = byId.get(folderId)
  while (current?.parentGroupId) {
    if (visited.has(current.groupId)) return true
    visited.add(current.groupId)
    current = byId.get(current.parentGroupId)
    if (!current) return true
  }
  return current ? visited.has(current.groupId) : false
}

function legacyDefaultPolicy(folder: DocumentGroup): Pick<FolderPolicy, "entries"> {
  const entries: FolderPolicyEntry[] = []
  if (folder.adminPrincipalType === "user" && folder.adminPrincipalId) entries.push({ principalType: "user", principalId: folder.adminPrincipalId, permissionLevel: "full" })
  if (folder.adminPrincipalType === "group" && folder.adminPrincipalId) entries.push({ principalType: "group", principalId: folder.adminPrincipalId, permissionLevel: "full" })
  for (const userId of folder.managerUserIds ?? []) entries.push({ principalType: "user", principalId: userId, permissionLevel: "full" })
  for (const userId of folder.sharedUserIds ?? []) entries.push({ principalType: "user", principalId: userId, permissionLevel: "readOnly" })
  for (const groupId of folder.sharedGroups ?? []) entries.push({ principalType: "group", principalId: groupId, permissionLevel: "readOnly" })
  return { entries }
}

function normalizeDocumentGroups(groups: DocumentGroup[]): DocumentGroup[] {
  const byId = new Map(groups.map((group) => [group.groupId, group]))
  const normalized = new Map<string, DocumentGroup>()
  const visiting = new Set<string>()
  const visit = (group: DocumentGroup): DocumentGroup => {
    const cached = normalized.get(group.groupId)
    if (cached) return cached
    if (visiting.has(group.groupId)) return normalizeDocumentGroup(group)
    visiting.add(group.groupId)
    const parent = group.parentGroupId ? byId.get(group.parentGroupId) : undefined
    const normalizedParent = parent ? visit(parent) : undefined
    const result = normalizeDocumentGroup(group, normalizedParent)
    normalized.set(group.groupId, result)
    visiting.delete(group.groupId)
    return result
  }
  return groups.map(visit)
}

function normalizeDocumentGroup(group: DocumentGroup, parent?: DocumentGroup): DocumentGroup {
  return {
    ...group,
    tenantId: group.tenantId,
    adminPrincipalType: group.adminPrincipalType ?? parent?.adminPrincipalType ?? "user",
    adminPrincipalId: group.adminPrincipalId ?? parent?.adminPrincipalId ?? group.ownerUserId,
    ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : [...(group.ancestorGroupIds ?? [])],
    visibility: group.visibility ?? "private",
    sharedUserIds: uniqueStrings(group.sharedUserIds ?? []),
    sharedGroups: uniqueStrings(group.sharedGroups ?? []),
    managerUserIds: uniqueStrings([group.ownerUserId, ...(group.managerUserIds ?? [])]),
    hasExplicitPolicy: group.hasExplicitPolicy ?? (group.policyId ? true : undefined),
    status: group.status ?? "active",
    createdBy: group.createdBy ?? group.ownerUserId
  }
}

function minPermission(
  left: EffectiveFolderPermission | Exclude<FolderPolicyPermissionLevel, "deny">,
  right: EffectiveFolderPermission | Exclude<FolderPolicyPermissionLevel, "deny">
): EffectiveFolderPermission {
  return permissionByRank[Math.min(permissionRank[left], permissionRank[right])] ?? "none"
}

function maxPermission(values: EffectiveFolderPermission[]): EffectiveFolderPermission {
  const rank = values.reduce((current, value) => Math.max(current, permissionRank[value]), 0)
  return permissionByRank[rank] ?? "none"
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function assertActiveTenantUser(
  principal: ResourceUserPrincipal | undefined,
  expectedUserId: string,
  tenantId: string
): asserts principal is ResourceUserPrincipal {
  if (
    !principal ||
    principal.userId !== expectedUserId ||
    principal.status !== "active" ||
    principal.tenantId !== tenantId
  ) throw new FolderPolicyMutationError("Folder policy user principal is missing, inactive, or cross-tenant", "denied")
}

function auditFolderPolicy(policy: FolderPolicy | undefined) {
  if (!policy) return null
  return {
    policyId: policy.policyId,
    tenantId: policy.tenantId,
    folderId: policy.folderId,
    entries: policy.entries.map((entry) => ({
      principalType: entry.principalType,
      principalId: entry.principalId,
      permissionLevel: entry.permissionLevel
    })),
    updatedAt: policy.updatedAt
  }
}

function permissionDecision(
  resourceType: "folder",
  folderId: string,
  user: AppUser,
  permission: EffectiveFolderPermission,
  reasonCode: ResourcePermissionDecisionReasonCode,
  contributions: readonly ResourcePermissionContribution[]
): ResourcePermissionDecision {
  return createResourcePermissionDecision({
    resourceType,
    resourceId: folderId,
    actorId: user.userId,
    permission,
    reasonCode,
    contributions
  })
}

function unavailableContribution(
  sourceType: ResourcePermissionContribution["sourceType"],
  sourceId: string,
  policyVersion: string
): ResourcePermissionContribution {
  return {
    sourceType,
    sourceId,
    policyVersion,
    effect: "unavailable",
    permission: "none",
    reasonCode: "ordinary_policy_unavailable"
  }
}

function isConflictError(error: unknown): boolean {
  return error instanceof Error && (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
}

function normalizeFolderPolicyMutationError(error: unknown): FolderPolicyMutationError {
  if (error instanceof FolderPolicyMutationError) return error
  return new FolderPolicyMutationError(
    error instanceof Error ? error.message : "Folder policy validation failed",
    "denied"
  )
}
