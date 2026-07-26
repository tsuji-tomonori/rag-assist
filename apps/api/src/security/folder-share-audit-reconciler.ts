import { folderPolicyStateVersion, type FolderPolicyStore } from "../adapters/folder-policy-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type { FolderPolicy, FolderPolicyEntry } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"

/** Reconciles folder share audit state without repeating policy or cleanup mutations. */
export class FolderShareAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(
    private readonly policies: Pick<FolderPolicyStore, "getVersionedByFolderId">,
    private readonly objects?: ObjectStore
  ) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "folder" && draft.operation === "share.replace"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) {
      throw new Error("Folder share audit resolver does not support this intent")
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

    const current = await this.policies.getVersionedByFolderId(tenantId, targetId)
    if (current.version !== folderPolicyStateVersion(current.policy)) {
      throw new Error("Authoritative folder share policy version is invalid")
    }
    const authoritativeAfter = canonicalAuthoritativePolicy(current.policy, tenantId, targetId)

    if (intent.requestedCompletion) {
      const requestedAfter = canonicalStoredPolicy(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritativeAfter, requestedAfter)) {
        throw new Error("Authoritative folder share policy does not confirm the requested audit completion")
      }
      const proposedAfter = canonicalStoredPolicy(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
      if (intent.requestedCompletion.result === "success" && !sameJson(requestedAfter, proposedAfter)) {
        throw new Error("Successful folder share audit completion does not match the proposed state")
      }
      if (sameJson(requestedAfter, proposedAfter)) {
        const before = canonicalStoredPolicy(intent.draft.before, tenantId, targetId, "before state")
        await this.assertDurableCleanupRepair(intent, before, proposedAfter, current.policy, current.version)
      }
      return {
        result: intent.requestedCompletion.result,
        after: intent.requestedCompletion.after
      }
    }

    const proposedAfter = canonicalStoredPolicy(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
    if (sameJson(authoritativeAfter, proposedAfter)) {
      const before = canonicalStoredPolicy(intent.draft.before, tenantId, targetId, "before state")
      await this.assertDurableCleanupRepair(intent, before, proposedAfter, current.policy, current.version)
      return { result: "success", after: intent.draft.proposedAfter }
    }

    const before = canonicalStoredPolicy(intent.draft.before, tenantId, targetId, "before state")
    if (sameJson(authoritativeAfter, before)) {
      throw new Error("Pending folder share audit has no durable non-success result")
    }
    throw new Error("Authoritative folder share policy matches neither the before nor proposed audit state")
  }

  private async assertDurableCleanupRepair(
    intent: SecurityMutationAuditIntent,
    before: FolderPolicyAudit | null,
    after: FolderPolicyAudit | null,
    currentPolicy: FolderPolicy | undefined,
    authoritativeVersion: string
  ): Promise<void> {
    if (!before || !after) return
    const revocations = revokedEntries(before.entries, after.entries)
    if (revocations.length === 0) return
    if (!this.objects) throw new Error("Folder share audit cleanup repair store is not configured")
    const operationId = `folder-share:${intent.intentId}`
    const repair = await new ObjectStoreRevocationCleanupRepairOutbox(this.objects).get(
      intent.draft.tenantId,
      "folder",
      intent.draft.targetId,
      operationId
    )
    const knownTargets = repair?.cleanupRegistration.knownTargets ?? []
    const expectedBeforeVersion = currentPolicy ? folderPolicyStateVersion({
      ...currentPolicy,
      policyId: before.policyId,
      tenantId: before.tenantId,
      folderId: before.folderId,
      entries: before.entries.map((entry) => ({ ...entry })),
      updatedAt: before.updatedAt
    }) : undefined
    const expectedTargets = revocations.flatMap(({ entry, ceiling }) => {
      const principal = `${entry.principalType}:${entry.principalId}`
      const reference = `folder:${intent.draft.targetId}:principal:${principal}`
      return [
        { scope: "grant", reference: `${reference}:ceiling:${ceiling}` },
        { scope: "cache", reference },
        { scope: "session", reference: `${reference}/session` },
        { scope: "queued_run", reference }
      ]
    })
    if (
      !repair
      || repair.status === "abandoned"
      || repair.operationId !== operationId
      || repair.cleanupRegistration.operationId !== operationId
      || repair.cleanupRegistration.tenantId !== intent.draft.tenantId
      || repair.cleanupRegistration.resourceType !== "folder"
      || repair.cleanupRegistration.resourceId !== intent.draft.targetId
      || repair.expectedBeforeDenyVersion !== expectedBeforeVersion
      || repair.cleanupRegistration.authoritativeDenyVersion !== authoritativeVersion
      || expectedTargets.some((expected) => !knownTargets.some((actual) => (
        actual.scope === expected.scope && actual.reference === expected.reference
      )))
    ) throw new Error("Folder share audit has no durable cleanup repair for the authoritative deny")
  }
}

