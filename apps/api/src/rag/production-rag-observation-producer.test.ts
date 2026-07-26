import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  buildRequiredRagQualitySlices,
  RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
  RAG_QUALITY_POLICY_SCHEMA_VERSION,
  RAG_QUALITY_SIGNAL_CATALOG_VERSION,
  RAG_REQUIRED_SIGNAL_IDS,
  type RagQualityGate,
  type RagQualityPolicyProfile,
  type RagQualitySignalId
} from "@memorag-mvp/contract/rag-quality-control"

import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { DebugTrace, DocumentManifest, PipelineVersions, WorkerResult } from "../types.js"
import {
  ACTIVE_RAG_QUALITY_POLICY_KEY,
  ProductionRagMonitor
} from "./quality-control/production-rag-monitor.js"
import { ProductionRagObservationProducer } from "./quality-control/production-rag-observation-producer.js"
import { currentEligibilitySnapshotFromAuthoritativeState } from "./_shared/security/current-rag-eligibility.js"
import { MANDATORY_RAG_GUARDS, measureRuntimeRagGuards, type MandatoryRagGuard } from "./_shared/security/safe-degradation-policy.js"

const windowStart = "2026-07-11T00:00:00.000Z"
const observedAt = "2026-07-11T00:30:00.000Z"
const windowEnd = "2026-07-11T01:00:00.000Z"
const requiredCaseSlices = {
  questionTypes: ["fact"], tenantRoles: ["tenant-a:chat-user"], ocrModes: ["native"], languages: ["ja"],
  multiEvidence: ["true"], answerability: ["answerable"], severities: ["high"]
} as const

const pipelineVersions: PipelineVersions = {
  chatOrchestrationWorkflowVersion: "chat-workflow-v3",
  agentWorkflowVersion: "agent-workflow-v3",
  chunkerVersion: "chunker-v2",
  sourceExtractorVersion: "parser-v4",
  memoryPromptVersion: "memory-prompt-v2",
  promptVersion: "answer-prompt-v5",
  indexVersion: "index-v7",
  embeddingModelId: "embedding-v3",
  embeddingDimensions: 3
}

function higherIsBetter(signalId: RagQualitySignalId): boolean {
  return /(coverage|accuracy|quality|integrity|correctness|recall|retention|faithfulness|precision|completeness|success_rate|completion_rate|locator_validity)$/.test(signalId)
}

function gate(signalId: RagQualitySignalId, slice: string): RagQualityGate {
  return {
    signalId,
    slice,
    comparator: higherIsBetter(signalId) ? "gte" : "lte",
    threshold: higherIsBetter(signalId) ? 0 : signalId.endsWith("_count") ? 0 : 1_000_000,
    thresholdApprovedBy: "quality-owner",
    thresholdApprovedAt: observedAt,
    minimumSampleCount: 1,
    minimumConfidence: 0
  }
}

function approvedPolicy(): RagQualityPolicyProfile {
  const requiredSlices = buildRequiredRagQualitySlices(requiredCaseSlices)
  requiredSlices["reliability.success_rate"] = [...(requiredSlices["reliability.success_rate"] ?? []), "use_case=chat"]
  return {
    schemaVersion: RAG_QUALITY_POLICY_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "production-rag",
    version: "approved-2026-07-11",
    approvedBy: "quality-owner",
    approvedAt: observedAt,
    workloadProfileVersion: "workload-v3",
    runtimeProfileVersion: "runtime-v9",
    priceCatalogVersion: "price-v6",
    evidenceVersions: { dataset: "dataset-v4", model: "answer-model-v2", index: pipelineVersions.indexVersion, prompt: pipelineVersions.promptVersion, pipeline: "pipeline-v8", parser: pipelineVersions.sourceExtractorVersion, chunker: pipelineVersions.chunkerVersion },
    workloadDimensions: { corpusProfileVersion: "corpus-v4", aclDistributionVersion: "acl-v3", concurrency: 8, documentSizeProfileVersion: "size-v2", dependencyLatencyProfileVersion: "dependency-v3" },
    requiredCaseSlices,
    changeControl: { purpose: "neutral" },
    requiredSlices,
    gates: RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (
      requiredSlices[signalId] ?? ["overall"]
    ).map((slice) => gate(signalId, slice))),
    responsePolicy: {
      owner: "rag-on-call",
      runbookVersion: "runbook-v4",
      allowedActions: ["promotion_freeze", "candidate_quarantine", "limited_answer"]
    }
  }
}

