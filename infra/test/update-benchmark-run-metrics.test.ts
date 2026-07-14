import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

const scriptPath = path.resolve(__dirname, "../scripts/update-benchmark-run-metrics.mjs")
const importModule = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>
type MetricRecord = Record<string, unknown>

test("extracts admin-visible agent benchmark metrics from summary JSON", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): MetricRecord
  }

  assert.deepEqual(script.buildBenchmarkRunMetrics({
    total: 3,
    succeeded: 3,
    failedHttp: 0,
    metrics: {
      answerableAccuracy: 0.75,
      abstentionRecall: null,
      retrievalRecallAt20: 1,
      p50LatencyMs: 1200,
      p95LatencyMs: 3400,
      averageLatencyMs: 2100
    }
  }), {
    total: 3,
    succeeded: 3,
    failedHttp: 0,
    answerableAccuracy: 0.75,
    retrievalRecallAt20: 1,
    p50LatencyMs: 1200,
    p95LatencyMs: 3400,
    averageLatencyMs: 2100,
    errorRate: 0
  })
})

test("maps search benchmark recall@20 into run metrics", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): MetricRecord
    dynamoMetricsAttributeValue(metrics: MetricRecord): unknown
  }
  const metrics = script.buildBenchmarkRunMetrics({
    total: 2,
    succeeded: 1,
    failedHttp: 1,
    metrics: {
      recallAt20: 0.5,
      expectedFileHitRate: 1,
      p50LatencyMs: 10,
      p95LatencyMs: 20,
      averageLatencyMs: 15
    }
  })

  assert.equal(metrics.retrievalRecallAt20, 0.5)
  assert.equal(metrics.errorRate, 0.5)
  assert.deepEqual(script.dynamoMetricsAttributeValue(metrics), {
    M: {
      total: { N: "2" },
      succeeded: { N: "1" },
      failedHttp: { N: "1" },
      expectedFileHitRate: { N: "1" },
      retrievalRecallAt20: { N: "0.5" },
      p50LatencyMs: { N: "10" },
      p95LatencyMs: { N: "20" },
      averageLatencyMs: { N: "15" },
      errorRate: { N: "0.5" }
    }
  })
})

test("maps conversation benchmark summary metrics into run metrics", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): MetricRecord
  }

  assert.deepEqual(script.buildBenchmarkRunMetrics({
    totalTurns: 4,
    succeededTurns: 4,
    failedHttp: 0,
    metrics: {
      turnAnswerCorrectRate: 0.75,
      conversationSuccessRate: 0.5,
      historyDependentAccuracy: 0.5,
      abstentionAccuracy: 1,
      retrievalRecallAtK: 0.75
    }
  }), {
    total: 4,
    succeeded: 4,
    failedHttp: 0,
    turnAnswerCorrectRate: 0.75,
    conversationSuccessRate: 0.5,
    historyDependentAccuracy: 0.5,
    abstentionAccuracy: 1,
    retrievalRecallAtK: 0.75,
    errorRate: 0
  })
})

test("uses expression attribute names for DynamoDB reserved attributes", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildUpdateBenchmarkRunMetricsCommandInput(input: {
      TableName: string
      storageRunId: string
      metrics: MetricRecord
      updatedAt: string
    }): unknown
  }

  assert.deepEqual(script.buildUpdateBenchmarkRunMetricsCommandInput({
    TableName: "BenchmarkRuns",
    storageRunId: "tenant:abc#bench_1",
    metrics: { total: 1, errorRate: 0 },
    updatedAt: "2026-05-06T12:00:00.000Z"
  }), {
    TableName: "BenchmarkRuns",
    Key: { runId: { S: "tenant:abc#bench_1" } },
    ConditionExpression: "attribute_exists(#runId) AND #status = :running",
    UpdateExpression: "SET #metrics = :metrics, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#runId": "runId",
      "#status": "status",
      "#metrics": "metrics",
      "#updatedAt": "updatedAt"
    },
    ExpressionAttributeValues: {
      ":running": { S: "running" },
      ":metrics": {
        M: {
          total: { N: "1" },
          errorRate: { N: "0" }
        }
      },
      ":updatedAt": { S: "2026-05-06T12:00:00.000Z" }
    }
  })
})

