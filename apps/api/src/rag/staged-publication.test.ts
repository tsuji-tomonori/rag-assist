import assert from "node:assert/strict"
import { promises as fs } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { AppUser } from "../auth.js"
import { ragRuntimePolicy } from "../chat-orchestration/runtime-policy.js"
import type { Dependencies } from "../dependencies.js"
import type {
  AuthoritativeAdmissionContext,
  DocumentManifest,
  DocumentQualityProfile,
  RetrievedVector,
  VectorRecord
} from "../types.js"
import {
  isManifestCurrentPublication,
  PublicationFenceError,
  PublicationLeaseConflictError,
  publicationIdentity,
  type PreparedRollbackRecord,
  type PublicationScope,
  type StagedPublicationRun,
  StagedPublicationCoordinator
} from "./_shared/publication/staged-publication-coordinator.js"
import { runIngestPipeline } from "./offline/pre-retrieval/ingestion/ingest-run.service.js"
import { createVersionedReference } from "./offline/pre-retrieval/admission/source-admission.js"
import type { SourceGovernanceRecord } from "./offline/pre-retrieval/admission/source-governance-approval-service.js"
import { searchRag } from "./online/retrieval/hybrid/hybrid-retriever.js"
import { RAG_SAFETY_STATE_KEY, type RagSafetyState } from "./quality-control/production-rag-monitor.js"
import {
  tenantArtifactRoot,
  tenantDocumentArtifactPrefix,
  tenantManifestKey,
  tenantManifestPrefix
} from "./_shared/storage/tenant-artifacts.js"

test("FR-072 publication identity is stable and scoped by tenant, actor, source/version, and purpose", () => {
  const scope: PublicationScope = {
    tenantId: "tenant-a",
    actorId: "actor-a",
    sourceId: "source-a",
    sourceVersion: "version-a",
    purpose: "reindex"
  }
  const identity = publicationIdentity(scope)

  assert.deepEqual(publicationIdentity({ ...scope }), identity)
  for (const changed of [
    { ...scope, tenantId: "tenant-b" },
    { ...scope, actorId: "actor-b" },
    { ...scope, sourceId: "source-b" },
    { ...scope, sourceVersion: "version-b" },
    { ...scope, purpose: "rollback" as const }
  ]) {
    assert.notEqual(publicationIdentity(changed).idempotencyKey, identity.idempotencyKey)
    assert.notEqual(publicationIdentity(changed).runId, identity.runId)
    assert.notEqual(publicationIdentity(changed).artifactId, identity.artifactId)
  }
})

test("FR-083 validates a staged namespace before atomic cutover and supports idempotent rollback", async (t) => {
  const harness = await createHarness(t)
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const publication = await stagePublication(harness, coordinator, baseScope(harness.source), "stage-a", "Replacement revision")

  assert.equal(publication.run.status, "validated")
  assert.equal(publication.run.checkpoint, "validation_complete")
  assert.ok(publication.manifest.manifestObjectKey.startsWith(`${tenantArtifactRoot(publication.run.scope.tenantId)}/`))
  assert.ok(publication.manifest.manifestObjectKey.endsWith(`staging/publications/${publication.run.runId}/generation-1/manifests/${publication.run.artifactId}.json`))
  assert.equal(publication.manifest.lifecycleStatus, "staging")
  assert.equal(await isManifestCurrentPublication(harness.deps, harness.source), true)
  await assert.rejects(
    () => harness.deps.objectStore.getText(tenantManifestKey(harness.deps, publication.run.scope.tenantId, publication.run.artifactId)),
    /ENOENT/
  )

  const committed = await coordinator.commit(publication.run.runId, "commit-a")
  assert.equal(committed.run.status, "committed")
  assert.equal(committed.run.checkpoint, "committed")
  assert.equal(committed.pointer.artifactId, publication.run.artifactId)
  assert.equal(await isManifestCurrentPublication(harness.deps, committed.manifest), true)
  assert.equal(await isManifestCurrentPublication(harness.deps, await readManifest(harness, harness.source.manifestObjectKey)), false)
  assert.ok(committed.manifest.vectorKeys.every((key) => key.includes(`-active-g${committed.run.generation}-`)))
  assert.equal((await harness.evidence.getByKeys(publication.manifest.evidenceVectorKeys ?? [])).length, 0)
  assert.equal((await harness.evidence.getByKeys(committed.manifest.evidenceVectorKeys ?? [])).length, committed.manifest.evidenceVectorKeys?.length)

  const repeated = await coordinator.begin({
    scope: baseScope(harness.source),
    sourceManifest: committed.manifest,
    workerId: "stage-retry"
  })
  assert.equal(repeated.alreadyStaged, true)
  assert.equal(repeated.run.runId, publication.run.runId)
  assert.equal(repeated.run.artifactId, publication.run.artifactId)
  assert.equal(repeated.lease, undefined)

  const rolledBack = await coordinator.rollback(publication.run.runId, "rollback-a")
  assert.equal(rolledBack.run.status, "rolled_back")
  assert.match(rolledBack.pointer.artifactId, /^pubrollback_/)
  assert.notEqual(rolledBack.pointer.artifactId, harness.source.documentId)
  assert.equal(rolledBack.run.preparedRollback?.sourceArtifactId, harness.source.documentId)
  assert.equal(await isManifestCurrentPublication(harness.deps, rolledBack.manifest), true)
  assert.equal(await isManifestCurrentPublication(harness.deps, committed.manifest), false)

  const repeatedRollback = await coordinator.rollback(publication.run.runId, "rollback-retry")
  assert.equal(repeatedRollback.run.status, "rolled_back")
  assert.equal(repeatedRollback.pointer.artifactId, rolledBack.pointer.artifactId)
})

