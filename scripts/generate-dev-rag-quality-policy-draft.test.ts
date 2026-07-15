import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateRagQualityPolicy,
  RAG_REQUIRED_SIGNAL_IDS
} from "../packages/contract/src/rag-quality-control.js"
import { buildDevRagQualityPolicyDraft } from "./generate-dev-rag-quality-policy-draft.js"

test("dev policy draft covers every required signal and slice exactly once", () => {
  const policy = buildDevRagQualityPolicyDraft()
  const expected = RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (
    policy.requiredSlices[signalId] ?? ["overall"]
  ).map((slice) => `${signalId}\u0000${slice}`))
  const actual = policy.gates.map((gate) => `${gate.signalId}\u0000${gate.slice}`)

  assert.equal(new Set(actual).size, actual.length)
  assert.deepEqual(actual.sort(), expected.sort())
})

test("dev policy draft remains fail-closed until explicit approval", () => {
  const policy = buildDevRagQualityPolicyDraft()
  const decision = evaluateRagQualityPolicy(policy, [], "2026-07-16T00:00:00.000Z")

  assert.equal(policy.approvedBy, "")
  assert.equal(policy.approvedAt, "")
  assert.ok(policy.gates.every((gate) => gate.thresholdApprovedBy === "" && gate.thresholdApprovedAt === ""))
  assert.equal(decision.status, "fail")
  assert.ok(decision.results.some((result) => result.reason === "policy_invalid"))
})

test("all code-owned zero-tolerance signals use eq zero", () => {
  const policy = buildDevRagQualityPolicyDraft()
  const zeroTolerance = new Set([
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

  for (const gate of policy.gates.filter((candidate) => zeroTolerance.has(candidate.signalId))) {
    assert.equal(gate.comparator, "eq", gate.signalId)
    assert.equal(gate.threshold, 0, gate.signalId)
    assert.equal(gate.maximumRegression, undefined, gate.signalId)
  }
})
