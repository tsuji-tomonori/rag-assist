import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import type { BenchmarkRunStore } from "../adapters/benchmark-run-store.js"
import type { AppUser } from "../auth.js"
import { PermissionRevokedError, type WorkerAuthorizationBoundary } from "../security/current-worker-authorization.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { BenchmarkMode, BenchmarkRun, BenchmarkSuite } from "../types.js"
import {
  BenchmarkRunCreationService,
  type BenchmarkRunCreationPorts
} from "./benchmark-run-creation-service.js"

const sourceRoot = path.resolve(process.cwd(), "src")
const serviceSource = readFileSync(path.join(sourceRoot, "benchmark/benchmark-run-creation-service.ts"), "utf8")
const facadeSource = readFileSync(path.join(sourceRoot, "rag/memorag-service.ts"), "utf8")

const actor: AppUser = {
  userId: "actor-subject",
  email: "actor@example.com",
  cognitoGroups: ["BENCHMARK_OPERATOR"],
  accountStatus: "active",
  tenantId: "caller-tenant"
}

const suites: readonly BenchmarkSuite[] = [
  {
    suiteId: "agent-suite",
    label: "Agent suite",
    mode: "agent",
    datasetS3Key: "datasets/agent.jsonl",
    preset: "standard",
    defaultConcurrency: 2
  },
  {
    suiteId: "search-suite",
    label: "Search suite",
    mode: "search",
    datasetS3Key: "datasets/search.jsonl",
    preset: "smoke",
    defaultConcurrency: 1
  }
]

test("benchmark run creation is isolated behind narrow ports and the facade only delegates", () => {
  assert.doesNotMatch(serviceSource, /Dependencies|MemoRagService|config\.|@aws-sdk/)
  assert.match(serviceSource, /Pick<BenchmarkRunStore, "create" \| "update">/)
  assert.match(facadeSource, /private readonly benchmarkRunCreationService: BenchmarkRunCreationService/)
  assert.match(facadeSource, /return this\.benchmarkRunCreationService\.create\(user, input\)/)
  assert.doesNotMatch(facadeSource, /this\.deps\.benchmarkRunStore\.(?:create|update)/)

  const createIndex = serviceSource.indexOf("benchmarkRunStore.create(run)")
  const startIndex = serviceSource.indexOf('authorizeBoundary(run, "start")')
  const readIndex = serviceSource.indexOf('authorizeBoundary(run, "protected_read")')
  const effectIndex = serviceSource.indexOf('authorizeBoundary(run, "external_side_effect")')
  const executionIndex = serviceSource.indexOf("executionStarter.start(run, outputPrefix)")
  const commitIndex = serviceSource.indexOf('authorizeBoundary(run, "durable_commit")')
  const updateIndex = serviceSource.indexOf("benchmarkRunStore.update(run.tenantId, run.runId, { executionArn })")
  assert.equal([createIndex, startIndex, readIndex, effectIndex, executionIndex, commitIndex, updateIndex].every((index) => index >= 0), true)
  assert.deepEqual(
    [createIndex, startIndex, readIndex, effectIndex, executionIndex, commitIndex, updateIndex],
    [...[createIndex, startIndex, readIndex, effectIndex, executionIndex, commitIndex, updateIndex]].sort((left, right) => left - right)
  )
})

test("validation rejects unknown suites, mode mismatch, and unsupported runners before any port effect", async () => {
  const invalidInputs = [
    [{ suiteId: "unknown-suite" }, /Unknown benchmark suite/],
    [{ suiteId: "search-suite", mode: "agent" as const }, /does not support mode/],
    [{ runner: "lambda" as const }, /Only codebuild runner/]
  ] as const

  for (const [input, expected] of invalidInputs) {
    const fixture = createFixture()
    await assert.rejects(() => fixture.service.create(actor, input), expected)
    assert.deepEqual(fixture.events, [])
    assert.deepEqual(fixture.preparationCalls, {
      clock: 0,
      runId: 0,
      tenant: 0,
      securityRefs: 0,
      normalizeTopK: 0,
      normalizeMemoryTopK: 0,
      normalizeMinScore: 0
    })
  }
})