function completeSliceMeasurements() {
  const policy = approvedPolicy()
  const slices = [...new Set(Object.values(policy.requiredSlices).flat().filter((slice) => slice !== "overall" && slice !== "use_case=chat"))]
  return slices.map((slice) => ({
    slice,
    sampleCount: 4,
    measurements: Object.fromEntries(RAG_REQUIRED_SIGNAL_IDS.map((signalId) => [
      signalId,
      signalId === "evaluation.slice_case_count" ? 4 : signalId.endsWith("_count") ? 0 : 1
    ]))
  }))
}

function manifestFixture(): DocumentManifest {
  const reference = (id: string) => ({ id, version: `${id}-v1`, hash: `${id}-hash` })
  return {
    documentId: "document-1",
    documentVersion: "document-version-1",
    fileName: "source.pdf",
    admission: {
      schemaVersion: 1,
      status: "approved",
      tenantId: "tenant-sensitive-1",
      ownerUserId: "user-1",
      authorizationRef: reference("authorization"),
      classificationRef: reference("classification"),
      usagePolicyRef: reference("usage-policy"),
      qualityRef: reference("quality"),
      lifecycleRef: reference("lifecycle"),
      provenanceRef: reference("provenance"),
      inspectionStatus: "passed",
      reasons: [],
      rejectedProtectedMetadataKeys: [],
      admittedAt: observedAt
    },
    derivedIntegrity: {
      schemaVersion: 1,
      expectedChunkCount: 1,
      expectedMemoryCardCount: 0,
      evidenceRecordCount: 1,
      memoryRecordCount: 0,
      manifestHash: "manifest-hash",
      recordSetHash: "record-set-hash",
      verified: true,
      reasons: []
    },
    chunkingPolicy: {
      schemaVersion: 1,
      policyId: "production-structure-aware",
      version: "chunk-policy-v1",
      strategy: "structure_aware",
      tokenizer: "unicode_code_point_v1",
      maxChars: 2_000,
      maxTokens: 500,
      overlapChars: 100,
      minTokens: 1,
      preserveAtomicBlocks: true,
      stableIdAlgorithm: "sha256_locator_content_v1"
    },
    chunkingViolations: [],
    sourceObjectKey: "documents/document-1/source.txt",
    manifestObjectKey: "manifests/document-1.json",
    vectorKeys: ["document-1-chunk-1"],
    evidenceVectorKeys: ["document-1-chunk-1"],
    memoryVectorKeys: [],
    embeddingModelId: pipelineVersions.embeddingModelId,
    chunkerVersion: pipelineVersions.chunkerVersion,
    sourceExtractorVersion: pipelineVersions.sourceExtractorVersion,
    memoryPromptVersion: pipelineVersions.memoryPromptVersion,
    indexVersion: pipelineVersions.indexVersion,
    pipelineVersions,
    chunks: [{
      id: "chunk-1",
      startChar: 0,
      endChar: 12,
      sourceLocation: { page: 1, startChar: 0, endChar: 12 }
    }],
    chunkCount: 1,
    memoryCardCount: 0,
    parsedDocument: {
      schemaVersion: 2,
      text: "measured text",
      sourceExtractorVersion: pipelineVersions.sourceExtractorVersion,
      extractionStatus: "complete",
      inputCharCount: 13,
      outputCharCount: 13
    },
    extractionWarnings: [],
    createdAt: observedAt,
    updatedAt: observedAt
  }
}

