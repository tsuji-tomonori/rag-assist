import assert from "node:assert/strict"
import test from "node:test"
import { SafeDegradationDecisionSchema } from "./search.js"

const decision = {
  policyVersion: "rag-safe-degradation-v1" as const,
  trigger: "dependency_error" as const,
  stage: "lexical_index",
  action: "refuse" as const,
  enforcedGuards: ["authentication", "authorization"] as const,
  missingGuards: ["grounding"] as const,
  safeToReturnContent: false,
  guardOutcomes: [{
    guard: "authentication" as const,
    observed: true,
    passed: true,
    evidence: "runtime_identity_check",
    observedAt: "2026-07-12T00:00:00.000Z"
  }]
}

test("FR-089 search contract requires and retains structured guard outcomes", () => {
  const parsed = SafeDegradationDecisionSchema.parse(decision)
  assert.deepEqual(parsed.guardOutcomes, decision.guardOutcomes)
  assert.equal(SafeDegradationDecisionSchema.safeParse({ ...decision, guardOutcomes: undefined }).success, false)

  for (const field of ["guard", "observed", "passed", "evidence", "observedAt"] as const) {
    const outcome = { ...decision.guardOutcomes[0] } as Record<string, unknown>
    delete outcome[field]
    assert.equal(
      SafeDegradationDecisionSchema.safeParse({ ...decision, guardOutcomes: [outcome] }).success,
      false,
      `guardOutcomes[].${field} must be required`
    )
  }
  assert.equal(SafeDegradationDecisionSchema.safeParse({
    ...decision,
    guardOutcomes: [{ ...decision.guardOutcomes[0], observedAt: "not-a-timestamp" }]
  }).success, false)
})
