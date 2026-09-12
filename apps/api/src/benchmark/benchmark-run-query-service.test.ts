import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type { AppUser } from "../auth.js"
import type { BenchmarkRun } from "../types.js"
import {
  BenchmarkRunQueryService,
  type BenchmarkRunQueryPorts
} from "./benchmark-run-query-service.js"

test("BenchmarkRunQueryService source depends on read-only narrow ports", () => {
  const source = readFileSync(fileURLToPath(new URL("./benchmark-run-query-service.ts", import.meta.url)), "utf8")

  assert.doesNotMatch(source, /\bDependencies\b/)
  assert.doesNotMatch(source, /@aws-sdk\//)
  assert.doesNotMatch(source, /from "\.\.\/config\.js"/)
  assert.doesNotMatch(source, /authorization/)
  assert.doesNotMatch(source, /\b(create|update)\(/)
})

test("BenchmarkRunQueryService uses the authoritative actor tenant for list and get", async () => {
  const runs = [benchmarkRun("tenant-a", "same-run"), benchmarkRun("tenant-b", "same-run")]
  const tenantCalls: AppUser[] = []
  const listCalls: string[] = []
  const getCalls: Array<{ tenantId: string; runId: string }> = []
  const service = new BenchmarkRunQueryService({
    benchmarkRunStore: {
      list: async (tenantId) => {
        listCalls.push(tenantId)
        return runs.filter((run) => run.tenantId === tenantId)
      },
      get: async (tenantId, runId) => {
        getCalls.push({ tenantId, runId })
        return runs.find((run) => run.tenantId === tenantId && run.runId === runId)
      }
    },
    tenantIdForActor: (actor) => {
      tenantCalls.push(actor)
      if (!actor.tenantId) throw new Error("authoritative tenant required")
      return actor.tenantId
    }
  })

  assert.deepEqual(await service.list(actor("tenant-a")), [runs[0]])
  assert.equal(await service.get(actor("tenant-b"), "same-run"), runs[1])
  assert.equal(await service.get(actor("tenant-b"), "tenant-a-only"), undefined)
  assert.deepEqual(listCalls, ["tenant-a"])
  assert.deepEqual(getCalls, [
    { tenantId: "tenant-b", runId: "same-run" },
    { tenantId: "tenant-b", runId: "tenant-a-only" }
  ])
  assert.deepEqual(tenantCalls.map((value) => value.tenantId), ["tenant-a", "tenant-b", "tenant-b"])
})

test("BenchmarkRunQueryService does not read logs for a missing or cross-tenant run", async () => {
  let logReadCount = 0
  const service = fixture({
    runs: [benchmarkRun("tenant-a", "tenant-a-only")],
    getText: async () => {
      logReadCount += 1
      return "secret log"
    }
  })

  assert.equal(await service.getCodeBuildLogText(actor("tenant-b"), "tenant-a-only"), undefined)
  assert.equal(await service.getCodeBuildLogText(actor("tenant-a"), "missing"), undefined)
  assert.equal(logReadCount, 0)
})

test("BenchmarkRunQueryService preserves optional reader and missing-text behavior", async () => {
  const run = benchmarkRun("tenant-a", "run-1")
  const withoutReader = fixture({ runs: [run] })
  const withoutText = fixture({ runs: [run], getText: async () => undefined })

  assert.equal(await withoutReader.getCodeBuildLogText(actor("tenant-a"), run.runId), undefined)
  assert.equal(await withoutText.getCodeBuildLogText(actor("tenant-a"), run.runId), undefined)
})

test("BenchmarkRunQueryService preserves log references and attachment metadata", async () => {
  const references: unknown[] = []
  const run = {
    ...benchmarkRun("tenant-a", "run/with:unsafe*chars"),
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogGroupName: "/aws/codebuild/memo",
    codeBuildLogStreamName: "build-stream"
  }
  const service = fixture({
    runs: [run],
    getText: async (reference) => {
      references.push(reference)
      return "install phase\nbuild phase\n"
    }
  })

  assert.deepEqual(await service.getCodeBuildLogText(actor("tenant-a"), run.runId), {
    text: "install phase\nbuild phase\n",
    fileName: "benchmark-logs-run_with_unsafe_chars.txt",
    contentDisposition: 'attachment; filename="benchmark-logs-run_with_unsafe_chars.txt"'
  })
  assert.deepEqual(references, [{
    buildId: "memo-benchmark:build-id",
    logGroupName: "/aws/codebuild/memo",
    logStreamName: "build-stream"
  }])
})

function fixture(input: {
  runs: BenchmarkRun[]
  getText?: NonNullable<BenchmarkRunQueryPorts["codeBuildLogReader"]>["getText"]
}): BenchmarkRunQueryService {
  return new BenchmarkRunQueryService({
    benchmarkRunStore: {
      list: async (tenantId) => input.runs.filter((run) => run.tenantId === tenantId),
      get: async (tenantId, runId) => input.runs.find((run) => run.tenantId === tenantId && run.runId === runId)
    },
    codeBuildLogReader: input.getText ? { getText: input.getText } : undefined,
    tenantIdForActor: (value) => {
      if (!value.tenantId) throw new Error("authoritative tenant required")
      return value.tenantId
    }
  })
}

function actor(tenantId: string): AppUser {
  return { userId: `user-${tenantId}`, cognitoGroups: [], accountStatus: "active", tenantId }
}

function benchmarkRun(tenantId: string, runId: string): BenchmarkRun {
  return {
    runId,
    status: "succeeded",
    mode: "agent",
    runner: "codebuild",
    suiteId: `suite-${tenantId}`,
    datasetS3Key: `datasets/${tenantId}.jsonl`,
    createdBy: `user-${tenantId}`,
    tenantId,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:01:00.000Z"
  }
}
