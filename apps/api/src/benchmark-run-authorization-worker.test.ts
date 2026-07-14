import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalBenchmarkRunStore } from "./adapters/local-benchmark-run-store.js"
import { LocalObjectStore } from "./adapters/local-object-store.js"
import type { ObjectStore } from "./adapters/object-store.js"
import type { VerifiedIdentityProvider } from "./adapters/verified-identity-provider.js"
import { createBenchmarkRunAuthorizationHandler } from "./benchmark-run-authorization-worker.js"
import type { Dependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { PermissionRevokedError, type WorkerAuthorizationBoundary } from "./security/current-worker-authorization.js"
import { tenantPartitionId } from "./security/tenant-partition.js"
import type { BenchmarkRun } from "./types.js"

const authorizationBoundaries = [
  "start",
  "protected_read",
  "external_side_effect",
  "durable_commit"
] as const satisfies readonly WorkerAuthorizationBoundary[]

test("benchmark authorization worker accepts and forwards every execution boundary", async () => {
  const forwarded: WorkerAuthorizationBoundary[] = []
  const run = benchmarkRun("queued")
  const handler = createBenchmarkRunAuthorizationHandler({
    reauthorizeBenchmarkRunExecution: async (tenantId, runId, boundary) => {
      assert.equal(tenantId, run.tenantId)
      assert.equal(runId, run.runId)
      forwarded.push(boundary)
      return run
    }
  })

  for (const boundary of authorizationBoundaries) {
    assert.deepEqual(await handler({ tenantId: run.tenantId, runId: run.runId, boundary }), {
      tenantId: run.tenantId,
      runId: run.runId,
      status: run.status,
      boundary,
      authorized: true
    })
  }
  assert.deepEqual(forwarded, authorizationBoundaries)
  await assert.rejects(
    () => handler({ tenantId: run.tenantId, runId: run.runId, boundary: "read" }),
    /authorization boundary is invalid/
  )
})

test("benchmark execution reauthorizes the current identity at all four boundaries", async () => {
  const fixture = await createFixture("active")
  const run = benchmarkRun("queued")
  await fixture.runStore.create(run)

  await fixture.service.reauthorizeBenchmarkRunExecution(run.tenantId, run.runId, "start")
  await fixture.runStore.update(run.tenantId, run.runId, { status: "running", startedAt: run.updatedAt })
  for (const boundary of authorizationBoundaries.slice(1)) {
    await fixture.service.reauthorizeBenchmarkRunExecution(run.tenantId, run.runId, boundary)
  }

  assert.equal(fixture.identityReads(), 4)
  assert.equal((await fixture.runStore.get(run.tenantId, run.runId))?.status, "running")
})

test("benchmark authorization does not disclose whether another tenant's run exists", async () => {
  const fixture = await createFixture("active")
  const run = benchmarkRun("running")
  await fixture.runStore.create(run)

  for (const [tenantId, runId] of [["tenant-b", run.runId], [run.tenantId, "unknown-run"]] as const) {
    await assert.rejects(
      () => fixture.service.reauthorizeBenchmarkRunExecution(tenantId, runId, "durable_commit"),
      (error) => error instanceof PermissionRevokedError && error.message === "permission_revoked"
    )
  }
})

test("durable-commit revocation deletes only the run's tenant-partitioned evaluation artifacts", async () => {
  const fixture = await createFixture("suspended")
  const run = benchmarkRun("running")
  await fixture.runStore.create(run)
  const ownKeys = benchmarkArtifactKeys(run.tenantId, run.runId)
  await Promise.all(ownKeys.map((key) => fixture.benchmarkStore.putText(key, "sensitive benchmark output")))
  const otherTenantKey = benchmarkArtifactKeys("tenant-b", run.runId)[0]!
  await fixture.benchmarkStore.putText(otherTenantKey, "other tenant output")

  await assert.rejects(
    () => fixture.service.reauthorizeBenchmarkRunExecution(run.tenantId, run.runId, "durable_commit"),
    (error) => error instanceof PermissionRevokedError && error.message === "permission_revoked"
  )

  const failed = await fixture.runStore.get(run.tenantId, run.runId)
  assert.equal(failed?.status, "failed")
  assert.equal(failed?.error, "permission_revoked")
  assert.equal(failed?.errorCode, "permission_revoked")
  assert.deepEqual(await fixture.benchmarkStore.listKeys(benchmarkArtifactPrefix(run.tenantId, run.runId)), [])
  assert.equal(await fixture.benchmarkStore.getText(otherTenantKey), "other tenant output")

  const manifest = await cleanupManifest(fixture.docsStore)
  assert.equal(manifest.resourceType, "benchmark_run")
  assert.equal(manifest.resourceId, run.runId)
  assert.equal(manifest.tenantId, run.tenantId)
  assert.equal(manifest.status, "completed")
  assert.deepEqual(
    manifest.targets
      .map((target) => ({ scope: target.scope, reference: target.reference, status: target.status }))
      .sort((left, right) => left.reference.localeCompare(right.reference)),
    ownKeys
      .map((reference) => ({ scope: "evaluation_artifact", reference, status: "cleaned" }))
      .sort((left, right) => left.reference.localeCompare(right.reference))
  )
})

test("benchmark artifact delete failure leaves durable reconciliation intent and cannot commit success", async () => {
  const fixture = await createFixture("suspended", true)
  const run = benchmarkRun("running")
  await fixture.runStore.create(run)
  const ownKeys = benchmarkArtifactKeys(run.tenantId, run.runId)
  await Promise.all(ownKeys.map((key) => fixture.benchmarkStore.putText(key, "sensitive benchmark output")))

  await assert.rejects(
    () => fixture.service.reauthorizeBenchmarkRunExecution(run.tenantId, run.runId, "durable_commit"),
    PermissionRevokedError
  )

  assert.equal((await fixture.runStore.get(run.tenantId, run.runId))?.status, "failed")
  assert.deepEqual(
    (await fixture.benchmarkStore.listKeys(benchmarkArtifactPrefix(run.tenantId, run.runId))).sort(),
    ownKeys.sort()
  )
  const manifest = await cleanupManifest(fixture.docsStore)
  assert.equal(manifest.status, "reconciliation_required")
  assert.ok(manifest.lastFailureCode?.includes("evaluation_artifact:cleanup"))
  assert.equal(manifest.targets.length, 4)
  assert.ok(manifest.targets.every((target) => target.scope === "evaluation_artifact" && target.status === "pending"))
})

async function createFixture(accountStatus: "active" | "suspended", failDeletes = false) {
  const root = await mkdtemp(path.join(tmpdir(), "benchmark-authorization-"))
  const docsStore = new LocalObjectStore(path.join(root, "docs"))
  const benchmarkStore = new LocalObjectStore(path.join(root, "benchmark"))
  const runStore = new LocalBenchmarkRunStore(path.join(root, "runs"))
  let identityReads = 0
  const verifiedIdentityProvider: VerifiedIdentityProvider = {
    getCurrentIdentity: async () => undefined,
    getCurrentIdentityBySubject: async (subject) => {
      identityReads += 1
      return {
        username: "benchmark-operator",
        userId: subject,
        tenantId: "tenant-a",
        accountStatus,
        cognitoGroups: ["BENCHMARK_OPERATOR"]
      }
    }
  }
  const artifactStore = failDeletes ? failingDeleteStore(benchmarkStore) : benchmarkStore
  const deps = {
    objectStore: docsStore,
    benchmarkArtifactStore: artifactStore,
    benchmarkRunStore: runStore,
    verifiedIdentityProvider
  } as unknown as Dependencies
  return {
    service: new MemoRagService(deps),
    docsStore,
    benchmarkStore,
    runStore,
    identityReads: () => identityReads
  }
}

function failingDeleteStore(delegate: ObjectStore): ObjectStore {
  return {
    putText: (...args) => delegate.putText(...args),
    putTextIfVersion: (...args) => delegate.putTextIfVersion(...args),
    putBytes: (...args) => delegate.putBytes(...args),
    getText: (...args) => delegate.getText(...args),
    getTextWithVersion: (...args) => delegate.getTextWithVersion(...args),
    getBytes: (...args) => delegate.getBytes(...args),
    getObjectSize: (...args) => delegate.getObjectSize(...args),
    deleteObject: async () => {
      throw new Error("simulated benchmark artifact delete outage")
    },
    listKeys: (...args) => delegate.listKeys(...args)
  }
}

function benchmarkRun(status: BenchmarkRun["status"]): BenchmarkRun {
  const now = "2026-07-11T12:00:00.000Z"
  return {
    runId: "bench_20260711T120000Z_12345678",
    status,
    mode: "search",
    runner: "codebuild",
    suiteId: "search-smoke-v1",
    datasetS3Key: "datasets/search/smoke-v1.jsonl",
    createdBy: "benchmark-user",
    tenantId: "tenant-a",
    createdAt: now,
    updatedAt: now,
    ...(status === "running" ? { startedAt: now } : {})
  }
}

function benchmarkArtifactPrefix(tenantId: string, runId: string): string {
  return `runs/${tenantPartitionId(tenantId)}/${runId}/`
}

function benchmarkArtifactKeys(tenantId: string, runId: string): string[] {
  const prefix = benchmarkArtifactPrefix(tenantId, runId)
  return ["results.jsonl", "summary.json", "report.md", "release-audit.json"].map((fileName) => `${prefix}${fileName}`)
}

async function cleanupManifest(store: ObjectStore): Promise<{
  resourceType: string
  resourceId: string
  tenantId: string
  status: string
  lastFailureCode?: string
  targets: Array<{ scope: string; reference: string; status: string }>
}> {
  const keys = await store.listKeys("security/revocation-cleanup/")
  assert.equal(keys.length, 1)
  return JSON.parse(await store.getText(keys[0]!))
}
