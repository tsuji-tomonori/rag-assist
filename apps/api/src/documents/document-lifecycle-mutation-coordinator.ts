import { createHash, randomUUID } from "node:crypto"
import type { AppUser } from "../auth.js"
import { hasPermission, isActiveAccount } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import { FolderPermissionService } from "../folders/folder-permission-service.js"
import type { DocumentManifest, JsonValue, VectorMetadata } from "../types.js"
import type { VectorStore } from "../adapters/vector-store.js"
import { DocumentPermissionService } from "./document-permission-service.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditOutboxPort,
  type SecurityMutationResult
} from "../security/security-mutation-audit-outbox.js"
import {
  assertManifestTenant,
  readTenantManifestByKey,
  tenantManifestKey,
  tenantManifestPrefix
} from "../rag/_shared/storage/tenant-artifacts.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "../security/production-resource-operation-authorizer.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  type RegisterRevocationCleanupInput
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import { benchmarkCorpusOwnerId } from "../benchmark/evaluation-context.js"

export const DOCUMENT_MOVE_POLICY_VERSION = "document-move-policy-v1" as const
export const DOCUMENT_REVOCATION_POLICY_VERSION = "document-revocation-policy-v1" as const

type CoordinatorDeps = Pick<Dependencies,
  | "objectStore"
  | "evidenceVectorStore"
  | "memoryVectorStore"
  | "documentGroupStore"
  | "folderPolicyStore"
  | "userGroupStore"
  | "groupMembershipStore"
  | "resourceUserPrincipalDirectory"
  | "securityAuditOutbox"
  | "localTestIngestAdmissionContext"
  | "legacyGlobalDocumentArtifacts"
>

export type MoveDocumentInput = Readonly<{
  destinationFolderId: string
  newTitle?: string
  reason: string
  expectedUpdatedAt?: string
}>

export type MoveDocumentResult = Readonly<{
  document: DocumentManifest
  before: { folderIds: string[]; fileName: string }
  after: { folderIds: string[]; fileName: string }
  directDocumentGrantsPreserved: true
}>

export type DeleteDocumentResult = Readonly<{
  documentId: string
  deletedVectorCount: number
  tombstoned: true
}>

export type DeleteDocumentInput = Readonly<{
  reason: string
  expectedUpdatedAt: string
}>

export type DeleteDocumentAttribution = Readonly<{
  auditActorId: string
}>

type MoveStatus =
  | "initialized"
  | "prepared"
  | "projections_staging"
  | "projections_staged"
  | "manifest_committed"
  | "rollback_pending"
  | "rolled_back"
  | "completed"

type MoveIntent = {
  schemaVersion: 1
  operationId: string
  fingerprint: string
  status: MoveStatus
  actorId: string
  tenantId: string
  documentId: string
  reason: string
  sourceManifestVersion: string
  sourceManifest: DocumentManifest
  targetManifest: DocumentManifest
  before: { folderIds: string[]; fileName: string }
  after: { folderIds: string[]; fileName: string }
  auditIntentId?: string
  failureResult?: Exclude<SecurityMutationResult, "success">
  lastError?: string
  createdAt: string
  updatedAt: string
}

type DeleteStatus = "initialized" | "prepared" | "tombstoned" | "cleanup_pending" | "completed"

type DeleteIntent = {
  schemaVersion: 1
  operationId: string
  fingerprint: string
  status: DeleteStatus
  actorId: string
  tenantId: string
  documentId: string
  reason: string
  sourceManifestVersion: string
  sourceManifest: DocumentManifest
  tombstoneManifest: DocumentManifest
  auditIntentId?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

type VersionedState<T> = { value: T; version: string }

export class DocumentMutationConflictError extends Error {
  readonly code = "PRECONDITION_FAILED" as const

  constructor(message: string) {
    super(message)
    this.name = "DocumentMutationConflictError"
  }
}

export class DocumentMutationAuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "DocumentMutationAuthorizationError"
  }
}

/**
 * Durable coordinator for folder moves and deny-first deletion. Manifest CAS is
 * the authoritative commit boundary; vector projections are staged as hidden
 * before that boundary and made active only after the commit.
 */
export class DocumentLifecycleMutationCoordinator {
  private readonly folderPermissions: FolderPermissionService
  private readonly documentPermissions: DocumentPermissionService
  private readonly auditOutbox: SecurityMutationAuditOutboxPort

  constructor(
    private readonly deps: CoordinatorDeps,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.folderPermissions = new FolderPermissionService(deps)
    this.documentPermissions = new DocumentPermissionService(deps)
    this.auditOutbox = deps.securityAuditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(deps.objectStore, clock)
  }

