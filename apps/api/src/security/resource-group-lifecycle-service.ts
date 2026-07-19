import { createHash } from "node:crypto"
import { isApplicationRole } from "@memorag-mvp/contract/access-control"
import type { ObjectStore } from "../adapters/object-store.js"
import { groupMembershipStateVersion, type GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { FolderPolicyStore } from "../adapters/folder-policy-store.js"
import type { AppUser } from "../auth.js"
import type { GroupMembership, JsonValue, UserGroup, UserGroupType } from "../types.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "./production-resource-operation-authorizer.js"
import type {
  SecurityMutationAuditIntent,
  SecurityMutationAuditOutboxPort,
  SecurityMutationResult
} from "./security-mutation-audit-outbox.js"
import type {
  ObjectStoreRevocationCleanupCoordinator,
  RegisterRevocationCleanupInput
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"

export const RESOURCE_GROUP_LIFECYCLE_POLICY_VERSION = "resource-group-lifecycle-policy-v1" as const
export const RESOURCE_GROUP_ABSENT_VERSION = "absent" as const

export type CreateResourceGroupInput = Readonly<{
  groupId: string
  name: string
  type: UserGroupType
  expectedVersion: typeof RESOURCE_GROUP_ABSENT_VERSION
  reason: string
}>

export type UpdateResourceGroupInput = Readonly<{
  name: string
  type: UserGroupType
  expectedVersion: string
  reason: string
}>

export type DeleteResourceGroupInput = Readonly<{
  expectedVersion: string
  reason: string
}>

export type ResourceGroupPublicView = Readonly<{
  groupId: string
  name: string
  type: UserGroupType
  status: UserGroup["status"]
  version: string
}>

export class ResourceGroupLifecycleError extends Error {
  constructor(
    message: string,
    readonly result: Exclude<SecurityMutationResult, "success">
  ) {
    super(message)
    this.name = "ResourceGroupLifecycleError"
  }
}

type ResourceGroupLifecycleDeps = Readonly<{
  userGroupStore: UserGroupStore
  groupMembershipStore: GroupMembershipStore
  folderPolicyStore: FolderPolicyStore
  objectStore: ObjectStore
  auditOutbox: SecurityMutationAuditOutboxPort
  cleanupCoordinator: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
  now?: () => Date
}>

type CreateLifecycleIntent = {
  schemaVersion: 1
  kind: "create"
  status: "prepared" | "group_created" | "membership_created" | "completed" | "failed"
  fingerprint: string
  actorId: string
  tenantId: string
  group: UserGroup
  membership: GroupMembership
  auditIntentId: string
  createdAt: string
  updatedAt: string
}

export type DeleteLifecycleIntent = {
  schemaVersion: 1
  kind: "delete"
  status: "prepared" | "authorized" | "memberships_cleared" | "group_archived" | "completed" | "failed"
  fingerprint: string
  actorId: string
  tenantId: string
  group: UserGroup
  archivedGroup: UserGroup
  memberships: GroupMembership[]
  membershipVersion: string
  permission?: "readOnly" | "full"
  administrativePrincipal?: boolean
  auditIntentId: string
  createdAt: string
  updatedAt: string
}

type VersionedLifecycleIntent<T extends CreateLifecycleIntent | DeleteLifecycleIntent> = Readonly<{
  value: T
  version: string
}>

/** Current-identity, tenant, CAS and audit boundary for resource-group CRUD. */
export class ResourceGroupLifecycleService {
  constructor(private readonly deps: ResourceGroupLifecycleDeps) {}

  async list(actor: AppUser): Promise<ResourceGroupPublicView[]> {
    const tenantId = authoritativeActorTenant(actor)
    const groups = await this.deps.userGroupStore.list(tenantId)
    const visible = await Promise.all(groups.map(async (group) => {
      try {
        await this.authorizeTarget(actor, group, "read", "readOnly", ["responseAllowlistApplied"])
        return publicGroup(group)
      } catch (error) {
        if (error instanceof ResourceGroupLifecycleError && error.result === "denied") return undefined
        throw error
      }
    }))
    return visible
      .filter((group): group is ResourceGroupPublicView => group !== undefined)
      .sort((left, right) => left.name.localeCompare(right.name) || left.groupId.localeCompare(right.groupId))
  }

  async get(actor: AppUser, groupId: string): Promise<ResourceGroupPublicView> {
    const tenantId = authoritativeActorTenant(actor)
    const group = await this.loadActiveTarget(tenantId, groupId)
    await this.authorizeTarget(actor, group, "read", "readOnly", ["responseAllowlistApplied"])
    return publicGroup(group)
  }

  async create(actor: AppUser, input: CreateResourceGroupInput): Promise<ResourceGroupPublicView> {
    const tenantId = authoritativeActorTenant(actor)
    const now = this.now()
    const proposed: UserGroup = {
      groupId: input.groupId,
      itemType: "userGroup",
      tenantId,
      name: input.name,
      type: input.type,
      ancestorGroupIds: [],
      status: "active",
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now
    }
    const membership: GroupMembership = {
      tenantId,
      groupId: proposed.groupId,
      memberType: "user",
      memberId: actor.userId,
      permissionLevel: "full",
      source: "system",
      createdAt: now,
      updatedAt: now
    }
    const fingerprint = lifecycleFingerprint({ actorId: actor.userId, input })
    const key = lifecycleIntentKey("create", tenantId, input.groupId)
    let stored = await this.readIntent<CreateLifecycleIntent>(key)
    if (stored) {
      if (stored.value.fingerprint !== fingerprint || stored.value.actorId !== actor.userId) {
        await this.recordEarlyMutationFailure(actor, input.groupId, "create", input.reason, "denied")
        throw new ResourceGroupLifecycleError("Resource group lifecycle request conflicts with an existing intent", "conflict")
      }
      if (stored.value.status === "failed") {
        throw new ResourceGroupLifecycleError("Resource group lifecycle intent is terminal", "conflict")
      }
      proposed.updatedAt = stored.value.group.updatedAt
      proposed.createdAt = stored.value.group.createdAt
    } else {
      const audit = await this.prepareAudit(actor, tenantId, input.groupId, "create", null, proposed, input.reason)
      const intent: CreateLifecycleIntent = {
        schemaVersion: 1,
        kind: "create",
        status: "prepared",
        fingerprint,
        actorId: actor.userId,
        tenantId,
        group: proposed,
        membership,
        auditIntentId: audit.intentId,
        createdAt: now,
        updatedAt: now
      }
      stored = await this.writeIntent(key, intent)
    }

    try {
      validateCreateInput(input)
      enforceResolvedResourceOperation(actor, {
        resourceType: "resourceGroup",
        operation: "create",
        authorizationPath: "tenant",
        resourceScopes: {
          tenantCreateScope: resolvedResourceScope({ tenantId, permission: "full" })
        },
        satisfiedGuards: ["immutableIdConfirmed", "roleNamespaceSeparated"]
      })
      if (input.expectedVersion !== RESOURCE_GROUP_ABSENT_VERSION) {
        throw new ResourceGroupLifecycleError("Resource group version conflict", "conflict")
      }
      await new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
        .assertResourceFenceReleased(tenantId, "resource_group", input.groupId)

      let current = await this.deps.userGroupStore.get(tenantId, input.groupId)
      if (!current) {
        current = await this.deps.userGroupStore.create(stored.value.group)
      } else if (!sameGroupIdentity(current, stored.value.group) || current.status !== "active") {
        throw new ResourceGroupLifecycleError("Resource group version conflict", "conflict")
      }
      if (stored.value.status === "prepared") {
        stored = await this.advanceIntent(key, stored, { status: "group_created", updatedAt: this.now() })
      }

      const membershipState = await this.deps.groupMembershipStore.getVersionedGroupState(tenantId, input.groupId)
      if (!sameMembershipState(membershipState.memberships, [stored.value.membership])) {
        if (membershipState.memberships.length !== 0) {
          throw new ResourceGroupLifecycleError("Resource group membership initialization conflict", "conflict")
        }
        await this.deps.groupMembershipStore.replaceGroupState(
          tenantId,
          input.groupId,
          [stored.value.membership],
          membershipState.version
        )
      }
      if (stored.value.status === "group_created" || stored.value.status === "prepared") {
        stored = await this.advanceIntent(key, stored, { status: "membership_created", updatedAt: this.now() })
      }
    } catch (error) {
      const normalized = normalizeLifecycleError(error)
      const current = await this.deps.userGroupStore.get(tenantId, input.groupId).catch(() => undefined)
      const membershipState = await this.deps.groupMembershipStore.getVersionedGroupState(tenantId, input.groupId).catch(() => undefined)
      const partial = Boolean(current && sameGroupIdentity(current, stored.value.group)) || Boolean(membershipState?.memberships.length)
      if (!partial) {
        await this.deps.auditOutbox.complete(stored.value.auditIntentId, tenantId, normalized.result, null)
        await this.advanceIntent(key, stored, { status: "failed", updatedAt: this.now() })
      }
      throw normalized
    }
    if (stored.value.status !== "completed") {
      await this.deps.auditOutbox.complete(stored.value.auditIntentId, tenantId, "success", auditGroup(stored.value.group))
      stored = await this.advanceIntent(key, stored, { status: "completed", updatedAt: this.now() })
    }
    return publicGroup(stored.value.group)
  }

  async update(actor: AppUser, groupId: string, input: UpdateResourceGroupInput): Promise<ResourceGroupPublicView> {
    validateUpdateInput(input)
    const group = await this.loadMutationTarget(actor, groupId, "update", input.reason)
    const tenantId = authoritativeGroupTenant(group)
    const proposed: UserGroup = { ...group, name: input.name, type: input.type, updatedAt: this.now() }
    const audit = await this.prepareAudit(actor, tenantId, groupId, "update", group, proposed, input.reason)
    let updated: UserGroup
    try {
      if (input.expectedVersion !== group.updatedAt) {
        throw new ResourceGroupLifecycleError("Resource group version conflict", "conflict")
      }
      await this.authorizeTarget(actor, group, "update", "full", ["expectedVersionMatched"])
      await new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
        .assertResourceFenceReleased(tenantId, "resource_group", groupId)
      updated = await this.deps.userGroupStore.replace(proposed, input.expectedVersion)
    } catch (error) {
      const normalized = normalizeLifecycleError(error)
      await this.completeFailure(audit, normalized.result, group)
      throw normalized
    }
    await this.deps.auditOutbox.complete(audit.intentId, tenantId, "success", auditGroup(updated))
    return publicGroup(updated)
  }

  async delete(actor: AppUser, groupId: string, input: DeleteResourceGroupInput): Promise<ResourceGroupPublicView> {
    validateMutationReason(input.reason)
    const tenantId = authoritativeActorTenant(actor)
    const key = lifecycleIntentKey("delete", tenantId, groupId)
    const fingerprint = lifecycleFingerprint({ actorId: actor.userId, groupId, input })
    let stored = await this.readIntent<DeleteLifecycleIntent>(key)
    if (stored) {
      if (stored.value.fingerprint !== fingerprint || stored.value.actorId !== actor.userId) {
        await this.recordEarlyMutationFailure(actor, groupId, "delete", input.reason, "denied")
        throw new ResourceGroupLifecycleError("Resource group lifecycle request conflicts with an existing intent", "conflict")
      }
      if (stored.value.status === "failed") {
        throw new ResourceGroupLifecycleError("Resource group lifecycle intent is terminal", "conflict")
      }
    } else {
      const group = await this.loadMutationTarget(actor, groupId, "delete", input.reason)
      if (input.expectedVersion !== group.updatedAt) {
        const audit = await this.prepareAudit(actor, tenantId, groupId, "delete", group, group, input.reason)
        await this.completeFailure(audit, "conflict", group)
        throw new ResourceGroupLifecycleError("Resource group version conflict", "conflict")
      }
      const memberships = await this.deps.groupMembershipStore.getVersionedGroupState(tenantId, groupId)
      const archivedGroup: UserGroup = { ...group, status: "archived", updatedAt: this.now() }
      const audit = await this.prepareAudit(actor, tenantId, groupId, "delete", group, archivedGroup, input.reason)
      const intent: DeleteLifecycleIntent = {
        schemaVersion: 1,
        kind: "delete",
        status: "prepared",
        fingerprint,
        actorId: actor.userId,
        tenantId,
        group,
        archivedGroup,
        memberships: memberships.memberships,
        membershipVersion: memberships.version,
        auditIntentId: audit.intentId,
        createdAt: this.now(),
        updatedAt: this.now()
      }
      stored = await this.writeIntent(key, intent)
    }

    if (stored.value.status === "completed") return publicGroup(stored.value.archivedGroup)
    try {
      if (!stored.value.permission) {
        const currentGroup = await this.deps.userGroupStore.get(tenantId, groupId)
        if (!currentGroup || !sameGroupIdentity(currentGroup, stored.value.group) || currentGroup.status !== "active") {
          throw new ResourceGroupLifecycleError("Resource group version conflict", "conflict")
        }
        const permission = await this.resolveActorPermission(actor, currentGroup)
        if ((await this.findExternalReferences(currentGroup)).length > 0) {
          throw new ResourceGroupLifecycleError("Resource group still has active references", "conflict")
        }
        enforceResolvedResourceOperation(actor, {
          resourceType: "resourceGroup",
          operation: "delete",
          authorizationPath: "groupManager",
          resourceScopes: {
            target: resolvedResourceScope({
              tenantId,
              permission: permission.permission,
              administrativePrincipal: permission.administrativePrincipal
            })
          },
          satisfiedGuards: ["impactPreviewConfirmed", "danglingGrantsDisabledFirst"]
        })
        if (permission.permission === "none") throw new ResourceGroupLifecycleError("Forbidden", "denied")
        stored = await this.advanceIntent(key, stored, {
          status: "authorized",
          permission: permission.permission,
          administrativePrincipal: permission.administrativePrincipal,
          updatedAt: this.now()
        })
      } else {
        enforceResolvedResourceOperation(actor, {
          resourceType: "resourceGroup",
          operation: "delete",
          authorizationPath: "groupManager",
          resourceScopes: {
            target: resolvedResourceScope({
              tenantId,
              permission: stored.value.permission,
              administrativePrincipal: stored.value.administrativePrincipal
            })
          },
          satisfiedGuards: ["impactPreviewConfirmed", "danglingGrantsDisabledFirst"]
        })
      }

      if (stored.value.status === "authorized" || stored.value.status === "prepared") {
        await this.prepareDeleteCleanupRepairs(stored.value)
        const ownState = await this.deps.groupMembershipStore.getVersionedGroupState(tenantId, groupId)
        if (ownState.memberships.length > 0) {
          if (!sameMembershipState(ownState.memberships, stored.value.memberships)) {
            throw new ResourceGroupLifecycleError("Resource group memberships changed during deletion", "conflict")
          }
          await this.deps.groupMembershipStore.replaceGroupState(tenantId, groupId, [], ownState.version)
        }
        stored = await this.advanceIntent(key, stored, { status: "memberships_cleared", updatedAt: this.now() })
      }

      if (stored.value.status === "memberships_cleared") {
        await this.registerMembershipCleanup(stored.value)
        if ((await this.findExternalReferences(stored.value.group)).length > 0) {
          throw new ResourceGroupLifecycleError("Resource group references changed during deletion", "conflict")
        }
        const currentGroup = await this.deps.userGroupStore.get(tenantId, groupId)
        if (currentGroup?.status === "active" && sameGroupIdentity(currentGroup, stored.value.group)) {
          await this.deps.userGroupStore.replace(stored.value.archivedGroup, stored.value.group.updatedAt)
        } else if (!currentGroup || currentGroup.status !== "archived" || !sameGroupIdentity(currentGroup, stored.value.archivedGroup)) {
          throw new ResourceGroupLifecycleError("Resource group changed during deletion", "conflict")
        }
        stored = await this.advanceIntent(key, stored, { status: "group_archived", updatedAt: this.now() })
      }
    } catch (error) {
      const normalized = normalizeLifecycleError(error)
      const currentGroup = await this.deps.userGroupStore.get(tenantId, groupId).catch(() => undefined)
      const memberships = await this.deps.groupMembershipStore.getVersionedGroupState(tenantId, groupId).catch(() => undefined)
      const partial = currentGroup?.status === "archived" || memberships?.memberships.length === 0 && stored.value.memberships.length > 0
      if (!partial) {
        await this.abandonDeleteCleanupRepairs(stored.value).catch(() => undefined)
        await this.deps.auditOutbox.complete(
          stored.value.auditIntentId,
          tenantId,
          normalized.result,
          auditGroup(stored.value.group)
        )
        await this.advanceIntent(key, stored, { status: "failed", updatedAt: this.now() })
      }
      throw normalized
    }
    if (stored.value.status !== "completed") {
      await this.registerArchivedGroupCleanup(stored.value)
      await this.deps.auditOutbox.complete(
        stored.value.auditIntentId,
        tenantId,
        "success",
        auditGroup(stored.value.archivedGroup)
      )
      stored = await this.advanceIntent(key, stored, { status: "completed", updatedAt: this.now() })
    }
    return publicGroup(stored.value.archivedGroup)
  }

  /** Explicitly disabled FR-076 cells. No resource read or mutation occurs. */
  assertMoveUnsupported(actor: AppUser): never {
    return this.assertUnsupported(actor, "move")
  }

  assertShareUnsupported(actor: AppUser): never {
    return this.assertUnsupported(actor, "share")
  }

  assertUnsupported(actor: AppUser, operation: "move" | "share"): never {
    try {
      enforceResolvedResourceOperation(actor, {
        resourceType: "resourceGroup",
        operation,
        authorizationPath: "disabled",
        resourceScopes: {},
        satisfiedGuards: []
      })
    } catch (error) {
      throw normalizeLifecycleError(error)
    }
    throw new ResourceGroupLifecycleError("Resource group operation is disabled", "denied")
  }

  private async authorizeTarget(
    actor: AppUser,
    group: UserGroup,
    operation: "read" | "update",
    minimum: "readOnly" | "full",
    guards: readonly ("responseAllowlistApplied" | "expectedVersionMatched")[]
  ): Promise<void> {
    const tenantId = authoritativeGroupTenant(group)
    const permission = await this.resolveActorPermission(actor, group)
    try {
      enforceResolvedResourceOperation(actor, {
        resourceType: "resourceGroup",
        operation,
        authorizationPath: operation === "update" ? "groupManager" : "target",
        resourceScopes: {
          target: resolvedResourceScope({
            tenantId,
            permission: permission.permission,
            administrativePrincipal: permission.administrativePrincipal
          })
        },
        satisfiedGuards: guards
      })
      if (minimum === "full" && permission.permission !== "full") {
        throw new ResourceGroupLifecycleError("Forbidden", "denied")
      }
    } catch (error) {
      throw normalizeLifecycleError(error)
    }
  }

  private async resolveActorPermission(actor: AppUser, group: UserGroup): Promise<{
    permission: "none" | "readOnly" | "full"
    administrativePrincipal: boolean
  }> {
    const tenantId = authoritativeGroupTenant(group)
    if (!canonical(actor.userId) || !canonical(actor.tenantId) || actor.tenantId !== tenantId || actor.accountStatus !== "active") {
      return { permission: "none", administrativePrincipal: false }
    }
    if (group.createdBy === actor.userId) return { permission: "full", administrativePrincipal: true }
    return {
      permission: await this.resolveNestedMembershipPermission(actor, tenantId, group.groupId, new Set()),
      administrativePrincipal: false
    }
  }

  private async resolveNestedMembershipPermission(
    actor: AppUser,
    tenantId: string,
    groupId: string,
    path: Set<string>
  ): Promise<"none" | "readOnly" | "full"> {
    if (path.has(groupId)) return "none"
    const group = await this.deps.userGroupStore.get(tenantId, groupId)
    if (!group || group.status !== "active" || group.tenantId !== tenantId || actor.tenantId !== tenantId) return "none"
    const nextPath = new Set(path)
    nextPath.add(groupId)
    const grants: Array<"none" | "readOnly" | "full"> = []
    for (const membership of await this.deps.groupMembershipStore.listByGroupId(tenantId, groupId)) {
      if (membership.tenantId !== actor.tenantId || membership.groupId !== groupId) return "none"
      if (membership.memberType === "user") {
        if (membership.memberId === actor.userId) grants.push(membership.permissionLevel)
        continue
      }
      const child = await this.resolveNestedMembershipPermission(actor, tenantId, membership.memberId, nextPath)
      grants.push(minPermission(membership.permissionLevel, child))
    }
    return maxPermission(grants)
  }

  private async findExternalReferences(group: UserGroup): Promise<string[]> {
    const groupId = group.groupId
    const tenantId = authoritativeGroupTenant(group)
    const [memberships, groups, policies, directGrantKeys] = await Promise.all([
      this.deps.groupMembershipStore.list(tenantId),
      this.deps.userGroupStore.list(tenantId),
      this.deps.folderPolicyStore.list(tenantId),
      this.deps.objectStore.listKeys(`documents/share-grants/${encodeURIComponent(tenantId)}/`)
    ])
    const references: string[] = []
    for (const membership of memberships) {
      if (membership.groupId !== groupId && membership.memberType === "group" && membership.memberId === groupId) {
        references.push(`membership:${membership.groupId}`)
      }
    }
    for (const candidate of groups) {
      if (candidate.groupId !== groupId && candidate.status === "active" && candidate.parentGroupId === groupId) {
        references.push(`group-parent:${candidate.groupId}`)
      }
    }
    for (const policy of policies) {
      if (policy.tenantId === tenantId && policy.entries.some((entry) => entry.principalType === "group" && entry.principalId === groupId)) {
        references.push(`folder-policy:${policy.policyId}`)
      }
    }
    for (const key of directGrantKeys.filter((candidate) => candidate.endsWith(".json"))) {
      try {
        const raw = JSON.parse(await this.deps.objectStore.getText(key)) as { grants?: Array<{ principalType?: string; principalId?: string }> }
        if (raw.grants?.some((grant) => grant.principalType === "group" && grant.principalId === groupId)) {
          references.push(`document-policy:${key}`)
        }
      } catch {
        // An unreadable authorization reference is not safe to orphan.
        references.push(`document-policy-unreadable:${key}`)
      }
    }
    return references.sort()
  }

  private async loadActiveTarget(tenantId: string, groupId: string): Promise<UserGroup> {
    if (!canonical(groupId) || isApplicationRole(groupId)) throw new ResourceGroupLifecycleError("Forbidden", "denied")
    const group = await this.deps.userGroupStore.get(tenantId, groupId)
    if (!group || group.status !== "active" || !canonical(group.tenantId)) {
      throw new ResourceGroupLifecycleError("Forbidden", "denied")
    }
    return group
  }

  private async loadMutationTarget(
    actor: AppUser,
    groupId: string,
    operation: "update" | "delete",
    reason: string
  ): Promise<UserGroup> {
    const tenantId = authoritativeActorTenant(actor)
    let group: UserGroup | undefined
    try {
      group = await this.deps.userGroupStore.get(tenantId, groupId)
    } catch {
      await this.recordEarlyMutationFailure(actor, groupId, operation, reason, "failed")
      throw new ResourceGroupLifecycleError("Resource group lifecycle persistence failed", "failed")
    }
    if (!group || group.status !== "active" || !canonical(group.tenantId) || isApplicationRole(group.groupId)) {
      await this.recordEarlyMutationFailure(actor, groupId, operation, reason, "denied")
      throw new ResourceGroupLifecycleError("Forbidden", "denied")
    }
    return group
  }

  private async recordEarlyMutationFailure(
    actor: AppUser,
    groupId: string,
    operation: "create" | "update" | "delete",
    reason: string,
    result: Extract<SecurityMutationResult, "denied" | "failed">
  ): Promise<void> {
    const tenantId = authoritativeActorTenant(actor)
    const audit = await this.deps.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId,
      targetType: "resourceGroup",
      targetId: groupId,
      operation,
      before: null,
      proposedAfter: { groupId, requestedOperation: operation },
      reason,
      policyVersion: RESOURCE_GROUP_LIFECYCLE_POLICY_VERSION
    })
    await this.deps.auditOutbox.complete(audit.intentId, tenantId, result, null)
  }

  private async prepareAudit(
    actor: AppUser,
    tenantId: string,
    targetId: string,
    operation: string,
    before: UserGroup | null,
    proposedAfter: UserGroup | null,
    reason: string
  ): Promise<SecurityMutationAuditIntent> {
    return this.deps.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId,
      targetType: "resourceGroup",
      targetId,
      operation,
      before: before ? auditGroup(before) : null,
      proposedAfter: proposedAfter ? auditGroup(proposedAfter) : null,
      reason,
      policyVersion: RESOURCE_GROUP_LIFECYCLE_POLICY_VERSION
    })
  }

  private async completeFailure(
    intent: SecurityMutationAuditIntent,
    result: Exclude<SecurityMutationResult, "success">,
    current: UserGroup | null
  ): Promise<void> {
    await this.deps.auditOutbox.complete(
      intent.intentId,
      intent.draft.tenantId,
      result,
      current ? auditGroup(current) : null
    )
  }

  private async readIntent<T extends CreateLifecycleIntent | DeleteLifecycleIntent>(
    key: string
  ): Promise<VersionedLifecycleIntent<T> | undefined> {
    try {
      const stored = await this.deps.objectStore.getTextWithVersion(key)
      const value = JSON.parse(stored.text) as T
      if (value.schemaVersion !== 1 || (value.kind !== "create" && value.kind !== "delete")) {
        throw new ResourceGroupLifecycleError("Resource group lifecycle intent is invalid", "failed")
      }
      return { value, version: stored.version }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }

  private async writeIntent<T extends CreateLifecycleIntent | DeleteLifecycleIntent>(
    key: string,
    value: T,
    expectedVersion?: string
  ): Promise<VersionedLifecycleIntent<T>> {
    await this.deps.objectStore.putTextIfVersion(
      key,
      JSON.stringify(value, null, 2),
      expectedVersion,
      "application/json"
    )
    const stored = await this.readIntent<T>(key)
    if (!stored || stored.value.fingerprint !== value.fingerprint) {
      throw new ResourceGroupLifecycleError("Resource group lifecycle intent write was not durable", "failed")
    }
    return stored
  }

  private async advanceIntent<T extends CreateLifecycleIntent | DeleteLifecycleIntent>(
    key: string,
    stored: VersionedLifecycleIntent<T>,
    patch: Partial<T>
  ): Promise<VersionedLifecycleIntent<T>> {
    return this.writeIntent(key, { ...stored.value, ...patch } as T, stored.version)
  }

  private now(): string {
    return (this.deps.now ?? (() => new Date()))().toISOString()
  }

  private async prepareDeleteCleanupRepairs(intent: DeleteLifecycleIntent): Promise<void> {
    const outbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    if (intent.memberships.length > 0) {
      await outbox.prepare({
        expectedBeforeDenyVersion: intent.membershipVersion,
        cleanupRegistration: membershipCleanupRegistration(intent),
        preparedAt: intent.createdAt
      })
    }
    await outbox.prepare({
      expectedBeforeDenyVersion: intent.group.updatedAt,
      cleanupRegistration: archivedGroupCleanupRegistration(intent),
      preparedAt: intent.createdAt
    })
  }

  private async abandonDeleteCleanupRepairs(intent: DeleteLifecycleIntent): Promise<void> {
    const outbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    for (const registration of [
      ...(intent.memberships.length > 0 ? [membershipCleanupRegistration(intent)] : []),
      archivedGroupCleanupRegistration(intent)
    ]) {
      const repair = await outbox.get(intent.tenantId, "resource_group", intent.group.groupId, registration.operationId)
      if (repair?.status === "prepared" || repair?.status === "deny_committed") {
        await outbox.markAbandoned(repair, this.now())
      }
    }
  }

  private async registerMembershipCleanup(intent: DeleteLifecycleIntent): Promise<void> {
    if (intent.memberships.length === 0) return
    await this.registerCommonCleanup(
      intent,
      intent.membershipVersion,
      membershipCleanupRegistration(intent)
    )
  }

  private async registerArchivedGroupCleanup(intent: DeleteLifecycleIntent): Promise<void> {
    await this.registerCommonCleanup(
      intent,
      intent.group.updatedAt,
      archivedGroupCleanupRegistration(intent)
    )
  }

  private async registerCommonCleanup(
    intent: DeleteLifecycleIntent,
    expectedBeforeDenyVersion: string,
    registration: RegisterRevocationCleanupInput & { operationId: string }
  ): Promise<void> {
    const outbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    let repair = await outbox.prepare({
      expectedBeforeDenyVersion,
      cleanupRegistration: registration,
      preparedAt: intent.createdAt
    })
    if (repair.status === "abandoned") throw new Error("Resource group cleanup repair intent was abandoned")
    if (repair.status === "prepared") repair = await outbox.markDenyCommitted(repair, this.now())
    if (repair.status === "deny_committed") {
      await this.deps.cleanupCoordinator.register(repair.cleanupRegistration)
      await outbox.markCleanupRegistered(repair, this.now())
    }
  }
}

