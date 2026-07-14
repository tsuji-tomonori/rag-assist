import { createHash, randomUUID } from "node:crypto"
import type { VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import { folderPolicyStateVersion } from "../adapters/folder-policy-store.js"
import type { VectorStore } from "../adapters/vector-store.js"
import type { AppUser } from "../auth.js"
import { hasPermission, isActiveAccount } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditOutboxPort,
  type SecurityMutationResult
} from "../security/security-mutation-audit-outbox.js"
import type {
  DocumentGroup,
  DocumentManifest,
  FolderPolicy,
  FolderPolicySource,
  JsonValue,
  VectorMetadata
} from "../types.js"
import {
  assertManifestTenant,
  tenantDocumentArtifactKey,
  tenantManifestPrefix
} from "../rag/_shared/storage/tenant-artifacts.js"
import { FolderPermissionService } from "./folder-permission-service.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "../security/production-resource-operation-authorizer.js"

export const FOLDER_MOVE_POLICY_VERSION = "folder-move-policy-v1" as const

const maximumSynchronousSubtreeSize = 8

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
  | "verifiedIdentityProvider"
  | "localTestIngestAdmissionContext"
  | "legacyGlobalDocumentArtifacts"
>

export type MoveFolderInput = Readonly<{
  destinationParentId: string | null
  newName?: string
  reason: string
  expectedVersion: string
}>

export type MoveFolderResult = Readonly<{
  operationId: string
  folder: DocumentGroup
  subtree: readonly DocumentGroup[]
  affectedDocumentIds: readonly string[]
  directDocumentGrantsPreserved: true
  folderLocalPoliciesPreserved: true
  documentVersionsPreserved: true
}>

type FolderMoveStatus =
  | "initialized"
  | "prepared"
  | "documents_staging"
  | "documents_staged"
  | "subtree_committed"
  | "reconciliation_pending"
  | "projections_converged"
  | "rollback_pending"
  | "rolled_back"
  | "completed"

type FolderProjectionReference = Readonly<{
  folderId: string
  canonicalPath: string
  policySource: Exclude<FolderPolicySource, "none">
  policyId: string
  policyVersion: string
  inheritedFromFolderId?: string
}>

type LocalPolicySnapshot = Readonly<{
  folderId: string
  kind: "versioned" | "legacy"
  policyId: string
  version: string
}>

type FolderMoveSnapshot = Readonly<{
  current: DocumentGroup
  next: DocumentGroup
  beforeProjection: FolderProjectionReference
  afterProjection: FolderProjectionReference
}>

type DocumentMoveSnapshot = Readonly<{
  manifestKey: string
  sourceVersion: string
  sourceManifest: DocumentManifest
  stagedManifest: DocumentManifest
  targetManifest: DocumentManifest
  beforeProjection: readonly FolderProjectionReference[]
  afterProjection: readonly FolderProjectionReference[]
}>

type FolderMoveIntent = {
  schemaVersion: 1
  operationId: string
  fingerprint: string
  status: FolderMoveStatus
  actorId: string
  tenantId: string
  folderId: string
  destinationParentId: string | null
  requestedName: string
  reason: string
  expectedVersion: string
  folderSnapshots: FolderMoveSnapshot[]
  localPolicySnapshots: LocalPolicySnapshot[]
  documentSnapshots: DocumentMoveSnapshot[]
  auditIntentId?: string
  failureResult?: Exclude<SecurityMutationResult, "success">
  lastError?: string
  createdAt: string
  updatedAt: string
}

type VersionedState<T> = Readonly<{ value: T; version: string }>

export class FolderMoveConflictError extends Error {
  readonly code = "PRECONDITION_FAILED" as const

  constructor(message: string) {
    super(message)
    this.name = "FolderMoveConflictError"
  }
}

export class FolderMoveAuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "FolderMoveAuthorizationError"
  }
}

/**
 * Durable subtree move coordinator.
 *
 * Every affected document manifest is hidden before the atomic path-lock
 * transaction. Vector/index projections follow the same hidden state. A
 * pre-commit failure is rolled back to the complete before image. A
 * post-commit failure leaves only staging/hidden documents and a durable
 * reconciliation intent; retry converges them to the complete after image.
 */
export class FolderLifecycleMutationCoordinator {
  private readonly folderPermissions: FolderPermissionService
  private readonly auditOutbox: SecurityMutationAuditOutboxPort

  constructor(
    private readonly deps: CoordinatorDeps,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.folderPermissions = new FolderPermissionService(deps)
    this.auditOutbox = deps.securityAuditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(deps.objectStore, clock)
  }

