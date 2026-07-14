import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import type { AppEnv } from "../app-env.js"
import type { AppUser } from "../auth.js"
import type { Dependencies } from "../dependencies.js"
import { MemoRagService } from "../rag/memorag-service.js"
import {
  ResourceUnavailableError,
  publicResourceUnavailable
} from "../security/public-resource-response.js"
import type { BenchmarkRun } from "../types.js"
import { registerBenchmarkRoutes } from "./benchmark-routes.js"

test("benchmark service and routes resolve identical raw run IDs only inside the current actor tenant", async () => {
  const fixture = await createFixture()
  await fixture.store.create(benchmarkRun("tenant-a", "same-run", "suite-a"))
  await fixture.store.create(benchmarkRun("tenant-b", "same-run", "suite-b"))

  assert.equal((await fixture.service.getBenchmarkRun(actor("tenant-a"), "same-run"))?.suiteId, "suite-a")
  assert.equal((await fixture.service.getBenchmarkRun(actor("tenant-b"), "same-run"))?.suiteId, "suite-b")
  assert.deepEqual((await fixture.service.listBenchmarkRuns(actor("tenant-a"))).map((run) => run.tenantId), ["tenant-a"])
  assert.deepEqual((await fixture.service.listBenchmarkRuns(actor("tenant-b"))).map((run) => run.tenantId), ["tenant-b"])

  fixture.setActor(actor("tenant-a"))
  const tenantA = await fixture.app.request("/benchmark-runs/same-run")
  assert.equal(tenantA.status, 200)
  assert.equal(((await tenantA.json()) as BenchmarkRun).suiteId, "suite-a")

  fixture.setActor(actor("tenant-b"))
  const tenantB = await fixture.app.request("/benchmark-runs/same-run")
  assert.equal(tenantB.status, 200)
  assert.equal(((await tenantB.json()) as BenchmarkRun).suiteId, "suite-b")
})

test("benchmark get/cancel/download/log paths give cross-tenant and absent IDs the same non-enumeration response", async () => {
  const fixture = await createFixture()
  await fixture.store.create({
    ...benchmarkRun("tenant-a", "tenant-a-only", "suite-a"),
    codeBuildBuildId: "build-a",
    codeBuildLogGroupName: "/aws/codebuild/a",
    codeBuildLogStreamName: "stream-a",
    reportS3Key: "runs/tenant-a/report.md"
  })
  fixture.setActor(actor("tenant-b"))

  for (const request of [
    { path: "/benchmark-runs/tenant-a-only", init: undefined },
    { path: "/benchmark-runs/missing", init: undefined },
    { path: "/benchmark-runs/tenant-a-only/cancel", init: { method: "POST" } },
    { path: "/benchmark-runs/missing/cancel", init: { method: "POST" } },
    { path: "/benchmark-runs/tenant-a-only/download", init: jsonPost({ artifact: "report" }) },
    { path: "/benchmark-runs/missing/download", init: jsonPost({ artifact: "report" }) },
    { path: "/benchmark-runs/tenant-a-only/logs", init: undefined },
    { path: "/benchmark-runs/missing/logs", init: undefined }
  ]) {
    const response = await fixture.app.request(request.path, request.init)
    assert.equal(response.status, 404, request.path)
    assert.equal(response.headers.get("x-resource-response-profile"), "resource-non-enumeration-v1")
    assert.deepEqual(await response.json(), {
      error: "Resource unavailable",
      code: "RESOURCE_UNAVAILABLE",
      responseProfileVersion: "resource-non-enumeration-v1"
    })
  }

  assert.equal((await fixture.store.get("tenant-a", "tenant-a-only"))?.status, "queued")
  assert.equal(await fixture.service.getBenchmarkRun(actor("tenant-b"), "tenant-a-only"), undefined)
  assert.equal(await fixture.service.getBenchmarkRun(actor("tenant-b"), "missing"), undefined)
})

async function createFixture() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "benchmark-tenant-boundary-"))
  const store = new LocalBenchmarkRunStore(dataDir)
  const deps = {
    benchmarkRunStore: store,
    codeBuildLogReader: { getText: async () => "secret log" }
  } as unknown as Dependencies
  const service = new MemoRagService(deps)
  let currentActor = actor("tenant-a")
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => result.success
      ? undefined
      : c.json({ error: "Validation failed", details: result.error.flatten() }, 400)
  })
  app.use("*", async (c, next) => {
    c.set("user", currentActor)
    await next()
  })
  registerBenchmarkRoutes({ app, deps, service })
  app.onError((error, c) => {
    if (error instanceof ResourceUnavailableError) {
      const response = publicResourceUnavailable()
      for (const [name, value] of Object.entries(response.headers)) c.header(name, value)
      return c.json(response.body, response.status)
    }
    throw error
  })
  return { app, service, store, setActor: (next: AppUser) => { currentActor = next } }
}

function actor(tenantId: string): AppUser {
  return {
    userId: `${tenantId}-admin`,
    tenantId,
    accountStatus: "active",
    cognitoGroups: ["SYSTEM_ADMIN"]
  }
}

function benchmarkRun(tenantId: string, runId: string, suiteId: string): BenchmarkRun {
  return {
    runId,
    tenantId,
    status: "queued",
    mode: "agent",
    runner: "codebuild",
    suiteId,
    datasetS3Key: `${suiteId}.jsonl`,
    createdBy: `${tenantId}-admin`,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }
}
