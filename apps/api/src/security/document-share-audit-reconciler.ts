import type { ObjectStore } from "../adapters/object-store.js"
import {
  documentShareGrantKey,
  documentSharePolicyStateVersion
} from "../documents/document-permission-service.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type { DocumentShareGrant } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"

const legacyGrantLedgerKey = "documents/share-grants.json"
const deniedPurposes = ["evaluation", "external_model", "logging", "normal_rag"] as const

/** Reconciles document share audit state without repeating grant or cleanup mutations. */
export class DocumentShareAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(private readonly objects: ObjectStore) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "document" && draft.operation === "share.replace"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) {
      throw new Error("Document share audit resolver does not support this intent")
    }
    const { tenantId, targetId } = intent.draft
    assertCanonicalIdentifier(tenantId, "tenantId")
    assertCanonicalIdentifier(targetId, "targetId")

    if (
      intent.requestedCompletion
      && intent.requestedCompletion.result !== "success"
      && isEmptyArray(intent.draft.before)
      && isEmptyArray(intent.requestedCompletion.after)
    ) {
      return { result: intent.requestedCompletion.result, after: intent.requestedCompletion.after }
    }

    const current = await readAuthoritativeGrants(this.objects, tenantId, targetId)
    const authoritativeAfter = auditGrants(current.grants)
    const authoritativeSemantic = semanticGrants(current.grants)
    const proposed = canonicalSemanticGrants(intent.draft.proposedAfter, "proposed state")

    if (intent.requestedCompletion) {
      const requestedAfter = canonicalAuditGrants(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(authoritativeAfter, requestedAfter)) {
        throw new Error("Authoritative document share grants do not confirm the requested audit completion")
      }
      if (intent.requestedCompletion.result === "success" && !sameJson(authoritativeSemantic, proposed)) {
        throw new Error("Successful document share audit completion does not match the proposed state")
      }
      if (sameJson(authoritativeSemantic, proposed)) {
        const before = canonicalAuditGrants(intent.draft.before, tenantId, targetId, "before state")
        await this.assertDurableCleanupRepair(intent, before, proposed, current.version)
      }
      return {
        result: intent.requestedCompletion.result,
        after: intent.requestedCompletion.after
      }
    }

    if (sameJson(authoritativeSemantic, proposed)) {
      const before = canonicalAuditGrants(intent.draft.before, tenantId, targetId, "before state")
      await this.assertDurableCleanupRepair(intent, before, proposed, current.version)
      return { result: "success", after: authoritativeAfter }
    }

    const before = canonicalAuditGrants(intent.draft.before, tenantId, targetId, "before state")
    if (sameJson(authoritativeAfter, before)) {
      throw new Error("Pending document share audit has no durable non-success result")
    }
    throw new Error("Authoritative document share grants match neither the before nor proposed audit state")
  }

  private async assertDurableCleanupRepair(
    intent: SecurityMutationAuditIntent,
    before: DocumentShareAuditGrant[],
    after: DocumentShareSemanticGrant[],
    authoritativeVersion: string
  ): Promise<void> {
    const revocations = revokedGrants(before, after)
    if (revocations.length === 0) return
    const operationId = `document-share:${intent.intentId}`
    const repair = await new ObjectStoreRevocationCleanupRepairOutbox(this.objects).get(
      intent.draft.tenantId,
      "document",
      intent.draft.targetId,
      operationId
    )
    if (!repair) {
      if (revocations.some(({ grant }) => grant.principalType === "group")) {
        throw new Error("Document share audit has no durable cleanup repair for a group revocation")
      }
      return
    }

    const registration = repair.cleanupRegistration
    const purposes = [...(registration.deniedPurposes ?? [])].sort()
    const actualTargets = registration.knownTargets ?? []
    const actualTargetKeys = actualTargets.map(targetKey)
    const expectedByPrincipal = new Map(revocations.map(({ grant, ceiling }) => {
      const principalKey = `${grant.principalType}:${grant.principalId}`
      return [principalKey, cleanupTargets(intent.draft.targetId, grant, ceiling).map(targetKey)] as const
    }))
    const allowedTargetKeys = new Set([...expectedByPrincipal.values()].flat())
    const duplicateTargets = new Set(actualTargetKeys).size !== actualTargetKeys.length
    const targetOutsideRevocation = actualTargetKeys.some((target) => !allowedTargetKeys.has(target))
    let selectedPrincipalCount = 0
    let incompletePrincipal = false
    let missingGroupPrincipal = false
    for (const { grant } of revocations) {
      const { principalType, principalId } = grant
      const expectedTargets = expectedByPrincipal.get(`${principalType}:${principalId}`)!
      const selectedCount = expectedTargets.filter((target) => actualTargetKeys.includes(target)).length
      if (selectedCount > 0) selectedPrincipalCount += 1
      if (selectedCount !== 0 && selectedCount !== expectedTargets.length) incompletePrincipal = true
      if (principalType === "group" && selectedCount !== expectedTargets.length) missingGroupPrincipal = true
      assertCanonicalIdentifier(principalId, "cleanup principalId")
    }

    if (
      repair.status === "abandoned"
      || repair.operationId !== operationId
      || registration.operationId !== operationId
      || registration.tenantId !== intent.draft.tenantId
      || registration.resourceType !== "document"
      || registration.resourceId !== intent.draft.targetId
      || registration.trigger !== "share_revoked"
      || !isCanonicalIdentifier(repair.expectedBeforeDenyVersion)
      || registration.authoritativeDenyVersion !== authoritativeVersion
      || !sameJson(purposes, deniedPurposes)
      || duplicateTargets
      || targetOutsideRevocation
      || incompletePrincipal
      || missingGroupPrincipal
      || selectedPrincipalCount === 0
    ) throw new Error("Document share audit cleanup repair does not match the authoritative deny")
  }
}

