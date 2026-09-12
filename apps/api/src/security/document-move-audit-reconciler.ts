import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import type { FolderPolicyStore } from "../adapters/folder-policy-store.js"
import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import { DOCUMENT_MOVE_POLICY_VERSION } from "../documents/document-lifecycle-mutation-coordinator.js"
import { DocumentPermissionService } from "../documents/document-permission-service.js"
import { FolderPermissionService } from "../folders/folder-permission-service.js"
import { tenantManifestKey } from "../rag/_shared/storage/tenant-artifacts.js"
import type { DocumentManifest, JsonValue } from "../types.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent,
  SecurityMutationResult
} from "./security-mutation-audit-outbox.js"

type ArtifactPolicy = Pick<Dependencies, "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">

export type DocumentMoveAuditResolverDeps = ArtifactPolicy & Readonly<{
  objects: ObjectStore
  groups: DocumentGroupStore
  policies: FolderPolicyStore
  userGroups: UserGroupStore
  memberships: GroupMembershipStore
  identities: Pick<VerifiedIdentityProvider, "getCurrentIdentityBySubject">
}>

const statuses = new Set([
  "initialized",
  "prepared",
  "projections_staging",
  "projections_staged",
  "manifest_committed",
  "rollback_pending",
  "rolled_back",
  "completed"
])
const successCompletionStatuses = new Set(["manifest_committed", "rollback_pending", "completed"])
const nonSuccessCompletionStatuses = new Set(["projections_staged", "rollback_pending", "rolled_back"])
const nonSuccessResults = new Set<SecurityMutationResult>(["denied", "failed", "conflict"])