function traceFixture(): DebugTrace {
  const citation = {
    documentId: "document-1",
    documentVersion: "document-version-1",
    fileName: "source.pdf",
    chunkId: "chunk-1",
    score: 0.9,
    text: "measured text",
    sourceLocator: { page: 1 }
  }
  return {
    schemaVersion: 1,
    runId: "chat-trace-1",
    question: "What is measured?",
    modelId: "answer-model-v2",
    embeddingModelId: pipelineVersions.embeddingModelId,
    clueModelId: "clue-model-v1",
    pipelineVersions,
    ragProfile: {
      id: "runtime-rag",
      version: "runtime-rag-v2",
      retrievalProfileId: "retrieval-profile",
      retrievalProfileVersion: "retrieval-v2",
      answerPolicyId: "answer-policy",
      answerPolicyVersion: "answer-policy-v3"
    },
    topK: 10,
    memoryTopK: 3,
    minScore: 0.2,
    startedAt: "2026-07-11T00:29:59.850Z",
    completedAt: observedAt,
    totalLatencyMs: 150,
    status: "success",
    answerPreview: "It is measured.",
    isAnswerable: true,
    citations: [citation],
    retrieved: [citation],
    finalEvidence: [citation],
    steps: []
  }
}

test("FR-075/SQ-005..015 production artifacts yield profile/version/slice observations and explicit unavailable signals", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-observation-producer-")))
  const policy = approvedPolicy()
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(policy))
  const producer = new ProductionRagObservationProducer(store)

  await producer.captureIngestManifest({ manifest: manifestFixture(), latencyMs: 80 })
  await producer.captureDebugTrace(traceFixture(), { tenantId: "tenant-sensitive-1", roles: ["CHAT_USER"] })
  await producer.captureChatOutcome({
    runId: "normal-chat-1",
    observedAt,
    latencyMs: 125,
    tenantId: "tenant-sensitive-1",
    roles: ["CHAT_USER"],
    resourceIds: ["document-1"],
    securityResourceRefs: ["document:document-1"],
    pipelineVersions,
    modelId: "answer-model-v2",
    retrievedCount: 2,
    finalEvidenceCount: 1,
    citationCount: 1,
    validCitationCount: 1,
    requiredFactCount: 1,
    supportedFactCount: 1,
    answerSentenceCount: 2,
    unsupportedSentenceCount: 0,
    answerSupportConfidence: 0.95,
    isAnswerable: true,
    sufficientContextAnswerable: true,
    injectionFindingCount: 1,
    injectionSuccessCount: 0,
    guardOutcomes: measureRuntimeRagGuards(Object.fromEntries(MANDATORY_RAG_GUARDS.map((guard) => [guard, { passed: true, evidence: "runtime_test" }])) as Record<MandatoryRagGuard, { passed: boolean; evidence: string }>),
    decisions: []
  })
  await producer.captureSearchRuntime({
    artifactId: "search-runtime-1",
    observedAt,
    latencyMs: 30,
    indexVersion: pipelineVersions.indexVersion,
    profileId: "runtime-rag",
    profileVersion: "runtime-rag-v2",
    embeddingModelId: pipelineVersions.embeddingModelId,
    tenantId: "tenant-sensitive-1",
    roles: ["CHAT_USER"],
    searchScope: { mode: "groups" }
  })
  const workerResult: WorkerResult = {
    runId: "chat-worker-1",
    targetType: "chat_run",
    status: "succeeded",
    resultType: "succeeded"
  }
  await producer.captureWorkerOutcome({
    result: workerResult,
    run: {
      createdAt: "2026-07-11T00:29:58.000Z",
      startedAt: "2026-07-11T00:29:59.000Z",
      completedAt: observedAt,
      tenantId: "tenant-sensitive-1",
      userGroups: ["CHAT_USER"]
    }
  })
  await producer.captureBenchmarkRun({
    runId: "benchmark-1",
    status: "succeeded",
    mode: "agent",
    runner: "lambda",
    suiteId: "approved-suite-v4",
    datasetS3Key: "benchmarks/approved-suite.jsonl",
    createdBy: "quality-owner",
    tenantId: "tenant-sensitive-1",
    createdAt: observedAt,
    updatedAt: observedAt,
    completedAt: observedAt,
    modelId: "answer-model-v2",
    embeddingModelId: pipelineVersions.embeddingModelId,
    metrics: {
      total: 100,
      succeeded: 99,
      failedHttp: 1,
      datasetVersion: "dataset-v4",
      workloadProfileVersion: policy.workloadProfileVersion,
      runtimeProfileVersion: policy.runtimeProfileVersion,
      priceCatalogVersion: policy.priceCatalogVersion,
      indexVersion: pipelineVersions.indexVersion,
      promptVersion: pipelineVersions.promptVersion,
      pipelineVersion: "pipeline-v8",
      parserVersion: pipelineVersions.sourceExtractorVersion,
      chunkerVersion: pipelineVersions.chunkerVersion,
      corpusProfileVersion: policy.workloadDimensions.corpusProfileVersion,
      aclDistributionVersion: policy.workloadDimensions.aclDistributionVersion,
      workloadConcurrency: policy.workloadDimensions.concurrency,
      documentSizeProfileVersion: policy.workloadDimensions.documentSizeProfileVersion,
      dependencyLatencyProfileVersion: policy.workloadDimensions.dependencyLatencyProfileVersion,
      qualitySliceMeasurements: completeSliceMeasurements(),
      extractionAccuracy: 0.97,
      admissionCorrectness: 0.99,
      retrievalRecallAtK: 0.91,
      falseDenialRate: 0.01,
      faithfulness: 0.96,
      unsupportedClaimRate: 0.02,
      citationPrecision: 0.98,
      citationCompleteness: 0.95,
      abstentionRecall: 0.97,
      falseRefusalRate: 0.01,
      taskCompletionRate: 0.94,
      noAccessLeakCount: 0,
      secretExposureCount: 0,
      eligibilityPropagationP99Ms: 500,
      p95LatencyMs: 250,
      errorRate: 0.01
    }
  })
  await producer.captureReleaseAudit({
    auditId: "release-audit-1",
    observedAt,
    datasetSpecificBranchCount: 0,
    artifactManifestMismatchCount: 0,
    runtimeVersion: policy.runtimeProfileVersion
  })
  await producer.captureEligibilityProbe({
    probeId: "eligibility-probe-1",
    observedAt,
    propagationMs: 450,
    tenantId: "tenant-sensitive-1",
    roles: ["CHAT_USER"]
  })

  const observations = await producer.aggregateWindow({ windowStart, windowEnd })
  assert.ok(observations.length >= policy.gates.length)
  for (const observation of observations) {
    assert.equal(observation.schemaVersion, RAG_QUALITY_OBSERVATION_SCHEMA_VERSION)
    assert.equal(observation.signalCatalogVersion, RAG_QUALITY_SIGNAL_CATALOG_VERSION)
    assert.equal(observation.profileId, policy.profileId)
    assert.equal(observation.profileVersion, policy.version)
    assert.ok(observation.slice)
    assert.ok(observation.source.producerVersion)
    assert.ok(Array.isArray(observation.source.missingVersionDimensions))
  }

  assert.equal(findObservation(observations, "ingest.silent_truncation_count").value, 0)
  assert.equal(findObservation(observations, "ingest.manifest_integrity").value, 1)
  assert.equal(findObservation(observations, "performance.search_p95_ms").value, 30)
  assert.equal(findObservation(observations, "release.dataset_specific_branch_count").value, 0)
  assert.equal(findObservation(observations, "evaluation.slice_case_count").value, 100)
  assert.equal(findObservation(observations, "reliability.success_rate", "use_case=chat").available, true)

  const normalChatKey = (await store.listKeys("quality-control/source-samples/")).find((key) => key.includes("/normal_chat/normal-chat-1/"))
  assert.ok(normalChatKey)
  const normalChatSample = JSON.parse(await store.getText(normalChatKey)) as {
    measurements: Record<string, { available: boolean; value: number | null }>
    guardOutcomes: Array<{ evidence: string }>
    proxyMeasurements: Record<string, { value: number; label: string }>
  }
  assert.equal(normalChatSample.measurements["generation.faithfulness"]?.available, false)
  assert.equal(normalChatSample.measurements["citation.precision"]?.available, false)
  assert.equal(normalChatSample.measurements["answerability.false_answer_rate"]?.available, false)
  assert.equal(normalChatSample.measurements["security.injection_success_count"]?.available, false)
  assert.equal(normalChatSample.proxyMeasurements.answerSupportRate?.value, 1)
  assert.match(normalChatSample.proxyMeasurements.answerSupportRate?.label ?? "", /proxy_not_reviewed/)
  assert.equal(normalChatSample.guardOutcomes.length, MANDATORY_RAG_GUARDS.length)
  assert.doesNotMatch(JSON.stringify(normalChatSample), /measured text|What is measured/)

  const injection = findObservation(observations, "security.injection_success_count")
  assert.equal(injection.available, false)
  assert.equal(injection.value, null)
  assert.equal(injection.confidence, null)
  assert.ok(injection.source.unavailableReasons?.includes("benchmark_injection_measurement_missing"))
  const cost = findObservation(observations, "cost.chat_per_request")
  assert.equal(cost.available, false)
  assert.ok(cost.source.unavailableReasons?.includes("versioned_price_measurement_missing"))

  const sourceSamples = await store.listKeys("quality-control/source-samples/")
  assert.ok(sourceSamples.length > 7)
  assert.equal(sourceSamples.some((key) => key.includes("tenant-sensitive-1")), false)
})