type DocumentShareSemanticGrant = Readonly<{
  principalType: DocumentShareGrant["principalType"]
  principalId: string
  permissionLevel: DocumentShareGrant["permissionLevel"]
}>

type DocumentShareAuditGrant = DocumentShareSemanticGrant & Readonly<{
  tenantId: string
  documentId: string
  updatedAt: string
}>

async function readAuthoritativeGrants(
  objects: ObjectStore,
  tenantId: string,
  documentId: string
): Promise<{ grants: DocumentShareGrant[]; version: string }> {
  const current = await readJson(objects, documentShareGrantKey(tenantId, documentId))
  if (current !== undefined) {
    const grants = canonicalAuthoritativeGrantFile(current, tenantId, documentId)
    return { grants, version: documentSharePolicyStateVersion(grants) }
  }
  const legacy = await readJson(objects, legacyGrantLedgerKey)
  if (legacy === undefined) {
    return { grants: [], version: documentSharePolicyStateVersion([]) }
  }
  if (!isRecord(legacy) || legacy.schemaVersion !== 1 || !Array.isArray(legacy.grants)) {
    throw new Error("Authoritative legacy document share ledger is invalid")
  }
  const matching = legacy.grants.filter((value) => (
    isRecord(value) && value.tenantId === tenantId && value.documentId === documentId
  ))
  const grants = canonicalAuthoritativeGrants(matching, tenantId, documentId, "legacy ledger")
  return { grants, version: documentSharePolicyStateVersion(grants) }
}

function canonicalAuthoritativeGrantFile(
  value: unknown,
  tenantId: string,
  documentId: string
): DocumentShareGrant[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.grants)) {
    throw new Error("Authoritative document share grant file is invalid")
  }
  return canonicalAuthoritativeGrants(value.grants, tenantId, documentId, "grant file")
}

function canonicalAuthoritativeGrants(
  value: unknown[],
  tenantId: string,
  documentId: string,
  label: string
): DocumentShareGrant[] {
  const grants = value.map((item) => {
    if (
      !isRecord(item)
      || !isCanonicalIdentifier(item.documentShareGrantId)
      || (item.itemType !== undefined && item.itemType !== "documentShareGrant")
      || item.tenantId !== tenantId
      || item.documentId !== documentId
      || !isPrincipalType(item.principalType)
      || !isCanonicalIdentifier(item.principalId)
      || !isPermissionLevel(item.permissionLevel)
      || !isCanonicalIdentifier(item.createdBy)
      || typeof item.reason !== "string"
      || item.reason.trim().length === 0
      || !isCanonicalTimestamp(item.createdAt)
      || !isCanonicalTimestamp(item.updatedAt)
    ) throw new Error(`Authoritative document share ${label} crossed its identity boundary`)
    return item as DocumentShareGrant
  }).sort(compareGrants)
  assertNoDuplicatePrincipals(grants, `authoritative ${label}`)
  return grants
}

function canonicalAuditGrants(
  value: unknown,
  tenantId: string,
  documentId: string,
  label: string
): DocumentShareAuditGrant[] {
  if (!Array.isArray(value)) throw new Error(`Document share audit ${label} is invalid`)
  const grants = value.map((item) => {
    if (
      !isRecord(item)
      || item.tenantId !== tenantId
      || item.documentId !== documentId
      || !isPrincipalType(item.principalType)
      || !isCanonicalIdentifier(item.principalId)
      || !isPermissionLevel(item.permissionLevel)
      || !isCanonicalTimestamp(item.updatedAt)
    ) throw new Error(`Document share audit ${label} crossed its identity boundary`)
    return {
      tenantId,
      documentId,
      principalType: item.principalType,
      principalId: item.principalId,
      permissionLevel: item.permissionLevel,
      updatedAt: item.updatedAt
    }
  }).sort(compareGrants)
  assertNoDuplicatePrincipals(grants, label)
  return grants
}

