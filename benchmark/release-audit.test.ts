import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { buildRagReleaseAudit, scanRuntimeSource, validateArtifactManifest } from "./release-audit.js"

test("FR-075 deterministic release audit detects product-runtime dataset expectations and identity branches", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "rag-release-audit-scan-"))
  await mkdir(path.join(repoRoot, "apps/api/src"), { recursive: true })
  await writeFile(path.join(repoRoot, "apps/api/src/runtime.ts"), [
    "export function route(input: Record<string, string>) {",
    "  if (input.suiteId === 'dataset-v1') return input.expectedContains",
    "  return ''",
    "}"
  ].join("\n"))

  const first = await buildRagReleaseAudit({ repoRoot, sourceRoots: ["apps/api/src"], summary: validSummary() })
  const second = await buildRagReleaseAudit({ repoRoot, sourceRoots: ["apps/api/src"], summary: validSummary() })

  assert.equal(first.metrics.datasetSpecificBranchCount, 2)
  assert.deepEqual(first.datasetSpecificBranchFindings.map((item) => item.ruleId), [
    "dataset_expected_field_in_runtime",
    "dataset_identity_branch_in_runtime"
  ])
  assert.equal(first.metrics.artifactManifestMismatchCount, 0)
  assert.equal(first.auditId, second.auditId)
  assert.equal(first.sourceDigest, second.sourceDigest)
})

test("FR-075 release audit excludes tests and benchmark-only evaluation code from the product scan", () => {
  assert.deepEqual(scanRuntimeSource("apps/api/src/runtime.test.ts", "const expectedContains = 'fixture'"), [])
  assert.deepEqual(scanRuntimeSource("benchmark/runner.ts", "const expectedContains = 'fixture'"), [])
  assert.equal(scanRuntimeSource("apps/api/src/runtime.ts", "const answer = 'generic'\n").length, 0)
})

test("FR-075 artifact audit fails closed for unversioned or inconsistent manifests", () => {
  const invalid = validSummary() as Record<string, unknown>
  const suite = invalid.suite as Record<string, unknown>
  suite.datasetSource = { type: "local", datasetName: "dataset" }
  const candidate = invalid.candidateConfig as Record<string, unknown>
  candidate.runtimeProfileVersion = undefined
  invalid.total = 2

  const findings = validateArtifactManifest(invalid)
  const rules = new Set(findings.map((item) => item.ruleId))
  assert.ok(rules.has("dataset_version_missing"))
  assert.ok(rules.has("dataset_conversion_version_missing"))
  assert.ok(rules.has("runtimeProfileVersion_missing"))
  assert.ok(rules.has("prepare_dataset_source_mismatch"))
  assert.ok(rules.has("case_count_mismatch"))
})

function validSummary(): unknown {
  const datasetSource = {
    type: "local",
    path: "benchmark/dataset.jsonl",
    datasetName: "approved-dataset",
    datasetVersion: "dataset-v7",
    conversionVersion: "conversion-v2"
  }
  return {
    artifactContractVersion: 1,
    suite: {
      suiteId: "suite-v7",
      useCase: "internal_qa",
      runner: "agent",
      corpus: {
        suiteId: "suite-v7",
        source: "none",
        isolation: {
          source: "benchmark-runner",
          docType: "benchmark-corpus",
          aclGroups: ["BENCHMARK_RUNNER"],
          benchmarkSuiteId: "suite-v7"
        }
      },
      datasetSource,
      evaluatorProfile: "evaluator-v4",
      answerPolicy: {
        answerStyle: "benchmark_grounded_short",
        switchBy: "benchmark_metadata",
        normalAnswerPolicySeparated: true,
        runtimeDatasetBranchAllowed: false
      }
    },
    candidateConfig: {
      targetName: "candidate",
      modelId: "model-v2",
      embeddingModelId: "embed-v3",
      evaluatorProfile: "evaluator-v4",
      benchmarkSuiteId: "suite-v7",
      runner: "agent",
      runtimeProfileVersion: "runtime-v9",
      workloadProfileVersion: "workload-v3",
      corpusProfileVersion: "corpus-v2",
      aclDistributionVersion: "acl-v2",
      workloadConcurrency: 4,
      documentSizeProfileVersion: "document-size-v2",
      dependencyLatencyProfileVersion: "dependency-latency-v2",
      priceCatalogVersion: "price-v6",
      indexVersion: "index-v7",
      promptVersion: "prompt-v5",
      pipelineVersion: "pipeline-v8",
      parserVersion: "parser-v4",
      chunkerVersion: "chunker-v2"
    },
    caseResults: [{
      caseId: "case-1",
      status: 200,
      passed: true,
      failureReasons: [],
      retrieval: {},
      citation: {},
      slice: {
        questionType: "fact_lookup",
        tenantRole: "member",
        ocrMode: "native",
        language: "ja",
        multiEvidence: false,
        answerability: "answerable",
        severity: "high"
      },
      claims: [{
        claimId: "claim-1",
        severity: "high",
        requiresCitation: true,
        supported: true,
        citationIds: ["citation-1"],
        supportSpans: [{ documentId: "document-1", documentVersion: "v1", spanId: "span-1", locatorValid: true }]
      }],
      citations: [{
        citationId: "citation-1",
        claimIds: ["claim-1"],
        relevant: true,
        supportValid: true,
        locatorValid: true
      }],
      answerability: { expectedAnswerable: true, actualAnswerable: true, expectedResponseType: "answer", actualResponseType: "answer" },
      task: {
        expectedOutcome: "complete",
        actualOutcome: "complete",
        scenario: {
          actor: "member",
          goal: "approved answer",
          successCriteria: ["answer grounded"],
          allowedHandoffs: [],
          severity: "high"
        }
      },
      latency: {
        latencyMs: 10,
        stages: [{ endpoint: "chat", stage: "end_to_end", latencyMs: 10, backlogAgeMs: 0, outcome: "success", retryExhausted: false }]
      },
      cost: { usageComplete: false }
    }],
    datasetPrepareRuns: [{
      prepareRunId: "suite-v7:dataset-prepare",
      suiteId: "suite-v7",
      datasetSource,
      status: "succeeded",
      datasetPath: "benchmark/dataset.jsonl",
      seedManifest: [],
      skipManifest: [],
      generatedAt: "2026-07-11T00:00:00.000Z"
    }],
    seedManifest: [],
    skipManifest: [],
    generatedAt: "2026-07-11T00:00:00.000Z",
    total: 1,
    succeeded: 1,
    failedHttp: 0,
    metrics: {}
  }
}