test("FR-093 aggregation records every mandatory gate and fails safe on unavailable rather than silently missing data", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-observation-control-loop-")))
  const policy = approvedPolicy()
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(policy))
  const producer = new ProductionRagObservationProducer(store)
  const monitor = new ProductionRagMonitor(store)
  await producer.captureIngestManifest({ manifest: manifestFixture(), latencyMs: 80 })
  await producer.captureDebugTrace(traceFixture(), { tenantId: "tenant-sensitive-1", roles: ["CHAT_USER"] })

  const observations = await producer.aggregateAndRecordWindow(monitor, { windowStart, windowEnd })
  const evidence = await monitor.evaluateWindow({ windowStart, windowEnd, evaluatedAt: windowEnd })
  assert.ok(observations.length >= policy.gates.length)
  assert.equal(evidence.decision.status, "fail")
  assert.equal(evidence.decision.results.some((result) => result.reason === "missing_signal"), false)
  assert.equal(evidence.decision.results.some((result) => result.reason === "profile_mismatch"), true)
  assert.ok(evidence.executedActions.includes("promotion_freeze"))

  const invalidProfile = { ...observations[0]!, profileVersion: "" }
  await assert.rejects(() => monitor.recordObservation(invalidProfile), /Invalid RAG quality observation identity/)
  const invalidUnavailable = { ...findObservation(observations, "cost.chat_per_request"), value: 1 }
  await assert.rejects(() => monitor.recordObservation(invalidUnavailable), /must not contain a value/)
})

