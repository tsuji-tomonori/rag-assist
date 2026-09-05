import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { buildRevocationCleanupDenyProbe } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { BenchmarkRun } from "../types.js"
import {
  BenchmarkArtifactRevocationCleanupDriverFactory,
  type BenchmarkArtifactRevocationCleanupPorts
} from "./benchmark-artifact-revocation-cleanup-driver.js"

test("cleanup driver source uses narrow ports while facade preserves register-before-reconcile compensation", () => {
  const source = readFileSync(fileURLToPath(new URL("./benchmark-artifact-revocation-cleanup-driver.ts", import.meta.url)), "utf8")
  const facade = readFileSync(fileURLToPath(new URL("../rag/memorag-service.ts", import.meta.url)), "utf8")

  assert.doesNotMatch(source, /\bDependencies\b|\bconfig\b|\bObjectStore\b|VerifiedIdentityProvider|MemoRagService|ObjectStoreRevocationCleanupCoordinator/)
  assert.match(facade, /private readonly benchmarkArtifactRevocationCleanupDriverFactory: BenchmarkArtifactRevocationCleanupDriverFactory/)
  assert.match(facade, /this\.benchmarkArtifactRevocationCleanupDriverFactory\.create\(run\)/)
  assert.doesNotMatch(facade, /private benchmarkArtifactCleanupDriver/)
  const registration = facade.indexOf("await coordinator.register({", facade.indexOf("private async reconcileRevokedBenchmarkArtifacts"))
  const reconciliation = facade.indexOf("await coordinator.reconcile(", registration)
  const retainedIntent = facade.indexOf(").catch(() => undefined)", reconciliation)
  assert.ok(registration >= 0 && registration < reconciliation && reconciliation < retainedIntent)
})

test("known targets use only the authoritative tenant/run partition and canonical evaluation artifacts", () => {
  const run = benchmarkRun()
  const factory = fixture(run)
  const prefix = `runs/${tenantPartitionId(run.tenantId)}/${run.runId}/`

  assert.deepEqual(factory.knownTargets(run), [
    "results.jsonl",
    "summary.json",
    "report.md",
    "release-audit.json"
  ].map((fileName) => ({ scope: "evaluation_artifact", reference: `${prefix}${fileName}` })))
  assert.ok(factory.knownTargets(run).every((target) => !target.reference.includes(tenantPartitionId("tenant-b"))))
})

test("authoritative deny probe uses exact tenant/run lookup and the full failed-revoked-version predicate", async () => {
  const run = benchmarkRun()
  const getCalls: Array<{ tenantId: string; runId: string }> = []
  let current: BenchmarkRun | undefined = run
  const factory = fixture(run, {
    get: async (tenantId, runId) => {
      getCalls.push({ tenantId, runId })
      return current
    }
  })
  const driver = factory.create(run)
  const manifest = denyManifest(run)

  assert.equal(await driver.isAuthoritativeDenyCurrent(manifest), true)
  for (const value of [
    undefined,
    { ...run, status: "running" as const },
    { ...run, errorCode: "execution_error" as const },
    { ...run, updatedAt: "2026-07-17T10:01:00.000Z" }
  ]) {
    current = value
    assert.equal(await driver.isAuthoritativeDenyCurrent(manifest), false)
  }
  assert.deepEqual(getCalls, Array.from({ length: 5 }, () => ({ tenantId: run.tenantId, runId: run.runId })))
})

test("authoritative deny store failures propagate and never touch artifact side effects", async () => {
  const run = benchmarkRun()
  const failure = new Error("run store unavailable")
  let artifactCalls = 0
  const factory = fixture(run, {
    get: async () => { throw failure },
    deleteObject: async () => { artifactCalls += 1 },
    listKeys: async () => { artifactCalls += 1; return [] }
  })
  const driver = factory.create(run)

  await assert.rejects(() => driver.isAuthoritativeDenyCurrent(denyManifest(run)), (error) => error === failure)
  assert.equal(artifactCalls, 0)
})

test("discover exposes known targets only for the evaluation artifact scope", async () => {
  const run = benchmarkRun()
  const factory = fixture(run)
  const targets = factory.knownTargets(run)
  const driver = factory.create(run)
  const manifest = denyManifest(run)

  assert.deepEqual(await driver.discover(manifest, "evaluation_artifact"), targets)
  for (const scope of ["source", "chunk", "memory", "queued_run"] as const) {
    assert.deepEqual(await driver.discover(manifest, scope), [])
  }
})

