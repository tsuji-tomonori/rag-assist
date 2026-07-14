import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  createBenchmarkAuthorizationCheck,
  createCurrentAuthorizedFetch,
  fetchAuthorizationBoundary,
  type BenchmarkAuthorizationBoundary
} from "./run-authorization.js"

test("current-authorized fetch dispatches zero requests after a mid-run revoke", async () => {
  const checked: BenchmarkAuthorizationBoundary[] = []
  const fetched: string[] = []
  let revoked = false
  const authorizedFetch = createCurrentAuthorizedFetch({
    authorize: async (boundary) => {
      checked.push(boundary)
      if (revoked) throw new Error("permission_revoked")
    },
    fetchImpl: async (input) => {
      fetched.push(input.toString())
      return new Response("ok")
    }
  })

  await authorizedFetch("https://example.test/case-1", { method: "POST" })
  revoked = true
  await assert.rejects(() => authorizedFetch("https://example.test/case-2", { method: "POST" }), /permission_revoked/)
  await assert.rejects(() => authorizedFetch("https://example.test/case-3", { method: "GET" }), /permission_revoked/)

  assert.deepEqual(checked, ["external_side_effect", "external_side_effect", "protected_read"])
  assert.deepEqual(fetched, ["https://example.test/case-1"])
})

test("fetch authorization classifies reads separately from mutations", () => {
  assert.equal(fetchAuthorizationBoundary("https://example.test/read"), "protected_read")
  assert.equal(fetchAuthorizationBoundary(new Request("https://example.test/head", { method: "HEAD" })), "protected_read")
  assert.equal(fetchAuthorizationBoundary("https://example.test/write", { method: "POST" }), "external_side_effect")
  assert.equal(fetchAuthorizationBoundary(new Request("https://example.test/upload", { method: "PUT" })), "external_side_effect")
})

test("CodeBuild authorization fails closed and validates the Lambda response", async () => {
  await assert.rejects(
    () => createBenchmarkAuthorizationCheck({ env: { CODEBUILD_BUILD_ID: "build-1" } })("protected_read"),
    /benchmark_authorization_failed/
  )

  const invocations: unknown[] = []
  const check = createBenchmarkAuthorizationCheck({
    env: {
      CODEBUILD_BUILD_ID: "build-1",
      BENCHMARK_AUTHORIZATION_FUNCTION_NAME: "benchmark-authorizer",
      TENANT_ID: "tenant-a",
      RUN_ID: "bench-1"
    },
    invoke: async (input) => {
      invocations.push(input)
      return {
        authorized: true,
        boundary: input.payload.boundary,
        runId: input.payload.runId,
        tenantId: input.payload.tenantId
      }
    }
  })

  await check("external_side_effect")
  assert.deepEqual(invocations, [{
    functionName: "benchmark-authorizer",
    payload: { tenantId: "tenant-a", runId: "bench-1", boundary: "external_side_effect" }
  }])

  let deniedInvocations = 0
  const deniedCheck = createBenchmarkAuthorizationCheck({
    env: {
      CODEBUILD_BUILD_ID: "build-1",
      BENCHMARK_AUTHORIZATION_FUNCTION_NAME: "benchmark-authorizer",
      TENANT_ID: "tenant-a",
      RUN_ID: "bench-1"
    },
    invoke: async () => {
      deniedInvocations += 1
      return { authorized: false }
    }
  })
  await assert.rejects(() => deniedCheck("protected_read"), /benchmark_authorization_failed/)
  await assert.rejects(() => deniedCheck("external_side_effect"), /benchmark_authorization_failed/)
  assert.equal(deniedInvocations, 1)
})

test("FR-090 every network-backed production prepare suite defaults to current-authorized fetch", async () => {
  const productionPrepareSources = [
    "allganize-ja.ts",
    "architecture-drawing-qarag.ts",
    "jp-public-pdf-qa.ts",
    "mlit-pdf-figure-table-rag.ts",
    "mmrag-docqa.ts"
  ]
  for (const fileName of productionPrepareSources) {
    const source = await readFile(new URL(fileName, import.meta.url), "utf-8")
    assert.match(source, /createCurrentAuthorizedFetch/, `${fileName} must construct the current-authorized fetch boundary`)
    assert.doesNotMatch(source, /(?:=|\?\?)\s*(?:globalThis\.)?fetch\b/, `${fileName} must not default protected reads to raw fetch`)
  }
})
