import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { DocumentGroup, DocumentManifest } from "../types.js"
import { DocumentMoveAuditAuthoritativeResolver } from "./document-move-audit-reconciler.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditDraft,
  type SecurityMutationAuditIntent,
  type SecurityMutationResult
} from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 document move resolver supports only the exact target and operation", async () => {
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

test("FR-086 document move resolver converges duplicate workers on one completed lifecycle", async () => {
  const fixture = await createFixture({ status: "completed" })
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(fixture.objects)
  const prepared = await outbox.prepare(draft(fixture.lifecycle))
  fixture.lifecycle.auditIntentId = prepared.intentId
  await fixture.objects.putText(stateKey(), JSON.stringify(fixture.lifecycle), "application/json")
  const reconciler = new SecurityMutationAuditReconciler(outbox, [fixture.resolver])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant(tenantId)))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get(tenantId, prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, audit(fixture.lifecycle.targetManifest))
  assert.equal((await outbox.listAll(tenantId)).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 document move resolver preserves durable success after projection convergence", async () => {
  const fixture = await createFixture({ status: "manifest_committed" })
  const after = audit(fixture.lifecycle.targetManifest)
  const durable = intent(fixture.lifecycle, {
    status: "finalization_pending",
    requestedCompletion: { result: "success", after, requestedAt: later }
  })

  assert.deepEqual(await fixture.resolver.resolve(durable), { result: "success", after })
  await assert.rejects(
    () => fixture.resolver.resolve({
      ...durable,
      requestedCompletion: { ...durable.requestedCompletion!, after: { ...after, fileName: "third.txt" } }
    }),
    /does not confirm/
  )

  fixture.lifecycle.status = "projections_staged"
  await fixture.objects.putText(stateKey(), JSON.stringify(fixture.lifecycle), "application/json")
  await assert.rejects(() => fixture.resolver.resolve(durable), /not in a converged lifecycle state/)
})

test("FR-086 document move resolver preserves exact durable rollback and conflict states", async () => {
  const rolledBack = await createFixture({ status: "rollback_pending", current: "source", failureResult: "denied" })
  const sourceAfter = audit(rolledBack.lifecycle.sourceManifest)
  const denied = intent(rolledBack.lifecycle, {
    status: "finalization_pending",
    requestedCompletion: { result: "denied", after: sourceAfter, requestedAt: later }
  })
  assert.deepEqual(await rolledBack.resolver.resolve(denied), { result: "denied", after: sourceAfter })

  const conflict = await createFixture({ status: "projections_staged", current: "third", failureResult: "conflict" })
  const thirdAfter = audit(conflict.current)
  const conflicted = intent(conflict.lifecycle, {
    status: "finalization_pending",
    requestedCompletion: { result: "conflict", after: thirdAfter, requestedAt: later }
  })
  assert.deepEqual(await conflict.resolver.resolve(conflicted), { result: "conflict", after: thirdAfter })

  await assert.rejects(
    () => conflict.resolver.resolve({
      ...conflicted,
      requestedCompletion: { ...conflicted.requestedCompletion!, result: "failed" }
    }),
    /not authoritatively converged/
  )
})

test("FR-086 document move resolver accepts only exact marker-free preflight failures", async () => {
  const fixture = await createFixture({ marker: false, current: "source" })
  const before = audit(fixture.lifecycle.sourceManifest)
  const denied = intent(fixture.lifecycle, {
    status: "finalization_pending",
    draft: preflightDraft(fixture.lifecycle, before),
    requestedCompletion: { result: "denied", after: before, requestedAt: later }
  })
  assert.deepEqual(await fixture.resolver.resolve(denied), { result: "denied", after: before })

  const missing = await createFixture({ marker: false, current: "missing" })
  const missingDenied = intent(missing.lifecycle, {
    status: "finalization_pending",
    draft: preflightDraft(missing.lifecycle, null),
    requestedCompletion: { result: "denied", after: null, requestedAt: later }
  })
  assert.deepEqual(await missing.resolver.resolve(missingDenied), { result: "denied", after: null })

  await assert.rejects(
    () => fixture.resolver.resolve({
      ...denied,
      requestedCompletion: { ...denied.requestedCompletion!, after: audit(fixture.lifecycle.targetManifest) }
    }),
    /does not preserve/
  )
  await assert.rejects(
    () => fixture.resolver.resolve({
      ...denied,
      draft: { ...denied.draft, proposedAfter: { documentId, destinationFolderId, newTitle: null } }
    }),
    /early audit proposal is invalid/
  )
})

