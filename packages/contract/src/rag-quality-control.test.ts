import assert from "node:assert/strict"
import test from "node:test"

import {
  buildRequiredRagQualitySlices,
  evaluateRagQualityPolicy,
  RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
  RAG_QUALITY_POLICY_SCHEMA_VERSION,
  RAG_QUALITY_SIGNAL_CATALOG_VERSION,
  RAG_REQUIRED_SIGNAL_IDS,
  runRagMonitoringControlLoop,
  type RagQualityComparator,
  type RagQualityObservation,
  type RagQualityPolicyProfile,
  type RagQualitySignalId,
  type RagSafetyAction
} from "./rag-quality-control.js"

const timestamp = "2026-07-11T00:00:00.000Z"
const requiredCaseSlices = {
  questionTypes: ["fact"],
  tenantRoles: ["tenant-a:chat-user"],
  ocrModes: ["native"],
  languages: ["ja"],
  multiEvidence: ["true"],
  answerability: ["answerable"],
  severities: ["high"]
} as const

function comparatorFor(signalId: RagQualitySignalId): RagQualityComparator {
  if (/(coverage|accuracy|quality|integrity|correctness|recall|retention|faithfulness|precision|completeness|success_rate|completion_rate|locator_validity)$/.test(signalId)) return "gte"
  return "lte"
}

function thresholdFor(signalId: RagQualitySignalId): number {
  if (signalId.endsWith("_count")) return 0
  return comparatorFor(signalId) === "gte" ? 0.8 : 10_000
}

function passingValue(signalId: RagQualitySignalId): number {
  if (signalId.endsWith("_count")) return 0
  return comparatorFor(signalId) === "gte" ? 0.95 : 10
}

function policy(): RagQualityPolicyProfile {
  return {
    schemaVersion: RAG_QUALITY_POLICY_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "production-rag",
    version: "2026-07-approved-1",
    approvedBy: "quality-owner",
    approvedAt: timestamp,
    workloadProfileVersion: "workload-v1",
    runtimeProfileVersion: "runtime-v2",
    priceCatalogVersion: "price-v3",
    evidenceVersions: { dataset: "dataset-v4", model: "model-v2", index: "index-v7", prompt: "prompt-v5", pipeline: "pipeline-v8", parser: "parser-v4", chunker: "chunker-v2" },
    workloadDimensions: { corpusProfileVersion: "corpus-v2", aclDistributionVersion: "acl-v3", concurrency: 8, documentSizeProfileVersion: "doc-size-v2", dependencyLatencyProfileVersion: "dependency-v4" },
    requiredCaseSlices,
    changeControl: { purpose: "neutral" },
    requiredSlices: buildRequiredRagQualitySlices(requiredCaseSlices),
    gates: RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (buildRequiredRagQualitySlices(requiredCaseSlices)[signalId] ?? ["overall"]).map((slice) => ({
      signalId,
      slice,
      comparator: comparatorFor(signalId),
      threshold: thresholdFor(signalId),
      thresholdApprovedBy: "quality-owner",
      thresholdApprovedAt: timestamp,
      minimumSampleCount: 1,
      minimumConfidence: 0.8,
      maximumRegression: 0.05
    }))),
    responsePolicy: {
      owner: "rag-on-call",
      runbookVersion: "rag-safety-runbook-v1",
      allowedActions: ["promotion_freeze", "candidate_quarantine", "limited_answer", "rollback_last_known_safe"],
      lastKnownSafeRuntimeVersion: "runtime-v1"
    }
  }
}

