import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  type RegisterRevocationCleanupInput
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type { DocumentManifest } from "../types.js"
import { DocumentDeleteAuditAuthoritativeResolver } from "./document-delete-audit-reconciler.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditDraft,
  type SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 document delete resolver supports only the exact target, operation, and policy", async () => {
  const fixture = await createFixture()
  assert.equal(fixture.resolver.supports(draft(fixture.lifecycle)), true)
  assert.equal(fixture.resolver.supports({ ...draft(fixture.lifecycle), targetType: "folder" }), false)
  assert.equal(fixture.resolver.supports({ ...draft(fixture.lifecycle), operation: "delete" }), false)
  await assert.rejects(
    () => fixture.resolver.resolve(intent(fixture.lifecycle, {
      draft: { ...draft(fixture.lifecycle), policyVersion: "wrong-policy" }
    })),
    /policy version is invalid/
  )
})

test("FR-086 document delete resolver converges duplicate workers on one completed cleanup", async () => {
  const fixture = await createFixture({ status: "completed" })
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(fixture.objects)
  const prepared = await outbox.prepare(draft(fixture.lifecycle))
  fixture.lifecycle.auditIntentId = prepared.intentId
  await fixture.objects.putText(stateKey(), JSON.stringify(fixture.lifecycle), "application/json")
  await registerSuccessEvidence(fixture.objects, fixture.lifecycle)
  const reconciler = new SecurityMutationAuditReconciler(outbox, [fixture.resolver])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant(tenantId)))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get(tenantId, prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, audit(fixture.lifecycle.tombstoneManifest))
  assert.equal((await outbox.listAll(tenantId)).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 document delete resolver preserves durable success only with exact cleanup evidence", async () => {
  const fixture = await createFixture({ status: "cleanup_pending" })
  await registerSuccessEvidence(fixture.objects, fixture.lifecycle)
  const after = audit(fixture.lifecycle.tombstoneManifest)
  const durable = intent(fixture.lifecycle, {
    status: "finalization_pending",
    requestedCompletion: { result: "success", after, requestedAt: later }
  })
  assert.deepEqual(await fixture.resolver.resolve(durable), { result: "success", after })

  const missingRepair = await createFixture({ status: "cleanup_pending" })
  await assert.rejects(
    () => missingRepair.resolver.resolve(intent(missingRepair.lifecycle, {
      status: "finalization_pending",
      requestedCompletion: { result: "success", after: audit(missingRepair.lifecycle.tombstoneManifest), requestedAt: later }
    })),
    /cleanup repair is not authoritatively registered/
  )

  const corrupt = await createFixture({ status: "completed" })
  await registerSuccessEvidence(corrupt.objects, corrupt.lifecycle)
  const cleanupKey = (await corrupt.objects.listKeys("security/revocation-cleanup/"))[0] as string
  const cleanup = JSON.parse(await corrupt.objects.getText(cleanupKey)) as { targets: unknown[] }
  await corrupt.objects.putText(cleanupKey, JSON.stringify({ ...cleanup, targets: cleanup.targets.slice(1) }))
  await assert.rejects(() => corrupt.resolver.resolve(intent(corrupt.lifecycle)), /missing a registered target/)
})

test("FR-086 document delete resolver accepts missing tombstone only after source cleanup checkpoint", async () => {
  const fixture = await createFixture({ status: "completed", current: "missing" })
  await registerSuccessEvidence(fixture.objects, fixture.lifecycle)
  await assert.rejects(() => fixture.resolver.resolve(intent(fixture.lifecycle)), /without a source cleanup checkpoint/)

  const cleanupKey = (await fixture.objects.listKeys("security/revocation-cleanup/"))[0] as string
  const cleanup = JSON.parse(await fixture.objects.getText(cleanupKey)) as {
    scopes: Array<{ scope: string; status: string; discoveredAt?: string }>
  }
  await fixture.objects.putText(cleanupKey, JSON.stringify({
    ...cleanup,
    scopes: cleanup.scopes.map((scope) => scope.scope === "source" ? { ...scope, discoveredAt: later } : scope)
  }))

  assert.deepEqual(await fixture.resolver.resolve(intent(fixture.lifecycle)), {
    result: "success",
    after: audit(fixture.lifecycle.tombstoneManifest)
  })
})

test("FR-086 document delete resolver accepts only exact marker-free preflight failures", async () => {
  const fixture = await createFixture({ marker: false, current: "source" })
  const before = audit(fixture.lifecycle.sourceManifest)
  const denied = intent(fixture.lifecycle, {
    status: "finalization_pending",
    draft: { ...draft(fixture.lifecycle), before, proposedAfter: before },
    requestedCompletion: { result: "denied", after: before, requestedAt: later }
  })
  assert.deepEqual(await fixture.resolver.resolve(denied), { result: "denied", after: before })

  await assert.rejects(
    () => fixture.resolver.resolve({
      ...denied,
      requestedCompletion: { ...denied.requestedCompletion!, after: audit(fixture.lifecycle.tombstoneManifest) }
    }),
    /does not preserve/
  )
  const missing = await createFixture({ marker: false, current: "missing" })
  await assert.rejects(
    () => missing.resolver.resolve(intent(missing.lifecycle, {
      status: "finalization_pending",
      draft: { ...draft(missing.lifecycle), before, proposedAfter: before },
      requestedCompletion: { result: "denied", after: before, requestedAt: later }
    })),
    /does not confirm/
  )
})