  async moveDocument(actor: AppUser, documentId: string, input: MoveDocumentInput): Promise<MoveDocumentResult> {
    validateMoveInput(documentId, input)
    const tenantId = authoritativeActorTenant(actor)
    const manifestKey = tenantManifestKey(this.deps, tenantId, documentId)
    let currentManifest: VersionedState<DocumentManifest>
    try {
      currentManifest = await this.readManifest(manifestKey, tenantId)
    } catch (error) {
      await this.recordEarlyMoveFailure(actor, documentId, input, isMissingObjectError(error) ? "denied" : "failed")
      throw error
    }
    const stateKey = moveStateKey(tenantId, documentId)
    let stored: VersionedState<MoveIntent> | undefined
    try {
      stored = await this.readState<MoveIntent>(stateKey)
    } catch (error) {
      await this.recordEarlyMoveFailure(actor, documentId, input, "failed", currentManifest.value)
      throw error
    }

    if (stored && !isMoveTerminal(stored.value.status)) {
      if (!sameMoveRequest(stored.value, input)) {
        await this.recordEarlyMoveFailure(actor, documentId, input, "conflict", currentManifest.value)
        throw new DocumentMutationConflictError("Another document move is in progress")
      }
      try {
        await this.authorizeMove(
          actor,
          isMoveFor(currentManifest.value, stored.value.operationId) ? currentManifest.value : stored.value.sourceManifest,
          input.destinationFolderId
        )
      } catch (error) {
        await this.recordEarlyMoveFailure(actor, documentId, input, "denied", currentManifest.value)
        throw error
      }
      return this.runMoveStateMachine(actor, stateKey, stored)
    }
    if (stored?.value.status === "completed" && sameMoveRequest(stored.value, input)) {
      try {
        await this.authorizeMove(actor, currentManifest.value, input.destinationFolderId)
      } catch (error) {
        await this.recordEarlyMoveFailure(actor, documentId, input, "denied", currentManifest.value)
        throw error
      }
      return moveResult(stored.value)
    }

    if ((currentManifest.value.lifecycleStatus ?? "active") !== "active") {
      await this.recordEarlyMoveFailure(actor, documentId, input, "conflict", currentManifest.value)
      throw new DocumentMutationConflictError("Document is not active")
    }
    const currentUpdatedAt = currentManifest.value.updatedAt ?? currentManifest.value.createdAt
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== currentUpdatedAt) {
      await this.recordEarlyMoveFailure(actor, documentId, input, "conflict", currentManifest.value)
      throw new DocumentMutationConflictError("Document changed before move")
    }
    try {
      await this.authorizeMove(actor, currentManifest.value, input.destinationFolderId)
    } catch (error) {
      await this.recordEarlyMoveFailure(actor, documentId, input, "denied", currentManifest.value)
      throw error
    }
    try {
      await this.assertNoSiblingConflict(currentManifest.value, input.destinationFolderId, input.newTitle?.trim() || currentManifest.value.fileName)
    } catch (error) {
      await this.recordEarlyMoveFailure(actor, documentId, input, "conflict", currentManifest.value)
      throw error
    }
    try {
      await new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
        .assertResourceFenceReleased(tenantId, "document", documentId)
    } catch (error) {
      await this.recordEarlyMoveFailure(actor, documentId, input, "conflict", currentManifest.value)
      throw new DocumentMutationConflictError(errorMessage(error))
    }