  async moveFolder(actorSnapshot: AppUser, folderId: string, input: MoveFolderInput): Promise<MoveFolderResult> {
    validateMoveInput(folderId, input)
    const actorTenantId = authoritativeActorTenantForLookup(actorSnapshot)
    const groups = await this.deps.documentGroupStore.list(actorTenantId)
    const source = groups.find((group) => group.groupId === folderId)
    if (!source) throw new FolderMoveAuthorizationError()
    const tenantId = authoritativeGroupTenant(source)
    const stateKey = moveStateKey(this.deps, tenantId, folderId)
    let stored = await this.readState<FolderMoveIntent>(stateKey)

    if (stored && !isTerminal(stored.value.status)) {
      try {
        const actor = await this.resolveCurrentActor(actorSnapshot, tenantId)
        await this.authorizeMove(actor, stored.value.folderId, stored.value.destinationParentId, tenantId)
        if (!sameMoveRequest(stored.value, input)) {
          await this.recordRejectedAttempt(actor, source, input, "conflict")
          throw new FolderMoveConflictError("Another folder move is in progress")
        }
      } catch (error) {
        if (!(error instanceof FolderMoveConflictError)) {
          await this.recordRejectedAttempt(actorSnapshot, source, input, classifyFailure(error))
        }
        throw error
      }
      return this.runMoveStateMachine(actorSnapshot, stateKey, stored)
    }
    if (stored?.value.status === "completed" && sameMoveRequest(stored.value, input)) {
      const actor = await this.resolveCurrentActor(actorSnapshot, tenantId)
      await this.authorizeMove(actor, stored.value.folderId, stored.value.destinationParentId, tenantId)
      return moveResult(stored.value)
    }

    let intent: FolderMoveIntent
    try {
      const actor = await this.resolveCurrentActor(actorSnapshot, tenantId)
      await this.authorizeMove(actor, folderId, input.destinationParentId, tenantId)
      if (input.expectedVersion !== source.updatedAt) {
        throw new FolderMoveConflictError("Folder changed before move")
      }

      const now = this.clock().toISOString()
      const operationId = `folder_move_${randomUUID()}`
      intent = await this.prepareIntent({
        actor,
        groups,
        source,
        input,
        tenantId,
        operationId,
        now
      })
    } catch (error) {
      await this.recordRejectedAttempt(actorSnapshot, source, input, classifyFailure(error))
      throw error
    }
    try {
      stored = await this.writeState(stateKey, intent, stored?.version)
    } catch (error) {
      if (!isConditionalWriteError(error)) {
        await this.recordRejectedAttempt(actorSnapshot, source, input, "failed")
        throw error
      }
      const winner = await this.readState<FolderMoveIntent>(stateKey)
      if (!winner || !sameMoveRequest(winner.value, input)) {
        await this.recordRejectedAttempt(actorSnapshot, source, input, "conflict")
        throw new FolderMoveConflictError("Another folder move won the mutation race")
      }
      stored = winner
    }
    return this.runMoveStateMachine(actorSnapshot, stateKey, stored)
  }

  private async prepareIntent(input: {
    actor: AppUser
    groups: DocumentGroup[]
    source: DocumentGroup
    input: MoveFolderInput
    tenantId: string
    operationId: string
    now: string
  }): Promise<FolderMoveIntent> {
    const subtree = collectSubtree(input.groups, input.source, input.tenantId)
    if (subtree.some((group) => group.groupId === input.input.destinationParentId)) {
      throw new FolderMoveConflictError("Folder cannot move under its descendant")
    }
    if (subtree.length > maximumSynchronousSubtreeSize) {
      throw new FolderMoveConflictError("Folder subtree exceeds the atomic path-lock transaction limit")
    }
    const destination = input.input.destinationParentId === null
      ? undefined
      : input.groups.find((group) => group.groupId === input.input.destinationParentId)
    if (input.input.destinationParentId !== null && !destination) throw new FolderMoveAuthorizationError()
    if (destination && authoritativeGroupTenant(destination) !== input.tenantId) throw new FolderMoveAuthorizationError()

    const policyCatalog = createPolicyCatalog(await this.deps.folderPolicyStore.list(input.tenantId))
    const targetGroups = buildTargetGroups({
      allGroups: input.groups,
      subtree,
      destination,
      requestedName: input.input.newName ?? input.source.name,
      operationId: input.operationId,
      now: input.now,
      policyCatalog
    })
    assertNoPathConflicts(input.groups, subtree, targetGroups)
    const beforeById = new Map(input.groups.map((group) => [group.groupId, group]))
    const afterById = new Map(input.groups.map((group) => [group.groupId, targetGroups.get(group.groupId) ?? group]))
    const folderSnapshots = subtree.map((current) => {
      const next = requiredMapValue(targetGroups, current.groupId, "Target folder is missing")
      const beforeProjection = resolveFolderProjection(current.groupId, beforeById, policyCatalog)
      const afterProjection = resolveFolderProjection(next.groupId, afterById, policyCatalog)
      return {
        current,
        next: applyFolderProjection(next, afterProjection, input.operationId),
        beforeProjection,
        afterProjection
      }
    })
    const localPolicySnapshots = subtree
      .map((group) => localPolicyFor(group, policyCatalog))
      .filter((policy): policy is LocalPolicySnapshot => policy !== undefined)
    const documentSnapshots = await this.loadAffectedDocuments({
      tenantId: input.tenantId,
      subtreeIds: new Set(subtree.map((group) => group.groupId)),
      beforeById,
      afterById,
      policyCatalog,
      operationId: input.operationId,
      now: input.now
    })
    return {
      schemaVersion: 1,
      operationId: input.operationId,
      fingerprint: moveFingerprint(input.source.updatedAt, input.input),
      status: "initialized",
      actorId: input.actor.userId,
      tenantId: input.tenantId,
      folderId: input.source.groupId,
      destinationParentId: input.input.destinationParentId,
      requestedName: input.input.newName ?? input.source.name,
      reason: input.input.reason,
      expectedVersion: input.input.expectedVersion,
      folderSnapshots,
      localPolicySnapshots,
      documentSnapshots,
      createdAt: input.now,
      updatedAt: input.now
    }
  }

  private async loadAffectedDocuments(input: {
    tenantId: string
    subtreeIds: Set<string>
    beforeById: Map<string, DocumentGroup>
    afterById: Map<string, DocumentGroup>
    policyCatalog: PolicyCatalog
    operationId: string
    now: string
  }): Promise<DocumentMoveSnapshot[]> {
    const prefix = tenantManifestPrefix(this.deps, input.tenantId)
    const keys = (await this.deps.objectStore.listKeys(prefix))
      .filter((key) => key.endsWith(".json"))
      .sort()
    const snapshots: DocumentMoveSnapshot[] = []
    for (const key of keys) {
      const stored = await this.deps.objectStore.getTextWithVersion(key)
      const manifest = JSON.parse(stored.text) as DocumentManifest
      assertManifestTenant(manifest, input.tenantId, key)
      if (manifest.manifestObjectKey !== key || !canonical(manifest.documentId)) {
        throw new FolderMoveConflictError("Document manifest identity is invalid")
      }
      if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") !== "active") continue
      const folderIds = manifestFolderIds(manifest)
      if (!folderIds.some((folderId) => input.subtreeIds.has(folderId))) continue
      const beforeProjection = projectionForDocument(folderIds, input.beforeById, input.policyCatalog)
      const afterProjection = projectionForDocument(folderIds, input.afterById, input.policyCatalog)
      snapshots.push({
        manifestKey: key,
        sourceVersion: stored.version,
        sourceManifest: manifest,
        stagedManifest: projectManifest(manifest, afterProjection, input.operationId, input.now, "staging"),
        targetManifest: projectManifest(manifest, afterProjection, input.operationId, input.now, "active"),
        beforeProjection,
        afterProjection
      })
    }
    return snapshots
  }

