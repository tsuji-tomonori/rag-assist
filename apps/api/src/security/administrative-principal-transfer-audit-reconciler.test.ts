import assert from "node:assert/strict"
import test from "node:test"
import { tenantManifestKey } from "../rag/_shared/storage/tenant-artifacts.js"
import { AdministrativePrincipalTransferAuditAuthoritativeResolver } from "./administrative-principal-transfer-audit-reconciler.js"
import type { SecurityMutationAuditDraft, SecurityMutationAuditIntent } from "./security-mutation-audit-outbox.js"

const tenantId = "tenant-1"
const sourceUserId = "source-1"
const successorUserId = "successor-1"
const auditIntentId = "security_mutation_transfer_test"
const earlier = "2026-07-17T00:00:00.000Z"
const later = "2026-07-17T00:00:01.000Z"
const policy = {
  localTestIngestAdmissionContext: {
    mode: "local_test_fixture" as const,
    fixtureId: "administrative-transfer-audit",
    tenantId,
    ownerUserId: "local-dev"
  }
}

test("FR-086 administrative-principal transfer resolver supports only the exact operation", async () => {
  const fixture = createFixture()
  assert.equal(fixture.resolver.supports(draft()), true)
  assert.equal(fixture.resolver.supports({ ...draft(), targetType: "document" }), false)
  assert.equal(fixture.resolver.supports({ ...draft(), operation: "delete" }), false)
  await assert.rejects(
    () => fixture.resolver.resolve(intent({ draft: { ...draft(), policyVersion: "wrong" } })),
    /policy version is invalid/
  )
})

test("FR-086 administrative-principal transfer resolver confirms exact current targets", async () => {
  const fixture = createFixture({ status: "committed" })
  const expected = successAfter(fixture.state)

  assert.deepEqual(await fixture.resolver.resolve(intent()), { result: "success", after: expected })
  fixture.currentFolders.set("folder-1", reverseObject(fixture.state.folders[0]!.target))
  assert.deepEqual(await fixture.resolver.resolve(intent()), { result: "success", after: expected })
  assert.deepEqual(await fixture.resolver.resolve(intent({
    status: "finalization_pending",
    requestedCompletion: { result: "success", after: expected, requestedAt: later }
  })), { result: "success", after: expected })

  const transferring = createFixture({ status: "transferring" })
  await assert.rejects(() => transferring.resolver.resolve(intent()), /not in a converged state/)
  assert.deepEqual(await transferring.resolver.resolve(intent({
    status: "finalization_pending",
    requestedCompletion: { result: "success", after: expected, requestedAt: later }
  })), { result: "success", after: expected })

  fixture.currentFolders.set("folder-1", { ...fixture.state.folders[0]!.target, updatedAt: "2026-07-17T00:00:02.000Z" })
  await assert.rejects(() => fixture.resolver.resolve(intent()), /folder does not match target state/)
})

test("FR-086 administrative-principal transfer resolver confirms only a fully restored rollback", async () => {
  const fixture = createFixture({ status: "rollback_pending", current: "source" })
  const after = inventoryAfter(fixture.state)
  const failed = intent({
    status: "finalization_pending",
    requestedCompletion: { result: "failed", after, requestedAt: later }
  })
  assert.deepEqual(await fixture.resolver.resolve(intent()), { result: "failed", after })
  assert.deepEqual(await fixture.resolver.resolve(failed), { result: "failed", after })

  fixture.currentResourceGroups.set("resource-1", fixture.state.resourceGroups[0]!.target)
  await assert.rejects(() => fixture.resolver.resolve(failed), /resource group does not match source state/)
  await assert.rejects(() => fixture.resolver.resolve({
    ...failed,
    requestedCompletion: { result: "conflict", after, requestedAt: later }
  }), /non-success is not authoritatively converged/)
})

