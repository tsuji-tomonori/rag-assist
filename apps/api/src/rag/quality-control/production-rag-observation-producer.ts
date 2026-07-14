import { createHash, randomUUID } from "node:crypto"

import {
  RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
  RAG_QUALITY_SIGNAL_CATALOG_VERSION,
  RAG_REQUIRED_SIGNAL_IDS,
  requiredCaseSliceNames,
  type RagQualityObservation,
  type RagQualityPolicyProfile,
  type RagQualitySignalId
} from "@memorag-mvp/contract/rag-quality-control"
import type { RagGuardOutcome, SafeDegradationDecision } from "../_shared/security/safe-degradation-policy.js"

import type { ObjectStore } from "../../adapters/object-store.js"
import { tenantPartitionId } from "../../security/tenant-partition.js"
import type {
  BenchmarkRun,
  ChatRun,
  DebugTrace,
  DocumentIngestRun,
  DocumentManifest,
  PipelineVersions,
  SearchScope,
  WorkerResult
} from "../../types.js"
import { ACTIVE_RAG_QUALITY_POLICY_KEY, type ProductionRagMonitor } from "./production-rag-monitor.js"

export const PRODUCTION_RAG_OBSERVATION_PRODUCER_VERSION = "production-rag-observation-producer-v1"
const sourceSamplePrefix = "quality-control/source-samples/"
const requiredVersionDimensions = ["dataset", "model", "index", "prompt", "pipeline", "parser", "chunker", "runtime", "workload", "price"] as const

export type RagQualityVersionContext = Partial<Record<(typeof requiredVersionDimensions)[number], string>>

export type RagObservationSourceType =
  | "ingest_manifest"
  | "debug_trace"
  | "normal_chat"
  | "search_runtime"
  | "worker_outcome"
  | "benchmark_summary"
  | "release_audit"
  | "eligibility_probe"

export type RagSignalMeasurement = {
  available: boolean
  value: number | null
  sampleCount: number
  confidence: number | null
  unavailableReason?: string
}

export type RagQualitySourceSample = {
  schemaVersion: 1
  signalCatalogVersion: typeof RAG_QUALITY_SIGNAL_CATALOG_VERSION
  profileId: string
  profileVersion: string
  workloadProfileVersion: string
  runtimeProfileVersion: string
  priceCatalogVersion: string
  sourceType: RagObservationSourceType
  artifactId: string
  tenantPartitionId?: string
  resourceIds?: string[]
  securityResourceRefs?: string[]
  slice: string
  observedAt: string
  traceIds: string[]
  versionDimensions: Record<string, string[]>
  missingVersionDimensions: string[]
  measurements: Partial<Record<RagQualitySignalId, RagSignalMeasurement>>
  proxyMeasurements?: Record<string, { value: number; label: string }>
  guardOutcomes?: RagGuardOutcome[]
  degradationDecisions?: SafeDegradationDecision[]
}

export type ObservationCaptureResult = {
  recorded: number
  skippedReason?: "active_policy_unavailable" | "artifact_outside_profile"
}

type EligibilityProbeMarker = {
  schemaVersion: 1
  probeId: string
  detectedAt: string
  propagationMs: number
  tenantId?: string
  roles?: string[]
  pipelineVersions?: PipelineVersions
  versionDimensions?: RagQualityVersionContext
  status: "pending" | "recorded"
  recordedAt?: string
}

type CaptureContext = {
  tenantId?: string
  resourceIds?: string[]
  securityResourceRefs?: string[]
  roles?: string[]
  useCase: "chat" | "search" | "ingest" | "benchmark" | "worker" | "release" | "eligibility"
  extraSlices?: string[]
  onlySlices?: string[]
}

export class ProductionRagObservationProducer {
  constructor(private readonly objectStore: ObjectStore) {}

  async captureIngestManifest(input: {
    manifest: DocumentManifest
    latencyMs?: number
    roles?: string[]
    observedAt?: string
  }): Promise<ObservationCaptureResult> {
    const manifest = input.manifest
    const inputChars = finiteNumber(manifest.parsedDocument?.inputCharCount)
    const outputChars = finiteNumber(manifest.parsedDocument?.outputCharCount)
    const explicitTruncation = (manifest.extractionWarnings ?? []).some((warning) => warning.code === "extraction_content_truncated")
    const chunks = manifest.chunks ?? []
    const validLocators = chunks.filter((chunk) => hasLocator(chunk.sourceLocation)).length
    const inventoryMatches = manifest.vectorKeys.length === (manifest.evidenceVectorKeys?.length ?? 0) + (manifest.memoryVectorKeys?.length ?? 0)
      && manifest.chunkCount === manifest.derivedIntegrity?.expectedChunkCount
      && manifest.memoryCardCount === manifest.derivedIntegrity?.expectedMemoryCardCount
    const measurements: RagQualitySourceSample["measurements"] = {
      "ingest.extraction_coverage": measurement(
        inputChars !== undefined && outputChars !== undefined && inputChars > 0 ? Math.min(1, outputChars / inputChars) : undefined,
        1,
        "extraction_input_or_output_count_missing"
      ),
      "ingest.parser_ocr_accuracy": unavailable("parser_or_ocr_ground_truth_missing"),
      "ingest.silent_truncation_count": measurement(
        inputChars !== undefined && outputChars !== undefined
          ? inputChars > outputChars && !explicitTruncation ? 1 : 0
          : undefined,
        1,
        "extraction_input_or_output_count_missing"
      ),
      "ingest.locator_validity": measurement(
        chunks.length > 0 ? validLocators / chunks.length : undefined,
        chunks.length,
        "chunk_locator_population_missing"
      ),
      "ingest.chunk_structure_quality": measurement(
        manifest.chunkingPolicy ? (manifest.chunkingViolations?.length ?? 0) === 0 ? 1 : 0 : undefined,
        1,
        "chunking_policy_missing"
      ),
      "ingest.manifest_integrity": measurement(manifest.derivedIntegrity ? (manifest.derivedIntegrity.verified ? 1 : 0) : undefined, 1, "derived_integrity_missing"),
      "ingest.admission_correctness": unavailable("admission_ground_truth_missing"),
      "performance.ingest_p50_ms": measurement(input.latencyMs, input.latencyMs === undefined ? 0 : 1, "ingest_latency_missing"),
      "performance.ingest_p95_ms": measurement(input.latencyMs, input.latencyMs === undefined ? 0 : 1, "ingest_latency_missing"),
      "performance.ingest_p99_ms": measurement(input.latencyMs, input.latencyMs === undefined ? 0 : 1, "ingest_latency_missing"),
      "release.artifact_manifest_mismatch_count": measurement(manifest.derivedIntegrity ? (manifest.derivedIntegrity.verified && inventoryMatches ? 0 : 1) : undefined, 1, "derived_integrity_missing")
    }
    return this.capture({
      sourceType: "ingest_manifest",
      artifactId: manifest.documentId,
      observedAt: input.observedAt ?? manifest.updatedAt ?? manifest.createdAt,
      traceIds: [`manifest:${manifest.documentId}`],
      versionDimensions: versionsFromPipeline(manifest.pipelineVersions, {
        policy: manifest.admission?.usagePolicyRef?.version,
        index: manifest.indexVersion,
        model: manifest.embeddingModelId,
        prompt: manifest.memoryPromptVersion,
        parser: manifest.sourceExtractorVersion,
        chunker: manifest.chunkerVersion
      }),
      measurements,
      context: {
        tenantId: manifest.admission?.tenantId ?? stringMetadata(manifest, "tenantId"),
        resourceIds: [manifest.documentId, manifest.publicationControl?.sourceId ?? ""],
        roles: input.roles,
        useCase: "ingest",
        extraSlices: [manifest.fileProfile ? `file_profile=${safeSliceValue(manifest.fileProfile)}` : ""]
      }
    })
  }