  private async runMoveStateMachine(
    actorSnapshot: AppUser,
    stateKey: string,
    initial: VersionedState<FolderMoveIntent>
  ): Promise<MoveFolderResult> {
    let stored = initial
    for (let step = 0; step < 30; step += 1) {
      const intent = stored.value
      if (intent.status === "completed") return moveResult(intent)
      if (intent.status === "rolled_back") {
        throw new FolderMoveConflictError(intent.lastError ?? "Folder move was rolled back")
      }
      if (intent.status === "initialized") {
        const audit = await this.auditOutbox.prepare({
          actorId: intent.actorId,
          tenantId: intent.tenantId,
          targetType: "folder",
          targetId: intent.folderId,
          operation: "move",
          before: folderMoveAuditValue(intent, "before"),
          proposedAfter: folderMoveAuditValue(intent, "after"),
          reason: intent.reason,
          policyVersion: FOLDER_MOVE_POLICY_VERSION
        })
        stored = await this.advance(stateKey, stored, {
          status: "prepared",
          auditIntentId: audit.intentId,
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "prepared") {
        stored = await this.advance(stateKey, stored, {
          status: "documents_staging",
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "documents_staging") {
        try {
          await this.stageDocuments(intent)
          stored = await this.advance(stateKey, stored, {
            status: "documents_staged",
            updatedAt: this.clock().toISOString()
          })
        } catch (error) {
          stored = await this.markRollback(stateKey, stored, classifyFailure(error), error)
          await this.finishRollback(stateKey, stored)
          throw error
        }
        continue
      }
      if (intent.status === "rollback_pending") {
        await this.finishRollback(stateKey, stored)
        throw new FolderMoveConflictError(intent.lastError ?? "Folder move was rolled back")
      }
      if (intent.status === "documents_staged") {
        const commitState = await this.subtreeCommitState(intent)
        if (commitState === "after") {
          stored = await this.advance(stateKey, stored, {
            status: "subtree_committed",
            updatedAt: this.clock().toISOString()
          })
          continue
        }
        if (commitState === "conflict") {
          stored = await this.markRollback(stateKey, stored, "conflict", new Error("Folder subtree changed during move"))
          await this.finishRollback(stateKey, stored)
          throw new FolderMoveConflictError("Folder subtree changed during move")
        }
        try {
          const actor = await this.resolveCurrentActor(actorSnapshot, intent.tenantId)
          await this.authorizeMove(actor, intent.folderId, intent.destinationParentId, intent.tenantId)
          await this.assertLocalPolicySnapshots(intent)
          await this.assertDocumentsHidden(intent)
          await this.deps.documentGroupStore.updateWithPathLocks(
            intent.tenantId,
            intent.folderSnapshots.map(({ current, next }) => ({ current, next }))
          )
        } catch (error) {
          if (await this.subtreeCommitState(intent) === "after") {
            stored = await this.advance(stateKey, stored, {
              status: "subtree_committed",
              updatedAt: this.clock().toISOString()
            })
            continue
          }
          stored = await this.markRollback(stateKey, stored, classifyFailure(error), error)
          await this.finishRollback(stateKey, stored)
          throw normalizeConflict(error)
        }
        stored = await this.advance(stateKey, stored, {
          status: "subtree_committed",
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "subtree_committed" || intent.status === "reconciliation_pending") {
        try {
          const actor = await this.resolveCurrentActor(actorSnapshot, intent.tenantId)
          await this.authorizeMove(actor, intent.folderId, intent.destinationParentId, intent.tenantId)
          await this.convergeDocumentsToAfter(intent)
        } catch (error) {
          await this.advance(stateKey, stored, {
            status: "reconciliation_pending",
            lastError: errorMessage(error),
            updatedAt: this.clock().toISOString()
          }).catch(() => undefined)
          throw error
        }
        stored = await this.advance(stateKey, stored, {
          status: "projections_converged",
          lastError: undefined,
          updatedAt: this.clock().toISOString()
        })
        continue
      }
      if (intent.status === "projections_converged") {
        if (!intent.auditIntentId) throw new Error("Folder move audit intent is missing")
        await this.auditOutbox.complete(
          intent.auditIntentId,
          intent.tenantId,
          "success",
          folderMoveAuditValue(intent, "after")
        )
        stored = await this.advance(stateKey, stored, {
          status: "completed",
          updatedAt: this.clock().toISOString()
        })
        continue
      }
    }
    throw new Error("Folder move state machine exceeded its transition limit")
  }

  private async stageDocuments(intent: FolderMoveIntent): Promise<void> {
    for (const document of intent.documentSnapshots) {
      const current = await this.readManifest(document.manifestKey, intent.tenantId)
      if (!isManifestForMove(current.value, intent.operationId)) {
        if (current.version !== document.sourceVersion || hashJson(current.value) !== hashJson(document.sourceManifest)) {
          throw new FolderMoveConflictError(`Document ${document.sourceManifest.documentId} changed before folder move`)
        }
        await this.deps.objectStore.putTextIfVersion(
          document.manifestKey,
          JSON.stringify(document.stagedManifest, null, 2),
          current.version,
          "application/json"
        )
      } else if ((current.value.lifecycleStatus ?? stringValue(current.value.metadata?.lifecycleStatus)) !== "staging") {
        throw new FolderMoveConflictError("Document projection became active before subtree commit")
      }
      await this.rewriteDocumentProjections(document, document.afterProjection, "staging", intent.operationId)
    }
  }

  private async convergeDocumentsToAfter(intent: FolderMoveIntent): Promise<void> {
    if (await this.subtreeCommitState(intent) !== "after") {
      throw new FolderMoveConflictError("Folder subtree is not committed for reconciliation")
    }
    for (const document of intent.documentSnapshots) {
      await this.rewriteDocumentProjections(document, document.afterProjection, "active", intent.operationId)
      const current = await this.readManifest(document.manifestKey, intent.tenantId)
      if (isActiveTargetManifest(current.value, intent.operationId)) continue
      if (!isManifestForMove(current.value, intent.operationId)) {
        throw new FolderMoveConflictError(`Document ${document.sourceManifest.documentId} changed during reconciliation`)
      }
      await this.deps.objectStore.putTextIfVersion(
        document.manifestKey,
        JSON.stringify(document.targetManifest, null, 2),
        current.version,
        "application/json"
      )
    }
  }

  private async finishRollback(stateKey: string, stored: VersionedState<FolderMoveIntent>): Promise<void> {
    const intent = stored.value
    if (await this.subtreeCommitState(intent) === "after") {
      await this.advance(stateKey, stored, {
        status: "reconciliation_pending",
        lastError: intent.lastError,
        updatedAt: this.clock().toISOString()
      })
      throw new FolderMoveConflictError("Folder subtree committed; hidden document reconciliation is required")
    }
    for (const document of intent.documentSnapshots) {
      const current = await this.readManifest(document.manifestKey, intent.tenantId)
      if (isManifestForMove(current.value, intent.operationId)) {
        await this.rewriteDocumentProjections(document, document.beforeProjection, "active")
        const latest = await this.readManifest(document.manifestKey, intent.tenantId)
        if (isManifestForMove(latest.value, intent.operationId)) {
          await this.deps.objectStore.putTextIfVersion(
            document.manifestKey,
            JSON.stringify(document.sourceManifest, null, 2),
            latest.version,
            "application/json"
          )
        }
      } else if (hashJson(current.value) === hashJson(document.sourceManifest)) {
        await this.rewriteDocumentProjections(document, document.beforeProjection, "active")
      } else {
        throw new FolderMoveConflictError(`Document ${document.sourceManifest.documentId} cannot be rolled back safely`)
      }
    }
    const result = intent.failureResult ?? "failed"
    if (intent.auditIntentId) {
      await this.auditOutbox.complete(
        intent.auditIntentId,
        intent.tenantId,
        result,
        folderMoveAuditValue(intent, "before")
      )
    }
    await this.advance(stateKey, stored, {
      status: "rolled_back",
      updatedAt: this.clock().toISOString()
    })
  }

  private async rewriteDocumentProjections(
    document: DocumentMoveSnapshot,
    projection: readonly FolderProjectionReference[],
    lifecycleStatus: "active" | "staging",
    operationId?: string
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.rewriteVectorProjection(
        this.deps.evidenceVectorStore,
        document.sourceManifest.evidenceVectorKeys ?? document.sourceManifest.vectorKeys,
        projection,
        lifecycleStatus,
        operationId
      ),
      this.rewriteVectorProjection(
        this.deps.memoryVectorStore,
        document.sourceManifest.memoryVectorKeys ?? document.sourceManifest.vectorKeys,
        projection,
        lifecycleStatus,
        operationId
      )
    ])
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `Folder move document projection failed: ${failures.map((failure) => errorMessage(failure.reason)).join("; ")}`
      )
    }
  }

  private async rewriteVectorProjection(
    store: VectorStore,
    rawKeys: readonly string[],
    projection: readonly FolderProjectionReference[],
    lifecycleStatus: "active" | "staging",
    operationId?: string
  ): Promise<void> {
    const keys = [...new Set(rawKeys)]
    if (keys.length === 0) return
    if (!store.getByKeys) throw new Error("Vector store cannot read records for coherent folder move")
    const records = await store.getByKeys(keys)
    if (records.length !== keys.length || new Set(records.map((record) => record.key)).size !== keys.length) {
      throw new Error("Folder move vector projection is incomplete")
    }
    await store.put(records.map((record) => ({
      ...record,
      metadata: vectorProjectionMetadata(record.metadata, projection, lifecycleStatus, operationId)
    })))
  }

  private async assertDocumentsHidden(intent: FolderMoveIntent): Promise<void> {
    for (const document of intent.documentSnapshots) {
      const current = await this.readManifest(document.manifestKey, intent.tenantId)
      if (!isManifestForMove(current.value, intent.operationId) || current.value.lifecycleStatus !== "staging") {
        throw new FolderMoveConflictError("Affected document is not hidden before subtree commit")
      }
    }
  }

  private async assertLocalPolicySnapshots(intent: FolderMoveIntent): Promise<void> {
    const groups = new Map((await this.deps.documentGroupStore.list(intent.tenantId)).map((group) => [group.groupId, group]))
    const catalog = createPolicyCatalog(await this.deps.folderPolicyStore.list(intent.tenantId))
    for (const snapshot of intent.localPolicySnapshots) {
      const group = groups.get(snapshot.folderId)
      if (!group) throw new FolderMoveConflictError("Folder-local policy owner disappeared")
      const current = localPolicyFor(group, catalog)
      if (!current || current.kind !== snapshot.kind || current.policyId !== snapshot.policyId || current.version !== snapshot.version) {
        throw new FolderMoveConflictError("Folder-local explicit policy changed during move")
      }
    }
  }

  private async subtreeCommitState(intent: FolderMoveIntent): Promise<"before" | "after" | "conflict"> {
    const current = new Map((await this.deps.documentGroupStore.list(intent.tenantId)).map((group) => [group.groupId, group]))
    const states = intent.folderSnapshots.map((snapshot) => {
      const value = current.get(snapshot.current.groupId)
      if (!value) return "conflict" as const
      if (
        value.folderMoveOperationId === intent.operationId &&
        value.folderProjectionVersion === intent.operationId &&
        hashJson(value) === hashJson(snapshot.next)
      ) return "after" as const
      if (hashJson(value) === hashJson(snapshot.current)) return "before" as const
      return "conflict" as const
    })
    if (states.every((state) => state === "before")) return "before"
    if (states.every((state) => state === "after")) return "after"
    return "conflict"
  }

  private async authorizeMove(
    actor: AppUser,
    sourceFolderId: string,
    destinationParentId: string | null,
    tenantId: string
  ): Promise<void> {
    assertCurrentActorShape(actor, tenantId)
    if (!hasPermission(actor, "folder.move")) throw new FolderMoveAuthorizationError()
    const source = await this.deps.documentGroupStore.get(tenantId, sourceFolderId)
    if (!source || source.status !== "active" || authoritativeGroupTenant(source) !== tenantId) {
      throw new FolderMoveAuthorizationError()
    }
    const sourceDecision = await this.folderPermissions.resolveEffectiveFolderPermissionDecision(actor, sourceFolderId)
    if (sourceDecision.permission !== "full") {
      throw new FolderMoveAuthorizationError()
    }
    let destination: DocumentGroup | undefined
    let destinationPermission = "full" as const
    if (destinationParentId !== null) {
      destination = await this.deps.documentGroupStore.get(tenantId, destinationParentId)
      if (!destination || destination.status !== "active" || authoritativeGroupTenant(destination) !== tenantId) {
        throw new FolderMoveAuthorizationError()
      }
      const destinationDecision = await this.folderPermissions.resolveEffectiveFolderPermissionDecision(actor, destinationParentId)
      if (destinationDecision.permission !== "full") throw new FolderMoveAuthorizationError()
      if (destination.groupId === sourceFolderId || (destination.ancestorGroupIds ?? []).includes(sourceFolderId)) {
        throw new FolderMoveConflictError("Folder cannot move under itself or a descendant")
      }
      destinationPermission = destinationDecision.permission
    }
    try {
      enforceResolvedResourceOperation(actor, {
        resourceType: "folder",
        operation: "move",
        authorizationPath: "sourceAndDestinationFolders",
        resourceScopes: {
          target: resolvedResourceScope({
            tenantId,
            permission: sourceDecision.permission,
            administrativePrincipal: source.adminPrincipalType === "user" && source.adminPrincipalId === actor.userId
          }),
          destinationContainer: resolvedResourceScope({
            tenantId,
            permission: destinationPermission,
            administrativePrincipal: destination?.adminPrincipalType === "user" && destination.adminPrincipalId === actor.userId
          })
        },
        satisfiedGuards: ["sameTenantMove", "nonCyclicPath", "descendantImpactConfirmed"]
      })
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) throw new FolderMoveAuthorizationError()
      throw error
    }
  }

  private async resolveCurrentActor(actor: AppUser, tenantId: string): Promise<AppUser> {
    const provider: VerifiedIdentityProvider | undefined = this.deps.verifiedIdentityProvider
    if (!provider) {
      assertCurrentActorShape(actor, tenantId)
      return actor
    }
    let identity
    try {
      identity = await provider.getCurrentIdentityBySubject(actor.userId)
    } catch {
      throw new FolderMoveAuthorizationError("Authoritative identity is unavailable")
    }
    if (
      !identity ||
      identity.userId !== actor.userId ||
      identity.accountStatus !== "active" ||
      identity.tenantId !== tenantId ||
      actor.tenantId !== tenantId
    ) throw new FolderMoveAuthorizationError()
    return {
      userId: identity.userId,
      identityUsername: identity.username,
      email: identity.email,
      cognitoGroups: [...identity.cognitoGroups],
      accountStatus: identity.accountStatus,
      tenantId: identity.tenantId
    }
  }

  private async markRollback(
    stateKey: string,
    stored: VersionedState<FolderMoveIntent>,
    result: Exclude<SecurityMutationResult, "success">,
    error: unknown
  ): Promise<VersionedState<FolderMoveIntent>> {
    return this.advance(stateKey, stored, {
      status: "rollback_pending",
      failureResult: result,
      lastError: errorMessage(error),
      updatedAt: this.clock().toISOString()
    })
  }

  private async recordRejectedAttempt(
    actor: AppUser,
    source: DocumentGroup,
    input: MoveFolderInput,
    result: Exclude<SecurityMutationResult, "success">
  ): Promise<void> {
    const tenantId = authoritativeGroupTenant(source)
    const before = preflightAuditValue(source)
    const audit = await this.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId,
      targetType: "folder",
      targetId: source.groupId,
      operation: "move",
      before,
      proposedAfter: {
        folderId: source.groupId,
        destinationParentId: input.destinationParentId,
        requestedName: input.newName ?? source.name,
        expectedVersion: input.expectedVersion
      },
      reason: input.reason,
      policyVersion: FOLDER_MOVE_POLICY_VERSION
    })
    await this.auditOutbox.complete(audit.intentId, tenantId, result, before)
  }

  private async advance(
    stateKey: string,
    stored: VersionedState<FolderMoveIntent>,
    patch: Partial<FolderMoveIntent>
  ): Promise<VersionedState<FolderMoveIntent>> {
    try {
      return await this.writeState(stateKey, { ...stored.value, ...patch }, stored.version)
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const current = await this.readState<FolderMoveIntent>(stateKey)
      if (!current || current.value.operationId !== stored.value.operationId) {
        throw new FolderMoveConflictError("Folder move state changed concurrently")
      }
      return current
    }
  }

  private async readManifest(key: string, tenantId: string): Promise<VersionedState<DocumentManifest>> {
    const stored = await this.deps.objectStore.getTextWithVersion(key)
    const value = JSON.parse(stored.text) as DocumentManifest
    assertManifestTenant(value, tenantId, key)
    if (value.manifestObjectKey !== key || !canonical(value.documentId)) {
      throw new FolderMoveConflictError("Document manifest identity is invalid")
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

type PolicyCatalog = Readonly<{
  byFolderId: ReadonlyMap<string, FolderPolicy>
  byPolicyId: ReadonlyMap<string, FolderPolicy>
}>

function createPolicyCatalog(policies: readonly FolderPolicy[]): PolicyCatalog {
  const byFolderId = new Map<string, FolderPolicy>()
  const byPolicyId = new Map<string, FolderPolicy>()
  for (const policy of policies) {
    if (byFolderId.has(policy.folderId) || byPolicyId.has(policy.policyId)) {
      throw new FolderMoveConflictError("Folder policy catalog is not unique")
    }
    byFolderId.set(policy.folderId, policy)
    byPolicyId.set(policy.policyId, policy)
  }
  return { byFolderId, byPolicyId }
}

function localPolicyFor(group: DocumentGroup, catalog: PolicyCatalog): LocalPolicySnapshot | undefined {
  const direct = catalog.byFolderId.get(group.groupId)
  if (direct) {
    if (direct.tenantId !== authoritativeGroupTenant(group)) throw new FolderMoveConflictError("Folder policy tenant mismatch")
    return {
      folderId: group.groupId,
      kind: "versioned",
      policyId: direct.policyId,
      version: folderPolicyStateVersion(direct)
    }
  }
  if (group.policyId) {
    const byId = catalog.byPolicyId.get(group.policyId)
    if (!byId || byId.folderId !== group.groupId || byId.tenantId !== authoritativeGroupTenant(group)) {
      throw new FolderMoveConflictError("Folder-local explicit policy is missing")
    }
    return {
      folderId: group.groupId,
      kind: "versioned",
      policyId: byId.policyId,
      version: folderPolicyStateVersion(byId)
    }
  }
  if (group.hasExplicitPolicy !== undefined) {
    return {
      folderId: group.groupId,
      kind: "legacy",
      policyId: `legacy-folder-policy:${group.groupId}`,
      version: legacyFolderPolicyVersion(group)
    }
  }
  return undefined
}

function resolveFolderProjection(
  folderId: string,
  groups: ReadonlyMap<string, DocumentGroup>,
  catalog: PolicyCatalog
): FolderProjectionReference {
  const target = groups.get(folderId)
  if (!target || !target.canonicalPath) throw new FolderMoveConflictError("Folder projection path is missing")
  const tenantId = authoritativeGroupTenant(target)
  let current: DocumentGroup | undefined = target
  let inherited = false
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current.groupId)) throw new FolderMoveConflictError("Folder hierarchy contains a cycle")
    visited.add(current.groupId)
    if (authoritativeGroupTenant(current) !== tenantId || current.status !== "active") {
      throw new FolderMoveConflictError("Folder hierarchy tenant or lifecycle is invalid")
    }
    const local = localPolicyFor(current, catalog)
    if (local) {
      return {
        folderId,
        canonicalPath: target.canonicalPath,
        policySource: inherited ? "inherited" : "explicit",
        policyId: local.policyId,
        policyVersion: local.version,
        ...(inherited ? { inheritedFromFolderId: current.groupId } : {})
      }
    }
    current = current.parentGroupId ? groups.get(current.parentGroupId) : undefined
    inherited = true
  }
  return {
    folderId,
    canonicalPath: target.canonicalPath,
    policySource: "ownerDefault",
    policyId: `owner-default:${target.adminPrincipalType}:${target.adminPrincipalId}`,
    policyVersion: ownerDefaultPolicyVersion(target)
  }
}