function canonicalSemanticGrants(value: unknown, label: string): DocumentShareSemanticGrant[] {
  if (!Array.isArray(value)) throw new Error(`Document share audit ${label} is invalid`)
  const grants = value.map((item) => {
    if (
      !isRecord(item)
      || !isPrincipalType(item.principalType)
      || !isCanonicalIdentifier(item.principalId)
      || !isPermissionLevel(item.permissionLevel)
    ) throw new Error(`Document share audit ${label} grants are invalid`)
    return {
      principalType: item.principalType,
      principalId: item.principalId,
      permissionLevel: item.permissionLevel
    }
  }).sort(compareGrants)
  assertNoDuplicatePrincipals(grants, label)
  return grants
}

function auditGrants(grants: readonly DocumentShareGrant[]): DocumentShareAuditGrant[] {
  return grants.map((grant) => ({
    tenantId: grant.tenantId,
    documentId: grant.documentId,
    principalType: grant.principalType,
    principalId: grant.principalId,
    permissionLevel: grant.permissionLevel,
    updatedAt: grant.updatedAt
  }))
}

function semanticGrants(grants: readonly DocumentShareGrant[]): DocumentShareSemanticGrant[] {
  return grants.map((grant) => ({
    principalType: grant.principalType,
    principalId: grant.principalId,
    permissionLevel: grant.permissionLevel
  }))
}

function revokedGrants(
  before: readonly DocumentShareAuditGrant[],
  after: readonly DocumentShareSemanticGrant[]
): Array<{ grant: DocumentShareAuditGrant; ceiling: "none" | "readOnly" }> {
  const rank: Record<DocumentShareGrant["permissionLevel"], number> = { deny: 0, readOnly: 1, full: 2 }
  const afterByPrincipal = new Map(after.map((grant) => [
    `${grant.principalType}:${grant.principalId}`,
    grant.permissionLevel
  ]))
  return before.flatMap<{ grant: DocumentShareAuditGrant; ceiling: "none" | "readOnly" }>((grant) => {
    if (grant.permissionLevel === "deny") return []
    const afterPermission = afterByPrincipal.get(`${grant.principalType}:${grant.principalId}`) ?? "deny"
    if (rank[afterPermission] >= rank[grant.permissionLevel]) return []
    return [{ grant, ceiling: afterPermission === "readOnly" ? "readOnly" : "none" }]
  })
}

function cleanupTargets(
  documentId: string,
  grant: DocumentShareSemanticGrant,
  ceiling: "none" | "readOnly"
) {
  const principal = `${grant.principalType}:${grant.principalId}`
  const reference = `document:${documentId}:principal:${principal}`
  return [
    { scope: "grant", reference: `${reference}:ceiling:${ceiling}` },
    { scope: "cache", reference },
    { scope: "session", reference: `${reference}/session` },
    { scope: "queued_run", reference }
  ] as const
}

function targetKey(target: { scope: string; reference: string }): string {
  return `${target.scope}\u0000${target.reference}`
}

function compareGrants(
  left: Pick<DocumentShareGrant, "principalType" | "principalId">,
  right: Pick<DocumentShareGrant, "principalType" | "principalId">
): number {
  return `${left.principalType}\u0000${left.principalId}`
    .localeCompare(`${right.principalType}\u0000${right.principalId}`)
}

function assertNoDuplicatePrincipals(
  grants: readonly Pick<DocumentShareGrant, "principalType" | "principalId">[],
  label: string
): void {
  for (let index = 1; index < grants.length; index += 1) {
    const left = grants[index - 1]!
    const right = grants[index]!
    if (left.principalType === right.principalType && left.principalId === right.principalId) {
      throw new Error(`Document share audit ${label} contains a duplicate principal`)
    }
  }
}

async function readJson(objects: ObjectStore, key: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await objects.getText(key)) as unknown
  } catch (error) {
    if (isMissingObjectError(error)) return undefined
    throw error
  }
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as {
    code?: string
    name?: string
    $metadata?: { httpStatusCode?: number }
  }
  return candidate.code === "ENOENT"
    || candidate.code === "NoSuchKey"
    || candidate.name === "NoSuchKey"
    || candidate.name === "NotFound"
    || candidate.$metadata?.httpStatusCode === 404
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isPrincipalType(value: unknown): value is DocumentShareGrant["principalType"] {
  return value === "user" || value === "group"
}

function isPermissionLevel(value: unknown): value is DocumentShareGrant["permissionLevel"] {
  return value === "deny" || value === "readOnly" || value === "full"
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!isCanonicalIdentifier(value)) throw new Error(`Document share audit ${field} is invalid`)
}

function isCanonicalIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
