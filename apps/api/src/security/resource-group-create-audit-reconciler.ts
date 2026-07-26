import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { GroupMembership, UserGroup } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type { SecurityMutationAuditDraft, SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"

type CreateLifecycleIntent = Readonly<{
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
}>

/** Reconciles the audit boundary only; it never repeats group or membership creation. */
export class ResourceGroupCreateAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(
    private readonly objects: Pick<ObjectStore, "getText">,
    private readonly groups: Pick<UserGroupStore, "get">,
    private readonly memberships: Pick<GroupMembershipStore, "getVersionedGroupState">
  ) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "resourceGroup" && draft.operation === "create"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) throw new Error("Resource-group create audit resolver does not support this intent")
    const { tenantId, targetId } = intent.draft
    assertCanonicalIdentifier(tenantId, "tenantId")
    assertCanonicalIdentifier(targetId, "targetId")

    if (
      intent.requestedCompletion
      && intent.requestedCompletion.result !== "success"
      && intent.requestedCompletion.after === null
      && intent.draft.before === null
    ) return { result: intent.requestedCompletion.result, after: null }

    const marker = await this.readMarker(tenantId, targetId, intent.intentId)
    if (marker.status !== "membership_created" && marker.status !== "completed") {
      throw new Error("Resource-group create lifecycle is not authoritatively complete")
    }
    const currentGroup = await this.groups.get(tenantId, targetId)
    if (!currentGroup) throw new Error("Authoritative resource-group create target is unavailable")
    const currentMemberships = (await this.memberships.getVersionedGroupState(tenantId, targetId)).memberships
    const authoritativeAfter = canonicalGroupAudit(currentGroup, tenantId, targetId, "authoritative group")
    const markerAfter = canonicalGroupAudit(marker.group, tenantId, targetId, "lifecycle group")
    const proposedAfter = canonicalGroupAudit(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
    if (!sameJson(authoritativeAfter, markerAfter) || !sameJson(authoritativeAfter, proposedAfter)) {
      throw new Error("Authoritative resource-group create state does not match its lifecycle intent")
    }
    if (!sameJson(canonicalFullGroup(currentGroup, tenantId, targetId), canonicalFullGroup(marker.group, tenantId, targetId))) {
      throw new Error("Authoritative resource-group create identity differs from its lifecycle intent")
    }
    const authoritativeMemberships = currentMemberships.map((entry) => canonicalMembership(entry, tenantId, targetId)).sort(compareMembership)
    const intendedMemberships = [canonicalMembership(marker.membership, tenantId, targetId)]
    if (!sameJson(authoritativeMemberships, intendedMemberships)) {
      throw new Error("Authoritative resource-group create membership is incomplete or unexpected")
    }

    if (intent.requestedCompletion) {
      const requestedAfter = canonicalGroupAudit(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritativeAfter, requestedAfter)) {
        throw new Error("Authoritative resource group does not confirm the requested create audit completion")
      }
      return { result: intent.requestedCompletion.result, after: intent.requestedCompletion.after }
    }
    return { result: "success", after: intent.draft.proposedAfter }
  }

  private async readMarker(tenantId: string, groupId: string, auditIntentId: string): Promise<CreateLifecycleIntent> {
    let value: unknown
    try {
      value = JSON.parse(await this.objects.getText(createLifecycleKey(tenantId, groupId)))
    } catch (error) {
      throw new Error("Resource-group create lifecycle intent is unavailable", { cause: error })
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Resource-group create lifecycle intent is invalid")
    }
    const marker = value as Partial<CreateLifecycleIntent>
    if (
      marker.schemaVersion !== 1
      || marker.kind !== "create"
      || !["prepared", "group_created", "membership_created", "completed", "failed"].includes(marker.status ?? "")
      || marker.tenantId !== tenantId
      || marker.auditIntentId !== auditIntentId
      || !isCanonicalIdentifier(marker.actorId)
      || !isCanonicalIdentifier(marker.fingerprint)
      || !isCanonicalTimestamp(marker.createdAt)
      || !isCanonicalTimestamp(marker.updatedAt)
      || !marker.group
      || !marker.membership
    ) throw new Error("Resource-group create lifecycle intent crossed its identity boundary")
    canonicalFullGroup(marker.group, tenantId, groupId)
    const membership = canonicalMembership(marker.membership, tenantId, groupId)
    if (
      marker.group.createdBy !== marker.actorId
      || membership.memberType !== "user"
      || membership.memberId !== marker.actorId
      || membership.source !== "system"
      || membership.permissionLevel !== "full"
    ) {
      throw new Error("Resource-group create lifecycle owner membership is invalid")
    }
    return marker as CreateLifecycleIntent
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
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Resource-group create ${label} is invalid`)
  const group = value as Partial<UserGroup>
  if (
    group.tenantId !== tenantId
    || group.groupId !== groupId
    || !isCanonicalIdentifier(group.name)
    || !isGroupType(group.type)
    || (group.status !== "active" && group.status !== "archived")
    || !isCanonicalIdentifier(group.createdBy)
    || !isCanonicalTimestamp(group.updatedAt)
  ) throw new Error(`Resource-group create ${label} crossed its identity boundary`)
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
    throw new Error("Resource-group create group state is invalid")
  }
  if (value.parentGroupId !== undefined && !isCanonicalIdentifier(value.parentGroupId)) {
    throw new Error("Resource-group create group parent is invalid")
  }
  return {
    ...audit,
    itemType: value.itemType ?? null,
    parentGroupId: value.parentGroupId ?? null,
    ancestorGroupIds: [...value.ancestorGroupIds],
    createdAt: value.createdAt
  }
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
  ) throw new Error("Resource-group create membership crossed its identity boundary")
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

function createLifecycleKey(tenantId: string, groupId: string): string {
  return `security/resource-group-lifecycle/create/${encodeURIComponent(tenantId)}/${encodeURIComponent(groupId)}.json`
}

function isGroupType(value: unknown): value is UserGroup["type"] {
  return ["department", "project", "team", "admin", "folderPolicy", "system", "custom"].includes(String(value))
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!isCanonicalIdentifier(value)) throw new Error(`Resource-group create audit ${field} is invalid`)
}

function isCanonicalIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