  async captureDebugTrace(trace: DebugTrace, context: { tenantId?: string; roles?: string[] } = {}): Promise<ObservationCaptureResult> {
    const retrievedCount = trace.retrieved.length
    const finalEvidenceCount = trace.finalEvidence?.length ?? 0
    const citations = trace.citations
    const validCitationLocators = citations.filter(hasCitationLocator).length
    const measurements: RagQualitySourceSample["measurements"] = {
      "evidence.retention_rate": measurement(retrievedCount > 0 ? finalEvidenceCount / retrievedCount : undefined, retrievedCount, "retrieved_evidence_population_empty"),
      "generation.faithfulness": unavailable("claim_support_measurement_not_retained_in_sanitized_trace"),
      "generation.unsupported_claim_rate": unavailable("claim_support_measurement_not_retained_in_sanitized_trace"),
      "generation.critical_unsupported_claim_count": unavailable("claim_support_measurement_not_retained_in_sanitized_trace"),
      "citation.precision": unavailable("citation_ground_truth_missing"),
      "citation.completeness": unavailable("claim_to_citation_ground_truth_missing"),
      "citation.locator_validity": measurement(citations.length > 0 ? validCitationLocators / citations.length : undefined, citations.length, "citation_population_empty"),
      "citation.required_claim_miss_count": unavailable("claim_to_citation_ground_truth_missing"),
      "answerability.false_answer_rate": unavailable("answerability_ground_truth_missing"),
      "answerability.false_refusal_rate": unavailable("answerability_ground_truth_missing"),
      "task.completion_rate": unavailable("business_outcome_ground_truth_missing"),
      "task.outcome_accuracy": unavailable("business_outcome_ground_truth_missing"),
      "task.critical_failure_count": unavailable("business_outcome_ground_truth_missing"),
      "security.unauthorized_exposure_count": unavailable("must_not_access_observation_coverage_incomplete"),
      "security.injection_success_count": unavailable("injection_attack_ground_truth_missing"),
      "security.secret_exposure_count": unavailable("secret_canary_coverage_incomplete"),
      "performance.chat_p50_ms": measurement(trace.totalLatencyMs, 1, "chat_latency_missing"),
      "performance.chat_p95_ms": measurement(trace.totalLatencyMs, 1, "chat_latency_missing"),
      "performance.chat_p99_ms": measurement(trace.totalLatencyMs, 1, "chat_latency_missing"),
      "reliability.success_rate": measurement(trace.status === "error" ? 0 : 1, 1),
      "reliability.error_rate": measurement(trace.status === "error" ? 1 : 0, 1)
    }
    return this.capture({
      sourceType: "debug_trace",
      artifactId: trace.runId,
      observedAt: trace.completedAt,
      traceIds: [trace.runId],
      versionDimensions: versionsFromTrace(trace),
      measurements,
      context: {
        tenantId: context.tenantId,
        roles: context.roles,
        useCase: "chat",
        resourceIds: uniqueStrings([...trace.retrieved, ...(trace.finalEvidence ?? []), ...trace.citations].map((item) => item.documentId)),
        securityResourceRefs: trace.securityResourceRefs
      }
    })
  }

  async captureChatOutcome(input: {
    runId: string
    observedAt: string
    latencyMs: number
    tenantId: string
    roles: string[]
    resourceIds: string[]
    securityResourceRefs: readonly string[]
    pipelineVersions: PipelineVersions
    modelId: string
    retrievedCount: number
    finalEvidenceCount: number
    citationCount: number
    validCitationCount: number
    requiredFactCount: number
    supportedFactCount: number
    answerSentenceCount: number
    unsupportedSentenceCount: number
    answerSupportConfidence: number
    isAnswerable: boolean
    sufficientContextAnswerable: boolean
    injectionFindingCount: number
    injectionSuccessCount: number
    guardOutcomes: RagGuardOutcome[]
    decisions: SafeDegradationDecision[]
  }): Promise<ObservationCaptureResult> {
    const supportedRate = input.answerSentenceCount > 0
      ? Math.max(0, 1 - input.unsupportedSentenceCount / input.answerSentenceCount)
      : input.isAnswerable ? 0 : 1
    return this.capture({
      sourceType: "normal_chat",
      artifactId: input.runId,
      observedAt: input.observedAt,
      traceIds: [input.runId],
      versionDimensions: versionsFromPipeline(input.pipelineVersions, { model: input.modelId }),
      measurements: {
        "evidence.retention_rate": measurement(input.retrievedCount > 0 ? input.finalEvidenceCount / input.retrievedCount : undefined, input.retrievedCount, "retrieved_evidence_population_empty"),
        "generation.faithfulness": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=answer_support_rate"),
        "generation.unsupported_claim_rate": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=unsupported_sentence_rate"),
        "generation.critical_unsupported_claim_count": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=unsupported_sentence_count"),
        "citation.precision": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=locator_validity"),
        "citation.completeness": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=required_fact_support_rate"),
        "citation.locator_validity": measurement(input.citationCount > 0 ? input.validCitationCount / input.citationCount : 1, Math.max(1, input.citationCount)),
        "citation.required_claim_miss_count": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=required_fact_miss_count"),
        "answerability.false_answer_rate": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=runtime_unsupported_answer"),
        "answerability.false_refusal_rate": unavailable("reviewed_or_delayed_ground_truth_missing;proxy=sufficient_context_refusal"),
        "security.injection_success_count": unavailable("reviewed_attack_outcome_missing;proxy=runtime_injection_guard"),
        "performance.chat_p50_ms": measurement(input.latencyMs, 1),
        "performance.chat_p95_ms": measurement(input.latencyMs, 1),
        "performance.chat_p99_ms": measurement(input.latencyMs, 1),
        "reliability.success_rate": measurement(1, 1),
        "reliability.error_rate": measurement(0, 1)
      },
      proxyMeasurements: {
        answerSupportRate: { value: supportedRate, label: "runtime_proxy_not_reviewed_ground_truth" },
        unsupportedSentenceRate: { value: input.answerSentenceCount > 0 ? input.unsupportedSentenceCount / input.answerSentenceCount : 0, label: "runtime_proxy_not_reviewed_ground_truth" },
        requiredFactSupportRate: { value: input.requiredFactCount > 0 ? input.supportedFactCount / input.requiredFactCount : 1, label: "runtime_proxy_not_reviewed_ground_truth" },
        runtimeFalseAnswerIndicator: { value: input.isAnswerable && input.unsupportedSentenceCount > 0 ? 1 : 0, label: "runtime_proxy_not_reviewed_ground_truth" },
        runtimeFalseRefusalIndicator: { value: !input.isAnswerable && input.sufficientContextAnswerable ? 1 : 0, label: "runtime_proxy_not_reviewed_ground_truth" },
        runtimeInjectionGuardIndicator: { value: input.injectionSuccessCount, label: "runtime_proxy_not_reviewed_attack_outcome" }
      },
      guardOutcomes: input.guardOutcomes,
      degradationDecisions: input.decisions,
      context: {
        tenantId: input.tenantId,
        roles: input.roles,
        resourceIds: input.resourceIds,
        securityResourceRefs: [...input.securityResourceRefs],
        useCase: "chat",
        extraSlices: [`degradation=${input.decisions.length > 0 ? "fault" : "normal"}`]
      }
    })
  }