test("derives denial, citation, refusal, task, security, and latency evidence from versioned case artifacts", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): MetricRecord
  }
  const summary = versionedSummary([
    caseResult({ recallAtK: 0.5, recallAt20: 0.75, citationHit: true, support: true, actualResponseType: "answer", taskOutcome: "complete", latencyMs: 10, leaks: 0 }),
    caseResult({ recallAtK: 1, recallAt20: 1, citationHit: false, support: false, actualResponseType: "refusal", taskOutcome: "failed", latencyMs: 20, leaks: 0 }),
    caseResult({ recallAtK: 1, recallAt20: 1, citationHit: true, support: true, actualResponseType: "answer", taskOutcome: "complete", latencyMs: 30, leaks: 0 }),
    caseResult({ recallAtK: 0.5, recallAt20: 0.75, citationHit: true, support: true, actualResponseType: "answer", taskOutcome: "complete", latencyMs: 40, leaks: 1 })
  ]) as Record<string, unknown>
  summary.metrics = {
    falseDenialRate: 0.99,
    citationCompleteness: 0.99,
    falseRefusalRate: 0.99,
    taskCompletionRate: 0.99,
    p99LatencyMs: 9999,
    noAccessLeakCount: 999
  }

  const metrics = script.buildBenchmarkRunMetrics(summary)

  assert.equal(metrics.falseDenialRate, 0.25)
  assert.equal(metrics.citationCompleteness, 0.75)
  assert.equal(metrics.citationPrecision, 0.75)
  assert.equal(metrics.faithfulness, 0.875)
  assert.equal(metrics.unsupportedClaimRate, 0.125)
  assert.equal(metrics.falseRefusalRate, 0.25)
  assert.equal(metrics.taskCompletionRate, 0.75)
  assert.equal(metrics.taskOutcomeAccuracy, 0.75)
  assert.equal(metrics.noAccessLeakCount, 1)
  assert.equal(metrics.p50LatencyMs, 20)
  assert.equal(metrics.p95LatencyMs, 40)
  assert.equal(metrics.p99LatencyMs, 40)
  assert.equal(metrics.averageLatencyMs, 25)
  assert.equal(metrics.datasetVersion, "dataset-v7")
})

test("does not trust optional aggregate quality values when versioned case evidence is absent", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): MetricRecord
  }
  const metrics = script.buildBenchmarkRunMetrics({
    total: 1,
    succeeded: 1,
    failedHttp: 0,
    metrics: {
      falseDenialRate: 0,
      citationCompleteness: 1,
      falseRefusalRate: 0,
      taskCompletionRate: 1,
      noAccessLeakCount: 0
    }
  })

  for (const name of ["falseDenialRate", "citationCompleteness", "falseRefusalRate", "taskCompletionRate", "noAccessLeakCount"]) {
    assert.equal(name in metrics, false, `${name} must remain unavailable`)
  }
})

test("derives false-answer rate from case-level expected and actual answerability labels", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): MetricRecord
  }
  const falseAnswer = caseResult({ recallAtK: 1, recallAt20: 1, citationHit: false, support: false, actualResponseType: "answer", taskOutcome: "failed", latencyMs: 10, leaks: 0 })
  falseAnswer.answerability.expectedAnswerable = false
  const correctRefusal = caseResult({ recallAtK: 1, recallAt20: 1, citationHit: false, support: false, actualResponseType: "refusal", taskOutcome: "complete", latencyMs: 10, leaks: 0 })
  correctRefusal.answerability.expectedAnswerable = false

  const metrics = script.buildBenchmarkRunMetrics(versionedSummary([falseAnswer, correctRefusal]))
  assert.equal(metrics.falseAnswerRate, 0.5)
  assert.equal("falseRefusalRate" in metrics, false)
})

