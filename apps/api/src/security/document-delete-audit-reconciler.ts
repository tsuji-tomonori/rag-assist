import { createHash } from "node:crypto"
import type { ObjectStore } from "../adapters/object-store.js"
import type { Dependencies } from "../dependencies.js"
import { DOCUMENT_REVOCATION_POLICY_VERSION } from "../documents/document-lifecycle-mutation-coordinator.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  REVOCATION_CLEANUP_POLICY_VERSION,
  REVOCATION_CLEANUP_SCOPES,
  type RegisterRevocationCleanupInput,
  type RevocationCleanupManifest
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import {
  ObjectStoreRevocationCleanupRepairOutbox,
  type RevocationCleanupRepairIntent
} from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import { tenantManifestKey } from "../rag/_shared/storage/tenant-artifacts.js"
import type { DocumentManifest, JsonValue } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"

type ArtifactPolicy = Pick<Dependencies, "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">

export type DocumentDeleteAuditResolverDeps = ArtifactPolicy & Readonly<{
  objects: ObjectStore
}>

const statuses = new Set(["initialized", "prepared", "tombstoned", "cleanup_pending", "completed"])
const requestedSuccessStatuses = new Set(["tombstoned", "cleanup_pending", "completed"])
const deniedPurposes = ["normal_rag", "external_model", "logging", "evaluation"] as const

/** Reconciles deny-first document deletion without repeating tombstone or cleanup mutations. */
export class DocumentDeleteAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(private readonly deps: DocumentDeleteAuditResolverDeps) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "document" && draft.operation === "revoke.delete"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) throw new Error("Document delete audit resolver does not support this intent")
    const { tenantId, targetId } = intent.draft
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(targetId, "targetId")
    if (intent.draft.policyVersion !== DOCUMENT_REVOCATION_POLICY_VERSION) {
      throw new Error("Document delete audit policy version is invalid")
    }

    const rawLifecycle = await this.readLifecycle(tenantId, targetId)
    if (rawLifecycle === undefined) return this.resolvePreflightFailure(intent)
    const lifecycle = canonicalLifecycle(rawLifecycle, intent, this.manifestKey(tenantId, targetId))
    const requested = intent.requestedCompletion
    if (!requested) {
      if (lifecycle.status !== "completed") {
        throw new Error("Pending document delete audit has no durable completion evidence")
      }
      await this.assertCleanupSuccess(lifecycle)
      await this.assertAuthoritativeTombstone(lifecycle)
      return { result: "success", after: intent.draft.proposedAfter }
    }

    const requestedAfter = canonicalAuditValue(requested.after, tenantId, targetId, "requested completion")
    if (requested.result === "success") {
      if (!requestedSuccessStatuses.has(lifecycle.status) || !sameJson(requestedAfter, lifecycle.proposedAfter)) {
        throw new Error("Document delete success completion is not authoritatively converged")
      }
      await this.assertCleanupSuccess(lifecycle)
      await this.assertAuthoritativeTombstone(lifecycle)
      return { result: "success", after: requested.after }
    }

    if (requested.result !== "conflict" || lifecycle.status !== "prepared") {
      throw new Error("Document delete non-success completion is not authoritatively converged")
    }
    const current = await this.readCurrentManifest(tenantId, targetId)
    if (!current || !sameJson(auditValue(current), requestedAfter)) {
      throw new Error("Authoritative document does not confirm the requested delete conflict")
    }
    const registration = cleanupRegistration(lifecycle)
    const repair = await this.readRepair(lifecycle)
    if (
      !repair
      || repair.status !== "abandoned"
      || repair.expectedBeforeDenyVersion !== lifecycle.sourceManifestVersion
      || !sameJson(repair.cleanupRegistration, registration)
    ) throw new Error("Document delete conflict repair is not authoritatively abandoned")
    const cleanup = await this.readCleanup(lifecycle)
    if (cleanup) throw new Error("Document delete conflict unexpectedly has cleanup ledger evidence")
    return { result: "conflict", after: requested.after }
  }

  private async resolvePreflightFailure(
    intent: SecurityMutationAuditIntent
  ): Promise<SecurityMutationAuditAuthoritativeResolution> {
    const requested = intent.requestedCompletion
    if (!requested || (requested.result !== "denied" && requested.result !== "conflict")) {
      throw new Error("Document delete lifecycle evidence is unavailable")
    }
    const before = canonicalAuditValue(intent.draft.before, intent.draft.tenantId, intent.draft.targetId, "before state")
    const proposed = canonicalAuditValue(intent.draft.proposedAfter, intent.draft.tenantId, intent.draft.targetId, "proposed state")
    const requestedAfter = canonicalAuditValue(requested.after, intent.draft.tenantId, intent.draft.targetId, "requested completion")
    if (!sameJson(before, proposed) || !sameJson(before, requestedAfter)) {
      throw new Error("Document delete preflight failure does not preserve its before state")
    }
    const current = await this.readCurrentManifest(intent.draft.tenantId, intent.draft.targetId)
    if (!current || !sameJson(auditValue(current), before)) {
      throw new Error("Authoritative document does not confirm the requested delete preflight failure")
    }
    return { result: requested.result, after: requested.after }
  }

  private async assertCleanupSuccess(lifecycle: DeleteLifecycle): Promise<void> {
    const registration = cleanupRegistration(lifecycle)
    const repair = await this.readRepair(lifecycle)
    if (
      !repair
      || (repair.status !== "cleanup_registered" && repair.status !== "cleanup_completed")
      || repair.expectedBeforeDenyVersion !== lifecycle.sourceManifestVersion
      || !sameJson(repair.cleanupRegistration, registration)
    ) throw new Error("Document delete cleanup repair is not authoritatively registered")
    const cleanup = await this.readCleanup(lifecycle)
    if (!cleanup) throw new Error("Document delete cleanup ledger is unavailable")
    assertCleanupManifestRegistration(cleanup, registration)
  }

  private async assertAuthoritativeTombstone(lifecycle: DeleteLifecycle): Promise<void> {
    const current = await this.readCurrentManifest(lifecycle.tenantId, lifecycle.documentId)
    if (current) {
      if (!sameJson(current, lifecycle.tombstoneManifest)) {
        throw new Error("Authoritative document does not match the delete tombstone")
      }
      return
    }
    const cleanup = await this.readCleanup(lifecycle)
    if (!cleanup || !sourceCleanupWasCheckpointed(cleanup)) {
      throw new Error("Authoritative document delete tombstone is unavailable without a source cleanup checkpoint")
    }
  }

  private async readLifecycle(tenantId: string, documentId: string): Promise<unknown | undefined> {
    const key = `document-mutations/delete/${encodeURIComponent(tenantId)}/${encodeURIComponent(documentId)}.json`
    try {
      return JSON.parse(await this.deps.objects.getText(key)) as unknown
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw new Error("Document delete lifecycle state is unreadable", { cause: error })
    }
  }

  private async readCurrentManifest(tenantId: string, documentId: string): Promise<DocumentManifest | undefined> {
    const key = this.manifestKey(tenantId, documentId)
    try {
      return canonicalManifest(JSON.parse(await this.deps.objects.getText(key)), tenantId, documentId, key, "authoritative manifest")
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      if (error instanceof Error && error.message.startsWith("Document delete ")) throw error
      throw new Error("Authoritative document delete target is unreadable", { cause: error })
    }
  }

  private readRepair(lifecycle: DeleteLifecycle): Promise<RevocationCleanupRepairIntent | undefined> {
    return new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objects).get(
      lifecycle.tenantId,
      "document",
      lifecycle.documentId,
      lifecycle.operationId
    )
  }

  private readCleanup(lifecycle: DeleteLifecycle): Promise<RevocationCleanupManifest | undefined> {
    return new ObjectStoreRevocationCleanupCoordinator(this.deps.objects).get(lifecycle.tenantId, lifecycle.operationId)
  }

  private manifestKey(tenantId: string, documentId: string): string {
    return tenantManifestKey(this.deps, tenantId, documentId)
  }
}

