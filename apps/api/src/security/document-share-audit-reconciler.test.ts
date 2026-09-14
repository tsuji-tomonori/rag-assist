import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import {
  documentShareGrantKey,
  documentSharePolicyStateVersion
} from "../documents/document-permission-service.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type { DocumentShareGrant } from "../types.js"
import { DocumentShareAuditAuthoritativeResolver } from "./document-share-audit-reconciler.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditDraft,
  type SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 document share resolver supports only the exact target and operation", async () => {
  const resolver = new DocumentShareAuditAuthoritativeResolver(await objectStore("document-share-support-"))
  assert.equal(resolver.supports(draft()), true)
  assert.equal(resolver.supports({ ...draft(), targetType: "folder" }), false)
  assert.equal(resolver.supports({ ...draft(), operation: "move" }), false)
})

test("FR-086 document share resolver converges duplicate workers on one authoritative success event", async () => {
  const objects = await objectStore("document-share-workers-")
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(objects)
  const prepared = await outbox.prepare(draft())
  const current = [
    grant({ principalType: "group", principalId: "editors", permissionLevel: "readOnly" }),
    grant()
  ]
  await writeGrantFile(objects, current)
  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new DocumentShareAuditAuthoritativeResolver(objects)
  ])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, auditGrants(current))
  assert.equal((await outbox.listAll("tenant-1")).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 document share resolver preserves a durable non-success only when current grants confirm it", async () => {
  const objects = await objectStore("document-share-completion-")
  const before = [grant({ updatedAt: "2026-07-17T00:00:00.000Z" })]
  await writeGrantFile(objects, before)
  const resolver = new DocumentShareAuditAuthoritativeResolver(objects)
  const durable = intent({
    status: "finalization_pending",
    draft: draft({ before: auditGrants(before) }),
    requestedCompletion: {
      result: "conflict",
      after: auditGrants(before),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(durable), {
    result: "conflict",
    after: auditGrants(before)
  })
  await writeGrantFile(objects, [grant()])
  await assert.rejects(() => resolver.resolve(durable), /do not confirm/)
})

test("FR-086 document share resolver rejects a successful completion outside the proposed semantic state", async () => {
  const objects = await objectStore("document-share-success-mismatch-")
  const resolver = new DocumentShareAuditAuthoritativeResolver(objects)
  await assert.rejects(() => resolver.resolve(intent({
    status: "finalization_pending",
    draft: draft({ before: [] }),
    requestedCompletion: {
      result: "success",
      after: [],
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })), /does not match the proposed state/)
})

test("FR-086 document share resolver finalizes an empty early non-success without reading grants", async () => {
  const objects = new CountingObjectStore(await mkdtemp(path.join(tmpdir(), "document-share-early-")))
  const resolver = new DocumentShareAuditAuthoritativeResolver(objects)
  const earlyFailure = intent({
    status: "finalization_pending",
    draft: draft({ before: [] }),
    requestedCompletion: {
      result: "denied",
      after: [],
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(earlyFailure), { result: "denied", after: [] })
  assert.equal(objects.reads, 0)
})

test("FR-086 document share resolver requires exact cleanup repair for a group revocation", async () => {
  const before = [grant({
    principalType: "group",
    principalId: "editors",
    permissionLevel: "full",
    updatedAt: "2026-07-17T00:00:00.000Z"
  })]
  const after = [grant({
    principalType: "group",
    principalId: "editors",
    permissionLevel: "readOnly"
  })]
  const revocation = intent({ draft: draft({
    before: auditGrants(before),
    proposedAfter: semanticGrants(after)
  }) })
  const objects = await objectStore("document-share-group-repair-")
  await writeGrantFile(objects, after)
  const resolver = new DocumentShareAuditAuthoritativeResolver(objects)

  await assert.rejects(() => resolver.resolve(revocation), /no durable cleanup repair/)
  await prepareRepair(objects, revocation, before, after)
  assert.deepEqual(await resolver.resolve(revocation), {
    result: "success",
    after: auditGrants(after)
  })
})

test("FR-086 document share resolver rejects wrong deny versions and incomplete or extraneous cleanup targets", async () => {
  const before = [grant({
    principalType: "group",
    principalId: "editors",
    permissionLevel: "full",
    updatedAt: "2026-07-17T00:00:00.000Z"
  })]
  const after = [grant({
    principalType: "group",
    principalId: "editors",
    permissionLevel: "readOnly"
  })]
  const revocation = intent({ draft: draft({
    before: auditGrants(before),
    proposedAfter: semanticGrants(after)
  }) })

  for (const [label, denyVersion, targets] of [
    ["wrong deny", "wrong-version", cleanupTargets("group", "editors", "readOnly")],
    ["incomplete", documentSharePolicyStateVersion(after), cleanupTargets("group", "editors", "readOnly").slice(0, 3)],
    ["extraneous", documentSharePolicyStateVersion(after), [
      ...cleanupTargets("group", "editors", "readOnly"),
      { scope: "cache", reference: "document:document-1:principal:user:outsider" }
    ]]
  ] as const) {
    const objects = await objectStore(`document-share-${label.replaceAll(" ", "-")}-`)
    await writeGrantFile(objects, after)
    await prepareRepair(objects, revocation, before, after, denyVersion, targets)
    await assert.rejects(
      () => new DocumentShareAuditAuthoritativeResolver(objects).resolve(revocation),
      /does not match the authoritative deny/,
      label
    )
  }
})

test("FR-086 document share resolver permits user-only inherited-access downgrade without repair", async () => {
  const before = [grant({ permissionLevel: "full", updatedAt: "2026-07-17T00:00:00.000Z" })]
  const after = [grant({ permissionLevel: "readOnly" })]
  const objects = await objectStore("document-share-user-no-repair-")
  await writeGrantFile(objects, after)
  const resolver = new DocumentShareAuditAuthoritativeResolver(objects)

  assert.deepEqual(await resolver.resolve(intent({ draft: draft({
    before: auditGrants(before),
    proposedAfter: semanticGrants(after)
  }) })), {
    result: "success",
    after: auditGrants(after)
  })
})

test("FR-086 document share resolver reads legacy state by exact tenant and document only", async () => {
  const objects = await objectStore("document-share-legacy-")
  const expected = grant()
  await objects.putText("documents/share-grants.json", JSON.stringify({
    schemaVersion: 1,
    grants: [
      expected,
      grant({ tenantId: "tenant-2", documentShareGrantId: "grant-tenant-2" }),
      grant({ documentId: "document-2", documentShareGrantId: "grant-document-2" })
    ],
    auditLog: []
  }))

  assert.deepEqual(await new DocumentShareAuditAuthoritativeResolver(objects).resolve(intent({
    draft: draft({ proposedAfter: semanticGrants([expected]) })
  })), {
    result: "success",
    after: auditGrants([expected])
  })
})

test("FR-086 document share resolver fails closed for before, third, corrupt, duplicate, and unsupported state", async () => {
  const missingObjects = await objectStore("document-share-missing-")
  await assert.rejects(
    () => new DocumentShareAuditAuthoritativeResolver(missingObjects).resolve(intent()),
    /no durable non-success result/
  )

  const malformedLegacyObjects = await objectStore("document-share-malformed-legacy-")
  await malformedLegacyObjects.putText("documents/share-grants.json", JSON.stringify({ schemaVersion: 2, grants: [] }))
  await assert.rejects(
    () => new DocumentShareAuditAuthoritativeResolver(malformedLegacyObjects).resolve(intent()),
    /legacy document share ledger is invalid/
  )

  const before = [grant({ updatedAt: "2026-07-17T00:00:00.000Z" })]
  const beforeIntent = intent({ draft: draft({ before: auditGrants(before) }) })
  const beforeObjects = await objectStore("document-share-before-")
  await writeGrantFile(beforeObjects, before)
  await assert.rejects(
    () => new DocumentShareAuditAuthoritativeResolver(beforeObjects).resolve(beforeIntent),
    /no durable non-success result/
  )

  const thirdObjects = await objectStore("document-share-third-")
  await writeGrantFile(thirdObjects, [grant({ principalId: "third-user", documentShareGrantId: "grant-third" })])
  await assert.rejects(
    () => new DocumentShareAuditAuthoritativeResolver(thirdObjects).resolve(intent()),
    /neither the before nor proposed/
  )

  const corruptCases: Array<[string, unknown, RegExp]> = [
    ["cross tenant", { schemaVersion: 1, grants: [grant({ tenantId: "tenant-2" })] }, /identity boundary/],
    ["wrong document", { schemaVersion: 1, grants: [grant({ documentId: "document-2" })] }, /identity boundary/],
    ["invalid timestamp", { schemaVersion: 1, grants: [grant({ updatedAt: "invalid" })] }, /identity boundary/],
    ["duplicate", { schemaVersion: 1, grants: [grant(), grant({ documentShareGrantId: "grant-2" })] }, /duplicate principal/],
    ["invalid schema", { schemaVersion: 2, grants: [] }, /grant file is invalid/]
  ]
  for (const [label, value, expected] of corruptCases) {
    const objects = await objectStore(`document-share-corrupt-${label.replaceAll(" ", "-")}-`)
    await objects.putText(documentShareGrantKey("tenant-1", "document-1"), JSON.stringify(value))
    await assert.rejects(
      () => new DocumentShareAuditAuthoritativeResolver(objects).resolve(intent()),
      expected,
      label
    )
  }

  const unsupported = await objectStore("document-share-unsupported-")
  await assert.rejects(
    () => new DocumentShareAuditAuthoritativeResolver(unsupported).resolve(intent({
      draft: { ...draft(), operation: "delete" }
    })),
    /does not support/
  )
  await assert.rejects(
    () => new DocumentShareAuditAuthoritativeResolver(unsupported).resolve(intent({
      draft: draft({ proposedAfter: [proposed(), proposed()] })
    })),
    /duplicate principal/
  )
})

async function prepareRepair(
  objects: LocalObjectStore,
  revocation: SecurityMutationAuditIntent,
  before: DocumentShareGrant[],
  after: DocumentShareGrant[],
  authoritativeDenyVersion = documentSharePolicyStateVersion(after),
  knownTargets: readonly { scope: string; reference: string }[] = cleanupTargets("group", "editors", "readOnly")
): Promise<void> {
  await new ObjectStoreRevocationCleanupRepairOutbox(objects).prepare({
    expectedBeforeDenyVersion: documentSharePolicyStateVersion(before),
    preparedAt: "2026-07-17T00:01:00.000Z",
    cleanupRegistration: {
      operationId: `document-share:${revocation.intentId}`,
      tenantId: "tenant-1",
      resourceType: "document",
      resourceId: "document-1",
      trigger: "share_revoked",
      deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
      authoritativeDenyVersion,
      authoritativeDenyConfirmedAt: "2026-07-17T00:01:00.000Z",
      knownTargets: knownTargets as Array<{
        scope: "grant" | "cache" | "session" | "queued_run"
        reference: string
      }>
    }
  })
}

function cleanupTargets(
  principalType: "user" | "group",
  principalId: string,
  ceiling: "none" | "readOnly"
) {
  const reference = `document:document-1:principal:${principalType}:${principalId}`
  return [
    { scope: "grant" as const, reference: `${reference}:ceiling:${ceiling}` },
    { scope: "cache" as const, reference },
    { scope: "session" as const, reference: `${reference}/session` },
    { scope: "queued_run" as const, reference }
  ]
}

async function writeGrantFile(objects: LocalObjectStore, grants: DocumentShareGrant[]): Promise<void> {
  await objects.putText(documentShareGrantKey("tenant-1", "document-1"), JSON.stringify({
    schemaVersion: 1,
    grants
  }))
}

function grant(overrides: Partial<DocumentShareGrant> = {}): DocumentShareGrant {
  return {
    documentShareGrantId: "grant-reader",
    itemType: "documentShareGrant",
    tenantId: "tenant-1",
    documentId: "document-1",
    principalType: "user",
    principalId: "reader-1",
    permissionLevel: "readOnly",
    createdBy: "admin-1",
    reason: "共有範囲変更",
    createdAt: "2026-07-17T00:01:00.000Z",
    updatedAt: "2026-07-17T00:01:00.000Z",
    ...overrides
  }
}

function auditGrants(grants: readonly DocumentShareGrant[]) {
  return [...grants]
    .sort((left, right) => left.principalType.localeCompare(right.principalType) || left.principalId.localeCompare(right.principalId))
    .map((item) => ({
      tenantId: item.tenantId,
      documentId: item.documentId,
      principalType: item.principalType,
      principalId: item.principalId,
      permissionLevel: item.permissionLevel,
      updatedAt: item.updatedAt
    }))
}

function semanticGrants(grants: readonly DocumentShareGrant[]) {
  return [...grants]
    .sort((left, right) => left.principalType.localeCompare(right.principalType) || left.principalId.localeCompare(right.principalId))
    .map(({ principalType, principalId, permissionLevel }) => ({
      principalType,
      principalId,
      permissionLevel
    }))
}

function proposed() {
  return {
    principalType: "user" as const,
    principalId: "reader-1",
    permissionLevel: "readOnly" as const
  }
}

function draft(overrides: Partial<SecurityMutationAuditDraft> = {}): SecurityMutationAuditDraft {
  return {
    actorId: "admin-1",
    tenantId: "tenant-1",
    targetType: "document",
    targetId: "document-1",
    operation: "share.replace",
    before: [],
    proposedAfter: [
      proposed(),
      { principalType: "group", principalId: "editors", permissionLevel: "readOnly" }
    ],
    reason: "共有範囲変更",
    policyVersion: "document-share-policy-v1",
    ...overrides
  }
}

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: "security_mutation_document_share_test",
    status: "pending",
    draft: draft(),
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  }
}

async function objectStore(prefix: string): Promise<LocalObjectStore> {
  return new LocalObjectStore(await mkdtemp(path.join(tmpdir(), prefix)))
}

class CountingObjectStore extends LocalObjectStore {
  reads = 0

  override async getText(key: string): Promise<string> {
    this.reads += 1
    return super.getText(key)
  }
}
