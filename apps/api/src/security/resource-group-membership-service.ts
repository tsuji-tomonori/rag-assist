import { isApplicationRole } from "@memorag-mvp/contract/access-control"
import type { AppUser } from "../auth.js"
import { hasPermission, isActiveAccount, type EffectiveFolderPermission } from "../authorization.js"
import type {
  ObjectStoreRevocationCleanupCoordinator,
  RegisterRevocationCleanupInput,
  RevocationCleanupTargetReference
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { groupMembershipStateVersion, type GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { UserDirectory } from "../adapters/user-directory.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { GroupMembership, ManagedUserStatus, UserGroup } from "../types.js"
import type {
  SecurityMutationAuditIntent,
  SecurityMutationAuditOutboxPort,
  SecurityMutationResult
} from "./security-mutation-audit-outbox.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "./production-resource-operation-authorizer.js"
import type { ResourceGroupMembershipCleanupRepairStore } from "./resource-group-membership-cleanup-repair-store.js"
import type {
  ObjectStoreRevocationCleanupRepairOutbox,
  RevocationCleanupRepairIntent
} from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"

export const RESOURCE_GROUP_MEMBERSHIP_POLICY_VERSION = "resource-group-membership-policy-v1" as const

export type ResourceGroupMembershipInput = Readonly<{
  memberType: GroupMembership["memberType"]
  memberId: string
  permissionLevel: GroupMembership["permissionLevel"]
}>

export type ReplaceResourceGroupMembershipsInput = Readonly<{
  expectedVersion: string
  memberships: readonly ResourceGroupMembershipInput[]
  reason: string
}>

export type ResourceGroupMembershipMutationResult = Readonly<{
  groupId: string
  version: string
  memberships: readonly GroupMembership[]
  auditIntentId: string
}>

export type ResourceUserPrincipal = Readonly<{
  userId: string
  tenantId: string
  status: ManagedUserStatus
}>

export interface ResourceUserPrincipalDirectory {
  getUser(userId: string): Promise<ResourceUserPrincipal | undefined>
}

/** Explicit adapter for deployments where one Cognito directory equals one tenant. */
export class SingleTenantResourceUserPrincipalDirectory implements ResourceUserPrincipalDirectory {
  constructor(
    private readonly userDirectory: Pick<UserDirectory, "listUsers">,
    private readonly tenantId: string
  ) {}

  async getUser(userId: string): Promise<ResourceUserPrincipal | undefined> {
    const user = (await this.userDirectory.listUsers()).find((candidate) => candidate.userId === userId)
    return user ? { userId: user.userId, tenantId: this.tenantId, status: user.status } : undefined
  }
}

export class ResourceGroupMembershipMutationError extends Error {
  constructor(
    message: string,
    readonly result: Exclude<SecurityMutationResult, "success">
  ) {
    super(message)
    this.name = "ResourceGroupMembershipMutationError"
  }
}

export class ResourceGroupMembershipUnavailableError extends Error {
  constructor() {
    super("Resource group membership service is unavailable")
    this.name = "ResourceGroupMembershipUnavailableError"
  }
}

export class ResourceGroupMembershipService {
  constructor(private readonly deps: {
    userGroupStore: UserGroupStore
    groupMembershipStore: GroupMembershipStore
    userPrincipalDirectory: ResourceUserPrincipalDirectory
    auditOutbox: SecurityMutationAuditOutboxPort
    cleanupCoordinator: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
    cleanupRepairStore: ResourceGroupMembershipCleanupRepairStore
    cleanupRepairOutbox: ObjectStoreRevocationCleanupRepairOutbox
    now?: () => Date
  }) {}

  async getState(actor: AppUser, groupId: string) {
    const actorTenantId = authoritativeActorTenant(actor)
    const targetGroup = await this.deps.userGroupStore.get(actorTenantId, groupId)
    if (!targetGroup || !isCanonicalIdentifier(targetGroup.tenantId)) {
      throw new ResourceGroupMembershipMutationError("Resource group is missing or has no authoritative tenant", "denied")
    }
    const current = await this.deps.groupMembershipStore.getVersionedGroupState(targetGroup.tenantId, groupId)
    await this.authorizeTargetManagement(actor, targetGroup, current.memberships, "read")
    return current
  }

  async replaceMemberships(
    actor: AppUser,
    groupId: string,
    input: ReplaceResourceGroupMembershipsInput
  ): Promise<ResourceGroupMembershipMutationResult> {
    const actorTenantId = authoritativeActorTenant(actor)
    let targetGroup: UserGroup | undefined
    try {
      targetGroup = await this.deps.userGroupStore.get(actorTenantId, groupId)
    } catch {
      await this.recordEarlyFailure(actor, groupId, input, "failed")
      throw new ResourceGroupMembershipMutationError("Resource group lookup failed", "failed")
    }
    if (!targetGroup || !isCanonicalIdentifier(targetGroup.tenantId)) {
      await this.recordEarlyFailure(actor, groupId, input, "denied")
      throw new ResourceGroupMembershipMutationError("Resource group is missing or has no authoritative tenant", "denied")
    }
    let current: Awaited<ReturnType<GroupMembershipStore["getVersionedGroupState"]>>
    try {
      current = await this.deps.groupMembershipStore.getVersionedGroupState(targetGroup.tenantId, groupId)
    } catch {
      await this.recordEarlyFailure(actor, groupId, input, "failed")
      throw new ResourceGroupMembershipMutationError("Resource group membership state failed", "failed")
    }
    const now = (this.deps.now ?? (() => new Date()))().toISOString()
    const nextMemberships = input.memberships.map((membership) => {
      const previous = current.memberships.find((candidate) => (
        candidate.memberType === membership.memberType && candidate.memberId === membership.memberId
      ))
      return {
        tenantId: targetGroup.tenantId,
        groupId,
        memberType: membership.memberType,
        memberId: membership.memberId,
        permissionLevel: membership.permissionLevel,
        source: previous?.source ?? "manual",
        createdAt: previous?.createdAt ?? now,
        updatedAt: now
      } satisfies GroupMembership
    })
    const auditIntent = await this.deps.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId: targetGroup.tenantId,
      targetType: "resourceGroup",
      targetId: groupId,
      operation: "membership.replace",
      before: auditMemberships(current.memberships),
      proposedAfter: auditMemberships(nextMemberships),
      reason: input.reason,
      policyVersion: RESOURCE_GROUP_MEMBERSHIP_POLICY_VERSION
    })

    try {
      await this.validateMutation(actor, targetGroup, current.memberships, nextMemberships, input)
    } catch (error) {
      const mutationError = normalizeMutationError(error)
      await this.completeNonSuccess(auditIntent, mutationError.result, current.memberships)
      throw mutationError
    }

    const revokedMemberships = membershipsRequiringCleanup(current.memberships, nextMemberships)
    const increasedMemberships = membershipsIncreasingPermission(current.memberships, nextMemberships)
    const cleanupRegistration = revokedMemberships.length > 0
      ? membershipRevocationCleanupInput({
          tenantId: targetGroup.tenantId,
          groupId,
          version: groupMembershipStateVersion(nextMemberships),
          confirmedAt: now,
          memberships: revokedMemberships,
          nextMemberships
        })
      : undefined
    let commonCleanupRepair: RevocationCleanupRepairIntent | undefined
    if (increasedMemberships.length > 0) {
      try {
        await this.deps.cleanupRepairOutbox.assertResourceFenceReleased(
          targetGroup.tenantId,
          "resource_group",
          groupId
        )
      } catch {
        const mutationError = new ResourceGroupMembershipMutationError(
          "Resource group permission increase is fenced by pending revocation cleanup",
          "conflict"
        )
        await this.completeNonSuccess(auditIntent, mutationError.result, current.memberships)
        throw mutationError
      }
    }
    if (cleanupRegistration) {
      try {
        commonCleanupRepair = await this.deps.cleanupRepairOutbox.prepare({
          expectedBeforeDenyVersion: current.version,
          cleanupRegistration,
          preparedAt: now
        })
        await this.deps.cleanupRepairStore.prepare({
          auditIntentId: auditIntent.intentId,
          tenantId: targetGroup.tenantId,
          groupId,
          expectedBeforeVersion: current.version,
          cleanupRegistration,
          preparedAt: now
        })
      } catch {
        if (commonCleanupRepair) {
          await this.deps.cleanupRepairOutbox.markAbandoned(commonCleanupRepair, now).catch(() => undefined)
        }
        const mutationError = new ResourceGroupMembershipMutationError(
          "Resource group revocation cleanup repair intent could not be persisted",
          "failed"
        )
        await this.completeNonSuccess(auditIntent, mutationError.result, current.memberships)
        throw mutationError
      }
    }

    let replaced
    try {
      replaced = await this.deps.groupMembershipStore.replaceGroupState(targetGroup.tenantId, groupId, nextMemberships, input.expectedVersion)
    } catch (error) {
      if (cleanupRegistration) {
        if (commonCleanupRepair) {
          await this.deps.cleanupRepairOutbox.markAbandoned(commonCleanupRepair, now).catch(() => undefined)
        }
        await this.deps.cleanupRepairStore.markAbandoned(
          targetGroup.tenantId,
          groupId,
          cleanupRegistration.operationId,
          now
        ).catch(() => undefined)
      }
      const mutationError = isConflictError(error)
        ? new ResourceGroupMembershipMutationError("Resource group membership version conflict", "conflict")
        : new ResourceGroupMembershipMutationError("Resource group membership persistence failed", "failed")
      await this.completeNonSuccess(auditIntent, mutationError.result, current.memberships)
      throw mutationError
    }

    if (cleanupRegistration) {
      if (replaced.version !== cleanupRegistration.authoritativeDenyVersion) {
        const mutationError = new ResourceGroupMembershipMutationError(
          "Resource group membership deny version did not match its durable cleanup repair intent",
          "failed"
        )
        await this.completeNonSuccess(auditIntent, mutationError.result, replaced.memberships)
        throw mutationError
      }
      try {
        await this.deps.cleanupRepairStore.markDenyCommitted(
          targetGroup.tenantId,
          groupId,
          cleanupRegistration.operationId,
          (this.deps.now ?? (() => new Date()))().toISOString()
        )
        if (commonCleanupRepair) {
          commonCleanupRepair = await this.deps.cleanupRepairOutbox.markDenyCommitted(
            commonCleanupRepair,
            (this.deps.now ?? (() => new Date()))().toISOString()
          )
        }
      } catch {
        const mutationError = new ResourceGroupMembershipMutationError(
          "Resource group membership deny is committed with a durable cleanup repair pending",
          "failed"
        )
        await this.completeNonSuccess(auditIntent, mutationError.result, replaced.memberships)
        throw mutationError
      }
      try {
        if (!commonCleanupRepair) throw new Error("Shared cleanup repair intent is missing")
        await this.deps.cleanupCoordinator.register(commonCleanupRepair.cleanupRegistration)
      } catch {
        const mutationError = new ResourceGroupMembershipMutationError(
          "Resource group revocation cleanup registration failed",
          "failed"
        )
        await this.completeNonSuccess(auditIntent, mutationError.result, replaced.memberships)
        throw mutationError
      }
      await this.deps.cleanupRepairStore.markCleanupRegistered(
        targetGroup.tenantId,
        groupId,
        cleanupRegistration.operationId,
        now
      ).catch(() => undefined)
      if (commonCleanupRepair) {
        await this.deps.cleanupRepairOutbox.markCleanupRegistered(
          commonCleanupRepair,
          (this.deps.now ?? (() => new Date()))().toISOString()
        )
      }
    }

    await this.deps.auditOutbox.complete(
      auditIntent.intentId,
      targetGroup.tenantId,
      "success",
      auditMemberships(replaced.memberships)
    )
    return {
      groupId,
      version: replaced.version,
      memberships: replaced.memberships,
      auditIntentId: auditIntent.intentId
    }
  }

  async retryPendingRevocationCleanups(actor: AppUser, groupId: string): Promise<number> {
    const actorTenantId = authoritativeActorTenant(actor)
    const targetGroup = await this.deps.userGroupStore.get(actorTenantId, groupId)
    if (!targetGroup || !isCanonicalIdentifier(targetGroup.tenantId)) {
      throw new ResourceGroupMembershipMutationError("Resource group is missing or has no authoritative tenant", "denied")
    }
    const initial = await this.deps.groupMembershipStore.getVersionedGroupState(targetGroup.tenantId, groupId)
    await this.authorizeTargetManagement(actor, targetGroup, initial.memberships, "update")
    const pending = await this.deps.cleanupRepairStore.listPending(targetGroup.tenantId, groupId)
    let completed = 0
    for (const repair of pending) {
      const current = await this.deps.groupMembershipStore.getVersionedGroupState(targetGroup.tenantId, groupId)
      if (current.version !== repair.cleanupRegistration.authoritativeDenyVersion) continue
      const now = (this.deps.now ?? (() => new Date()))().toISOString()
      const committedRepair = await this.deps.cleanupRepairStore.markDenyCommitted(
        targetGroup.tenantId,
        groupId,
        repair.operationId,
        now
      )
      let commonRepair = await this.deps.cleanupRepairOutbox.get(
        targetGroup.tenantId,
        "resource_group",
        groupId,
        repair.operationId
      )
      commonRepair ??= await this.deps.cleanupRepairOutbox.prepare({
        expectedBeforeDenyVersion: repair.expectedBeforeVersion,
        cleanupRegistration: committedRepair.cleanupRegistration,
        preparedAt: repair.createdAt
      })
      if (commonRepair.status === "prepared") {
        commonRepair = await this.deps.cleanupRepairOutbox.markDenyCommitted(commonRepair, now)
      }
      if (commonRepair.status === "abandoned") {
        throw new ResourceGroupMembershipMutationError("Shared cleanup repair intent was abandoned", "failed")
      }
      if (commonRepair.status === "deny_committed") {
        await this.deps.cleanupCoordinator.register(commonRepair.cleanupRegistration)
        await this.deps.cleanupRepairOutbox.markCleanupRegistered(commonRepair, now)
      }
      await this.deps.cleanupRepairStore.markCleanupRegistered(
        targetGroup.tenantId,
        groupId,
        repair.operationId,
        now
      )
      completed += 1
    }
    return completed
  }

  private async validateMutation(
    actor: AppUser,
    targetGroup: UserGroup,
    currentMemberships: readonly GroupMembership[],
    nextMemberships: readonly GroupMembership[],
    input: ReplaceResourceGroupMembershipsInput
  ): Promise<void> {
    const targetTenantId = targetGroup.tenantId
    if (!isCanonicalIdentifier(targetTenantId)) {
      throw new ResourceGroupMembershipMutationError("Target resource group has no authoritative tenant", "denied")
    }
    if (!input.reason.trim() || input.reason.trim() !== input.reason) {
      throw new ResourceGroupMembershipMutationError("Mutation reason is required and must be canonical", "denied")
    }
    if (input.expectedVersion !== (await this.deps.groupMembershipStore.getVersionedGroupState(targetTenantId, targetGroup.groupId)).version) {
      throw new ResourceGroupMembershipMutationError("Resource group membership version conflict", "conflict")
    }
    const allMemberships = await this.authorizeTargetManagement(actor, targetGroup, currentMemberships, "update")

    const keys = new Set<string>()
    for (const membership of nextMemberships) {
      if (!isCanonicalIdentifier(membership.memberId) || membership.groupId !== targetGroup.groupId || membership.tenantId !== targetTenantId) {
        throw new ResourceGroupMembershipMutationError("Membership identity or tenant is invalid", "denied")
      }
      if (membership.memberType === "group" && isApplicationRole(membership.memberId)) {
        throw new ResourceGroupMembershipMutationError("Application roles cannot be resource-group principals", "denied")
      }
      const key = `${membership.memberType}:${membership.memberId}`
      if (keys.has(key)) throw new ResourceGroupMembershipMutationError("Duplicate membership principal", "denied")
      keys.add(key)
    }

    const proposedGraph = replaceGroupEdges(allMemberships, targetGroup.groupId, nextMemberships)
    await validateReachableGraph(
      targetGroup.groupId,
      targetTenantId,
      proposedGraph,
      this.deps.userGroupStore,
      this.deps.userPrincipalDirectory,
      new Set(),
      new Map()
    )
  }

  private async authorizeTargetManagement(
    actor: AppUser,
    targetGroup: UserGroup,
    currentMemberships: readonly GroupMembership[],
    operation: "read" | "update"
  ): Promise<GroupMembership[]> {
    if (
      !isActiveAccount(actor) ||
      !isCanonicalIdentifier(actor.userId) ||
      !isCanonicalIdentifier(actor.tenantId) ||
      actor.tenantId !== targetGroup.tenantId
    ) throw new ResourceGroupMembershipMutationError("Actor identity, account, or tenant is not authoritative", "denied")
    if (targetGroup.status !== "active" || isApplicationRole(targetGroup.groupId)) {
      throw new ResourceGroupMembershipMutationError("Target resource group is inactive or uses the application-role namespace", "denied")
    }
    if (!hasPermission(actor, "rag:group:assign_manager")) {
      throw new ResourceGroupMembershipMutationError("Actor lacks resource-group membership mutation permission", "denied")
    }

    const allMemberships = await this.deps.groupMembershipStore.list(targetGroup.tenantId)
    const currentGraph = replaceGroupEdges(allMemberships, targetGroup.groupId, currentMemberships)
    const actorAuthority = targetGroup.createdBy === actor.userId
      ? "full"
      : (await resolveActorGroupPermission(actor, targetGroup.groupId, currentGraph, this.deps.userGroupStore)).permission
    if (actorAuthority !== "full") {
      throw new ResourceGroupMembershipMutationError("Actor lacks full permission on the target resource group", "denied")
    }
    try {
      enforceResolvedResourceOperation(actor, {
        resourceType: "resourceGroup",
        operation,
        authorizationPath: operation === "update" ? "groupManager" : "target",
        resourceScopes: {
          target: resolvedResourceScope({
            tenantId: targetGroup.tenantId,
            permission: actorAuthority,
            administrativePrincipal: targetGroup.createdBy === actor.userId
          })
        },
        satisfiedGuards: operation === "update" ? ["expectedVersionMatched"] : ["responseAllowlistApplied"]
      })
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) {
        throw new ResourceGroupMembershipMutationError("Canonical resource operation authorization denied", "denied")
      }
      throw error
    }
    return allMemberships
  }

  private async completeNonSuccess(
    intent: SecurityMutationAuditIntent,
    result: Exclude<SecurityMutationResult, "success">,
    currentMemberships: readonly GroupMembership[]
  ): Promise<void> {
    await this.deps.auditOutbox.complete(intent.intentId, intent.draft.tenantId, result, auditMemberships(currentMemberships))
  }

  private async recordEarlyFailure(
    actor: AppUser,
    groupId: string,
    input: ReplaceResourceGroupMembershipsInput,
    result: Extract<SecurityMutationResult, "denied" | "failed">
  ): Promise<void> {
    if (!isCanonicalIdentifier(actor.userId) || !isCanonicalIdentifier(actor.tenantId)) {
      throw new ResourceGroupMembershipMutationError("Actor identity or tenant is not authoritative", "denied")
    }
    const actorTenantId = actor.tenantId
    const audit = await this.deps.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId: actorTenantId,
      targetType: "resourceGroup",
      targetId: groupId,
      operation: "membership.replace",
      before: null,
      proposedAfter: auditMemberships(input.memberships.map((membership) => ({
        tenantId: actorTenantId,
        groupId,
        memberType: membership.memberType,
        memberId: membership.memberId,
        permissionLevel: membership.permissionLevel,
        source: "manual" as const,
        createdAt: "uncommitted",
        updatedAt: "uncommitted"
      }))),
      reason: input.reason,
      policyVersion: RESOURCE_GROUP_MEMBERSHIP_POLICY_VERSION
    })
    await this.deps.auditOutbox.complete(audit.intentId, actorTenantId, result, null)
  }
}