test("FR-086 administrative-principal transfer resolver accepts only marker-free preserved failures", async () => {
  const fixture = createFixture({ marker: false })
  const before = inventoryBefore()
  const denied = intent({
    status: "finalization_pending",
    requestedCompletion: { result: "denied", after: before, requestedAt: later }
  })
  assert.deepEqual(await fixture.resolver.resolve(denied), { result: "denied", after: before })

  await assert.rejects(
    () => fixture.resolver.resolve(intent({
      status: "finalization_pending",
      requestedCompletion: { result: "success", after: before, requestedAt: later }
    })),
    /authoritative state is unavailable/
  )
  await assert.rejects(
    () => fixture.resolver.resolve({
      ...denied,
      requestedCompletion: { result: "denied", after: { ...before, total: 2 }, requestedAt: later }
    }),
    /authoritative state is unavailable/
  )

  const zero = { sourceUserId, folders: 0, resourceGroups: 0, documents: 0, total: 0 }
  const zeroDraft = {
    ...draft(),
    before: zero,
    proposedAfter: { successorUserId: null, folderCount: 0, resourceGroupCount: 0, documentCount: 0 }
  }
  assert.deepEqual(await fixture.resolver.resolve(intent({
    status: "finalization_pending",
    draft: zeroDraft,
    requestedCompletion: { result: "success", after: zero, requestedAt: later }
  })), { result: "success", after: zero })
  await assert.rejects(
    () => fixture.resolver.resolve(intent({ draft: zeroDraft })),
    /authoritative state is unavailable/
  )
})

test("FR-086 administrative-principal transfer resolver binds reused state through durable completion", async () => {
  const fixture = createFixture({
    status: "committed",
    mutateState: (state) => {
      state.auditIntentId = "security_mutation_original"
      state.actorId = "original-actor"
      state.reason = "original-transfer"
    }
  })
  const expected = successAfter(fixture.state)
  const retryDraft = { ...draft(), actorId: "retry-actor", reason: "retry-transfer" }
  assert.deepEqual(await fixture.resolver.resolve(intent({
    status: "finalization_pending",
    draft: retryDraft,
    requestedCompletion: { result: "success", after: expected, requestedAt: later }
  })), { result: "success", after: expected })
  await assert.rejects(
    () => fixture.resolver.resolve(intent({ draft: retryDraft })),
    /state is not bound to this audit intent/
  )

  const before = { sourceUserId, folders: 0, resourceGroups: 1, documents: 0, total: 1 }
  assert.deepEqual(await fixture.resolver.resolve(intent({
    status: "finalization_pending",
    draft: retryDraft,
    requestedCompletion: { result: "conflict", after: before, requestedAt: later }
  })), { result: "conflict", after: before })
  const reconciliationRequired = {
    sourceUserId,
    folders: 2,
    resourceGroups: 0,
    documents: 1,
    total: 3,
    reconciliationRequired: true
  }
  assert.deepEqual(await fixture.resolver.resolve(intent({
    status: "finalization_pending",
    draft: retryDraft,
    requestedCompletion: { result: "failed", after: reconciliationRequired, requestedAt: later }
  })), { result: "failed", after: reconciliationRequired })
})

test("FR-086 administrative-principal transfer resolver accepts producer ownership and inventory races", async () => {
  const admission = createFixture({
    status: "committed",
    mutateState: (state) => {
      const document = state.documents[0]!
      document.source = {
        ...document.source,
        metadata: { tenantId, ownerUserId: "metadata-owner" },
        admission: { tenantId, ownerUserId: sourceUserId }
      }
      document.target = {
        ...document.target,
        metadata: {
          tenantId,
          ownerUserId: "metadata-owner",
          administrativeTransferOperationId: state.operationId
        },
        admission: { tenantId, ownerUserId: successorUserId }
      }
    }
  })
  assert.deepEqual(await admission.resolver.resolve(intent()), {
    result: "success",
    after: successAfter(admission.state)
  })

  const defaultAdminPrincipal = createFixture({
    status: "committed",
    mutateState: (state) => {
      const source = { ...state.folders[0]!.source }
      delete source.adminPrincipalType
      delete source.adminPrincipalId
      state.folders[0] = {
        source,
        target: {
          ...state.folders[0]!.target,
          adminPrincipalType: "user",
          adminPrincipalId: sourceUserId
        }
      }
    }
  })
  assert.deepEqual(await defaultAdminPrincipal.resolver.resolve(intent()), {
    result: "success",
    after: successAfter(defaultAdminPrincipal.state)
  })

  const reduced = createFixture({ status: "committed" })
  const largerBefore = { sourceUserId, folders: 2, resourceGroups: 1, documents: 1, total: 4 }
  assert.deepEqual(await reduced.resolver.resolve(intent({
    draft: {
      ...draft(),
      before: largerBefore,
      proposedAfter: { successorUserId, folderCount: 2, resourceGroupCount: 1, documentCount: 1 }
    }
  })), { result: "success", after: successAfter(reduced.state) })
})

