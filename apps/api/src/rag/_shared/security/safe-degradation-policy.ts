export const SAFE_DEGRADATION_POLICY_VERSION = "rag-safe-degradation-v1" as const

export const MANDATORY_RAG_GUARDS = [
  "authentication",
  "authorization",
  "classification_usage",
  "prompt_injection",
  "tool_policy",
  "grounding",
  "citation",
  "output_secret",
  "trace_redaction"
] as const

export type MandatoryRagGuard = typeof MANDATORY_RAG_GUARDS[number]
export type SafeDegradationAction = "limited_answer" | "refuse" | "fail"

export type SafeDegradationDecision = {
  policyVersion: typeof SAFE_DEGRADATION_POLICY_VERSION
  trigger: "dependency_error" | "timeout" | "overload" | "cost_limit" | "circuit_open" | "unsafe_profile"
  stage: string
  action: SafeDegradationAction
  enforcedGuards: MandatoryRagGuard[]
  missingGuards: MandatoryRagGuard[]
  safeToReturnContent: boolean
  guardOutcomes: RagGuardOutcome[]
}

export type RagGuardOutcome = {
  guard: MandatoryRagGuard
  observed: boolean
  passed: boolean
  evidence: string
  observedAt: string
}

export type RagGuardProfile = {
  id: string
  version: string
  guards: Readonly<Record<MandatoryRagGuard, boolean>>
}

const RAG_GUARD_PROFILE_KEYS = ["id", "version", "guards"] as const

export const STANDARD_RAG_GUARD_PROFILE: RagGuardProfile = {
  id: "standard-safe-rag",
  version: "standard-safe-rag-v1",
  guards: Object.fromEntries(MANDATORY_RAG_GUARDS.map((guard) => [guard, true])) as Record<MandatoryRagGuard, boolean>
}

export class UnsafeRagDegradationProfileError extends Error {
  constructor(readonly missingGuards: MandatoryRagGuard[]) {
    super(`Unsafe RAG degradation profile: mandatory guards disabled: ${missingGuards.join(", ")}`)
    this.name = "UnsafeRagDegradationProfileError"
  }
}

export class RagGuardProfileConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RagGuardProfileConfigurationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string
): void {
  const actual = Object.keys(value)
  const missing = expected.filter((key) => !Object.hasOwn(value, key))
  const unknown = actual.filter((key) => !expected.includes(key))
  if (missing.length > 0) {
    throw new RagGuardProfileConfigurationError(`${field} is missing required keys: ${missing.join(", ")}`)
  }
  if (unknown.length > 0) {
    throw new RagGuardProfileConfigurationError(`${field} contains unknown keys: ${unknown.join(", ")}`)
  }
}

/** Parse the complete configured profile without defaults or implicit guard enablement. */
export function parseConfiguredRagGuardProfile(
  raw: string | undefined,
  settingName = "RAG_GUARD_PROFILE_JSON"
): RagGuardProfile {
  if (raw === undefined || raw.trim().length === 0) {
    throw new RagGuardProfileConfigurationError(`${settingName} is required`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new RagGuardProfileConfigurationError(`${settingName} must be valid JSON`)
  }
  if (!isRecord(parsed)) {
    throw new RagGuardProfileConfigurationError(`${settingName} must be a JSON object`)
  }
  assertExactKeys(parsed, RAG_GUARD_PROFILE_KEYS, settingName)
  if (typeof parsed.id !== "string" || parsed.id.trim().length === 0) {
    throw new RagGuardProfileConfigurationError(`${settingName}.id must be a non-empty string`)
  }
  if (typeof parsed.version !== "string" || parsed.version.trim().length === 0) {
    throw new RagGuardProfileConfigurationError(`${settingName}.version must be a non-empty string`)
  }
  if (!isRecord(parsed.guards)) {
    throw new RagGuardProfileConfigurationError(`${settingName}.guards must be a JSON object`)
  }
  const guards = parsed.guards
  assertExactKeys(guards, MANDATORY_RAG_GUARDS, `${settingName}.guards`)
  for (const guard of MANDATORY_RAG_GUARDS) {
    if (typeof guards[guard] !== "boolean") {
      throw new RagGuardProfileConfigurationError(`${settingName}.guards.${guard} must be a boolean`)
    }
  }

  const profile: RagGuardProfile = Object.freeze({
    id: parsed.id,
    version: parsed.version,
    guards: Object.freeze(Object.fromEntries(
      MANDATORY_RAG_GUARDS.map((guard) => [guard, guards[guard] as boolean])
    ) as Record<MandatoryRagGuard, boolean>)
  })
  assertSafeRagGuardProfile(profile)
  return profile
}

export function assertSafeRagGuardProfile(profile: RagGuardProfile | undefined): asserts profile is RagGuardProfile {
  const missing = MANDATORY_RAG_GUARDS.filter((guard) => profile?.guards?.[guard] !== true)
  if (missing.length > 0) throw new UnsafeRagDegradationProfileError(missing)
}

export function safeDegradationDecision(input: {
  trigger: SafeDegradationDecision["trigger"]
  stage: string
  requestedAction: SafeDegradationAction
  guardOutcomes: readonly RagGuardOutcome[]
}): SafeDegradationDecision {
  const outcomes = new Map(input.guardOutcomes.map((outcome) => [outcome.guard, outcome]))
  const enforced = new Set(MANDATORY_RAG_GUARDS.filter((guard) => outcomes.get(guard)?.observed === true && outcomes.get(guard)?.passed === true))
  const missingGuards = MANDATORY_RAG_GUARDS.filter((guard) => !enforced.has(guard))
  const action = missingGuards.length > 0 && input.requestedAction === "limited_answer" ? "fail" : input.requestedAction
  return {
    policyVersion: SAFE_DEGRADATION_POLICY_VERSION,
    trigger: input.trigger,
    stage: input.stage,
    action,
    enforcedGuards: MANDATORY_RAG_GUARDS.filter((guard) => enforced.has(guard)),
    missingGuards,
    safeToReturnContent: action === "limited_answer" && missingGuards.length === 0,
    guardOutcomes: MANDATORY_RAG_GUARDS.map((guard) => outcomes.get(guard) ?? {
      guard,
      observed: false,
      passed: false,
      evidence: "runtime_outcome_missing",
      observedAt: new Date().toISOString()
    })
  }
}

export function measureRuntimeRagGuards(
  checks: Readonly<Record<MandatoryRagGuard, { passed: boolean; evidence: string }>>,
  observedAt = new Date().toISOString()
): RagGuardOutcome[] {
  return MANDATORY_RAG_GUARDS.map((guard) => ({ guard, observed: true, ...checks[guard], observedAt }))
}

export function measurePartialRuntimeRagGuards(
  checks: Partial<Readonly<Record<MandatoryRagGuard, { passed: boolean; evidence: string }>>>,
  observedAt = new Date().toISOString()
): RagGuardOutcome[] {
  return MANDATORY_RAG_GUARDS.map((guard) => checks[guard]
    ? { guard, observed: true, ...checks[guard]!, observedAt }
    : { guard, observed: false, passed: false, evidence: "runtime_outcome_unobserved", observedAt })
}

export function classifyDegradationTrigger(error: unknown): SafeDegradationDecision["trigger"] {
  const value = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : String(error).toLowerCase()
  if (value.includes("timeout") || value.includes("timed out")) return "timeout"
  if (value.includes("overload") || value.includes("throttl") || value.includes("too many requests")) return "overload"
  if (value.includes("cost") || value.includes("budget")) return "cost_limit"
  if (value.includes("circuit") && value.includes("open")) return "circuit_open"
  return "dependency_error"
}
