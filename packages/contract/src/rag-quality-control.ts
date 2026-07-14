export const RAG_QUALITY_POLICY_SCHEMA_VERSION = 2 as const
export const RAG_QUALITY_SIGNAL_CATALOG_VERSION = "rag-quality-signals-v2"
export const RAG_QUALITY_OBSERVATION_SCHEMA_VERSION = 2 as const

export const RAG_QUALITY_PROVENANCE_DIMENSIONS = [
  "dataset",
  "model",
  "index",
  "prompt",
  "pipeline",
  "parser",
  "chunker",
  "runtime",
  "workload",
  "price"
] as const

export const RAG_REQUIRED_CASE_SLICE_DIMENSIONS = [
  "question_type",
  "tenant_role",
  "ocr_mode",
  "language",
  "multi_evidence",
  "answerability",
  "severity"
] as const

export const RAG_OPERATION_ENDPOINTS = ["chat", "search", "ingest"] as const
export const RAG_RECOVERY_DEPENDENCIES = ["vector", "llm", "ocr", "queue"] as const

export const RAG_REQUIRED_SIGNAL_IDS = [
  "ingest.extraction_coverage",
  "ingest.parser_ocr_accuracy",
  "ingest.silent_truncation_count",
  "ingest.locator_validity",
  "ingest.chunk_structure_quality",
  "ingest.manifest_integrity",
  "ingest.admission_correctness",
  "retrieval.authorized_recall_at_k",
  "retrieval.false_denial_rate",
  "evidence.retention_rate",
  "generation.faithfulness",
  "generation.unsupported_claim_rate",
  "generation.critical_unsupported_claim_count",
  "citation.precision",
  "citation.completeness",
  "citation.locator_validity",
  "citation.required_claim_miss_count",
  "answerability.false_answer_rate",
  "answerability.false_refusal_rate",
  "task.completion_rate",
  "task.outcome_accuracy",
  "task.critical_failure_count",
  "evaluation.slice_case_count",
  "security.unauthorized_exposure_count",
  "security.injection_success_count",
  "security.secret_exposure_count",
  "security.eligibility_matrix_coverage",
  "security.eligibility_unreconciled_resource_count",
  "security.eligibility_propagation_p50_ms",
  "security.eligibility_propagation_p95_ms",
  "security.eligibility_propagation_p99_ms",
  "security.eligibility_propagation_max_ms",
  "performance.chat_p50_ms",
  "performance.chat_p95_ms",
  "performance.chat_p99_ms",
  "performance.search_p50_ms",
  "performance.search_p95_ms",
  "performance.search_p99_ms",
  "performance.ingest_p50_ms",
  "performance.ingest_p95_ms",
  "performance.ingest_p99_ms",
  "reliability.success_rate",
  "reliability.timeout_rate",
  "reliability.error_rate",
  "reliability.backlog_age_p99_ms",
  "reliability.retry_exhaustion_count",
  "reliability.mttr_ms",
  "reliability.recovery_without_loss_rate",
  "reliability.recovery_loss_count",
  "reliability.recovery_scenario_coverage",
  "cost.chat_per_request",
  "cost.search_per_request",
  "cost.ingest_per_document",
  "release.dataset_specific_branch_count",
  "release.artifact_manifest_mismatch_count"
] as const

export type RagQualitySignalId = typeof RAG_REQUIRED_SIGNAL_IDS[number]
export type RagQualityComparator = "gte" | "lte" | "eq"
export type RagQualityProvenanceDimension = typeof RAG_QUALITY_PROVENANCE_DIMENSIONS[number]
export type RagRequiredCaseSliceDimension = typeof RAG_REQUIRED_CASE_SLICE_DIMENSIONS[number]
export type RagOperationEndpoint = typeof RAG_OPERATION_ENDPOINTS[number]
export type RagRecoveryDependency = typeof RAG_RECOVERY_DEPENDENCIES[number]
export type RagSafetyAction =
  | "promotion_freeze"
  | "candidate_quarantine"
  | "document_quarantine"
  | "rollback_last_known_safe"
  | "limited_answer"
  | "refuse_answer"