    const now = this.clock().toISOString()
    const operationId = `document_move_${randomUUID()}`
    const before = { folderIds: documentFolderIds(currentManifest.value), fileName: currentManifest.value.fileName }
    const after = { folderIds: [input.destinationFolderId], fileName: input.newTitle?.trim() || currentManifest.value.fileName }
    const targetManifest = movedManifest(currentManifest.value, operationId, input.destinationFolderId, after.fileName, now)
    const intent: MoveIntent = {
      schemaVersion: 1,
      operationId,
      fingerprint: moveFingerprint(currentManifest.version, input),
      status: "initialized",
      actorId: actor.userId,
      tenantId,
      documentId,
      reason: input.reason,
      sourceManifestVersion: currentManifest.version,
      sourceManifest: currentManifest.value,
      targetManifest,
      before,
      after,
      createdAt: now,
      updatedAt: now
    }
    try {
      stored = await this.writeState(stateKey, intent, stored?.version)
    } catch (error) {
      if (!isConditionalWriteError(error)) {
        await this.recordEarlyMoveFailure(actor, documentId, input, "failed", currentManifest.value)
        throw error
      }
      const winner = await this.readState<MoveIntent>(stateKey)
      if (!winner || !sameMoveRequest(winner.value, input)) {
        await this.recordEarlyMoveFailure(actor, documentId, input, "conflict", currentManifest.value)
        throw new DocumentMutationConflictError("Another document move won the mutation race")
      }
      stored = winner
    }
    return this.runMoveStateMachine(actor, stateKey, stored)
  }

  private async recordEarlyMoveFailure(
    actor: AppUser,
    documentId: string,
    input: MoveDocumentInput,
    result: Extract<SecurityMutationResult, "denied" | "conflict" | "failed">,
    manifest?: DocumentManifest
  ): Promise<void> {
    const tenantId = authoritativeActorTenant(actor)
    const before = manifest ? moveAuditValue(manifest) : null
    const audit = await this.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId,
      targetType: "document",
      targetId: documentId,
      operation: "move",
      before,
      proposedAfter: {
        documentId,
        destinationFolderId: input.destinationFolderId,
        newTitle: input.newTitle ?? null,
        expectedUpdatedAt: input.expectedUpdatedAt ?? null
      },
      reason: input.reason,
      policyVersion: DOCUMENT_MOVE_POLICY_VERSION
    })
    await this.auditOutbox.complete(audit.intentId, tenantId, result, before)
  }

  async deleteDocument(
    actor: AppUser,
    documentId: string,
    input: DeleteDocumentInput,
    attribution?: DeleteDocumentAttribution
  ): Promise<DeleteDocumentResult> {
    if (!isCanonicalIdentifier(documentId)) throw new Error("documentId is required")
    const reason = input.reason?.trim()
    if (!reason || input.reason !== reason) throw new Error("reason is required and must be canonical")
    if (!input.expectedUpdatedAt || input.expectedUpdatedAt.trim() !== input.expectedUpdatedAt) {
      throw new Error("expectedUpdatedAt is required and must be canonical")
    }
    const auditActorId = attribution?.auditActorId ?? actor.userId
    if (!isCanonicalIdentifier(auditActorId)) throw new Error("auditActorId is required and must be canonical")
    const tenantId = authoritativeActorTenant(actor)
    const manifestKey = tenantManifestKey(this.deps, tenantId, documentId)
    const stateKey = deleteStateKey(tenantId, documentId)
    let stored = await this.readState<DeleteIntent>(stateKey)
    let currentManifest: VersionedState<DocumentManifest>
    try {
      currentManifest = await this.readManifest(manifestKey, tenantId)
    } catch (error) {
      // The common cleanup worker is allowed to remove the tombstone manifest
      // after it has independently verified the deny. A durable delete intent
      // must therefore remain resumable even when that cleanup wins the race.
      if (!isMissingObjectError(error) || !stored || stored.value.reason !== reason) throw error
      this.authorizeDeletionRetry(actor, stored.value)
      return this.runDeleteStateMachine(actor, stateKey, stored)
    }

    if (stored && stored.value.status !== "completed") {
      if (stored.value.reason !== reason) throw new DocumentMutationConflictError("Another document deletion is in progress")
      if (isRevocationFor(currentManifest.value, stored.value.operationId)) {
        this.authorizeDeletionRetry(actor, stored.value)
      } else {
        await this.authorizeDelete(actor, stored.value.sourceManifest)
      }
      return this.runDeleteStateMachine(actor, stateKey, stored)
    }
    if (stored?.value.status === "completed" && isRevocationFor(currentManifest.value, stored.value.operationId)) {
      this.authorizeDeletionRetry(actor, stored.value)
      return deleteResult(stored.value)
    }

    if ((currentManifest.value.lifecycleStatus ?? "active") !== "active") {
      await this.recordEarlyDeleteFailure(auditActorId, currentManifest.value, reason, "conflict")
      throw new DocumentMutationConflictError("Document is not active")
    }
    const currentUpdatedAt = currentManifest.value.updatedAt ?? currentManifest.value.createdAt
    if (input.expectedUpdatedAt !== currentUpdatedAt) {
      await this.recordEarlyDeleteFailure(auditActorId, currentManifest.value, reason, "conflict")
      throw new DocumentMutationConflictError("Document changed before deletion")
    }
    try {
      await this.authorizeDelete(actor, currentManifest.value)
    } catch (error) {
      await this.recordEarlyDeleteFailure(auditActorId, currentManifest.value, reason, "denied")
      throw error
    }
    try {
      await new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
        .assertResourceFenceReleased(tenantId, "document", documentId)
    } catch (error) {
      await this.recordEarlyDeleteFailure(auditActorId, currentManifest.value, reason, "conflict")
      throw new DocumentMutationConflictError(errorMessage(error))
    }
    const now = this.clock().toISOString()
    const operationId = `document_delete_${randomUUID()}`
    const tombstoneManifest = revokedManifest(currentManifest.value, operationId, auditActorId, reason, now)
    const intent: DeleteIntent = {
      schemaVersion: 1,
      operationId,
      fingerprint: hashJson({ documentId, sourceVersion: currentManifest.version, reason }),
      status: "initialized",
      actorId: auditActorId,
      tenantId,
      documentId,
      reason,
      sourceManifestVersion: currentManifest.version,
      sourceManifest: currentManifest.value,
      tombstoneManifest,
      createdAt: now,
      updatedAt: now
    }
    try {
      stored = await this.writeState(stateKey, intent, stored?.version)
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const winner = await this.readState<DeleteIntent>(stateKey)
      if (!winner || winner.value.reason !== reason) {
        throw new DocumentMutationConflictError("Another document deletion won the mutation race")
      }
      stored = winner
    }
    return this.runDeleteStateMachine(actor, stateKey, stored)
  }

  private async recordEarlyDeleteFailure(
    auditActorId: string,
    manifest: DocumentManifest,
    reason: string,
    result: Extract<SecurityMutationResult, "denied" | "conflict">
  ): Promise<void> {
    const tenantId = authoritativeTenantId(manifest)
    const audit = await this.auditOutbox.prepare({
      actorId: auditActorId,
      tenantId,
      targetType: "document",
      targetId: manifest.documentId,
      operation: "revoke.delete",
      before: deleteAuditValue(manifest),
      proposedAfter: deleteAuditValue(manifest),
      reason,
      policyVersion: DOCUMENT_REVOCATION_POLICY_VERSION
    })
    await this.auditOutbox.complete(audit.intentId, tenantId, result, deleteAuditValue(manifest))
  }

  private async runMoveStateMachine(
    actor: AppUser,
    stateKey: string,
    initial: VersionedState<MoveIntent>
  ): Promise<MoveDocumentResult> {
    let stored = initial
    for (let step = 0; step < 20; step += 1) {
      const intent = stored.value
      if (intent.status === "completed") return moveResult(intent)
      if (intent.status === "rolled_back") {
        throw new DocumentMutationConflictError(intent.lastError ?? "Document move was rolled back")
      }
      if (intent.status === "initialized") {
        const audit = await this.auditOutbox.prepare({
          actorId: intent.actorId,
          tenantId: intent.tenantId,
          targetType: "document",
          targetId: intent.documentId,
          operation: "move",
          before: moveAuditValue(intent.sourceManifest),
          proposedAfter: moveAuditValue(intent.targetManifest),
          reason: intent.reason,
          policyVersion: DOCUMENT_MOVE_POLICY_VERSION
        })
        stored = await this.advanceMove(stateKey, stored, {
          status: "prepared",
          auditIntentId: audit.intentId,
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "prepared") {
        stored = await this.advanceMove(stateKey, stored, {
          status: "projections_staging",
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "projections_staging") {
        try {
          await this.rewriteAllProjections(intent.targetManifest, "staging")
          stored = await this.advanceMove(stateKey, stored, {
            status: "projections_staged",
            updatedAt: this.clock().toISOString()
          })
        } catch (error) {
          stored = await this.markMoveRollback(stateKey, stored, "failed", error)
          await this.finishMoveRollback(stateKey, stored)
          throw error
        }
        continue
      }
      if (intent.status === "rollback_pending") {
        await this.finishMoveRollback(stateKey, stored)
        throw new DocumentMutationConflictError(intent.lastError ?? "Document move was rolled back")
      }
      if (intent.status === "projections_staged") {
        const current = await this.readManifest(tenantManifestKey(this.deps, intent.tenantId, intent.documentId), intent.tenantId)
        if (isMoveFor(current.value, intent.operationId)) {
          stored = await this.advanceMove(stateKey, stored, {
            status: "manifest_committed",
            updatedAt: this.clock().toISOString()
          })
          continue
        }
        if (current.version !== intent.sourceManifestVersion) {
          await this.convergeMoveConflict(stateKey, stored, current.value)
          throw new DocumentMutationConflictError("Document changed during move")
        }
        try {
          await this.authorizeMove(actor, current.value, intent.after.folderIds[0] as string)
          await this.assertNoSiblingConflict(current.value, intent.after.folderIds[0] as string, intent.after.fileName)
        } catch (error) {
          stored = await this.markMoveRollback(stateKey, stored, "denied", error)
          await this.finishMoveRollback(stateKey, stored)
          throw error
        }
        try {
          await this.deps.objectStore.putTextIfVersion(
            current.value.manifestObjectKey,
            JSON.stringify(intent.targetManifest, null, 2),
            intent.sourceManifestVersion,
            "application/json"
          )
        } catch (error) {
          if (!isConditionalWriteError(error)) {
            stored = await this.markMoveRollback(stateKey, stored, "failed", error)
            await this.finishMoveRollback(stateKey, stored)
            throw error
          }
          const winner = await this.readManifest(tenantManifestKey(this.deps, intent.tenantId, intent.documentId), intent.tenantId)
          if (!isMoveFor(winner.value, intent.operationId)) {
            await this.convergeMoveConflict(stateKey, stored, winner.value)
            throw new DocumentMutationConflictError("Document move lost the manifest CAS race")
          }
        }
        stored = await this.advanceMove(stateKey, stored, {
          status: "manifest_committed",
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "manifest_committed") {
        await this.rewriteAllProjections(intent.targetManifest, "active")
        if (!intent.auditIntentId) throw new Error("Document move audit intent is missing")
        await this.auditOutbox.complete(
          intent.auditIntentId,
          intent.tenantId,
          "success",
          moveAuditValue(intent.targetManifest)
        )
        stored = await this.advanceMove(stateKey, stored, {
          status: "completed",
          updatedAt: this.clock().toISOString()
        })
        continue
      }
    }
    throw new Error("Document move state machine exceeded its transition limit")
  }

  private async runDeleteStateMachine(
    actor: AppUser,
    stateKey: string,
    initial: VersionedState<DeleteIntent>
  ): Promise<DeleteDocumentResult> {
    let stored = initial
    for (let step = 0; step < 12; step += 1) {
      const intent = stored.value
      if (intent.status === "completed") return deleteResult(intent)
      if (intent.status === "initialized") {
        const audit = await this.auditOutbox.prepare({
          actorId: intent.actorId,
          tenantId: intent.tenantId,
          targetType: "document",
          targetId: intent.documentId,
          operation: "revoke.delete",
          before: deleteAuditValue(intent.sourceManifest),
          proposedAfter: deleteAuditValue(intent.tombstoneManifest),
          reason: intent.reason,
          policyVersion: DOCUMENT_REVOCATION_POLICY_VERSION
        })
        const preparedAt = this.clock().toISOString()
        await new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore).prepare({
          expectedBeforeDenyVersion: intent.sourceManifestVersion,
          cleanupRegistration: documentDeleteCleanupRegistration(intent),
          preparedAt
        })
        stored = await this.advanceDelete(stateKey, stored, {
          status: "prepared",
          auditIntentId: audit.intentId,
          updatedAt: preparedAt
        })
        continue
      }
      if (intent.status === "prepared") {
        let current: VersionedState<DocumentManifest>
        try {
          current = await this.readManifest(tenantManifestKey(this.deps, intent.tenantId, intent.documentId), intent.tenantId)
        } catch (error) {
          if (!isMissingObjectError(error)) throw error
          const repair = await new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore).get(
            intent.tenantId,
            "document",
            intent.documentId,
            intent.operationId
          )
          if (!repair || repair.status === "prepared" || repair.status === "abandoned") throw error
          stored = await this.advanceDelete(stateKey, stored, {
            status: "tombstoned",
            updatedAt: this.clock().toISOString()
          })
          continue
        }
        if (!isRevocationFor(current.value, intent.operationId)) {
          if (current.version !== intent.sourceManifestVersion) {
            if (!intent.auditIntentId) throw new Error("Document deletion audit intent is missing")
            await this.auditOutbox.complete(intent.auditIntentId, intent.tenantId, "conflict", deleteAuditValue(current.value))
            await this.abandonDocumentDeleteRepair(intent)
            throw new DocumentMutationConflictError("Document changed during deletion")
          }
          await this.authorizeDelete(actor, current.value)
          try {
            await this.deps.objectStore.putTextIfVersion(
              current.value.manifestObjectKey,
              JSON.stringify(intent.tombstoneManifest, null, 2),
              intent.sourceManifestVersion,
              "application/json"
            )
          } catch (error) {
            if (!isConditionalWriteError(error)) throw error
            const winner = await this.readManifest(tenantManifestKey(this.deps, intent.tenantId, intent.documentId), intent.tenantId)
            if (!isRevocationFor(winner.value, intent.operationId)) {
              if (!intent.auditIntentId) throw new Error("Document deletion audit intent is missing", { cause: error })
              await this.auditOutbox.complete(intent.auditIntentId, intent.tenantId, "conflict", deleteAuditValue(winner.value))
              await this.abandonDocumentDeleteRepair(intent)
              throw new DocumentMutationConflictError("Document deletion lost the manifest CAS race")
            }
          }
        }
        stored = await this.advanceDelete(stateKey, stored, {
          status: "tombstoned",
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "tombstoned" || intent.status === "cleanup_pending") {
        try {
          await this.registerDocumentDeleteCleanup(intent)
          await this.cleanupDeletedDocument(intent.sourceManifest)
        } catch (error) {
          await this.advanceDelete(stateKey, stored, {
            status: "cleanup_pending",
            lastError: errorMessage(error),
            updatedAt: this.clock().toISOString()
          }).catch(() => undefined)
          throw error
        }
        if (!intent.auditIntentId) throw new Error("Document deletion audit intent is missing")
        await this.auditOutbox.complete(
          intent.auditIntentId,
          intent.tenantId,
          "success",
          deleteAuditValue(intent.tombstoneManifest)
        )
        stored = await this.advanceDelete(stateKey, stored, {
          status: "completed",
          lastError: undefined,
          updatedAt: this.clock().toISOString()
        })
        continue
      }
    }
    throw new Error("Document deletion state machine exceeded its transition limit")
  }

  private async authorizeMove(actor: AppUser, manifest: DocumentManifest, destinationFolderId: string): Promise<void> {
    const tenantId = authoritativeTenantId(manifest)
    assertCurrentActor(actor, tenantId)
    if (!hasPermission(actor, "rag:doc:move")) throw new DocumentMutationAuthorizationError()
    const sourceFolderIds = documentFolderIds(manifest)
    let sourceAdministrativePrincipal = false
    if (sourceFolderIds.length === 0) {
      if ((await this.documentPermissions.resolveEffectiveDocumentPermissionDecision(actor, manifest)).permission !== "full") {
        throw new DocumentMutationAuthorizationError()
      }
      sourceAdministrativePrincipal = documentOwnerUserId(manifest) === actor.userId
    } else {
      const sourceDecisions = await Promise.all(sourceFolderIds.map((folderId) => (
        this.folderPermissions.resolveEffectiveFolderPermissionDecision(actor, folderId)
      )))
      if (sourceDecisions.some((decision) => decision.permission !== "full")) {
        throw new DocumentMutationAuthorizationError()
      }
    }
    const destination = await this.deps.documentGroupStore.get(tenantId, destinationFolderId)
    if (!destination || destination.status !== "active" || destination.tenantId !== tenantId) {
      throw new DocumentMutationAuthorizationError()
    }
    const destinationDecision = await this.folderPermissions.resolveEffectiveFolderPermissionDecision(actor, destinationFolderId)
    if (destinationDecision.permission !== "full") {
      throw new DocumentMutationAuthorizationError()
    }
    try {
      enforceResolvedResourceOperation(actor, {
        resourceType: "document",
        operation: "move",
        authorizationPath: "sourceAndDestinationFolders",
        resourceScopes: {
          sourceContainer: resolvedResourceScope({ tenantId, permission: "full", administrativePrincipal: sourceAdministrativePrincipal }),
          destinationContainer: resolvedResourceScope({ tenantId, permission: destinationDecision.permission })
        },
        satisfiedGuards: ["sameTenantMove", "coherentDerivedMetadata"]
      })
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) throw new DocumentMutationAuthorizationError()
      throw error
    }
  }

  private async authorizeDelete(actor: AppUser, manifest: DocumentManifest): Promise<void> {
    const tenantId = authoritativeTenantId(manifest)
    assertCurrentActor(actor, tenantId)
    assertRetentionSatisfied(manifest, this.clock())
    let sourcePermission: "none" | "full" = "none"
    let administrativePrincipal = false
    if (hasPermission(actor, "rag:doc:delete:group")) {
      const folderIds = documentFolderIds(manifest)
      if (folderIds.length > 0) {
        const decisions = await Promise.all(folderIds.map((folderId) => (
          this.folderPermissions.resolveEffectiveFolderPermissionDecision(actor, folderId)
        )))
        if (decisions.every((decision) => decision.permission === "full")) sourcePermission = "full"
      } else if ((await this.documentPermissions.resolveEffectiveDocumentPermissionDecision(actor, manifest)).permission === "full") {
        sourcePermission = "full"
        administrativePrincipal = documentOwnerUserId(manifest) === actor.userId
      }
    }
    if (sourcePermission === "none" && hasPermission(actor, "benchmark:seed_corpus") && isBenchmarkSeedManifest(manifest)) {
      sourcePermission = "full"
      administrativePrincipal = true
    }
    if (sourcePermission === "none") throw new DocumentMutationAuthorizationError()
    try {
      enforceResolvedResourceOperation(actor, {
        resourceType: "document",
        operation: "delete",
        authorizationPath: "sourceFolder",
        resourceScopes: {
          sourceContainer: resolvedResourceScope({ tenantId, permission: sourcePermission, administrativePrincipal })
        },
        satisfiedGuards: ["denyFirstLifecycleApplied", "retentionPolicySatisfied"]
      })
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) throw new DocumentMutationAuthorizationError()
      throw error
    }
  }

  private authorizeDeletionRetry(actor: AppUser, intent: DeleteIntent): void {
    assertCurrentActor(actor, intent.tenantId)
    if (hasPermission(actor, "rag:doc:delete:group")) return
    if (hasPermission(actor, "benchmark:seed_corpus") && isBenchmarkSeedManifest(intent.sourceManifest)) return
    throw new DocumentMutationAuthorizationError()
  }

  private async assertNoSiblingConflict(manifest: DocumentManifest, destinationFolderId: string, nextFileName: string): Promise<void> {
    const tenantId = authoritativeTenantId(manifest)
    const keys = await this.deps.objectStore.listKeys(tenantManifestPrefix(this.deps, tenantId))
    for (const key of keys.filter((candidate) => candidate.endsWith(".json"))) {
      let candidate: DocumentManifest
      try {
        candidate = await readTenantManifestByKey(this.deps, tenantId, key)
      } catch (error) {
        if (isMissingObjectError(error)) continue
        throw error
      }
      if (
        candidate.documentId !== manifest.documentId &&
        candidate.fileName === nextFileName &&
        (candidate.lifecycleStatus ?? "active") === "active" &&
        authoritativeTenantId(candidate) === authoritativeTenantId(manifest) &&
        documentFolderIds(candidate).includes(destinationFolderId)
      ) throw new DocumentMutationConflictError("Destination folder already has a document with the same file name")
    }
  }

  private async markMoveRollback(
    stateKey: string,
    stored: VersionedState<MoveIntent>,
    result: Exclude<SecurityMutationResult, "success">,
    error: unknown
  ): Promise<VersionedState<MoveIntent>> {
    return this.advanceMove(stateKey, stored, {
      status: "rollback_pending",
      failureResult: result,
      lastError: errorMessage(error),
      updatedAt: this.clock().toISOString()
    })
  }

  private async finishMoveRollback(stateKey: string, stored: VersionedState<MoveIntent>): Promise<void> {
    const intent = stored.value
    const current = await this.readManifest(tenantManifestKey(this.deps, intent.tenantId, intent.documentId), intent.tenantId)
    if (isMoveFor(current.value, intent.operationId)) {
      await this.rewriteAllProjections(intent.targetManifest, "active")
      if (!intent.auditIntentId) throw new Error("Document move audit intent is missing")
      await this.auditOutbox.complete(intent.auditIntentId, intent.tenantId, "success", moveAuditValue(intent.targetManifest))
      await this.advanceMove(stateKey, stored, { status: "completed", updatedAt: this.clock().toISOString() })
      return
    }
    await this.rewriteAllProjections(intent.sourceManifest, "active")
    const result = intent.failureResult ?? "failed"
    if (intent.auditIntentId) {
      await this.auditOutbox.complete(intent.auditIntentId, intent.tenantId, result, moveAuditValue(current.value))
    }
    await this.advanceMove(stateKey, stored, { status: "rolled_back", updatedAt: this.clock().toISOString() })
  }

  private async convergeMoveConflict(
    stateKey: string,
    stored: VersionedState<MoveIntent>,
    authoritativeManifest: DocumentManifest
  ): Promise<void> {
    await this.rewriteAllProjections(
      authoritativeManifest,
      authoritativeManifest.lifecycleStatus === "staging" ? "staging" : authoritativeManifest.lifecycleStatus === "superseded" ? "superseded" : "active"
    )
    if (stored.value.auditIntentId) {
      await this.auditOutbox.complete(
        stored.value.auditIntentId,
        stored.value.tenantId,
        "conflict",
        moveAuditValue(authoritativeManifest)
      )
    }
    await this.advanceMove(stateKey, stored, {
      status: "rolled_back",
      failureResult: "conflict",
      lastError: "Document changed during move",
      updatedAt: this.clock().toISOString()
    })
  }

  private async rewriteAllProjections(
    manifest: DocumentManifest,
    lifecycleStatus: "active" | "staging" | "superseded"
  ): Promise<void> {
    const operations = [
      this.rewriteProjection(
        this.deps.evidenceVectorStore,
        manifest.evidenceVectorKeys ?? manifest.vectorKeys,
        manifest,
        lifecycleStatus
      ),
      this.rewriteProjection(
        this.deps.memoryVectorStore,
        manifest.memoryVectorKeys ?? manifest.vectorKeys,
        manifest,
        lifecycleStatus
      )
    ]
    const results = await Promise.allSettled(operations)
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `Document projection rewrite failed: ${failures.map((failure) => errorMessage(failure.reason)).join("; ")}`
      )
    }
  }

  private async rewriteProjection(
    store: VectorStore,
    rawKeys: readonly string[],
    manifest: DocumentManifest,
    lifecycleStatus: "active" | "staging" | "superseded"
  ): Promise<void> {
    const keys = [...new Set(rawKeys)]
    if (keys.length === 0) return
    if (!store.getByKeys) throw new Error("Vector store cannot read records for coherent document mutation")
    const records = await store.getByKeys(keys)
    if (records.length !== keys.length || new Set(records.map((record) => record.key)).size !== keys.length) {
      throw new Error("Document vector projection is incomplete")
    }
    await store.put(records.map((record) => ({
      ...record,
      metadata: projectionMetadata(record.metadata, manifest, lifecycleStatus)
    })))
  }

  private async cleanupDeletedDocument(manifest: DocumentManifest): Promise<void> {
    const results = await Promise.allSettled([
      this.deps.evidenceVectorStore.delete(manifest.evidenceVectorKeys ?? manifest.vectorKeys),
      this.deps.memoryVectorStore.delete(manifest.memoryVectorKeys ?? manifest.vectorKeys),
      this.deps.objectStore.deleteObject(manifest.sourceObjectKey),
      ...(manifest.structuredBlocksObjectKey ? [this.deps.objectStore.deleteObject(manifest.structuredBlocksObjectKey)] : []),
      ...(manifest.memoryCardsObjectKey ? [this.deps.objectStore.deleteObject(manifest.memoryCardsObjectKey)] : []),
      this.deps.objectStore.deleteObject(documentShareGrantKey(authoritativeTenantId(manifest), manifest.documentId))
    ])
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `Document deletion cleanup failed: ${failures.map((failure) => errorMessage(failure.reason)).join("; ")}`
      )
    }
  }

  private async registerDocumentDeleteCleanup(intent: DeleteIntent): Promise<void> {
    const outbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    let repair = await outbox.get(intent.tenantId, "document", intent.documentId, intent.operationId)
    if (!repair) throw new Error("Document deletion cleanup repair intent is missing")
    if (repair.status === "abandoned") throw new Error("Document deletion cleanup repair intent was abandoned")
    if (repair.status === "prepared") {
      repair = await outbox.markDenyCommitted(repair, this.clock().toISOString())
    }
    if (repair.status === "deny_committed") {
      await new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore, this.clock)
        .register(repair.cleanupRegistration)
      await outbox.markCleanupRegistered(repair, this.clock().toISOString())
    }
  }

  private async abandonDocumentDeleteRepair(intent: DeleteIntent): Promise<void> {
    const outbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    const repair = await outbox.get(intent.tenantId, "document", intent.documentId, intent.operationId)
    if (repair?.status === "prepared" || repair?.status === "deny_committed") {
      await outbox.markAbandoned(repair, this.clock().toISOString())
    }
  }

  private async advanceMove(
    stateKey: string,
    stored: VersionedState<MoveIntent>,
    patch: Partial<MoveIntent>
  ): Promise<VersionedState<MoveIntent>> {
    try {
      return await this.writeState(stateKey, { ...stored.value, ...patch }, stored.version)
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const current = await this.readState<MoveIntent>(stateKey)
      if (!current || current.value.operationId !== stored.value.operationId) {
        throw new DocumentMutationConflictError("Document move state changed concurrently")
      }
      return current
    }
  }

  private async advanceDelete(
    stateKey: string,
    stored: VersionedState<DeleteIntent>,
    patch: Partial<DeleteIntent>
  ): Promise<VersionedState<DeleteIntent>> {
    try {
      return await this.writeState(stateKey, { ...stored.value, ...patch }, stored.version)
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const current = await this.readState<DeleteIntent>(stateKey)
      if (!current || current.value.operationId !== stored.value.operationId) {
        throw new DocumentMutationConflictError("Document deletion state changed concurrently")
      }
      return current
    }
  }

  private async readManifest(key: string, tenantId: string): Promise<VersionedState<DocumentManifest>> {
    const stored = await this.deps.objectStore.getTextWithVersion(key)
    const value = JSON.parse(stored.text) as DocumentManifest
    assertManifestTenant(value, tenantId, key)
    if (!isCanonicalIdentifier(value.documentId) || value.manifestObjectKey !== key) {
      throw new Error("Document manifest identity is invalid")
    }
    return { value, version: stored.version }
  }

  private async readState<T>(key: string): Promise<VersionedState<T> | undefined> {
    try {
      const stored = await this.deps.objectStore.getTextWithVersion(key)
      return { value: JSON.parse(stored.text) as T, version: stored.version }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }

  private async writeState<T>(key: string, value: T, expectedVersion: string | undefined): Promise<VersionedState<T>> {
    await this.deps.objectStore.putTextIfVersion(key, JSON.stringify(value, null, 2), expectedVersion, "application/json")
    const stored = await this.deps.objectStore.getTextWithVersion(key)
    return { value: JSON.parse(stored.text) as T, version: stored.version }
  }
}