  async deleteArtifactSamples(sourceType: RagObservationSourceType, artifactId: string, tenantId: string): Promise<number> {
    if (!tenantId.trim() || tenantId.trim() !== tenantId) throw new Error("Quality sample deletion tenant is invalid")
    const tenantPartition = tenantPartitionId(tenantId)
    const keys = await this.objectStore.listKeys(`${sourceSamplePrefix}${safeKeyPart(tenantPartition)}/`)
    const matching: string[] = []
    for (const key of keys.filter((candidate) => candidate.endsWith(".json"))) {
      try {
        const sample = JSON.parse(await this.objectStore.getText(key)) as Partial<RagQualitySourceSample>
        if (sample.tenantPartitionId === tenantPartition && sample.sourceType === sourceType && sample.artifactId === artifactId) matching.push(key)
      } catch {
        // Malformed samples remain the monitor's responsibility; never infer
        // that they belong to the revoked artifact without a verified ID.
      }
    }
    await Promise.all(matching.map((key) => this.objectStore.deleteObject(key)))
    return matching.length
  }

  async captureSearchRuntime(input: {
    latencyMs: number
    indexVersion?: string
    profileId?: string
    profileVersion?: string
    embeddingModelId?: string
    tenantId?: string
    roles?: string[]
    searchScope?: SearchScope
    observedAt?: string
    artifactId?: string
    succeeded?: boolean
    failureCode?: "authorization_denied" | "safety_interlock" | "dependency_error"
  }): Promise<ObservationCaptureResult> {
    const artifactId = input.artifactId ?? `search_${randomUUID()}`
    return this.capture({
      sourceType: "search_runtime",
      artifactId,
      observedAt: input.observedAt ?? new Date().toISOString(),
      traceIds: [artifactId],
      versionDimensions: compactVersions({
        policy: [input.profileId, input.profileVersion].filter(isString).join("@"),
        index: input.indexVersion,
        model: input.embeddingModelId
      }),
      measurements: {
        "retrieval.authorized_recall_at_k": unavailable("authorized_retrieval_ground_truth_missing"),
        "retrieval.false_denial_rate": unavailable("authorized_retrieval_ground_truth_missing"),
        "performance.search_p50_ms": measurement(input.latencyMs, 1),
        "performance.search_p95_ms": measurement(input.latencyMs, 1),
        "performance.search_p99_ms": measurement(input.latencyMs, 1),
        "reliability.success_rate": measurement(input.succeeded === false ? 0 : 1, 1),
        "reliability.error_rate": measurement(input.succeeded === false ? 1 : 0, 1)
      },
      context: {
        tenantId: input.tenantId,
        resourceIds: input.searchScope?.documentIds,
        roles: input.roles,
        useCase: "search",
        extraSlices: [
          input.searchScope?.mode ? `scope=${safeSliceValue(input.searchScope.mode)}` : "",
          `outcome=${input.succeeded === false ? "failure" : "success"}`,
          input.failureCode ? `failure=${safeSliceValue(input.failureCode)}` : ""
        ]
      }
    })
  }

  async captureWorkerOutcome(input: {
    result: WorkerResult
    run: Pick<ChatRun | DocumentIngestRun, "createdAt" | "startedAt" | "completedAt" | "tenantId" | "userGroups" | "securityResourceRefs">
    observedAt?: string
  }): Promise<ObservationCaptureResult> {
    const startedAt = timestampMs(input.run.startedAt)
    const completedAt = timestampMs(input.run.completedAt)
    const createdAt = timestampMs(input.run.createdAt)
    const isIngest = input.result.targetType === "document_ingest_run"
    const isChat = input.result.targetType === "chat_run"
    const latencyMs = startedAt !== undefined && completedAt !== undefined ? Math.max(0, completedAt - startedAt) : undefined
    const measurements: RagQualitySourceSample["measurements"] = {
      "reliability.success_rate": measurement(input.result.resultType === "succeeded" ? 1 : 0, 1),
      "reliability.error_rate": measurement(input.result.resultType === "failed" ? 1 : 0, 1),
      "reliability.timeout_rate": unavailable("worker_timeout_classification_missing"),
      "reliability.retry_exhaustion_count": unavailable("worker_retry_exhaustion_missing"),
      "reliability.backlog_age_p99_ms": measurement(createdAt !== undefined && startedAt !== undefined ? Math.max(0, startedAt - createdAt) : undefined, 1, "worker_start_timestamp_missing"),
      "reliability.mttr_ms": unavailable("failure_recovery_correlation_missing"),
      ...(isIngest ? {
        "performance.ingest_p50_ms": measurement(latencyMs, latencyMs === undefined ? 0 : 1, "worker_latency_missing"),
        "performance.ingest_p95_ms": measurement(latencyMs, latencyMs === undefined ? 0 : 1, "worker_latency_missing"),
        "performance.ingest_p99_ms": measurement(latencyMs, latencyMs === undefined ? 0 : 1, "worker_latency_missing")
      } : {}),
      ...(isChat ? {
        "performance.chat_p50_ms": measurement(latencyMs, latencyMs === undefined ? 0 : 1, "worker_latency_missing"),
        "performance.chat_p95_ms": measurement(latencyMs, latencyMs === undefined ? 0 : 1, "worker_latency_missing"),
        "performance.chat_p99_ms": measurement(latencyMs, latencyMs === undefined ? 0 : 1, "worker_latency_missing")
      } : {})
    }
    return this.capture({
      sourceType: "worker_outcome",
      artifactId: input.result.runId,
      observedAt: input.observedAt ?? input.run.completedAt ?? new Date().toISOString(),
      traceIds: [`worker:${input.result.runId}`],
      versionDimensions: {},
      measurements,
      context: {
        tenantId: input.run.tenantId,
        roles: input.run.userGroups,
        securityResourceRefs: input.run.securityResourceRefs,
        useCase: "worker",
        extraSlices: [input.result.targetType ? `worker=${safeSliceValue(input.result.targetType)}` : ""]
      }
    })
  }