type FolderPolicyAuditEntry = Readonly<Pick<
  FolderPolicyEntry,
  "principalType" | "principalId" | "permissionLevel"
>>

type FolderPolicyAudit = Readonly<{
  policyId: string
  tenantId: string
  folderId: string
  entries: FolderPolicyAuditEntry[]
  updatedAt: string
}>

function canonicalAuthoritativePolicy(
  policy: FolderPolicy | undefined,
  tenantId: string,
  folderId: string
): FolderPolicyAudit | null {
  if (!policy) return null
  if (
    policy.tenantId !== tenantId
    || policy.folderId !== folderId
    || !isCanonicalIdentifier(policy.policyId)
    || !isCanonicalIdentifier(policy.createdBy)
    || !isCanonicalTimestamp(policy.createdAt)
    || !isCanonicalTimestamp(policy.updatedAt)
    || (policy.itemType !== undefined && policy.itemType !== "folderPolicy")
  ) throw new Error("Authoritative folder share policy crossed its identity boundary")
  return {
    policyId: policy.policyId,
    tenantId,
    folderId,
    entries: canonicalEntries(policy.entries, "authoritative policy"),
    updatedAt: policy.updatedAt
  }
}

function canonicalStoredPolicy(
  value: unknown,
  tenantId: string,
  folderId: string,
  label: string
): FolderPolicyAudit | null {
  if (value === null) return null
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Folder share audit ${label} is invalid`)
  }
  const candidate = value as Partial<FolderPolicyAudit>
  if (
    candidate.tenantId !== tenantId
    || candidate.folderId !== folderId
    || !isCanonicalIdentifier(candidate.policyId)
    || !isCanonicalTimestamp(candidate.updatedAt)
  ) throw new Error(`Folder share audit ${label} crossed its identity boundary`)
  return {
    policyId: candidate.policyId,
    tenantId,
    folderId,
    entries: canonicalEntries(candidate.entries, label),
    updatedAt: candidate.updatedAt
  }
}

function canonicalEntries(value: unknown, label: string): FolderPolicyAuditEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Folder share audit ${label} entries are invalid`)
  }
  const entries = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Folder share audit ${label} entries are invalid`)
    }
    const candidate = entry as Partial<FolderPolicyAuditEntry>
    if (
      (candidate.principalType !== "user" && candidate.principalType !== "group")
      || !isCanonicalIdentifier(candidate.principalId)
      || !["deny", "readOnly", "full"].includes(candidate.permissionLevel ?? "")
    ) throw new Error(`Folder share audit ${label} entries are invalid`)
    return {
      principalType: candidate.principalType,
      principalId: candidate.principalId,
      permissionLevel: candidate.permissionLevel!
    }
  }).sort(compareEntries)
  for (let index = 1; index < entries.length; index += 1) {
    if (samePrincipal(entries[index - 1]!, entries[index]!)) {
      throw new Error(`Folder share audit ${label} contains a duplicate principal`)
    }
  }
  return entries
}

function compareEntries(left: FolderPolicyAuditEntry, right: FolderPolicyAuditEntry): number {
  return `${left.principalType}\u0000${left.principalId}`
    .localeCompare(`${right.principalType}\u0000${right.principalId}`)
}

function samePrincipal(left: FolderPolicyAuditEntry, right: FolderPolicyAuditEntry): boolean {
  return left.principalType === right.principalType && left.principalId === right.principalId
}

function revokedEntries(
  before: readonly FolderPolicyAuditEntry[],
  after: readonly FolderPolicyAuditEntry[]
): Array<{ entry: FolderPolicyAuditEntry; ceiling: "none" | "readOnly" }> {
  const rank: Record<FolderPolicyEntry["permissionLevel"], number> = { deny: 0, readOnly: 1, full: 2 }
  const afterByPrincipal = new Map(after.map((entry) => [
    `${entry.principalType}\u0000${entry.principalId}`,
    entry.permissionLevel
  ]))
  return before.flatMap<{ entry: FolderPolicyAuditEntry; ceiling: "none" | "readOnly" }>((entry) => {
    if (entry.permissionLevel === "deny") return []
    const afterPermission = afterByPrincipal.get(`${entry.principalType}\u0000${entry.principalId}`) ?? "deny"
    if (rank[afterPermission] >= rank[entry.permissionLevel]) return []
    return [{ entry, ceiling: afterPermission === "readOnly" ? "readOnly" : "none" }]
  })
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!isCanonicalIdentifier(value)) throw new Error(`Folder share audit ${field} is invalid`)
}

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function isCanonicalTimestamp(value: string | undefined): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}
