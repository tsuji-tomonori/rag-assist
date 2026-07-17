import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  PermissionRevokedError,
  type WorkerAuthorizationBoundary
} from "../security/current-worker-authorization.js"
import type { BenchmarkRun } from "../types.js"
import {
  BenchmarkRunReauthorizationService,
  type BenchmarkRunReauthorizationPorts
} from "./benchmark-run-reauthorization-service.js"

const continuingBoundaries = [
  "protected_read",
  "external_side_effect",
  "durable_commit"
] as const satisfies readonly WorkerAuthorizationBoundary[]

test("BenchmarkRunReauthorizationService source depends on narrow state-transition ports", () => {
  const source = readFileSync(fileURLToPath(new URL("./benchmark-run-reauthorization-service.ts", import.meta.url)), "utf8")
  const facade = readFileSync(fileURLToPath(new URL("../rag/memorag-service.ts", import.meta.url)), "utf8")

  assert.doesNotMatch(source, /\bDependencies\b|config|objectStore|VerifiedIdentityProvider|MemoRagService/)
  assert.match(facade, /private readonly benchmarkRunReauthorizationService: BenchmarkRunReauthorizationService/)
  assert.match(facade, /return this\.benchmarkRunReauthorizationService\.reauthorize\(tenantId, runId, boundary\)/)
  assert.doesNotMatch(facade, /if \(!run\) throw new PermissionRevokedError\("benchmark_run_unavailable"\)/)
})

test("reauthorize preserves non-enumeration for missing and cross-tenant run lookups", async () => {
  const run = benchmarkRun("tenant-a", "run-a", "running")
  const getCalls: Array<{ tenantId: string; runId: string }> = []
  const service = fixture(run, {
    get: async (tenantId, runId) => {
      getCalls.push({ tenantId, runId })
      return tenantId === run.tenantId && runId === run.runId ? run : undefined
    }
  })

  for (const [tenantId, runId] of [["tenant-b", run.runId], [run.tenantId, "missing"]] as const) {
    await assert.rejects(
      () => service.reauthorize(tenantId, runId, "durable_commit"),
      (error) => error instanceof PermissionRevokedError
        && error.message === "permission_revoked"
        && error.denialReason === "benchmark_run_unavailable"
    )
  }
  assert.deepEqual(getCalls, [
    { tenantId: "tenant-b", runId: run.runId },
    { tenantId: run.tenantId, runId: "missing" }
  ])
})

test("reauthorize accepts queued start and running continuation boundaries", async () => {
  const calls: Array<{ run: BenchmarkRun; boundary: WorkerAuthorizationBoundary }> = []
  const queued = benchmarkRun("tenant-a", "queued-run", "queued")
  const queuedService = fixture(queued, {
    authorizeBoundary: async (run, boundary) => { calls.push({ run, boundary }) }
  })
  assert.strictEqual(await queuedService.reauthorize(queued.tenantId, queued.runId, "start"), queued)

  const running = benchmarkRun("tenant-a", "running-run", "running")
  const runningService = fixture(running, {
    authorizeBoundary: async (run, boundary) => { calls.push({ run, boundary }) }
  })
  for (const boundary of continuingBoundaries) {
    assert.strictEqual(await runningService.reauthorize(running.tenantId, running.runId, boundary), running)
  }
  assert.deepEqual(calls, [
    { run: queued, boundary: "start" },
    ...continuingBoundaries.map((boundary) => ({ run: running, boundary }))
  ])
})

test("reauthorize rejects boundary and status mismatches before authorization", async () => {
  let authorizeCount = 0
  let updateCount = 0
  let cleanupCount = 0
  let clockCount = 0
  const cases: Array<{ status: BenchmarkRun["status"]; boundary: WorkerAuthorizationBoundary }> = [
    { status: "running", boundary: "start" },
    { status: "queued", boundary: "protected_read" },
    { status: "succeeded", boundary: "durable_commit" },
    { status: "cancelled", boundary: "external_side_effect" }
  ]

  for (const [index, value] of cases.entries()) {
    const run = benchmarkRun("tenant-a", `inactive-${index}`, value.status)
    const service = fixture(run, {
      authorizeBoundary: async () => { authorizeCount += 1 },
      update: async () => { updateCount += 1; return run },
      reconcileRevokedArtifacts: async () => { cleanupCount += 1 },
      now: () => { clockCount += 1; return "2026-07-17T09:01:00.000Z" }
    })
    await assert.rejects(
      () => service.reauthorize(run.tenantId, run.runId, value.boundary),
      /benchmark_run_not_active/
    )
  }
  assert.equal(authorizeCount, 0)
  assert.equal(updateCount, 0)
  assert.equal(cleanupCount, 0)
  assert.equal(clockCount, 0)
})

test("reauthorize rejects an already revoked run without repeating state or cleanup", async () => {
  const run = {
    ...benchmarkRun("tenant-a", "revoked-run", "failed"),
    error: "permission_revoked",
    errorCode: "permission_revoked" as const
  }
  let sideEffectCount = 0
  const service = fixture(run, {
    authorizeBoundary: async () => { sideEffectCount += 1 },
    update: async () => { sideEffectCount += 1; return run },
    reconcileRevokedArtifacts: async () => { sideEffectCount += 1 },
    now: () => { sideEffectCount += 1; return "2026-07-17T09:02:00.000Z" }
  })

  await assert.rejects(
    () => service.reauthorize(run.tenantId, run.runId, "durable_commit"),
    (error) => error instanceof PermissionRevokedError
      && error.denialReason === "benchmark_run_authorization_already_revoked"
  )
  assert.equal(sideEffectCount, 0)
})