/** Reconciles a document move audit without repeating manifest or projection mutations. */
export class DocumentMoveAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  private readonly documentPermissions: DocumentPermissionService
  private readonly folderPermissions: FolderPermissionService

  constructor(private readonly deps: DocumentMoveAuditResolverDeps) {
    const permissionDeps = {
      objectStore: deps.objects,
      documentGroupStore: deps.groups,
      folderPolicyStore: deps.policies,
      userGroupStore: deps.userGroups,
      groupMembershipStore: deps.memberships
    }
    this.documentPermissions = new DocumentPermissionService(permissionDeps)
    this.folderPermissions = new FolderPermissionService(permissionDeps)
  }

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "document" && draft.operation === "move"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) throw new Error("Document move audit resolver does not support this intent")
    const { tenantId, targetId } = intent.draft
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(targetId, "targetId")
    if (intent.draft.policyVersion !== DOCUMENT_MOVE_POLICY_VERSION) {
      throw new Error("Document move audit policy version is invalid")
    }

    const rawLifecycle = await this.readLifecycle(tenantId, targetId)
    if (rawLifecycle === undefined) return this.resolvePreflightFailure(intent)
    const lifecycle = canonicalLifecycle(rawLifecycle, intent, this.manifestKey(tenantId, targetId))
    const requested = intent.requestedCompletion
    if (!requested) {
      if (lifecycle.status !== "completed") {
        throw new Error("Pending document move audit has no durable completion evidence")
      }
      const current = await this.readCurrentManifest(tenantId, targetId)
      if (!sameJson(current, lifecycle.targetManifest)) {
        throw new Error("Completed document move lifecycle does not match the authoritative target manifest")
      }
      await this.assertCurrentAuthorization(intent, lifecycle)
      return { result: "success", after: intent.draft.proposedAfter }
    }

    const current = await this.readCurrentManifest(tenantId, targetId)
    const requestedAfter = canonicalAuditValue(requested.after, tenantId, targetId, "requested completion")
    const currentAfter = auditValue(current)
    if (!sameJson(currentAfter, requestedAfter)) {
      throw new Error("Authoritative document manifest does not confirm the requested move completion")
    }

    if (requested.result === "success") {
      if (!successCompletionStatuses.has(lifecycle.status)) {
        throw new Error("Document move success completion is not in a converged lifecycle state")
      }
      if (!sameJson(current, lifecycle.targetManifest) || !sameJson(requestedAfter, lifecycle.proposedAfter)) {
        throw new Error("Document move success completion does not match the authoritative target manifest")
      }
      await this.assertCurrentAuthorization(intent, lifecycle)
      return { result: "success", after: requested.after }
    }

    if (
      !nonSuccessResults.has(requested.result)
      || !nonSuccessCompletionStatuses.has(lifecycle.status)
      || lifecycle.failureResult !== requested.result
    ) throw new Error("Document move non-success completion is not authoritatively converged")
    return { result: requested.result, after: requested.after }
  }

  private async resolvePreflightFailure(
    intent: SecurityMutationAuditIntent
  ): Promise<SecurityMutationAuditAuthoritativeResolution> {
    const requested = intent.requestedCompletion
    if (!requested || !nonSuccessResults.has(requested.result)) {
      throw new Error("Document move lifecycle evidence is unavailable")
    }
    canonicalEarlyProposal(intent.draft.proposedAfter, intent.draft.targetId)
    if (intent.draft.before === null && requested.after === null) {
      return { result: requested.result, after: null }
    }
    const before = canonicalAuditValue(
      intent.draft.before,
      intent.draft.tenantId,
      intent.draft.targetId,
      "before state"
    )
    const requestedAfter = canonicalAuditValue(
      requested.after,
      intent.draft.tenantId,
      intent.draft.targetId,
      "requested completion"
    )
    if (!sameJson(before, requestedAfter)) {
      throw new Error("Document move preflight failure does not preserve its before state")
    }
    const current = await this.readCurrentManifest(intent.draft.tenantId, intent.draft.targetId)
    if (!sameJson(auditValue(current), before)) {
      throw new Error("Authoritative document does not confirm the requested preflight failure")
    }
    return { result: requested.result, after: requested.after }
  }

  private async assertCurrentAuthorization(intent: SecurityMutationAuditIntent, lifecycle: MoveLifecycle): Promise<void> {
    let identity: ServerManagedIdentity | undefined
    try {
      identity = await this.deps.identities.getCurrentIdentityBySubject(lifecycle.actorId)
    } catch (error) {
      throw new Error("Authoritative document move actor is unavailable", { cause: error })
    }
    const actor = currentActor(identity, lifecycle.tenantId, lifecycle.actorId)
    if (intent.draft.actorId !== actor.userId || !hasPermission(actor, "rag:doc:move")) {
      throw new Error("Current document move actor is not authorized")
    }
    if ((await this.documentPermissions.resolveEffectiveDocumentPermissionDecision(
      actor,
      lifecycle.sourceManifest
    )).permission !== "full") {
      throw new Error("Current document move actor lacks full source permission")
    }
    const destinationId = lifecycle.proposedAfter.folderIds[0] as string
    const destination = await this.deps.groups.get(lifecycle.tenantId, destinationId)
    if (!destination || destination.tenantId !== lifecycle.tenantId || destination.status !== "active") {
      throw new Error("Current document move destination is unavailable")
    }
    if ((await this.folderPermissions.resolveEffectiveFolderPermissionDecision(actor, destinationId)).permission !== "full") {
      throw new Error("Current document move actor lacks full destination permission")
    }
  }

  private async readLifecycle(tenantId: string, documentId: string): Promise<unknown | undefined> {
    const key = `document-mutations/move/${encodeURIComponent(tenantId)}/${encodeURIComponent(documentId)}.json`
    try {
      return JSON.parse(await this.deps.objects.getText(key)) as unknown
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw new Error("Document move lifecycle state is unreadable", { cause: error })
    }
  }

  private async readCurrentManifest(tenantId: string, documentId: string): Promise<DocumentManifest> {
    const key = this.manifestKey(tenantId, documentId)
    try {
      const value = JSON.parse(await this.deps.objects.getText(key)) as unknown
      return canonicalManifest(value, tenantId, documentId, key, "authoritative manifest")
    } catch (error) {
      if (isMissingObjectError(error)) throw new Error("Authoritative document move target is unavailable", { cause: error })
      if (error instanceof Error && error.message.startsWith("Document move ")) throw error
      throw new Error("Authoritative document move target is unreadable", { cause: error })
    }
  }

  private manifestKey(tenantId: string, documentId: string): string {
    return tenantManifestKey(this.deps, tenantId, documentId)
  }
}

