import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { folderPolicyStateVersion, type VersionedFolderPolicyState } from "../adapters/folder-policy-store.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import type { FolderPolicy } from "../types.js"
import { FolderShareAuditAuthoritativeResolver } from "./folder-share-audit-reconciler.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditDraft,
  type SecurityMutationAuditIntent
} from "./security-mutation-audit-outbox.js"
import { SecurityMutationAuditReconciler } from "./security-mutation-audit-reconciler.js"

test("FR-086 folder share resolver supports only the exact target and operation", () => {
  const resolver = resolverFor(state())
  assert.equal(resolver.supports(draft()), true)
  assert.equal(resolver.supports({ ...draft(), targetType: "document" }), false)
  assert.equal(resolver.supports({ ...draft(), operation: "move" }), false)
})

test("FR-086 folder share resolver converges duplicate workers on one authoritative success event", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-share-audit-"))
  const policies = new LocalFolderPolicyStore(dataDir)
  const outbox = new ObjectStoreSecurityMutationAuditOutbox(new LocalObjectStore(dataDir))
  const prepared = await outbox.prepare(draft())
  await policies.save(policy({
    entries: [
      { principalType: "group", principalId: "editors", permissionLevel: "readOnly" },
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
    ]
  }))
  const reconciler = new SecurityMutationAuditReconciler(outbox, [
    new FolderShareAuditAuthoritativeResolver(policies)
  ])

  const results = await Promise.all(Array.from({ length: 8 }, () => reconciler.reconcileTenant("tenant-1")))

  assert.ok(results.some((result) => result.completed === 1))
  const completed = await outbox.get("tenant-1", prepared.intentId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.result, "success")
  assert.deepEqual(completed.after, draft().proposedAfter)
  assert.equal((await outbox.listAll("tenant-1")).filter((item) => item.status === "completed").length, 1)
})

test("FR-086 folder share resolver requires an audit-correlated cleanup repair for a revocation", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-share-repair-"))
  const objects = new LocalObjectStore(dataDir)
  const before = policy({ entries: [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "group", principalId: "editors", permissionLevel: "full" }
  ], updatedAt: "2026-07-17T00:00:00.000Z" })
  const after = policy({ entries: [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "group", principalId: "editors", permissionLevel: "readOnly" }
  ] })
  const revocation = intent({ draft: {
    ...draft(),
    before: policyAudit(before),
    proposedAfter: policyAudit(after)
  } })
  const resolver = new FolderShareAuditAuthoritativeResolver({
    getVersionedByFolderId: async () => state(after)
  }, objects)

  await assert.rejects(() => resolver.resolve(revocation), /no durable cleanup repair/)
  const badObjects = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "folder-share-bad-repair-")))
  await prepareRepair(badObjects, revocation, before, after, "wrong-deny-version")
  await assert.rejects(
    () => new FolderShareAuditAuthoritativeResolver({
      getVersionedByFolderId: async () => state(after)
    }, badObjects).resolve(revocation),
    /no durable cleanup repair/
  )
  await prepareRepair(objects, revocation, before, after, folderPolicyStateVersion(after))
  assert.deepEqual(await resolver.resolve(revocation), {
    result: "success",
    after: policyAudit(after)
  })
})

async function prepareRepair(
  objects: LocalObjectStore,
  revocation: SecurityMutationAuditIntent,
  before: FolderPolicy,
  after: FolderPolicy,
  authoritativeDenyVersion: string
): Promise<void> {
  await new ObjectStoreRevocationCleanupRepairOutbox(objects).prepare({
    expectedBeforeDenyVersion: folderPolicyStateVersion(before),
    preparedAt: after.updatedAt,
    cleanupRegistration: {
      operationId: `folder-share:${revocation.intentId}`,
      tenantId: "tenant-1",
      resourceType: "folder",
      resourceId: "folder-1",
      trigger: "share_revoked",
      authoritativeDenyVersion,
      authoritativeDenyConfirmedAt: after.updatedAt,
      knownTargets: [
        { scope: "grant", reference: "folder:folder-1:principal:group:editors:ceiling:readOnly" },
        { scope: "cache", reference: "folder:folder-1:principal:group:editors" },
        { scope: "session", reference: "folder:folder-1:principal:group:editors/session" },
        { scope: "queued_run", reference: "folder:folder-1:principal:group:editors" }
      ]
    }
  })
}