export function membershipCleanupRegistration(
  intent: DeleteLifecycleIntent
): RegisterRevocationCleanupInput & { operationId: string } {
  return {
    operationId: `resource-group-memberships:${intent.auditIntentId}`,
    tenantId: intent.tenantId,
    resourceType: "resource_group",
    resourceId: intent.group.groupId,
    trigger: "group_revoked",
    deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
    authoritativeDenyVersion: `membership:${groupMembershipStateVersion([])}`,
    authoritativeDenyConfirmedAt: intent.archivedGroup.updatedAt,
    knownTargets: intent.memberships.flatMap((membership) => [
      { scope: "grant" as const, reference: `resource-group:${intent.group.groupId}:${membership.memberType}:${membership.memberId}` },
      { scope: "cache" as const, reference: `resource-group:${intent.group.groupId}:principal:${membership.memberId}` },
      ...(membership.memberType === "user"
        ? [{ scope: "session" as const, reference: membership.memberId }]
        : []),
      { scope: "queued_run" as const, reference: `resource-group:${intent.group.groupId}:principal:${membership.memberId}` },
      { scope: "evaluation_artifact" as const, reference: `resource-group:${intent.group.groupId}:principal:${membership.memberId}` }
    ])
  }
}

export function archivedGroupCleanupRegistration(
  intent: DeleteLifecycleIntent
): RegisterRevocationCleanupInput & { operationId: string } {
  return {
    operationId: `resource-group-archive:${intent.auditIntentId}`,
    tenantId: intent.tenantId,
    resourceType: "resource_group",
    resourceId: intent.group.groupId,
    trigger: "archived",
    deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
    authoritativeDenyVersion: `resource-group:${intent.archivedGroup.updatedAt}`,
    authoritativeDenyConfirmedAt: intent.archivedGroup.updatedAt,
    knownTargets: [
      { scope: "grant", reference: `resource-group:${intent.group.groupId}` },
      { scope: "cache", reference: `resource-group:${intent.group.groupId}` },
      { scope: "session", reference: `resource-group:${intent.group.groupId}/session` },
      { scope: "queued_run", reference: `resource-group:${intent.group.groupId}` },
      { scope: "evaluation_artifact", reference: `resource-group:${intent.group.groupId}` }
    ]
  }
}

