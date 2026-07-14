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

export function assertSafeRagGuardProfile(profile: RagGuardProfile): void {
  const missing = MANDATORY_RAG_GUARDS.filter((guard) => profile.guards[guard] !== true)
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