async function validateReachableGraph(
  groupId: string,
  tenantId: string,
  memberships: readonly GroupMembership[],
  groupStore: UserGroupStore,
  userDirectory: ResourceUserPrincipalDirectory,
  path: Set<string>,
  userCache: Map<string, ResourceUserPrincipal | undefined>
): Promise<void> {
  if (path.has(groupId)) throw new ResourceGroupMembershipMutationError("Nested resource-group membership cycle", "denied")
  const group = await groupStore.get(tenantId, groupId)
  if (!group || group.status !== "active" || group.tenantId !== tenantId || isApplicationRole(group.groupId)) {
    throw new ResourceGroupMembershipMutationError("Retained resource-group principal is missing, inactive, cross-tenant, or in the role namespace", "denied")
  }
  const nextPath = new Set(path)
  nextPath.add(groupId)
  for (const membership of memberships.filter((candidate) => candidate.groupId === groupId)) {
    if (membership.tenantId !== tenantId || !isCanonicalIdentifier(membership.memberId)) {
      throw new ResourceGroupMembershipMutationError("Retained membership identity or tenant is invalid", "denied")
    }
    if (membership.memberType === "group") {
      if (isApplicationRole(membership.memberId)) {
        throw new ResourceGroupMembershipMutationError("Application roles cannot be nested resource groups", "denied")
      }
      await validateReachableGraph(membership.memberId, tenantId, memberships, groupStore, userDirectory, nextPath, userCache)
      continue
    }
    let user = userCache.get(membership.memberId)
    if (!userCache.has(membership.memberId)) {
      user = await userDirectory.getUser(membership.memberId)
      userCache.set(membership.memberId, user)
    }
    if (!user || user.status !== "active" || user.tenantId !== tenantId) {
      throw new ResourceGroupMembershipMutationError("Retained user principal is missing, inactive, or cross-tenant", "denied")
    }
  }
}

