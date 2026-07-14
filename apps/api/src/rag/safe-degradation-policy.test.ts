import assert from "node:assert/strict"
import test from "node:test"
import {
  MANDATORY_RAG_GUARDS,
  SAFE_DEGRADATION_POLICY_VERSION,
  STANDARD_RAG_GUARD_PROFILE,
  assertSafeRagGuardProfile,
  classifyDegradationTrigger,
  measurePartialRuntimeRagGuards,
  measureRuntimeRagGuards,
  safeDegradationDecision,
  type RagGuardProfile
} from "./_shared/security/safe-degradation-policy.js"

test("FR-089 approved standard profile keeps every mandatory guard", () => {
  assert.doesNotThrow(() => assertSafeRagGuardProfile(STANDARD_RAG_GUARD_PROFILE))
  assert.equal(MANDATORY_RAG_GUARDS.every((guard) => STANDARD_RAG_GUARD_PROFILE.guards[guard]), true)
})

test("FR-089 any profile that disables one mandatory guard is rejected", () => {
  for (const disabled of MANDATORY_RAG_GUARDS) {
    const profile: RagGuardProfile = {
      id: `unsafe-${disabled}`,
      version: "test-v1",
      guards: { ...STANDARD_RAG_GUARD_PROFILE.guards, [disabled]: false }
    }
    assert.throws(() => assertSafeRagGuardProfile(profile), new RegExp(disabled))
  }
})

test("FR-089 fallback cannot return content when any guard decision is missing", () => {
  for (const missing of MANDATORY_RAG_GUARDS) {
    const decision = safeDegradationDecision({
      trigger: "dependency_error",
      stage: "generation",
      requestedAction: "limited_answer",
      guardOutcomes: measureRuntimeRagGuards(Object.fromEntries(MANDATORY_RAG_GUARDS.map((guard) => [guard, { passed: guard !== missing, evidence: guard === missing ? "fault_injected" : "runtime_check_passed" }])) as RagGuardChecks)
    })
    assert.equal(decision.action, "fail")
    assert.equal(decision.safeToReturnContent, false)
    assert.deepEqual(decision.missingGuards, [missing])
  }
})

test("FR-089 dependency failure classes retain versioned guard decisions", () => {
  const errors = [
    [new Error("vector timeout"), "timeout"],
    [new Error("provider overloaded"), "overload"],
    [new Error("cost budget exceeded"), "cost_limit"],
    [new Error("circuit open"), "circuit_open"],
    [new Error("cache unavailable"), "dependency_error"]
  ] as const
  for (const [error, trigger] of errors) {
    const decision = safeDegradationDecision({
      trigger: classifyDegradationTrigger(error),
      stage: "test",
      requestedAction: "refuse",
      guardOutcomes: measureRuntimeRagGuards(Object.fromEntries(MANDATORY_RAG_GUARDS.map((guard) => [guard, { passed: true, evidence: "runtime_check_passed" }])) as RagGuardChecks)
    })
    assert.equal(decision.policyVersion, SAFE_DEGRADATION_POLICY_VERSION)
    assert.equal(decision.trigger, trigger)
    assert.equal(decision.action, "refuse")
    assert.equal(decision.safeToReturnContent, false)
    assert.deepEqual(decision.missingGuards, [])
  }
})

test("FR-089 unobserved runtime guards remain missing and force limited fallback to fail closed", () => {
  const decision = safeDegradationDecision({
    trigger: "dependency_error",
    stage: "cache_fallback",
    requestedAction: "limited_answer",
    guardOutcomes: measurePartialRuntimeRagGuards({
      authentication: { passed: true, evidence: "identity_checked" },
      authorization: { passed: true, evidence: "tenant_filter_checked" }
    })
  })
  assert.equal(decision.action, "fail")
  assert.equal(decision.safeToReturnContent, false)
  assert.ok(decision.guardOutcomes.some((outcome) => !outcome.observed))
  assert.ok(decision.missingGuards.includes("output_secret"))
})

type RagGuardChecks = Record<(typeof MANDATORY_RAG_GUARDS)[number], { passed: boolean; evidence: string }>
