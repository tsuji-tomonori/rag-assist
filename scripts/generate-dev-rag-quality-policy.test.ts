import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateRagQualityPolicy,
  RAG_REQUIRED_SIGNAL_IDS
} from "../packages/contract/src/rag-quality-control.js"
import { ragRuntimePolicy } from "../apps/api/src/chat-orchestration/runtime-policy.js"
import { buildPipelineVersions } from "../apps/api/src/rag/offline/pre-retrieval/indexing/index-version-store.js"
import {
  buildDevRagQualityPolicy,
  DEV_RAG_QUALITY_POLICY_APPROVED_AT
} from "./generate-dev-rag-quality-policy.js"

test("approved dev policy covers every required signal and slice exactly once", () => {
  const policy = buildDevRagQualityPolicy()
  const expected = RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (
    policy.requiredSlices[signalId] ?? ["overall"]
  ).map((slice) => `${signalId}\u0000${slice}`))
  const actual = policy.gates.map((gate) => `${gate.signalId}\u0000${gate.slice}`)

  assert.equal(new Set(actual).size, actual.length)
  assert.deepEqual(actual.sort(), expected.sort())
})

test("dev policy records the explicit user approval for the policy and every threshold", () => {
  const policy = buildDevRagQualityPolicy()
  const decision = evaluateRagQualityPolicy(policy, [], "2026-07-16T00:00:00.000Z")

  assert.equal(policy.approvedBy, "tsuji-tomonori")
  assert.equal(policy.approvedAt, DEV_RAG_QUALITY_POLICY_APPROVED_AT)
  assert.equal(policy.runtimeProfileVersion, "1")
  assert.ok(policy.gates.every((gate) => (
    gate.thresholdApprovedBy === "tsuji-tomonori"
    && gate.thresholdApprovedAt === DEV_RAG_QUALITY_POLICY_APPROVED_AT
  )))
  assert.equal(decision.status, "fail")
  assert.ok(decision.results.every((result) => result.reason === "missing_signal"))
  assert.ok(Object.values(policy.evidenceVersions).every((version) => !version.includes("__")))
  assert.ok(Object.values(policy.workloadDimensions).every((value) => (
    typeof value === "number" || !value.includes("__")
  )))
})

test("all code-owned zero-tolerance signals use eq zero", () => {
  const policy = buildDevRagQualityPolicy()
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

test("code-owned policy versions match the product runtime", () => {
  const policy = buildDevRagQualityPolicy()
  const pipeline = buildPipelineVersions({
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    embeddingDimensions: 1024
  })

  assert.equal(policy.runtimeProfileVersion, ragRuntimePolicy.profile.version)
  assert.equal(policy.evidenceVersions.index, pipeline.indexVersion)
  assert.equal(policy.evidenceVersions.prompt, pipeline.promptVersion)
  assert.equal(policy.evidenceVersions.pipeline, pipeline.chatOrchestrationWorkflowVersion)
  assert.equal(policy.evidenceVersions.parser, pipeline.sourceExtractorVersion)
  assert.equal(policy.evidenceVersions.chunker, pipeline.chunkerVersion)
})
