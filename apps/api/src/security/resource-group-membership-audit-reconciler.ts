import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { GroupMembership } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"

/**
 * Reconciles the audit boundary only; it never repeats the membership mutation.
 * The current tenant-scoped membership state must prove the recorded outcome.
 */
export class ResourceGroupMembershipAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(
    private readonly membershipStore: Pick<GroupMembershipStore, "getVersionedGroupState">
  ) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "resourceGroup" && draft.operation === "membership.replace"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) {
      throw new Error("Resource-group membership audit resolver does not support this intent")
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
      // Early lookup/identity failures have no authoritative membership state.
      // The durable requested completion proves that no mutation was started.
      return {
        result: intent.requestedCompletion.result,
        after: null
      }
    }

    const current = await this.membershipStore.getVersionedGroupState(tenantId, targetId)
    const authoritativeAfter = canonicalMembershipAudit(current.memberships, tenantId, targetId)

    if (intent.requestedCompletion) {
      const requestedAfter = canonicalStoredMembershipAudit(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritativeAfter, requestedAfter)) {
        throw new Error("Authoritative resource-group membership does not confirm the requested audit completion")
      }
      return {
        result: intent.requestedCompletion.result,
        after: intent.requestedCompletion.after
      }
    }

    const proposedAfter = canonicalStoredMembershipAudit(
      intent.draft.proposedAfter,
      tenantId,
      targetId,
      "proposed state"
    )
    if (sameJson(authoritativeAfter, proposedAfter)) {
      return { result: "success", after: intent.draft.proposedAfter }
    }

    const before = canonicalStoredMembershipAudit(intent.draft.before, tenantId, targetId, "before state")
    if (sameJson(authoritativeAfter, before)) {
      throw new Error("Pending resource-group membership audit has no durable non-success result")
    }
    throw new Error("Authoritative resource-group membership matches neither the before nor proposed audit state")
  }
}

type MembershipAuditEntry = Readonly<{
  tenantId: string
  groupId: string
  memberType: GroupMembership["memberType"]
  memberId: string
  permissionLevel: GroupMembership["permissionLevel"]
  source: GroupMembership["source"]
  updatedAt: string
}>

function canonicalMembershipAudit(
  memberships: readonly GroupMembership[],
  tenantId: string,
  groupId: string
): MembershipAuditEntry[] {
  const canonical = memberships.map((membership) => {
    if (
      membership.tenantId !== tenantId
      || membership.groupId !== groupId
      || !["user", "group"].includes(membership.memberType)
      || !isCanonicalIdentifier(membership.memberId)
      || !["readOnly", "full"].includes(membership.permissionLevel)
      || !["manual", "external", "system"].includes(membership.source)
      || !isCanonicalIdentifier(membership.updatedAt)
    ) throw new Error("Authoritative resource-group membership crossed its identity boundary")
    return {
      tenantId,
      groupId,
      memberType: membership.memberType,
      memberId: membership.memberId,
      permissionLevel: membership.permissionLevel,
      source: membership.source,
      updatedAt: membership.updatedAt
    }
  }).sort(compareMembershipAudit)
  assertUniqueMemberships(canonical)
  return canonical
}

function canonicalStoredMembershipAudit(
  value: unknown,
  tenantId: string,
  groupId: string,
  label: string
): MembershipAuditEntry[] {
  if (!Array.isArray(value)) throw new Error(`Resource-group membership audit ${label} is invalid`)
  const canonical = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Resource-group membership audit ${label} is invalid`)
    }
    const candidate = entry as Partial<MembershipAuditEntry>
    if (
      candidate.tenantId !== tenantId
      || candidate.groupId !== groupId
      || !["user", "group"].includes(candidate.memberType ?? "")
      || !isCanonicalIdentifier(candidate.memberId)
      || !["readOnly", "full"].includes(candidate.permissionLevel ?? "")
      || !["manual", "external", "system"].includes(candidate.source ?? "")
      || !isCanonicalIdentifier(candidate.updatedAt)
    ) throw new Error(`Resource-group membership audit ${label} crossed its identity boundary`)
    return {
      tenantId,
      groupId,
      memberType: candidate.memberType!,
      memberId: candidate.memberId,
      permissionLevel: candidate.permissionLevel!,
      source: candidate.source!,
      updatedAt: candidate.updatedAt
    }
  }).sort(compareMembershipAudit)
  assertUniqueMemberships(canonical)
  return canonical
}

function compareMembershipAudit(left: MembershipAuditEntry, right: MembershipAuditEntry): number {
  return `${left.memberType}\u0000${left.memberId}`.localeCompare(`${right.memberType}\u0000${right.memberId}`)
}

function assertUniqueMemberships(entries: readonly MembershipAuditEntry[]): void {
  for (let index = 1; index < entries.length; index += 1) {
    if (compareMembershipAudit(entries[index - 1]!, entries[index]!) === 0) {
      throw new Error("Resource-group membership audit contains a duplicate principal")
    }
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!isCanonicalIdentifier(value)) throw new Error(`Resource-group membership audit ${field} is invalid`)
}

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}