function publicGroup(group: UserGroup): ResourceGroupPublicView {
  return {
    groupId: group.groupId,
    name: group.name,
    type: group.type,
    status: group.status,
    version: group.updatedAt
  }
}

function auditGroup(group: UserGroup): JsonValue {
  return {
    groupId: group.groupId,
    tenantId: group.tenantId ?? null,
    name: group.name,
    type: group.type,
    status: group.status,
    createdBy: group.createdBy,
    updatedAt: group.updatedAt
  }
}

function validateCreateInput(input: CreateResourceGroupInput): void {
  if (!canonical(input.groupId) || isApplicationRole(input.groupId)) {
    throw new ResourceGroupLifecycleError("Resource group identifier is invalid", "denied")
  }
  validateName(input.name)
  validateMutationReason(input.reason)
}

function validateUpdateInput(input: UpdateResourceGroupInput): void {
  validateName(input.name)
  validateMutationReason(input.reason)
  if (!canonical(input.expectedVersion)) throw new ResourceGroupLifecycleError("Resource group version is required", "conflict")
}

function validateName(name: string): void {
  if (!canonical(name) || name.length > 200) throw new ResourceGroupLifecycleError("Resource group name is invalid", "denied")
}

function validateMutationReason(reason: string): void {
  if (!canonical(reason) || reason.length > 1000) throw new ResourceGroupLifecycleError("Mutation reason is required", "denied")
}