async function resolveActorGroupPermission(
  actor: AppUser,
  groupId: string,
  memberships: readonly GroupMembership[],
  groupStore: UserGroupStore,
  path: Set<string> = new Set()
): Promise<{ permission: EffectiveFolderPermission; integrity: boolean }> {
  if (path.has(groupId)) return { permission: "none", integrity: false }
  const actorTenantId = actor.tenantId
  if (!isCanonicalIdentifier(actorTenantId)) return { permission: "none", integrity: false }
  const group = await groupStore.get(actorTenantId, groupId)
  if (!group || group.status !== "active" || group.tenantId !== actor.tenantId) return { permission: "none", integrity: false }
  const nextPath = new Set(path)
  nextPath.add(groupId)
  const permissions: EffectiveFolderPermission[] = []
  for (const membership of memberships.filter((candidate) => candidate.groupId === groupId)) {
    if (membership.tenantId !== actor.tenantId) return { permission: "none", integrity: false }
    if (membership.memberType === "user") {
      if (membership.memberId === actor.userId) permissions.push(membership.permissionLevel)
      continue
    }
    const child = await resolveActorGroupPermission(actor, membership.memberId, memberships, groupStore, nextPath)
    if (!child.integrity) return child
    permissions.push(minPermission(membership.permissionLevel, child.permission))
  }
  return { permission: maxPermission(permissions), integrity: true }
}