test("derives eligibility propagation and MTTR only from an approved matching workload evidence profile", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown, evidence: unknown): MetricRecord
  }
  const workloadEvidence = completeWorkloadEvidence()
  workloadEvidence.eligibilityProbes[0]!.unreflectedResourceIds = ["document-stale"]

  const metrics = script.buildBenchmarkRunMetrics(versionedSummary([]), { workloadEvidence })
  assert.equal(metrics.workloadProfileVersion, "workload-v3")
  assert.equal(metrics.runtimeProfileVersion, "runtime-v9")
  assert.equal(metrics.eligibilityPropagationP50Ms, 40)
  assert.equal(metrics.eligibilityPropagationP95Ms, 40)
  assert.equal(metrics.eligibilityPropagationP99Ms, 40)
  assert.equal(metrics.eligibilityPropagationMaxMs, 40)
  assert.equal(metrics.eligibilityProbeSampleCount, 70)
  assert.equal(metrics.eligibilityMatrixCoverage, 1)
  assert.equal(metrics.eligibilityUnreconciledResourceCount, 1)
  assert.equal(metrics.mttrMs, 2500)
  assert.equal(metrics.recoveryP95Ms, 4000)
  assert.equal(metrics.recoveryWithoutLossRate, 0.75)
  assert.equal(metrics.recoveryLossCount, 1)
  assert.equal(metrics.recoverySampleCount, 4)
  assert.equal(metrics.backlogAgeP99Ms, 500)
  assert.equal(metrics.backlogAgeSampleCount, 3)
  assert.equal(metrics.timeoutRate, 0.333333333333)
  const report = metrics.eligibilityMatrixReport as { triggerCount: number; pathCount: number; probeCount: number; unreflectedResourceIds: string[] }
  assert.deepEqual(report, {
    ...report,
    triggerCount: 10,
    pathCount: 7,
    probeCount: 70,
    unreflectedResourceIds: ["document-stale"]
  })
  const slices = metrics.qualitySliceMeasurements as Array<{ slice: string; sampleCount: number; measurements: Record<string, number> }>
  assert.deepEqual(slices.find((item) => item.slice === "stage=chat"), {
    slice: "stage=chat",
    sampleCount: 1,
    measurements: {
      "performance.chat_p50_ms": 100,
      "performance.chat_p95_ms": 100,
      "performance.chat_p99_ms": 100
    }
  })
  assert.equal(slices.find((item) => item.slice === "endpoint=search|stage=search")?.measurements["reliability.timeout_rate"], 1)
  assert.equal(slices.find((item) => item.slice === "dependency=llm")?.measurements["reliability.recovery_loss_count"], 1)

  const unapproved = { ...workloadEvidence, approvedBy: "" }
  const unavailable = script.buildBenchmarkRunMetrics(versionedSummary([]), { workloadEvidence: unapproved })
  assert.equal("eligibilityPropagationP99Ms" in unavailable, false)
  assert.equal("mttrMs" in unavailable, false)
})

test("SQ-006, SQ-007, SQ-008, and SQ-014 leave workload metrics unavailable for any incomplete matrix, dimension, endpoint-stage, or recovery dependency", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown, evidence: unknown): MetricRecord
  }
  const summary = versionedSummary([])
  const variants = [
    (() => { const value = completeWorkloadEvidence(); value.eligibilityProbes.pop(); return value })(),
    (() => { const value = completeWorkloadEvidence(); value.dimensions.concurrency = 9; return value })(),
    (() => { const value = completeWorkloadEvidence(); value.endpointStageSamples = value.endpointStageSamples.filter((item) => item.endpoint !== "ingest"); return value })(),
    (() => { const value = completeWorkloadEvidence(); value.recoveryScenarios = value.recoveryScenarios.filter((item) => item.dependency !== "queue"); return value })()
  ]

  for (const workloadEvidence of variants) {
    const metrics = script.buildBenchmarkRunMetrics(summary, { workloadEvidence })
    for (const name of [
      "eligibilityMatrixCoverage",
      "eligibilityPropagationP50Ms",
      "eligibilityPropagationP95Ms",
      "eligibilityPropagationP99Ms",
      "eligibilityPropagationMaxMs",
      "mttrMs",
      "timeoutRate",
      "qualitySliceMeasurements"
    ]) assert.equal(name in metrics, false, `${name} must remain unavailable`)
  }
})