test("FR-086 document delete resolver preserves only an abandoned prepared CAS conflict", async () => {
  const fixture = await createFixture({ status: "prepared", current: "third" })
  await registerAbandonedRepair(fixture.objects, fixture.lifecycle)
  const after = audit(fixture.current)
  const conflict = intent(fixture.lifecycle, {
    status: "finalization_pending",
    requestedCompletion: { result: "conflict", after, requestedAt: later }
  })
  assert.deepEqual(await fixture.resolver.resolve(conflict), { result: "conflict", after })

  const notAbandoned = await createFixture({ status: "prepared", current: "third" })
  await prepareRepair(notAbandoned.objects, notAbandoned.lifecycle)
  await assert.rejects(
    () => notAbandoned.resolver.resolve(intent(notAbandoned.lifecycle, {
      status: "finalization_pending",
      requestedCompletion: { result: "conflict", after: audit(notAbandoned.current), requestedAt: later }
    })),
    /not authoritatively abandoned/
  )
})

test("FR-086 document delete resolver fails closed on partial, corrupt, crossed, and third state", async () => {
  const partial = await createFixture({ status: "tombstoned" })
  await assert.rejects(() => partial.resolver.resolve(intent(partial.lifecycle)), /no durable completion evidence/)

  const crossed = await createFixture({ mutateLifecycle: (lifecycle) => { lifecycle.tenantId = "tenant-2" } })
  await assert.rejects(() => crossed.resolver.resolve(intent({ ...crossed.lifecycle, tenantId })), /audit or identity boundary/)

  const corrupt = await createFixture({ mutateLifecycle: (lifecycle) => {
    lifecycle.tombstoneManifest.metadata = { ...lifecycle.tombstoneManifest.metadata, folderIds: [folderId, folderId] }
  } })
  await assert.rejects(() => corrupt.resolver.resolve(intent(corrupt.lifecycle)), /folder scope is invalid|tombstone manifest is invalid/)

  const third = await createFixture({ status: "completed", current: "third" })
  await registerSuccessEvidence(third.objects, third.lifecycle)
  await assert.rejects(() => third.resolver.resolve(intent(third.lifecycle)), /does not match the delete tombstone/)
})

type DeleteStatus = "initialized" | "prepared" | "tombstoned" | "cleanup_pending" | "completed"

type DeleteLifecycle = {
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
  auditIntentId: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

type FixtureOptions = Readonly<{
  marker?: boolean
  status?: DeleteStatus
  current?: "source" | "tombstone" | "third" | "missing"
  mutateLifecycle?: (lifecycle: DeleteLifecycle) => void
}>

async function createFixture(options: FixtureOptions = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "document-delete-audit-"))
  const objects = new LocalObjectStore(dataDir)
  const source = sourceManifest()
  const tombstone = tombstoneManifest(source)
  const lifecycle: DeleteLifecycle = {
    schemaVersion: 1,
    operationId,
    fingerprint: createHash("sha256").update(JSON.stringify({
      documentId,
      sourceVersion,
      reason
    })).digest("hex"),
    status: options.status ?? "completed",
    actorId,
    tenantId,
    documentId,
    reason,
    sourceManifestVersion: sourceVersion,
    sourceManifest: source,
    tombstoneManifest: tombstone,
    auditIntentId,
    createdAt: deletedAt,
    updatedAt: later
  }
  options.mutateLifecycle?.(lifecycle)
  if (options.marker !== false) await objects.putText(stateKey(), JSON.stringify(lifecycle), "application/json")
  const currentKind = options.current ?? "tombstone"
  const current = currentKind === "source"
    ? source
    : currentKind === "third"
      ? { ...source, fileName: "replacement.txt", updatedAt: later }
      : tombstone
  if (currentKind !== "missing") await objects.putText(manifestKey(), JSON.stringify(current), "application/json")
  const resolver = new DocumentDeleteAuditAuthoritativeResolver({
    objects,
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "document-delete-audit" },
    legacyGlobalDocumentArtifacts: true
  })
  return { objects, lifecycle, resolver, current }
}

function intent(lifecycle: DeleteLifecycle, overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: auditIntentId,
    status: "pending",
    draft: draft(lifecycle),
    createdAt: "2026-07-17T00:00:30.000Z",
    ...overrides
  }
}

function draft(lifecycle: DeleteLifecycle): SecurityMutationAuditDraft {
  return {
    actorId,
    tenantId,
    targetType: "document",
    targetId: documentId,
    operation: "revoke.delete",
    before: audit(lifecycle.sourceManifest),
    proposedAfter: audit(lifecycle.tombstoneManifest),
    reason,
    policyVersion: "document-revocation-policy-v1"
  }
}