test("execution-disabled creation derives one canonical queued run from authoritative server inputs", async () => {
  const fixture = createFixture({ executionEnabled: false })

  const run = await fixture.service.create(actor, {})
  const prefix = `runs/${tenantPartitionId("authoritative-tenant")}/bench-fixed`

  assert.deepEqual(run, {
    runId: "bench-fixed",
    status: "queued",
    mode: "agent",
    runner: "codebuild",
    suiteId: "agent-suite",
    datasetS3Key: "datasets/agent.jsonl",
    createdBy: actor.userId,
    tenantId: "authoritative-tenant",
    securityResourceRefs: ["account:authoritative", "resource-group:authorized"],
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
    modelId: "server-model",
    embeddingModelId: "server-embedding",
    topK: 7,
    memoryTopK: 3,
    minScore: 0.25,
    concurrency: 2,
    thresholds: undefined,
    summaryS3Key: `${prefix}/summary.json`,
    reportS3Key: `${prefix}/report.md`,
    resultsS3Key: `${prefix}/results.jsonl`
  })
  assert.deepEqual(fixture.events, ["create"])
  assert.deepEqual(fixture.createdRuns, [run])
  assert.equal(fixture.started, undefined)
  assert.deepEqual(fixture.updates, [])
})

test("search creation forwards caller tuning only through server normalizers and suite policy", async () => {
  const fixture = createFixture({ executionEnabled: false })
  const thresholds = { answerableAccuracy: 0.9, retrievalRecallAt20: 0.8, p95LatencyMs: 5_000 }

  const run = await fixture.service.create(actor, {
    suiteId: "search-suite",
    mode: "search",
    modelId: "requested-model",
    embeddingModelId: "requested-embedding",
    topK: 999,
    memoryTopK: 9,
    minScore: 2,
    concurrency: 5,
    thresholds
  })

  assert.equal(run.mode, "search")
  assert.equal(run.modelId, "requested-model")
  assert.equal(run.embeddingModelId, "requested-embedding")
  assert.equal(run.topK, 999)
  assert.equal(run.memoryTopK, 9)
  assert.equal(run.minScore, 2)
  assert.equal(run.concurrency, 5)
  assert.equal(run.thresholds, thresholds)
  assert.deepEqual(fixture.normalizationInputs, {
    topK: [{ mode: "search", value: 999 }],
    memoryTopK: [9],
    minScore: [2]
  })
})

test("enabled creation preserves create, four authorization boundaries, external start, and durable commit order", async () => {
  const fixture = createFixture()

  const run = await fixture.service.create(actor, { suiteId: "search-suite" })

  assert.deepEqual(fixture.events, [
    "create",
    "authorize:start",
    "authorize:protected_read",
    "authorize:external_side_effect",
    "start-execution",
    "authorize:durable_commit",
    "update:execution"
  ])
  assert.equal(run.executionArn, "arn:aws:states:region:account:execution:benchmark:bench-fixed")
  assert.equal(fixture.started?.run.runId, "bench-fixed")
  assert.equal(
    fixture.started?.outputPrefix,
    `runs/${tenantPartitionId("authoritative-tenant")}/bench-fixed`
  )
})