test("SQ-010, SQ-011, and SQ-013 derive claim/citation/business zero-tolerance violations and withhold incomplete slice evidence", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): MetricRecord
  }
  const critical = caseResult({ recallAtK: 1, recallAt20: 1, citationHit: true, support: true, actualResponseType: "answer", taskOutcome: "failed", latencyMs: 10, leaks: 0 })
  critical.claims[0]!.supported = false
  critical.claims[0]!.citationIds = []
  const metrics = script.buildBenchmarkRunMetrics(versionedSummary([critical]))

  assert.equal(metrics.criticalUnsupportedClaimCount, 1)
  assert.equal(metrics.requiredClaimMissCount, 1)
  assert.equal(metrics.criticalTaskFailureCount, 1)
  assert.equal(metrics.faithfulness, 0.5)
  assert.equal(metrics.citationCompleteness, 0.5)
  assert.equal(metrics.citationLocatorValidity, 1)

  const missingSlice = { ...critical, slice: undefined }
  const incompleteSliceMetrics = script.buildBenchmarkRunMetrics(versionedSummary([missingSlice]))
  assert.equal("qualitySliceMeasurements" in incompleteSliceMetrics, false)

  const missingClaims = { ...critical, claims: undefined }
  const incompleteClaimMetrics = script.buildBenchmarkRunMetrics(versionedSummary([missingClaims]))
  assert.equal("criticalUnsupportedClaimCount" in incompleteClaimMetrics, false)
  assert.equal("requiredClaimMissCount" in incompleteClaimMetrics, false)
})

test("computes component and total unit cost from complete usage plus an approved versioned price catalog", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown, evidence: unknown): MetricRecord
    dynamoMetricsAttributeValue(metrics: MetricRecord): unknown
  }
  const summary = versionedSummary([
    {
      ...caseResult({ recallAtK: 1, recallAt20: 1, citationHit: true, support: true, actualResponseType: "answer", taskOutcome: "complete", latencyMs: 10, leaks: 0 }),
      cost: { inputTokens: 1_000_000, outputTokens: 500_000, embeddingInputTokens: 1_000_000, storageByteHours: 1_000_000_000, workerMilliseconds: 1_000, egressBytes: 1_000_000_000, usageComplete: true }
    }
  ])
  const priceCatalog = {
    schemaVersion: 1,
    catalogId: "aws-us-east-1",
    version: "price-v6",
    approvedBy: "finops-owner",
    approvedAt: "2026-07-11T00:00:00.000Z",
    region: "us-east-1",
    currency: "USD",
    modelRates: { "model-v2": { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 } },
    embeddingRates: { "embed-v3": { usdPerMillionTokens: 0.5 } },
    storageUsdPerGbHour: 0.1,
    workerUsdPerSecond: 0.2,
    egressUsdPerGb: 0.3
  }

  const metrics = script.buildBenchmarkRunMetrics(summary, { priceCatalog })
  assert.equal(metrics.priceCatalogVersion, "price-v6")
  assert.equal(metrics.modelCostPerUnit, 2)
  assert.equal(metrics.embeddingCostPerUnit, 0.5)
  assert.equal(metrics.storageCostPerUnit, 0.1)
  assert.equal(metrics.workerCostPerUnit, 0.2)
  assert.equal(metrics.egressCostPerUnit, 0.3)
  assert.equal(metrics.totalCostPerUnit, 3.1)
  assert.equal(metrics.chatCostPerRequest, 3.1)
  assert.equal(metrics.costEvidenceSampleCount, 1)
  assert.equal(metrics.chatCostEvidenceSampleCount, 1)
  assert.equal(metrics.unitCostKind, "chat_request")
  assert.deepEqual(script.dynamoMetricsAttributeValue({ priceCatalogVersion: "price-v6", totalCostPerUnit: 3.1 }), {
    M: { priceCatalogVersion: { S: "price-v6" }, totalCostPerUnit: { N: "3.1" } }
  })

  const ingestSummary = versionedSummary([{
    ...caseResult({ recallAtK: 1, recallAt20: 1, citationHit: true, support: true, actualResponseType: "answer", taskOutcome: "complete", latencyMs: 10, leaks: 0 }),
    cost: { workerMilliseconds: 2_000, unitKind: "ingest_document", usageComplete: true }
  }])
  const ingestMetrics = script.buildBenchmarkRunMetrics(ingestSummary, { priceCatalog })
  assert.equal(ingestMetrics.ingestCostPerDocument, 0.4)
  assert.equal(ingestMetrics.ingestCostEvidenceSampleCount, 1)
  assert.equal(ingestMetrics.unitCostKind, "ingest_document")
})

