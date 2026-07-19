import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { UserGroup } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"

/** Reconciles the audit record only; it never repeats a resource-group update. */
export class ResourceGroupUpdateAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(private readonly groups: Pick<UserGroupStore, "get">) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "resourceGroup" && draft.operation === "update"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) {
      throw new Error("Resource-group update audit resolver does not support this intent")
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

    const current = await this.groups.get(tenantId, targetId)
    if (!current) throw new Error("Authoritative resource-group update target is unavailable")
    const authoritativeAfter = canonicalAuthoritativeGroup(current, tenantId, targetId)

    if (intent.requestedCompletion) {
      const requestedAfter = canonicalStoredGroup(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritativeAfter, requestedAfter)) {
        throw new Error("Authoritative resource group does not confirm the requested update audit completion")
      }
      return {
        result: intent.requestedCompletion.result,
        after: intent.requestedCompletion.after
      }
    }

    const proposedAfter = canonicalStoredGroup(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
    if (sameJson(authoritativeAfter, proposedAfter)) {
      return { result: "success", after: intent.draft.proposedAfter }
    }
    const before = canonicalStoredGroup(intent.draft.before, tenantId, targetId, "before state")
    if (sameJson(authoritativeAfter, before)) {
      throw new Error("Pending resource-group update audit has no durable non-success result")
    }
    throw new Error("Authoritative resource group matches neither the before nor proposed update audit state")
  }
}

type ResourceGroupAudit = Readonly<{
  groupId: string
  tenantId: string
  name: string
  type: UserGroup["type"]
  status: UserGroup["status"]
  createdBy: string
  updatedAt: string
}>

function canonicalAuthoritativeGroup(group: UserGroup, tenantId: string, groupId: string): ResourceGroupAudit {
  if (
    group.tenantId !== tenantId
    || group.groupId !== groupId
    || !isCanonicalIdentifier(group.name)
    || !isUserGroupType(group.type)
    || !isFolderStatus(group.status)
    || !isCanonicalIdentifier(group.createdBy)
    || !isCanonicalTimestamp(group.updatedAt)
  ) throw new Error("Authoritative resource group crossed its identity boundary")
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

function canonicalStoredGroup(
  value: unknown,
  tenantId: string,
  groupId: string,
  label: string
): ResourceGroupAudit {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Resource-group update audit ${label} is invalid`)
  }
  const candidate = value as Partial<ResourceGroupAudit>
  if (
    candidate.tenantId !== tenantId
    || candidate.groupId !== groupId
    || !isCanonicalIdentifier(candidate.name)
    || !isUserGroupType(candidate.type)
    || !isFolderStatus(candidate.status)
    || !isCanonicalIdentifier(candidate.createdBy)
    || !isCanonicalTimestamp(candidate.updatedAt)
  ) throw new Error(`Resource-group update audit ${label} crossed its identity boundary`)
  return {
    groupId,
    tenantId,
    name: candidate.name,
    type: candidate.type,
    status: candidate.status,
    createdBy: candidate.createdBy,
    updatedAt: candidate.updatedAt
  }
}

function isUserGroupType(value: unknown): value is UserGroup["type"] {
  return ["department", "project", "team", "admin", "folderPolicy", "system", "custom"].includes(String(value))
}

function isFolderStatus(value: unknown): value is UserGroup["status"] {
  return value === "active" || value === "archived"
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!isCanonicalIdentifier(value)) throw new Error(`Resource-group update audit ${field} is invalid`)
}

function isCanonicalIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}