function applyFolderProjection(
  group: DocumentGroup,
  projection: FolderProjectionReference,
  operationId: string
): DocumentGroup {
  return {
    ...group,
    policySource: projection.policySource,
    inheritedFromFolderId: projection.inheritedFromFolderId,
    inheritedPolicyId: projection.policySource === "inherited" ? projection.policyId : undefined,
    inheritedPolicyVersion: projection.policySource === "inherited" ? projection.policyVersion : undefined,
    folderLocalPolicyVersion: projection.policySource === "explicit" ? projection.policyVersion : undefined,
    folderProjectionVersion: operationId,
    folderMoveOperationId: operationId
  }
}

function buildTargetGroups(input: {
  allGroups: readonly DocumentGroup[]
  subtree: readonly DocumentGroup[]
  destination?: DocumentGroup
  requestedName: string
  operationId: string
  now: string
  policyCatalog: PolicyCatalog
}): Map<string, DocumentGroup> {
  const children = new Map<string, DocumentGroup[]>()
  for (const group of input.subtree) {
    if (group.parentGroupId) children.set(group.parentGroupId, [...(children.get(group.parentGroupId) ?? []), group])
  }
  const root = input.subtree[0]
  if (!root) throw new FolderMoveConflictError("Folder subtree is empty")
  const targets = new Map<string, DocumentGroup>()
  const queue: Array<{ current: DocumentGroup; parent?: DocumentGroup; name: string }> = [{
    current: root,
    parent: input.destination,
    name: input.requestedName
  }]
  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) continue
    // Moving changes hierarchy and inherited policy references, not the
    // folder-local administrative principal. The destination principal is an
    // authorization boundary only; adopting it here would silently transfer
    // ownership outside the dedicated administrative-transfer workflow.
    const adminPrincipalType = item.current.adminPrincipalType
    const adminPrincipalId = item.current.adminPrincipalId
    const tenantId = item.current.tenantId
    if (!adminPrincipalType || !canonical(adminPrincipalId) || !canonical(tenantId)) {
      throw new FolderMoveConflictError("Folder administrative path is not authoritative")
    }
    const normalizedName = normalizeFolderName(item.name)
    const adminPathPk = `${tenantId}#${adminPrincipalType}#${adminPrincipalId}`
    const canonicalPath = item.parent?.canonicalPath ? `${item.parent.canonicalPath}/${item.name}` : `/${item.name}`
    const normalizedCanonicalPath = item.parent?.normalizedCanonicalPath
      ? `${item.parent.normalizedCanonicalPath}/${normalizedName}`
      : `/${normalizedName}`
    const next: DocumentGroup = {
      ...item.current,
      schemaVersion: 2,
      itemType: "documentGroup",
      tenantId,
      adminPrincipalType,
      adminPrincipalId,
      name: item.name,
      normalizedName,
      canonicalPath,
      normalizedCanonicalPath,
      adminPathPk,
      parentPathPk: `${adminPathPk}#${item.parent?.groupId ?? "ROOT"}`,
      parentGroupId: item.parent?.groupId,
      ancestorGroupIds: item.parent ? [...(item.parent.ancestorGroupIds ?? []), item.parent.groupId] : [],
      updatedAt: input.now,
      folderProjectionVersion: input.operationId,
      folderMoveOperationId: input.operationId
    }
    targets.set(next.groupId, next)
    for (const child of children.get(item.current.groupId) ?? []) {
      queue.push({ current: child, parent: next, name: child.name })
    }
  }
  return targets
}

