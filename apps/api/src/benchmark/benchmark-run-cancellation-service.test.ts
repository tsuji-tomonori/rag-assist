import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type { AppUser } from "../auth.js"
import type { BenchmarkRun } from "../types.js"
import {
  BenchmarkRunCancellationService,
  type BenchmarkRunCancellationPorts
} from "./benchmark-run-cancellation-service.js"

test("BenchmarkRunCancellationService source depends on narrow command ports", () => {
  const source = readFileSync(fileURLToPath(new URL("./benchmark-run-cancellation-service.ts", import.meta.url)), "utf8")
  const facade = readFileSync(fileURLToPath(new URL("../rag/memorag-service.ts", import.meta.url)), "utf8")

  assert.doesNotMatch(source, /\bDependencies\b/)
  assert.doesNotMatch(source, /@aws-sdk\//)
  assert.doesNotMatch(source, /from "\.\.\/config\.js"/)
  assert.doesNotMatch(source, /authorization/)
  assert.doesNotMatch(facade, /\bStopExecutionCommand\b/)
})

test("BenchmarkRunCancellationService uses the authoritative tenant and hides missing or cross-tenant runs", async () => {
  const run = benchmarkRun("tenant-a", "tenant-a-only")
  const tenantCalls: AppUser[] = []
  const getCalls: Array<{ tenantId: string; runId: string }> = []
  let stopCount = 0
  let updateCount = 0
  let clockCount = 0
  const service = new BenchmarkRunCancellationService({
    benchmarkRunStore: {
      get: async (tenantId, runId) => {
        getCalls.push({ tenantId, runId })
        return tenantId === run.tenantId && runId === run.runId ? run : undefined
      },
      update: async () => {
        updateCount += 1
        return run
      }
    },
    tenantIdForActor: (actor) => {
      tenantCalls.push(actor)
      if (!actor.tenantId) throw new Error("authoritative tenant required")
      return actor.tenantId
    },
    stopExecution: async () => { stopCount += 1 },
    now: () => {
      clockCount += 1
      return "2026-07-17T00:01:00.000Z"
    }
  })

  assert.equal(await service.cancel(actor("tenant-b"), run.runId), undefined)
  assert.equal(await service.cancel(actor("tenant-a"), "missing"), undefined)
  assert.deepEqual(getCalls, [
    { tenantId: "tenant-b", runId: run.runId },
    { tenantId: "tenant-a", runId: "missing" }
  ])
  assert.deepEqual(tenantCalls.map((value) => value.tenantId), ["tenant-b", "tenant-a"])
  assert.equal(stopCount, 0)
  assert.equal(updateCount, 0)
  assert.equal(clockCount, 0)
})

test("BenchmarkRunCancellationService stops an active execution before the durable update", async () => {
  const order: string[] = []
  const updates: unknown[] = []
  const run = { ...benchmarkRun("tenant-a", "run-1"), executionArn: "arn:aws:states:ap-northeast-1:123:execution:benchmark:run-1" }
  const service = fixture(run, {
    stopExecution: async (input) => {
      order.push("stop")
      assert.deepEqual(input, {
        executionArn: run.executionArn,
        cause: "Cancelled from MemoRAG admin benchmark view"
      })
    },
    now: () => {
      order.push("clock")
      return "2026-07-17T00:02:00.000Z"
    },
    onUpdate: (tenantId, runId, input) => {
      order.push("update")
      updates.push({ tenantId, runId, input })
    }
  })

  const cancelled = await service.cancel(actor("tenant-a"), run.runId)

  assert.equal(cancelled?.status, "cancelled")
  assert.deepEqual(order, ["stop", "clock", "update"])
  assert.deepEqual(updates, [{
    tenantId: "tenant-a",
    runId: "run-1",
    input: { status: "cancelled", completedAt: "2026-07-17T00:02:00.000Z" }
  }])
})

test("BenchmarkRunCancellationService skips the external stop when no execution ARN exists", async () => {
  let stopCount = 0
  const run = benchmarkRun("tenant-a", "run-1")
  const service = fixture(run, {
    stopExecution: async () => { stopCount += 1 },
    now: () => "2026-07-17T00:03:00.000Z"
  })

  const cancelled = await service.cancel(actor("tenant-a"), run.runId)

  assert.equal(cancelled?.status, "cancelled")
  assert.equal(cancelled?.completedAt, "2026-07-17T00:03:00.000Z")
  assert.equal(stopCount, 0)
})

test("BenchmarkRunCancellationService leaves the run unchanged when execution stop fails", async () => {
  let updateCount = 0
  let clockCount = 0
  const run = { ...benchmarkRun("tenant-a", "run-1"), executionArn: "execution-1" }
  const service = fixture(run, {
    stopExecution: async () => { throw new Error("Step Functions stop failed") },
    now: () => {
      clockCount += 1
      return "2026-07-17T00:04:00.000Z"
    },
    onUpdate: () => { updateCount += 1 }
  })

  await assert.rejects(() => service.cancel(actor("tenant-a"), run.runId), /Step Functions stop failed/)
  assert.equal(updateCount, 0)
  assert.equal(clockCount, 0)
  assert.equal(run.status, "queued")
})

test("BenchmarkRunCancellationService preserves cancellation updates for terminal runs", async () => {
  for (const status of ["succeeded", "failed", "cancelled"] as const) {
    const run = { ...benchmarkRun("tenant-a", `run-${status}`), status }
    const service = fixture(run, { now: () => "2026-07-17T00:05:00.000Z" })

    const cancelled = await service.cancel(actor("tenant-a"), run.runId)

    assert.equal(cancelled?.status, "cancelled")
    assert.equal(cancelled?.completedAt, "2026-07-17T00:05:00.000Z")
  }
})

function fixture(
  run: BenchmarkRun,
  overrides: {
    stopExecution?: BenchmarkRunCancellationPorts["stopExecution"]
    now?: BenchmarkRunCancellationPorts["now"]
    onUpdate?: (tenantId: string, runId: string, input: Parameters<BenchmarkRunCancellationPorts["benchmarkRunStore"]["update"]>[2]) => void
  } = {}
): BenchmarkRunCancellationService {
  return new BenchmarkRunCancellationService({
    benchmarkRunStore: {
      get: async (tenantId, runId) => tenantId === run.tenantId && runId === run.runId ? run : undefined,
      update: async (tenantId, runId, input) => {
        overrides.onUpdate?.(tenantId, runId, input)
        return { ...run, ...input, updatedAt: input.updatedAt ?? run.updatedAt }
      }
    },
    tenantIdForActor: (value) => {
      if (!value.tenantId) throw new Error("authoritative tenant required")
      return value.tenantId
    },
    stopExecution: overrides.stopExecution ?? (async () => undefined),
    now: overrides.now ?? (() => "2026-07-17T00:01:00.000Z")
  })
}

function actor(tenantId: string): AppUser {
  return { userId: `user-${tenantId}`, cognitoGroups: [], accountStatus: "active", tenantId }
}

function benchmarkRun(tenantId: string, runId: string): BenchmarkRun {
  return {
    runId,
    status: "queued",
    mode: "agent",
    runner: "codebuild",
    suiteId: "standard-agent-v1",
    datasetS3Key: "datasets/agent/standard-v1.jsonl",
    createdBy: `user-${tenantId}`,
    tenantId,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}