function validateMoveInput(documentId: string, input: MoveDocumentInput): void {
  if (!isCanonicalIdentifier(documentId)) throw new Error("documentId is required")
  if (!isCanonicalIdentifier(input.destinationFolderId)) throw new Error("destinationFolderId is required")
  if (!input.reason || input.reason.trim() !== input.reason) throw new Error("reason is required and must be canonical")
  if (input.newTitle !== undefined && (!input.newTitle.trim() || input.newTitle.trim() !== input.newTitle)) {
    throw new Error("newTitle must be non-empty and canonical")
  }
}

function assertCurrentActor(actor: AppUser, tenantId: string): void {
  if (
    !isActiveAccount(actor) ||
    !isCanonicalIdentifier(actor.userId) ||
    !isCanonicalIdentifier(actor.tenantId) ||
    actor.tenantId !== tenantId
  ) throw new DocumentMutationAuthorizationError()
}

function authoritativeActorTenant(actor: AppUser): string {
  const tenantId = actor.tenantId?.trim()
  if (!isActiveAccount(actor) || !isCanonicalIdentifier(actor.userId) || !isCanonicalIdentifier(tenantId)) {
    throw new DocumentMutationAuthorizationError()
  }
  return tenantId
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
      documentRevocation: {
        schemaVersion: 1,
        operationId,
        actorId,
        reason,
        tombstonedAt: now
      }
    },
    updatedAt: now
  }
}