test("permission revocation at every boundary stops later work and persists a non-disclosing failed run", async () => {
  const boundaries: readonly WorkerAuthorizationBoundary[] = [
    "start",
    "protected_read",
    "external_side_effect",
    "durable_commit"
  ]

  for (const boundary of boundaries) {
    const fixture = createFixture({ permissionRevokedAt: boundary })
    const failed = await fixture.service.create(actor, {})
    const boundaryIndex = boundaries.indexOf(boundary)
    const authorizedEvents = boundaries
      .slice(0, boundaryIndex + 1)
      .map((item) => `authorize:${item}`)
    if (boundary === "durable_commit") authorizedEvents.splice(boundaryIndex, 0, "start-execution")
    const expectedEvents = ["create", ...authorizedEvents, "update:failed"]

    assert.deepEqual(fixture.events, expectedEvents)
    assert.equal(failed.status, "failed")
    assert.equal(failed.error, "permission_revoked")
    assert.equal(failed.errorCode, "permission_revoked")
    assert.equal(failed.completedAt, "2026-07-17T10:00:01.000Z")
    assert.equal(failed.executionArn, undefined)
  }
})

test("initial durable create failure starts no authorization, execution, update, or compensation", async () => {
  const createError = new Error("create-store-unavailable")
  const fixture = createFixture({ createError })

  await assert.rejects(
    () => fixture.service.create(actor, {}),
    (error) => error === createError
  )
  assert.deepEqual(fixture.events, ["create"])
  assert.equal(fixture.started, undefined)
  assert.deepEqual(fixture.updates, [])
})

test("non-permission authorization and execution errors persist execution_error before rethrowing the original", async () => {
  const boundaryError = new Error("authorization-provider-unavailable")
  const boundaryFixture = createFixture({
    nonPermissionErrorAt: "protected_read",
    nonPermissionError: boundaryError
  })

  await assert.rejects(
    () => boundaryFixture.service.create(actor, {}),
    (error) => error === boundaryError
  )
  assert.deepEqual(boundaryFixture.events, [
    "create",
    "authorize:start",
    "authorize:protected_read",
    "update:failed"
  ])
  assert.equal(boundaryFixture.stored?.error, boundaryError.message)
  assert.equal(boundaryFixture.stored?.errorCode, "execution_error")

  const starterError = new Error("step-functions-unavailable")
  const starterFixture = createFixture({ starterError })
  await assert.rejects(
    () => starterFixture.service.create(actor, {}),
    (error) => error === starterError
  )
  assert.deepEqual(starterFixture.events, [
    "create",
    "authorize:start",
    "authorize:protected_read",
    "authorize:external_side_effect",
    "start-execution",
    "update:failed"
  ])
  assert.equal(starterFixture.stored?.error, starterError.message)
  assert.equal(starterFixture.stored?.errorCode, "execution_error")
})

test("execution ARN commit failure is compensated as failed and rethrows the original commit error", async () => {
  const commitError = new Error("run-commit-conflict")
  const fixture = createFixture({ commitError })

  await assert.rejects(
    () => fixture.service.create(actor, {}),
    (error) => error === commitError
  )
  assert.deepEqual(fixture.events, [
    "create",
    "authorize:start",
    "authorize:protected_read",
    "authorize:external_side_effect",
    "start-execution",
    "authorize:durable_commit",
    "update:execution",
    "update:failed"
  ])
  assert.equal(fixture.stored?.status, "failed")
  assert.equal(fixture.stored?.error, commitError.message)
  assert.equal(fixture.stored?.errorCode, "execution_error")
  assert.equal(fixture.stored?.executionArn, undefined)
})

test("compensation failure never returns a false success for permission or execution errors", async () => {
  const compensationError = new Error("failed-state-persistence-unavailable")
  const permissionFixture = createFixture({
    permissionRevokedAt: "external_side_effect",
    compensationError
  })
  await assert.rejects(
    () => permissionFixture.service.create(actor, {}),
    (error) => error === compensationError
  )

  const starterFixture = createFixture({
    starterError: new Error("step-functions-unavailable"),
    compensationError
  })
  await assert.rejects(
    () => starterFixture.service.create(actor, {}),
    (error) => error === compensationError
  )
  assert.equal(permissionFixture.events.at(-1), "update:failed")
  assert.equal(starterFixture.events.at(-1), "update:failed")
})

