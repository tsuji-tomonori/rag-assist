import type { Dependencies } from "../../../dependencies.js"
import { ragRuntimePolicy } from "../../../chat-orchestration/runtime-policy.js"
import { assertRagSafetyInterlock } from "../../quality-control/production-rag-monitor.js"
import type {
  DocumentManifest,
  MemoryCard,
  PublicationControl,
  PublicationPurpose,
  SourceLocation,
  StagedPublicationFence,
  VersionedRecordReference,
  VectorRecord
} from "../../../types.js"
import { isQualityApprovedForNormalRag } from "../policies/quality-policy.js"
import { readCurrentSourceGovernanceRecord } from "../../offline/pre-retrieval/admission/source-governance-approval-service.js"
import {
  createDerivedRecordSecurityEnvelope,
  derivedRecordSetHash,
  isCompleteApprovedAdmission,
  reconcileDerivedArtifacts,
  stableHash,
  verifyDerivedRecordSecurityEnvelope
} from "../security/derived-record-security.js"
import {
  tenantDocumentArtifactKey,
  tenantManifestKey,
  tenantVectorKey
} from "../storage/tenant-artifacts.js"

export type PublicationScope = {
  tenantId: string
  actorId: string
  sourceId: string
  sourceVersion: string
  purpose: PublicationPurpose
}

export type PublicationCheckpoint =
  | "initialized"
  | "lease_acquired"
  | "artifacts_staged"
  | "validation_complete"
  | "commit_prepared"
  | "pointer_committed"
  | "committed"
  | "rollback_prepared"
  | "rolled_back"

export type StagedPublicationStatus = "initialized" | "staging" | "validated" | "committing" | "committed" | "rolling_back" | "rolled_back"

export type StagedArtifactRecord = {
  manifestObjectKey: string
  documentId: string
  documentVersion: string
  evidenceVectorKeys: string[]
  memoryVectorKeys: string[]
  manifestHash: string
  recordSetHash: string
  generation: number
  fencingToken: string
}

export type PreparedCommitRecord = {
  namespace: string
  manifestObjectKey: string
  evidenceVectorKeys: string[]
  memoryVectorKeys: string[]
  generation: number
  fencingToken: string
}

export type PreparedRollbackRecord = {
  artifactId: string
  sourceArtifactId: string
  namespace: string
  manifestObjectKey: string
  sourceObjectKey: string
  structuredBlocksObjectKey?: string
  memoryCardsObjectKey?: string
  evidenceVectorKeys: string[]
  memoryVectorKeys: string[]
  manifestHash: string
  recordSetHash: string
  pointerRunId: string
  generation: number
  fencingToken: string
}