export type RagQualityGate = {
  signalId: RagQualitySignalId
  slice: string
  comparator: RagQualityComparator
  threshold: number
  thresholdApprovedBy: string
  thresholdApprovedAt: string
  minimumSampleCount: number
  minimumConfidence: number
  maximumRegression?: number
}

export type RagQualityEvidenceVersions = Readonly<{
  dataset: string
  model: string
  index: string
  prompt: string
  pipeline: string
  parser: string
  chunker: string
}>

export type RagQualityWorkloadDimensions = Readonly<{
  corpusProfileVersion: string
  aclDistributionVersion: string
  concurrency: number
  documentSizeProfileVersion: string
  dependencyLatencyProfileVersion: string
}>

export type RagQualityRequiredCaseSlices = Readonly<{
  questionTypes: readonly string[]
  tenantRoles: readonly string[]
  ocrModes: readonly string[]
  languages: readonly string[]
  multiEvidence: readonly ("true" | "false")[]
  answerability: readonly string[]
  severities: readonly string[]
}>

export type RagQualityImprovementCriterion = Readonly<{
  signalId: RagQualitySignalId
  slice: string
  direction: "increase" | "decrease"
  minimumDelta: number
  approvedBy: string
  approvedAt: string
}>

export type RagQualityPolicyProfile = {
  schemaVersion: typeof RAG_QUALITY_POLICY_SCHEMA_VERSION
  signalCatalogVersion: typeof RAG_QUALITY_SIGNAL_CATALOG_VERSION
  profileId: string
  version: string
  approvedBy: string
  approvedAt: string
  workloadProfileVersion: string
  runtimeProfileVersion: string
  priceCatalogVersion: string
  evidenceVersions: RagQualityEvidenceVersions
  workloadDimensions: RagQualityWorkloadDimensions
  requiredCaseSlices: RagQualityRequiredCaseSlices
  changeControl: Readonly<{
    purpose: "neutral" | "improvement"
    improvementCriteria?: readonly RagQualityImprovementCriterion[]
  }>
  requiredSlices: Partial<Record<RagQualitySignalId, string[]>>
  gates: RagQualityGate[]
  responsePolicy: {
    owner: string
    runbookVersion: string
    allowedActions: RagSafetyAction[]
    lastKnownSafeRuntimeVersion?: string
  }
}

export type RagQualityObservation = {
  schemaVersion: typeof RAG_QUALITY_OBSERVATION_SCHEMA_VERSION
  signalCatalogVersion: typeof RAG_QUALITY_SIGNAL_CATALOG_VERSION
  profileId: string
  profileVersion: string
  signalId: RagQualitySignalId
  slice: string
  value: number | null
  available: boolean
  sampleCount: number
  confidence: number | null
  observedAt: string
  workloadProfileVersion: string
  runtimeProfileVersion: string
  priceCatalogVersion: string
  baselineValue?: number
  traceIds?: string[]
  source: {
    producerVersion: string
    artifactTypes: string[]
    artifactIds: string[]
    versionDimensions: Record<string, string[]>
    missingVersionDimensions: string[]
    unavailableReasons?: string[]
  }
}

export type RagQualityGateResult = {
  signalId: RagQualitySignalId
  slice: string
  status: "pass" | "fail"
  reason:
    | "threshold_satisfied"
    | "policy_invalid"
    | "missing_threshold"
    | "duplicate_threshold"
    | "threshold_unapproved"
    | "missing_signal"
    | "signal_unavailable"
    | "signal_value_missing"
    | "profile_mismatch"
    | "insufficient_samples"
    | "insufficient_confidence"
    | "threshold_failed"
    | "regression_failed"
    | "baseline_missing"
    | "improvement_failed"
    | "zero_tolerance_violation"
  value?: number | null
  threshold?: number
  comparator?: RagQualityComparator
  traceIds?: string[]
}

export type RagQualityDecision = {
  status: "pass" | "fail"
  policyId: string
  policyVersion: string
  evaluatedAt: string
  results: RagQualityGateResult[]
  blockingReasons: string[]
  criticalViolation: boolean
}