test("FR-086 administrative-principal transfer resolver fails closed on partial and crossed state", async () => {
  const partial = createFixture({ status: "prepared" })
  await assert.rejects(() => partial.resolver.resolve(intent()), /not in a converged state/)

  const crossed = createFixture({ mutateState: (state) => { state.tenantId = "tenant-2" } })
  await assert.rejects(() => crossed.resolver.resolve(intent()), /crossed its audit or identity boundary/)

  const wrongAudit = createFixture({ mutateState: (state) => { state.auditIntentId = "security_mutation_other" } })
  await assert.rejects(() => wrongAudit.resolver.resolve(intent()), /state is not bound to this audit intent/)

  const malformed = createFixture({ stateText: "{" })
  await assert.rejects(() => malformed.resolver.resolve(intent()), /state is not valid JSON/)

  const duplicate = createFixture({ mutateState: (state) => { state.folders.push(state.folders[0]!) } })
  await assert.rejects(() => duplicate.resolver.resolve(intent()), /folder identity is invalid/)

  const unrelatedFolder = createFixture({
    status: "committed",
    mutateState: (state) => {
      const source = {
        ...state.folders[0]!.source,
        ownerUserId: "other-owner",
        adminPrincipalType: "group",
        adminPrincipalId: "group-1"
      }
      state.folders[0] = { source, target: { ...source, updatedAt: later } }
    }
  })
  await assert.rejects(() => unrelatedFolder.resolver.resolve(intent()), /folder is not owned by the source principal/)

  const unrelatedResourceGroup = createFixture({
    status: "committed",
    mutateState: (state) => {
      const source = { ...state.resourceGroups[0]!.source, createdBy: "other-owner" }
      state.resourceGroups[0] = { source, target: { ...source, updatedAt: later } }
    }
  })
  await assert.rejects(
    () => unrelatedResourceGroup.resolver.resolve(intent()),
    /resource group is not owned by the source principal/
  )

  const wrongOperation = createFixture({
    status: "committed",
    mutateState: (state) => {
      const target = state.documents[0]!.target
      state.documents[0]!.target = {
        ...target,
        metadata: { ...(target.metadata as Record<string, unknown>), administrativeTransferOperationId: "other-operation" }
      }
    }
  })
  await assert.rejects(() => wrongOperation.resolver.resolve(intent()), /operation marker is invalid/)

  const crossedAdmissionTenant = createFixture({
    status: "committed",
    mutateState: (state) => {
      const source = state.documents[0]!.source
      const target = state.documents[0]!.target
      state.documents[0]!.source = {
        ...source,
        admission: { tenantId: "tenant-2", ownerUserId: sourceUserId }
      }
      state.documents[0]!.target = {
        ...target,
        admission: { tenantId: "tenant-2", ownerUserId: successorUserId }
      }
    }
  })
  await assert.rejects(() => crossedAdmissionTenant.resolver.resolve(intent()), /document crossed its tenant boundary/)

  const unavailable = createFixture({ status: "committed", current: "missing" })
  await assert.rejects(() => unavailable.resolver.resolve(intent()), /folder does not match target state/)
})

