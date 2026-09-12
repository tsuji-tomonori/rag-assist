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
import { tenantArtifactRoot, tenantDocumentArtifactKey } from "../rag/_shared/storage/tenant-artifacts.js"
import type { DocumentGroup } from "../types.js"
import { FolderMoveAuditAuthoritativeResolver } from "./folder-move-audit-reconciler.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditDraft,
  type SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 folder move resolver supports only the exact target and operation", async () => {
  const fixture = await createFixture()
  assert.equal(fixture.resolver.supports(draft(fixture.marker)), true)
  assert.equal(fixture.resolver.supports({ ...draft(fixture.marker), targetType: "document" }), false)
  assert.equal(fixture.resolver.supports({ ...draft(fixture.marker), operation: "delete" }), false)
})

test("FR-086 folder move resolver converges duplicate workers on one authoritative success", async () => {
  const fixture = await createFixture()
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(fixture.objects)
  const prepared = await outbox.prepare(draft(fixture.marker))
  fixture.marker.auditIntentId = prepared.intentId
  await fixture.objects.putText(markerKey(), JSON.stringify(fixture.marker), "application/json")
  const reconciler = new SecurityMutationAuditReconciler(outbox, [fixture.resolver])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant(tenantId)))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get(tenantId, prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, auditValue(fixture.marker, "after"))
  assert.equal((await outbox.listAll(tenantId)).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 folder move resolver preserves an exact durable success", async () => {
  const fixture = await createFixture()
  const after = auditValue(fixture.marker, "after")
  const durable = intent(fixture.marker, {
    status: "finalization_pending",
    requestedCompletion: { result: "success", after, requestedAt: later }
  })

  assert.deepEqual(await fixture.resolver.resolve(durable), { result: "success", after })
  await assert.rejects(() => fixture.resolver.resolve({
    ...durable,
    requestedCompletion: { ...durable.requestedCompletion!, after: { ...after, destinationParentId: null } }
  }), /does not confirm/)
})

test("FR-086 folder move resolver accepts a complete immutable document projection snapshot", async () => {
  const fixture = await createFixture({
    mutateMarker: (marker) => { marker.documentSnapshots = [documentSnapshot(marker)] }
  })

  assert.deepEqual(await fixture.resolver.resolve(intent(fixture.marker)), {
    result: "success",
    after: auditValue(fixture.marker, "after")
  })
})

test("FR-086 folder move resolver preserves marker-free preflight non-success only at the current before state", async () => {
  const fixture = await createFixture({ marker: false, currentState: "before" })
  const before = preflightValue(fixture.beforeSource)
  const denied = intent(fixture.marker, {
    status: "finalization_pending",
    draft: {
      ...draft(fixture.marker),
      before,
      proposedAfter: {
        folderId,
        destinationParentId,
        requestedName: "Source",
        expectedVersion: before.updatedAt
      }
    },
    requestedCompletion: { result: "denied", after: before, requestedAt: later }
  })

  assert.deepEqual(await fixture.resolver.resolve(denied), { result: "denied", after: before })
  await fixture.groups.update(tenantId, folderId, { name: "Changed" })
  await assert.rejects(() => fixture.resolver.resolve(denied), /does not confirm/)
})

test("FR-086 folder move resolver preserves rolled-back non-success only with exact before evidence", async () => {
  const fixture = await createFixture({ markerStatus: "rolled_back", currentState: "before", failureResult: "conflict" })
  const before = auditValue(fixture.marker, "before")
  const durable = intent(fixture.marker, {
    status: "finalization_pending",
    requestedCompletion: { result: "conflict", after: before, requestedAt: later }
  })

  assert.deepEqual(await fixture.resolver.resolve(durable), { result: "conflict", after: before })
  await assert.rejects(() => fixture.resolver.resolve({
    ...durable,
    requestedCompletion: { ...durable.requestedCompletion!, result: "failed" }
  }), /not authoritatively rolled back/)
})

test("FR-086 folder move resolver rejects every partial lifecycle status", async () => {
  for (const status of [
    "initialized",
    "prepared",
    "documents_staging",
    "documents_staged",
    "subtree_committed",
    "reconciliation_pending",
    "rollback_pending"
  ]) {
    const fixture = await createFixture({ markerStatus: status })
    await assert.rejects(() => fixture.resolver.resolve(intent(fixture.marker)), /not authoritatively converged/, status)
  }
})

test("FR-086 folder move resolver fails closed for missing, before, mixed, and third current states", async () => {
  const missing = await createFixture({ marker: false })
  await assert.rejects(() => missing.resolver.resolve(intent(missing.marker)), /marker is unavailable/)

  for (const state of ["before", "mixed", "third"] as const) {
    const fixture = await createFixture({ currentState: state })
    await assert.rejects(
      () => fixture.resolver.resolve(intent(fixture.marker)),
      /not in the after state|partially applied or mixed/,
      state
    )
  }
})