test("FR-093 aggregation never combines samples with different model version fingerprints", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-observation-version-split-")))
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(approvedPolicy()))
  const producer = new ProductionRagObservationProducer(store)
  for (const model of ["embedding-model-a", "embedding-model-b"]) {
    await producer.captureSearchRuntime({
      artifactId: `search-${model}`,
      observedAt,
      latencyMs: 20,
      indexVersion: pipelineVersions.indexVersion,
      embeddingModelId: model,
      tenantId: "tenant-sensitive-1",
      roles: ["CHAT_USER"]
    })
  }

  const observations = (await producer.aggregateWindow({ windowStart, windowEnd }))
    .filter((item) => item.signalId === "performance.search_p95_ms" && item.slice === "overall" && item.available)
  assert.equal(observations.length, 2)
  assert.deepEqual(new Set(observations.flatMap((item) => item.source.versionDimensions.model ?? [])), new Set(["embedding-model-a", "embedding-model-b"]))
})

test("FR-093 an empty action list remains evaluable so the code-owned safety fallback cannot be bypassed", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-observation-invalid-actions-")))
  const invalidPolicy = approvedPolicy()
  invalidPolicy.responsePolicy.allowedActions = []
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(invalidPolicy))
  const producer = new ProductionRagObservationProducer(store)

  const observations = await producer.aggregateWindow({ windowStart, windowEnd })

  assert.ok(observations.length >= invalidPolicy.gates.length)
  assert.ok(observations.every((observation) => !observation.available))
})