  async captureBenchmarkRun(run: BenchmarkRun): Promise<ObservationCaptureResult> {
    const policy = await this.loadActivePolicy()
    if (!policy) return { recorded: 0, skippedReason: "active_policy_unavailable" }
    const metrics = run.metrics
    const sampleCount = Math.max(0, metrics?.total ?? 0)
    const caseSliceEvidenceComplete = sampleCount > 0 && requiredCaseSliceNames(policy.requiredCaseSlices).every((slice) => (
      metrics?.qualitySliceMeasurements?.some((item) => (
        item.slice === slice
        && Number.isFinite(item.measurements["evaluation.slice_case_count"])
        && item.measurements["evaluation.slice_case_count"]! > 0
      ))
    ))
    const profileEvidenceMatches = Boolean(
      metrics?.datasetVersion === policy.evidenceVersions.dataset
      && run.modelId === policy.evidenceVersions.model
      && metrics.workloadProfileVersion === policy.workloadProfileVersion
      && metrics.runtimeProfileVersion === policy.runtimeProfileVersion
      && metrics.indexVersion === policy.evidenceVersions.index
      && metrics.promptVersion === policy.evidenceVersions.prompt
      && metrics.pipelineVersion === policy.evidenceVersions.pipeline
      && metrics.parserVersion === policy.evidenceVersions.parser
      && metrics.chunkerVersion === policy.evidenceVersions.chunker
      && metrics.corpusProfileVersion === policy.workloadDimensions.corpusProfileVersion
      && metrics.aclDistributionVersion === policy.workloadDimensions.aclDistributionVersion
      && metrics.workloadConcurrency === policy.workloadDimensions.concurrency
      && metrics.documentSizeProfileVersion === policy.workloadDimensions.documentSizeProfileVersion
      && metrics.dependencyLatencyProfileVersion === policy.workloadDimensions.dependencyLatencyProfileVersion
    )
    const priceEvidenceMatches = profileEvidenceMatches && metrics?.priceCatalogVersion === policy.priceCatalogVersion
    const benchmarkMeasurement = (
      value: number | undefined,
      count: number,
      unavailableReason: string,
      confidence: number,
      requirePrice = false
    ) => measurement(
      (requirePrice ? priceEvidenceMatches : profileEvidenceMatches) ? value : undefined,
      count,
      (requirePrice ? priceEvidenceMatches : profileEvidenceMatches) ? unavailableReason : "benchmark_profile_evidence_mismatch",
      confidence
    )
    const measurements: RagQualitySourceSample["measurements"] = {
      "ingest.parser_ocr_accuracy": benchmarkMeasurement(metrics?.extractionAccuracy, sampleCount, "benchmark_extraction_accuracy_missing", 0.9),
      "ingest.admission_correctness": benchmarkMeasurement(metrics?.admissionCorrectness, sampleCount, "benchmark_admission_ground_truth_missing", 0.9),
      "retrieval.authorized_recall_at_k": benchmarkMeasurement(metrics?.retrievalRecallAtK ?? metrics?.retrievalRecallAt20, sampleCount, "benchmark_authorized_recall_missing", 0.9),
      "retrieval.false_denial_rate": benchmarkMeasurement(metrics?.falseDenialRate, sampleCount, "benchmark_false_denial_measurement_missing", 0.9),
      "generation.faithfulness": benchmarkMeasurement(metrics?.faithfulness, sampleCount, "benchmark_faithfulness_missing", 0.9),
      "generation.unsupported_claim_rate": benchmarkMeasurement(metrics?.unsupportedClaimRate ?? metrics?.unsupportedSentenceRate ?? metrics?.unsupportedAnswerRate, sampleCount, "benchmark_unsupported_claim_measurement_missing", 0.9),
      "generation.critical_unsupported_claim_count": benchmarkMeasurement(metrics?.criticalUnsupportedClaimCount, sampleCount, "benchmark_critical_claim_measurement_missing", 0.95),
      "citation.precision": benchmarkMeasurement(metrics?.citationPrecision ?? metrics?.citationSupportPassRate, sampleCount, "benchmark_citation_precision_missing", 0.9),
      "citation.completeness": benchmarkMeasurement(metrics?.citationCompleteness, sampleCount, "benchmark_citation_completeness_missing", 0.9),
      "citation.locator_validity": benchmarkMeasurement(metrics?.citationLocatorValidity, sampleCount, "benchmark_citation_locator_measurement_missing", 0.9),
      "citation.required_claim_miss_count": benchmarkMeasurement(metrics?.requiredClaimMissCount, sampleCount, "benchmark_required_claim_coverage_missing", 0.95),
      "answerability.false_answer_rate": benchmarkMeasurement(metrics?.falseAnswerRate ?? (metrics?.abstentionRecall === undefined ? undefined : 1 - metrics.abstentionRecall), sampleCount, "benchmark_abstention_recall_missing", 0.9),
      "answerability.false_refusal_rate": benchmarkMeasurement(metrics?.falseRefusalRate, sampleCount, "benchmark_false_refusal_measurement_missing", 0.9),
      "task.completion_rate": benchmarkMeasurement(metrics?.taskCompletionRate ?? metrics?.conversationSuccessRate, sampleCount, "benchmark_task_completion_missing", 0.9),
      "task.outcome_accuracy": benchmarkMeasurement(metrics?.taskOutcomeAccuracy, sampleCount, "benchmark_task_outcome_missing", 0.9),
      "task.critical_failure_count": benchmarkMeasurement(metrics?.criticalTaskFailureCount, sampleCount, "benchmark_critical_task_failure_missing", 0.95),
      "evaluation.slice_case_count": benchmarkMeasurement(caseSliceEvidenceComplete ? sampleCount : undefined, sampleCount, "benchmark_case_slice_coverage_incomplete", 0.95),
      "security.unauthorized_exposure_count": benchmarkMeasurement(metrics?.noAccessLeakCount, sampleCount, "benchmark_must_not_access_measurement_missing", 0.95),
      "security.injection_success_count": benchmarkMeasurement(metrics?.injectionSuccessCount, sampleCount, "benchmark_injection_measurement_missing", 0.95),
      "security.secret_exposure_count": benchmarkMeasurement(metrics?.secretExposureCount, sampleCount, "benchmark_secret_canary_measurement_missing", 0.95),
      "security.eligibility_matrix_coverage": benchmarkMeasurement(metrics?.eligibilityMatrixCoverage, metrics?.eligibilityProbeSampleCount ?? 0, "eligibility_matrix_incomplete", 0.95),
      "security.eligibility_unreconciled_resource_count": benchmarkMeasurement(metrics?.eligibilityUnreconciledResourceCount, metrics?.eligibilityProbeSampleCount ?? 0, "eligibility_unreconciled_report_missing", 0.95),
      "security.eligibility_propagation_p50_ms": benchmarkMeasurement(metrics?.eligibilityPropagationP50Ms, metrics?.eligibilityProbeSampleCount ?? 0, "eligibility_probe_measurement_missing", 0.9),
      "security.eligibility_propagation_p95_ms": benchmarkMeasurement(metrics?.eligibilityPropagationP95Ms, metrics?.eligibilityProbeSampleCount ?? 0, "eligibility_probe_measurement_missing", 0.9),
      "security.eligibility_propagation_p99_ms": benchmarkMeasurement(metrics?.eligibilityPropagationP99Ms, metrics?.eligibilityProbeSampleCount ?? 0, "eligibility_probe_measurement_missing", 0.9),
      "security.eligibility_propagation_max_ms": benchmarkMeasurement(metrics?.eligibilityPropagationMaxMs, metrics?.eligibilityProbeSampleCount ?? 0, "eligibility_probe_measurement_missing", 0.9),
      "performance.chat_p50_ms": benchmarkMeasurement(run.mode === "agent" ? metrics?.p50LatencyMs : undefined, sampleCount, "benchmark_chat_latency_missing", 0.9),
      "performance.chat_p95_ms": benchmarkMeasurement(run.mode === "agent" ? metrics?.p95LatencyMs : undefined, sampleCount, "benchmark_chat_latency_missing", 0.9),
      "performance.chat_p99_ms": benchmarkMeasurement(run.mode === "agent" ? metrics?.p99LatencyMs : undefined, sampleCount, "benchmark_chat_latency_missing", 0.9),
      "performance.search_p50_ms": benchmarkMeasurement(run.mode === "search" ? metrics?.p50LatencyMs : undefined, sampleCount, "benchmark_search_latency_missing", 0.9),
      "performance.search_p95_ms": benchmarkMeasurement(run.mode === "search" ? metrics?.p95LatencyMs : undefined, sampleCount, "benchmark_search_latency_missing", 0.9),
      "performance.search_p99_ms": benchmarkMeasurement(run.mode === "search" ? metrics?.p99LatencyMs : undefined, sampleCount, "benchmark_search_latency_missing", 0.9),
      "performance.ingest_p50_ms": benchmarkMeasurement(run.mode === "load" ? metrics?.p50LatencyMs : undefined, sampleCount, "benchmark_ingest_latency_missing", 0.9),
      "performance.ingest_p95_ms": benchmarkMeasurement(run.mode === "load" ? metrics?.p95LatencyMs : undefined, sampleCount, "benchmark_ingest_latency_missing", 0.9),
      "performance.ingest_p99_ms": benchmarkMeasurement(run.mode === "load" ? metrics?.p99LatencyMs : undefined, sampleCount, "benchmark_ingest_latency_missing", 0.9),
      "reliability.success_rate": benchmarkMeasurement(sampleCount > 0 && metrics ? metrics.succeeded / sampleCount : undefined, sampleCount, "benchmark_outcome_population_empty", 0.95),
      "reliability.error_rate": benchmarkMeasurement(metrics?.errorRate, sampleCount, "benchmark_error_rate_missing", 0.95),
      "reliability.timeout_rate": benchmarkMeasurement(metrics?.timeoutRate, sampleCount, "benchmark_timeout_rate_missing", 0.95),
      "reliability.backlog_age_p99_ms": benchmarkMeasurement(metrics?.backlogAgeP99Ms, metrics?.backlogAgeSampleCount ?? 0, "benchmark_backlog_measurement_missing", 0.9),
      "reliability.mttr_ms": benchmarkMeasurement(metrics?.mttrMs, metrics?.recoverySampleCount ?? 0, "benchmark_recovery_measurement_missing", 0.9),
      "reliability.retry_exhaustion_count": benchmarkMeasurement(metrics?.retryExhaustionCount, sampleCount, "benchmark_retry_exhaustion_missing", 0.95),
      "reliability.recovery_without_loss_rate": benchmarkMeasurement(metrics?.recoveryWithoutLossRate, metrics?.recoverySampleCount ?? 0, "benchmark_recovery_integrity_missing", 0.95),
      "reliability.recovery_loss_count": benchmarkMeasurement(metrics?.recoveryLossCount, metrics?.recoverySampleCount ?? 0, "benchmark_recovery_integrity_missing", 0.95),
      "reliability.recovery_scenario_coverage": benchmarkMeasurement(metrics?.recoveryScenarioCoverage, metrics?.recoverySampleCount ?? 0, "benchmark_recovery_matrix_incomplete", 0.95),
      "cost.chat_per_request": benchmarkMeasurement(metrics?.chatCostPerRequest, metrics?.chatCostEvidenceSampleCount ?? 0, "versioned_price_measurement_missing", 0.9, true),
      "cost.search_per_request": benchmarkMeasurement(metrics?.searchCostPerRequest, metrics?.searchCostEvidenceSampleCount ?? 0, "versioned_price_measurement_missing", 0.9, true),
      "cost.ingest_per_document": benchmarkMeasurement(metrics?.ingestCostPerDocument, metrics?.ingestCostEvidenceSampleCount ?? 0, "versioned_price_measurement_missing", 0.9, true),
      "release.dataset_specific_branch_count": benchmarkMeasurement(metrics?.datasetSpecificBranchCount, 1, "release_taint_scan_missing", 0.95),
      "release.artifact_manifest_mismatch_count": benchmarkMeasurement(metrics?.artifactManifestMismatchCount, 1, "release_artifact_validation_missing", 0.95)
    }
    const versionDimensions = compactVersions({
      policy: `${policy.profileId}@${policy.version}`,
      index: metrics?.indexVersion,
      model: run.modelId,
      prompt: metrics?.promptVersion,
      pipeline: metrics?.pipelineVersion,
      parser: metrics?.parserVersion,
      chunker: metrics?.chunkerVersion,
      workload: metrics?.workloadProfileVersion,
      runtime: metrics?.runtimeProfileVersion,
      price: metrics?.priceCatalogVersion,
      dataset: metrics?.datasetVersion,
      releaseAudit: metrics?.releaseAuditId
    })
    const primary = await this.capture({
      sourceType: "benchmark_summary",
      artifactId: run.runId,
      observedAt: run.completedAt ?? run.updatedAt,
      traceIds: [`benchmark:${run.runId}`],
      versionDimensions,
      measurements,
      context: {
        tenantId: run.tenantId,
        securityResourceRefs: run.securityResourceRefs,
        useCase: "benchmark",
        extraSlices: [`suite=${safeSliceValue(run.suiteId)}`, `mode=${safeSliceValue(run.mode)}`]
      }
    })
    let recorded = primary.recorded
    for (const sliceEvidence of metrics?.qualitySliceMeasurements ?? []) {
      const sliceMeasurements: RagQualitySourceSample["measurements"] = {}
      for (const [signalId, value] of Object.entries(sliceEvidence.measurements)) {
        if (!RAG_REQUIRED_SIGNAL_IDS.includes(signalId as RagQualitySignalId)) continue
        sliceMeasurements[signalId as RagQualitySignalId] = benchmarkMeasurement(
          value,
          sliceEvidence.sampleCount,
          "slice_measurement_missing",
          0.9
        )
      }
      recorded += (await this.capture({
        sourceType: "benchmark_summary",
        artifactId: `${run.runId}:${sliceEvidence.slice}`,
        observedAt: run.completedAt ?? run.updatedAt,
        traceIds: [`benchmark:${run.runId}`],
        versionDimensions,
        measurements: sliceMeasurements,
        context: { useCase: "benchmark", onlySlices: [sliceEvidence.slice] }
      })).recorded
    }
    return { recorded }
  }