test("imports deterministic release audit counts and rejects incomplete audit metadata", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown, evidence: unknown): MetricRecord
  }
  const releaseAudit = {
    schemaVersion: 1,
    auditVersion: "rag-release-audit-v1",
    auditId: "sha256:audit",
    metrics: { datasetSpecificBranchCount: 0, artifactManifestMismatchCount: 2 }
  }
  const metrics = script.buildBenchmarkRunMetrics(versionedSummary([]), { releaseAudit })
  assert.equal(metrics.releaseAuditVersion, "rag-release-audit-v1")
  assert.equal(metrics.releaseAuditId, "sha256:audit")
  assert.equal(metrics.datasetSpecificBranchCount, 0)
  assert.equal(metrics.artifactManifestMismatchCount, 2)

  const unavailable = script.buildBenchmarkRunMetrics(versionedSummary([]), { releaseAudit: { ...releaseAudit, auditId: "" } })
  assert.equal("datasetSpecificBranchCount" in unavailable, false)
})

function completeEligibilityProbes() {
  const triggers = ["share", "account", "role", "group", "classification", "usage", "quality", "expiry", "archive", "delete"]
  const paths = ["active", "staged", "old_index", "cache", "session", "memory", "queued_worker"]
  return triggers.flatMap((trigger) => paths.map((pathName) => ({
    probeId: `${trigger}:${pathName}`,
    trigger,
    path: pathName,
    committedAt: "2026-07-11T00:00:00.000Z",
    deniedAt: "2026-07-11T00:00:00.040Z",
    unreflectedResourceIds: [] as string[]
  })))
}

function completeWorkloadEvidence() {
  return {
    schemaVersion: 1,
    profileId: "representative-load",
    version: "workload-v3",
    approvedBy: "sre-owner",
    approvedAt: "2026-07-11T00:00:00.000Z",
    datasetVersion: "dataset-v7",
    runtimeProfileVersion: "runtime-v9",
    dimensions: { corpusProfileVersion: "corpus-v2", aclDistributionVersion: "acl-v3", concurrency: 8, documentSizeProfileVersion: "size-v2", dependencyLatencyProfileVersion: "dependency-v4" },
    eligibilityProbes: completeEligibilityProbes(),
    recoveryScenarios: [
      { scenarioId: "r1", dependency: "vector", failedAt: "2026-07-11T00:00:00.000Z", recoveredAt: "2026-07-11T00:00:01.000Z", retryExhausted: false, reconciledWithoutLoss: true, duplicateOrLostArtifactCount: 0 },
      { scenarioId: "r2", dependency: "llm", failedAt: "2026-07-11T00:00:00.000Z", recoveredAt: "2026-07-11T00:00:03.000Z", retryExhausted: true, reconciledWithoutLoss: false, duplicateOrLostArtifactCount: 1 },
      { scenarioId: "r3", dependency: "ocr", failedAt: "2026-07-11T00:00:00.000Z", recoveredAt: "2026-07-11T00:00:02.000Z", retryExhausted: false, reconciledWithoutLoss: true, duplicateOrLostArtifactCount: 0 },
      { scenarioId: "r4", dependency: "queue", failedAt: "2026-07-11T00:00:00.000Z", recoveredAt: "2026-07-11T00:00:04.000Z", retryExhausted: false, reconciledWithoutLoss: true, duplicateOrLostArtifactCount: 0 }
    ],
    endpointStageSamples: [
      { sampleId: "b1", endpoint: "chat", stage: "chat", createdAt: "2026-07-11T00:00:00.000Z", startedAt: "2026-07-11T00:00:00.100Z", completedAt: "2026-07-11T00:00:00.200Z", outcome: "success", retryExhausted: false },
      { sampleId: "b2", endpoint: "search", stage: "search", createdAt: "2026-07-11T00:00:00.000Z", startedAt: "2026-07-11T00:00:00.500Z", completedAt: "2026-07-11T00:00:00.700Z", outcome: "timeout", retryExhausted: true },
      { sampleId: "b3", endpoint: "ingest", stage: "ingest", createdAt: "2026-07-11T00:00:00.000Z", startedAt: "2026-07-11T00:00:00.200Z", completedAt: "2026-07-11T00:00:00.500Z", outcome: "error", retryExhausted: false }
    ]
  }
}