test("FR-075 benchmark quality evidence connects workload, price, recovery, and release audit metrics to production observations", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-benchmark-quality-evidence-")))
  const policy = approvedPolicy()
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(policy))
  const producer = new ProductionRagObservationProducer(store)

  await producer.captureBenchmarkRun({
    runId: "benchmark-release-evidence-1",
    status: "succeeded",
    mode: "agent",
    runner: "codebuild",
    suiteId: "approved-suite-v4",
    datasetS3Key: "benchmarks/approved-suite.jsonl",
    createdBy: "quality-owner",
    tenantId: "tenant-sensitive-1",
    createdAt: observedAt,
    updatedAt: observedAt,
    completedAt: observedAt,
    modelId: "answer-model-v2",
    embeddingModelId: pipelineVersions.embeddingModelId,
    metrics: {
      total: 4,
      succeeded: 4,
      failedHttp: 0,
      datasetVersion: "dataset-v4",
      workloadProfileVersion: policy.workloadProfileVersion,
      runtimeProfileVersion: policy.runtimeProfileVersion,
      priceCatalogVersion: policy.priceCatalogVersion,
      indexVersion: pipelineVersions.indexVersion,
      promptVersion: pipelineVersions.promptVersion,
      pipelineVersion: "pipeline-v8",
      parserVersion: pipelineVersions.sourceExtractorVersion,
      chunkerVersion: pipelineVersions.chunkerVersion,
      corpusProfileVersion: policy.workloadDimensions.corpusProfileVersion,
      aclDistributionVersion: policy.workloadDimensions.aclDistributionVersion,
      workloadConcurrency: policy.workloadDimensions.concurrency,
      documentSizeProfileVersion: policy.workloadDimensions.documentSizeProfileVersion,
      dependencyLatencyProfileVersion: policy.workloadDimensions.dependencyLatencyProfileVersion,
      qualitySliceMeasurements: completeSliceMeasurements(),
      eligibilityPropagationP99Ms: 40,
      eligibilityProbeSampleCount: 4,
      mttrMs: 1_500,
      recoverySampleCount: 2,
      backlogAgeP99Ms: 300,
      backlogAgeSampleCount: 4,
      chatCostPerRequest: 0.012,
      chatCostEvidenceSampleCount: 4,
      releaseAuditVersion: "rag-release-audit-v1",
      releaseAuditId: "sha256:release-evidence",
      datasetSpecificBranchCount: 0,
      artifactManifestMismatchCount: 0,
      p95LatencyMs: 250,
      errorRate: 0
    }
  })

  const observations = await producer.aggregateWindow({ windowStart, windowEnd })
  assert.equal(findObservation(observations, "security.eligibility_propagation_p99_ms").value, 40)
  assert.equal(findObservation(observations, "reliability.mttr_ms").value, 1_500)
  assert.equal(findObservation(observations, "reliability.backlog_age_p99_ms").value, 300)
  assert.equal(findObservation(observations, "cost.chat_per_request").value, 0.012)
  const release = findObservation(observations, "release.dataset_specific_branch_count")
  assert.equal(release.value, 0)
  assert.ok(release.source.artifactTypes.includes("benchmark_summary"))
  assert.deepEqual(release.source.versionDimensions.releaseAudit, ["sha256:release-evidence"])
  assert.deepEqual(release.source.missingVersionDimensions, [])
})

