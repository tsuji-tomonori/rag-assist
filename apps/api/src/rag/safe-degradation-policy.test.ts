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
  parseConfiguredRagGuardProfile,
  safeDegradationDecision,
  type RagGuardProfile
} from "./_shared/security/safe-degradation-policy.js"

test("FR-089 approved standard profile keeps every mandatory guard", () => {
  assert.doesNotThrow(() => assertSafeRagGuardProfile(STANDARD_RAG_GUARD_PROFILE))
  assert.equal(MANDATORY_RAG_GUARDS.every((guard) => STANDARD_RAG_GUARD_PROFILE.guards[guard]), true)
})

test("FR-089 configured profile parser accepts only the complete safe profile", () => {
  const parsed = parseConfiguredRagGuardProfile(JSON.stringify(STANDARD_RAG_GUARD_PROFILE))
  assert.deepEqual(parsed, STANDARD_RAG_GUARD_PROFILE)
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.guards), true)
})

test("FR-089 configured profile parser fails closed for malformed or incomplete settings", () => {
  const withoutCitation = structuredClone(STANDARD_RAG_GUARD_PROFILE) as Record<string, unknown> & {
    guards: Record<string, unknown>
  }
  delete withoutCitation.guards.citation
  const unknownGuard = structuredClone(STANDARD_RAG_GUARD_PROFILE) as Record<string, unknown> & {
    guards: Record<string, unknown>
  }
  unknownGuard.guards.unapproved_guard = true
  const unknownTopLevel = { ...STANDARD_RAG_GUARD_PROFILE, mode: "permissive" }
  const unknownValue = structuredClone(STANDARD_RAG_GUARD_PROFILE) as Record<string, unknown> & {
    guards: Record<string, unknown>
  }
  unknownValue.guards.grounding = "enabled"
  const allOff = {
    ...STANDARD_RAG_GUARD_PROFILE,
    guards: Object.fromEntries(MANDATORY_RAG_GUARDS.map((guard) => [guard, false]))
  }

  const invalidSettings: readonly [string, string | undefined, RegExp][] = [
    ["unset", undefined, /RAG_GUARD_PROFILE_JSON is required/],
    ["blank", "  ", /RAG_GUARD_PROFILE_JSON is required/],
    ["invalid JSON", "{", /must be valid JSON/],
    ["partial", JSON.stringify(withoutCitation), /missing required keys: citation/],
    ["unknown guard", JSON.stringify(unknownGuard), /unknown keys: unapproved_guard/],
    ["unknown top-level key", JSON.stringify(unknownTopLevel), /unknown keys: mode/],
    ["unknown guard value", JSON.stringify(unknownValue), /grounding must be a boolean/],
    ["all guards disabled", JSON.stringify(allOff), /mandatory guards disabled/]
  ]

  for (const [label, raw, expected] of invalidSettings) {
    assert.throws(() => parseConfiguredRagGuardProfile(raw), expected, label)
  }
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
