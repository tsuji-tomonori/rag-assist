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