test("FR-093 eligibility propagation records the first current-state detection exactly once", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-eligibility-probe-once-")))
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(approvedPolicy()))
  const producer = new ProductionRagObservationProducer(store)

  assert.ok((await producer.captureEligibilityProbeOnce({
    probeId: "source-governance:tenant-sensitive-1:document-1:2:normal_rag",
    detectedAt: observedAt,
    propagationMs: 125,
    tenantId: "tenant-sensitive-1"
  })).recorded > 0)
  assert.equal((await producer.captureEligibilityProbeOnce({
    probeId: "source-governance:tenant-sensitive-1:document-1:2:normal_rag",
    detectedAt: "2026-07-11T00:45:00.000Z",
    propagationMs: 999_999,
    tenantId: "tenant-sensitive-1"
  })).recorded, 0)

  const sampleKeys = await store.listKeys("quality-control/source-samples/")
  const samples = await Promise.all(sampleKeys.map(async (key) => JSON.parse(await store.getText(key)) as {
    sourceType: string
    artifactId: string
    measurements: Record<string, { value: number | null }>
  }))
  const probes = samples.filter((sample) => sample.sourceType === "eligibility_probe")
  assert.ok(probes.length > 0)
  assert.ok(probes.every((sample) => sample.artifactId.includes("document-1")))
  assert.ok(probes.every((sample) => sample.measurements["security.eligibility_propagation_p99_ms"]?.value === 125))
  const [markerKey] = await store.listKeys("quality-control/eligibility-probes/")
  assert.ok(markerKey)
  assert.equal(JSON.parse(await store.getText(markerKey)).status, "recorded")
})

test("FR-093 eligibility propagation passes provenance validation only with explicit matching runtime evidence", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-eligibility-explicit-provenance-")))
  const policy = approvedPolicy()
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(policy))
  const producer = new ProductionRagObservationProducer(store)
  const monitor = new ProductionRagMonitor(store)

  await producer.captureEligibilityProbe({
    probeId: "explicit-current-runtime-evidence",
    observedAt,
    propagationMs: 40,
    roles: ["CHAT_USER"],
    versionDimensions: {
      ...policy.evidenceVersions,
      runtime: policy.runtimeProfileVersion,
      workload: policy.workloadProfileVersion,
      price: policy.priceCatalogVersion
    }
  })
  const observations = await producer.aggregateAndRecordWindow(monitor, { windowStart, windowEnd, observedAt })
  const propagation = findObservation(observations, "security.eligibility_propagation_p99_ms")
  assert.equal(propagation.available, true)
  assert.deepEqual(propagation.source.missingVersionDimensions, [])

  const evidence = await monitor.evaluateWindow({ windowStart, windowEnd, evaluatedAt: windowEnd })
  const result = evidence.decision.results.find((item) => (
    item.signalId === "security.eligibility_propagation_p99_ms" && item.slice === "overall"
  ))
  assert.equal(result?.status, "pass")
  assert.equal(result?.reason, "threshold_satisfied")
})