test("FR-072 rollback copies memory objects and vectors into its immutable generation namespace", async (t) => {
  const harness = await createHarness(t, { withMemory: true })
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    coordinator,
    baseScope(harness.source),
    "stage-memory-rollback",
    "Replacement revision without source memory"
  )
  await coordinator.commit(staged.run.runId, "commit-memory-rollback")
  const rolledBack = await coordinator.rollback(staged.run.runId, "rollback-memory-artifacts")
  const prepared = rolledBack.run.preparedRollback

  assert.ok(prepared)
  assert.equal(rolledBack.manifest.documentId, prepared.artifactId)
  assert.notEqual(rolledBack.manifest.documentId, harness.source.documentId)
  assert.notEqual(rolledBack.manifest.structuredBlocksObjectKey, harness.source.structuredBlocksObjectKey)
  assert.ok(rolledBack.manifest.structuredBlocksObjectKey?.startsWith(`${prepared.namespace}/`))
  assert.notEqual(rolledBack.manifest.memoryCardsObjectKey, harness.source.memoryCardsObjectKey)
  assert.ok(rolledBack.manifest.memoryCardsObjectKey?.startsWith(`${prepared.namespace}/`))
  assert.equal(rolledBack.manifest.memoryCardCount, harness.source.memoryCardCount)
  assert.equal(rolledBack.manifest.memoryVectorKeys?.length, harness.source.memoryVectorKeys?.length)
  assert.ok(rolledBack.manifest.memoryVectorKeys?.every((key) => !harness.source.memoryVectorKeys?.includes(key)))

  const memoryLedger = JSON.parse(await harness.deps.objectStore.getText(rolledBack.manifest.memoryCardsObjectKey!)) as {
    memoryCards: Array<{ securityEnvelope?: { documentId: string; documentVersion: string } }>
  }
  assert.ok(memoryLedger.memoryCards.every((card) => (
    card.securityEnvelope?.documentId === rolledBack.manifest.documentId
    && card.securityEnvelope.documentVersion === rolledBack.manifest.documentVersion
  )))
  const memoryRecords = await harness.memory.getByKeys(rolledBack.manifest.memoryVectorKeys ?? [])
  assert.ok(memoryRecords.every((record) => (
    record.metadata.documentId === rolledBack.manifest.documentId
    && record.metadata.documentVersion === rolledBack.manifest.documentVersion
    && record.metadata.securityEnvelope?.documentId === rolledBack.manifest.documentId
  )))
})

test("FR-093 promotion freeze blocks staged publication before the active pointer changes", async (t) => {
  const harness = await createHarness(t)
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const publication = await stagePublication(harness, coordinator, baseScope(harness.source), "stage-monitor-freeze", "Frozen revision")
  const pointerBefore = await harness.deps.objectStore.getText(publication.run.activePointerKey)
  const safetyState: RagSafetyState = {
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: ragRuntimePolicy.profile.version,
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: true,
    documentQuarantineRequired: false,
    responseMode: "normal",
    updatedAt: "2026-07-11T00:00:00.000Z",
    validUntil: "2099-01-01T00:00:00.000Z"
  }
  await harness.deps.objectStore.putText(RAG_SAFETY_STATE_KEY, JSON.stringify(safetyState))

  await assert.rejects(
    () => coordinator.commit(publication.run.runId, "commit-monitor-freeze"),
    /promotion is frozen/
  )
  assert.equal(await harness.deps.objectStore.getText(publication.run.activePointerKey), pointerBefore)
  assert.equal((await coordinator.getRun(publication.run.runId)).status, "validated")
  assert.equal(await isManifestCurrentPublication(harness.deps, harness.source), true)
})