function collectSubtree(groups: readonly DocumentGroup[], root: DocumentGroup, tenantId: string): DocumentGroup[] {
  const children = new Map<string, DocumentGroup[]>()
  for (const group of groups) {
    if (group.parentGroupId) children.set(group.parentGroupId, [...(children.get(group.parentGroupId) ?? []), group])
  }
  const result: DocumentGroup[] = []
  const queue = [root]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    if (visited.has(current.groupId)) throw new FolderMoveConflictError("Folder hierarchy contains a cycle")
    visited.add(current.groupId)
    if (authoritativeGroupTenant(current) !== tenantId || current.status !== "active") {
      throw new FolderMoveConflictError("Folder subtree tenant or lifecycle is invalid")
    }
    if (!current.canonicalPath || !current.normalizedCanonicalPath || !current.adminPathPk || !current.parentPathPk) {
      throw new FolderMoveConflictError("Folder subtree path metadata is incomplete")
    }
    result.push(current)
    queue.push(...(children.get(current.groupId) ?? []))
  }
  return result
}

function assertNoPathConflicts(
  allGroups: readonly DocumentGroup[],
  subtree: readonly DocumentGroup[],
  targets: ReadonlyMap<string, DocumentGroup>
): void {
  const subtreeIds = new Set(subtree.map((group) => group.groupId))
  const targetKeys = new Set<string>()
  for (const target of targets.values()) {
    const key = `${target.adminPathPk}\u0000${target.normalizedCanonicalPath}`
    if (targetKeys.has(key)) throw new FolderMoveConflictError("Folder subtree contains a duplicate target path")
    targetKeys.add(key)
    if (allGroups.some((candidate) => (
      !subtreeIds.has(candidate.groupId) &&
      candidate.adminPathPk === target.adminPathPk &&
      candidate.normalizedCanonicalPath === target.normalizedCanonicalPath
    ))) throw new FolderMoveConflictError("Folder target path already exists")
  }
}