type MoveLifecycle = Readonly<{
  operationId: string
  status: string
  actorId: string
  tenantId: string
  documentId: string
  sourceManifest: DocumentManifest
  targetManifest: DocumentManifest
  proposedAfter: MoveAuditValue
  failureResult?: SecurityMutationResult
}>

type MoveAuditValue = Readonly<{
  documentId: string
  tenantId: string
  fileName: string
  folderIds: string[]
  lifecycleStatus: "active"
  updatedAt: string
}>

function canonicalLifecycle(
  value: unknown,
  intent: SecurityMutationAuditIntent,
  manifestKey: string
): MoveLifecycle {
  if (!isRecord(value)) throw new Error("Document move lifecycle state is invalid")
  const { tenantId, targetId } = intent.draft
  if (
    value.schemaVersion !== 1
    || !isOperationId(value.operationId)
    || !isHash(value.fingerprint)
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
    || (value.failureResult !== undefined && !nonSuccessResults.has(value.failureResult as SecurityMutationResult))
  ) throw new Error("Document move lifecycle crossed its audit or identity boundary")

  const source = canonicalManifest(value.sourceManifest, tenantId, targetId, manifestKey, "lifecycle source manifest")
  const target = canonicalManifest(value.targetManifest, tenantId, targetId, manifestKey, "lifecycle target manifest")
  const before = canonicalMoveShape(value.before, "before")
  const after = canonicalMoveShape(value.after, "after")
  const beforeAudit = canonicalAuditValue(intent.draft.before, tenantId, targetId, "before state")
  const proposed = canonicalAuditValue(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
  const sourceAudit = auditValue(source)
  const targetAudit = auditValue(target)
  if (
    !sameJson(beforeAudit, sourceAudit)
    || !sameJson(proposed, targetAudit)
    || !sameJson(before, { folderIds: sourceAudit.folderIds, fileName: sourceAudit.fileName })
    || !sameJson(after, { folderIds: targetAudit.folderIds, fileName: targetAudit.fileName })
  ) throw new Error("Document move lifecycle does not match its audit draft")
  if (
    sourceAudit.lifecycleStatus !== "active"
    || targetAudit.lifecycleStatus !== "active"
    || after.folderIds.length !== 1
    || targetAudit.updatedAt !== value.createdAt
    || Date.parse(targetAudit.updatedAt) < Date.parse(sourceAudit.updatedAt)
  ) throw new Error("Document move lifecycle transition is invalid")

  const expectedTarget = movedManifest(source, value.operationId, after.folderIds[0] as string, after.fileName, value.createdAt)
  if (!sameJson(target, expectedTarget)) {
    throw new Error("Document move lifecycle target manifest is invalid")
  }
  return {
    operationId: value.operationId,
    status: String(value.status),
    actorId: value.actorId as string,
    tenantId,
    documentId: targetId,
    sourceManifest: source,
    targetManifest: target,
    proposedAfter: proposed,
    ...(value.failureResult === undefined ? {} : { failureResult: value.failureResult as SecurityMutationResult })
  }
}

function canonicalManifest(
  value: unknown,
  tenantId: string,
  documentId: string,
  manifestKey: string,
  label: string
): DocumentManifest {
  if (!isRecord(value)) throw new Error(`Document move ${label} is invalid`)
  const metadata = isRecord(value.metadata) ? value.metadata : undefined
  const admission = isRecord(value.admission) ? value.admission : undefined
  const metadataTenant = metadata?.tenantId
  const admissionTenant = admission?.tenantId
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
    || (metadataTenant !== undefined && metadataTenant !== tenantId)
    || (admissionTenant !== undefined && admissionTenant !== tenantId)
    || (metadataTenant !== tenantId && admissionTenant !== tenantId)
  ) throw new Error(`Document move ${label} crossed its tenant or resource boundary`)
  const manifest = value as DocumentManifest
  auditValue(manifest)
  return manifest
}