test("FR-072 expired leases fence stale writers and permit a higher generation to finish staging", async (t) => {
  const harness = await createHarness(t)
  let now = Date.parse("2026-07-11T00:00:00.000Z")
  const coordinator = new StagedPublicationCoordinator(harness.deps, {}, () => new Date(now))
  const scope = baseScope(harness.source)
  const first = await coordinator.begin({ scope, sourceManifest: harness.source, workerId: "worker-a", leaseMs: 10 })
  assert.ok(first.lease)
  const firstManifest = await ingestStaged(harness, first.lease!.fence, "Stale attempt")

  now += 11
  const second = await coordinator.begin({ scope, sourceManifest: harness.source, workerId: "worker-b", leaseMs: 10 })
  assert.ok(second.lease)
  assert.equal(second.lease.fence.generation, first.lease.fence.generation + 1)
  const secondManifest = await ingestStaged(harness, second.lease!.fence, "Winning attempt")

  await assert.rejects(() => coordinator.recordStaged(first.lease!, firstManifest), PublicationFenceError)
  const validated = await coordinator.recordStaged(second.lease!, secondManifest)
  assert.equal(validated.status, "validated")
  assert.equal(validated.stagedArtifact?.generation, second.lease.fence.generation)
  assert.equal(validated.stagedArtifact?.fencingToken, second.lease.fence.fencingToken)
})

test("FR-083 rejects tampered staged objects and vector metadata before validation completes", async (t) => {
  const harness = await createHarness(t)
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const begun = await coordinator.begin({
    scope: baseScope(harness.source),
    sourceManifest: harness.source,
    workerId: "stage-integrity"
  })
  assert.ok(begun.lease)
  const manifest = await ingestStaged(harness, begun.lease.fence, "Integrity protected staging content")

  const sourceText = await harness.deps.objectStore.getText(manifest.sourceObjectKey)
  await harness.deps.objectStore.putText(manifest.sourceObjectKey, `${sourceText} tampered`)
  await assert.rejects(() => coordinator.recordStaged(begun.lease!, manifest), /object content hash mismatch/)
  await harness.deps.objectStore.putText(manifest.sourceObjectKey, sourceText)

  const [record] = await harness.evidence.getByKeys(manifest.evidenceVectorKeys ?? [])
  assert.ok(record)
  await harness.evidence.put([{ ...record, metadata: { ...record.metadata, tenantId: "tenant-tampered" } }])
  await assert.rejects(() => coordinator.recordStaged(begun.lease!, manifest), /vector record hash mismatch/)
  await harness.evidence.put([record])

  const validated = await coordinator.recordStaged(begun.lease, manifest)
  assert.equal(validated.status, "validated")
})

test("FR-083 pre-pointer failure is retryable and post-pointer failure is reconciled without mixed visibility", async (t) => {
  const prePointer = await createHarness(t)
  const failingBeforePointer = new StagedPublicationCoordinator(prePointer.deps, {
    afterPrepared: async () => { throw new Error("fault:after-prepared") }
  })
  const stagedBeforePointer = await stagePublication(
    prePointer,
    failingBeforePointer,
    baseScope(prePointer.source),
    "stage-before-fault",
    "Pre-pointer fault"
  )

  await assert.rejects(
    () => failingBeforePointer.commit(stagedBeforePointer.run.runId, "commit-before-fault"),
    /fault:after-prepared/
  )
  const retryable = await failingBeforePointer.getRun(stagedBeforePointer.run.runId)
  assert.equal(retryable.status, "validated")
  assert.equal(retryable.preparedCommit, undefined)
  assert.equal(await isManifestCurrentPublication(prePointer.deps, await readManifest(prePointer, prePointer.source.manifestObjectKey)), true)

  const retried = await new StagedPublicationCoordinator(prePointer.deps).commit(stagedBeforePointer.run.runId, "commit-retry")
  assert.equal(retried.run.status, "committed")
  assert.equal(await isManifestCurrentPublication(prePointer.deps, retried.manifest), true)

  const postPointer = await createHarness(t)
  const failingAfterPointer = new StagedPublicationCoordinator(postPointer.deps, {
    afterPointerCommitted: async () => { throw new Error("fault:after-pointer") }
  })
  const stagedAfterPointer = await stagePublication(
    postPointer,
    failingAfterPointer,
    baseScope(postPointer.source),
    "stage-after-fault",
    "Post-pointer fault"
  )
  await assert.rejects(
    () => failingAfterPointer.commit(stagedAfterPointer.run.runId, "commit-after-fault"),
    /fault:after-pointer/
  )
  assert.equal((await failingAfterPointer.getRun(stagedAfterPointer.run.runId)).status, "committing")

  const reconciler = new StagedPublicationCoordinator(postPointer.deps)
  const recoveredCommit = await reconciler.commit(stagedAfterPointer.run.runId, "commit-after-pointer-retry")
  assert.equal(recoveredCommit.run.status, "committed")
  const reconciled = await reconciler.reconcile(stagedAfterPointer.run.runId)
  assert.equal(reconciled.status, "committed")
  const canonical = await readManifest(postPointer, tenantManifestKey(postPointer.deps, reconciled.scope.tenantId, reconciled.artifactId))
  assert.equal(await isManifestCurrentPublication(postPointer.deps, canonical), true)
  assert.equal(await isManifestCurrentPublication(postPointer.deps, await readManifest(postPointer, postPointer.source.manifestObjectKey)), false)
  assert.equal((await postPointer.deps.objectStore.listKeys(tenantDocumentArtifactPrefix(
    postPointer.deps,
    reconciled.scope.tenantId,
    `staging/publications/${reconciled.runId}/`
  ))).length, 0)
})