function documentDeleteCleanupRegistration(
  intent: DeleteIntent
): RegisterRevocationCleanupInput & { operationId: string } {
  const manifest = intent.sourceManifest
  const memoryVectorKeys = manifest.memoryVectorKeys ?? manifest.vectorKeys
  const evidenceVectorKeys = manifest.evidenceVectorKeys ?? manifest.vectorKeys
  const tombstonedAt = intent.tombstoneManifest.updatedAt ?? intent.tombstoneManifest.createdAt
  return {
    operationId: intent.operationId,
    tenantId: intent.tenantId,
    resourceType: "document",
    resourceId: intent.documentId,
    trigger: "deleted",
    deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
    authoritativeDenyVersion: `document-revocation:${intent.operationId}:${tombstonedAt}`,
    authoritativeDenyConfirmedAt: tombstonedAt,
    knownTargets: [
      { scope: "source", reference: manifest.sourceObjectKey },
      { scope: "source", reference: manifest.manifestObjectKey },
      ...(manifest.structuredBlocksObjectKey
        ? [{ scope: "chunk" as const, reference: manifest.structuredBlocksObjectKey }]
        : [{ scope: "chunk" as const, reference: `${intent.documentId}:all` }]),
      ...(manifest.memoryCardsObjectKey
        ? [{ scope: "memory" as const, reference: manifest.memoryCardsObjectKey }]
        : []),
      ...memoryVectorKeys.map((reference) => ({ scope: "memory" as const, reference })),
      ...evidenceVectorKeys.map((reference) => ({ scope: "active_index" as const, reference })),
      ...(manifest.publicationFence?.stageNamespace
        ? [{ scope: "staged_index" as const, reference: manifest.publicationFence.stageNamespace }]
        : []),
      { scope: "old_index", reference: `document-${createHash("sha256").update(intent.documentId).digest("hex")}` },
      { scope: "cache", reference: `document:${intent.documentId}` },
      { scope: "grant", reference: `document:${intent.documentId}` },
      { scope: "session", reference: `document:${intent.documentId}/session` },
      { scope: "queued_run", reference: `document:${intent.documentId}` },
      { scope: "evaluation_artifact", reference: `document:${intent.documentId}` }
    ]
  }
}