export type RagQualityAlert = {
  alertId: string
  severity: "critical" | "high" | "warning"
  owner: string
  runbookVersion: string
  policyId: string
  policyVersion: string
  runtimeProfileVersion: string
  signalId: RagQualitySignalId
  slice: string
  reason: RagQualityGateResult["reason"]
  traceIds: string[]
  createdAt: string
}

export type RagMonitoringEvidence = {
  decision: RagQualityDecision
  alerts: RagQualityAlert[]
  requestedActions: RagSafetyAction[]
  executedActions: RagSafetyAction[]
  blockedActions: RagSafetyAction[]
}

const zeroToleranceSignals = new Set<RagQualitySignalId>([
  "ingest.silent_truncation_count",
  "generation.critical_unsupported_claim_count",
  "citation.required_claim_miss_count",
  "task.critical_failure_count",
  "security.unauthorized_exposure_count",
  "security.injection_success_count",
  "security.secret_exposure_count",
  "security.eligibility_unreconciled_resource_count",
  "reliability.recovery_loss_count",
  "release.dataset_specific_branch_count",
  "release.artifact_manifest_mismatch_count"
])

export function evaluateRagQualityPolicy(
  policy: RagQualityPolicyProfile,
  observations: RagQualityObservation[],
  evaluatedAt = new Date().toISOString()
): RagQualityDecision {
  const results: RagQualityGateResult[] = []
  const policyProblems = validatePolicy(policy)
  if (policyProblems.length > 0) {
    results.push(...policyProblems.map((problem) => ({
      signalId: problem.signalId,
      slice: problem.slice,
      status: "fail" as const,
      reason: problem.reason
    })))
  }

  for (const signalId of RAG_REQUIRED_SIGNAL_IDS) {
    const slices = normalizedSlices(policy.requiredSlices[signalId])
    for (const slice of slices) {
      const matchingGates = policy.gates.filter((gate) => gate.signalId === signalId && gate.slice === slice)
      if (matchingGates.length === 0) {
        results.push({ signalId, slice, status: "fail", reason: "missing_threshold" })
        continue
      }
      if (matchingGates.length > 1) {
        results.push({ signalId, slice, status: "fail", reason: "duplicate_threshold" })
        continue
      }
      const gate = matchingGates[0]!
      if (!gate.thresholdApprovedBy.trim() || !validTimestamp(gate.thresholdApprovedAt)) {
        results.push({ signalId, slice, status: "fail", reason: "threshold_unapproved" })
        continue
      }
      const matching = observations.filter((observation) => observation.signalId === signalId && observation.slice === slice)
      if (matching.length !== 1) {
        results.push({ signalId, slice, status: "fail", reason: "missing_signal" })
        continue
      }
      results.push(evaluateGate(policy, gate, matching[0]!))
    }
  }

  const blockingReasons = [...new Set(results.filter((result) => result.status === "fail").map((result) => `${result.signalId}[${result.slice}]:${result.reason}`))]
  return {
    status: blockingReasons.length === 0 ? "pass" : "fail",
    policyId: policy.profileId,
    policyVersion: policy.version,
    evaluatedAt,
    results,
    blockingReasons,
    criticalViolation: results.some((result) => result.status === "fail" && zeroToleranceSignals.has(result.signalId))
  }
}