function projectionForDocument(
  folderIds: readonly string[],
  groups: ReadonlyMap<string, DocumentGroup>,
  catalog: PolicyCatalog
): FolderProjectionReference[] {
  return [...new Set(folderIds)].sort().map((folderId) => resolveFolderProjection(folderId, groups, catalog))
}

function projectManifest(
  source: DocumentManifest,
  projection: readonly FolderProjectionReference[],
  operationId: string,
  now: string,
  lifecycleStatus: "active" | "staging"
): DocumentManifest {
  return {
    ...source,
    lifecycleStatus,
    metadata: {
      ...(source.metadata ?? {}),
      lifecycleStatus,
      folderCanonicalPaths: projection.map((reference) => reference.canonicalPath),
      folderPolicyRefs: projection.map(policyReferenceToken),
      folderProjectionVersion: operationId,
      folderMoveOperationId: operationId
    },
    updatedAt: now
  }
}

function vectorProjectionMetadata(
  source: VectorMetadata,
  projection: readonly FolderProjectionReference[],
  lifecycleStatus: "active" | "staging",
  operationId?: string
): VectorMetadata {
  const next = { ...source, lifecycleStatus }
  delete next.folderCanonicalPaths
  delete next.folderPolicyRefs
  delete next.folderProjectionVersion
  delete next.folderMoveOperationId
  next.folderCanonicalPaths = projection.map((reference) => reference.canonicalPath)
  next.folderPolicyRefs = projection.map(policyReferenceToken)
  if (operationId) {
    next.folderProjectionVersion = operationId
    next.folderMoveOperationId = operationId
  }
  return next
}