export type StagedPublicationRun = {
  schemaVersion: 1
  runId: string
  artifactId: string
  idempotencyKey: string
  scopeHash: string
  scope: PublicationScope
  status: StagedPublicationStatus
  checkpoint: PublicationCheckpoint
  generation: number
  activePointerKey: string
  previousActiveArtifactId: string
  previousManifestObjectKey: string
  lease?: {
    owner: string
    expiresAt: string
    generation: number
    fencingToken: string
  }
  stagedArtifact?: StagedArtifactRecord
  preparedCommit?: PreparedCommitRecord
  preparedRollback?: PreparedRollbackRecord
  committedAt?: string
  rolledBackAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export type ActivePublicationPointer = {
  schemaVersion: 1
  scopeHash: string
  tenantId: string
  sourceId: string
  purpose: PublicationPurpose
  artifactId: string
  manifestObjectKey: string
  runId: string
  generation: number
  fencingToken: string
  previousArtifactId?: string
  previousManifestObjectKey?: string
  committedAt: string
}

export type PublicationLease = {
  run: StagedPublicationRun
  fence: StagedPublicationFence
  stateVersion: string
}

export type PublicationPointerSnapshot = Map<string, Promise<ActivePublicationPointer | undefined>>

export function createPublicationPointerSnapshot(): PublicationPointerSnapshot {
  return new Map()
}

export type BeginPublicationResult = {
  run: StagedPublicationRun
  lease?: PublicationLease
  alreadyStaged: boolean
}

export type StagedPublicationHooks = {
  afterPrepared?: (run: StagedPublicationRun) => Promise<void>
  afterPointerCommitted?: (pointer: ActivePublicationPointer) => Promise<void>
  afterRollbackPrepared?: (prepared: PreparedRollbackRecord) => Promise<void>
  beforeRollbackPointerCommitted?: (pointer: ActivePublicationPointer) => Promise<void>
  afterRollbackPointerCommitted?: (pointer: ActivePublicationPointer) => Promise<void>
}

type CoordinatorDeps = Pick<Dependencies,
  | "objectStore"
  | "evidenceVectorStore"
  | "memoryVectorStore"
  | "localTestIngestAdmissionContext"
  | "legacyGlobalDocumentArtifacts"
>

const defaultLeaseMs = 30_000
const maxCasAttempts = 12

export class PublicationLeaseConflictError extends Error {
  constructor(runId: string) {
    super(`Publication lease is held by another worker: ${runId}`)
    this.name = "PublicationLeaseConflictError"
  }
}

export class PublicationFenceError extends Error {
  constructor(runId: string) {
    super(`Publication fencing token is stale: ${runId}`)
    this.name = "PublicationFenceError"
  }
}

export class StagedPublicationCoordinator {
  constructor(
    private readonly deps: CoordinatorDeps,
    private readonly hooks: StagedPublicationHooks = {},
    private readonly clock: () => Date = () => new Date()
  ) {}

  async begin(input: {
    scope: PublicationScope
    sourceManifest: DocumentManifest
    workerId: string
    leaseMs?: number
  }): Promise<BeginPublicationResult> {
    const identity = publicationIdentity(input.scope)
    const pointer = await this.ensureBootstrapPointer(input.scope, input.sourceManifest, activePointerScopeHash(input.scope))
    await this.annotateManifestWithPublicationControl(input.sourceManifest, pointer)
    const runKey = publicationRunKey(identity.runId)
    let stored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
    if (!stored) {
      const now = this.clock().toISOString()
      const initial: StagedPublicationRun = {
        schemaVersion: 1,
        runId: identity.runId,
        artifactId: identity.artifactId,
        idempotencyKey: identity.idempotencyKey,
        scopeHash: identity.scopeHash,
        scope: normalizeScope(input.scope),
        status: "initialized",
        checkpoint: "initialized",
        generation: 0,
        activePointerKey: activePublicationPointerKey(input.scope),
        previousActiveArtifactId: pointer.artifactId,
        previousManifestObjectKey: pointer.manifestObjectKey,
        createdAt: now,
        updatedAt: now
      }
      try {
        await this.deps.objectStore.putTextIfVersion(runKey, JSON.stringify(initial, null, 2), undefined, "application/json")
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
      }
      stored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
    }
    if (!stored || stored.value.scopeHash !== identity.scopeHash || stored.value.idempotencyKey !== identity.idempotencyKey) {
      throw new Error("Publication idempotency state is inconsistent")
    }
    if (stored.value.status === "committed" || stored.value.status === "validated") {
      return { run: stored.value, alreadyStaged: true }
    }
    const lease = await this.acquireLease(stored.value.runId, input.workerId, input.leaseMs)
    return { run: lease.run, lease, alreadyStaged: false }
  }

  async recordStaged(lease: PublicationLease, manifest: DocumentManifest): Promise<StagedPublicationRun> {
    await this.validateStagedManifest(lease.run, lease.fence, manifest)
    const next = await this.updateWithFence(lease, (run, now) => ({
      ...run,
      status: "validated",
      checkpoint: "validation_complete",
      lease: undefined,
      lastError: undefined,
      stagedArtifact: {
        manifestObjectKey: manifest.manifestObjectKey,
        documentId: manifest.documentId,
        documentVersion: manifest.documentVersion!,
        evidenceVectorKeys: [...(manifest.evidenceVectorKeys ?? [])],
        memoryVectorKeys: [...(manifest.memoryVectorKeys ?? [])],
        manifestHash: manifest.derivedIntegrity!.manifestHash,
        recordSetHash: manifest.derivedIntegrity!.recordSetHash,
        generation: lease.fence.generation,
        fencingToken: lease.fence.fencingToken
      },
      updatedAt: now
    }))
    return next.run
  }

  async commit(runId: string, workerId: string, leaseMs = defaultLeaseMs): Promise<{ run: StagedPublicationRun; manifest: DocumentManifest; pointer: ActivePublicationPointer }> {
    await assertRagSafetyInterlock({
      objectStore: this.deps.objectStore,
      runtimeProfileVersion: ragRuntimePolicy.profile.version,
      operation: "publication"
    })
    const existing = await this.getRun(runId)
    if (existing.status === "committed") {
      const pointer = await this.getActivePointer(existing.activePointerKey)
      if (pointer.artifactId !== existing.artifactId || pointer.runId !== existing.runId) {
        throw new PublicationLeaseConflictError(runId)
      }
      return { run: existing, manifest: await this.loadManifest(pointer.manifestObjectKey), pointer }
    }
    if (existing.status !== "validated" && existing.status !== "committing") throw new Error(`Publication run is ${existing.status}`)
    const pointerBeforeLease = await this.getActivePointer(existing.activePointerKey)
    if (pointerBeforeLease.artifactId === existing.artifactId && pointerBeforeLease.runId === existing.runId) {
      const reconciled = await this.reconcile(runId)
      return {
        run: reconciled,
        manifest: await this.loadManifest(pointerBeforeLease.manifestObjectKey),
        pointer: pointerBeforeLease
      }
    }
    let lease = await this.acquireLease(runId, workerId, leaseMs, true)
    const stagedArtifact = lease.run.stagedArtifact
    if (!stagedArtifact) throw new Error("Staged publication artifact is missing")
    const stagedManifest = await this.loadManifest(stagedArtifact.manifestObjectKey)
    const stageFence = stagedManifest.publicationFence
    if (!stageFence) throw new Error("Staged manifest fencing metadata is missing")
    if (
      stagedArtifact.manifestObjectKey !== stagedManifest.manifestObjectKey
      || stagedArtifact.documentId !== stagedManifest.documentId
      || stagedArtifact.documentVersion !== stagedManifest.documentVersion
      || stagedArtifact.manifestHash !== stagedManifest.derivedIntegrity?.manifestHash
      || stagedArtifact.recordSetHash !== stagedManifest.derivedIntegrity?.recordSetHash
      || stagedArtifact.generation !== stageFence.generation
      || stagedArtifact.fencingToken !== stageFence.fencingToken
    ) throw new PublicationFenceError(runId)
    await this.validateStagedManifest(lease.run, stageFence, stagedManifest)

    const commitFence = fenceForRun(lease.run, lease.run.generation, lease.run.lease!.fencingToken, publishedNamespace(lease.run.artifactId, lease.run.generation))
    const prepared = await this.prepareCommitArtifacts(lease.run, commitFence, stagedManifest)
    lease = await this.updateWithFence(lease, (run, now) => ({
      ...run,
      status: "committing",
      checkpoint: "commit_prepared",
      preparedCommit: {
        namespace: tenantDocumentArtifactKey(this.deps, run.scope.tenantId, commitFence.stageNamespace),
        manifestObjectKey: prepared.manifest.manifestObjectKey,
        evidenceVectorKeys: [...(prepared.manifest.evidenceVectorKeys ?? [])],
        memoryVectorKeys: [...(prepared.manifest.memoryVectorKeys ?? [])],
        generation: commitFence.generation,
        fencingToken: commitFence.fencingToken
      },
      updatedAt: now
    }))

    try {
      await this.hooks.afterPrepared?.(lease.run)
      const pointerStored = await readVersionedJson<ActivePublicationPointer>(this.deps, lease.run.activePointerKey)
      if (!pointerStored) throw new Error("Active publication pointer is missing")
      if (pointerStored.value.artifactId === lease.run.artifactId && pointerStored.value.runId === lease.run.runId) {
        return this.finishCommittedRun(lease, prepared.manifest, pointerStored.value)
      }
      if (pointerStored.value.artifactId !== lease.run.previousActiveArtifactId) {
        throw new PublicationLeaseConflictError(runId)
      }
      const pointer: ActivePublicationPointer = {
        schemaVersion: 1,
        scopeHash: activePointerScopeHash(lease.run.scope),
        tenantId: lease.run.scope.tenantId,
        sourceId: lease.run.scope.sourceId,
        purpose: lease.run.scope.purpose,
        artifactId: lease.run.artifactId,
        manifestObjectKey: prepared.manifest.manifestObjectKey,
        runId: lease.run.runId,
        generation: commitFence.generation,
        fencingToken: commitFence.fencingToken,
        previousArtifactId: pointerStored.value.artifactId,
        previousManifestObjectKey: pointerStored.value.manifestObjectKey,
        committedAt: this.clock().toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(
          lease.run.activePointerKey,
          JSON.stringify(pointer, null, 2),
          pointerStored.version,
          "application/json"
        )
      } catch (error) {
        if (isConditionalWriteError(error)) throw new PublicationLeaseConflictError(runId)
        throw error
      }
      await this.hooks.afterPointerCommitted?.(pointer)
      const result = await this.finishCommittedRun(lease, prepared.manifest, pointer)
      await this.supersedePreviousArtifact(pointer).catch(() => undefined)
      await this.cleanupStagedArtifact(stagedManifest).catch(() => undefined)
      return result
    } catch (error) {
      const currentPointer = await readVersionedJson<ActivePublicationPointer>(this.deps, lease.run.activePointerKey)
      if (currentPointer?.value.artifactId !== lease.run.artifactId || currentPointer.value.runId !== lease.run.runId) {
        await this.cleanupPreparedCommit(prepared.manifest).catch(() => undefined)
        await this.releaseCommitForRetry(lease, error).catch(() => undefined)
      }
      throw error
    }
  }

  async reconcile(runId: string): Promise<StagedPublicationRun> {
    const stored = await readVersionedJson<StagedPublicationRun>(this.deps, publicationRunKey(runId))
    if (!stored) throw new Error("Publication run not found")
    const pointer = await readVersionedJson<ActivePublicationPointer>(this.deps, stored.value.activePointerKey)
    const preparedRollback = stored.value.preparedRollback
    if (
      stored.value.status === "rolling_back"
      && preparedRollback
      && pointer
      && rollbackPointerMatches(stored.value, preparedRollback, pointer.value)
    ) {
      await this.validatePreparedRollbackArtifact(stored.value, preparedRollback)
      await this.finalizeRollbackArtifacts(stored.value, preparedRollback, pointer.value)
      const rolledBack: StagedPublicationRun = {
        ...stored.value,
        status: "rolled_back",
        checkpoint: "rolled_back",
        lease: undefined,
        rolledBackAt: stored.value.rolledBackAt ?? pointer.value.committedAt,
        lastError: undefined,
        updatedAt: this.clock().toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(publicationRunKey(runId), JSON.stringify(rolledBack, null, 2), stored.version, "application/json")
        return rolledBack
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
        return this.getRun(runId)
      }
    }
    if (
      stored.value.status !== "rolling_back"
      && pointer?.value.artifactId === stored.value.artifactId
      && pointer.value.runId === stored.value.runId
    ) {
      await this.supersedePreviousArtifact(pointer.value).catch(() => undefined)
      if (stored.value.stagedArtifact) {
        const stagedManifest = await this.loadManifest(stored.value.stagedArtifact.manifestObjectKey).catch(() => undefined)
        if (stagedManifest) await this.cleanupStagedArtifact(stagedManifest).catch(() => undefined)
      }
      const committed: StagedPublicationRun = {
        ...stored.value,
        status: "committed",
        checkpoint: "committed",
        lease: undefined,
        committedAt: stored.value.committedAt ?? pointer.value.committedAt,
        lastError: undefined,
        updatedAt: this.clock().toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(publicationRunKey(runId), JSON.stringify(committed, null, 2), stored.version, "application/json")
        return committed
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
        return this.getRun(runId)
      }
    }
    if (stored.value.status === "committing" && (!stored.value.lease || Date.parse(stored.value.lease.expiresAt) <= this.clock().getTime())) {
      const prepared = stored.value.preparedCommit
      if (prepared) await this.cleanupPreparedRecord(prepared).catch(() => undefined)
      const retryable: StagedPublicationRun = {
        ...stored.value,
        status: "validated",
        checkpoint: "validation_complete",
        lease: undefined,
        preparedCommit: undefined,
        lastError: "reconciled_expired_commit",
        updatedAt: this.clock().toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(publicationRunKey(runId), JSON.stringify(retryable, null, 2), stored.version, "application/json")
        return retryable
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
        return this.getRun(runId)
      }
    }
    if (
      stored.value.status === "rolling_back"
      && pointer?.value.artifactId === stored.value.artifactId
      && pointer.value.runId === stored.value.runId
      && (!stored.value.lease || Date.parse(stored.value.lease.expiresAt) <= this.clock().getTime())
    ) {
      if (preparedRollback) await this.cleanupPreparedRollback(preparedRollback).catch(() => undefined)
      const retryable: StagedPublicationRun = {
        ...stored.value,
        status: "committed",
        checkpoint: "committed",
        lease: undefined,
        preparedRollback: undefined,
        lastError: "reconciled_expired_rollback",
        updatedAt: this.clock().toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(publicationRunKey(runId), JSON.stringify(retryable, null, 2), stored.version, "application/json")
        return retryable
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
        return this.getRun(runId)
      }
    }
    return stored.value
  }

  async rollback(runId: string, workerId: string, leaseMs = defaultLeaseMs): Promise<{ run: StagedPublicationRun; manifest: DocumentManifest; pointer: ActivePublicationPointer }> {
    const initial = await this.getRun(runId)
    if (initial.status === "rolled_back") {
      const prepared = initial.preparedRollback
      if (!prepared) throw new PublicationFenceError(runId)
      const pointer = await this.getActivePointer(initial.activePointerKey)
      if (!rollbackPointerMatches(initial, prepared, pointer)) {
        throw new PublicationLeaseConflictError(runId)
      }
      return { run: initial, manifest: await this.loadManifest(pointer.manifestObjectKey), pointer }
    }
    if (initial.status !== "committed" && initial.status !== "rolling_back") throw new Error(`Publication run is ${initial.status}`)
    const pointerBeforeLease = await this.getActivePointer(initial.activePointerKey)
    if (
      initial.status === "rolling_back"
      && initial.preparedRollback
      && rollbackPointerMatches(initial, initial.preparedRollback, pointerBeforeLease)
    ) {
      const reconciled = await this.reconcile(runId)
      return { run: reconciled, manifest: await this.loadManifest(pointerBeforeLease.manifestObjectKey), pointer: pointerBeforeLease }
    }
    if (
      pointerBeforeLease.artifactId !== initial.artifactId
      || pointerBeforeLease.runId !== initial.runId
    ) throw new PublicationLeaseConflictError(runId)
    let lease = await this.acquireRollbackLease(runId, workerId, leaseMs)
    const currentPointer = await readVersionedJson<ActivePublicationPointer>(this.deps, lease.run.activePointerKey)
    if (!currentPointer) throw new Error("Active publication pointer is missing")
    if (currentPointer.value.artifactId !== lease.run.artifactId || currentPointer.value.runId !== lease.run.runId) {
      await this.releaseRollbackForRetry(lease, new PublicationLeaseConflictError(runId)).catch(() => undefined)
      throw new PublicationLeaseConflictError(runId)
    }
    const current = await this.loadManifest(currentPointer.value.manifestObjectKey)
    const previous = await this.loadManifest(lease.run.previousManifestObjectKey)
    await this.validateRollbackCandidate(lease.run, current, previous)
    const preparedResult = await this.prepareRollbackArtifact(lease.run, lease.fence, previous).catch(async (error: unknown) => {
      await this.releaseRollbackForRetry(lease, error).catch(() => undefined)
      throw error
    })
    const prepared = preparedResult.record
    try {
      lease = await this.updateWithFence(lease, (run, now) => ({
        ...run,
        status: "rolling_back",
        checkpoint: "rollback_prepared",
        preparedRollback: prepared,
        lastError: undefined,
        updatedAt: now
      }))
      await this.hooks.afterRollbackPrepared?.(prepared)
      await this.assertRollbackFenceCurrent(lease, prepared)
      await this.validatePreparedRollbackArtifact(lease.run, prepared)
      const currentBeforeCas = await this.loadManifest(currentPointer.value.manifestObjectKey)
      const previousBeforeCas = await this.loadManifest(lease.run.previousManifestObjectKey)
      await this.validateRollbackCandidate(lease.run, currentBeforeCas, previousBeforeCas)
      const pointer: ActivePublicationPointer = rollbackPointer(lease.run, prepared, currentPointer.value, this.clock().toISOString())
      await this.hooks.beforeRollbackPointerCommitted?.(pointer)
      await this.assertRollbackFenceCurrent(lease, prepared)
      const pointerBeforeCas = await readVersionedJson<ActivePublicationPointer>(this.deps, lease.run.activePointerKey)
      if (
        !pointerBeforeCas
        || pointerBeforeCas.version !== currentPointer.version
        || pointerBeforeCas.value.artifactId !== lease.run.artifactId
        || pointerBeforeCas.value.runId !== lease.run.runId
      ) throw new PublicationLeaseConflictError(runId)
      await this.validateRollbackCandidate(
        lease.run,
        await this.loadManifest(pointerBeforeCas.value.manifestObjectKey),
        await this.loadManifest(lease.run.previousManifestObjectKey)
      )
      await this.deps.objectStore.putTextIfVersion(
        lease.run.activePointerKey,
        JSON.stringify(pointer, null, 2),
        currentPointer.version,
        "application/json"
      )
    } catch (error) {
      const pointerAfterFailure = await readVersionedJson<ActivePublicationPointer>(this.deps, lease.run.activePointerKey).catch(() => undefined)
      const rollbackPointerCommitted = Boolean(
        pointerAfterFailure
        && rollbackPointerMatches(lease.run, prepared, pointerAfterFailure.value)
      )
      if (pointerAfterFailure && !rollbackPointerCommitted) {
        await this.cleanupPreparedRollback(prepared).catch(() => undefined)
        await this.releaseRollbackForRetry(lease, error).catch(() => undefined)
      }
      if (!rollbackPointerCommitted && (isConditionalWriteError(error) || error instanceof PublicationLeaseConflictError)) {
        throw new PublicationLeaseConflictError(runId)
      }
      throw error
    }
    const pointer = await this.getActivePointer(lease.run.activePointerKey)
    await this.hooks.afterRollbackPointerCommitted?.(pointer)
    await this.finalizeRollbackArtifacts(lease.run, prepared, pointer)
    const rolledBack = await this.updateWithFence(lease, (run, now) => ({
      ...run,
      status: "rolled_back",
      checkpoint: "rolled_back",
      lease: undefined,
      rolledBackAt: pointer.committedAt,
      lastError: undefined,
      updatedAt: now
    }))
    return { run: rolledBack.run, manifest: preparedResult.manifest, pointer }
  }

  async getRun(runId: string): Promise<StagedPublicationRun> {
    const stored = await readVersionedJson<StagedPublicationRun>(this.deps, publicationRunKey(runId))
    if (!stored) throw new Error("Publication run not found")
    return stored.value
  }

  private async acquireLease(runId: string, workerId: string, leaseMs = defaultLeaseMs, forCommit = false): Promise<PublicationLease> {
    const runKey = publicationRunKey(runId)
    for (let attempt = 0; attempt < maxCasAttempts; attempt += 1) {
      const stored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
      if (!stored) throw new Error("Publication run not found")
      const now = this.clock()
      const currentLease = stored.value.lease
      if (currentLease && Date.parse(currentLease.expiresAt) > now.getTime()) {
        if (currentLease.owner !== workerId) throw new PublicationLeaseConflictError(runId)
        return {
          run: stored.value,
          fence: fenceForRun(stored.value, currentLease.generation, currentLease.fencingToken),
          stateVersion: stored.version
        }
      }
      if (forCommit && stored.value.status !== "validated" && stored.value.status !== "committing") throw new Error(`Publication run is ${stored.value.status}`)
      if (!forCommit && stored.value.status !== "initialized" && stored.value.status !== "staging") throw new Error(`Publication run is ${stored.value.status}`)
      const generation = stored.value.generation + 1
      const fencingToken = stableHash(`${stored.value.runId}:${generation}:${workerId}:${stored.value.idempotencyKey}`)
      const expiresAt = new Date(now.getTime() + Math.max(1, leaseMs)).toISOString()
      const next: StagedPublicationRun = {
        ...stored.value,
        status: forCommit ? "committing" : "staging",
        checkpoint: "lease_acquired",
        generation,
        lease: { owner: workerId, expiresAt, generation, fencingToken },
        lastError: undefined,
        updatedAt: now.toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(runKey, JSON.stringify(next, null, 2), stored.version, "application/json")
        const nextStored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
        if (!nextStored) throw new Error("Publication run disappeared after lease acquisition")
        return {
          run: nextStored.value,
          fence: fenceForRun(nextStored.value, generation, fencingToken),
          stateVersion: nextStored.version
        }
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
      }
    }
    throw new PublicationLeaseConflictError(runId)
  }

  private async acquireRollbackLease(runId: string, workerId: string, leaseMs: number): Promise<PublicationLease> {
    const runKey = publicationRunKey(runId)
    for (let attempt = 0; attempt < maxCasAttempts; attempt += 1) {
      const stored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
      if (!stored) throw new Error("Publication run not found")
      const now = this.clock()
      if (stored.value.lease && Date.parse(stored.value.lease.expiresAt) > now.getTime()) {
        if (stored.value.lease.owner !== workerId) throw new PublicationLeaseConflictError(runId)
        return {
          run: stored.value,
          fence: fenceForRun(stored.value, stored.value.lease.generation, stored.value.lease.fencingToken),
          stateVersion: stored.version
        }
      }
      if (stored.value.status !== "committed" && stored.value.status !== "rolling_back") throw new Error(`Publication run is ${stored.value.status}`)
      const generation = stored.value.generation + 1
      const fencingToken = stableHash(`${stored.value.runId}:rollback:${generation}:${workerId}`)
      const next: StagedPublicationRun = {
        ...stored.value,
        status: "rolling_back",
        checkpoint: "rollback_prepared",
        generation,
        preparedRollback: undefined,
        lease: {
          owner: workerId,
          expiresAt: new Date(now.getTime() + Math.max(1, leaseMs)).toISOString(),
          generation,
          fencingToken
        },
        updatedAt: now.toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(runKey, JSON.stringify(next, null, 2), stored.version, "application/json")
        const nextStored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
        if (!nextStored) throw new Error("Publication run disappeared after rollback lease")
        return {
          run: nextStored.value,
          fence: fenceForRun(nextStored.value, generation, fencingToken),
          stateVersion: nextStored.version
        }
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
      }
    }
    throw new PublicationLeaseConflictError(runId)
  }

  private async updateWithFence(
    lease: PublicationLease,
    mutation: (run: StagedPublicationRun, now: string) => StagedPublicationRun
  ): Promise<PublicationLease> {
    const runKey = publicationRunKey(lease.run.runId)
    const stored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
    if (!stored || stored.version !== lease.stateVersion || !sameFence(stored.value, lease.fence)) {
      throw new PublicationFenceError(lease.run.runId)
    }
    const next = mutation(stored.value, this.clock().toISOString())
    try {
      await this.deps.objectStore.putTextIfVersion(runKey, JSON.stringify(next, null, 2), stored.version, "application/json")
    } catch (error) {
      if (isConditionalWriteError(error)) throw new PublicationFenceError(lease.run.runId)
      throw error
    }
    const nextStored = await readVersionedJson<StagedPublicationRun>(this.deps, runKey)
    if (!nextStored) throw new Error("Publication run disappeared after checkpoint update")
    return { ...lease, run: nextStored.value, stateVersion: nextStored.version }
  }

  private async validateStagedManifest(run: StagedPublicationRun, fence: StagedPublicationFence, manifest: DocumentManifest): Promise<void> {
    if (
      manifest.documentId !== run.artifactId
      || stableHash(manifest.publicationFence) !== stableHash(fence)
      || fence.runId !== run.runId
      || fence.artifactId !== run.artifactId
      || fence.idempotencyKey !== run.idempotencyKey
      || fence.sourceId !== run.scope.sourceId
      || fence.purpose !== run.scope.purpose
      || manifest.lifecycleStatus !== "staging"
      || manifest.publicationEligible !== true
      || manifest.processingStatus !== "complete"
      || manifest.admission?.status !== "approved"
      || manifest.admission.tenantId !== run.scope.tenantId
      || manifest.derivedIntegrity?.verified !== true
      || manifest.derivedIntegrity.reasons.length !== 0
      || !manifest.documentVersion
      || !isQualityApprovedForNormalRag(manifest, {
        allowLegacyLocalTestFixture: Boolean(this.deps.localTestIngestAdmissionContext)
      })
    ) throw new Error("Staged manifest failed publication validation")
    const stagedNamespace = tenantDocumentArtifactKey(this.deps, run.scope.tenantId, fence.stageNamespace)
    if (manifest.manifestObjectKey !== tenantDocumentArtifactKey(
      this.deps,
      run.scope.tenantId,
      `${fence.stageNamespace}/manifests/${run.artifactId}.json`
    )) {
      throw new Error("Staged manifest key does not match its fenced namespace")
    }
    const persistedManifest = await this.loadManifest(manifest.manifestObjectKey)
    if (stableHash(persistedManifest) !== stableHash(manifest)) throw new Error("Staged manifest durable verification failed")
    const objectKeys = [manifest.sourceObjectKey, manifest.structuredBlocksObjectKey, manifest.memoryCardsObjectKey].filter(isString)
    if (objectKeys.some((key) => !key.startsWith(`${stagedNamespace}/`))) throw new Error("Staged object escaped its namespace")
    const objectValues = await Promise.all(objectKeys.map((key) => this.deps.objectStore.getText(key)))
    const objectByKey = new Map(objectKeys.map((key, index) => [key, objectValues[index]!]))
    const objectHashes = manifest.derivedIntegrity.objectHashes
    if (
      !objectHashes?.source
      || stableHash(objectByKey.get(manifest.sourceObjectKey)) !== objectHashes.source
      || !optionalObjectHashMatches(objectByKey, manifest.structuredBlocksObjectKey, objectHashes.structuredBlocks)
      || !optionalObjectHashMatches(objectByKey, manifest.memoryCardsObjectKey, objectHashes.memoryCards)
    ) throw new Error("Staged object content hash mismatch")
    const evidenceKeys = manifest.evidenceVectorKeys ?? []
    const memoryKeys = manifest.memoryVectorKeys ?? []
    const expectedKeys = [...evidenceKeys, ...memoryKeys]
    if (
      manifest.vectorKeys.length !== new Set(manifest.vectorKeys).size
      || stableHash(manifest.vectorKeys) !== stableHash(expectedKeys)
      || manifest.derivedIntegrity.evidenceRecordCount !== evidenceKeys.length
      || manifest.derivedIntegrity.memoryRecordCount !== memoryKeys.length
      || manifest.derivedIntegrity.expectedChunkCount !== manifest.chunkCount
      || manifest.derivedIntegrity.expectedMemoryCardCount !== manifest.memoryCardCount
    ) throw new Error("Staged manifest record inventory mismatch")
    const records = await this.loadManifestVectorRecords(manifest)
    if (records.length !== manifest.vectorKeys.length) throw new Error("Staged vector record count mismatch")
    if (records.some((record) => (
      record.metadata.documentId !== manifest.documentId
      || record.metadata.lifecycleStatus !== "staging"
      || record.metadata.publicationFence?.fencingToken !== fence.fencingToken
      || record.metadata.publicationFence.generation !== fence.generation
    ))) throw new Error("Staged vector fencing metadata mismatch")
    const approvedAdmission = manifest.admission
    if (!isCompleteApprovedAdmission(approvedAdmission)) throw new Error("Staged admission references are incomplete")
    const envelopeReasons = records.flatMap((record) => verifyDerivedRecordSecurityEnvelope(record.metadata.securityEnvelope, {
      documentId: manifest.documentId,
      documentVersion: manifest.documentVersion!,
      admission: approvedAdmission
    }))
    if (envelopeReasons.length > 0) throw new Error(`Staged vector security envelope mismatch: ${[...new Set(envelopeReasons)].join(",")}`)
    if (derivedRecordSetHash(records) !== manifest.derivedIntegrity.recordSetHash) throw new Error("Staged vector record hash mismatch")
  }

  private async prepareCommitArtifacts(
    run: StagedPublicationRun,
    fence: StagedPublicationFence,
    staged: DocumentManifest
  ): Promise<{ manifest: DocumentManifest; evidenceRecords: VectorRecord[]; memoryRecords: VectorRecord[] }> {
    const namespace = tenantDocumentArtifactKey(this.deps, run.scope.tenantId, fence.stageNamespace)
    const documentPrefix = `${namespace}/documents/${run.artifactId}`
    const sourceObjectKey = `${documentPrefix}/source.txt`
    const structuredBlocksObjectKey = staged.structuredBlocksObjectKey ? `${documentPrefix}/structured-blocks.json` : undefined
    const memoryCardsObjectKey = staged.memoryCardsObjectKey ? `${documentPrefix}/memory-cards.json` : undefined
    await this.copyText(staged.sourceObjectKey, sourceObjectKey)
    if (structuredBlocksObjectKey && staged.structuredBlocksObjectKey) await this.copyText(staged.structuredBlocksObjectKey, structuredBlocksObjectKey)
    if (memoryCardsObjectKey && staged.memoryCardsObjectKey) await this.copyText(staged.memoryCardsObjectKey, memoryCardsObjectKey)

    const stageRecords = await this.loadManifestVectorRecords(staged)
    const promoted = stageRecords.map((record) => {
      const recordId = record.metadata.chunkId ?? record.metadata.memoryId
      if (!recordId) throw new Error("Staged vector record identity is missing")
      return {
        ...record,
        key: tenantVectorKey(
          this.deps,
          run.scope.tenantId,
          `${run.artifactId}-active-g${fence.generation}-${record.metadata.kind}-${recordId}`
        ),
        metadata: {
          ...record.metadata,
          objectKey: sourceObjectKey,
          lifecycleStatus: "active" as const,
          publicationFence: fence
        }
      }
    })
    const evidenceRecords = promoted.filter((record) => record.metadata.kind === "chunk")
    const memoryRecords = promoted.filter((record) => record.metadata.kind === "memory")
    await this.deps.evidenceVectorStore.put(evidenceRecords)
    await this.deps.memoryVectorStore.put(memoryRecords)
    const persisted = await this.loadVectorRecords(evidenceRecords.map((record) => record.key), memoryRecords.map((record) => record.key))
    if (persisted.length !== promoted.length || derivedRecordSetHash(persisted) !== derivedRecordSetHash(promoted)) {
      throw new Error("Promoted vector verification failed")
    }

    const manifestObjectKey = tenantManifestKey(this.deps, run.scope.tenantId, run.artifactId)
    const control: PublicationControl = {
      schemaVersion: 1,
      sourceId: run.scope.sourceId,
      purpose: run.scope.purpose,
      activePointerKey: run.activePointerKey,
      artifactId: run.artifactId,
      runId: run.runId,
      generation: fence.generation,
      fencingToken: fence.fencingToken
    }
    const manifestProjection = {
      documentId: staged.documentId,
      documentVersion: staged.documentVersion,
      publicationFence: fence,
      publicationControl: control,
      sourceObjectKey,
      structuredBlocksObjectKey,
      memoryCardsObjectKey,
      evidenceVectorKeys: evidenceRecords.map((record) => record.key),
      memoryVectorKeys: memoryRecords.map((record) => record.key)
    }
    const manifest: DocumentManifest = {
      ...staged,
      metadata: { ...(staged.metadata ?? {}), lifecycleStatus: "active" },
      lifecycleStatus: "active",
      activeDocumentId: run.artifactId,
      sourceObjectKey,
      structuredBlocksObjectKey,
      memoryCardsObjectKey,
      manifestObjectKey,
      vectorKeys: promoted.map((record) => record.key),
      evidenceVectorKeys: evidenceRecords.map((record) => record.key),
      memoryVectorKeys: memoryRecords.map((record) => record.key),
      publicationFence: fence,
      publicationControl: control,
      derivedIntegrity: {
        ...staged.derivedIntegrity!,
        evidenceRecordCount: evidenceRecords.length,
        memoryRecordCount: memoryRecords.length,
        manifestHash: stableHash(manifestProjection),
        recordSetHash: derivedRecordSetHash(promoted),
        verified: true,
        reasons: []
      },
      updatedAt: this.clock().toISOString()
    }
    await this.deps.objectStore.putText(manifestObjectKey, JSON.stringify(manifest, null, 2), "application/json")
    const persistedManifest = await this.loadManifest(manifestObjectKey)
    if (stableHash(persistedManifest) !== stableHash(manifest)) throw new Error("Canonical manifest verification failed")
    return { manifest, evidenceRecords, memoryRecords }
  }

  private async finishCommittedRun(
    lease: PublicationLease,
    manifest: DocumentManifest,
    pointer: ActivePublicationPointer
  ): Promise<{ run: StagedPublicationRun; manifest: DocumentManifest; pointer: ActivePublicationPointer }> {
    const committed = await this.updateWithFence(lease, (run, now) => ({
      ...run,
      status: "committed",
      checkpoint: "committed",
      lease: undefined,
      committedAt: pointer.committedAt,
      lastError: undefined,
      updatedAt: now
    }))
    return { run: committed.run, manifest, pointer }
  }

  private async releaseCommitForRetry(lease: PublicationLease, error: unknown): Promise<void> {
    await this.updateWithFence(lease, (run, now) => ({
      ...run,
      status: "validated",
      checkpoint: "validation_complete",
      lease: undefined,
      preparedCommit: undefined,
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: now
    }))
  }

  private async releaseRollbackForRetry(lease: PublicationLease, error: unknown): Promise<void> {
    await this.updateWithFence(lease, (run, now) => ({
      ...run,
      status: "committed",
      checkpoint: "committed",
      lease: undefined,
      preparedRollback: undefined,
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: now
    }))
  }

  private async ensureBootstrapPointer(scope: PublicationScope, manifest: DocumentManifest, scopeHash: string): Promise<ActivePublicationPointer> {
    const key = activePublicationPointerKey(scope)
    const existing = await readVersionedJson<ActivePublicationPointer>(this.deps, key)
    if (existing) {
      if (existing.value.scopeHash !== scopeHash || existing.value.sourceId !== scope.sourceId) throw new Error("Active publication pointer scope mismatch")
      return existing.value
    }
    const now = this.clock().toISOString()
    const bootstrap: ActivePublicationPointer = {
      schemaVersion: 1,
      scopeHash,
      tenantId: scope.tenantId,
      sourceId: scope.sourceId,
      purpose: scope.purpose,
      artifactId: manifest.documentId,
      manifestObjectKey: manifest.manifestObjectKey,
      runId: `bootstrap:${manifest.documentId}`,
      generation: 0,
      fencingToken: stableHash(`bootstrap:${scopeHash}:${manifest.documentId}`),
      committedAt: now
    }
    try {
      await this.deps.objectStore.putTextIfVersion(key, JSON.stringify(bootstrap, null, 2), undefined, "application/json")
      return bootstrap
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      return this.getActivePointer(key)
    }
  }

  private async annotateManifestWithPublicationControl(manifest: DocumentManifest, pointer: ActivePublicationPointer): Promise<void> {
    const pointerKey = activePublicationPointerKey({
      tenantId: pointer.tenantId,
      sourceId: pointer.sourceId,
      purpose: pointer.purpose
    })
    const publicationControl: PublicationControl = {
      schemaVersion: 1,
      sourceId: pointer.sourceId,
      purpose: pointer.purpose,
      activePointerKey: pointerKey,
      artifactId: pointer.artifactId,
      runId: pointer.runId,
      generation: pointer.generation,
      fencingToken: pointer.fencingToken
    }
    for (let attempt = 0; attempt < maxCasAttempts; attempt += 1) {
      const stored = await readVersionedJson<DocumentManifest>(this.deps, manifest.manifestObjectKey)
      if (!stored) throw new Error("Source manifest is missing")
      if (stableHash(stored.value.publicationControl) === stableHash(publicationControl)) return
      const next: DocumentManifest = {
        ...stored.value,
        publicationControl,
        updatedAt: this.clock().toISOString()
      }
      try {
        await this.deps.objectStore.putTextIfVersion(manifest.manifestObjectKey, JSON.stringify(next, null, 2), stored.version, "application/json")
        return
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
      }
    }
    throw new Error("Could not annotate source manifest with publication control")
  }

  private async supersedePreviousArtifact(pointer: ActivePublicationPointer): Promise<void> {
    if (!pointer.previousManifestObjectKey || pointer.previousArtifactId === pointer.artifactId) return
    const previous = await this.loadManifest(pointer.previousManifestObjectKey)
    await this.rewriteVectorLifecycle(previous, "superseded")
    await this.deps.objectStore.putText(previous.manifestObjectKey, JSON.stringify({
      ...previous,
      lifecycleStatus: "superseded",
      metadata: { ...(previous.metadata ?? {}), lifecycleStatus: "superseded" },
      updatedAt: this.clock().toISOString()
    }, null, 2), "application/json")
  }

  private async validateRollbackCandidate(
    run: StagedPublicationRun,
    current: DocumentManifest,
    previous: DocumentManifest
  ): Promise<void> {
    const previousAdmission = previous.admission
    if (
      current.documentId !== run.artifactId
      || previous.documentId !== run.previousActiveArtifactId
      || previous.manifestObjectKey !== run.previousManifestObjectKey
      || previousAdmission?.status !== "approved"
      || previousAdmission.inspectionStatus !== "passed"
      || previousAdmission.tenantId !== run.scope.tenantId
      || previous.processingStatus !== "complete"
      || previous.publicationEligible !== true
      || stringMetadata(previous, "deletedAt")
      || stringMetadata(previous, "archivedAt")
      || !isQualityApprovedForNormalRag(previous, {
        allowLegacyLocalTestFixture: Boolean(this.deps.localTestIngestAdmissionContext)
      })
    ) throw new Error("Previous publication is not currently eligible for rollback")
    if (this.deps.localTestIngestAdmissionContext) return

    const governance = await readCurrentSourceGovernanceRecord(this.deps.objectStore, current)
    const approval = governance?.record.approval
    const restriction = governance?.record.restriction
    if (
      !governance
      || governance.record.status !== "published"
      || governance.record.activeDocumentId !== current.documentId
      || !approval
      || stableHash(previousAdmission.classificationRef) !== stableHash(approval.classificationRef)
      || stableHash(previousAdmission.usagePolicyRef) !== stableHash(approval.usagePolicyRef)
      || stableHash(previousAdmission.qualityRef) !== stableHash(approval.qualityRef)
      || !approval.usagePolicy.allowedPurposes.includes("normal_rag")
      || restriction?.dimensions.length
      || restriction?.deniedPurposes.includes("normal_rag")
    ) throw new Error("Current source governance does not authorize rollback publication")
  }

  private async prepareRollbackArtifact(
    run: StagedPublicationRun,
    leaseFence: StagedPublicationFence,
    previous: DocumentManifest
  ): Promise<{ record: PreparedRollbackRecord; manifest: DocumentManifest }> {
    const identity = rollbackArtifactIdentity(run, leaseFence)
    const admission = rollbackAdmission(previous, identity)
    if (!isCompleteApprovedAdmission(admission)) throw new Error("Rollback admission references are incomplete")
    const previousAdmission = previous.admission
    if (!previousAdmission || !isCompleteApprovedAdmission(previousAdmission)) throw new Error("Rollback source admission is incomplete")
    if (!previous.documentVersion || !previous.securityEnvelope) throw new Error("Rollback source identity is incomplete")
    // documentVersion identifies the immutable source content. The rollback generation is
    // carried by the new artifact id, namespace, publication fence, and admission references.
    const documentVersion = previous.documentVersion
    const namespace = tenantDocumentArtifactKey(this.deps, run.scope.tenantId, identity.fence.stageNamespace)
    const documentPrefix = `${namespace}/documents/${identity.artifactId}`
    const sourceObjectKey = `${documentPrefix}/source.txt`
    const structuredBlocksObjectKey = previous.structuredBlocksObjectKey ? `${documentPrefix}/structured-blocks.json` : undefined
    const memoryCardsObjectKey = previous.memoryCardsObjectKey ? `${documentPrefix}/memory-cards.json` : undefined
    const manifestObjectKey = tenantManifestKey(this.deps, run.scope.tenantId, identity.artifactId)
    const [sourceText, structuredBlocksText, previousMemoryCardsText, previousRecords] = await Promise.all([
      this.deps.objectStore.getText(previous.sourceObjectKey),
      previous.structuredBlocksObjectKey ? this.deps.objectStore.getText(previous.structuredBlocksObjectKey) : undefined,
      previous.memoryCardsObjectKey ? this.deps.objectStore.getText(previous.memoryCardsObjectKey) : undefined,
      this.loadManifestVectorRecords(previous)
    ])
    if (previousRecords.length !== previous.vectorKeys.length) throw new Error("Rollback source vector inventory is incomplete")
    const sourceEnvelopeReasons = verifyDerivedRecordSecurityEnvelope(previous.securityEnvelope, {
      documentId: previous.documentId,
      documentVersion: previous.documentVersion,
      admission: previousAdmission
    })
    if (sourceEnvelopeReasons.length > 0) throw new Error(`Rollback source security envelope mismatch: ${sourceEnvelopeReasons.join(",")}`)

    const sourceSecurityEnvelope = createDerivedRecordSecurityEnvelope({
      documentId: identity.artifactId,
      documentVersion,
      admission,
      sourceLocator: previous.securityEnvelope.sourceLocator
    })
    const chunks = (previous.chunks ?? []).map((chunk) => ({
      ...chunk,
      securityEnvelope: createDerivedRecordSecurityEnvelope({
        documentId: identity.artifactId,
        documentVersion,
        admission,
        sourceLocator: requiredSourceLocator(chunk.securityEnvelope?.sourceLocator, `chunk:${chunk.id}`)
      })
    }))
    if (chunks.length !== previous.chunkCount) throw new Error("Rollback source chunk inventory is incomplete")

    const memoryCards = transformRollbackMemoryCards(previousMemoryCardsText, {
      documentId: identity.artifactId,
      documentVersion,
      admission
    })
    if (memoryCards.length !== previous.memoryCardCount) throw new Error("Rollback source memory inventory is incomplete")
    const memoryCardsText = memoryCardsObjectKey
      ? JSON.stringify({ schemaVersion: 1, memoryCards }, null, 2)
      : undefined

    const promoted = previousRecords.map((record) => {
      if (!previous.documentVersion) throw new Error("Rollback source document version is missing")
      const sourceReasons = verifyDerivedRecordSecurityEnvelope(record.metadata.securityEnvelope, {
        documentId: previous.documentId,
        documentVersion: previous.documentVersion,
        admission: previousAdmission
      })
      if (sourceReasons.length > 0) throw new Error(`Rollback source vector security mismatch: ${sourceReasons.join(",")}`)
      const recordId = record.metadata.chunkId ?? record.metadata.memoryId
      if (!recordId) throw new Error("Rollback source vector identity is missing")
      return {
        ...record,
        key: tenantVectorKey(
          this.deps,
          run.scope.tenantId,
          `${identity.artifactId}-active-g${identity.fence.generation}-${record.metadata.kind}-${recordId}`
        ),
        metadata: {
          ...record.metadata,
          documentId: identity.artifactId,
          documentVersion,
          objectKey: sourceObjectKey,
          lifecycleStatus: "active" as const,
          publicationFence: identity.fence,
          securityEnvelope: createDerivedRecordSecurityEnvelope({
            documentId: identity.artifactId,
            documentVersion,
            admission,
            sourceLocator: requiredSourceLocator(record.metadata.securityEnvelope?.sourceLocator, `vector:${recordId}`)
          }),
          createdAt: this.clock().toISOString()
        }
      } satisfies VectorRecord
    })
    const evidenceRecords = promoted.filter((record) => record.metadata.kind === "chunk")
    const memoryRecords = promoted.filter((record) => record.metadata.kind === "memory")
    const evidenceVectorKeys = evidenceRecords.map((record) => record.key)
    const memoryVectorKeys = memoryRecords.map((record) => record.key)
    const rollbackControl: PublicationControl = {
      schemaVersion: 1,
      sourceId: run.scope.sourceId,
      purpose: run.scope.purpose,
      activePointerKey: run.activePointerKey,
      artifactId: identity.artifactId,
      runId: identity.pointerRunId,
      generation: identity.fence.generation,
      fencingToken: identity.fence.fencingToken
    }
    const manifestProjection = rollbackManifestProjection({
      documentId: identity.artifactId,
      documentVersion,
      admission,
      sourceSecurityEnvelope,
      publicationFence: identity.fence,
      chunkingPolicy: previous.chunkingPolicy,
      chunkIds: evidenceRecords.map((record) => record.metadata.chunkId!).sort(),
      memoryCardIds: memoryRecords.map((record) => record.metadata.memoryId!).sort(),
      sourceObjectKey,
      structuredBlocksObjectKey,
      memoryCardsObjectKey
    })
    const derivedIntegrity = {
      ...reconcileDerivedArtifacts({
        documentId: identity.artifactId,
        documentVersion,
        admission,
        expectedChunkIds: evidenceRecords.map((record) => record.metadata.chunkId!),
        expectedMemoryCardIds: memoryRecords.map((record) => record.metadata.memoryId!),
        evidenceRecords,
        memoryRecords,
        manifestProjection
      }),
      objectHashes: {
        source: stableHash(sourceText),
        structuredBlocks: structuredBlocksText === undefined ? undefined : stableHash(structuredBlocksText),
        memoryCards: memoryCardsText === undefined ? undefined : stableHash(memoryCardsText)
      }
    }
    if (!derivedIntegrity.verified || derivedIntegrity.reasons.length > 0) {
      throw new Error(`Rollback derived artifact reconciliation failed: ${derivedIntegrity.reasons.join(",")}`)
    }
    const now = this.clock().toISOString()
    const manifest: DocumentManifest = {
      ...previous,
      documentId: identity.artifactId,
      documentVersion,
      metadata: {
        ...(previous.metadata ?? {}),
        lifecycleStatus: "active",
        activeDocumentId: identity.artifactId,
        rolledBackFromDocumentId: run.artifactId,
        rollbackSourceDocumentId: previous.documentId
      },
      admission,
      derivedIntegrity,
      securityEnvelope: sourceSecurityEnvelope,
      publicationFence: identity.fence,
      publicationControl: rollbackControl,
      sourceObjectKey,
      structuredBlocksObjectKey,
      memoryCardsObjectKey,
      manifestObjectKey,
      vectorKeys: [...evidenceVectorKeys, ...memoryVectorKeys],
      evidenceVectorKeys,
      memoryVectorKeys,
      chunks,
      lifecycleStatus: "active",
      activeDocumentId: identity.artifactId,
      stagedFromDocumentId: previous.documentId,
      reindexMigrationId: run.runId,
      createdAt: now,
      updatedAt: now
    }
    const record: PreparedRollbackRecord = {
      artifactId: identity.artifactId,
      sourceArtifactId: previous.documentId,
      namespace,
      manifestObjectKey,
      sourceObjectKey,
      structuredBlocksObjectKey,
      memoryCardsObjectKey,
      evidenceVectorKeys,
      memoryVectorKeys,
      manifestHash: derivedIntegrity.manifestHash,
      recordSetHash: derivedIntegrity.recordSetHash,
      pointerRunId: identity.pointerRunId,
      generation: identity.fence.generation,
      fencingToken: identity.fence.fencingToken
    }
    try {
      await this.deps.objectStore.putTextIfVersion(sourceObjectKey, sourceText, undefined, "text/plain; charset=utf-8")
      if (structuredBlocksObjectKey && structuredBlocksText !== undefined) {
        await this.deps.objectStore.putTextIfVersion(structuredBlocksObjectKey, structuredBlocksText, undefined, "application/json")
      }
      if (memoryCardsObjectKey && memoryCardsText !== undefined) {
        await this.deps.objectStore.putTextIfVersion(memoryCardsObjectKey, memoryCardsText, undefined, "application/json")
      }
      await this.deps.evidenceVectorStore.put(evidenceRecords)
      await this.deps.memoryVectorStore.put(memoryRecords)
      const persistedRecords = await this.loadVectorRecords(evidenceVectorKeys, memoryVectorKeys)
      if (persistedRecords.length !== promoted.length || derivedRecordSetHash(persistedRecords) !== derivedIntegrity.recordSetHash) {
        throw new Error("Prepared rollback vector verification failed")
      }
      await this.deps.objectStore.putTextIfVersion(manifestObjectKey, JSON.stringify(manifest, null, 2), undefined, "application/json")
      await this.validatePreparedRollbackArtifact({ ...run, preparedRollback: record }, record)
      return { record, manifest }
    } catch (error) {
      await this.cleanupPreparedRollback(record).catch(() => undefined)
      throw error
    }
  }

  private async validatePreparedRollbackArtifact(
    run: StagedPublicationRun,
    prepared: PreparedRollbackRecord
  ): Promise<DocumentManifest> {
    const expectedNamespace = tenantDocumentArtifactKey(
      this.deps,
      run.scope.tenantId,
      rollbackNamespace(run.runId, prepared.generation)
    )
    const expectedFence: StagedPublicationFence = {
      schemaVersion: 1,
      runId: prepared.pointerRunId,
      artifactId: prepared.artifactId,
      idempotencyKey: `${run.idempotencyKey}:rollback:${prepared.generation}`,
      sourceId: run.scope.sourceId,
      purpose: "rollback",
      stageNamespace: rollbackNamespace(run.runId, prepared.generation),
      generation: prepared.generation,
      fencingToken: prepared.fencingToken
    }
    const expectedControl: PublicationControl = {
      schemaVersion: 1,
      sourceId: run.scope.sourceId,
      purpose: run.scope.purpose,
      activePointerKey: run.activePointerKey,
      artifactId: prepared.artifactId,
      runId: prepared.pointerRunId,
      generation: prepared.generation,
      fencingToken: prepared.fencingToken
    }
    if (
      prepared.generation !== run.generation
      || (run.status === "rolling_back" && run.lease !== undefined && prepared.fencingToken !== run.lease.fencingToken)
      || prepared.artifactId === prepared.sourceArtifactId
      || prepared.sourceArtifactId !== run.previousActiveArtifactId
      || prepared.pointerRunId !== `${run.runId}:rollback:g${prepared.generation}`
      || prepared.namespace !== expectedNamespace
      || prepared.manifestObjectKey !== tenantManifestKey(this.deps, run.scope.tenantId, prepared.artifactId)
      || !prepared.sourceObjectKey.startsWith(`${expectedNamespace}/`)
      || (prepared.structuredBlocksObjectKey !== undefined && !prepared.structuredBlocksObjectKey.startsWith(`${expectedNamespace}/`))
      || (prepared.memoryCardsObjectKey !== undefined && !prepared.memoryCardsObjectKey.startsWith(`${expectedNamespace}/`))
    ) throw new PublicationFenceError(run.runId)
    const manifest = await this.loadManifest(prepared.manifestObjectKey)
    const admission = manifest.admission
    if (
      manifest.documentId !== prepared.artifactId
      || manifest.manifestObjectKey !== prepared.manifestObjectKey
      || manifest.sourceObjectKey !== prepared.sourceObjectKey
      || manifest.structuredBlocksObjectKey !== prepared.structuredBlocksObjectKey
      || manifest.memoryCardsObjectKey !== prepared.memoryCardsObjectKey
      || manifest.lifecycleStatus !== "active"
      || manifest.processingStatus !== "complete"
      || manifest.publicationEligible !== true
      || !manifest.documentVersion
      || !manifest.securityEnvelope
      || !admission
      || !isCompleteApprovedAdmission(admission)
      || admission.tenantId !== run.scope.tenantId
      || manifest.activeDocumentId !== prepared.artifactId
      || stableHash(manifest.publicationFence) !== stableHash(expectedFence)
      || stableHash(manifest.publicationControl) !== stableHash(expectedControl)
      || manifest.vectorKeys.length !== new Set(manifest.vectorKeys).size
      || stableHash(manifest.vectorKeys) !== stableHash([...prepared.evidenceVectorKeys, ...prepared.memoryVectorKeys])
      || manifest.derivedIntegrity?.verified !== true
      || manifest.derivedIntegrity.reasons.length !== 0
      || manifest.derivedIntegrity.expectedChunkCount !== manifest.chunkCount
      || manifest.derivedIntegrity.expectedMemoryCardCount !== manifest.memoryCardCount
      || manifest.derivedIntegrity.evidenceRecordCount !== prepared.evidenceVectorKeys.length
      || manifest.derivedIntegrity.memoryRecordCount !== prepared.memoryVectorKeys.length
    ) throw new PublicationFenceError(run.runId)
    const sourceReasons = verifyDerivedRecordSecurityEnvelope(manifest.securityEnvelope, {
      documentId: manifest.documentId,
      documentVersion: manifest.documentVersion,
      admission
    })
    const chunkReasons = (manifest.chunks ?? []).flatMap((chunk) => verifyDerivedRecordSecurityEnvelope(chunk.securityEnvelope, {
      documentId: manifest.documentId,
      documentVersion: manifest.documentVersion!,
      admission
    }))
    if (sourceReasons.length > 0 || chunkReasons.length > 0 || (manifest.chunks ?? []).length !== manifest.chunkCount) {
      throw new Error("Prepared rollback manifest security envelope verification failed")
    }
    const [sourceText, structuredBlocksText, memoryCardsText, records] = await Promise.all([
      this.deps.objectStore.getText(prepared.sourceObjectKey),
      prepared.structuredBlocksObjectKey ? this.deps.objectStore.getText(prepared.structuredBlocksObjectKey) : undefined,
      prepared.memoryCardsObjectKey ? this.deps.objectStore.getText(prepared.memoryCardsObjectKey) : undefined,
      this.loadVectorRecords(prepared.evidenceVectorKeys, prepared.memoryVectorKeys)
    ])
    const memoryCards = transformRollbackMemoryCards(memoryCardsText, {
      documentId: manifest.documentId,
      documentVersion: manifest.documentVersion,
      admission,
      verifyOnly: true
    })
    if (memoryCards.length !== manifest.memoryCardCount) throw new Error("Prepared rollback memory verification failed")
    const evidenceRecords = records.filter((record) => record.metadata.kind === "chunk")
    const memoryRecords = records.filter((record) => record.metadata.kind === "memory")
    const evidenceIds = evidenceRecords.map((record) => record.metadata.chunkId).filter(isString).sort()
    const memoryIds = memoryRecords.map((record) => record.metadata.memoryId).filter(isString).sort()
    const manifestChunkIds = (manifest.chunks ?? []).map((chunk) => chunk.id).sort()
    const ledgerMemoryIds = memoryCards.map((card) => card.id).sort()
    if (
      stableHash(sourceText) !== manifest.derivedIntegrity?.objectHashes?.source
      || !optionalTextHashMatches(structuredBlocksText, manifest.derivedIntegrity?.objectHashes?.structuredBlocks)
      || !optionalTextHashMatches(memoryCardsText, manifest.derivedIntegrity?.objectHashes?.memoryCards)
      || records.length !== manifest.vectorKeys.length
      || evidenceRecords.length !== prepared.evidenceVectorKeys.length
      || memoryRecords.length !== prepared.memoryVectorKeys.length
      || stableHash(evidenceIds) !== stableHash(manifestChunkIds)
      || stableHash(memoryIds) !== stableHash(ledgerMemoryIds)
      || derivedRecordSetHash(records) !== prepared.recordSetHash
      || manifest.derivedIntegrity?.recordSetHash !== prepared.recordSetHash
      || manifest.derivedIntegrity.manifestHash !== prepared.manifestHash
      || records.some((record) => (
        record.metadata.documentId !== manifest.documentId
        || record.metadata.documentVersion !== manifest.documentVersion
        || record.metadata.objectKey !== manifest.sourceObjectKey
        || record.metadata.lifecycleStatus !== "active"
        || stableHash(record.metadata.publicationFence) !== stableHash(expectedFence)
        || record.key !== tenantVectorKey(
          this.deps,
          run.scope.tenantId,
          `${prepared.artifactId}-active-g${prepared.generation}-${record.metadata.kind}-${record.metadata.chunkId ?? record.metadata.memoryId}`
        )
        || verifyDerivedRecordSecurityEnvelope(record.metadata.securityEnvelope, {
          documentId: manifest.documentId,
          documentVersion: manifest.documentVersion!,
          admission
        }).length > 0
      ))
    ) throw new Error("Prepared rollback artifact verification failed")
    const projection = rollbackManifestProjection({
      documentId: manifest.documentId,
      documentVersion: manifest.documentVersion,
      admission,
      sourceSecurityEnvelope: manifest.securityEnvelope,
      publicationFence: manifest.publicationFence!,
      chunkingPolicy: manifest.chunkingPolicy,
      chunkIds: records.filter((record) => record.metadata.kind === "chunk").map((record) => record.metadata.chunkId!).sort(),
      memoryCardIds: records.filter((record) => record.metadata.kind === "memory").map((record) => record.metadata.memoryId!).sort(),
      sourceObjectKey: manifest.sourceObjectKey,
      structuredBlocksObjectKey: manifest.structuredBlocksObjectKey,
      memoryCardsObjectKey: manifest.memoryCardsObjectKey
    })
    if (stableHash(projection) !== prepared.manifestHash) throw new Error("Prepared rollback manifest hash verification failed")
    return manifest
  }

  private async assertRollbackFenceCurrent(lease: PublicationLease, prepared: PreparedRollbackRecord): Promise<void> {
    const stored = await readVersionedJson<StagedPublicationRun>(this.deps, publicationRunKey(lease.run.runId))
    if (
      !stored
      || stored.version !== lease.stateVersion
      || !sameFence(stored.value, lease.fence)
      || stored.value.status !== "rolling_back"
      || stableHash(stored.value.preparedRollback) !== stableHash(prepared)
    ) throw new PublicationFenceError(lease.run.runId)
  }

  /** The rollback pointer selects only an immutable, fully verified artifact. No shared prior artifact is mutated here. */
  private async finalizeRollbackArtifacts(
    run: StagedPublicationRun,
    prepared: PreparedRollbackRecord,
    pointer: ActivePublicationPointer
  ): Promise<DocumentManifest> {
    const currentPointer = await this.getActivePointer(run.activePointerKey)
    if (!rollbackPointerMatches(run, prepared, pointer) || !rollbackPointerMatches(run, prepared, currentPointer)) {
      throw new PublicationFenceError(run.runId)
    }
    return this.validatePreparedRollbackArtifact(run, prepared)
  }

  private async rewriteVectorLifecycle(manifest: DocumentManifest, lifecycleStatus: "active" | "staging" | "superseded"): Promise<void> {
    const evidenceKeys = manifest.evidenceVectorKeys ?? []
    const memoryKeys = manifest.memoryVectorKeys ?? []
    const records = await this.loadVectorRecords(evidenceKeys, memoryKeys)
    const evidence = records.filter((record) => record.metadata.kind === "chunk").map((record) => ({
      ...record,
      metadata: { ...record.metadata, lifecycleStatus }
    }))
    const memory = records.filter((record) => record.metadata.kind === "memory").map((record) => ({
      ...record,
      metadata: { ...record.metadata, lifecycleStatus }
    }))
    await this.deps.evidenceVectorStore.put(evidence)
    await this.deps.memoryVectorStore.put(memory)
  }

  private async cleanupStagedArtifact(manifest: DocumentManifest): Promise<void> {
    await Promise.allSettled([
      this.deps.evidenceVectorStore.delete(manifest.evidenceVectorKeys ?? []),
      this.deps.memoryVectorStore.delete(manifest.memoryVectorKeys ?? []),
      ...[manifest.sourceObjectKey, manifest.structuredBlocksObjectKey, manifest.memoryCardsObjectKey, manifest.manifestObjectKey]
        .filter(isString)
        .map((key) => this.deps.objectStore.deleteObject(key))
    ])
  }

  private async cleanupPreparedCommit(manifest: DocumentManifest): Promise<void> {
    await Promise.allSettled([
      this.deps.evidenceVectorStore.delete(manifest.evidenceVectorKeys ?? []),
      this.deps.memoryVectorStore.delete(manifest.memoryVectorKeys ?? []),
      ...[manifest.sourceObjectKey, manifest.structuredBlocksObjectKey, manifest.memoryCardsObjectKey, manifest.manifestObjectKey]
        .filter(isString)
        .map((key) => this.deps.objectStore.deleteObject(key))
    ])
  }

  private async cleanupPreparedRecord(prepared: PreparedCommitRecord): Promise<void> {
    await Promise.allSettled([
      this.deps.evidenceVectorStore.delete(prepared.evidenceVectorKeys),
      this.deps.memoryVectorStore.delete(prepared.memoryVectorKeys),
      this.deps.objectStore.deleteObject(prepared.manifestObjectKey),
      ...((await this.deps.objectStore.listKeys(`${prepared.namespace}/`)).map((key) => this.deps.objectStore.deleteObject(key)))
    ])
  }

  private async cleanupPreparedRollback(prepared: PreparedRollbackRecord): Promise<void> {
    const namespaceKeys = await this.deps.objectStore.listKeys(`${prepared.namespace}/`).catch(() => [])
    await Promise.allSettled([
      this.deps.evidenceVectorStore.delete(prepared.evidenceVectorKeys),
      this.deps.memoryVectorStore.delete(prepared.memoryVectorKeys),
      this.deps.objectStore.deleteObject(prepared.manifestObjectKey),
      ...namespaceKeys.map((key) => this.deps.objectStore.deleteObject(key))
    ])
  }

  private async loadManifestVectorRecords(manifest: DocumentManifest): Promise<VectorRecord[]> {
    return this.loadVectorRecords(manifest.evidenceVectorKeys ?? [], manifest.memoryVectorKeys ?? [])
  }

  private async loadVectorRecords(evidenceKeys: string[], memoryKeys: string[]): Promise<VectorRecord[]> {
    if (!this.deps.evidenceVectorStore.getByKeys || !this.deps.memoryVectorStore.getByKeys) {
      throw new Error("Vector store does not support durable record verification")
    }
    const [evidence, memory] = await Promise.all([
      this.deps.evidenceVectorStore.getByKeys(evidenceKeys),
      this.deps.memoryVectorStore.getByKeys(memoryKeys)
    ])
    const expected = [...evidenceKeys, ...memoryKeys]
    const byKey = new Map([...evidence, ...memory].map((record) => [record.key, record]))
    return expected.map((key) => byKey.get(key)).filter((record): record is VectorRecord => record !== undefined)
  }

  private async copyText(sourceKey: string, targetKey: string): Promise<void> {
    const source = await this.deps.objectStore.getText(sourceKey)
    await this.deps.objectStore.putText(targetKey, source, "application/octet-stream")
    if (stableHash(await this.deps.objectStore.getText(targetKey)) !== stableHash(source)) throw new Error("Published object copy verification failed")
  }

  private async loadManifest(key: string): Promise<DocumentManifest> {
    return JSON.parse(await this.deps.objectStore.getText(key)) as DocumentManifest
  }

  private async getActivePointer(key: string): Promise<ActivePublicationPointer> {
    const pointer = await readVersionedJson<ActivePublicationPointer>(this.deps, key)
    if (!pointer) throw new Error("Active publication pointer not found")
    return pointer.value
  }
}

export async function isManifestCurrentPublication(
  deps: Pick<Dependencies, "objectStore">,
  manifest: DocumentManifest,
  snapshot?: PublicationPointerSnapshot
): Promise<boolean> {
  const control = manifest.publicationControl
  if (!control) return true
  const pointerPromise = snapshot?.get(control.activePointerKey)
    ?? loadPublicationPointer(deps, control.activePointerKey)
  if (snapshot && !snapshot.has(control.activePointerKey)) snapshot.set(control.activePointerKey, pointerPromise)
  const pointer = await pointerPromise
  if (pointer) {
    return pointer.artifactId === manifest.documentId
      && control.artifactId === manifest.documentId
      && pointer.manifestObjectKey === manifest.manifestObjectKey
      && pointer.sourceId === control.sourceId
      && pointer.purpose === control.purpose
      && pointer.runId === control.runId
      && pointer.generation === control.generation
      && pointer.fencingToken === control.fencingToken
      && pointer.tenantId === manifest.admission?.tenantId
  }
  return false
}

export function publicationIdentity(scope: PublicationScope): {
  scopeHash: string
  idempotencyKey: string
  runId: string
  artifactId: string
} {
  const normalized = normalizeScope(scope)
  const scopeHash = stableHash(normalized)
  const idempotencyKey = `publication:${scopeHash}`
  return {
    scopeHash,
    idempotencyKey,
    runId: `pubrun_${scopeHash.slice(0, 32)}`,
    artifactId: `pubart_${scopeHash.slice(0, 32)}`
  }
}

export function activePublicationPointerKey(scope: Pick<PublicationScope, "tenantId" | "sourceId" | "purpose">): string {
  return `publication/active/${stableHash(scope.tenantId.trim()).slice(0, 20)}/${stableHash(`${scope.sourceId.trim()}:${scope.purpose}`).slice(0, 32)}.json`
}

function activePointerScopeHash(scope: Pick<PublicationScope, "tenantId" | "sourceId" | "purpose">): string {
  return stableHash({ tenantId: scope.tenantId.trim(), sourceId: scope.sourceId.trim(), purpose: scope.purpose })
}

function publicationRunKey(runId: string): string {
  return `publication/runs/${runId}.json`
}

function stageNamespace(runId: string, generation: number): string {
  return `staging/publications/${runId}/generation-${generation}`
}

function publishedNamespace(artifactId: string, generation: number): string {
  return `published/publications/${artifactId}/generation-${generation}`
}

function rollbackNamespace(runId: string, generation: number): string {
  return `published/rollbacks/${runId}/generation-${generation}`
}

type CompleteRollbackAdmission = NonNullable<DocumentManifest["admission"]> & {
  tenantId: string
  authorizationRef: VersionedRecordReference
  classificationRef: VersionedRecordReference
  usagePolicyRef: VersionedRecordReference
  qualityRef: VersionedRecordReference
  lifecycleRef: VersionedRecordReference
  provenanceRef: VersionedRecordReference
}

function rollbackArtifactIdentity(run: StagedPublicationRun, leaseFence: StagedPublicationFence): {
  artifactId: string
  pointerRunId: string
  fence: StagedPublicationFence
} {
  if (
    leaseFence.runId !== run.runId
    || leaseFence.artifactId !== run.artifactId
    || leaseFence.generation !== run.generation
    || leaseFence.fencingToken !== run.lease?.fencingToken
  ) throw new PublicationFenceError(run.runId)
  const pointerRunId = `${run.runId}:rollback:g${leaseFence.generation}`
  const artifactId = `pubrollback_${stableHash({
    runId: run.runId,
    previousArtifactId: run.previousActiveArtifactId,
    generation: leaseFence.generation,
    fencingToken: leaseFence.fencingToken
  }).slice(0, 32)}`
  return {
    artifactId,
    pointerRunId,
    fence: {
      schemaVersion: 1,
      runId: pointerRunId,
      artifactId,
      idempotencyKey: `${run.idempotencyKey}:rollback:${leaseFence.generation}`,
      sourceId: run.scope.sourceId,
      purpose: "rollback",
      stageNamespace: rollbackNamespace(run.runId, leaseFence.generation),
      generation: leaseFence.generation,
      fencingToken: leaseFence.fencingToken
    }
  }
}

function rollbackAdmission(
  previous: DocumentManifest,
  identity: ReturnType<typeof rollbackArtifactIdentity>
): CompleteRollbackAdmission {
  const admission = previous.admission
  if (!admission || !isCompleteApprovedAdmission(admission)) throw new Error("Rollback source admission is incomplete")
  const lifecycleRef = rollbackReference("lifecycle", identity, previous)
  const provenanceRef = rollbackReference("provenance", identity, previous)
  return { ...admission, lifecycleRef, provenanceRef }
}

function rollbackReference(
  kind: "lifecycle" | "provenance",
  identity: ReturnType<typeof rollbackArtifactIdentity>,
  previous: DocumentManifest
): VersionedRecordReference {
  const version = `rollback-g${identity.fence.generation}`
  return {
    id: `publication:${identity.fence.sourceId}:${kind}`,
    version,
    hash: stableHash({
      kind,
      sourceDocumentId: previous.documentId,
      sourceDocumentVersion: previous.documentVersion,
      artifactId: identity.artifactId,
      runId: identity.pointerRunId,
      generation: identity.fence.generation,
      fencingToken: identity.fence.fencingToken
    })
  }
}

function rollbackPointer(
  run: StagedPublicationRun,
  prepared: PreparedRollbackRecord,
  current: ActivePublicationPointer,
  committedAt: string
): ActivePublicationPointer {
  return {
    schemaVersion: 1,
    scopeHash: activePointerScopeHash(run.scope),
    tenantId: run.scope.tenantId,
    sourceId: run.scope.sourceId,
    purpose: run.scope.purpose,
    artifactId: prepared.artifactId,
    manifestObjectKey: prepared.manifestObjectKey,
    runId: prepared.pointerRunId,
    generation: prepared.generation,
    fencingToken: prepared.fencingToken,
    previousArtifactId: current.artifactId,
    previousManifestObjectKey: current.manifestObjectKey,
    committedAt
  }
}

function rollbackPointerMatches(
  run: StagedPublicationRun,
  prepared: PreparedRollbackRecord,
  pointer: ActivePublicationPointer
): boolean {
  return pointer.scopeHash === activePointerScopeHash(run.scope)
    && pointer.tenantId === run.scope.tenantId
    && pointer.sourceId === run.scope.sourceId
    && pointer.purpose === run.scope.purpose
    && pointer.artifactId === prepared.artifactId
    && pointer.manifestObjectKey === prepared.manifestObjectKey
    && pointer.runId === prepared.pointerRunId
    && pointer.generation === prepared.generation
    && pointer.fencingToken === prepared.fencingToken
    && pointer.previousArtifactId === run.artifactId
    && pointer.previousManifestObjectKey === (run.preparedCommit?.manifestObjectKey ?? tenantManifestKeyForRun(run))
}

function tenantManifestKeyForRun(run: StagedPublicationRun): string {
  return run.preparedCommit?.manifestObjectKey ?? run.stagedArtifact?.manifestObjectKey ?? ""
}

function rollbackManifestProjection(input: {
  documentId: string
  documentVersion: string
  admission: CompleteRollbackAdmission
  sourceSecurityEnvelope: NonNullable<DocumentManifest["securityEnvelope"]>
  publicationFence: StagedPublicationFence
  chunkingPolicy: DocumentManifest["chunkingPolicy"]
  chunkIds: string[]
  memoryCardIds: string[]
  sourceObjectKey: string
  structuredBlocksObjectKey?: string
  memoryCardsObjectKey?: string
}) {
  return {
    documentId: input.documentId,
    documentVersion: input.documentVersion,
    admission: input.admission,
    documentSecurityEnvelopeHash: input.sourceSecurityEnvelope.envelopeHash,
    publicationFence: input.publicationFence,
    chunkingPolicy: input.chunkingPolicy,
    chunkIds: [...input.chunkIds].sort(),
    memoryCardIds: [...input.memoryCardIds].sort(),
    sourceObjectKey: input.sourceObjectKey,
    structuredBlocksObjectKey: input.structuredBlocksObjectKey,
    memoryCardsObjectKey: input.memoryCardsObjectKey
  }
}

function transformRollbackMemoryCards(
  text: string | undefined,
  input: {
    documentId: string
    documentVersion: string
    admission: CompleteRollbackAdmission
    verifyOnly?: boolean
  }
): MemoryCard[] {
  if (text === undefined) return []
  const parsed = JSON.parse(text) as { memoryCards?: MemoryCard[] }
  if (!Array.isArray(parsed.memoryCards)) throw new Error("Rollback memory card ledger is invalid")
  if (input.verifyOnly) {
    for (const card of parsed.memoryCards) {
      if (verifyDerivedRecordSecurityEnvelope(card.securityEnvelope, input).length > 0) {
        throw new Error("Prepared rollback memory security envelope verification failed")
      }
    }
    return parsed.memoryCards
  }
  return parsed.memoryCards.map((card) => ({
    ...card,
    securityEnvelope: createDerivedRecordSecurityEnvelope({
      documentId: input.documentId,
      documentVersion: input.documentVersion,
      admission: input.admission,
      sourceLocator: requiredSourceLocator(card.securityEnvelope?.sourceLocator, `memory:${card.id}`)
    })
  }))
}

function requiredSourceLocator(locator: SourceLocation | undefined, label: string): SourceLocation {
  if (!locator) throw new Error(`Rollback source locator is missing: ${label}`)
  return locator
}

function optionalTextHashMatches(text: string | undefined, expectedHash: string | undefined): boolean {
  return text === undefined ? expectedHash === undefined : expectedHash !== undefined && stableHash(text) === expectedHash
}

function fenceForRun(run: StagedPublicationRun, generation: number, fencingToken: string, namespace = stageNamespace(run.runId, generation)): StagedPublicationFence {
  return {
    schemaVersion: 1,
    runId: run.runId,
    artifactId: run.artifactId,
    idempotencyKey: run.idempotencyKey,
    sourceId: run.scope.sourceId,
    purpose: run.scope.purpose,
    stageNamespace: namespace,
    generation,
    fencingToken
  }
}

function sameFence(run: StagedPublicationRun, fence: StagedPublicationFence): boolean {
  return run.lease?.generation === fence.generation
    && run.lease.fencingToken === fence.fencingToken
    && run.runId === fence.runId
    && run.artifactId === fence.artifactId
}

function normalizeScope(scope: PublicationScope): PublicationScope {
  const normalized = {
    tenantId: scope.tenantId.trim(),
    actorId: scope.actorId.trim(),
    sourceId: scope.sourceId.trim(),
    sourceVersion: scope.sourceVersion.trim(),
    purpose: scope.purpose
  }
  if (!normalized.tenantId || !normalized.actorId || !normalized.sourceId || !normalized.sourceVersion) {
    throw new Error("Publication scope is incomplete")
  }
  return normalized
}

async function readVersionedJson<T>(
  deps: Pick<Dependencies, "objectStore">,
  key: string
): Promise<{ value: T; version: string } | undefined> {
  try {
    const stored = await deps.objectStore.getTextWithVersion(key)
    return { value: JSON.parse(stored.text) as T, version: stored.version }
  } catch (error) {
    if (isMissingObjectError(error)) return undefined
    throw error
  }
}

async function loadPublicationPointer(
  deps: Pick<Dependencies, "objectStore">,
  key: string
): Promise<ActivePublicationPointer | undefined> {
  try {
    return JSON.parse(await deps.objectStore.getText(key)) as ActivePublicationPointer
  } catch {
    return undefined
  }
}

function isConditionalWriteError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as Error & { code?: string; name?: string }).code ?? error.name
  return code === "PRECONDITION_FAILED" || code === "PreconditionFailed" || error.message.includes("Conditional write failed")
}

function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as NodeJS.ErrnoException & { name?: string }).code ?? error.name
  return code === "ENOENT" || code === "NoSuchKey" || error.message.includes("not found") || error.message.includes("specified key does not exist")
}

function isString(value: string | undefined): value is string {
  return typeof value === "string"
}

function stringMetadata(manifest: DocumentManifest, key: string): string | undefined {
  const value = manifest.metadata?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function optionalObjectHashMatches(
  objects: ReadonlyMap<string, string>,
  key: string | undefined,
  expectedHash: string | undefined
): boolean {
  if (!key) return expectedHash === undefined
  const value = objects.get(key)
  return value !== undefined && expectedHash !== undefined && stableHash(value) === expectedHash
}