function auditValue(manifest: DocumentManifest): MoveAuditValue {
  const metadataTenant = manifest.metadata?.tenantId
  const admissionTenant = manifest.admission?.tenantId
  const tenantId = typeof metadataTenant === "string" ? metadataTenant : admissionTenant
  if (!isIdentifier(tenantId)) throw new Error("Document move manifest tenant is invalid")
  const lifecycleStatus = manifest.lifecycleStatus ?? "active"
  if (lifecycleStatus !== "active") throw new Error("Document move manifest lifecycle is invalid")
  const updatedAt = manifest.updatedAt ?? manifest.createdAt
  if (!isTimestamp(updatedAt)) throw new Error("Document move manifest timestamp is invalid")
  return {
    documentId: manifest.documentId,
    tenantId,
    fileName: manifest.fileName,
    folderIds: manifestFolderIds(manifest),
    lifecycleStatus,
    updatedAt
  }
}

function canonicalAuditValue(value: unknown, tenantId: string, documentId: string, label: string): MoveAuditValue {
  if (!isRecord(value)
    || value.documentId !== documentId
    || value.tenantId !== tenantId
    || !isIdentifier(value.fileName)
    || !isIdentifierArray(value.folderIds)
    || value.lifecycleStatus !== "active"
    || !isTimestamp(value.updatedAt)) {
    throw new Error(`Document move audit ${label} crossed its identity boundary`)
  }
  return {
    documentId,
    tenantId,
    fileName: value.fileName,
    folderIds: [...value.folderIds],
    lifecycleStatus: "active",
    updatedAt: value.updatedAt
  }
}

function canonicalMoveShape(value: unknown, label: string): { folderIds: string[]; fileName: string } {
  if (!isRecord(value) || !isIdentifierArray(value.folderIds) || !isIdentifier(value.fileName)) {
    throw new Error(`Document move lifecycle ${label} state is invalid`)
  }
  return { folderIds: [...value.folderIds], fileName: value.fileName }
}

function canonicalEarlyProposal(value: unknown, documentId: string): void {
  if (!isRecord(value)
    || value.documentId !== documentId
    || !isIdentifier(value.destinationFolderId)
    || !(value.newTitle === null || isIdentifier(value.newTitle))
    || !(value.expectedUpdatedAt === null || isTimestamp(value.expectedUpdatedAt))) {
    throw new Error("Document move early audit proposal is invalid")
  }
}

function movedManifest(
  source: DocumentManifest,
  operationId: string,
  destinationFolderId: string,
  fileName: string,
  now: string
): DocumentManifest {
  return {
    ...source,
    fileName,
    lifecycleStatus: "active",
    metadata: {
      ...(source.metadata ?? {}),
      scopeType: "group",
      groupId: destinationFolderId,
      folderId: destinationFolderId,
      groupIds: [destinationFolderId],
      folderIds: [destinationFolderId],
      lifecycleStatus: "active",
      documentMoveOperationId: operationId
    },
    updatedAt: now
  }
}

function manifestFolderIds(manifest: DocumentManifest): string[] {
  const metadata = manifest.metadata
  const raw = metadata?.folderIds ?? metadata?.folderId ?? metadata?.groupIds ?? metadata?.groupId
  const values = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : []
  if (!isIdentifierArray(values)) throw new Error("Document move manifest folder scope is invalid")
  return [...values]
}

function currentActor(identity: ServerManagedIdentity | undefined, tenantId: string, actorId: string): AppUser {
  if (!identity
    || identity.userId !== actorId
    || identity.tenantId !== tenantId
    || identity.accountStatus !== "active"
    || !isIdentifier(identity.username)
    || (identity.email !== undefined && !isIdentifier(identity.email))
    || !isIdentifierArray(identity.cognitoGroups)) {
    throw new Error("Current document move actor crossed its identity or tenant boundary")
  }
  return {
    userId: actorId,
    identityUsername: identity.username,
    ...(identity.email === undefined ? {} : { email: identity.email }),
    cognitoGroups: [...identity.cognitoGroups],
    accountStatus: "active",
    tenantId
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function assertIdentifier(value: string, field: string): void {
  if (!isIdentifier(value)) throw new Error(`Document move audit ${field} is invalid`)
}

function isIdentifierArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every(isIdentifier)
    && new Set(value).size === value.length
}

function isOperationId(value: unknown): value is string {
  return typeof value === "string" && /^document_move_[0-9a-f-]{36}$/u.test(value)
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
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
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }
  throw new Error("Document move evidence is not canonical JSON")
}