function policyReferenceToken(reference: FolderProjectionReference): string {
  return JSON.stringify({
    folderId: reference.folderId,
    policySource: reference.policySource,
    policyId: reference.policyId,
    policyVersion: reference.policyVersion,
    inheritedFromFolderId: reference.inheritedFromFolderId ?? null
  })
}

function folderMoveAuditValue(intent: FolderMoveIntent, state: "before" | "after"): JsonValue {
  return {
    operationId: intent.operationId,
    folderId: intent.folderId,
    destinationParentId: state === "before"
      ? intent.folderSnapshots.find((snapshot) => snapshot.current.groupId === intent.folderId)?.current.parentGroupId ?? null
      : intent.destinationParentId,
    subtree: intent.folderSnapshots.map((snapshot) => ({
      folderId: snapshot.current.groupId,
      canonicalPath: state === "before" ? snapshot.current.canonicalPath ?? null : snapshot.next.canonicalPath ?? null,
      policyRef: policyReferenceToken(state === "before" ? snapshot.beforeProjection : snapshot.afterProjection)
    })),
    affectedDocumentIds: intent.documentSnapshots.map((snapshot) => snapshot.sourceManifest.documentId),
    directDocumentGrantsPreserved: true,
    folderLocalPoliciesPreserved: true,
    documentVersionsPreserved: true
  }
}

function preflightAuditValue(source: DocumentGroup): JsonValue {
  return {
    folderId: source.groupId,
    tenantId: authoritativeGroupTenant(source),
    parentGroupId: source.parentGroupId ?? null,
    canonicalPath: source.canonicalPath ?? null,
    updatedAt: source.updatedAt,
    status: source.status ?? null
  }
}

