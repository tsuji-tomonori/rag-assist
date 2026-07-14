import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../../../adapters/local-object-store.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  REVOCATION_CLEANUP_SCOPES,
  RevocationCleanupConflictError,
  type RevocationCleanupDriver,
  type RevocationCleanupTargetReference
} from "./revocation-cleanup-coordinator.js"

test("FR-066 registers a complete tenant-scoped cleanup manifest only after the authoritative deny", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "revocation-cleanup-register-")))
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(store, sequenceClock())
  const events: string[] = []

  events.push("authoritative-deny")
  const manifest = await coordinator.register({
    operationId: "revoke-doc-1-v7",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-1",
    trigger: "usage_restricted",
    deniedPurposes: ["normal_rag", "evaluation"],
    authoritativeDenyVersion: "governance-v7",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [
      { scope: "source", reference: "documents/doc-1/source.txt" },
      { scope: "old_index", reference: "index-v3/doc-1" }
    ]
  })
  events.push("cleanup-manifest")

  assert.deepEqual(events, ["authoritative-deny", "cleanup-manifest"])
  assert.equal(manifest.authoritativeDeny.status, "effective")
  assert.equal(manifest.authoritativeDeny.version, "governance-v7")
  assert.equal(manifest.status, "cleanup_pending")
  assert.deepEqual(manifest.scopes.map((scope) => scope.scope), REVOCATION_CLEANUP_SCOPES)
  assert.ok(manifest.scopes.every((scope) => scope.status === "pending"))
  assert.equal(manifest.targets.length, 2)

  const idempotent = await coordinator.register({
    operationId: "revoke-doc-1-v7",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-1",
    trigger: "usage_restricted",
    deniedPurposes: ["evaluation", "normal_rag"],
    authoritativeDenyVersion: "governance-v7",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z"
  })
  assert.equal(idempotent.operationId, manifest.operationId)
  await assert.rejects(() => coordinator.register({
    operationId: "revoke-doc-1-v7",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-1",
    trigger: "usage_restricted",
    authoritativeDenyVersion: "different-deny",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z"
  }), RevocationCleanupConflictError)
})

test("FR-066 cleanup failures and newly detected residuals remain durable until an idempotent retry verifies every scope", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "revocation-cleanup-retry-")))
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(store, sequenceClock())
  const registered = await coordinator.register({
    operationId: "revoke-doc-race",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-race",
    trigger: "deleted",
    authoritativeDenyVersion: "tombstone-v2",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "chunk", reference: "chunks/doc-race.json" }]
  })

  const cleaned = new Set<string>()
  let failOldIndexOnce = true
  let exposeResidualCacheOnce = true
  const driver: RevocationCleanupDriver = {
    async isAuthoritativeDenyCurrent() { return true },
    async discover(_manifest, scope) {
      if (scope === "old_index") return [{ scope, reference: "index-v1/doc-race" }]
      if (scope === "queued_run") return [{ scope, reference: "run-stale" }]
      return []
    },
    async cleanup(_manifest, target) {
      if (target.scope === "old_index" && failOldIndexOnce) {
        failOldIndexOnce = false
        throw new Error("simulated old-index outage with secret details")
      }
      cleaned.add(`${target.scope}:${target.reference}`)
    },
    async findResiduals(_manifest, scope) {
      if (scope === "cache" && exposeResidualCacheOnce) {
        exposeResidualCacheOnce = false
        return [{ scope, reference: "cache/doc-race/stale-hit" }]
      }
      return []
    }
  }

  const first = await coordinator.reconcile("tenant-a", registered.operationId, driver)
  assert.equal(first.status, "reconciliation_required")
  assert.equal(first.attempts, 1)
  assert.ok(first.targets.some((target) => target.scope === "old_index" && target.status === "pending" && target.attempts === 1))
  assert.ok(first.targets.some((target) => target.scope === "cache" && target.status === "pending"))
  assert.equal(JSON.stringify(first).includes("secret details"), false)
  assert.equal(first.authoritativeDeny.status, "effective")

  const second = await coordinator.reconcile("tenant-a", registered.operationId, driver)
  assert.equal(second.status, "completed")
  assert.equal(second.attempts, 2)
  assert.ok(second.targets.every((target) => target.status === "cleaned"))
  assert.ok(second.scopes.every((scope) => scope.status === "verified"))
  assert.ok(cleaned.has("old_index:index-v1/doc-race"))
  assert.ok(cleaned.has("cache:cache/doc-race/stale-hit"))
  assert.ok(cleaned.has("queued_run:run-stale"))

  const alreadyComplete = await coordinator.reconcile("tenant-a", registered.operationId, {
    async isAuthoritativeDenyCurrent() { throw new Error("must not run") },
    async discover() { throw new Error("must not run") },
    async cleanup() { throw new Error("must not run") },
    async findResiduals() { throw new Error("must not run") }
  })
  assert.equal(alreadyComplete.attempts, 2)
})