function observations(): RagQualityObservation[] {
  const required = buildRequiredRagQualitySlices(requiredCaseSlices)
  return RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (required[signalId] ?? ["overall"]).map((slice) => ({
    schemaVersion: RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "production-rag",
    profileVersion: "2026-07-approved-1",
    signalId,
    slice,
    value: passingValue(signalId),
    available: true,
    sampleCount: 100,
    confidence: 0.99,
    observedAt: timestamp,
    workloadProfileVersion: "workload-v1",
    runtimeProfileVersion: "runtime-v2",
    priceCatalogVersion: "price-v3",
    baselineValue: passingValue(signalId),
    traceIds: [`trace:${signalId}`],
    source: {
      producerVersion: "test-producer-v1",
      artifactTypes: signalId.startsWith("release.") ? ["release_audit"] : ["test"],
      artifactIds: [`test:${signalId}`],
      versionDimensions: {
        dataset: ["dataset-v4"],
        model: ["model-v2"],
        index: ["index-v7"],
        prompt: ["prompt-v5"],
        pipeline: ["pipeline-v8"],
        parser: ["parser-v4"],
        chunker: ["chunker-v2"],
        workload: ["workload-v1"],
        runtime: ["runtime-v2"],
        price: ["price-v3"],
        ...(signalId.startsWith("release.") ? { releaseAudit: ["sha256:test-release-audit"] } : {})
      },
      missingVersionDimensions: []
    }
  })))
}

test("FR-075 and SQ-005..015 pass only when every approved stage and slice gate passes", () => {
  const decision = evaluateRagQualityPolicy(policy(), observations(), timestamp)

  assert.equal(decision.status, "pass")
  assert.equal(decision.results.length, policy().gates.length)
  assert.ok(decision.results.every((result) => result.reason === "threshold_satisfied"))
  assert.equal(decision.criticalViolation, false)
})

test("FR-075 fails closed for missing or unapproved thresholds", () => {
  const missing = policy()
  missing.gates = missing.gates.filter((gate) => gate.signalId !== "generation.faithfulness")
  const missingDecision = evaluateRagQualityPolicy(missing, observations(), timestamp)
  assert.equal(missingDecision.status, "fail")
  assert.ok(missingDecision.blockingReasons.includes("generation.faithfulness[overall]:missing_threshold"))

  const unapproved = policy()
  const gate = unapproved.gates.find((candidate) => candidate.signalId === "citation.precision")!
  gate.thresholdApprovedBy = ""
  assert.ok(evaluateRagQualityPolicy(unapproved, observations(), timestamp).blockingReasons.includes("citation.precision[overall]:threshold_unapproved"))
})

test("SQ-005 zero-tolerance leak cannot be averaged away or weakened by a policy threshold", () => {
  const permissive = policy()
  const gate = permissive.gates.find((candidate) => candidate.signalId === "security.unauthorized_exposure_count")!
  gate.threshold = 999
  const observed = observations()
  observed.find((candidate) => candidate.signalId === "security.unauthorized_exposure_count")!.value = 1

  const decision = evaluateRagQualityPolicy(permissive, observed, timestamp)
  const result = decision.results.find((candidate) => candidate.signalId === "security.unauthorized_exposure_count")
  assert.equal(result?.reason, "zero_tolerance_violation")
  assert.equal(decision.status, "fail")
  assert.equal(decision.criticalViolation, true)
})

test("SQ-008 and SQ-015 reject missing values and workload/runtime/price profile mismatches", () => {
  const observed = observations()
  observed.find((candidate) => candidate.signalId === "performance.chat_p95_ms")!.value = null
  observed.find((candidate) => candidate.signalId === "cost.chat_per_request")!.priceCatalogVersion = "unknown-price"
  const unavailableWithStaleProfile = observed.find((candidate) => candidate.signalId === "cost.search_per_request")!
  unavailableWithStaleProfile.available = false
  unavailableWithStaleProfile.value = null
  unavailableWithStaleProfile.confidence = null
  unavailableWithStaleProfile.profileVersion = "stale-profile"

  const decision = evaluateRagQualityPolicy(policy(), observed, timestamp)
  assert.ok(decision.blockingReasons.includes("performance.chat_p95_ms[overall]:signal_value_missing"))
  assert.ok(decision.blockingReasons.includes("cost.chat_per_request[overall]:profile_mismatch"))
  assert.ok(decision.blockingReasons.includes("cost.search_per_request[overall]:profile_mismatch"))
})