function audit(manifest: DocumentManifest) {
  return {
    documentId,
    tenantId,
    lifecycleStatus: (manifest.lifecycleStatus ?? "active") as "active" | "superseded",
    folderIds: [...(manifest.metadata?.folderIds as string[])],
    updatedAt: manifest.updatedAt ?? manifest.createdAt
  }
}

function sourceManifest(): DocumentManifest {
  return {
    documentId,
    fileName: "source.txt",
    metadata: {
      tenantId,
      ownerUserId: "owner-1",
      scopeType: "group",
      groupId: folderId,
      folderId,
      groupIds: [folderId],
      folderIds: [folderId],
      lifecycleStatus: "active"
    },
    sourceObjectKey: `documents/${documentId}.txt`,
    manifestObjectKey: manifestKey(),
    vectorKeys: [`${documentId}-vector`],
    evidenceVectorKeys: [`${documentId}-evidence`],
    memoryVectorKeys: [`${documentId}-memory`],
    structuredBlocksObjectKey: `documents/${documentId}-blocks.json`,
    memoryCardsObjectKey: `documents/${documentId}-memory.json`,
    chunkCount: 1,
    memoryCardCount: 1,
    lifecycleStatus: "active",
    createdAt: sourceAt,
    updatedAt: sourceAt
  }
}

function tombstoneManifest(source: DocumentManifest): DocumentManifest {
  return {
    ...source,
    lifecycleStatus: "superseded",
    metadata: {
      ...(source.metadata ?? {}),
      lifecycleStatus: "superseded",
      documentRevocation: { schemaVersion: 1, operationId, actorId, reason, tombstonedAt: deletedAt }
    },
    updatedAt: deletedAt
  }
}

async function prepareRepair(objects: ObjectStore, lifecycle: DeleteLifecycle) {
  return new ObjectStoreRevocationCleanupRepairOutbox(objects).prepare({
    expectedBeforeDenyVersion: lifecycle.sourceManifestVersion,
    cleanupRegistration: registration(lifecycle),
    preparedAt: lifecycle.createdAt
  })
}

async function registerSuccessEvidence(objects: ObjectStore, lifecycle: DeleteLifecycle): Promise<void> {
  const repairs = new ObjectStoreRevocationCleanupRepairOutbox(objects)
  let repair = await prepareRepair(objects, lifecycle)
  repair = await repairs.markDenyCommitted(repair, "2026-07-17T00:01:10.000Z")
  await new ObjectStoreRevocationCleanupCoordinator(objects, () => new Date("2026-07-17T00:01:20.000Z"))
    .register(registration(lifecycle))
  await repairs.markCleanupRegistered(repair, "2026-07-17T00:01:30.000Z")
}

async function registerAbandonedRepair(objects: ObjectStore, lifecycle: DeleteLifecycle): Promise<void> {
  const repairs = new ObjectStoreRevocationCleanupRepairOutbox(objects)
  const repair = await prepareRepair(objects, lifecycle)
  await repairs.markAbandoned(repair, "2026-07-17T00:01:10.000Z")
}

function registration(lifecycle: DeleteLifecycle): RegisterRevocationCleanupInput & { operationId: string } {
  const manifest = lifecycle.sourceManifest
  const tombstonedAt = lifecycle.tombstoneManifest.updatedAt ?? lifecycle.tombstoneManifest.createdAt
  return {
    operationId,
    tenantId,
    resourceType: "document",
    resourceId: documentId,
    trigger: "deleted",
    deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
    authoritativeDenyVersion: `document-revocation:${operationId}:${tombstonedAt}`,
    authoritativeDenyConfirmedAt: tombstonedAt,
    knownTargets: [
      { scope: "source", reference: manifest.sourceObjectKey },
      { scope: "source", reference: manifest.manifestObjectKey },
      { scope: "chunk", reference: manifest.structuredBlocksObjectKey as string },
      { scope: "memory", reference: manifest.memoryCardsObjectKey as string },
      { scope: "memory", reference: (manifest.memoryVectorKeys as string[])[0] as string },
      { scope: "active_index", reference: (manifest.evidenceVectorKeys as string[])[0] as string },
      { scope: "old_index", reference: `document-${createHash("sha256").update(documentId).digest("hex")}` },
      { scope: "cache", reference: `document:${documentId}` },
      { scope: "grant", reference: `document:${documentId}` },
      { scope: "session", reference: `document:${documentId}/session` },
      { scope: "queued_run", reference: `document:${documentId}` },
      { scope: "evaluation_artifact", reference: `document:${documentId}` }
    ]
  }
}

function stateKey(): string {
  return `document-mutations/delete/${tenantId}/${documentId}.json`
}

function manifestKey(): string {
  return `manifests/${documentId}.json`
}

const tenantId = "tenant-1"
const documentId = "doc-1"
const actorId = "audit-runner-1"
const folderId = "folder-1"
const reason = "delete document"
const operationId = "document_delete_12345678-1234-4234-8234-123456789abc"
const auditIntentId = "security_mutation_document_delete_test"
const sourceVersion = "source-version-1"
const sourceAt = "2026-07-17T00:00:00.000Z"
const deletedAt = "2026-07-17T00:01:00.000Z"
const later = "2026-07-17T00:02:00.000Z"