test("FR-072 rollback CAS loss never reactivates the previous artifact", async (t) => {
  const harness = await createHarness(t)
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    coordinator,
    baseScope(harness.source),
    "stage-rollback-cas",
    "Rollback CAS protected revision"
  )
  const committed = await coordinator.commit(staged.run.runId, "commit-rollback-cas")
  const sourceBefore = await readManifest(harness, harness.source.manifestObjectKey)
  assert.equal(sourceBefore.lifecycleStatus, "superseded")

  const losingRollback = new StagedPublicationCoordinator(harness.deps, {
    beforeRollbackPointerCommitted: async () => {
      const current = JSON.parse(await harness.deps.objectStore.getText(staged.run.activePointerKey)) as Record<string, unknown>
      await harness.deps.objectStore.putText(staged.run.activePointerKey, JSON.stringify({
        ...current,
        committedAt: "2026-07-11T00:00:00.001Z"
      }))
    }
  })
  await assert.rejects(
    () => losingRollback.rollback(staged.run.runId, "rollback-cas-loser"),
    PublicationLeaseConflictError
  )

  const sourceAfter = await readManifest(harness, harness.source.manifestObjectKey)
  const currentAfter = await readManifest(harness, committed.manifest.manifestObjectKey)
  assert.equal(sourceAfter.lifecycleStatus, "superseded")
  assert.equal(currentAfter.lifecycleStatus, "active")
  assert.ok((await harness.evidence.getByKeys(sourceAfter.evidenceVectorKeys ?? []))
    .every((record) => record.metadata.lifecycleStatus === "superseded"))
  assert.ok((await harness.evidence.getByKeys(currentAfter.evidenceVectorKeys ?? []))
    .every((record) => record.metadata.lifecycleStatus === "active"))
})

test("FR-072 post-rollback-pointer interruption preserves exactly one readable active artifact", async (t) => {
  const harness = await createHarness(t)
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    coordinator,
    baseScope(harness.source),
    "stage-rollback-interruption",
    "Rollback interruption protected revision"
  )
  const committed = await coordinator.commit(staged.run.runId, "commit-rollback-interruption")
  const interrupted = new StagedPublicationCoordinator(harness.deps, {
    afterRollbackPointerCommitted: async (pointer) => {
      const previous = await readManifest(harness, pointer.manifestObjectKey)
      const current = await readManifest(harness, committed.manifest.manifestObjectKey)
      const visible = (await Promise.all([previous, current].map(async (manifest) => ({
        manifest,
        current: await isManifestCurrentPublication(harness.deps, manifest)
      })))).filter(({ manifest, current: isCurrent }) => isCurrent && manifest.lifecycleStatus === "active")
      assert.deepEqual(visible.map(({ manifest }) => manifest.documentId), [pointer.artifactId])
      throw new Error("fault:after-rollback-pointer")
    }
  })

  await assert.rejects(
    () => interrupted.rollback(staged.run.runId, "rollback-interrupted"),
    /fault:after-rollback-pointer/
  )
  assert.equal((await interrupted.getRun(staged.run.runId)).status, "rolling_back")
  const pointerBeforeReconcile = JSON.parse(await harness.deps.objectStore.getText(staged.run.activePointerKey)) as { manifestObjectKey: string }
  const previousBeforeReconcile = await readManifest(harness, pointerBeforeReconcile.manifestObjectKey)
  const currentBeforeReconcile = await readManifest(harness, committed.manifest.manifestObjectKey)
  assert.equal(await isManifestCurrentPublication(harness.deps, previousBeforeReconcile), true)
  assert.equal(await isManifestCurrentPublication(harness.deps, currentBeforeReconcile), false)

  const reconciler = new StagedPublicationCoordinator(harness.deps)
  assert.equal((await reconciler.reconcile(staged.run.runId)).status, "rolled_back")
  assert.equal(await isManifestCurrentPublication(harness.deps, await readManifest(harness, committed.manifest.manifestObjectKey)), false)
})

test("FR-072 ambiguous rollback pointer write is retained for exact-fence reconciliation", async (t) => {
  const harness = await createHarness(t)
  const setup = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    setup,
    baseScope(harness.source),
    "stage-ambiguous-pointer",
    "Rollback ambiguous pointer protected revision"
  )
  await setup.commit(staged.run.runId, "commit-ambiguous-pointer")

  const putTextIfVersion = harness.deps.objectStore.putTextIfVersion.bind(harness.deps.objectStore)
  let injectAmbiguousFailure = true
  harness.deps.objectStore.putTextIfVersion = async (...args) => {
    const result = await putTextIfVersion(...args)
    if (injectAmbiguousFailure && args[0] === staged.run.activePointerKey) {
      injectAmbiguousFailure = false
      throw new Error("simulated ambiguous pointer acknowledgement")
    }
    return result
  }

  await assert.rejects(
    () => setup.rollback(staged.run.runId, "rollback-ambiguous-pointer"),
    /simulated ambiguous pointer acknowledgement/
  )
  const interrupted = await setup.getRun(staged.run.runId)
  assert.equal(interrupted.status, "rolling_back")
  assert.ok(interrupted.preparedRollback)
  assert.equal(JSON.parse(await harness.deps.objectStore.getText(staged.run.activePointerKey)).artifactId, interrupted.preparedRollback.artifactId)
  assert.equal(await harness.deps.objectStore.getText(interrupted.preparedRollback.manifestObjectKey).then(() => true), true)

  const reconciled = await new StagedPublicationCoordinator(harness.deps).reconcile(staged.run.runId)
  assert.equal(reconciled.status, "rolled_back")
})