export async function runRagMonitoringControlLoop(input: {
  policy: RagQualityPolicyProfile
  observations: RagQualityObservation[]
  evaluatedAt?: string
  notify: (alert: RagQualityAlert) => Promise<void>
  executeAction: (action: RagSafetyAction, context: { decision: RagQualityDecision; alerts: RagQualityAlert[] }) => Promise<void>
}): Promise<RagMonitoringEvidence> {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString()
  const decision = evaluateRagQualityPolicy(input.policy, input.observations, evaluatedAt)
  const alerts = decision.results
    .filter((result) => result.status === "fail")
    .map((result, index): RagQualityAlert => ({
      alertId: `${input.policy.profileId}:${input.policy.version}:${evaluatedAt}:${index + 1}`,
      severity: zeroToleranceSignals.has(result.signalId)
        ? "critical"
        : result.reason === "missing_signal" || result.reason === "signal_unavailable" || result.reason === "profile_mismatch"
          ? "high"
          : "warning",
      owner: input.policy.responsePolicy.owner,
      runbookVersion: input.policy.responsePolicy.runbookVersion,
      policyId: input.policy.profileId,
      policyVersion: input.policy.version,
      runtimeProfileVersion: input.policy.runtimeProfileVersion,
      signalId: result.signalId,
      slice: result.slice,
      reason: result.reason,
      traceIds: result.traceIds ?? [],
      createdAt: evaluatedAt
    }))
  for (const alert of alerts) await input.notify(alert)

  const requestedActions = actionsForDecision(decision, input.policy)
  const configuredAllowed = new Set(input.policy.responsePolicy.allowedActions)
  const responsePolicyFailSafe = configuredAllowed.has("promotion_freeze") &&
    configuredAllowed.has("candidate_quarantine") &&
    (configuredAllowed.has("limited_answer") || configuredAllowed.has("refuse_answer"))
  // An invalid response-policy action list must not neutralize every safety
  // action. The fallback is code-owned and can only reduce availability.
  const allowed = responsePolicyFailSafe
    ? configuredAllowed
    : new Set<RagSafetyAction>(["promotion_freeze", "candidate_quarantine", "limited_answer", "refuse_answer"])
  const executedActions: RagSafetyAction[] = []
  const blockedActions: RagSafetyAction[] = []
  for (const action of requestedActions) {
    if (!allowed.has(action)) {
      blockedActions.push(action)
      continue
    }
    await input.executeAction(action, { decision, alerts })
    executedActions.push(action)
  }
  return { decision, alerts, requestedActions, executedActions, blockedActions }
}

function evaluateGate(policy: RagQualityPolicyProfile, gate: RagQualityGate, observation: RagQualityObservation): RagQualityGateResult {
  const base = {
    signalId: gate.signalId,
    slice: gate.slice,
    value: observation.value,
    threshold: gate.threshold,
    comparator: gate.comparator,
    traceIds: observation.traceIds
  }
  if (
    observation.schemaVersion !== RAG_QUALITY_OBSERVATION_SCHEMA_VERSION ||
    observation.signalCatalogVersion !== policy.signalCatalogVersion ||
    observation.profileId !== policy.profileId ||
    observation.profileVersion !== policy.version ||
    observation.workloadProfileVersion !== policy.workloadProfileVersion ||
    observation.runtimeProfileVersion !== policy.runtimeProfileVersion ||
    observation.priceCatalogVersion !== policy.priceCatalogVersion
  ) return { ...base, status: "fail", reason: "profile_mismatch" }
  if (!validObservationSource(observation, policy)) return { ...base, status: "fail", reason: "profile_mismatch" }
  if (!observation.available) return { ...base, status: "fail", reason: "signal_unavailable" }
  if (observation.value === null || !Number.isFinite(observation.value)) return { ...base, status: "fail", reason: "signal_value_missing" }
  if (observation.sampleCount < gate.minimumSampleCount) return { ...base, status: "fail", reason: "insufficient_samples" }
  if (observation.confidence === null || observation.confidence < gate.minimumConfidence) return { ...base, status: "fail", reason: "insufficient_confidence" }
  if (zeroToleranceSignals.has(gate.signalId) && observation.value !== 0) {
    return { ...base, status: "fail", reason: "zero_tolerance_violation" }
  }
  if (!compare(observation.value, gate.comparator, gate.threshold)) return { ...base, status: "fail", reason: "threshold_failed" }
  if (gate.maximumRegression !== undefined && observation.baselineValue === undefined) {
    return { ...base, status: "fail", reason: "baseline_missing" }
  }
  if (gate.maximumRegression !== undefined && observation.baselineValue !== undefined) {
    const regression = regressionAmount(gate.comparator, observation.value, observation.baselineValue)
    if (regression > gate.maximumRegression) return { ...base, status: "fail", reason: "regression_failed" }
  }
  if (policy.changeControl.purpose === "improvement") {
    const criterion = policy.changeControl.improvementCriteria?.find((candidate) => (
      candidate.signalId === gate.signalId && candidate.slice === gate.slice
    ))
    if (criterion) {
      if (observation.baselineValue === undefined) return { ...base, status: "fail", reason: "baseline_missing" }
      const delta = criterion.direction === "increase"
        ? observation.value - observation.baselineValue
        : observation.baselineValue - observation.value
      if (delta < criterion.minimumDelta) return { ...base, status: "fail", reason: "improvement_failed" }
    }
  }
  return { ...base, status: "pass", reason: "threshold_satisfied" }
}

