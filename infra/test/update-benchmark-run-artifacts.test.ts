import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.resolve(__dirname, "../scripts/update-benchmark-run-artifacts.mjs")

test("FR-048 artifact integrity records complete required artifacts", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href)
  assert.deepEqual(script.buildBenchmarkArtifactIntegrity({
    results: "available",
    summary: "available",
    report: "available",
    release_audit: "available"
  }), {
    schemaVersion: 1,
    status: "complete",
    availableCount: 4,
    failureCount: 0,
    artifacts: [
      { kind: "results", status: "available" },
      { kind: "summary", status: "available" },
      { kind: "report", status: "available" },
      { kind: "release_audit", status: "available" }
    ]
  })
})

test("FR-048 artifact integrity preserves partial generation and upload failures", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href)
  const integrity = script.buildBenchmarkArtifactIntegrity({
    results: "available",
    summary: "generation_failed",
    report: "upload_failed",
    release_audit: "generation_failed"
  })
  assert.equal(integrity.status, "partial_failure")
  assert.equal(integrity.availableCount, 1)
  assert.equal(integrity.failureCount, 3)
  assert.deepEqual(integrity.artifacts.slice(1), [
    { kind: "summary", status: "generation_failed", failureReason: "summary_not_generated" },
    { kind: "report", status: "upload_failed", failureReason: "report_upload_failed" },
    { kind: "release_audit", status: "generation_failed", failureReason: "release_audit_not_generated" }
  ])
})

test("FR-048 artifact integrity records all-missing artifacts as an explicit failure", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href)
  const input = {
    results: "generation_failed",
    summary: "generation_failed",
    report: "generation_failed",
    release_audit: "generation_failed"
  }
  const first = script.buildBenchmarkArtifactIntegrity(input)
  const retry = script.buildBenchmarkArtifactIntegrity(input)
  assert.equal(first.status, "failed")
  assert.equal(first.availableCount, 0)
  assert.equal(first.failureCount, 4)
  assert.deepEqual(retry, first)
})

test("FR-048 artifact integrity rejects implicit or unknown states", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href)
  assert.throws(() => script.buildBenchmarkArtifactIntegrity({
    results: "available",
    summary: "available",
    report: "available"
  }), /explicit final benchmark artifact status/)
  assert.throws(() => script.buildBenchmarkArtifactIntegrity({
    results: "available",
    summary: "available",
    report: "available",
    release_audit: "succeeded"
  }), /explicit final benchmark artifact status/)
})

test("FR-048 artifact integrity update is conditional on a running tenant-scoped row", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href)
  const integrity = script.buildBenchmarkArtifactIntegrity({
    results: "available",
    summary: "available",
    report: "available",
    release_audit: "available"
  })
  const input = script.buildUpdateBenchmarkRunArtifactsCommandInput({
    TableName: "BenchmarkRuns",
    storageRunId: "tenant#abc#run#run-1",
    integrity,
    updatedAt: "2026-07-17T00:00:00.000Z"
  })
  assert.equal(input.ConditionExpression, "attribute_exists(#runId) AND #status = :running")
  assert.deepEqual(input.Key, { runId: { S: "tenant#abc#run#run-1" } })
  assert.equal(input.ExpressionAttributeValues[":running"].S, "running")
  assert.equal(input.ExpressionAttributeValues[":artifactIntegrity"].M.status.S, "complete")
})

async function importModule(url: string): Promise<any> {
  return import(`${url}?test=${Date.now()}-${Math.random()}`)
}