test("FR-072 partial rollback vector writes are removed before the pointer can move", async (t) => {
  const harness = await createHarness(t, { withMemory: true })
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    coordinator,
    baseScope(harness.source),
    "stage-rollback-partial-vector",
    "Rollback partial vector protected revision"
  )
  const committed = await coordinator.commit(staged.run.runId, "commit-rollback-partial-vector")
  const evidenceKeysBefore = harness.evidence.keys()
  const memoryKeysBefore = harness.memory.keys()
  harness.memory.failNextPutAfter(1)

  await assert.rejects(
    () => coordinator.rollback(staged.run.runId, "rollback-partial-vector"),
    /simulated partial rollback vector write/
  )

  const pointer = JSON.parse(await harness.deps.objectStore.getText(staged.run.activePointerKey)) as { artifactId: string; runId: string }
  assert.equal(pointer.artifactId, committed.manifest.documentId)
  assert.equal(pointer.runId, staged.run.runId)
  assert.deepEqual(harness.evidence.keys(), evidenceKeysBefore)
  assert.deepEqual(harness.memory.keys(), memoryKeysBefore)
  assert.equal((await coordinator.getRun(staged.run.runId)).status, "committed")
})

test("FR-072 expired rollback worker cannot clean or overwrite a higher-generation winner", async (t) => {
  const harness = await createHarness(t)
  let now = Date.parse("2026-07-11T02:00:00.000Z")
  const clock = () => new Date(now)
  const setup = new StagedPublicationCoordinator(harness.deps, {}, clock)
  const staged = await stagePublication(
    harness,
    setup,
    baseScope(harness.source),
    "stage-expired-rollback",
    "Rollback lease race protected revision"
  )
  await setup.commit(staged.run.runId, "commit-expired-rollback")

  let releaseFirst!: () => void
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
  let firstPrepared!: PreparedRollbackRecord
  let signalPrepared!: () => void
  const preparedSignal = new Promise<void>((resolve) => { signalPrepared = resolve })
  const first = new StagedPublicationCoordinator(harness.deps, {
    afterRollbackPrepared: async (prepared) => {
      firstPrepared = prepared
      signalPrepared()
      await firstGate
    }
  }, clock)
  const firstAttempt = first.rollback(staged.run.runId, "rollback-worker-a", 10)
  await preparedSignal

  now += 11
  const second = new StagedPublicationCoordinator(harness.deps, {}, clock)
  const winner = await second.rollback(staged.run.runId, "rollback-worker-b", 10)
  releaseFirst()
  await assert.rejects(() => firstAttempt, PublicationFenceError)

  assert.notEqual(winner.pointer.artifactId, firstPrepared.artifactId)
  assert.equal(await isManifestCurrentPublication(harness.deps, winner.manifest), true)
  await assert.rejects(() => harness.deps.objectStore.getText(firstPrepared.manifestObjectKey), /ENOENT/)
  assert.equal(JSON.parse(await harness.deps.objectStore.getText(staged.run.activePointerKey)).artifactId, winner.pointer.artifactId)
})

test("FR-072 governance restriction after rollback preparation prevents pointer publication", async (t) => {
  const harness = await createHarness(t, { productionEligibility: true })
  const setup = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    setup,
    baseScope(harness.source),
    "stage-governance-revoke",
    "Rollback governance revoke protected revision"
  )
  const committed = await setup.commit(staged.run.runId, "commit-governance-revoke")
  const governance = await seedPublishedGovernance(harness, staged.run, committed.manifest)
  let preparedManifestObjectKey = ""
  const restricted = new StagedPublicationCoordinator(harness.deps, {
    afterRollbackPrepared: async (prepared) => {
      preparedManifestObjectKey = prepared.manifestObjectKey
      const restrictedAt = new Date().toISOString()
      await harness.deps.objectStore.putText(governance.key, JSON.stringify({
        ...governance.record,
        status: "restricted",
        revision: governance.record.revision + 1,
        restriction: {
          dimensions: ["lifecycle"],
          deniedPurposes: ["normal_rag"],
          restrictedBy: "security-owner",
          restrictedAt,
          reason: "source revoked during rollback preparation"
        },
        updatedAt: restrictedAt
      }, null, 2))
    }
  })

  await assert.rejects(
    () => restricted.rollback(staged.run.runId, "rollback-governance-revoked"),
    /does not authorize rollback publication/
  )
  const pointer = JSON.parse(await harness.deps.objectStore.getText(staged.run.activePointerKey)) as { artifactId: string }
  assert.equal(pointer.artifactId, committed.manifest.documentId)
  await assert.rejects(() => harness.deps.objectStore.getText(preparedManifestObjectKey), /ENOENT/)
  assert.equal((await restricted.getRun(staged.run.runId)).status, "committed")
})