function projectionMetadata(
  current: VectorMetadata,
  manifest: DocumentManifest,
  lifecycleStatus: "active" | "staging" | "superseded"
): VectorMetadata {
  const next: VectorMetadata = {
    ...current,
    fileName: manifest.fileName,
    lifecycleStatus
  }
  delete next.groupId
  delete next.folderId
  delete next.groupIds
  delete next.folderIds
  const folderIds = documentFolderIds(manifest)
  if (folderIds.length > 0) {
    next.groupId = folderIds[0]
    next.folderId = folderIds[0]
    next.groupIds = [...folderIds]
    next.folderIds = [...folderIds]
  }
  const tenantId = authoritativeTenantId(manifest)
  next.tenantId = tenantId
  const scopeType = manifest.metadata?.scopeType
  if (scopeType === "personal" || scopeType === "group" || scopeType === "chat" || scopeType === "benchmark") {
    next.scopeType = scopeType
  }
  return next
}

function authoritativeTenantId(manifest: DocumentManifest): string {
  const tenantId = typeof manifest.metadata?.tenantId === "string"
    ? manifest.metadata.tenantId
    : manifest.admission?.tenantId
  if (!isCanonicalIdentifier(tenantId)) throw new DocumentMutationAuthorizationError("Document tenant is not authoritative")
  return tenantId
}

