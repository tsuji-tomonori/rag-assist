import assert from "node:assert/strict"
import test from "node:test"
import { expandedSearchTopK, normalizeMinScore, normalizeSearchTopK, ragRuntimePolicy } from "./runtime-policy.js"

test("runtime policy clamps minScore before workflow state creation", () => {
  assert.equal(normalizeMinScore(2), 1)
  assert.equal(normalizeMinScore(-2), -1)
  assert.equal(normalizeMinScore(undefined), ragRuntimePolicy.retrieval.defaultMinScore)
})

test("runtime policy owns search implementation caps", () => {
  assert.equal(
    expandedSearchTopK(ragRuntimePolicy.retrieval.searchRagMaxTopK + 10),
    ragRuntimePolicy.retrieval.searchRagMaxTopK
  )
  assert.equal(
    normalizeSearchTopK(ragRuntimePolicy.retrieval.searchRagMaxTopK + 10),
    ragRuntimePolicy.retrieval.searchRagMaxTopK
  )
  assert.ok(
    ragRuntimePolicy.retrieval.defaultSearchBenchmarkTopK <=
      Math.min(ragRuntimePolicy.retrieval.maxTopK, ragRuntimePolicy.retrieval.searchRagMaxTopK)
  )
  assert.ok(ragRuntimePolicy.retrieval.lexicalTopK <= ragRuntimePolicy.retrieval.searchRagMaxSourceTopK)
  assert.ok(ragRuntimePolicy.retrieval.semanticTopK <= ragRuntimePolicy.retrieval.searchRagMaxSourceTopK)
})