test("FR-072 reconcile rejects a pointer with the right artifact but another run fence", async (t) => {
  const harness = await createHarness(t)
  const setup = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    setup,
    baseScope(harness.source),
    "stage-reconcile-fence",
    "Rollback reconcile fence protected revision"
  )
  await setup.commit(staged.run.runId, "commit-reconcile-fence")
  const interrupted = new StagedPublicationCoordinator(harness.deps, {
    afterRollbackPointerCommitted: async () => { throw new Error("fault:rollback-reconcile-fence") }
  })
  await assert.rejects(
    () => interrupted.rollback(staged.run.runId, "rollback-reconcile-fence"),
    /fault:rollback-reconcile-fence/
  )
  const correctPointer = JSON.parse(await harness.deps.objectStore.getText(staged.run.activePointerKey)) as Record<string, unknown>
  await harness.deps.objectStore.putText(staged.run.activePointerKey, JSON.stringify({
    ...correctPointer,
    runId: "different-publication-run",
    fencingToken: "different-fencing-token"
  }))

  const reconciler = new StagedPublicationCoordinator(harness.deps)
  assert.equal((await reconciler.reconcile(staged.run.runId)).status, "rolling_back")
  await harness.deps.objectStore.putText(staged.run.activePointerKey, JSON.stringify(correctPointer))
  assert.equal((await reconciler.reconcile(staged.run.runId)).status, "rolled_back")
})

test("FR-072 reconcile leaves a live rollback lease and its generation-owned artifact intact", async (t) => {
  const harness = await createHarness(t)
  const clock = () => new Date("2026-07-11T02:30:00.000Z")
  const setup = new StagedPublicationCoordinator(harness.deps, {}, clock)
  const staged = await stagePublication(
    harness,
    setup,
    baseScope(harness.source),
    "stage-live-reconcile",
    "Rollback live reconcile protected revision"
  )
  await setup.commit(staged.run.runId, "commit-live-reconcile")

  let releasePrepared!: () => void
  const preparedGate = new Promise<void>((resolve) => { releasePrepared = resolve })
  let signalPrepared!: () => void
  const preparedSignal = new Promise<void>((resolve) => { signalPrepared = resolve })
  const worker = new StagedPublicationCoordinator(harness.deps, {
    afterRollbackPrepared: async () => {
      signalPrepared()
      await preparedGate
    }
  }, clock)
  const rollbackAttempt = worker.rollback(staged.run.runId, "rollback-live-reconcile", 1_000)
  await preparedSignal

  const reconciler = new StagedPublicationCoordinator(harness.deps, {}, clock)
  const observed = await reconciler.reconcile(staged.run.runId)
  assert.equal(observed.status, "rolling_back")
  assert.ok(observed.lease)
  assert.ok(observed.preparedRollback)
  assert.equal(await harness.deps.objectStore.getText(observed.preparedRollback.manifestObjectKey).then(() => true), true)

  releasePrepared()
  const rolledBack = await rollbackAttempt
  assert.equal(rolledBack.run.status, "rolled_back")
  assert.equal(rolledBack.pointer.artifactId, observed.preparedRollback.artifactId)
})

test("FR-072 auth-enabled production eligibility treats the verified rollback pointer as authoritative for search", async (t) => {
  const harness = await createHarness(t, { productionEligibility: true })
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const staged = await stagePublication(
    harness,
    coordinator,
    baseScope(harness.source),
    "stage-production-search",
    "Replacement revision must not remain searchable after rollback"
  )
  const committed = await coordinator.commit(staged.run.runId, "commit-production-search")
  await seedPublishedGovernance(harness, staged.run, committed.manifest)
  const rolledBack = await coordinator.rollback(staged.run.runId, "rollback-production-search")
  const actor: AppUser = {
    userId: "owner-publication",
    tenantId: "tenant-publication",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"]
  }

  const result = await searchRag(harness.deps, {
    query: "authoritative source",
    topK: 5,
    lexicalTopK: 10,
    semanticTopK: 0
  }, actor)

  assert.deepEqual(result.results.map((item) => item.documentId), [rolledBack.manifest.documentId])
  assert.ok(result.results.every((item) => item.text.includes("authoritative source")))
})