test("FR-086 folder share resolver preserves durable non-success only when current policy confirms it", async () => {
  const durable = intent({
    status: "finalization_pending",
    requestedCompletion: {
      result: "conflict",
      after: policyAudit(beforePolicy()),
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolverFor(state(beforePolicy())).resolve(durable), {
    result: "conflict",
    after: policyAudit(beforePolicy())
  })
  await assert.rejects(
    () => resolverFor(state(policy())).resolve(durable),
    /does not confirm/
  )
})

test("FR-086 folder share resolver rejects a successful completion that does not match the proposed policy", async () => {
  await assert.rejects(
    () => resolverFor(state()).resolve(intent({
      status: "finalization_pending",
      draft: { ...draft(), before: null },
      requestedCompletion: {
        result: "success",
        after: null,
        requestedAt: "2026-07-17T00:02:00.000Z"
      }
    })),
    /does not match the proposed state/
  )
})

test("FR-086 folder share resolver finalizes durable early failure without reading policy state", async () => {
  let reads = 0
  const resolver = new FolderShareAuditAuthoritativeResolver({
    getVersionedByFolderId: async () => {
      reads += 1
      return state()
    }
  })
  const earlyFailure = intent({
    status: "finalization_pending",
    draft: { ...draft(), before: null },
    requestedCompletion: {
      result: "denied",
      after: null,
      requestedAt: "2026-07-17T00:02:00.000Z"
    }
  })

  assert.deepEqual(await resolver.resolve(earlyFailure), { result: "denied", after: null })
  assert.equal(reads, 0)
})

test("FR-086 folder share resolver fails closed for missing, boundary-crossing, and corrupt policy state", async () => {
  const cases: Array<[string, VersionedFolderPolicyState, RegExp]> = [
    ["missing policy", state(), /neither the before nor proposed/],
    ["cross tenant", state(policy({ tenantId: "tenant-2" })), /crossed its identity boundary/],
    ["wrong folder", state(policy({ folderId: "folder-2" })), /crossed its identity boundary/],
    ["invalid creator", state(policy({ createdBy: " owner-1" })), /crossed its identity boundary/],
    ["invalid updated timestamp", state(policy({ updatedAt: "not-a-timestamp" })), /crossed its identity boundary/],
    ["duplicate principal", state(policy({ entries: [
        { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
        { principalType: "user", principalId: "owner-1", permissionLevel: "readOnly" }
      ] })), /duplicate principal/],
    ["invalid state version", { policy: policy(), version: "stale-version" }, /version is invalid/]
  ]
  for (const [label, current, expected] of cases) {
    await assert.rejects(() => resolverFor(current).resolve(intent()), expected, label)
  }
})

test("FR-086 folder share resolver does not guess from before, third, invalid, or unsupported state", async () => {
  await assert.rejects(
    () => resolverFor(state(beforePolicy())).resolve(intent()),
    /no durable non-success result/
  )
  const third = policy({ updatedAt: "2026-07-17T00:03:00.000Z" })
  await assert.rejects(
    () => resolverFor(state(third)).resolve(intent()),
    /neither the before nor proposed/
  )
  await assert.rejects(
    () => resolverFor(state(policy())).resolve(intent({
      draft: {
        ...draft(),
        proposedAfter: { ...policyAudit(policy()), entries: [{ principalType: "role", principalId: "CHAT_USER", permissionLevel: "full" }] }
      }
    })),
    /entries are invalid/
  )
  await assert.rejects(
    () => resolverFor(state(policy())).resolve(intent({
      draft: { ...draft(), operation: "delete" }
    })),
    /does not support/
  )
})

function resolverFor(current: VersionedFolderPolicyState): FolderShareAuditAuthoritativeResolver {
  return new FolderShareAuditAuthoritativeResolver({ getVersionedByFolderId: async () => current })
}

function state(value?: FolderPolicy): VersionedFolderPolicyState {
  return { policy: value, version: folderPolicyStateVersion(value) }
}

function intent(overrides: Partial<SecurityMutationAuditIntent> = {}): SecurityMutationAuditIntent {
  return {
    schemaVersion: 1,
    intentId: "security_mutation_folder_share_test",
    status: "pending",
    draft: draft(),
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  }
}

function draft(): SecurityMutationAuditDraft {
  return {
    actorId: "admin-1",
    tenantId: "tenant-1",
    targetType: "folder",
    targetId: "folder-1",
    operation: "share.replace",
    before: policyAudit(beforePolicy()),
    proposedAfter: policyAudit(policy()),
    reason: "共有範囲変更",
    policyVersion: "folder-share-policy-v1"
  }
}

function beforePolicy(): FolderPolicy {
  return policy({
    entries: [{ principalType: "user", principalId: "owner-1", permissionLevel: "full" }],
    updatedAt: "2026-07-17T00:00:00.000Z"
  })
}

function policy(overrides: Partial<FolderPolicy> = {}): FolderPolicy {
  return {
    policyId: "folder-policy-1",
    itemType: "folderPolicy",
    tenantId: "tenant-1",
    folderId: "folder-1",
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "group", principalId: "editors", permissionLevel: "readOnly" }
    ],
    createdBy: "admin-1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:01:00.000Z",
    ...overrides
  }
}

function policyAudit(value: FolderPolicy) {
  return {
    policyId: value.policyId,
    tenantId: value.tenantId,
    folderId: value.folderId,
    entries: value.entries.map((entry) => ({ ...entry })),
    updatedAt: value.updatedAt
  }
}