  async captureReleaseAudit(input: {
    auditId: string
    observedAt: string
    datasetSpecificBranchCount?: number
    artifactManifestMismatchCount?: number
    runtimeVersion?: string
  }): Promise<ObservationCaptureResult> {
    return this.capture({
      sourceType: "release_audit",
      artifactId: input.auditId,
      observedAt: input.observedAt,
      traceIds: [`release:${input.auditId}`],
      versionDimensions: compactVersions({ pipeline: input.runtimeVersion }),
      measurements: {
        "release.dataset_specific_branch_count": measurement(input.datasetSpecificBranchCount, 1, "release_taint_scan_missing"),
        "release.artifact_manifest_mismatch_count": measurement(input.artifactManifestMismatchCount, 1, "release_artifact_validation_missing")
      },
      context: { useCase: "release" }
    })
  }

  async captureEligibilityProbe(input: {
    probeId: string
    observedAt: string
    propagationMs?: number
    tenantId?: string
    roles?: string[]
    pipelineVersions?: PipelineVersions
    versionDimensions?: RagQualityVersionContext
  }): Promise<ObservationCaptureResult> {
    const policy = await this.loadActivePolicy()
    if (!policy) return { recorded: 0, skippedReason: "active_policy_unavailable" }
    return this.capture({
      sourceType: "eligibility_probe",
      artifactId: input.probeId,
      observedAt: input.observedAt,
      traceIds: [`eligibility:${input.probeId}`],
      versionDimensions: eligibilityVersionDimensions(input.pipelineVersions, input.versionDimensions),
      measurements: {
        "security.eligibility_propagation_p50_ms": measurement(input.propagationMs, input.propagationMs === undefined ? 0 : 1, "eligibility_probe_measurement_missing"),
        "security.eligibility_propagation_p95_ms": measurement(input.propagationMs, input.propagationMs === undefined ? 0 : 1, "eligibility_probe_measurement_missing"),
        "security.eligibility_propagation_p99_ms": measurement(input.propagationMs, input.propagationMs === undefined ? 0 : 1, "eligibility_probe_measurement_missing"),
        "security.eligibility_propagation_max_ms": measurement(input.propagationMs, input.propagationMs === undefined ? 0 : 1, "eligibility_probe_measurement_missing")
      },
      context: { tenantId: input.tenantId, roles: input.roles, useCase: "eligibility" }
    })
  }