test("FR-083 concurrent publications have one durable pointer winner and exactly one visible artifact", async (t) => {
  const harness = await createHarness(t)
  const coordinator = new StagedPublicationCoordinator(harness.deps)
  const first = await stagePublication(
    harness,
    coordinator,
    baseScope(harness.source, "revision-a"),
    "stage-first",
    "Concurrent revision A"
  )
  const second = await stagePublication(
    harness,
    coordinator,
    baseScope(harness.source, "revision-b"),
    "stage-second",
    "Concurrent revision B"
  )

  const outcomes = await Promise.allSettled([
    coordinator.commit(first.run.runId, "commit-first"),
    coordinator.commit(second.run.runId, "commit-second")
  ])
  const winners = outcomes.filter((outcome): outcome is PromiseFulfilledResult<Awaited<ReturnType<StagedPublicationCoordinator["commit"]>>> => outcome.status === "fulfilled")
  const losers = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected")
  assert.equal(winners.length, 1)
  assert.equal(losers.length, 1)
  assert.ok(losers[0]?.reason instanceof PublicationLeaseConflictError)

  const winner = winners[0]!.value
  const pointer = JSON.parse(await harness.deps.objectStore.getText(winner.run.activePointerKey)) as { artifactId: string; runId: string }
  assert.equal(pointer.artifactId, winner.run.artifactId)
  assert.equal(pointer.runId, winner.run.runId)

  const manifests = await Promise.all((await harness.deps.objectStore.listKeys(tenantManifestPrefix(harness.deps, winner.run.scope.tenantId)))
    .filter((key) => key.endsWith(".json"))
    .map((key) => readManifest(harness, key)))
  const visible = (await Promise.all(manifests.map(async (manifest) => ({
    manifest,
    current: await isManifestCurrentPublication(harness.deps, manifest)
  }))))
    .filter(({ manifest, current }) => current && (manifest.lifecycleStatus ?? "active") === "active")
  assert.deepEqual(visible.map(({ manifest }) => manifest.documentId), [winner.run.artifactId])

  const losingRunId = winner.run.runId === first.run.runId ? second.run.runId : first.run.runId
  const losingRun = await coordinator.getRun(losingRunId)
  assert.equal(losingRun.status, "validated")
  assert.equal(losingRun.preparedCommit, undefined)
})

type Harness = {
  deps: Dependencies
  source: DocumentManifest
  evidence: MemoryVectorStore
  memory: MemoryVectorStore
}

async function createHarness(
  t: { after: (fn: () => Promise<void>) => void },
  options: { productionEligibility?: boolean; withMemory?: boolean } = {}
): Promise<Harness> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "memorag-publication-"))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const evidence = new MemoryVectorStore()
  const memory = new MemoryVectorStore()
  const deps = {
    objectStore: new LocalObjectStore(root),
    evidenceVectorStore: evidence,
    memoryVectorStore: memory,
    documentGroupStore: new LocalDocumentGroupStore(root),
    folderPolicyStore: new LocalFolderPolicyStore(root),
    userGroupStore: new LocalUserGroupStore(root),
    groupMembershipStore: new LocalGroupMembershipStore(root),
    ...(options.productionEligibility ? {} : {
      localTestIngestAdmissionContext: {
        mode: "local_test_fixture",
        fixtureId: "staged-publication-test",
        tenantId: "tenant-publication",
        ownerUserId: "owner-publication"
      }
    }),
    legacyGlobalDocumentArtifacts: false,
    textModel: {
      embed: async (text: string) => [text.length, 1],
      generate: async () => "{}"
    }
  } as unknown as Dependencies
  const source = await runIngestPipeline(deps, {
    fileName: "source.md",
    text: "# Source\n\nThis is the authoritative source used for publication tests.",
    structuredBlocks: options.withMemory ? [{
      id: "source-block",
      kind: "text",
      text: "# Source\n\nThis is the authoritative source used for publication tests."
    }] : undefined,
    admissionContext: admissionContext("active"),
    currentAuthorization: testCurrentAuthorization(),
    skipMemory: !options.withMemory
  }, async ({ chunks }) => options.withMemory ? [{
    id: "memory-source-summary",
    level: "document",
    summary: "Authoritative source memory",
    keywords: ["authoritative", "source"],
    likelyQuestions: ["Which source is authoritative?"],
    constraints: ["Use only while currently eligible."],
    text: "The source document is authoritative.",
    sourceChunkIds: chunks.map((chunk) => chunk.id)
  }] : [])
  assert.equal(source.publicationEligible, true)
  return { deps, source, evidence, memory }
}

async function stagePublication(
  harness: Harness,
  coordinator: StagedPublicationCoordinator,
  scope: PublicationScope,
  workerId: string,
  text: string
) {
  const begun = await coordinator.begin({ scope, sourceManifest: harness.source, workerId })
  assert.ok(begun.lease)
  const manifest = await ingestStaged(harness, begun.lease.fence, text)
  const run = await coordinator.recordStaged(begun.lease, manifest)
  return { run, manifest }
}

async function ingestStaged(
  harness: Harness,
  fence: NonNullable<Awaited<ReturnType<StagedPublicationCoordinator["begin"]>>["lease"]>["fence"],
  text: string
): Promise<DocumentManifest> {
  return runIngestPipeline(harness.deps, {
    fileName: "source.md",
    text,
    admissionContext: admissionContext("staging"),
    currentAuthorization: testCurrentAuthorization(),
    publicationFence: fence,
    skipMemory: true
  }, async () => [])
}