type FixtureOptions = {
  executionEnabled?: boolean
  permissionRevokedAt?: WorkerAuthorizationBoundary
  nonPermissionErrorAt?: WorkerAuthorizationBoundary
  nonPermissionError?: Error
  createError?: Error
  starterError?: Error
  commitError?: Error
  compensationError?: Error
}

function createFixture(options: FixtureOptions = {}) {
  const events: string[] = []
  const createdRuns: BenchmarkRun[] = []
  const updates: Array<Parameters<BenchmarkRunStore["update"]>> = []
  const normalizationInputs: {
    topK: Array<{ mode: BenchmarkMode; value: number | undefined }>
    memoryTopK: Array<number | undefined>
    minScore: Array<number | undefined>
  } = { topK: [], memoryTopK: [], minScore: [] }
  const preparationCalls = {
    clock: 0,
    runId: 0,
    tenant: 0,
    securityRefs: 0,
    normalizeTopK: 0,
    normalizeMemoryTopK: 0,
    normalizeMinScore: 0
  }
  let stored: BenchmarkRun | undefined
  let started: { run: BenchmarkRun; outputPrefix: string } | undefined

  const ports: BenchmarkRunCreationPorts = {
    benchmarkRunStore: {
      create: async (run) => {
        events.push("create")
        if (options.createError) throw options.createError
        stored = { ...run }
        createdRuns.push(run)
        return run
      },
      update: async (tenantId, runId, update) => {
        updates.push([tenantId, runId, update])
        if (update.executionArn) {
          events.push("update:execution")
          if (options.commitError) throw options.commitError
        } else {
          events.push("update:failed")
          if (options.compensationError) throw options.compensationError
        }
        assert.ok(stored)
        stored = { ...stored, ...update }
        return stored
      }
    },
    suites,
    defaults: {
      suiteId: "agent-suite",
      runner: "codebuild",
      modelId: "server-model",
      embeddingModelId: "server-embedding"
    },
    executionEnabled: options.executionEnabled ?? true,
    tenantIdForActor: () => {
      preparationCalls.tenant += 1
      return "authoritative-tenant"
    },
    securityResourceRefsForActor: async () => {
      preparationCalls.securityRefs += 1
      return ["account:authoritative", "resource-group:authorized"]
    },
    normalizeTopK: (mode, value) => {
      preparationCalls.normalizeTopK += 1
      normalizationInputs.topK.push({ mode, value })
      return value ?? (mode === "search" ? 17 : 7)
    },
    normalizeMemoryTopK: (value) => {
      preparationCalls.normalizeMemoryTopK += 1
      normalizationInputs.memoryTopK.push(value)
      return value ?? 3
    },
    normalizeMinScore: (value) => {
      preparationCalls.normalizeMinScore += 1
      normalizationInputs.minScore.push(value)
      return value ?? 0.25
    },
    authorizeBoundary: async (_run, boundary) => {
      events.push(`authorize:${boundary}`)
      if (options.permissionRevokedAt === boundary) {
        throw new PermissionRevokedError("role_permission_revoked")
      }
      if (options.nonPermissionErrorAt === boundary) {
        throw options.nonPermissionError ?? new Error("authorization-error")
      }
    },
    executionStarter: {
      start: async (run, outputPrefix) => {
        events.push("start-execution")
        started = { run, outputPrefix }
        if (options.starterError) throw options.starterError
        return "arn:aws:states:region:account:execution:benchmark:bench-fixed"
      }
    },
    now: () => {
      const call = preparationCalls.clock
      preparationCalls.clock += 1
      return call === 0 ? "2026-07-17T10:00:00.000Z" : "2026-07-17T10:00:01.000Z"
    },
    createRunId: () => {
      preparationCalls.runId += 1
      return "bench-fixed"
    }
  }

  return {
    service: new BenchmarkRunCreationService(ports),
    events,
    createdRuns,
    updates,
    normalizationInputs,
    preparationCalls,
    get stored() {
      return stored
    },
    get started() {
      return started
    }
  }
}