  async captureEligibilityProbeOnce(input: {
    probeId: string
    detectedAt: string
    propagationMs: number
    tenantId?: string
    roles?: string[]
    pipelineVersions?: PipelineVersions
    versionDimensions?: RagQualityVersionContext
  }): Promise<ObservationCaptureResult> {
    const key = `quality-control/eligibility-probes/${createHash("sha256").update(input.probeId).digest("hex")}.json`
    let stored: { marker: EligibilityProbeMarker; version: string } | undefined
    try {
      const value = await this.objectStore.getTextWithVersion(key)
      stored = { marker: JSON.parse(value.text) as EligibilityProbeMarker, version: value.version }
    } catch (error) {
      if (!isMissingObject(error)) throw error
    }
    if (stored?.marker.status === "recorded") return { recorded: 0 }
    if (!stored) {
      const marker: EligibilityProbeMarker = {
        schemaVersion: 1,
        probeId: input.probeId,
        detectedAt: input.detectedAt,
        propagationMs: input.propagationMs,
        tenantId: input.tenantId,
        roles: input.roles,
        pipelineVersions: input.pipelineVersions,
        versionDimensions: input.versionDimensions,
        status: "pending"
      }
      try {
        await this.objectStore.putTextIfVersion(key, `${JSON.stringify(marker, null, 2)}\n`, undefined, "application/json; charset=utf-8")
      } catch (error) {
        if (!isConditionalWrite(error)) throw error
      }
      const value = await this.objectStore.getTextWithVersion(key)
      stored = { marker: JSON.parse(value.text) as EligibilityProbeMarker, version: value.version }
    }
    const marker = stored.marker
    const result = await this.captureEligibilityProbe({
      probeId: marker.probeId,
      observedAt: marker.detectedAt,
      propagationMs: marker.propagationMs,
      tenantId: marker.tenantId,
      roles: marker.roles,
      pipelineVersions: marker.pipelineVersions,
      versionDimensions: marker.versionDimensions
    })
    if (result.recorded > 0) {
      const recorded: EligibilityProbeMarker = {
        ...marker,
        status: "recorded",
        recordedAt: new Date().toISOString()
      }
      try {
        await this.objectStore.putTextIfVersion(
          key,
          `${JSON.stringify(recorded, null, 2)}\n`,
          stored.version,
          "application/json; charset=utf-8"
        )
      } catch (error) {
        if (!isConditionalWrite(error)) throw error
      }
    }
    return result
  }

  async captureCompletedBenchmarks(runs: BenchmarkRun[], window: { windowStart: string; windowEnd: string }): Promise<number> {
    let recorded = 0
    for (const run of runs) {
      const observedAt = run.completedAt ?? run.updatedAt
      if (run.status !== "succeeded" && run.status !== "failed") continue
      if (observedAt < window.windowStart || observedAt > window.windowEnd) continue
      recorded += (await this.captureBenchmarkRun(run)).recorded
    }
    return recorded
  }

  async aggregateWindow(input: { windowStart: string; windowEnd: string; observedAt?: string }): Promise<RagQualityObservation[]> {
    const policy = await this.requireActivePolicy()
    const samples = await this.loadSamples(input.windowStart, input.windowEnd)
    const matchingProfile = samples.filter((sample) => sampleMatchesPolicy(sample, policy))
    const observations: RagQualityObservation[] = []
    for (const signalId of RAG_REQUIRED_SIGNAL_IDS) {
      const slices = normalizedSlices(policy.requiredSlices[signalId])
      for (const slice of slices) {
        const sliceSamples = matchingProfile.filter((sample) => sample.slice === slice && sample.measurements[signalId] !== undefined)
        const groups = groupSamplesByVersionFingerprint(sliceSamples)
        for (const samples of groups.length > 0 ? groups : [[]]) {
          observations.push(aggregateSignal({
            policy,
            signalId,
            slice,
            samples,
            observedAt: input.observedAt ?? input.windowEnd
          }))
        }
      }
    }
    return observations
  }

  async aggregateAndRecordWindow(
    monitor: ProductionRagMonitor,
    input: { windowStart: string; windowEnd: string; observedAt?: string }
  ): Promise<RagQualityObservation[]> {
    const observations = await this.aggregateWindow(input)
    for (const observation of observations) await monitor.recordObservation(observation)
    return observations
  }

  private async capture(input: {
    sourceType: RagObservationSourceType
    artifactId: string
    observedAt: string
    traceIds: string[]
    versionDimensions: Record<string, string[]>
    measurements: RagQualitySourceSample["measurements"]
    proxyMeasurements?: RagQualitySourceSample["proxyMeasurements"]
    guardOutcomes?: RagGuardOutcome[]
    degradationDecisions?: SafeDegradationDecision[]
    context: CaptureContext
  }): Promise<ObservationCaptureResult> {
    const policy = await this.loadActivePolicy()
    if (!policy) return { recorded: 0, skippedReason: "active_policy_unavailable" }
    const slices = runtimeSlices(input.context)
    for (const slice of slices) {
      const missingVersionDimensions = requiredVersionDimensions.filter((dimension) => (input.versionDimensions[dimension]?.length ?? 0) === 0)
      const sample: RagQualitySourceSample = {
        schemaVersion: 1,
        signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
        profileId: policy.profileId,
        profileVersion: policy.version,
        workloadProfileVersion: policy.workloadProfileVersion,
        runtimeProfileVersion: policy.runtimeProfileVersion,
        priceCatalogVersion: policy.priceCatalogVersion,
        sourceType: input.sourceType,
        artifactId: input.artifactId,
        tenantPartitionId: input.context.tenantId ? tenantPartitionId(input.context.tenantId) : undefined,
        resourceIds: uniqueStrings(input.context.resourceIds ?? []),
        securityResourceRefs: uniqueStrings(input.context.securityResourceRefs ?? []),
        slice,
        observedAt: normalizeTimestamp(input.observedAt),
        traceIds: uniqueStrings(input.traceIds),
        versionDimensions: input.versionDimensions,
        missingVersionDimensions,
        measurements: input.measurements,
        proxyMeasurements: input.proxyMeasurements,
        guardOutcomes: input.guardOutcomes,
        degradationDecisions: input.degradationDecisions
      }
      await this.persistSample(sample)
    }
    return { recorded: slices.length }
  }

  private async persistSample(sample: RagQualitySourceSample): Promise<void> {
    assertSourceSample(sample)
    const partition = sample.tenantPartitionId ?? "global"
    const key = `${sourceSamplePrefix}${safeKeyPart(partition)}/${safeKeyPart(sample.observedAt)}/${safeKeyPart(sample.profileId)}/${safeKeyPart(sample.profileVersion)}/${safeKeyPart(sample.sourceType)}/${safeKeyPart(sample.artifactId)}/${safeKeyPart(sample.slice)}.json`
    await this.objectStore.putText(key, `${JSON.stringify(sample, null, 2)}\n`, "application/json; charset=utf-8")
  }

  private async loadSamples(windowStart: string, windowEnd: string): Promise<RagQualitySourceSample[]> {
    const keys = await this.objectStore.listKeys(sourceSamplePrefix)
    const samples = await Promise.all(keys.filter((key) => key.endsWith(".json")).map(async (key) => {
      try {
        const sample = JSON.parse(await this.objectStore.getText(key)) as RagQualitySourceSample
        assertSourceSample(sample)
        return sample
      } catch {
        return undefined
      }
    }))
    return samples.filter((sample): sample is RagQualitySourceSample => Boolean(
      sample && sample.observedAt >= windowStart && sample.observedAt <= windowEnd
    ))
  }