test("FR-086 document move resolver fails closed on partial, corrupt, crossed, and unavailable evidence", async () => {
  const partial = await createFixture({ status: "manifest_committed" })
  await assert.rejects(() => partial.resolver.resolve(intent(partial.lifecycle)), /no durable completion evidence/)

  partial.lifecycle.auditIntentId = "security_mutation_other"
  await partial.objects.putText(stateKey(), JSON.stringify(partial.lifecycle), "application/json")
  await assert.rejects(
    () => partial.resolver.resolve(intent({ ...partial.lifecycle, auditIntentId })),
    /crossed its audit or identity boundary/
  )

  const crossed = await createFixture({ mutateLifecycle: (lifecycle) => {
    lifecycle.tenantId = "tenant-2"
  } })
  await assert.rejects(() => crossed.resolver.resolve(intent({ ...crossed.lifecycle, tenantId })), /crossed its audit or identity boundary/)

  const corrupt = await createFixture({ mutateLifecycle: (lifecycle) => {
    lifecycle.targetManifest.metadata = { ...lifecycle.targetManifest.metadata, folderIds: [destinationFolderId, destinationFolderId] }
  } })
  await assert.rejects(() => corrupt.resolver.resolve(intent(corrupt.lifecycle)), /folder scope is invalid|target manifest is invalid/)

  const missing = await createFixture({ current: "missing", status: "completed" })
  await assert.rejects(() => missing.resolver.resolve(intent(missing.lifecycle)), /target is unavailable/)
})

test("FR-086 document move resolver revalidates current identity, role, source, and destination permission", async () => {
  const suspended = await createFixture({ identity: { accountStatus: "suspended" } })
  await assert.rejects(() => suspended.resolver.resolve(successIntent(suspended.lifecycle)), /identity or tenant boundary/)

  const roleLost = await createFixture({ identity: { cognitoGroups: ["CHAT_USER"] } })
  await assert.rejects(() => roleLost.resolver.resolve(successIntent(roleLost.lifecycle)), /not authorized/)

  const sourceLost = await createFixture({ sourceOwnerId: "other-owner" })
  await assert.rejects(() => sourceLost.resolver.resolve(successIntent(sourceLost.lifecycle)), /full source permission/)

  const destinationLost = await createFixture({ destinationOwnerId: "other-owner" })
  await assert.rejects(() => destinationLost.resolver.resolve(successIntent(destinationLost.lifecycle)), /full destination permission/)
})

type MoveStatus =
  | "initialized"
  | "prepared"
  | "projections_staging"
  | "projections_staged"
  | "manifest_committed"
  | "rollback_pending"
  | "rolled_back"
  | "completed"

type MoveLifecycle = {
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
  auditIntentId: string
  failureResult?: Exclude<SecurityMutationResult, "success">
  createdAt: string
  updatedAt: string
}

type FixtureOptions = Readonly<{
  marker?: boolean
  status?: MoveStatus
  current?: "source" | "target" | "third" | "missing"
  failureResult?: Exclude<SecurityMutationResult, "success">
  identity?: Partial<ServerManagedIdentity>
  sourceOwnerId?: string
  destinationOwnerId?: string
  mutateLifecycle?: (lifecycle: MoveLifecycle) => void
}>

async function createFixture(options: FixtureOptions = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "document-move-audit-"))
  const objects = new LocalObjectStore(dataDir)
  const groups = new LocalDocumentGroupStore(dataDir)
  const policies = new LocalFolderPolicyStore(dataDir)
  const userGroups = new LocalUserGroupStore(dataDir)
  const memberships = new LocalGroupMembershipStore(dataDir)
  await groups.create(group(sourceFolderId, options.sourceOwnerId ?? actorId))
  await groups.create(group(destinationFolderId, options.destinationOwnerId ?? actorId))

  const source = sourceManifest(options.sourceOwnerId ?? actorId)
  const target = targetManifest(source)
  const third = { ...target, fileName: "third.txt", updatedAt: "2026-07-17T00:03:00.000Z" }
  const lifecycle: MoveLifecycle = {
    schemaVersion: 1,
    operationId,
    fingerprint: "a".repeat(64),
    status: options.status ?? "completed",
    actorId,
    tenantId,
    documentId,
    reason,
    sourceManifestVersion: "source-version-1",
    sourceManifest: source,
    targetManifest: target,
    before: { folderIds: [sourceFolderId], fileName: source.fileName },
    after: { folderIds: [destinationFolderId], fileName: target.fileName },
    auditIntentId,
    ...(options.failureResult === undefined ? {} : { failureResult: options.failureResult }),
    createdAt: movedAt,
    updatedAt: "2026-07-17T00:02:00.000Z"
  }
  options.mutateLifecycle?.(lifecycle)
  if (options.marker !== false) await objects.putText(stateKey(), JSON.stringify(lifecycle), "application/json")
  const current = options.current ?? "target"
  const currentManifest = current === "source" ? source : current === "third" ? third : target
  if (current !== "missing") await objects.putText(manifestKey(), JSON.stringify(currentManifest), "application/json")

  const identity: ServerManagedIdentity = {
    username: "manager@example.com",
    userId: actorId,
    email: "manager@example.com",
    accountStatus: "active",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    tenantId,
    ...options.identity
  }
  const identities: Pick<VerifiedIdentityProvider, "getCurrentIdentityBySubject"> = {
    getCurrentIdentityBySubject: async (subject) => subject === identity.userId ? identity : undefined
  }
  const resolver = new DocumentMoveAuditAuthoritativeResolver({
    objects,
    groups,
    policies,
    userGroups,
    memberships,
    identities,
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "document-move-audit" },
    legacyGlobalDocumentArtifacts: true
  })
  return { objects, groups, lifecycle, resolver, current: currentManifest }
}