function replaceGroupEdges(
  memberships: readonly GroupMembership[],
  groupId: string,
  replacement: readonly GroupMembership[]
): GroupMembership[] {
  return [...memberships.filter((membership) => membership.groupId !== groupId), ...replacement]
}

function membershipsRequiringCleanup(
  current: readonly GroupMembership[],
  next: readonly GroupMembership[]
): GroupMembership[] {
  const nextByPrincipal = new Map(next.map((membership) => [
    `${membership.memberType}:${membership.memberId}`,
    membership
  ]))
  const rank = { readOnly: 1, full: 2 } as const
  return current.filter((membership) => {
    const replacement = nextByPrincipal.get(`${membership.memberType}:${membership.memberId}`)
    return !replacement || rank[replacement.permissionLevel] < rank[membership.permissionLevel]
  })
}

function membershipsIncreasingPermission(
  current: readonly GroupMembership[],
  next: readonly GroupMembership[]
): GroupMembership[] {
  const currentByPrincipal = new Map(current.map((membership) => [
    `${membership.memberType}:${membership.memberId}`,
    membership
  ]))
  const rank = { readOnly: 1, full: 2 } as const
  return next.filter((membership) => {
    const previous = currentByPrincipal.get(`${membership.memberType}:${membership.memberId}`)
    return !previous || rank[membership.permissionLevel] > rank[previous.permissionLevel]
  })
}