test("FR-075 binds every observation to the exact approved dataset/model/index/prompt/pipeline/parser/chunker/runtime/workload/price versions", () => {
  const observed = observations()
  const target = observed.find((candidate) => candidate.signalId === "generation.faithfulness" && candidate.slice === "overall")!
  target.source.versionDimensions.model = ["model-v2", "unapproved-model"]

  const decision = evaluateRagQualityPolicy(policy(), observed, timestamp)
  assert.ok(decision.blockingReasons.includes("generation.faithfulness[overall]:profile_mismatch"))

  target.source.versionDimensions.model = ["model-v2"]
  delete target.source.versionDimensions.parser
  const missingDimensionDecision = evaluateRagQualityPolicy(policy(), observed, timestamp)
  assert.ok(missingDimensionDecision.blockingReasons.includes("generation.faithfulness[overall]:profile_mismatch"))
})

test("SQ-006..014 fail closed when a mandatory case, endpoint-stage, or recovery slice is omitted", () => {
  const incompletePolicy = policy()
  incompletePolicy.requiredSlices["evaluation.slice_case_count"] = ["overall"]
  assert.ok(evaluateRagQualityPolicy(incompletePolicy, observations(), timestamp).blockingReasons.includes("ingest.extraction_coverage[overall]:policy_invalid"))

  const completePolicy = policy()
  const missingSlice = "tenant_role=tenant-a-chat-user"
  const incompleteEvidence = observations().filter((observation) => !(
    observation.signalId === "evaluation.slice_case_count" && observation.slice === missingSlice
  ))
  assert.ok(evaluateRagQualityPolicy(completePolicy, incompleteEvidence, timestamp).blockingReasons.includes(`evaluation.slice_case_count[${missingSlice}]:missing_signal`))

  completePolicy.requiredSlices["reliability.mttr_ms"] = completePolicy.requiredSlices["reliability.mttr_ms"]?.filter((slice) => slice !== "dependency=queue")
  assert.ok(evaluateRagQualityPolicy(completePolicy, observations(), timestamp).blockingReasons.includes("ingest.extraction_coverage[overall]:policy_invalid"))
})

test("FR-075 maximum-regression and declared-improvement gates require approved baselines and achieved deltas", () => {
  const noBaseline = observations()
  const faithfulness = noBaseline.find((candidate) => candidate.signalId === "generation.faithfulness" && candidate.slice === "overall")!
  faithfulness.baselineValue = undefined
  assert.ok(evaluateRagQualityPolicy(policy(), noBaseline, timestamp).blockingReasons.includes("generation.faithfulness[overall]:baseline_missing"))

  const improvementPolicy = policy()
  improvementPolicy.changeControl = {
    purpose: "improvement",
    improvementCriteria: [{
      signalId: "generation.faithfulness",
      slice: "overall",
      direction: "increase",
      minimumDelta: 0.01,
      approvedBy: "quality-owner",
      approvedAt: timestamp
    }]
  }
  const noImprovement = observations()
  assert.ok(evaluateRagQualityPolicy(improvementPolicy, noImprovement, timestamp).blockingReasons.includes("generation.faithfulness[overall]:improvement_failed"))
  noImprovement.find((candidate) => candidate.signalId === "generation.faithfulness" && candidate.slice === "overall")!.value = 0.97
  assert.equal(evaluateRagQualityPolicy(improvementPolicy, noImprovement, timestamp).results.find((result) => result.signalId === "generation.faithfulness" && result.slice === "overall")?.reason, "threshold_satisfied")

  const falselyNeutral = policy()
  falselyNeutral.changeControl = improvementPolicy.changeControl
  falselyNeutral.changeControl = { ...falselyNeutral.changeControl, purpose: "neutral" }
  assert.ok(evaluateRagQualityPolicy(falselyNeutral, observations(), timestamp).blockingReasons.includes("ingest.extraction_coverage[overall]:policy_invalid"))
})