function documentOwnerUserId(manifest: DocumentManifest): string | undefined {
  const owner = typeof manifest.metadata?.ownerUserId === "string"
    ? manifest.metadata.ownerUserId
    : manifest.admission?.ownerUserId
  return isCanonicalIdentifier(owner) ? owner : undefined
}

function assertRetentionSatisfied(manifest: DocumentManifest, now: Date): void {
  if (manifest.metadata?.legalHold === true) {
    throw new DocumentMutationAuthorizationError("Document is under legal hold")
  }
  const retentionUntil = manifest.metadata?.retentionUntil
  if (retentionUntil === undefined) return
  if (typeof retentionUntil !== "string") {
    throw new DocumentMutationAuthorizationError("Document retention policy is invalid")
  }
  const expiresAt = Date.parse(retentionUntil)
  if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) {
    throw new DocumentMutationAuthorizationError("Document retention policy prevents deletion")
  }
}

function documentFolderIds(manifest: DocumentManifest): string[] {
  const raw = manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId
  const values = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : []
  const result = [...new Set(values.filter((value): value is string => typeof value === "string" && isCanonicalIdentifier(value)))]
  if (values.length !== result.length) throw new DocumentMutationAuthorizationError("Document folder scope is invalid")
  return result
}

function moveResult(intent: MoveIntent): MoveDocumentResult {
  return {
    document: intent.targetManifest,
    before: intent.before,
    after: intent.after,
    directDocumentGrantsPreserved: true
  }
}

