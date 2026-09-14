import { createHash } from "node:crypto"
import { groupMembershipStateVersion, type GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { GroupMembership, UserGroup } from "../types.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  REVOCATION_CLEANUP_POLICY_VERSION,
  REVOCATION_CLEANUP_SCOPES,
  type RegisterRevocationCleanupInput,
  type RevocationCleanupManifest
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import {
  archivedGroupCleanupRegistration,
  membershipCleanupRegistration,
  type DeleteLifecycleIntent
} from "./resource-group-lifecycle-service.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type { SecurityMutationAuditDraft, SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"

/** Reconciles the audit boundary only; it never repeats deny, archive, or cleanup mutations. */
export class ResourceGroupDeleteAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(
    private readonly objects: ObjectStore,
    private readonly groups: Pick<UserGroupStore, "get">,
    private readonly memberships: Pick<GroupMembershipStore, "getVersionedGroupState">
  ) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "resourceGroup" && draft.operation === "delete"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) throw new Error("Resource-group delete audit resolver does not support this intent")
    const { tenantId, targetId } = intent.draft
    assertCanonicalIdentifier(tenantId, "tenantId")
    assertCanonicalIdentifier(targetId, "targetId")

    if (
      intent.requestedCompletion
      && intent.requestedCompletion.result !== "success"
      && intent.requestedCompletion.after === null
      && intent.draft.before === null
    ) return { result: intent.requestedCompletion.result, after: null }

    const marker = await this.readMarker(tenantId, targetId, intent)
    if (intent.requestedCompletion?.result !== "success") {
      if (intent.requestedCompletion) return this.resolveDurableFailure(intent, marker)
      if (marker.status === "failed") throw new Error("Resource-group delete failure has no durable audit completion")
    }
    if (marker.status !== "group_archived" && marker.status !== "completed") {
      throw new Error("Resource-group delete lifecycle is not authoritatively complete")
    }

    const currentGroup = await this.groups.get(tenantId, targetId)
    if (!currentGroup) throw new Error("Authoritative resource-group delete target is unavailable")
    const membershipState = await this.memberships.getVersionedGroupState(tenantId, targetId)
    if (membershipState.memberships.length !== 0 || membershipState.version !== groupMembershipStateVersion([])) {
      throw new Error("Authoritative resource-group delete membership deny is incomplete")
    }

    const authoritativeAfter = canonicalGroupAudit(currentGroup, tenantId, targetId, "authoritative group")
    const markerAfter = canonicalGroupAudit(marker.archivedGroup, tenantId, targetId, "lifecycle archived group")
    const proposedAfter = canonicalGroupAudit(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
    if (!sameJson(authoritativeAfter, markerAfter) || !sameJson(authoritativeAfter, proposedAfter)) {
      throw new Error("Authoritative resource-group delete state does not match its lifecycle intent")
    }
    if (!sameJson(canonicalFullGroup(currentGroup, tenantId, targetId), canonicalFullGroup(marker.archivedGroup, tenantId, targetId))) {
      throw new Error("Authoritative resource-group delete identity differs from its lifecycle intent")
    }

    if (marker.memberships.length > 0) {
      await this.assertCleanupRegistered(
        marker,
        marker.membershipVersion,
        membershipCleanupRegistration(marker)
      )
    }
    await this.assertCleanupRegistered(
      marker,
      marker.group.updatedAt,
      archivedGroupCleanupRegistration(marker)
    )

    if (intent.requestedCompletion) {
      const requestedAfter = canonicalGroupAudit(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritativeAfter, requestedAfter)) {
        throw new Error("Authoritative resource group does not confirm the requested delete audit completion")
      }
      return { result: intent.requestedCompletion.result, after: intent.requestedCompletion.after }
    }
    return { result: "success", after: intent.draft.proposedAfter }
  }

  private async resolveDurableFailure(
    intent: SecurityMutationAuditIntent,
    marker: DeleteLifecycleIntent
  ): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (marker.status !== "failed") throw new Error("Resource-group delete non-success lifecycle is not terminal")
    const { tenantId, targetId } = intent.draft
    const currentGroup = await this.groups.get(tenantId, targetId)
    if (!currentGroup) throw new Error("Authoritative resource-group delete failure target is unavailable")
    const membershipState = await this.memberships.getVersionedGroupState(tenantId, targetId)
    const authoritativeBefore = canonicalGroupAudit(currentGroup, tenantId, targetId, "authoritative group")
    const markerBefore = canonicalGroupAudit(marker.group, tenantId, targetId, "lifecycle group")
    const draftBefore = canonicalGroupAudit(intent.draft.before, tenantId, targetId, "before state")
    const requestedAfter = canonicalGroupAudit(
      intent.requestedCompletion!.after,
      tenantId,
      targetId,
      "requested completion"
    )
    if (
      !sameJson(authoritativeBefore, markerBefore)
      || !sameJson(authoritativeBefore, draftBefore)
      || !sameJson(authoritativeBefore, requestedAfter)
      || !sameJson(canonicalFullGroup(currentGroup, tenantId, targetId), canonicalFullGroup(marker.group, tenantId, targetId))
    ) throw new Error("Authoritative resource group does not confirm the requested delete failure")

    const currentMemberships = membershipState.memberships
      .map((entry) => canonicalMembership(entry, tenantId, targetId))
      .sort(compareMembership)
    const markerMemberships = marker.memberships
      .map((entry) => canonicalMembership(entry, tenantId, targetId))
      .sort(compareMembership)
    if (membershipState.version !== marker.membershipVersion || !sameJson(currentMemberships, markerMemberships)) {
      throw new Error("Authoritative memberships do not confirm the requested delete failure")
    }
    for (const registration of [
      ...(marker.memberships.length > 0 ? [membershipCleanupRegistration(marker)] : []),
      archivedGroupCleanupRegistration(marker)
    ]) {
      const repair = await new ObjectStoreRevocationCleanupRepairOutbox(this.objects).get(
        tenantId,
        "resource_group",
        targetId,
        registration.operationId
      )
      if (repair && repair.status !== "abandoned") {
        throw new Error("Resource-group delete failure retained a live cleanup repair")
      }
      if (await new ObjectStoreRevocationCleanupCoordinator(this.objects).get(tenantId, registration.operationId)) {
        throw new Error("Resource-group delete failure has a registered cleanup ledger")
      }
    }
    return { result: intent.requestedCompletion!.result, after: intent.requestedCompletion!.after }
  }

  private async assertCleanupRegistered(
    marker: DeleteLifecycleIntent,
    expectedBeforeDenyVersion: string,
    registration: RegisterRevocationCleanupInput & { operationId: string }
  ): Promise<void> {
    const repair = await new ObjectStoreRevocationCleanupRepairOutbox(this.objects).get(
      marker.tenantId,
      "resource_group",
      marker.group.groupId,
      registration.operationId
    )
    if (
      !repair
      || (repair.status !== "cleanup_registered" && repair.status !== "cleanup_completed")
      || repair.expectedBeforeDenyVersion !== expectedBeforeDenyVersion
      || !sameJson(repair.cleanupRegistration, registration)
    ) throw new Error("Resource-group delete cleanup repair is not authoritatively registered")

    const manifest = await new ObjectStoreRevocationCleanupCoordinator(this.objects).get(
      marker.tenantId,
      registration.operationId
    )
    if (!manifest || manifest.status === "superseded") {
      throw new Error("Resource-group delete cleanup ledger is not authoritatively registered")
    }
    assertCleanupManifestRegistration(manifest, registration)
  }

  private async readMarker(
    tenantId: string,
    groupId: string,
    auditIntent: SecurityMutationAuditIntent
  ): Promise<DeleteLifecycleIntent> {
    let value: unknown
    try {
      value = JSON.parse(await this.objects.getText(deleteLifecycleKey(tenantId, groupId)))
    } catch (error) {
      throw new Error("Resource-group delete lifecycle intent is unavailable", { cause: error })
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Resource-group delete lifecycle intent is invalid")
    }
    const marker = value as Partial<DeleteLifecycleIntent>
    if (
      marker.schemaVersion !== 1
      || marker.kind !== "delete"
      || !["prepared", "authorized", "memberships_cleared", "group_archived", "completed", "failed"].includes(marker.status ?? "")
      || marker.tenantId !== tenantId
      || marker.auditIntentId !== auditIntent.intentId
      || marker.actorId !== auditIntent.draft.actorId
      || !isCanonicalIdentifier(marker.actorId)
      || !isCanonicalIdentifier(marker.fingerprint)
      || !isCanonicalIdentifier(marker.membershipVersion)
      || !isCanonicalTimestamp(marker.createdAt)
      || !isCanonicalTimestamp(marker.updatedAt)
      || !marker.group
      || !marker.archivedGroup
      || !Array.isArray(marker.memberships)
    ) throw new Error("Resource-group delete lifecycle intent crossed its identity boundary")
    if (
      marker.status !== "prepared"
      && marker.status !== "failed"
      && (
        (marker.permission !== "readOnly" && marker.permission !== "full")
        || typeof marker.administrativePrincipal !== "boolean"
      )
    ) throw new Error("Resource-group delete lifecycle authorization is invalid")

    const group = canonicalFullGroup(marker.group, tenantId, groupId)
    const archived = canonicalFullGroup(marker.archivedGroup, tenantId, groupId)
    if (group.status !== "active" || archived.status !== "archived" || !sameGroupBase(group, archived)) {
      throw new Error("Resource-group delete lifecycle group transition is invalid")
    }
    const before = canonicalGroupAudit(auditIntent.draft.before, tenantId, groupId, "before state")
    const proposed = canonicalGroupAudit(auditIntent.draft.proposedAfter, tenantId, groupId, "proposed state")
    if (!sameJson(before, canonicalGroupAudit(marker.group, tenantId, groupId, "lifecycle group"))
      || !sameJson(proposed, canonicalGroupAudit(marker.archivedGroup, tenantId, groupId, "lifecycle archived group"))) {
      throw new Error("Resource-group delete lifecycle does not match its audit draft")
    }
    const identities = new Set<string>()
    for (const membership of marker.memberships) {
      const canonical = canonicalMembership(membership, tenantId, groupId)
      const identity = `${canonical.memberType}\u0000${canonical.memberId}`
      if (identities.has(identity)) throw new Error("Resource-group delete lifecycle memberships are duplicated")
      identities.add(identity)
    }
    return marker as DeleteLifecycleIntent
  }
}