function validObservationSource(observation: RagQualityObservation, policy: RagQualityPolicyProfile): boolean {
  const source = observation.source
  if (
    !source
    || !source.producerVersion?.trim()
    || !Array.isArray(source.artifactTypes)
    || source.artifactTypes.length === 0
    || !Array.isArray(source.artifactIds)
    || source.artifactIds.length === 0
    || !source.versionDimensions
    || typeof source.versionDimensions !== "object"
    || !Array.isArray(source.missingVersionDimensions)
    || source.missingVersionDimensions.length > 0
  ) return false
  const expected: Readonly<Record<RagQualityProvenanceDimension, string>> = {
    dataset: policy.evidenceVersions.dataset,
    model: policy.evidenceVersions.model,
    index: policy.evidenceVersions.index,
    prompt: policy.evidenceVersions.prompt,
    pipeline: policy.evidenceVersions.pipeline,
    parser: policy.evidenceVersions.parser,
    chunker: policy.evidenceVersions.chunker,
    runtime: policy.runtimeProfileVersion,
    workload: policy.workloadProfileVersion,
    price: policy.priceCatalogVersion
  }
  for (const dimension of RAG_QUALITY_PROVENANCE_DIMENSIONS) {
    const actual = source.versionDimensions[dimension]
    if (!Array.isArray(actual) || actual.length !== 1 || actual[0] !== expected[dimension]) return false
  }
  if (observation.signalId.startsWith("release.")) {
    const directReleaseAudit = source.artifactTypes.includes("release_audit")
    const benchmarkReleaseAudit = (source.versionDimensions.releaseAudit?.length ?? 0) > 0
    if (!directReleaseAudit && !benchmarkReleaseAudit) return false
  }
  return true
}

function validatePolicy(policy: RagQualityPolicyProfile): Array<{
  signalId: RagQualitySignalId
  slice: string
  reason: "policy_invalid"
}> {
  const problems: Array<{ signalId: RagQualitySignalId; slice: string; reason: "policy_invalid" }> = []
  const requiredActions = new Set<RagSafetyAction>(["promotion_freeze", "candidate_quarantine"])
  const allowedActions = new Set(policy.responsePolicy.allowedActions)
  const safeResponseActionPresent = allowedActions.has("limited_answer") || allowedActions.has("refuse_answer")
  const evidenceVersionsValid = Boolean(policy.evidenceVersions) && Object.values(policy.evidenceVersions).every((value) => Boolean(value.trim()))
  const workloadDimensionsValid = Boolean(policy.workloadDimensions) &&
    Boolean(policy.workloadDimensions.corpusProfileVersion.trim()) &&
    Boolean(policy.workloadDimensions.aclDistributionVersion.trim()) &&
    Number.isInteger(policy.workloadDimensions.concurrency) && policy.workloadDimensions.concurrency > 0 &&
    Boolean(policy.workloadDimensions.documentSizeProfileVersion.trim()) &&
    Boolean(policy.workloadDimensions.dependencyLatencyProfileVersion.trim())
  const requiredCaseSlicesValid = validRequiredCaseSlices(policy.requiredCaseSlices)
  const actionPolicyValid = policy.responsePolicy.allowedActions.length === allowedActions.size &&
    policy.responsePolicy.allowedActions.length > 0 &&
    [...requiredActions].every((action) => allowedActions.has(action)) &&
    safeResponseActionPresent &&
    (!policy.responsePolicy.lastKnownSafeRuntimeVersion || allowedActions.has("rollback_last_known_safe"))
  const changeControlValid = validChangeControl(policy)
  const requiredSlicesValid = requiredPolicySlicesPresent(policy)
  const valid = policy.schemaVersion === RAG_QUALITY_POLICY_SCHEMA_VERSION &&
    policy.signalCatalogVersion === RAG_QUALITY_SIGNAL_CATALOG_VERSION &&
    Boolean(policy.profileId.trim()) && Boolean(policy.version.trim()) &&
    Boolean(policy.approvedBy.trim()) && validTimestamp(policy.approvedAt) &&
    Boolean(policy.workloadProfileVersion.trim()) && Boolean(policy.runtimeProfileVersion.trim()) &&
    Boolean(policy.priceCatalogVersion.trim()) && evidenceVersionsValid && workloadDimensionsValid &&
    requiredCaseSlicesValid && changeControlValid && requiredSlicesValid &&
    Boolean(policy.responsePolicy.owner.trim()) && Boolean(policy.responsePolicy.runbookVersion.trim()) && actionPolicyValid
  if (!valid) problems.push({ signalId: RAG_REQUIRED_SIGNAL_IDS[0], slice: "overall", reason: "policy_invalid" })
  for (const gate of policy.gates) {
    if (!Number.isFinite(gate.threshold) || !Number.isInteger(gate.minimumSampleCount) || gate.minimumSampleCount < 1 || gate.minimumConfidence < 0 || gate.minimumConfidence > 1 || gate.maximumRegression !== undefined && (!Number.isFinite(gate.maximumRegression) || gate.maximumRegression < 0)) {
      problems.push({ signalId: gate.signalId, slice: gate.slice || "overall", reason: "policy_invalid" })
    }
  }
  return problems
}