function membershipRevocationCleanupInput(input: Readonly<{
  tenantId: string
  groupId: string
  version: string
  confirmedAt: string
  memberships: readonly GroupMembership[]
  nextMemberships: readonly GroupMembership[]
}>): RegisterRevocationCleanupInput & { operationId: string } {
  return {
    operationId: `resource-group-membership:${input.tenantId}:${input.groupId}:${input.version}`,
    tenantId: input.tenantId,
    resourceType: "resource_group",
    resourceId: input.groupId,
    trigger: "group_revoked",
    deniedPurposes: ["document.read", "document.useInSearch", "folder.read", "folder.useInSearch"],
    authoritativeDenyVersion: input.version,
    authoritativeDenyConfirmedAt: input.confirmedAt,
    knownTargets: membershipCleanupTargets(input.groupId, input.memberships, input.nextMemberships)
  }
}

function membershipCleanupTargets(
  groupId: string,
  memberships: readonly GroupMembership[],
  nextMemberships: readonly GroupMembership[]
): RevocationCleanupTargetReference[] {
  const group = encodeURIComponent(groupId)
  const nextByPrincipal = new Map(nextMemberships.map((membership) => [`${membership.memberType}:${membership.memberId}`, membership]))
  return memberships.flatMap((membership) => {
    const principal = `${membership.memberType}/${encodeURIComponent(membership.memberId)}`
    const reference = `resource-group/${group}/principal/${principal}`
    const ceiling = nextByPrincipal.get(`${membership.memberType}:${membership.memberId}`)?.permissionLevel ?? "none"
    return [
      { scope: "grant", reference: `${reference}/grant/ceiling/${ceiling}` },
      { scope: "cache", reference: `${reference}/cache` },
      { scope: "session", reference: `${reference}/session` },
      { scope: "queued_run", reference: `${reference}/queued-run` },
      { scope: "evaluation_artifact", reference: `${reference}/evaluation-artifact` }
    ] satisfies RevocationCleanupTargetReference[]
  })
}