test("FR-086 folder move resolver rejects corrupt lifecycle identity, owner transfer, and document evidence", async () => {
  const cases: Array<[string, (marker: Marker) => void, RegExp]> = [
    ["tenant", (marker) => { marker.tenantId = "tenant-b" }, /identity boundary/],
    ["actor", (marker) => { marker.actorId = "other" }, /identity boundary/],
    ["audit", (marker) => { marker.auditIntentId = "other-audit" }, /identity boundary/],
    ["timestamp", (marker) => { marker.updatedAt = "invalid" }, /identity boundary/],
    ["duplicate", (marker) => { marker.folderSnapshots.push(marker.folderSnapshots[1]!) }, /subtree identity/],
    ["owner transfer", (marker) => { marker.folderSnapshots[0]!.next.ownerUserId = "other" }, /ownership or local identity/],
    ["document", (marker) => { marker.documentSnapshots = [{ sourceManifest: { documentId: "doc-1" } }] }, /document snapshot/],
    ["document projection", (marker) => {
      const snapshot = documentSnapshot(marker)
      ;(snapshot.targetManifest.metadata as Record<string, unknown>).folderPolicyRefs = ["corrupt"]
      marker.documentSnapshots = [snapshot]
    }, /document snapshot crossed/]
  ]
  for (const [label, mutate, expected] of cases) {
    const fixture = await createFixture({ mutateMarker: mutate })
    await assert.rejects(() => fixture.resolver.resolve(intent(fixture.marker)), expected, label)
  }
})

test("FR-086 folder move resolver rechecks current actor and source/destination authorization", async () => {
  const cases: Array<[string, FixtureOptions, RegExp]> = [
    ["suspended", { identity: { accountStatus: "suspended" } }, /identity or tenant boundary/],
    ["cross tenant", { identity: { tenantId: "tenant-b" } }, /identity or tenant boundary/],
    ["missing role", { identity: { cognitoGroups: ["CHAT_USER"] } }, /not authorized/],
    ["source permission", { sourceAdminId: "other-owner" }, /full source permission/],
    ["destination permission", { destinationAdminId: "other-owner" }, /full destination permission/]
  ]
  for (const [label, options, expected] of cases) {
    const fixture = await createFixture(options)
    await assert.rejects(() => fixture.resolver.resolve(intent(fixture.marker)), expected, label)
  }
})

test("FR-086 folder move resolver rejects unsupported intents without reading or mutating state", async () => {
  const fixture = await createFixture()
  await assert.rejects(() => fixture.resolver.resolve(intent(fixture.marker, {
    draft: { ...draft(fixture.marker), operation: "delete" }
  })), /does not support/)
})

type Marker = {
  schemaVersion: number
  operationId: string
  fingerprint: string
  status: string
  actorId: string
  tenantId: string
  folderId: string
  destinationParentId: string | null
  requestedName: string
  reason: string
  expectedVersion: string
  folderSnapshots: Array<{
    current: DocumentGroup
    next: DocumentGroup
    beforeProjection: Projection
    afterProjection: Projection
  }>
  localPolicySnapshots: unknown[]
  documentSnapshots: unknown[]
  auditIntentId: string
  failureResult?: "denied" | "failed" | "conflict"
  createdAt: string
  updatedAt: string
}

type Projection = {
  folderId: string
  canonicalPath: string
  policySource: "ownerDefault"
  policyId: string
  policyVersion: string
}

type FixtureOptions = Readonly<{
  marker?: boolean
  markerStatus?: string
  currentState?: "before" | "after" | "mixed" | "third"
  failureResult?: "denied" | "failed" | "conflict"
  mutateMarker?: (marker: Marker) => void
  identity?: Partial<ServerManagedIdentity>
  sourceAdminId?: string
  destinationAdminId?: string
}>