function testCurrentAuthorization() {
  return {
    authorizeExternalSideEffect: async () => undefined,
    authorizeDurableCommit: async () => undefined
  }
}

function baseScope(source: DocumentManifest, sourceVersion = "revision-1"): PublicationScope {
  return {
    tenantId: "tenant-publication",
    actorId: "owner-publication",
    sourceId: source.documentId,
    sourceVersion,
    purpose: "reindex"
  }
}

function admissionContext(lifecycleStatus: "active" | "staging"): AuthoritativeAdmissionContext {
  return {
    mode: "authoritative",
    tenantId: "tenant-publication",
    ownerUserId: "owner-publication",
    authorizationRef: reference("authorization"),
    classificationRef: reference("classification"),
    usagePolicyRef: reference("usage-policy"),
    qualityRef: reference("quality"),
    lifecycleRef: reference(`lifecycle-${lifecycleStatus}`),
    provenanceRef: reference("provenance"),
    inspectionStatus: "passed",
    malwareScan: { status: "clean", profileVersion: "malware-scan-test-v1" },
    qualityProfile: approvedQualityProfile(),
    lifecycleStatus,
    scope: { scopeType: "personal", allowedUsers: ["owner-publication"] }
  }
}

function approvedQualityProfile(): DocumentQualityProfile {
  return {
    knowledgeQualityStatus: "approved",
    verificationStatus: "verified",
    freshnessStatus: "current",
    supersessionStatus: "current",
    extractionQualityStatus: "high",
    ragEligibility: "eligible",
    flags: []
  }
}

function reference(kind: string) {
  return createVersionedReference(`test:${kind}`, "v1", `${kind}:approved`)
}

async function seedPublishedGovernance(
  harness: Harness,
  run: StagedPublicationRun,
  active: DocumentManifest
): Promise<{ key: string; record: SourceGovernanceRecord }> {
  const admission = active.admission
  if (
    !active.documentVersion
    || !admission?.tenantId
    || !admission.ownerUserId
    || !admission.classificationRef
    || !admission.usagePolicyRef
    || !admission.qualityRef
  ) throw new Error("governance fixture requires a complete active admission")
  const now = "2026-07-11T01:00:00.000Z"
  const record: SourceGovernanceRecord = {
    schemaVersion: 1,
    sourceId: run.scope.sourceId,
    sourceVersion: active.documentVersion,
    sourceManifestObjectKey: active.manifestObjectKey,
    tenantId: admission.tenantId,
    ownerUserId: admission.ownerUserId,
    status: "published",
    revision: 1,
    approval: {
      classification: { level: "internal", policyVersion: "classification-v1" },
      usagePolicy: {
        allowedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
        externalModelAllowed: true,
        loggingAllowed: true,
        evaluationAllowed: true,
        policyVersion: "usage-v1"
      },
      qualityProfile: {
        knowledgeQualityStatus: "approved",
        verificationStatus: "verified",
        freshnessStatus: "current",
        supersessionStatus: "current",
        extractionQualityStatus: "high",
        ragEligibility: "eligible",
        flags: []
      },
      inspection: {
        status: "passed",
        profileVersion: "inspection-v1",
        malwareStatus: "clean",
        malwareProfileVersion: "malware-scan-v1"
      },
      classificationRef: admission.classificationRef,
      usagePolicyRef: admission.usagePolicyRef,
      qualityRef: admission.qualityRef,
      approvedBy: "quality-owner",
      approvedAt: now,
      reason: "published rollback test governance"
    },
    activeDocumentId: active.documentId,
    publishedAt: now,
    createdAt: now,
    updatedAt: now
  }
  const key = `source-governance/${encodeURIComponent(record.tenantId)}/${encodeURIComponent(record.sourceId)}.json`
  await harness.deps.objectStore.putTextIfVersion(key, JSON.stringify(record, null, 2), undefined, "application/json")
  return { key, record }
}

async function readManifest(harness: Harness, key: string): Promise<DocumentManifest> {
  return JSON.parse(await harness.deps.objectStore.getText(key)) as DocumentManifest
}

class MemoryVectorStore {
  private readonly records = new Map<string, VectorRecord>()
  private failAfterWrites: number | undefined

  async put(records: VectorRecord[]): Promise<void> {
    let writes = 0
    for (const record of records) {
      this.records.set(record.key, structuredClone(record))
      writes += 1
      if (this.failAfterWrites !== undefined && writes >= this.failAfterWrites) {
        this.failAfterWrites = undefined
        throw new Error("simulated partial rollback vector write")
      }
    }
  }

  async getByKeys(keys: string[]): Promise<VectorRecord[]> {
    return keys.map((key) => this.records.get(key)).filter((record): record is VectorRecord => record !== undefined).map((record) => structuredClone(record))
  }

  async query(): Promise<RetrievedVector[]> {
    return []
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) this.records.delete(key)
  }

  failNextPutAfter(writes: number): void {
    this.failAfterWrites = writes
  }

  keys(): string[] {
    return [...this.records.keys()].sort()
  }
}