function authoritativeActorTenant(actor: AppUser): string {
  if (!canonical(actor.userId) || !canonical(actor.tenantId) || actor.accountStatus !== "active") {
    throw new ResourceGroupLifecycleError("Forbidden", "denied")
  }
  return actor.tenantId
}

function authoritativeGroupTenant(group: UserGroup): string {
  if (!canonical(group.tenantId)) throw new ResourceGroupLifecycleError("Forbidden", "denied")
  return group.tenantId
}

function normalizeLifecycleError(error: unknown): ResourceGroupLifecycleError {
  if (error instanceof ResourceGroupLifecycleError) return error
  if (error instanceof ResourceOperationAuthorizationError) {
    return new ResourceGroupLifecycleError("Forbidden", "denied")
  }
  if (error instanceof Error && (error as Error & { code?: string }).code === "PRECONDITION_FAILED") {
    return new ResourceGroupLifecycleError("Resource group version conflict", "conflict")
  }
  return new ResourceGroupLifecycleError("Resource group lifecycle persistence failed", "failed")
}

function minPermission(
  left: "readOnly" | "full",
  right: "none" | "readOnly" | "full"
): "none" | "readOnly" | "full" {
  const rank = { none: 0, readOnly: 1, full: 2 } as const
  return rank[left] <= rank[right] ? left : right
}