async function createFixture(options: FixtureOptions = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "folder-move-audit-resolver-"))
  const objects = new LocalObjectStore(dir)
  const groups = new LocalDocumentGroupStore(dir)
  const policies = new LocalFolderPolicyStore(dir)
  const userGroups = new LocalUserGroupStore(dir)
  const memberships = new LocalGroupMembershipStore(dir)
  const identity = { ...currentIdentity(), ...options.identity }
  const identities = new MutableIdentityProvider(identity)

  const oldParent = folder(oldParentId, "Old")
  const destination = folder(destinationParentId, "Destination", undefined, options.destinationAdminId)
  const beforeSource = folder(folderId, "Source", oldParent, options.sourceAdminId)
  const beforeChild = folder(childId, "Child", beforeSource, options.sourceAdminId)
  const afterSource = movedFolder(beforeSource, destination)
  const afterChild = movedFolder(beforeChild, afterSource)
  const marker = moveMarker(beforeSource, beforeChild, afterSource, afterChild, {
    status: options.markerStatus,
    failureResult: options.failureResult
  })
  options.mutateMarker?.(marker)

  const currentState = options.currentState ?? "after"
  const currentSource = currentState === "before" ? beforeSource : currentState === "third"
    ? { ...afterSource, updatedAt: "2026-07-17T00:02:00.000Z" }
    : afterSource
  const currentChild = currentState === "before" || currentState === "mixed" ? beforeChild : afterChild
  for (const group of [oldParent, destination, currentSource, currentChild]) await groups.createWithPathLock(group)

  if (options.marker !== false) {
    await objects.putText(markerKey(), JSON.stringify(marker, null, 2), "application/json")
  }
  const resolver = new FolderMoveAuditAuthoritativeResolver({
    objects,
    groups,
    policies,
    userGroups,
    memberships,
    identities
  })
  return { objects, groups, marker, resolver, beforeSource }
}

function moveMarker(
  beforeSource: DocumentGroup,
  beforeChild: DocumentGroup,
  afterSource: DocumentGroup,
  afterChild: DocumentGroup,
  options: { status?: string; failureResult?: "denied" | "failed" | "conflict" } = {}
): Marker {
  return {
    schemaVersion: 1,
    operationId,
    fingerprint: "folder-move-fingerprint",
    status: options.status ?? "projections_converged",
    actorId,
    tenantId,
    folderId,
    destinationParentId,
    requestedName: "Source",
    reason,
    expectedVersion: beforeSource.updatedAt,
    folderSnapshots: [
      snapshot(beforeSource, afterSource),
      snapshot(beforeChild, afterChild)
    ],
    localPolicySnapshots: [],
    documentSnapshots: [],
    auditIntentId,
    ...(options.failureResult ? { failureResult: options.failureResult } : {}),
    createdAt: movedAt,
    updatedAt: movedAt
  }
}

function snapshot(current: DocumentGroup, next: DocumentGroup) {
  return {
    current,
    next,
    beforeProjection: projection(current),
    afterProjection: projection(next)
  }
}

function projection(group: DocumentGroup): Projection {
  return {
    folderId: group.groupId,
    canonicalPath: group.canonicalPath!,
    policySource: "ownerDefault",
    policyId: `owner-default:${group.adminPrincipalType}:${group.adminPrincipalId}`,
    policyVersion: `owner-default-version:${group.groupId}`
  }
}

function folder(groupId: string, name: string, parent?: DocumentGroup, adminId = actorId): DocumentGroup {
  const canonicalPath = parent ? `${parent.canonicalPath}/${name}` : `/${name}`
  const normalizedName = name.toLocaleLowerCase("ja-JP")
  const normalizedCanonicalPath = parent ? `${parent.normalizedCanonicalPath}/${normalizedName}` : `/${normalizedName}`
  const adminPathPk = `${tenantId}#user#${adminId}`
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId,
    adminPrincipalType: "user",
    adminPrincipalId: adminId,
    name,
    normalizedName,
    canonicalPath,
    normalizedCanonicalPath,
    adminPathPk,
    parentPathPk: `${adminPathPk}#${parent?.groupId ?? "ROOT"}`,
    parentGroupId: parent?.groupId,
    ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : [],
    ownerUserId: adminId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [adminId],
    status: "active",
    createdBy: adminId,
    createdAt: initialAt,
    updatedAt: initialAt
  }
}

function movedFolder(current: DocumentGroup, parent: DocumentGroup): DocumentGroup {
  const canonicalPath = `${parent.canonicalPath}/${current.name}`
  const normalizedCanonicalPath = `${parent.normalizedCanonicalPath}/${current.normalizedName}`
  return {
    ...current,
    canonicalPath,
    normalizedCanonicalPath,
    parentPathPk: `${current.adminPathPk}#${parent.groupId}`,
    parentGroupId: parent.groupId,
    ancestorGroupIds: [...(parent.ancestorGroupIds ?? []), parent.groupId],
    policySource: "ownerDefault",
    folderProjectionVersion: operationId,
    folderMoveOperationId: operationId,
    updatedAt: movedAt
  }
}

function draft(marker: Marker): SecurityMutationAuditDraft {
  return {
    actorId,
    tenantId,
    targetType: "folder",
    targetId: folderId,
    operation: "move",
    before: auditValue(marker, "before"),
    proposedAfter: auditValue(marker, "after"),
    reason,
    policyVersion: "folder-move-policy-v1"
  }
}