test("cleanup fails closed for missing store, wrong scope, and references outside the known run partition", async () => {
  const run = benchmarkRun()
  const noStoreFactory = fixture(run, { artifactStore: undefined })
  const manifest = denyManifest(run)
  await assert.rejects(
    () => noStoreFactory.create(run).cleanup(manifest, manifest.targets[0]!),
    /cleanup store is unavailable/
  )

  const deleted: string[] = []
  const factory = fixture(run, { deleteObject: async (key) => { deleted.push(key) } })
  const driver = factory.create(run)
  await assert.rejects(
    () => driver.cleanup(manifest, { ...manifest.targets[0]!, scope: "source" }),
    /escaped its run partition/
  )
  await assert.rejects(
    () => driver.cleanup(manifest, { ...manifest.targets[0]!, reference: `runs/${tenantPartitionId("tenant-b")}/${run.runId}/summary.json` }),
    /escaped its run partition/
  )
  assert.deepEqual(deleted, [])
})

test("cleanup deletes one exact allowed target and propagates the adapter failure identity", async () => {
  const run = benchmarkRun()
  const deleted: string[] = []
  const failure = new Error("artifact delete unavailable")
  let shouldFail = false
  const factory = fixture(run, {
    deleteObject: async (key) => {
      deleted.push(key)
      if (shouldFail) throw failure
    }
  })
  const targets = factory.knownTargets(run)
  const driver = factory.create(run)
  const manifest = denyManifest(run)
  const firstTarget = manifest.targets.find((target) => target.reference === targets[0]!.reference)
  const secondTarget = manifest.targets.find((target) => target.reference === targets[1]!.reference)
  assert.ok(firstTarget && secondTarget)

  await driver.cleanup(manifest, firstTarget)
  shouldFail = true
  await assert.rejects(() => driver.cleanup(manifest, secondTarget), (error) => error === failure)
  assert.deepEqual(deleted, [targets[0]!.reference, targets[1]!.reference])
})

test("residual verification lists the exact run prefix and returns only existing known targets", async () => {
  const run = benchmarkRun()
  const listed: string[] = []
  const factory = fixture(run, {
    listKeys: async (prefix) => {
      listed.push(prefix)
      const known = factory.knownTargets(run)
      return [
        known[1]!.reference,
        `${prefix}unexpected.bin`,
        `runs/${tenantPartitionId("tenant-b")}/${run.runId}/summary.json`
      ]
    }
  })
  const targets = factory.knownTargets(run)
  const driver = factory.create(run)
  const manifest = denyManifest(run)

  assert.deepEqual(await driver.findResiduals(manifest, "source"), [])
  assert.deepEqual(await driver.findResiduals(manifest, "evaluation_artifact"), [targets[1]])
  assert.deepEqual(listed, [`runs/${tenantPartitionId(run.tenantId)}/${run.runId}/`])

  const noStoreFactory = fixture(run, { artifactStore: undefined })
  await assert.rejects(
    () => noStoreFactory.create(run).findResiduals(manifest, "evaluation_artifact"),
    /cleanup store is unavailable/
  )
})

type FixtureOverrides = {
  get?: BenchmarkArtifactRevocationCleanupPorts["benchmarkRunStore"]["get"]
  deleteObject?: NonNullable<BenchmarkArtifactRevocationCleanupPorts["artifactStore"]>["deleteObject"]
  listKeys?: NonNullable<BenchmarkArtifactRevocationCleanupPorts["artifactStore"]>["listKeys"]
  artifactStore?: undefined
}

function fixture(run: BenchmarkRun, overrides: FixtureOverrides = {}): BenchmarkArtifactRevocationCleanupDriverFactory {
  const artifactStore = Object.hasOwn(overrides, "artifactStore")
    ? overrides.artifactStore
    : {
        deleteObject: overrides.deleteObject ?? (async () => undefined),
        listKeys: overrides.listKeys ?? (async () => [])
      }
  return new BenchmarkArtifactRevocationCleanupDriverFactory({
    benchmarkRunStore: {
      get: overrides.get ?? (async (tenantId, runId) => tenantId === run.tenantId && runId === run.runId ? run : undefined)
    },
    artifactStore
  })
}

function benchmarkRun(): BenchmarkRun {
  return {
    runId: "bench_20260717T100000Z_12345678",
    status: "failed",
    mode: "agent",
    runner: "codebuild",
    suiteId: "standard-agent-v1",
    datasetS3Key: "datasets/agent/standard-v1.jsonl",
    createdBy: "benchmark-user",
    tenantId: "tenant-a",
    error: "permission_revoked",
    errorCode: "permission_revoked",
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
    completedAt: "2026-07-17T10:00:00.000Z"
  }
}

function denyManifest(run: BenchmarkRun) {
  return buildRevocationCleanupDenyProbe({
    operationId: `benchmark-artifact-revoke:${run.runId}`,
    tenantId: run.tenantId,
    resourceType: "benchmark_run",
    resourceId: run.runId,
    trigger: "role_revoked",
    authoritativeDenyVersion: run.updatedAt,
    authoritativeDenyConfirmedAt: run.completedAt ?? run.updatedAt,
    knownTargets: fixture(run).knownTargets(run)
  })
}