export function requiredCaseSliceNames(required: RagQualityRequiredCaseSlices): string[] {
  return [
    ...required.questionTypes.map((value) => `question_type=${canonicalSliceValue(value)}`),
    ...required.tenantRoles.map((value) => `tenant_role=${canonicalSliceValue(value)}`),
    ...required.ocrModes.map((value) => `ocr_mode=${canonicalSliceValue(value)}`),
    ...required.languages.map((value) => `language=${canonicalSliceValue(value)}`),
    ...required.multiEvidence.map((value) => `multi_evidence=${value}`),
    ...required.answerability.map((value) => `answerability=${canonicalSliceValue(value)}`),
    ...required.severities.map((value) => `severity=${canonicalSliceValue(value)}`)
  ]
}

export function buildRequiredRagQualitySlices(
  required: RagQualityRequiredCaseSlices
): Partial<Record<RagQualitySignalId, string[]>> {
  const result = Object.fromEntries(RAG_REQUIRED_SIGNAL_IDS.map((signalId) => [signalId, ["overall"]])) as Partial<Record<RagQualitySignalId, string[]>>
  result["evaluation.slice_case_count"] = ["overall", ...requiredCaseSliceNames(required)]
  for (const endpoint of RAG_OPERATION_ENDPOINTS) {
    for (const percentile of ["p50", "p95", "p99"] as const) {
      const signalId = `performance.${endpoint}_${percentile}_ms` as RagQualitySignalId
      result[signalId] = ["overall", `stage=${endpoint}`]
    }
    const operationalSlice = `endpoint=${endpoint}|stage=${endpoint}`
    for (const signalId of [
      "reliability.success_rate",
      "reliability.timeout_rate",
      "reliability.error_rate",
      "reliability.backlog_age_p99_ms",
      "reliability.retry_exhaustion_count"
    ] as const) result[signalId] = [...(result[signalId] ?? ["overall"]), operationalSlice]
  }
  for (const dependency of RAG_RECOVERY_DEPENDENCIES) {
    const slice = `dependency=${dependency}`
    for (const signalId of [
      "reliability.mttr_ms",
      "reliability.recovery_without_loss_rate",
      "reliability.recovery_loss_count",
      "reliability.recovery_scenario_coverage"
    ] as const) result[signalId] = [...(result[signalId] ?? ["overall"]), slice]
  }
  return result
}

function validRequiredCaseSlices(required: RagQualityRequiredCaseSlices | undefined): boolean {
  if (!required) return false
  const collections: readonly (readonly string[])[] = [
    required.questionTypes,
    required.tenantRoles,
    required.ocrModes,
    required.languages,
    required.multiEvidence,
    required.answerability,
    required.severities
  ]
  return collections.every((values) => Array.isArray(values) && values.length > 0 && values.every((value) => value.trim() === value && Boolean(value))) &&
    required.multiEvidence.every((value) => value === "true" || value === "false")
}

