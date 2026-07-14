import assert from "node:assert/strict"
import test from "node:test"
import {
  BenchmarkQueryRequestSchema as ContractBenchmarkQueryRequestSchema,
  BenchmarkSearchRequestSchema as ContractBenchmarkSearchRequestSchema
} from "@memorag-mvp/contract"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import {
  BenchmarkEvaluationContextError,
  prepareBenchmarkQueryInvocation,
  prepareBenchmarkSearchInvocation,
  resolveBenchmarkEvaluationContext
} from "./evaluation-context.js"
import {
  BenchmarkQueryRequestSchema,
  BenchmarkSearchRequestSchema
} from "../schemas.js"

const settings = { enabled: true, tenantId: "benchmark-tenant" }

test("approved suite resolves a server-owned nonprivileged subject and isolated service inputs", () => {
  const query = prepareBenchmarkQueryInvocation({
    suiteId: "standard-agent-v1",
    id: "case-1",
    question: "期限は？",
    includeDebug: false
  }, runner(), settings)
  const search = prepareBenchmarkSearchInvocation({
    suiteId: "search-standard-v1",
    query: "期限",
    topK: 5
  }, runner(), settings)

  assert.equal(query.id, "case-1")
  assert.equal(query.serviceInput.includeDebug, false)
  assert.deepEqual(query.serviceInput.searchFilters, {
    tenantId: "benchmark-tenant",
    source: "benchmark-runner",
    docType: "benchmark-corpus",
    benchmarkSuiteId: "standard-agent-v1"
  })
  assert.deepEqual(search.serviceInput.filters, {
    tenantId: "benchmark-tenant",
    source: "benchmark-runner",
    docType: "benchmark-corpus",
    benchmarkSuiteId: "standard-agent-v1"
  })
  assert.equal(query.subject.userId, "benchmark-evaluation:standard-agent-v1")
  assert.equal(query.subject.tenantId, "benchmark-tenant")
  assert.deepEqual(query.subject.cognitoGroups, [])

  for (const permission of [
    "rag:doc:read",
    "rag:doc:share",
    "rag:doc:move",
    "rag:doc:delete:group",
    "document.read",
    "document.share",
    "document.move",
    "document.delete",
    "user:read"
  ] as const) {
    assert.equal(hasPermission(query.subject, permission), false, `${permission} must not be granted to the simulated subject`)
  }
})

test("only a current dedicated BENCHMARK_RUNNER identity can select a simulated subject", () => {
  const claims: AppUser[] = [
    { ...runner(), accountStatus: "suspended" },
    { ...runner(), tenantId: undefined },
    { ...runner(), cognitoGroups: ["CHAT_USER"] },
    { ...runner(), cognitoGroups: ["BENCHMARK_RUNNER", "SYSTEM_ADMIN"] },
    { ...runner(), cognitoGroups: ["SYSTEM_ADMIN"] }
  ]

  for (const user of claims) {
    assert.throws(
      () => resolveBenchmarkEvaluationContext(user, "standard-agent-v1", settings),
      (error) => isContextError(error, 403)
    )
  }
})

test("unknown suites and unsafe server configuration fail closed", () => {
  assert.throws(
    () => resolveBenchmarkEvaluationContext(runner(), "unknown-suite", settings),
    (error) => isContextError(error, 400)
  )
  assert.throws(
    () => resolveBenchmarkEvaluationContext(runner(), " standard-agent-v1", settings),
    (error) => isContextError(error, 400)
  )
  assert.throws(
    () => resolveBenchmarkEvaluationContext(runner(), "standard-agent-v1", { enabled: false, tenantId: "benchmark-tenant" }),
    (error) => isContextError(error, 503)
  )
  assert.throws(
    () => resolveBenchmarkEvaluationContext(runner(), "standard-agent-v1", { enabled: true, tenantId: "" }),
    (error) => isContextError(error, 503)
  )
  assert.throws(
    () => resolveBenchmarkEvaluationContext(runner(), "standard-agent-v1", { enabled: true, tenantId: "runner-tenant" }),
    (error) => isContextError(error, 503)
  )
})

test("cross-suite contexts cannot select another suite corpus or subject", () => {
  const mtrag = resolveBenchmarkEvaluationContext(runner(), "mtrag-v1", settings)
  const chatrag = resolveBenchmarkEvaluationContext(runner(), "chatrag-bench-v1", settings)

  assert.equal(mtrag.filters.benchmarkSuiteId, "mtrag-v1")
  assert.equal(chatrag.filters.benchmarkSuiteId, "chatrag-bench-v1")
  assert.notEqual(mtrag.filters.benchmarkSuiteId, chatrag.filters.benchmarkSuiteId)
  assert.notEqual(mtrag.subject.userId, chatrag.subject.userId)
})

test("suites sharing a corpus resolve the same nonprivileged corpus owner", () => {
  const smoke = resolveBenchmarkEvaluationContext(runner(), "smoke-agent-v1", settings)
  const standard = resolveBenchmarkEvaluationContext(runner(), "standard-agent-v1", settings)

  assert.equal(smoke.filters.benchmarkSuiteId, "standard-agent-v1")
  assert.equal(smoke.subject.userId, standard.subject.userId)
  assert.deepEqual(smoke.subject.cognitoGroups, [])
})

test("REST and oRPC schemas require suiteId and reject identity, tenant, group, filter, and scope overrides", () => {
  const schemaPairs = [
    [BenchmarkQueryRequestSchema, ContractBenchmarkQueryRequestSchema, { question: "期限は？", suiteId: "standard-agent-v1" }],
    [BenchmarkSearchRequestSchema, ContractBenchmarkSearchRequestSchema, { query: "期限", suiteId: "search-standard-v1" }]
  ] as const

  for (const [apiSchema, contractSchema, valid] of schemaPairs) {
    assert.equal(apiSchema.safeParse(valid).success, true)
    assert.equal(contractSchema.safeParse(valid).success, true)
    for (const invalid of [
      { ...valid, suiteId: undefined },
      { ...valid, benchmarkSuiteId: "request-corpus" },
      { ...valid, user: { userId: "request-user", groups: ["SYSTEM_ADMIN"] } },
      { ...valid, tenantId: "request-tenant" },
      { ...valid, groups: ["SYSTEM_ADMIN"] },
      { ...valid, filters: { tenantId: "request-tenant" } },
      { ...valid, searchScope: { mode: "all" } },
      { ...valid, scope: { mode: "all" } }
    ]) {
      assert.equal(apiSchema.safeParse(invalid).success, false, JSON.stringify(invalid))
      assert.equal(contractSchema.safeParse(invalid).success, false, JSON.stringify(invalid))
    }
  }
})

function runner(): AppUser {
  return {
    userId: "runner-subject",
    cognitoGroups: ["BENCHMARK_RUNNER"],
    accountStatus: "active",
    tenantId: "runner-tenant"
  }
}

function isContextError(error: unknown, status: number): boolean {
  return error instanceof BenchmarkEvaluationContextError && error.status === status
}