function moveResult(intent: FolderMoveIntent): MoveFolderResult {
  const folder = intent.folderSnapshots.find((snapshot) => snapshot.next.groupId === intent.folderId)?.next
  if (!folder) throw new Error("Folder move result is missing its root")
  return {
    operationId: intent.operationId,
    folder,
    subtree: intent.folderSnapshots.map((snapshot) => snapshot.next),
    affectedDocumentIds: intent.documentSnapshots.map((snapshot) => snapshot.sourceManifest.documentId),
    directDocumentGrantsPreserved: true,
    folderLocalPoliciesPreserved: true,
    documentVersionsPreserved: true
  }
}

function validateMoveInput(folderId: string, input: MoveFolderInput): void {
  if (!canonical(folderId)) throw new Error("folderId is required")
  if (input.destinationParentId !== null && !canonical(input.destinationParentId)) {
    throw new Error("destinationParentId must be canonical or null")
  }
  if (!input.reason || input.reason.trim() !== input.reason) throw new Error("reason is required and must be canonical")
  if (input.newName !== undefined) normalizeFolderName(input.newName)
  if (!canonical(input.expectedVersion)) throw new Error("expectedVersion is required and must be canonical")
}

function normalizeFolderName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP")
  if (!value || value.trim() !== value || value.includes("/") || value.includes("\\") || !normalized) {
    throw new Error("Folder name is invalid")
  }
  return normalized
}

function manifestFolderIds(manifest: DocumentManifest): string[] {
  const raw = manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId
  const values = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : []
  const result = [...new Set(values.filter((value): value is string => typeof value === "string" && canonical(value)))]
  if (values.length !== result.length || result.length === 0) {
    throw new FolderMoveConflictError("Document folder scope is invalid")
  }
  return result
}

function authoritativeGroupTenant(group: DocumentGroup): string {
  if (!canonical(group.tenantId)) throw new FolderMoveAuthorizationError("Folder tenant is not authoritative")
  return group.tenantId
}

function authoritativeActorTenantForLookup(actor: AppUser): string {
  if (!isActiveAccount(actor) || !canonical(actor.userId) || !canonical(actor.tenantId)) {
    throw new FolderMoveAuthorizationError()
  }
  return actor.tenantId
}

function assertCurrentActorShape(actor: AppUser, tenantId: string): void {
  if (
    !isActiveAccount(actor) ||
    !canonical(actor.userId) ||
    !canonical(actor.tenantId) ||
    actor.tenantId !== tenantId
  ) throw new FolderMoveAuthorizationError()
}

function ownerDefaultPolicyVersion(group: DocumentGroup): string {
  return `folder-owner-default-v1:${hashJson({
    tenantId: group.tenantId,
    adminPrincipalType: group.adminPrincipalType,
    adminPrincipalId: group.adminPrincipalId,
    ownerUserId: group.ownerUserId,
    visibility: group.visibility,
    sharedUserIds: [...group.sharedUserIds].sort(),
    sharedGroups: [...group.sharedGroups].sort(),
    managerUserIds: [...group.managerUserIds].sort()
  })}`
}

function legacyFolderPolicyVersion(group: DocumentGroup): string {
  return `legacy-folder-policy-v1:${hashJson({
    folderId: group.groupId,
    visibility: group.visibility,
    sharedUserIds: [...group.sharedUserIds].sort(),
    sharedGroups: [...group.sharedGroups].sort(),
    managerUserIds: [...group.managerUserIds].sort()
  })}`
}

function moveFingerprint(sourceUpdatedAt: string, input: MoveFolderInput): string {
  return hashJson({
    sourceUpdatedAt,
    destinationParentId: input.destinationParentId,
    newName: input.newName ?? null,
    reason: input.reason,
    expectedVersion: input.expectedVersion
  })
}

function sameMoveRequest(intent: FolderMoveIntent, input: MoveFolderInput): boolean {
  return intent.destinationParentId === input.destinationParentId &&
    intent.requestedName === (input.newName ?? intent.folderSnapshots.find((snapshot) => snapshot.current.groupId === intent.folderId)?.current.name) &&
    intent.reason === input.reason &&
    intent.expectedVersion === input.expectedVersion
}

function isTerminal(status: FolderMoveStatus): boolean {
  return status === "completed" || status === "rolled_back"
}

function isManifestForMove(manifest: DocumentManifest, operationId: string): boolean {
  return manifest.metadata?.folderMoveOperationId === operationId
}

function isActiveTargetManifest(manifest: DocumentManifest, operationId: string): boolean {
  return isManifestForMove(manifest, operationId) &&
    manifest.lifecycleStatus === "active" &&
    manifest.metadata?.lifecycleStatus === "active"
}

function moveStateKey(deps: CoordinatorDeps, tenantId: string, folderId: string): string {
  return tenantDocumentArtifactKey(
    deps,
    tenantId,
    `folder-mutations/move/${encodeURIComponent(folderId)}.json`
  )
}

function classifyFailure(error: unknown): Exclude<SecurityMutationResult, "success"> {
  if (error instanceof FolderMoveAuthorizationError) return "denied"
  if (error instanceof FolderMoveConflictError || isConditionalWriteError(error)) return "conflict"
  return "failed"
}

function normalizeConflict(error: unknown): unknown {
  if (error instanceof FolderMoveAuthorizationError || error instanceof FolderMoveConflictError) return error
  if (isConditionalWriteError(error) || (error instanceof Error && /changed|conflict|already exists/i.test(error.message))) {
    return new FolderMoveConflictError(errorMessage(error))
  }
  return error
}

function requiredMapValue<K, V>(map: ReadonlyMap<K, V>, key: K, message: string): V {
  const value = map.get(key)
  if (value === undefined) throw new FolderMoveConflictError(message)
  return value
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function canonical(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function isConditionalWriteError(error: unknown): boolean {
  return error instanceof Error && (
    (error as Error & { code?: string }).code === "PRECONDITION_FAILED" ||
    error.name === "PreconditionFailed" ||
    error.name === "ConditionalCheckFailedException" ||
    error.name === "TransactionCanceledException" ||
    /changed before path update|canonical path already exists/i.test(error.message)
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
