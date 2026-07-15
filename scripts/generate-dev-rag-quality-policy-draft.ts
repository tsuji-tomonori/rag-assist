import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  buildRequiredRagQualitySlices,
  RAG_QUALITY_POLICY_SCHEMA_VERSION,
  RAG_QUALITY_SIGNAL_CATALOG_VERSION,
  RAG_REQUIRED_SIGNAL_IDS,
  type RagQualityComparator,
  type RagQualityGate,
  type RagQualityPolicyProfile,
  type RagQualitySignalId
} from "../packages/contract/src/rag-quality-control.js"

const ZERO_TOLERANCE_SIGNALS = new Set<RagQualitySignalId>([
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

const HIGHER_IS_BETTER = new Set<RagQualitySignalId>([
  "ingest.extraction_coverage",
  "ingest.parser_ocr_accuracy",
  "ingest.locator_validity",
  "ingest.chunk_structure_quality",
  "ingest.manifest_integrity",
  "ingest.admission_correctness",
  "retrieval.authorized_recall_at_k",
  "evidence.retention_rate",
  "generation.faithfulness",
  "citation.precision",
  "citation.completeness",
  "citation.locator_validity",
  "task.completion_rate",
  "task.outcome_accuracy",
  "security.eligibility_matrix_coverage",
  "reliability.success_rate",
  "reliability.recovery_without_loss_rate",
  "reliability.recovery_scenario_coverage"
])

const BASE_THRESHOLDS: Record<RagQualitySignalId, number> = {
  "ingest.extraction_coverage": 0.98,
  "ingest.parser_ocr_accuracy": 0.9,
  "ingest.silent_truncation_count": 0,
  "ingest.locator_validity": 0.99,
  "ingest.chunk_structure_quality": 0.95,
  "ingest.manifest_integrity": 1,
  "ingest.admission_correctness": 1,
  "retrieval.authorized_recall_at_k": 0.7,
  "retrieval.false_denial_rate": 0.05,
  "evidence.retention_rate": 0.95,
  "generation.faithfulness": 0.9,
  "generation.unsupported_claim_rate": 0.05,
  "generation.critical_unsupported_claim_count": 0,
  "citation.precision": 0.95,
  "citation.completeness": 0.95,
  "citation.locator_validity": 0.99,
  "citation.required_claim_miss_count": 0,
  "answerability.false_answer_rate": 0.05,
  "answerability.false_refusal_rate": 0.1,
  "task.completion_rate": 0.85,
  "task.outcome_accuracy": 0.9,
  "task.critical_failure_count": 0,
  "evaluation.slice_case_count": 20,
  "security.unauthorized_exposure_count": 0,
  "security.injection_success_count": 0,
  "security.secret_exposure_count": 0,
  "security.eligibility_matrix_coverage": 1,
  "security.eligibility_unreconciled_resource_count": 0,
  "security.eligibility_propagation_p50_ms": 5_000,
  "security.eligibility_propagation_p95_ms": 30_000,
  "security.eligibility_propagation_p99_ms": 60_000,
  "security.eligibility_propagation_max_ms": 120_000,
  "performance.chat_p50_ms": 10_000,
  "performance.chat_p95_ms": 30_000,
  "performance.chat_p99_ms": 60_000,
  "performance.search_p50_ms": 2_000,
  "performance.search_p95_ms": 5_000,
  "performance.search_p99_ms": 10_000,
  "performance.ingest_p50_ms": 60_000,
  "performance.ingest_p95_ms": 300_000,
  "performance.ingest_p99_ms": 600_000,
  "reliability.success_rate": 0.95,
  "reliability.timeout_rate": 0.02,
  "reliability.error_rate": 0.05,
  "reliability.backlog_age_p99_ms": 300_000,
  "reliability.retry_exhaustion_count": 0,
  "reliability.mttr_ms": 1_800_000,
  "reliability.recovery_without_loss_rate": 1,
  "reliability.recovery_loss_count": 0,
  "reliability.recovery_scenario_coverage": 1,
  "cost.chat_per_request": 0.02,
  "cost.search_per_request": 0.005,
  "cost.ingest_per_document": 0.1,
  "release.dataset_specific_branch_count": 0,
  "release.artifact_manifest_mismatch_count": 0
}

const MAXIMUM_REGRESSION: Partial<Record<RagQualitySignalId, number>> = {
  "retrieval.authorized_recall_at_k": 0.05,
  "retrieval.false_denial_rate": 0.01,
  "evidence.retention_rate": 0.03,
  "generation.faithfulness": 0.03,
  "generation.unsupported_claim_rate": 0.01,
  "citation.precision": 0.03,
  "citation.completeness": 0.03,
  "citation.locator_validity": 0.01,
  "answerability.false_answer_rate": 0.01,
  "answerability.false_refusal_rate": 0.03,
  "task.completion_rate": 0.05,
  "task.outcome_accuracy": 0.05,
  "performance.chat_p95_ms": 5_000,
  "performance.search_p95_ms": 1_000,
  "performance.ingest_p95_ms": 60_000,
  "reliability.success_rate": 0.01,
  "reliability.timeout_rate": 0.01,
  "reliability.error_rate": 0.01,
  "cost.chat_per_request": 0.002,
  "cost.search_per_request": 0.001,
  "cost.ingest_per_document": 0.02
}

const requiredCaseSlices = {
  questionTypes: ["direct_fact", "multi_statement_synthesis", "comparison"],
  tenantRoles: ["chat_user", "answer_editor", "system_admin"],
  ocrModes: ["native", "ocr"],
  languages: ["ja", "en"],
  multiEvidence: ["true", "false"] as const,
  answerability: ["answerable", "unanswerable"],
  severities: ["critical", "high", "medium"]
}

export function buildDevRagQualityPolicyDraft(): RagQualityPolicyProfile {
  const requiredSlices = buildRequiredRagQualitySlices(requiredCaseSlices)
  const gates = RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (
    requiredSlices[signalId] ?? ["overall"]
  ).map((slice) => buildGate(signalId, slice)))

  return {
    schemaVersion: RAG_QUALITY_POLICY_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "memorag-dev-rag-quality",
    version: "2026-07-16.draft-1",
    approvedBy: "",
    approvedAt: "",
    workloadProfileVersion: "__RAG_WORKLOAD_PROFILE_VERSION__",
    runtimeProfileVersion: "__RAG_RUNTIME_PROFILE_VERSION__",
    priceCatalogVersion: "__RAG_PRICE_CATALOG_VERSION__",
    evidenceVersions: {
      dataset: "__RAG_DATASET_VERSION__",
      model: "amazon.nova-lite-v1:0",
      index: "__RAG_INDEX_VERSION__",
      prompt: "__RAG_PROMPT_VERSION__",
      pipeline: "__RAG_PIPELINE_VERSION__",
      parser: "__RAG_PARSER_VERSION__",
      chunker: "__RAG_CHUNKER_VERSION__"
    },
    workloadDimensions: {
      corpusProfileVersion: "__RAG_CORPUS_PROFILE_VERSION__",
      aclDistributionVersion: "__RAG_ACL_DISTRIBUTION_VERSION__",
      concurrency: 4,
      documentSizeProfileVersion: "__RAG_DOCUMENT_SIZE_PROFILE_VERSION__",
      dependencyLatencyProfileVersion: "__RAG_DEPENDENCY_LATENCY_PROFILE_VERSION__"
    },
    requiredCaseSlices,
    changeControl: { purpose: "neutral" },
    requiredSlices,
    gates,
    responsePolicy: {
      owner: "memorag-dev-on-call",
      runbookVersion: "OPS_MONITORING_001@2026-07-14",
      allowedActions: ["promotion_freeze", "candidate_quarantine", "limited_answer", "refuse_answer"]
    }
  }
}

function buildGate(signalId: RagQualitySignalId, slice: string): RagQualityGate {
  const zeroTolerance = ZERO_TOLERANCE_SIGNALS.has(signalId)
  const maximumRegression = zeroTolerance ? undefined : MAXIMUM_REGRESSION[signalId]
  return {
    signalId,
    slice,
    comparator: comparatorFor(signalId),
    threshold: thresholdFor(signalId, slice),
    thresholdApprovedBy: "",
    thresholdApprovedAt: "",
    minimumSampleCount: minimumSampleCountFor(signalId, slice),
    minimumConfidence: minimumConfidenceFor(signalId),
    ...(maximumRegression === undefined ? {} : { maximumRegression })
  }
}

function comparatorFor(signalId: RagQualitySignalId): RagQualityComparator {
  if (ZERO_TOLERANCE_SIGNALS.has(signalId)) return "eq"
  return HIGHER_IS_BETTER.has(signalId) || signalId === "evaluation.slice_case_count" ? "gte" : "lte"
}

function thresholdFor(signalId: RagQualitySignalId, slice: string): number {
  if (signalId === "evaluation.slice_case_count" && slice === "overall") return 100
  return BASE_THRESHOLDS[signalId]
}

function minimumSampleCountFor(signalId: RagQualitySignalId, slice: string): number {
  if (signalId === "evaluation.slice_case_count" || signalId.startsWith("release.")) return 1
  if (signalId.startsWith("reliability.recovery") || signalId === "reliability.mttr_ms") return 4
  if (slice.startsWith("dependency=")) return 4
  if (slice !== "overall" && !slice.startsWith("endpoint=") && !slice.startsWith("stage=")) return 20
  return 100
}

function minimumConfidenceFor(signalId: RagQualitySignalId): number {
  if (ZERO_TOLERANCE_SIGNALS.has(signalId) || signalId.startsWith("release.")) return 1
  if (signalId === "evaluation.slice_case_count") return 1
  return 0.95
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const outputPath = path.join(repoRoot, "config/rag-quality/dev-policy.draft.json")
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(buildDevRagQualityPolicyDraft(), null, 2)}\n`, "utf-8")
  process.stdout.write(`${outputPath}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