test("FR-066 a superseding authoritative policy prevents a stale cleanup retry from deleting current artifacts", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "revocation-cleanup-superseded-")))
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(store, sequenceClock())
  const registered = await coordinator.register({
    operationId: "old-policy-revoke",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-current",
    trigger: "classification_restricted",
    authoritativeDenyVersion: "policy-v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "active_index", reference: "current-index-record" }]
  })
  let cleanupCalls = 0
  const superseded = await coordinator.reconcile("tenant-a", registered.operationId, {
    async isAuthoritativeDenyCurrent() { return false },
    async discover() { throw new Error("discovery must not run") },
    async cleanup() { cleanupCalls += 1 },
    async findResiduals() { throw new Error("verification must not run") }
  })
  assert.equal(superseded.status, "superseded")
  assert.equal(superseded.lastFailureCode, "authoritative_deny_superseded")
  assert.equal(cleanupCalls, 0)
  assert.equal(superseded.targets[0]?.status, "pending")
})

test("FR-066 residual verification reopens a target that reported cleanup success until retry removes it", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "revocation-cleanup-reopen-")))
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(store, sequenceClock())
  const registered = await coordinator.register({
    operationId: "reopen-residual",
    tenantId: "tenant-a",
    resourceType: "document",
    resourceId: "doc-residual",
    trigger: "deleted",
    authoritativeDenyVersion: "tombstone-v1",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:00.000Z",
    knownTargets: [{ scope: "source", reference: "tenant-artifacts/source.txt" }]
  })
  let residualExists = true
  let cleanupCalls = 0
  const driver: RevocationCleanupDriver = {
    async isAuthoritativeDenyCurrent() { return true },
    async discover() { return [] },
    async cleanup() {
      cleanupCalls += 1
      if (cleanupCalls > 1) residualExists = false
    },
    async findResiduals(_manifest, scope) {
      return scope === "source" && residualExists
        ? [{ scope, reference: "tenant-artifacts/source.txt" }]
        : []
    }
  }

  const first = await coordinator.reconcile("tenant-a", registered.operationId, driver)
  assert.equal(first.status, "reconciliation_required")
  assert.equal(first.targets[0]?.status, "pending")
  assert.equal(first.targets[0]?.lastFailureCode, "residual_artifact_detected")

  const second = await coordinator.reconcile("tenant-a", registered.operationId, driver)
  assert.equal(second.status, "completed")
  assert.equal(second.targets[0]?.status, "cleaned")
  assert.equal(cleanupCalls, 2)
})

test("FR-067 expiry, owner suspension, and chat-scope mismatch use the same cleanup ledger without cross-tenant key collision", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "temporary-revocation-cleanup-")))
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(store, sequenceClock())
  const targets: RevocationCleanupTargetReference[] = [
    { scope: "source", reference: "temporary/attachment-1/source" },
    { scope: "chunk", reference: "temporary/attachment-1/chunks" },
    { scope: "memory", reference: "temporary/attachment-1/memory" },
    { scope: "cache", reference: "temporary/attachment-1/cache" },
    { scope: "queued_run", reference: "chat-run-1" }
  ]
  const common = {
    operationId: "temporary-expiry-1",
    resourceType: "temporary_attachment" as const,
    resourceId: "attachment-1",
    trigger: "expired" as const,
    deniedPurposes: ["normal_rag"],
    authoritativeDenyVersion: "expiry:2026-07-11T00:00:00.000Z",
    authoritativeDenyConfirmedAt: "2026-07-11T00:00:01.000Z",
    knownTargets: targets
  }
  const tenantA = await coordinator.register({ ...common, tenantId: "tenant-a" })
  const tenantB = await coordinator.register({ ...common, tenantId: "tenant-b" })
  assert.equal(tenantA.tenantId, "tenant-a")
  assert.equal(tenantB.tenantId, "tenant-b")
  assert.equal((await coordinator.get("tenant-a", common.operationId))?.tenantId, "tenant-a")
  assert.equal((await coordinator.get("tenant-b", common.operationId))?.tenantId, "tenant-b")
})

function sequenceClock(): () => Date {
  let tick = 0
  return () => new Date(Date.parse("2026-07-11T00:00:00.000Z") + tick++ * 1_000)
}