function deleteResult(intent: DeleteIntent): DeleteDocumentResult {
  return {
    documentId: intent.documentId,
    deletedVectorCount: intent.sourceManifest.vectorKeys.length,
    tombstoned: true
  }
}

function moveFingerprint(sourceManifestVersion: string, input: MoveDocumentInput): string {
  return hashJson({
    sourceManifestVersion,
    destinationFolderId: input.destinationFolderId,
    newTitle: input.newTitle ?? null,
    reason: input.reason
  })
}

function sameMoveRequest(intent: MoveIntent, input: MoveDocumentInput): boolean {
  return intent.after.folderIds[0] === input.destinationFolderId &&
    intent.after.fileName === (input.newTitle ?? intent.sourceManifest.fileName) &&
    intent.reason === input.reason
}

function isMoveTerminal(status: MoveStatus): boolean {
  return status === "completed" || status === "rolled_back"
}

function isMoveFor(manifest: DocumentManifest, operationId: string): boolean {
  return manifest.metadata?.documentMoveOperationId === operationId
}

function isRevocationFor(manifest: DocumentManifest, operationId: string): boolean {
  const revocation = manifest.metadata?.documentRevocation
  return Boolean(
    revocation &&
    typeof revocation === "object" &&
    !Array.isArray(revocation) &&
    revocation.operationId === operationId &&
    manifest.lifecycleStatus === "superseded"
  )
}

function isBenchmarkSeedManifest(manifest: DocumentManifest): boolean {
  const tenantId = typeof manifest.metadata?.tenantId === "string" ? manifest.metadata.tenantId : manifest.admission?.tenantId
  const ownerUserId = documentOwnerUserId(manifest)
  const suiteId = manifest.metadata?.benchmarkSuiteId
  return (manifest.lifecycleStatus ?? "active") === "active" &&
    manifest.metadata?.benchmarkSeed === true &&
    typeof suiteId === "string" &&
    manifest.metadata.source === "benchmark-runner" &&
    manifest.metadata.docType === "benchmark-corpus" &&
    manifest.metadata.scopeType === "benchmark" &&
    isCanonicalIdentifier(tenantId) &&
    typeof ownerUserId === "string" &&
    ownerUserId === benchmarkCorpusOwnerId(suiteId)
}

function moveAuditValue(manifest: DocumentManifest): JsonValue {
  return {
    documentId: manifest.documentId,
    tenantId: authoritativeTenantId(manifest),
    fileName: manifest.fileName,
    folderIds: documentFolderIds(manifest),
    lifecycleStatus: manifest.lifecycleStatus ?? "active",
    updatedAt: manifest.updatedAt ?? manifest.createdAt
  }
}

function deleteAuditValue(manifest: DocumentManifest): JsonValue {
  return {
    documentId: manifest.documentId,
    tenantId: authoritativeTenantId(manifest),
    lifecycleStatus: manifest.lifecycleStatus ?? "active",
    folderIds: documentFolderIds(manifest),
    updatedAt: manifest.updatedAt ?? manifest.createdAt
  }
}

function moveStateKey(tenantId: string, documentId: string): string {
  return `document-mutations/move/${encodeURIComponent(tenantId)}/${encodeURIComponent(documentId)}.json`
}

function deleteStateKey(tenantId: string, documentId: string): string {
  return `document-mutations/delete/${encodeURIComponent(tenantId)}/${encodeURIComponent(documentId)}.json`
}

function documentShareGrantKey(tenantId: string, documentId: string): string {
  return `documents/share-grants/${encodeURIComponent(tenantId)}/${encodeURIComponent(documentId)}.json`
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function isCanonicalIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function isConditionalWriteError(error: unknown): boolean {
  return error instanceof Error && (
    (error as Error & { code?: string }).code === "PRECONDITION_FAILED" ||
    error.name === "PreconditionFailed" ||
    error.name === "ConditionalCheckFailedException"
  )
}

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && (
    (error as NodeJS.ErrnoException).code === "ENOENT" ||
    error.name === "NoSuchKey" ||
    error.name === "NotFound"
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof AggregateError) return error.errors.map(errorMessage).join("; ")
  return error instanceof Error ? error.message : String(error)
}