function validChangeControl(policy: RagQualityPolicyProfile): boolean {
  const control = policy.changeControl
  if (!control || (control.purpose !== "neutral" && control.purpose !== "improvement")) return false
  const criteria = control.improvementCriteria ?? []
  if (control.purpose === "neutral") return criteria.length === 0
  if (criteria.length === 0) return false
  return criteria.every((criterion) => (
    RAG_REQUIRED_SIGNAL_IDS.includes(criterion.signalId)
    && Boolean(criterion.slice.trim())
    && (criterion.direction === "increase" || criterion.direction === "decrease")
    && Number.isFinite(criterion.minimumDelta)
    && criterion.minimumDelta > 0
    && Boolean(criterion.approvedBy.trim())
    && validTimestamp(criterion.approvedAt)
    && policy.gates.some((gate) => gate.signalId === criterion.signalId && gate.slice === criterion.slice)
  ))
}

function requiredPolicySlicesPresent(policy: RagQualityPolicyProfile): boolean {
  const sliceCoverage = new Set(normalizedSlices(policy.requiredSlices["evaluation.slice_case_count"]))
  if (!requiredCaseSliceNames(policy.requiredCaseSlices).every((slice) => sliceCoverage.has(slice))) return false
  for (const endpoint of RAG_OPERATION_ENDPOINTS) {
    for (const percentile of ["p50", "p95", "p99"] as const) {
      const signalId = `performance.${endpoint}_${percentile}_ms` as RagQualitySignalId
      if (!normalizedSlices(policy.requiredSlices[signalId]).includes(`stage=${endpoint}`)) return false
    }
    const operationalSlice = `endpoint=${endpoint}|stage=${endpoint}`
    for (const signalId of [
      "reliability.success_rate",
      "reliability.timeout_rate",
      "reliability.error_rate",
      "reliability.backlog_age_p99_ms",
      "reliability.retry_exhaustion_count"
    ] as const) {
      if (!normalizedSlices(policy.requiredSlices[signalId]).includes(operationalSlice)) return false
    }
  }
  for (const dependency of RAG_RECOVERY_DEPENDENCIES) {
    const slice = `dependency=${dependency}`
    for (const signalId of [
      "reliability.mttr_ms",
      "reliability.recovery_without_loss_rate",
      "reliability.recovery_loss_count",
      "reliability.recovery_scenario_coverage"
    ] as const) {
      if (!normalizedSlices(policy.requiredSlices[signalId]).includes(slice)) return false
    }
  }
  return true
}

function canonicalSliceValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown"
}

function normalizedSlices(value: string[] | undefined): string[] {
  const slices = [...new Set((value ?? []).map((slice) => slice.trim()).filter(Boolean))]
  return slices.length > 0 ? slices : ["overall"]
}

function compare(value: number, comparator: RagQualityComparator, threshold: number): boolean {
  if (comparator === "gte") return value >= threshold
  if (comparator === "lte") return value <= threshold
  return value === threshold
}

function regressionAmount(comparator: RagQualityComparator, value: number, baseline: number): number {
  if (comparator === "gte") return Math.max(0, baseline - value)
  if (comparator === "lte") return Math.max(0, value - baseline)
  return value === baseline ? 0 : Math.abs(value - baseline)
}

function validTimestamp(value: string): boolean {
  return Boolean(value.trim()) && Number.isFinite(Date.parse(value))
}

function actionsForDecision(decision: RagQualityDecision, policy: RagQualityPolicyProfile): RagSafetyAction[] {
  if (decision.status === "pass") return []
  const actions: RagSafetyAction[] = ["promotion_freeze"]
  if (decision.criticalViolation) actions.push("candidate_quarantine", "limited_answer")
  if (policy.responsePolicy.lastKnownSafeRuntimeVersion && decision.results.some((result) => result.reason === "regression_failed" || result.reason === "threshold_failed")) {
    actions.push("rollback_last_known_safe")
  }
  if (decision.results.some((result) => result.signalId.startsWith("reliability.") && result.status === "fail")) actions.push("limited_answer")
  return [...new Set(actions)]
}