type DeleteLifecycle = Readonly<{
  operationId: string
  status: string
  actorId: string
  tenantId: string
  documentId: string
  reason: string
  sourceManifestVersion: string
  sourceManifest: DocumentManifest
  tombstoneManifest: DocumentManifest
  proposedAfter: DeleteAuditValue
}>

type DeleteAuditValue = Readonly<{
  documentId: string
  tenantId: string
  lifecycleStatus: "active" | "superseded"
  folderIds: string[]
  updatedAt: string
}>

function canonicalLifecycle(value: unknown, intent: SecurityMutationAuditIntent, manifestKey: string): DeleteLifecycle {
  if (!isRecord(value)) throw new Error("Document delete lifecycle state is invalid")
  const { tenantId, targetId } = intent.draft
  const expectedFingerprint = createHash("sha256").update(JSON.stringify({
    documentId: targetId,
    sourceVersion: value.sourceManifestVersion,
    reason: intent.draft.reason
  })).digest("hex")
  if (
    value.schemaVersion !== 1
    || !isOperationId(value.operationId)
    || value.fingerprint !== expectedFingerprint
    || !statuses.has(String(value.status))
    || value.actorId !== intent.draft.actorId
    || value.tenantId !== tenantId
    || value.documentId !== targetId
    || value.reason !== intent.draft.reason
    || !isIdentifier(value.sourceManifestVersion)
    || value.auditIntentId !== intent.intentId
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || Date.parse(value.updatedAt) < Date.parse(value.createdAt)
    || (value.lastError !== undefined && !isIdentifier(value.lastError))
  ) throw new Error("Document delete lifecycle crossed its audit or identity boundary")

  const source = canonicalManifest(value.sourceManifest, tenantId, targetId, manifestKey, "lifecycle source manifest")
  const tombstone = canonicalManifest(value.tombstoneManifest, tenantId, targetId, manifestKey, "lifecycle tombstone manifest")
  const before = canonicalAuditValue(intent.draft.before, tenantId, targetId, "before state")
  const proposed = canonicalAuditValue(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
  if (!sameJson(before, auditValue(source)) || !sameJson(proposed, auditValue(tombstone))) {
    throw new Error("Document delete lifecycle does not match its audit draft")
  }
  if (before.lifecycleStatus !== "active" || proposed.lifecycleStatus !== "superseded") {
    throw new Error("Document delete lifecycle transition is invalid")
  }
  const expectedTombstone = revokedManifest(source, value.operationId, value.actorId, value.reason, value.createdAt)
  if (!sameJson(tombstone, expectedTombstone)) {
    throw new Error("Document delete lifecycle tombstone manifest is invalid")
  }
  return {
    operationId: value.operationId,
    status: String(value.status),
    actorId: value.actorId,
    tenantId,
    documentId: targetId,
    reason: value.reason,
    sourceManifestVersion: value.sourceManifestVersion,
    sourceManifest: source,
    tombstoneManifest: tombstone,
    proposedAfter: proposed
  }
}

function canonicalManifest(
  value: unknown,
  tenantId: string,
  documentId: string,
  manifestKey: string,
  label: string
): DocumentManifest {
  if (!isRecord(value)) throw new Error(`Document delete ${label} is invalid`)
  const metadata = isRecord(value.metadata) ? value.metadata : undefined
  const admission = isRecord(value.admission) ? value.admission : undefined
  if (
    value.documentId !== documentId
    || value.manifestObjectKey !== manifestKey
    || !isIdentifier(value.fileName)
    || !isIdentifier(value.sourceObjectKey)
    || !isIdentifierArray(value.vectorKeys)
    || !Number.isInteger(value.chunkCount)
    || Number(value.chunkCount) < 0
    || !Number.isInteger(value.memoryCardCount)
    || Number(value.memoryCardCount) < 0
    || !isTimestamp(value.createdAt)
    || !optionalTimestamp(value.updatedAt)
    || (metadata?.tenantId !== undefined && metadata.tenantId !== tenantId)
    || (admission?.tenantId !== undefined && admission.tenantId !== tenantId)
    || (metadata?.tenantId !== tenantId && admission?.tenantId !== tenantId)
  ) throw new Error(`Document delete ${label} crossed its tenant or resource boundary`)
  const manifest = value as DocumentManifest
  auditValue(manifest)
  return manifest
}

function auditValue(manifest: DocumentManifest): DeleteAuditValue {
  const tenant = typeof manifest.metadata?.tenantId === "string" ? manifest.metadata.tenantId : manifest.admission?.tenantId
  if (!isIdentifier(tenant)) throw new Error("Document delete manifest tenant is invalid")
  const lifecycleStatus = manifest.lifecycleStatus ?? "active"
  if (lifecycleStatus !== "active" && lifecycleStatus !== "superseded") {
    throw new Error("Document delete manifest lifecycle is invalid")
  }
  const updatedAt = manifest.updatedAt ?? manifest.createdAt
  if (!isTimestamp(updatedAt)) throw new Error("Document delete manifest timestamp is invalid")
  return {
    documentId: manifest.documentId,
    tenantId: tenant,
    lifecycleStatus,
    folderIds: manifestFolderIds(manifest),
    updatedAt
  }
}

function canonicalAuditValue(value: unknown, tenantId: string, documentId: string, label: string): DeleteAuditValue {
  if (
    !isRecord(value)
    || value.documentId !== documentId
    || value.tenantId !== tenantId
    || (value.lifecycleStatus !== "active" && value.lifecycleStatus !== "superseded")
    || !isIdentifierArray(value.folderIds)
    || !isTimestamp(value.updatedAt)
  ) throw new Error(`Document delete audit ${label} crossed its identity boundary`)
  return {
    documentId,
    tenantId,
    lifecycleStatus: value.lifecycleStatus,
    folderIds: [...value.folderIds],
    updatedAt: value.updatedAt
  }
}

function revokedManifest(
  source: DocumentManifest,
  operationId: string,
  actorId: string,
  reason: string,
  now: string
): DocumentManifest {
  return {
    ...source,
    lifecycleStatus: "superseded",
    metadata: {
      ...(source.metadata ?? {}),
      lifecycleStatus: "superseded",
      documentRevocation: { schemaVersion: 1, operationId, actorId, reason, tombstonedAt: now }
    },
    updatedAt: now
  }
}

function cleanupRegistration(lifecycle: DeleteLifecycle): RegisterRevocationCleanupInput & { operationId: string } {
  const manifest = lifecycle.sourceManifest
  const memoryVectorKeys = manifest.memoryVectorKeys ?? manifest.vectorKeys
  const evidenceVectorKeys = manifest.evidenceVectorKeys ?? manifest.vectorKeys
  const tombstonedAt = lifecycle.tombstoneManifest.updatedAt ?? lifecycle.tombstoneManifest.createdAt
  return {
    operationId: lifecycle.operationId,
    tenantId: lifecycle.tenantId,
    resourceType: "document",
    resourceId: lifecycle.documentId,
    trigger: "deleted",
    deniedPurposes,
    authoritativeDenyVersion: `document-revocation:${lifecycle.operationId}:${tombstonedAt}`,
    authoritativeDenyConfirmedAt: tombstonedAt,
    knownTargets: [
      { scope: "source", reference: manifest.sourceObjectKey },
      { scope: "source", reference: manifest.manifestObjectKey },
      ...(manifest.structuredBlocksObjectKey
        ? [{ scope: "chunk" as const, reference: manifest.structuredBlocksObjectKey }]
        : [{ scope: "chunk" as const, reference: `${lifecycle.documentId}:all` }]),
      ...(manifest.memoryCardsObjectKey ? [{ scope: "memory" as const, reference: manifest.memoryCardsObjectKey }] : []),
      ...memoryVectorKeys.map((reference) => ({ scope: "memory" as const, reference })),
      ...evidenceVectorKeys.map((reference) => ({ scope: "active_index" as const, reference })),
      ...(manifest.publicationFence?.stageNamespace
        ? [{ scope: "staged_index" as const, reference: manifest.publicationFence.stageNamespace }]
        : []),
      { scope: "old_index", reference: `document-${createHash("sha256").update(lifecycle.documentId).digest("hex")}` },
      { scope: "cache", reference: `document:${lifecycle.documentId}` },
      { scope: "grant", reference: `document:${lifecycle.documentId}` },
      { scope: "session", reference: `document:${lifecycle.documentId}/session` },
      { scope: "queued_run", reference: `document:${lifecycle.documentId}` },
      { scope: "evaluation_artifact", reference: `document:${lifecycle.documentId}` }
    ]
  }
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
    || manifest.authoritativeDeny.status !== "effective"
    || manifest.authoritativeDeny.version !== registration.authoritativeDenyVersion
    || manifest.authoritativeDeny.confirmedAt !== registration.authoritativeDenyConfirmedAt
    || manifest.status === "superseded"
    || manifest.scopes.length !== REVOCATION_CLEANUP_SCOPES.length
    || !REVOCATION_CLEANUP_SCOPES.every((scope) => manifest.scopes.filter((entry) => entry.scope === scope).length === 1)
  ) throw new Error("Document delete cleanup ledger identity is invalid")
  const targetIds = new Set(manifest.targets.map((target) => target.targetId))
  for (const target of registration.knownTargets ?? []) {
    const expectedTargetId = createHash("sha256").update(`${target.scope}\u0000${target.reference}`).digest("hex")
    if (!targetIds.has(expectedTargetId)) throw new Error("Document delete cleanup ledger is missing a registered target")
  }
}