test("SQ-015 cost success is not accepted when an independent quality gate is missing", () => {
  const observed = observations().filter((candidate) => candidate.signalId !== "citation.completeness")
  const decision = evaluateRagQualityPolicy(policy(), observed, timestamp)

  assert.equal(decision.results.find((result) => result.signalId === "cost.chat_per_request")?.status, "pass")
  assert.equal(decision.status, "fail")
  assert.ok(decision.blockingReasons.includes("citation.completeness[overall]:missing_signal"))
})

test("FR-093 control loop notifies the approved owner and executes only approved safe actions", async () => {
  const observed = observations()
  observed.find((candidate) => candidate.signalId === "security.injection_success_count")!.value = 1
  const notifications: string[] = []
  const actions: RagSafetyAction[] = []

  const evidence = await runRagMonitoringControlLoop({
    policy: policy(),
    observations: observed,
    evaluatedAt: timestamp,
    notify: async (alert) => { notifications.push(`${alert.owner}:${alert.signalId}:${alert.severity}`) },
    executeAction: async (action) => { actions.push(action) }
  })

  assert.equal(evidence.decision.status, "fail")
  assert.ok(notifications.includes("rag-on-call:security.injection_success_count:critical"))
  assert.deepEqual(actions, ["promotion_freeze", "candidate_quarantine", "limited_answer"])
  assert.deepEqual(evidence.blockedActions, [])
})

test("SQ-010, SQ-011, and SQ-013 enforce zero tolerance at claim, required-citation, and critical business-outcome level", () => {
  const observed = observations()
  for (const signalId of [
    "generation.critical_unsupported_claim_count",
    "citation.required_claim_miss_count",
    "task.critical_failure_count"
  ] as const) {
    observed.find((candidate) => candidate.signalId === signalId && candidate.slice === "overall")!.value = 1
  }

  const decision = evaluateRagQualityPolicy(policy(), observed, timestamp)
  for (const signalId of [
    "generation.critical_unsupported_claim_count",
    "citation.required_claim_miss_count",
    "task.critical_failure_count"
  ] as const) {
    assert.equal(decision.results.find((result) => result.signalId === signalId && result.slice === "overall")?.reason, "zero_tolerance_violation")
  }
  assert.equal(decision.criticalViolation, true)
})

test("FR-093 invalid response actions fail policy validation without neutralizing code-owned safety actions", async () => {
  const invalidPolicy = policy()
  invalidPolicy.responsePolicy.allowedActions = []
  const observed = observations()
  observed.find((candidate) => candidate.signalId === "security.secret_exposure_count" && candidate.slice === "overall")!.value = 1
  const executed: RagSafetyAction[] = []

  const evidence = await runRagMonitoringControlLoop({
    policy: invalidPolicy,
    observations: observed,
    evaluatedAt: timestamp,
    notify: async () => undefined,
    executeAction: async (action) => { executed.push(action) }
  })

  assert.ok(evidence.decision.blockingReasons.includes("ingest.extraction_coverage[overall]:policy_invalid"))
  assert.deepEqual(executed, ["promotion_freeze", "candidate_quarantine", "limited_answer"])
  assert.deepEqual(evidence.blockedActions, [])

  const missingMandatoryActions = policy()
  missingMandatoryActions.responsePolicy.lastKnownSafeRuntimeVersion = undefined
  missingMandatoryActions.responsePolicy.allowedActions = ["document_quarantine"]
  assert.ok(evaluateRagQualityPolicy(missingMandatoryActions, observations(), timestamp).blockingReasons.includes("ingest.extraction_coverage[overall]:policy_invalid"))
})