function maxPermission(values: readonly ("none" | "readOnly" | "full")[]): "none" | "readOnly" | "full" {
  if (values.includes("full")) return "full"
  if (values.includes("readOnly")) return "readOnly"
  return "none"
}

function canonical(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function lifecycleFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function lifecycleIntentKey(kind: "create" | "delete", tenantId: string, groupId: string): string {
  return `security/resource-group-lifecycle/${kind}/${encodeURIComponent(tenantId)}/${encodeURIComponent(groupId)}.json`
}

function sameGroupIdentity(left: UserGroup, right: UserGroup): boolean {
  return lifecycleFingerprint({
    groupId: left.groupId,
    tenantId: left.tenantId,
    name: left.name,
    type: left.type,
    parentGroupId: left.parentGroupId ?? null,
    ancestorGroupIds: left.ancestorGroupIds,
    status: left.status,
    createdBy: left.createdBy,
    createdAt: left.createdAt,
    updatedAt: left.updatedAt
  }) === lifecycleFingerprint({
    groupId: right.groupId,
    tenantId: right.tenantId,
    name: right.name,
    type: right.type,
    parentGroupId: right.parentGroupId ?? null,
    ancestorGroupIds: right.ancestorGroupIds,
    status: right.status,
    createdBy: right.createdBy,
    createdAt: right.createdAt,
    updatedAt: right.updatedAt
  })
}

function sameMembershipState(left: readonly GroupMembership[], right: readonly GroupMembership[]): boolean {
  const canonicalize = (values: readonly GroupMembership[]) => values.map((membership) => ({
    tenantId: membership.tenantId ?? null,
    groupId: membership.groupId,
    memberType: membership.memberType,
    memberId: membership.memberId,
    permissionLevel: membership.permissionLevel,
    source: membership.source,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt
  })).sort((a, b) => `${a.memberType}:${a.memberId}`.localeCompare(`${b.memberType}:${b.memberId}`))
  return lifecycleFingerprint(canonicalize(left)) === lifecycleFingerprint(canonicalize(right))
}

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && (
    (error as NodeJS.ErrnoException).code === "ENOENT" ||
    error.name === "NoSuchKey" ||
    error.name === "NotFound"
  )
}