function sourceCleanupWasCheckpointed(manifest: RevocationCleanupManifest): boolean {
  return manifest.targets.some((target) => target.scope === "source" && target.status === "cleaned")
    || Boolean(manifest.scopes.find((scope) => scope.scope === "source")?.discoveredAt)
}

function manifestFolderIds(manifest: DocumentManifest): string[] {
  const raw = manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId
  const values = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : []
  if (!isIdentifierArray(values)) throw new Error("Document delete manifest folder scope is invalid")
  return [...values]
}

function assertIdentifier(value: string, field: string): void {
  if (!isIdentifier(value)) throw new Error(`Document delete audit ${field} is invalid`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function isIdentifierArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isIdentifier) && new Set(value).size === value.length
}

function isOperationId(value: unknown): value is string {
  return typeof value === "string" && /^document_delete_[0-9a-f-]{36}$/u.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function optionalTimestamp(value: unknown): boolean {
  return value === undefined || isTimestamp(value)
}

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && (
    (error as NodeJS.ErrnoException).code === "ENOENT"
    || error.name === "NoSuchKey"
    || error.name === "NotFound"
  )
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right))
}

function sortJson(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson)
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, child]) => [key, sortJson(child)]
    ))
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  throw new Error("Document delete evidence is not canonical JSON")
}