test("FR-093 current governance denial emits a production eligibility propagation probe", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-current-eligibility-probe-")))
  const policy = approvedPolicy()
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(policy))
  const manifest = { ...manifestFixture(), lifecycleStatus: "active" as const }
  const admission = manifest.admission
  assert.ok(admission)
  const restrictedAt = new Date(Date.now() - 125).toISOString()
  await store.putText("source-governance/tenant-sensitive-1/document-1.json", JSON.stringify({
    schemaVersion: 1,
    sourceId: manifest.documentId,
    sourceVersion: manifest.documentVersion,
    sourceManifestObjectKey: manifest.manifestObjectKey,
    tenantId: admission.tenantId,
    ownerUserId: admission.ownerUserId,
    status: "restricted",
    revision: 2,
    approval: {
      classification: { level: "internal", policyVersion: "classification-v1" },
      usagePolicy: {
        allowedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
        externalModelAllowed: true,
        loggingAllowed: true,
        evaluationAllowed: true,
        policyVersion: "usage-v1"
      },
      qualityProfile: {
        knowledgeQualityStatus: "approved",
        verificationStatus: "verified",
        freshnessStatus: "current",
        supersessionStatus: "current",
        extractionQualityStatus: "high",
        ragEligibility: "eligible",
        flags: []
      },
      inspection: {
        status: "passed",
        profileVersion: "inspection-v1",
        malwareStatus: "clean",
        malwareProfileVersion: "malware-scan-v1"
      },
      classificationRef: admission.classificationRef,
      usagePolicyRef: admission.usagePolicyRef,
      qualityRef: admission.qualityRef,
      approvedBy: "quality-owner",
      approvedAt: observedAt,
      reason: "approved fixture"
    },
    restriction: {
      dimensions: ["classification"],
      deniedPurposes: [],
      restrictedBy: "security-owner",
      restrictedAt,
      reason: "classification changed"
    },
    activeDocumentId: manifest.documentId,
    createdAt: observedAt,
    updatedAt: restrictedAt
  }))

  const current = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: store,
    manifest,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "normal_answer",
    roles: ["CHAT_USER"]
  })
  assert.equal(current.classificationAllowed, false)
  const sampleKeys = await store.listKeys("quality-control/source-samples/")
  const samples = await Promise.all(sampleKeys.map(async (key) => JSON.parse(await store.getText(key)) as {
    sourceType: string
    slice: string
    versionDimensions: Record<string, string[]>
    missingVersionDimensions: string[]
  }))
  const probeSamples = samples.filter((sample) => sample.sourceType === "eligibility_probe")
  assert.ok(probeSamples.length > 0)
  assert.ok(probeSamples.some((sample) => sample.slice === "role=chat_user"))
  for (const sample of probeSamples) {
    assert.ok(sample.missingVersionDimensions.includes("dataset"))
    assert.ok(sample.missingVersionDimensions.includes("runtime"))
    assert.ok(sample.missingVersionDimensions.includes("workload"))
    assert.ok(sample.missingVersionDimensions.includes("price"))
    assert.equal(sample.versionDimensions.dataset, undefined)
    assert.deepEqual(sample.versionDimensions.model, [pipelineVersions.embeddingModelId])
    assert.deepEqual(sample.versionDimensions.index, [policy.evidenceVersions.index])
    assert.deepEqual(sample.versionDimensions.prompt, [policy.evidenceVersions.prompt])
    assert.deepEqual(sample.versionDimensions.parser, [policy.evidenceVersions.parser])
    assert.deepEqual(sample.versionDimensions.chunker, [policy.evidenceVersions.chunker])
    assert.equal(sample.versionDimensions.runtime, undefined)
    assert.equal(sample.versionDimensions.workload, undefined)
    assert.equal(sample.versionDimensions.price, undefined)
  }

  const producer = new ProductionRagObservationProducer(store)
  const monitor = new ProductionRagMonitor(store)
  const dynamicWindowStart = new Date(Date.parse(restrictedAt) - 1_000).toISOString()
  const dynamicWindowEnd = new Date(Date.now() + 1_000).toISOString()
  const observations = await producer.aggregateAndRecordWindow(monitor, {
    windowStart: dynamicWindowStart,
    windowEnd: dynamicWindowEnd,
    observedAt: dynamicWindowEnd
  })
  const propagationObservation = findObservation(observations, "security.eligibility_propagation_p99_ms")
  assert.equal(propagationObservation.available, true)
  assert.ok(propagationObservation.source.missingVersionDimensions.includes("dataset"))
  assert.ok(propagationObservation.source.missingVersionDimensions.includes("runtime"))

  const evidence = await monitor.evaluateWindow({
    windowStart: dynamicWindowStart,
    windowEnd: new Date(Date.parse(dynamicWindowEnd) + 1_000).toISOString(),
    evaluatedAt: new Date(Date.parse(dynamicWindowEnd) + 500).toISOString()
  })
  const propagationResult = evidence.decision.results.find((result) => (
    result.signalId === "security.eligibility_propagation_p99_ms" && result.slice === "overall"
  ))
  assert.equal(propagationResult?.status, "fail")
  assert.equal(propagationResult?.reason, "profile_mismatch")
})

function findObservation(
  observations: Awaited<ReturnType<ProductionRagObservationProducer["aggregateWindow"]>>,
  signalId: RagQualitySignalId,
  slice = "overall"
) {
  const matching = observations.filter((item) => item.signalId === signalId && item.slice === slice)
  const observation = matching.find((item) => item.available) ?? matching[0]
  assert.ok(observation, `${signalId}[${slice}] observation must exist`)
  return observation
}
