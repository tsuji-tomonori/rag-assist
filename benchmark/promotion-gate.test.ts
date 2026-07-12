import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  buildRequiredRagQualitySlices,
  RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
  RAG_QUALITY_POLICY_SCHEMA_VERSION,
  RAG_QUALITY_SIGNAL_CATALOG_VERSION,
  RAG_REQUIRED_SIGNAL_IDS,
  type RagQualityObservation,
  type RagQualityPolicyProfile,
  type RagQualitySignalId
} from "@memorag-mvp/contract/rag-quality-control"
import { evaluatePromotionFiles } from "./promotion-gate.js"

const timestamp = "2026-07-11T00:00:00.000Z"
const requiredCaseSlices = {
  questionTypes: ["fact"], tenantRoles: ["tenant-a:chat-user"], ocrModes: ["native"], languages: ["ja"],
  multiEvidence: ["true"], answerability: ["answerable"], severities: ["high"]
} as const

function isHigherBetter(signalId: RagQualitySignalId): boolean {
  return /(coverage|accuracy|quality|integrity|correctness|recall|retention|faithfulness|precision|completeness|success_rate|completion_rate|locator_validity)$/.test(signalId)
}

function fixture(): { policy: RagQualityPolicyProfile; observations: RagQualityObservation[] } {
  const policy: RagQualityPolicyProfile = {
    schemaVersion: RAG_QUALITY_POLICY_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "approved-profile",
    version: "1",
    approvedBy: "owner",
    approvedAt: timestamp,
    workloadProfileVersion: "workload-1",
    runtimeProfileVersion: "runtime-1",
    priceCatalogVersion: "price-1",
    evidenceVersions: { dataset: "dataset-1", model: "model-1", index: "index-1", prompt: "prompt-1", pipeline: "pipeline-1", parser: "parser-1", chunker: "chunker-1" },
    workloadDimensions: { corpusProfileVersion: "corpus-1", aclDistributionVersion: "acl-1", concurrency: 4, documentSizeProfileVersion: "size-1", dependencyLatencyProfileVersion: "dependency-1" },
    requiredCaseSlices,
    changeControl: { purpose: "neutral" },
    requiredSlices: buildRequiredRagQualitySlices(requiredCaseSlices),
    gates: RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (buildRequiredRagQualitySlices(requiredCaseSlices)[signalId] ?? ["overall"]).map((slice) => ({
      signalId,
      slice,
      comparator: isHigherBetter(signalId) ? "gte" : "lte",
      threshold: signalId.endsWith("_count") ? 0 : isHigherBetter(signalId) ? 0.8 : 10_000,
      thresholdApprovedBy: "owner",
      thresholdApprovedAt: timestamp,
      minimumSampleCount: 1,
      minimumConfidence: 0.8
    }))),
    responsePolicy: {
      owner: "on-call",
      runbookVersion: "runbook-1",
      allowedActions: ["promotion_freeze", "candidate_quarantine", "limited_answer"]
    }
  }
  const observations: RagQualityObservation[] = RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (buildRequiredRagQualitySlices(requiredCaseSlices)[signalId] ?? ["overall"]).map((slice) => ({
    schemaVersion: RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "approved-profile",
    profileVersion: "1",
    signalId,
    slice,
    value: signalId.endsWith("_count") ? 0 : isHigherBetter(signalId) ? 0.95 : 10,
    available: true,
    sampleCount: 100,
    confidence: 0.99,
    observedAt: timestamp,
    workloadProfileVersion: "workload-1",
    runtimeProfileVersion: "runtime-1",
    priceCatalogVersion: "price-1",
    source: {
      producerVersion: "release-evidence-v1",
      artifactTypes: signalId.startsWith("release.") ? ["release_audit"] : ["benchmark_summary"],
      artifactIds: [`artifact:${signalId}`],
      versionDimensions: {
        dataset: ["dataset-1"],
        policy: ["approved-profile@1"],
        index: ["index-1"],
        model: ["model-1"],
        prompt: ["prompt-1"],
        pipeline: ["pipeline-1"],
        parser: ["parser-1"],
        chunker: ["chunker-1"],
        workload: ["workload-1"],
        runtime: ["runtime-1"],
        price: ["price-1"],
        ...(signalId.startsWith("release.") ? { releaseAudit: ["sha256:audit"] } : {})
      },
      missingVersionDimensions: []
    }
  })))
  return { policy, observations }
}

test("FR-075 executable promotion gate writes a pass decision only for complete approved evidence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rag-promotion-pass-"))
  const policyPath = path.join(dir, "policy.json")
  const observationsPath = path.join(dir, "observations.json")
  const outputPath = path.join(dir, "decision.json")
  const value = fixture()
  await writeFile(policyPath, JSON.stringify(value.policy))
  await writeFile(observationsPath, JSON.stringify(value.observations))

  const decision = await evaluatePromotionFiles({ policyPath, observationsPath, outputPath, evaluatedAt: timestamp })
  assert.equal(decision.status, "pass")
  assert.equal(JSON.parse(await readFile(outputPath, "utf-8")).status, "pass")
})

test("FR-075 executable promotion gate fails when a critical signal is absent", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rag-promotion-fail-"))
  const policyPath = path.join(dir, "policy.json")
  const observationsPath = path.join(dir, "observations.json")
  const value = fixture()
  value.observations = value.observations.filter((item) => item.signalId !== "security.unauthorized_exposure_count")
  await writeFile(policyPath, JSON.stringify(value.policy))
  await writeFile(observationsPath, JSON.stringify(value.observations))

  const decision = await evaluatePromotionFiles({ policyPath, observationsPath, evaluatedAt: timestamp })
  assert.equal(decision.status, "fail")
  assert.equal(decision.criticalViolation, true)
  assert.ok(decision.blockingReasons.includes("security.unauthorized_exposure_count[overall]:missing_signal"))
})

test("FR-075 executable promotion gate has no implicit policy or observation defaults", async () => {
  await assert.rejects(
    () => evaluatePromotionFiles({ policyPath: "", observationsPath: "" }),
    /versioned --policy path is required/
  )
})

test("FR-075 executable promotion gate rejects incomplete provenance and release signals without release-audit evidence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rag-promotion-provenance-"))
  const policyPath = path.join(dir, "policy.json")
  const observationsPath = path.join(dir, "observations.json")
  const value = fixture()
  value.observations.find((item) => item.signalId === "generation.faithfulness")!.source.missingVersionDimensions = ["prompt"]
  const release = value.observations.find((item) => item.signalId === "release.dataset_specific_branch_count")!
  release.source.artifactTypes = ["benchmark_summary"]
  delete release.source.versionDimensions.releaseAudit
  await writeFile(policyPath, JSON.stringify(value.policy))
  await writeFile(observationsPath, JSON.stringify(value.observations))

  const decision = await evaluatePromotionFiles({ policyPath, observationsPath, evaluatedAt: timestamp })
  assert.ok(decision.blockingReasons.includes("generation.faithfulness[overall]:profile_mismatch"))
  assert.ok(decision.blockingReasons.includes("release.dataset_specific_branch_count[overall]:profile_mismatch"))
})
