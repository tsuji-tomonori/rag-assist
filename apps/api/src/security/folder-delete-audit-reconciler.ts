import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import type { DocumentGroup } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"

const folderArchivePolicyVersion = "folder-archive-policy-v1"

/** Reconciles an empty-folder archive audit without repeating any domain mutation. */
export class FolderDeleteAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(private readonly groups: Pick<DocumentGroupStore, "get">) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "folder" && draft.operation === "delete"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) throw new Error("Folder delete audit resolver does not support this intent")
    const { tenantId, targetId } = intent.draft
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(targetId, "targetId")
    if (intent.draft.policyVersion !== folderArchivePolicyVersion) {
      throw new Error("Folder delete audit policy version is invalid")
    }

    if (
      intent.requestedCompletion
      && intent.requestedCompletion.result !== "success"
      && intent.draft.before === null
      && intent.requestedCompletion.after === null
    ) {
      canonicalEarlyProposal(intent.draft.proposedAfter, targetId)
      return { result: intent.requestedCompletion.result, after: null }
    }

    const before = canonicalAuditFolder(intent.draft.before, tenantId, targetId, "before state")
    const proposed = canonicalAuditFolder(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
    assertArchiveTransition(before, proposed)

    const current = await this.groups.get(tenantId, targetId)
    if (!current) throw new Error("Authoritative folder delete target is unavailable")
    const authoritative = canonicalAuthoritativeFolder(current, tenantId, targetId)

    if (intent.requestedCompletion) {
      const requested = canonicalAuditFolder(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritative, requested)) {
        throw new Error("Authoritative folder does not confirm the requested delete audit completion")
      }
      const expected = intent.requestedCompletion.result === "success" ? proposed : before
      if (!sameJson(requested, expected)) {
        throw new Error("Folder delete requested result does not match its authoritative state")
      }
      return {
        result: intent.requestedCompletion.result,
        after: intent.requestedCompletion.after
      }
    }

    if (sameJson(authoritative, proposed)) return { result: "success", after: intent.draft.proposedAfter }
    if (sameJson(authoritative, before)) {
      throw new Error("Pending folder delete audit has no durable non-success result")
    }
    throw new Error("Authoritative folder matches neither the before nor proposed delete audit state")
  }
}

type FolderDeleteAudit = Readonly<{
  groupId: string
  tenantId: string
  parentGroupId: string | null
  canonicalPath: string | null
  status: "active" | "archived"
  updatedAt: string
}>

function canonicalAuthoritativeFolder(
  folder: DocumentGroup,
  tenantId: string,
  folderId: string
): FolderDeleteAudit {
  if (
    folder.groupId !== folderId
    || folder.tenantId !== tenantId
    || (folder.itemType !== undefined && folder.itemType !== "documentGroup")
  ) throw new Error("Authoritative folder delete state crossed its identity boundary")
  return canonicalAuditFolder({
    groupId: folder.groupId,
    tenantId: folder.tenantId,
    parentGroupId: folder.parentGroupId ?? null,
    canonicalPath: folder.canonicalPath ?? null,
    status: folder.status ?? "active",
    updatedAt: folder.updatedAt
  }, tenantId, folderId, "authoritative state")
}

function canonicalAuditFolder(
  value: unknown,
  tenantId: string,
  folderId: string,
  label: string
): FolderDeleteAudit {
  if (!isRecord(value)) throw new Error(`Folder delete audit ${label} is invalid`)
  if (
    value.groupId !== folderId
    || value.tenantId !== tenantId
    || !isNullableIdentifier(value.parentGroupId)
    || !isNullableCanonicalPath(value.canonicalPath)
    || (value.status !== "active" && value.status !== "archived")
    || !isCanonicalTimestamp(value.updatedAt)
  ) throw new Error(`Folder delete audit ${label} crossed its identity boundary`)
  return {
    groupId: folderId,
    tenantId,
    parentGroupId: value.parentGroupId,
    canonicalPath: value.canonicalPath,
    status: value.status,
    updatedAt: value.updatedAt
  }
}

function assertArchiveTransition(before: FolderDeleteAudit, proposed: FolderDeleteAudit): void {
  if (
    before.status !== "active"
    || proposed.status !== "archived"
    || before.groupId !== proposed.groupId
    || before.tenantId !== proposed.tenantId
    || before.parentGroupId !== proposed.parentGroupId
    || before.canonicalPath !== proposed.canonicalPath
    || Date.parse(proposed.updatedAt) < Date.parse(before.updatedAt)
  ) throw new Error("Folder delete audit transition is invalid")
}

function canonicalEarlyProposal(value: unknown, folderId: string): void {
  if (
    !isRecord(value)
    || value.folderId !== folderId
    || !isIdentifier(value.expectedVersion)
    || value.requestedStatus !== "archived"
  ) throw new Error("Folder delete early audit proposal is invalid")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value)
}

function isNullableCanonicalPath(value: unknown): value is string | null {
  return value === null || (isIdentifier(value) && value.startsWith("/"))
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertIdentifier(value: string, field: string): void {
  if (!isIdentifier(value)) throw new Error(`Folder delete audit ${field} is invalid`)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}