function intent(
  lifecycle: MoveLifecycle,
  overrides: Partial<SecurityMutationAuditIntent> = {}
): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: auditIntentId,
    status: "pending",
    draft: draft(lifecycle),
    createdAt: "2026-07-17T00:00:30.000Z",
    ...overrides
  }
}

function successIntent(lifecycle: MoveLifecycle): SecurityMutationAuditIntent {
  const after = audit(lifecycle.targetManifest)
  return intent(lifecycle, {
    status: "finalization_pending",
    requestedCompletion: { result: "success", after, requestedAt: later }
  })
}

function draft(lifecycle: MoveLifecycle): SecurityMutationAuditDraft {
  return {
    actorId,
    tenantId,
    targetType: "document",
    targetId: documentId,
    operation: "move",
    before: audit(lifecycle.sourceManifest),
    proposedAfter: audit(lifecycle.targetManifest),
    reason,
    policyVersion: "document-move-policy-v1"
  }
}

function preflightDraft(lifecycle: MoveLifecycle, before: ReturnType<typeof audit> | null): SecurityMutationAuditDraft {
  return {
    ...draft(lifecycle),
    before,
    proposedAfter: {
      documentId,
      destinationFolderId,
      newTitle: "moved.txt",
      expectedUpdatedAt: sourceAt
    }
  }
}

function audit(manifest: DocumentManifest) {
  return {
    documentId,
    tenantId,
    fileName: manifest.fileName,
    folderIds: [...(manifest.metadata?.folderIds as string[])],
    lifecycleStatus: "active" as const,
    updatedAt: manifest.updatedAt ?? manifest.createdAt
  }
}

function sourceManifest(ownerUserId: string): DocumentManifest {
  return {
    documentId,
    fileName: "source.txt",
    metadata: {
      tenantId,
      ownerUserId,
      scopeType: "group",
      groupId: sourceFolderId,
      folderId: sourceFolderId,
      groupIds: [sourceFolderId],
      folderIds: [sourceFolderId],
      lifecycleStatus: "active"
    },
    sourceObjectKey: `documents/${documentId}.txt`,
    manifestObjectKey: manifestKey(),
    vectorKeys: [`${documentId}-vector`],
    chunkCount: 1,
    memoryCardCount: 1,
    lifecycleStatus: "active",
    createdAt: sourceAt,
    updatedAt: sourceAt
  }
}

function targetManifest(source: DocumentManifest): DocumentManifest {
  return {
    ...source,
    fileName: "moved.txt",
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
    updatedAt: movedAt
  }
}

function group(groupId: string, ownerUserId: string): DocumentGroup {
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId,
    adminPrincipalType: "user",
    adminPrincipalId: ownerUserId,
    name: groupId,
    normalizedName: groupId,
    canonicalPath: `/${groupId}`,
    normalizedCanonicalPath: `/${groupId}`,
    adminPathPk: `${tenantId}#user#${ownerUserId}`,
    parentPathPk: `${tenantId}#user#${ownerUserId}#root`,
    ancestorGroupIds: [],
    ownerUserId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [],
    status: "active",
    createdBy: ownerUserId,
    createdAt: sourceAt,
    updatedAt: sourceAt
  }
}

function stateKey(): string {
  return `document-mutations/move/${tenantId}/${documentId}.json`
}

function manifestKey(): string {
  return `manifests/${documentId}.json`
}

const tenantId = "tenant-1"
const documentId = "doc-1"
const actorId = "manager-1"
const sourceFolderId = "source-folder"
const destinationFolderId = "destination-folder"
const reason = "move document"
const operationId = "document_move_12345678-1234-4234-8234-123456789abc"
const auditIntentId = "security_mutation_document_move_test"
const sourceAt = "2026-07-17T00:00:00.000Z"
const movedAt = "2026-07-17T00:01:00.000Z"
const later = "2026-07-17T00:02:00.000Z"