type GroupAudit = Readonly<{
  groupId: string
  tenantId: string
  name: string
  type: UserGroup["type"]
  status: UserGroup["status"]
  createdBy: string
  updatedAt: string
}>

function canonicalGroupAudit(value: unknown, tenantId: string, groupId: string, label: string): GroupAudit {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Resource-group delete ${label} is invalid`)
  const group = value as Partial<UserGroup>
  if (
    group.tenantId !== tenantId
    || group.groupId !== groupId
    || !isCanonicalIdentifier(group.name)
    || !isGroupType(group.type)
    || (group.status !== "active" && group.status !== "archived")
    || !isCanonicalIdentifier(group.createdBy)
    || !isCanonicalTimestamp(group.updatedAt)
  ) throw new Error(`Resource-group delete ${label} crossed its identity boundary`)
  return {
    groupId,
    tenantId,
    name: group.name,
    type: group.type,
    status: group.status,
    createdBy: group.createdBy,
    updatedAt: group.updatedAt
  }
}

function canonicalFullGroup(value: UserGroup, tenantId: string, groupId: string) {
  const audit = canonicalGroupAudit(value, tenantId, groupId, "group")
  if (!Array.isArray(value.ancestorGroupIds) || value.ancestorGroupIds.some((entry) => !isCanonicalIdentifier(entry)) || !isCanonicalTimestamp(value.createdAt)) {
    throw new Error("Resource-group delete group state is invalid")
  }
  if (value.parentGroupId !== undefined && !isCanonicalIdentifier(value.parentGroupId)) {
    throw new Error("Resource-group delete group parent is invalid")
  }
  return {
    ...audit,
    itemType: value.itemType ?? null,
    parentGroupId: value.parentGroupId ?? null,
    ancestorGroupIds: [...value.ancestorGroupIds],
    createdAt: value.createdAt
  }
}

function sameGroupBase(left: ReturnType<typeof canonicalFullGroup>, right: ReturnType<typeof canonicalFullGroup>): boolean {
  return sameJson(
    { ...left, status: undefined, updatedAt: undefined },
    { ...right, status: undefined, updatedAt: undefined }
  )
}

function canonicalMembership(value: GroupMembership, tenantId: string, groupId: string) {
  if (
    value.tenantId !== tenantId
    || value.groupId !== groupId
    || (value.memberType !== "user" && value.memberType !== "group")
    || !isCanonicalIdentifier(value.memberId)
    || (value.permissionLevel !== "readOnly" && value.permissionLevel !== "full")
    || !["manual", "external", "system"].includes(value.source)
    || !isCanonicalTimestamp(value.createdAt)
    || !isCanonicalTimestamp(value.updatedAt)
  ) throw new Error("Resource-group delete membership crossed its identity boundary")
  return {
    tenantId,
    groupId,
    memberType: value.memberType,
    memberId: value.memberId,
    permissionLevel: value.permissionLevel,
    source: value.source,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}

function compareMembership(left: ReturnType<typeof canonicalMembership>, right: ReturnType<typeof canonicalMembership>): number {
  return `${left.memberType}\u0000${left.memberId}`.localeCompare(`${right.memberType}\u0000${right.memberId}`)
}

function assertCleanupManifestRegistration(
  manifest: RevocationCleanupManifest,
  registration: RegisterRevocationCleanupInput & { operationId: string }
): void {
  const expectedPurposes = [...new Set(registration.deniedPurposes ?? [])].sort()
  if (
    manifest.schemaVersion !== 1
    || manifest.policyVersion !== REVOCATION_CLEANUP_POLICY_VERSION
    || manifest.operationId !== registration.operationId
    || manifest.tenantId !== registration.tenantId
    || manifest.resourceType !== registration.resourceType
    || manifest.resourceId !== registration.resourceId
    || manifest.trigger !== registration.trigger
    || !sameJson(manifest.deniedPurposes, expectedPurposes)
    || manifest.authoritativeDeny?.status !== "effective"
    || manifest.authoritativeDeny.version !== registration.authoritativeDenyVersion
    || manifest.authoritativeDeny.confirmedAt !== registration.authoritativeDenyConfirmedAt
    || !["cleanup_pending", "reconciliation_required", "completed"].includes(manifest.status)
    || !Number.isSafeInteger(manifest.attempts)
    || manifest.attempts < 0
    || !isCanonicalTimestamp(manifest.createdAt)
    || !isCanonicalTimestamp(manifest.updatedAt)
    || !Array.isArray(manifest.scopes)
    || !Array.isArray(manifest.targets)
    || manifest.scopes.length !== REVOCATION_CLEANUP_SCOPES.length
    || !REVOCATION_CLEANUP_SCOPES.every((scope) => manifest.scopes.filter((entry) => entry.scope === scope).length === 1)
  ) throw new Error("Resource-group delete cleanup ledger identity is invalid")

  const targetIds = new Set<string>()
  for (const target of manifest.targets) {
    const expectedTargetId = createHash("sha256")
      .update(`${target.scope}\u0000${target.reference}`)
      .digest("hex")
    if (
      !REVOCATION_CLEANUP_SCOPES.includes(target.scope)
      || !isCanonicalIdentifier(target.reference)
      || target.targetId !== expectedTargetId
      || targetIds.has(target.targetId)
      || !["pending", "cleaned"].includes(target.status)
      || !Number.isSafeInteger(target.attempts)
      || target.attempts < 0
    ) throw new Error("Resource-group delete cleanup ledger target is invalid")
    targetIds.add(target.targetId)
  }
  for (const target of registration.knownTargets ?? []) {
    const expectedTargetId = createHash("sha256")
      .update(`${target.scope}\u0000${target.reference}`)
      .digest("hex")
    if (!targetIds.has(expectedTargetId)) {
      throw new Error("Resource-group delete cleanup ledger is missing a registered target")
    }
  }
}

function deleteLifecycleKey(tenantId: string, groupId: string): string {
  return `security/resource-group-lifecycle/delete/${encodeURIComponent(tenantId)}/${encodeURIComponent(groupId)}.json`
}

function isGroupType(value: unknown): value is UserGroup["type"] {
  return ["department", "project", "team", "admin", "folderPolicy", "system", "custom"].includes(String(value))
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!isCanonicalIdentifier(value)) throw new Error(`Resource-group delete audit ${field} is invalid`)
}

function isCanonicalIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