  private async loadActivePolicy(): Promise<RagQualityPolicyProfile | undefined> {
    try {
      const policy = JSON.parse(await this.objectStore.getText(ACTIVE_RAG_QUALITY_POLICY_KEY)) as RagQualityPolicyProfile
      if (
        policy.signalCatalogVersion !== RAG_QUALITY_SIGNAL_CATALOG_VERSION
        || !policy.profileId?.trim()
        || !policy.version?.trim()
        || !policy.workloadProfileVersion?.trim()
        || !policy.runtimeProfileVersion?.trim()
        || !policy.priceCatalogVersion?.trim()
        || !policy.evidenceVersions
        || Object.values(policy.evidenceVersions).some((value) => !value?.trim())
        || !policy.workloadDimensions
        || !policy.requiredCaseSlices
        || !policy.changeControl
        || !Array.isArray(policy.responsePolicy?.allowedActions)
      ) return undefined
      return policy
    } catch {
      return undefined
    }
  }

  private async requireActivePolicy(): Promise<RagQualityPolicyProfile> {
    const policy = await this.loadActivePolicy()
    if (!policy) throw new Error("Active RAG quality policy is unavailable or invalid")
    return policy
  }
}

function groupSamplesByVersionFingerprint(samples: RagQualitySourceSample[]): RagQualitySourceSample[][] {
  const groups = new Map<string, RagQualitySourceSample[]>()
  for (const sample of samples) {
    const fingerprint = JSON.stringify(Object.fromEntries(Object.entries(sample.versionDimensions)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dimension, values]) => [dimension, [...values].sort()])))
    const group = groups.get(fingerprint) ?? []
    group.push(sample)
    groups.set(fingerprint, group)
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, group]) => group)
}

export async function bestEffortCapture(label: string, capture: () => Promise<ObservationCaptureResult>): Promise<void> {
  try {
    const result = await capture()
    if (result.skippedReason && process.env.RAG_MONITORING_REQUIRED === "1") {
      console.warn("RAG quality source sample was not recorded", { label, reason: result.skippedReason })
    }
  } catch (error) {
    console.warn("RAG quality source sample persistence failed", { label, error })
  }
}

function aggregateSignal(input: {
  policy: RagQualityPolicyProfile
  signalId: RagQualitySignalId
  slice: string
  samples: RagQualitySourceSample[]
  observedAt: string
}): RagQualityObservation {
  const measured = input.samples
    .map((sample) => ({ sample, measurement: sample.measurements[input.signalId] }))
    .filter((item): item is { sample: RagQualitySourceSample; measurement: RagSignalMeasurement } => item.measurement !== undefined)
  const available = measured.filter((item) => item.measurement.available && item.measurement.value !== null && Number.isFinite(item.measurement.value))
  const unavailableReasons = uniqueStrings(measured
    .filter((item) => !item.measurement.available)
    .map((item) => item.measurement.unavailableReason ?? "source_reported_unavailable"))
  const sourceSamples = measured.length > 0 ? measured.map((item) => item.sample) : input.samples
  const sampleCount = available.reduce((sum, item) => sum + item.measurement.sampleCount, 0)
  const value = available.length > 0 ? aggregateValues(input.signalId, available) : null
  const coverageRatio = measured.length === 0 ? 0 : available.length / measured.length
  const confidence = available.length === 0
    ? null
    : Math.min(...available.map((item) => item.measurement.confidence ?? 0)) * coverageRatio
  const versionDimensions = mergeVersionDimensions(sourceSamples.map((sample) => sample.versionDimensions), input.policy)
  const missingVersionDimensions = uniqueStrings([
    ...sourceSamples.flatMap((sample) => sample.missingVersionDimensions),
    ...requiredVersionDimensions.filter((dimension) => (versionDimensions[dimension]?.length ?? 0) === 0)
  ])
  return {
    schemaVersion: RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: input.policy.profileId,
    profileVersion: input.policy.version,
    signalId: input.signalId,
    slice: input.slice,
    value,
    available: available.length > 0,
    sampleCount,
    confidence,
    observedAt: normalizeTimestamp(input.observedAt),
    workloadProfileVersion: input.policy.workloadProfileVersion,
    runtimeProfileVersion: input.policy.runtimeProfileVersion,
    priceCatalogVersion: input.policy.priceCatalogVersion,
    traceIds: uniqueStrings(sourceSamples.flatMap((sample) => sample.traceIds)),
    source: {
      producerVersion: PRODUCTION_RAG_OBSERVATION_PRODUCER_VERSION,
      artifactTypes: uniqueStrings(sourceSamples.map((sample) => sample.sourceType)),
      artifactIds: uniqueStrings(sourceSamples.map((sample) => sample.artifactId)),
      versionDimensions,
      missingVersionDimensions,
      unavailableReasons: available.length > 0
        ? unavailableReasons.length > 0 ? unavailableReasons : undefined
        : unavailableReasons.length > 0 ? unavailableReasons : ["no_measured_source_in_window"]
    }
  }
}

function aggregateValues(
  signalId: RagQualitySignalId,
  values: Array<{ measurement: RagSignalMeasurement }>
): number {
  const numeric = values.map((item) => item.measurement.value!).filter(Number.isFinite)
  if (isCountSignal(signalId)) return numeric.reduce((sum, value) => sum + value, 0)
  if (signalId.endsWith("_p50_ms")) return percentile(numeric, 0.5)
  if (signalId.endsWith("_p95_ms")) return percentile(numeric, 0.95)
  if (signalId.endsWith("_p99_ms")) return percentile(numeric, 0.99)
  if (signalId.endsWith("_max_ms")) return Math.max(...numeric)
  if (signalId === "reliability.mttr_ms") return numeric.reduce((sum, value) => sum + value, 0) / numeric.length
  const totalWeight = values.reduce((sum, item) => sum + Math.max(0, item.measurement.sampleCount), 0)
  if (totalWeight === 0) return numeric.reduce((sum, value) => sum + value, 0) / numeric.length
  return values.reduce((sum, item) => sum + item.measurement.value! * Math.max(0, item.measurement.sampleCount), 0) / totalWeight
}

function isCountSignal(signalId: RagQualitySignalId): boolean {
  return signalId.endsWith("_count")
}

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 0) return Number.NaN
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1)
  return sorted[index]!
}

function measurement(
  value: number | undefined,
  sampleCount: number,
  unavailableReason = "measurement_unavailable",
  confidence = 1
): RagSignalMeasurement {
  if (value === undefined || !Number.isFinite(value) || sampleCount < 1) return unavailable(unavailableReason)
  return { available: true, value, sampleCount, confidence }
}

function unavailable(reason: string): RagSignalMeasurement {
  return { available: false, value: null, sampleCount: 0, confidence: null, unavailableReason: reason }
}

function isMissingObject(error: unknown): boolean {
  const value = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return value.code === "ENOENT"
    || value.name === "NoSuchKey"
    || value.$metadata?.httpStatusCode === 404
}

function isConditionalWrite(error: unknown): boolean {
  const value = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return value.code === "PRECONDITION_FAILED"
    || value.name === "PreconditionFailed"
    || value.$metadata?.httpStatusCode === 412
}

function runtimeSlices(context: CaptureContext): string[] {
  if (context.onlySlices && context.onlySlices.length > 0) return uniqueStrings(context.onlySlices)
  const slices = new Set<string>(["overall", `use_case=${safeSliceValue(context.useCase)}`])
  const tenant = context.tenantId?.trim()
  const tenantSlice = tenant ? `tenant=${pseudonymousValue(tenant)}` : undefined
  if (tenantSlice) slices.add(tenantSlice)
  const roles = uniqueStrings((context.roles ?? []).map(roleSliceValue))
  for (const role of roles) slices.add(`role=${role}`)
  if (tenantSlice) {
    for (const role of roles.length > 0 ? roles : ["unknown"]) {
      slices.add(`${tenantSlice}|role=${role}|use_case=${safeSliceValue(context.useCase)}`)
    }
  }
  for (const slice of context.extraSlices ?? []) if (slice.trim()) slices.add(slice.trim())
  return [...slices]
}