function versionedSummary(caseResults: unknown[]): unknown {
  return {
    artifactContractVersion: 1,
    suite: {
      suiteId: "suite-v7",
      runner: "agent",
      evaluatorProfile: "evaluator-v4",
      datasetSource: { type: "local", datasetVersion: "dataset-v7" }
    },
    candidateConfig: {
      benchmarkSuiteId: "suite-v7",
      runner: "agent",
      modelId: "model-v2",
      embeddingModelId: "embed-v3",
      runtimeProfileVersion: "runtime-v9",
      workloadProfileVersion: "workload-v3",
      corpusProfileVersion: "corpus-v2",
      aclDistributionVersion: "acl-v3",
      workloadConcurrency: 8,
      documentSizeProfileVersion: "size-v2",
      dependencyLatencyProfileVersion: "dependency-v4",
      priceCatalogVersion: "price-v6",
      indexVersion: "index-v7",
      promptVersion: "prompt-v5",
      pipelineVersion: "pipeline-v8",
      parserVersion: "parser-v4",
      chunkerVersion: "chunker-v2"
    },
    caseResults,
    total: caseResults.length,
    succeeded: caseResults.length,
    failedHttp: 0,
    metrics: {}
  }
}

function caseResult(input: {
  recallAtK: number
  recallAt20: number
  citationHit: boolean
  support: boolean
  actualResponseType: "answer" | "refusal"
  taskOutcome: "complete" | "failed"
  latencyMs: number
  leaks: number
}) {
  return {
    caseId: `case-${input.latencyMs}`,
    status: 200,
    passed: input.taskOutcome === "complete",
    failureReasons: [],
    retrieval: { recallAtK: input.recallAtK, recallAt20: input.recallAt20, noAccessLeakCount: input.leaks },
    slice: { questionType: "fact", tenantRole: "tenant-a:chat-user", ocrMode: "native", language: "ja", multiEvidence: true, answerability: "answerable", severity: "high" },
    citation: { expectedFileHit: input.citationHit, citationSupportPass: input.support },
    claims: [
      { claimId: `claim-${input.latencyMs}-1`, severity: "high", requiresCitation: true, supported: true, supportSpans: [{ documentId: "doc-1", documentVersion: "v1", spanId: `span-${input.latencyMs}-1`, locatorValid: true }], citationIds: input.citationHit ? [`citation-${input.latencyMs}`] : [] },
      { claimId: `claim-${input.latencyMs}-2`, severity: "medium", requiresCitation: true, supported: input.support, supportSpans: [{ documentId: "doc-1", documentVersion: "v1", spanId: `span-${input.latencyMs}-2`, locatorValid: true }], citationIds: input.citationHit && input.support ? [`citation-${input.latencyMs}`] : [] }
    ],
    citations: [{ citationId: `citation-${input.latencyMs}`, claimIds: [`claim-${input.latencyMs}-1`, `claim-${input.latencyMs}-2`], relevant: input.support, supportValid: input.support, locatorValid: true }],
    answerability: { expectedAnswerable: true, actualResponseType: input.actualResponseType },
    task: { expectedOutcome: "complete", actualOutcome: input.taskOutcome, scenario: { actor: "employee", goal: "answer policy question", successCriteria: ["grounded answer"], allowedHandoffs: ["handoff"], severity: "high" } },
    generation: { supportedClaimCount: input.taskOutcome === "complete" ? 2 : 1, unsupportedClaimCount: input.taskOutcome === "complete" ? 0 : 1, evaluatedClaimCount: 2 },
    latency: { latencyMs: input.latencyMs, stages: [{ endpoint: "chat", stage: "chat", latencyMs: input.latencyMs, backlogAgeMs: 1, outcome: "success", retryExhausted: false }] },
    cost: { usageComplete: false }
  }
}