function intent(marker: Marker, overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: auditIntentId,
    status: "pending",
    draft: draft(marker),
    createdAt: initialAt,
    ...overrides
  }
}

function auditValue(marker: Marker, state: "before" | "after") {
  return {
    operationId: marker.operationId,
    folderId: marker.folderId,
    destinationParentId: state === "before"
      ? marker.folderSnapshots[0]?.current.parentGroupId ?? null
      : marker.destinationParentId,
    subtree: marker.folderSnapshots.map((entry) => ({
      folderId: entry.current.groupId,
      canonicalPath: state === "before" ? entry.current.canonicalPath ?? null : entry.next.canonicalPath ?? null,
      policyRef: projectionToken(state === "before" ? entry.beforeProjection : entry.afterProjection)
    })),
    affectedDocumentIds: marker.documentSnapshots.flatMap((snapshot) => {
      const source = (snapshot as { sourceManifest?: { documentId?: unknown } }).sourceManifest
      return typeof source?.documentId === "string" ? [source.documentId] : []
    }),
    directDocumentGrantsPreserved: true,
    folderLocalPoliciesPreserved: true,
    documentVersionsPreserved: true
  }
}

function projectionToken(value: Projection): string {
  return JSON.stringify({
    folderId: value.folderId,
    policySource: value.policySource,
    policyId: value.policyId,
    policyVersion: value.policyVersion,
    inheritedFromFolderId: null
  })
}

function documentSnapshot(marker: Marker) {
  const documentId = "document-1"
  const manifestKey = `${tenantArtifactRoot(tenantId)}/manifests/${documentId}.json`
  const beforeProjection = [marker.folderSnapshots[0]!.beforeProjection]
  const afterProjection = [marker.folderSnapshots[0]!.afterProjection]
  const sourceManifest = {
    documentId,
    fileName: "document.txt",
    metadata: {
      tenantId,
      folderGroupIds: [folderId],
      lifecycleStatus: "active"
    },
    sourceObjectKey: `${tenantArtifactRoot(tenantId)}/sources/${documentId}.txt`,
    manifestObjectKey: manifestKey,
    vectorKeys: [],
    chunkCount: 0,
    memoryCardCount: 0,
    lifecycleStatus: "active",
    createdAt: initialAt,
    updatedAt: initialAt
  }
  const projectedMetadata = {
    ...sourceManifest.metadata,
    folderCanonicalPaths: afterProjection.map((projection) => projection.canonicalPath),
    folderPolicyRefs: afterProjection.map(projectionToken),
    folderProjectionVersion: operationId,
    folderMoveOperationId: operationId
  }
  return {
    manifestKey,
    sourceVersion: "source-version-1",
    sourceManifest,
    stagedManifest: {
      ...sourceManifest,
      lifecycleStatus: "staging",
      metadata: { ...projectedMetadata, lifecycleStatus: "staging" },
      updatedAt: movedAt
    },
    targetManifest: {
      ...sourceManifest,
      lifecycleStatus: "active",
      metadata: { ...projectedMetadata, lifecycleStatus: "active" },
      updatedAt: movedAt
    },
    beforeProjection,
    afterProjection
  }
}

function preflightValue(group: DocumentGroup) {
  return {
    folderId: group.groupId,
    tenantId: group.tenantId,
    parentGroupId: group.parentGroupId ?? null,
    canonicalPath: group.canonicalPath ?? null,
    updatedAt: group.updatedAt,
    status: group.status ?? null
  }
}

function markerKey(): string {
  return tenantDocumentArtifactKey({}, tenantId, `folder-mutations/move/${encodeURIComponent(folderId)}.json`)
}

class MutableIdentityProvider implements Pick<VerifiedIdentityProvider, "getCurrentIdentityBySubject"> {
  constructor(private readonly identity: ServerManagedIdentity) {}

  async getCurrentIdentityBySubject(subject: string): Promise<ServerManagedIdentity | undefined> {
    return subject === actorId ? { ...this.identity, cognitoGroups: [...this.identity.cognitoGroups] } : undefined
  }
}

function currentIdentity(): ServerManagedIdentity {
  return {
    username: actorId,
    userId: actorId,
    email: "mover@example.com",
    accountStatus: "active",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    tenantId
  }
}

const tenantId = "tenant-a"
const actorId = "mover-1"
const folderId = "source"
const childId = "child"
const oldParentId = "old-parent"
const destinationParentId = "destination"
const operationId = "folder_move_test"
const auditIntentId = "security_mutation_folder_move_test"
const reason = "approved folder move"
const initialAt = "2026-07-17T00:00:00.000Z"
const movedAt = "2026-07-17T00:01:00.000Z"
const later = "2026-07-17T00:02:00.000Z"