test("reauthorize persists one-clock revocation then cleans the updated run and rethrows the original error", async () => {
  const run = benchmarkRun("tenant-a", "run-1", "running")
  const revoked = new PermissionRevokedError("role_permission_revoked")
  const order: string[] = []
  const updates: unknown[] = []
  let clockCount = 0
  const service = fixture(run, {
    authorizeBoundary: async (authorizedRun, boundary) => {
      order.push("authorize")
      assert.strictEqual(authorizedRun, run)
      assert.equal(boundary, "durable_commit")
      throw revoked
    },
    now: () => {
      order.push("clock")
      clockCount += 1
      return "2026-07-17T09:03:00.000Z"
    },
    update: async (tenantId, runId, input) => {
      order.push("update")
      updates.push({ tenantId, runId, input })
      return { ...run, ...input }
    },
    reconcileRevokedArtifacts: async (failed, boundary, error) => {
      order.push("cleanup")
      assert.equal(failed.status, "failed")
      assert.equal(failed.updatedAt, "2026-07-17T09:03:00.000Z")
      assert.equal(boundary, "durable_commit")
      assert.strictEqual(error, revoked)
    }
  })

  await assert.rejects(
    () => service.reauthorize(run.tenantId, run.runId, "durable_commit"),
    (error) => error === revoked
  )
  assert.equal(clockCount, 1)
  assert.deepEqual(order, ["authorize", "clock", "update", "cleanup"])
  assert.deepEqual(updates, [{
    tenantId: run.tenantId,
    runId: run.runId,
    input: {
      status: "failed",
      error: "permission_revoked",
      errorCode: "permission_revoked",
      completedAt: "2026-07-17T09:03:00.000Z",
      updatedAt: "2026-07-17T09:03:00.000Z"
    }
  }])
})

test("reauthorize propagates non-permission authorization failures without state changes", async () => {
  const run = benchmarkRun("tenant-a", "run-1", "running")
  const failure = new Error("identity provider unavailable")
  let updateCount = 0
  let cleanupCount = 0
  let clockCount = 0
  const service = fixture(run, {
    authorizeBoundary: async () => { throw failure },
    update: async () => { updateCount += 1; return run },
    reconcileRevokedArtifacts: async () => { cleanupCount += 1 },
    now: () => { clockCount += 1; return "2026-07-17T09:04:00.000Z" }
  })

  await assert.rejects(
    () => service.reauthorize(run.tenantId, run.runId, "protected_read"),
    (error) => error === failure
  )
  assert.equal(updateCount, 0)
  assert.equal(cleanupCount, 0)
  assert.equal(clockCount, 0)
})

test("reauthorize does not start cleanup when the revoked state update fails", async () => {
  const run = benchmarkRun("tenant-a", "run-1", "running")
  const updateFailure = new Error("run store update failed")
  let cleanupCount = 0
  const service = fixture(run, {
    authorizeBoundary: async () => { throw new PermissionRevokedError("account_inactive") },
    update: async () => { throw updateFailure },
    reconcileRevokedArtifacts: async () => { cleanupCount += 1 }
  })

  await assert.rejects(
    () => service.reauthorize(run.tenantId, run.runId, "durable_commit"),
    (error) => error === updateFailure
  )
  assert.equal(cleanupCount, 0)
})

type FixtureOverrides = {
  get?: BenchmarkRunReauthorizationPorts["benchmarkRunStore"]["get"]
  update?: BenchmarkRunReauthorizationPorts["benchmarkRunStore"]["update"]
  authorizeBoundary?: BenchmarkRunReauthorizationPorts["authorizeBoundary"]
  reconcileRevokedArtifacts?: BenchmarkRunReauthorizationPorts["reconcileRevokedArtifacts"]
  now?: BenchmarkRunReauthorizationPorts["now"]
}

function fixture(run: BenchmarkRun, overrides: FixtureOverrides = {}): BenchmarkRunReauthorizationService {
  return new BenchmarkRunReauthorizationService({
    benchmarkRunStore: {
      get: overrides.get ?? (async (tenantId, runId) => tenantId === run.tenantId && runId === run.runId ? run : undefined),
      update: overrides.update ?? (async (_tenantId, _runId, input) => ({ ...run, ...input }))
    },
    authorizeBoundary: overrides.authorizeBoundary ?? (async () => undefined),
    reconcileRevokedArtifacts: overrides.reconcileRevokedArtifacts ?? (async () => undefined),
    now: overrides.now ?? (() => "2026-07-17T09:00:00.000Z")
  })
}

function benchmarkRun(tenantId: string, runId: string, status: BenchmarkRun["status"]): BenchmarkRun {
  return {
    runId,
    status,
    mode: "agent",
    runner: "codebuild",
    suiteId: "standard-agent-v1",
    datasetS3Key: "datasets/agent/standard-v1.jsonl",
    createdBy: `user-${tenantId}`,
    tenantId,
    createdAt: "2026-07-17T09:00:00.000Z",
    updatedAt: "2026-07-17T09:00:00.000Z"
  }
}