function versionsFromPipeline(
  versions: PipelineVersions | undefined,
  overrides: Partial<Record<(typeof requiredVersionDimensions)[number] | "policy", string | undefined>>
): Record<string, string[]> {
  return compactVersions({
    policy: overrides.policy,
    index: overrides.index ?? versions?.indexVersion,
    model: overrides.model ?? versions?.embeddingModelId,
    prompt: overrides.prompt ?? versions?.promptVersion,
    pipeline: versions ? hashVersion(versions) : undefined,
    parser: overrides.parser ?? versions?.sourceExtractorVersion,
    chunker: overrides.chunker ?? versions?.chunkerVersion
  })
}

function versionsFromTrace(trace: DebugTrace): Record<string, string[]> {
  const replay = trace.replayVersionManifest
  return compactVersions({
    policy: replay?.policyVersions.ragProfile ?? (trace.ragProfile ? `${trace.ragProfile.id}@${trace.ragProfile.version}` : undefined),
    index: replay?.indexVersion ?? trace.pipelineVersions?.indexVersion,
    model: replay?.modelVersions.answer ?? trace.modelId,
    prompt: replay?.promptVersion ?? trace.pipelineVersions?.promptVersion,
    pipeline: replay?.pipelineVersion ?? (trace.pipelineVersions ? hashVersion(trace.pipelineVersions) : undefined),
    parser: replay?.parserVersion ?? trace.pipelineVersions?.sourceExtractorVersion,
    chunker: replay?.chunkerVersion ?? trace.pipelineVersions?.chunkerVersion
  })
}

function eligibilityVersionDimensions(
  pipelineVersions: PipelineVersions | undefined,
  actual: RagQualityVersionContext | undefined
): Record<string, string[]> {
  return compactVersions({
    dataset: actual?.dataset,
    model: actual?.model ?? pipelineVersions?.embeddingModelId,
    index: actual?.index ?? pipelineVersions?.indexVersion,
    prompt: actual?.prompt ?? pipelineVersions?.promptVersion,
    pipeline: actual?.pipeline ?? (pipelineVersions ? hashVersion(pipelineVersions) : undefined),
    parser: actual?.parser ?? pipelineVersions?.sourceExtractorVersion,
    chunker: actual?.chunker ?? pipelineVersions?.chunkerVersion,
    runtime: actual?.runtime,
    workload: actual?.workload,
    price: actual?.price
  })
}

function compactVersions(input: Record<string, string | undefined>): Record<string, string[]> {
  const versions: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(input)) {
    const normalized = value?.trim()
    if (normalized) versions[key] = [normalized]
  }
  return versions
}

function mergeVersionDimensions(inputs: Array<Record<string, string[]>>, policy: RagQualityPolicyProfile): Record<string, string[]> {
  const result: Record<string, string[]> = {
    policy: [`${policy.profileId}@${policy.version}`]
  }
  for (const input of inputs) {
    for (const [dimension, values] of Object.entries(input)) {
      result[dimension] = uniqueStrings([...(result[dimension] ?? []), ...values])
    }
  }
  return result
}

function sampleMatchesPolicy(sample: RagQualitySourceSample, policy: RagQualityPolicyProfile): boolean {
  return sample.signalCatalogVersion === policy.signalCatalogVersion
    && sample.profileId === policy.profileId
    && sample.profileVersion === policy.version
    && sample.workloadProfileVersion === policy.workloadProfileVersion
    && sample.runtimeProfileVersion === policy.runtimeProfileVersion
    && sample.priceCatalogVersion === policy.priceCatalogVersion
}

function assertSourceSample(sample: RagQualitySourceSample): void {
  if (
    sample.schemaVersion !== 1
    || sample.signalCatalogVersion !== RAG_QUALITY_SIGNAL_CATALOG_VERSION
    || !sample.profileId.trim()
    || !sample.profileVersion.trim()
    || !sample.workloadProfileVersion.trim()
    || !sample.runtimeProfileVersion.trim()
    || !sample.priceCatalogVersion.trim()
    || !sample.sourceType
    || !sample.artifactId.trim()
    || (sample.tenantPartitionId !== undefined && !/^tenant:[a-f0-9]{24}$/u.test(sample.tenantPartitionId))
    || (sample.resourceIds !== undefined && (!Array.isArray(sample.resourceIds) || sample.resourceIds.some((value) => !value.trim())))
    || (sample.securityResourceRefs !== undefined && (!Array.isArray(sample.securityResourceRefs) || sample.securityResourceRefs.some((value) => !value.trim())))
    || !sample.slice.trim()
    || !Number.isFinite(Date.parse(sample.observedAt))
  ) throw new Error("Invalid RAG quality source sample identity")
  for (const [signalId, item] of Object.entries(sample.measurements)) {
    if (!RAG_REQUIRED_SIGNAL_IDS.includes(signalId as RagQualitySignalId)) throw new Error(`Unknown RAG quality signal: ${signalId}`)
    if (
      !Number.isInteger(item.sampleCount)
      || item.sampleCount < 0
      || item.available && (
        item.value === null
        || !Number.isFinite(item.value)
        || item.sampleCount < 1
        || item.confidence === null
        || item.confidence < 0
        || item.confidence > 1
      )
    ) {
      throw new Error(`Available RAG quality measurement is incomplete: ${signalId}`)
    }
    if (!item.available && (item.value !== null || item.confidence !== null)) {
      throw new Error(`Unavailable RAG quality measurement must not contain a value: ${signalId}`)
    }
  }
}

function normalizedSlices(slices: string[] | undefined): string[] {
  const normalized = uniqueStrings((slices ?? []).map((slice) => slice.trim()).filter(Boolean))
  return normalized.length > 0 ? normalized : ["overall"]
}

function hasLocator(locator: unknown): boolean {
  if (!locator || typeof locator !== "object") return false
  const value = locator as { page?: unknown; pageStart?: unknown; startChar?: unknown; endChar?: unknown; sourceBlockId?: unknown; sourceChunkIds?: unknown }
  return Number.isInteger(value.page)
    || Number.isInteger(value.pageStart)
    || Boolean(typeof value.sourceBlockId === "string" && value.sourceBlockId)
    || Boolean(Array.isArray(value.sourceChunkIds) && value.sourceChunkIds.length > 0)
    || Boolean(Number.isInteger(value.startChar) && Number.isInteger(value.endChar) && Number(value.endChar) >= Number(value.startChar))
}

function hasCitationLocator(citation: DebugTrace["citations"][number]): boolean {
  return Boolean(citation.chunkId || citation.sourceLocator?.sourceBlockId || citation.pageStart || citation.pageEnd || citation.sourceLocator && hasLocator(citation.sourceLocator))
}

function stringMetadata(manifest: DocumentManifest, key: string): string | undefined {
  const value = manifest.metadata?.[key]
  return typeof value === "string" ? value : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function timestampMs(value: string | undefined): number | undefined {
  if (!value) return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function normalizeTimestamp(value: string): string {
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) throw new Error("Invalid RAG observation timestamp")
  return timestamp.toISOString()
}

function hashVersion(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
}

function pseudonymousValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function roleSliceValue(value: string): string {
  const normalized = value.trim().toUpperCase()
  if (["SYSTEM_ADMIN", "RAG_GROUP_MANAGER", "ANSWER_EDITOR", "CHAT_USER"].includes(normalized)) return normalized.toLowerCase()
  return `hash-${pseudonymousValue(value)}`
}

function safeSliceValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown"
}

function safeKeyPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, "_")
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()).map((value) => value.trim()))].sort()
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0
}