function createFixture(options: {
  status?: TransferState["status"]
  current?: "source" | "target" | "missing"
  marker?: boolean
  stateText?: string
  mutateState?: (state: TransferState) => void
} = {}) {
  const manifestKey = tenantManifestKey(policy, tenantId, "document-1")
  const folderSource = {
    groupId: "folder-1", tenantId, ownerUserId: sourceUserId,
    adminPrincipalType: "user", adminPrincipalId: sourceUserId, updatedAt: earlier
  }
  const folderTarget = {
    ...folderSource, ownerUserId: successorUserId, adminPrincipalId: successorUserId, updatedAt: later
  }
  const resourceSource = { groupId: "resource-1", tenantId, createdBy: sourceUserId, updatedAt: earlier }
  const resourceTarget = { ...resourceSource, createdBy: successorUserId, updatedAt: later }
  const documentSource = {
    documentId: "document-1", manifestObjectKey: manifestKey,
    metadata: { tenantId, ownerUserId: sourceUserId }, lifecycleStatus: "active"
  }
  const documentTarget = {
    ...documentSource, metadata: { tenantId, ownerUserId: successorUserId, administrativeTransferOperationId: "ownership_transfer_1" }
  }
  const state: TransferState = {
    schemaVersion: 1,
    operationId: "ownership_transfer_1",
    status: options.status ?? "transferring",
    actorId: "actor-1",
    tenantId,
    sourceUserId,
    successorUserId,
    reason: "succession",
    folders: [{ source: folderSource, target: folderTarget }],
    resourceGroups: [{ source: resourceSource, target: resourceTarget }],
    documents: [{ sourceVersion: "version-1", source: documentSource, target: documentTarget }],
    auditIntentId,
    createdAt: earlier,
    updatedAt: later
  }
  options.mutateState?.(state)
  const side = options.current ?? "target"
  const currentFolders = new Map<string, unknown>()
  const currentResourceGroups = new Map<string, unknown>()
  const objects = new Map<string, string>()
  if (options.marker !== false) {
    objects.set(stateKey(), options.stateText ?? JSON.stringify(state))
  }
  if (side !== "missing") {
    currentFolders.set("folder-1", state.folders[0]![side])
    currentResourceGroups.set("resource-1", state.resourceGroups[0]![side])
    objects.set(manifestKey, JSON.stringify(state.documents[0]![side]))
  }
  const missing = () => Object.assign(new Error("missing"), { code: "ENOENT" })
  const resolver = new AdministrativePrincipalTransferAuditAuthoritativeResolver({
    ...policy,
    objects: { getText: async (key: string) => objects.get(key) ?? Promise.reject(missing()) },
    folders: { get: async (_tenantId: string, id: string) => currentFolders.get(id) as never },
    resourceGroups: { get: async (_tenantId: string, id: string) => currentResourceGroups.get(id) as never }
  })
  return { resolver, state, currentFolders, currentResourceGroups }
}

function draft(): SecurityMutationAuditDraft {
  return {
    actorId: "actor-1",
    tenantId,
    targetType: "administrativePrincipal",
    targetId: sourceUserId,
    operation: "ownership.transfer",
    before: inventoryBefore(),
    proposedAfter: { successorUserId, folderCount: 1, resourceGroupCount: 1, documentCount: 1 },
    reason: "succession",
    policyVersion: "administrative-principal-transfer-v1"
  }
}

function intent(patch: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: auditIntentId,
    status: "pending",
    draft: draft(),
    createdAt: earlier,
    ...patch
  }
}

function inventoryBefore() {
  return { sourceUserId, folders: 1, resourceGroups: 1, documents: 1, total: 3 }
}

function inventoryAfter(state: TransferState) {
  return {
    sourceUserId,
    folders: state.folders.length,
    resourceGroups: state.resourceGroups.length,
    documents: state.documents.length,
    total: state.folders.length + state.resourceGroups.length + state.documents.length
  }
}

function successAfter(state: TransferState) {
  return {
    sourceUserId,
    successorUserId,
    folderIds: state.folders.map((entry) => entry.source.groupId as string),
    resourceGroupIds: state.resourceGroups.map((entry) => entry.source.groupId as string),
    documentIds: state.documents.map((entry) => entry.source.documentId as string)
  }
}

function stateKey() {
  return `security/ownership-transfer/${tenantId}/${sourceUserId}.json`
}

function reverseObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).reverse())
}

type TransferState = {
  schemaVersion: 1
  operationId: string
  status: "prepared" | "transferring" | "rollback_pending" | "rolled_back" | "committed"
  actorId: string
  tenantId: string
  sourceUserId: string
  successorUserId: string
  reason: string
  folders: Array<{ source: Record<string, unknown>; target: Record<string, unknown> }>
  resourceGroups: Array<{ source: Record<string, unknown>; target: Record<string, unknown> }>
  documents: Array<{ sourceVersion: string; source: Record<string, unknown>; target: Record<string, unknown> }>
  auditIntentId: string
  createdAt: string
  updatedAt: string
}
