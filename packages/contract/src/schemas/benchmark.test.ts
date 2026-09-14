import assert from "node:assert/strict"
import test from "node:test"

import { BenchmarkCaseResultSchema } from "./benchmark.js"

const baseCase = {
  status: 200,
  passed: true,
  failureReasons: []
}

test("FR-019 benchmark case retrieval relevance counts are complete and bounded", () => {
  assert.equal(BenchmarkCaseResultSchema.safeParse({
    ...baseCase,
    retrieval: { relevantRetrievedCount: 2, evaluatedRetrievedCount: 4 }
  }).success, true)
  assert.equal(BenchmarkCaseResultSchema.safeParse({
    ...baseCase,
    retrieval: { relevantRetrievedCount: 2 }
  }).success, false)
  assert.equal(BenchmarkCaseResultSchema.safeParse({
    ...baseCase,
    retrieval: { relevantRetrievedCount: 5, evaluatedRetrievedCount: 4 }
  }).success, false)
})

test("SQ-008 first-token evidence keeps its authoritative clock lineage", () => {
  const measured = {
    schemaVersion: 1,
    unit: "ms",
    clock: "node_performance",
    origin: "chat_orchestration_ingress",
    boundary: "answer_model_first_content_delta",
    clientVisible: false,
    status: "measured",
    latencyMs: 12.5,
    attemptOrdinal: 2
  }
  assert.equal(BenchmarkCaseResultSchema.safeParse({ ...baseCase, latency: { firstToken: measured } }).success, true)
  assert.equal(BenchmarkCaseResultSchema.safeParse({ ...baseCase, latency: { firstToken: { ...measured, clock: "Date.now" } } }).success, false)
  assert.equal(BenchmarkCaseResultSchema.safeParse({ ...baseCase, latency: { firstToken: { ...measured, latencyMs: undefined } } }).success, false)
  assert.equal(BenchmarkCaseResultSchema.safeParse({
    ...baseCase,
    latency: { firstToken: { ...measured, status: "unavailable", latencyMs: undefined, attemptOrdinal: undefined, reason: "first_content_delta_not_observed" } }
  }).success, true)
})