function minPermission(left: EffectiveFolderPermission, right: EffectiveFolderPermission): EffectiveFolderPermission {
  const rank = { none: 0, readOnly: 1, full: 2 } as const
  return rank[left] <= rank[right] ? left : right
}

function maxPermission(permissions: readonly EffectiveFolderPermission[]): EffectiveFolderPermission {
  if (permissions.includes("full")) return "full"
  if (permissions.includes("readOnly")) return "readOnly"
  return "none"
}

function auditMemberships(memberships: readonly GroupMembership[]) {
  return memberships.map((membership) => ({
    tenantId: membership.tenantId ?? null,
    groupId: membership.groupId,
    memberType: membership.memberType,
    memberId: membership.memberId,
    permissionLevel: membership.permissionLevel,
    source: membership.source,
    updatedAt: membership.updatedAt
  }))
}

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function authoritativeActorTenant(actor: AppUser): string {
  if (!isActiveAccount(actor) || !isCanonicalIdentifier(actor.userId) || !isCanonicalIdentifier(actor.tenantId)) {
    throw new ResourceGroupMembershipMutationError("Actor identity, account, or tenant is not authoritative", "denied")
  }
  return actor.tenantId
}

function normalizeMutationError(error: unknown): ResourceGroupMembershipMutationError {
  if (error instanceof ResourceGroupMembershipMutationError) return error
  return new ResourceGroupMembershipMutationError("Resource group membership validation failed", "failed")
}

function isConflictError(error: unknown): boolean {
  return error instanceof Error && (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
}
