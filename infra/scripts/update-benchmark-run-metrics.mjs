#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb"

if (isMainModule()) {
  await main()
}

export async function main() {
  required(process.env.RUN_ID, "RUN_ID")
  const storageRunId = required(process.env.STORAGE_RUN_ID, "STORAGE_RUN_ID")
  const tableName = required(process.env.BENCHMARK_RUNS_TABLE_NAME, "BENCHMARK_RUNS_TABLE_NAME")
  const summaryPath = required(process.env.SUMMARY, "SUMMARY")
  const summary = JSON.parse(readFileSync(summaryPath, "utf-8"))
  const metrics = buildBenchmarkRunMetrics(summary, {
    workloadEvidence: readOptionalJson(process.env.RAG_WORKLOAD_EVIDENCE_PATH),
    priceCatalog: readOptionalJson(process.env.RAG_PRICE_CATALOG_PATH),
    releaseAudit: readOptionalJson(process.env.RELEASE_AUDIT)
  })
  const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION })

  await client.send(new UpdateItemCommand(buildUpdateBenchmarkRunMetricsCommandInput({
    TableName: tableName,
    storageRunId,
    metrics,
    updatedAt: new Date().toISOString()
  })))
}

export function buildUpdateBenchmarkRunMetricsCommandInput({ TableName, storageRunId, metrics, updatedAt }) {
  return {
    TableName,
    Key: { runId: { S: storageRunId } },
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
      ":metrics": dynamoMetricsAttributeValue(metrics),
      ":updatedAt": { S: updatedAt }
    }
  }
}

export function buildBenchmarkRunMetrics(summary, evidence = {}) {
  const metrics = summary?.metrics ?? {}
  const caseResults = Array.isArray(summary?.caseResults) ? summary.caseResults : []
  const total = finiteNumber(summary?.total) ?? finiteNumber(summary?.totalTurns) ?? caseResults.length
  const failedHttp = finiteNumber(summary?.failedHttp) ?? 0
  const derived = isVersionedBenchmarkArtifact(summary)
    ? deriveCaseMetrics(summary, caseResults)
    : {}
  const workload = deriveWorkloadMetrics(summary, evidence.workloadEvidence)
  const cost = deriveUnitCostMetrics(summary, caseResults, evidence.priceCatalog)
  const release = deriveReleaseAuditMetrics(evidence.releaseAudit)
  return compactObject({
    total,
    succeeded: finiteNumber(summary?.succeeded) ?? finiteNumber(summary?.succeededTurns) ?? Math.max(0, total - failedHttp),
    failedHttp,
    answerableAccuracy: finiteNumber(metrics.answerableAccuracy),
    turnAnswerCorrectRate: finiteNumber(metrics.turnAnswerCorrectRate),
    conversationSuccessRate: finiteNumber(metrics.conversationSuccessRate),
    historyDependentAccuracy: finiteNumber(metrics.historyDependentAccuracy),
    abstentionRecall: finiteNumber(metrics.abstentionRecall),
    abstentionAccuracy: finiteNumber(metrics.abstentionAccuracy),
    citationHitRate: finiteNumber(metrics.citationHitRate),
    expectedFileHitRate: finiteNumber(metrics.expectedFileHitRate),
    extractionAccuracy: finiteNumber(metrics.extractionAccuracy),
    admissionCorrectness: finiteNumber(metrics.admissionCorrectness),
    retrievalRecallAt20: derived.retrievalRecallAt20 ?? finiteNumber(metrics.retrievalRecallAt20) ?? finiteNumber(metrics.recallAt20),
    retrievalRecallAtK: derived.retrievalRecallAtK ?? finiteNumber(metrics.retrievalRecallAtK),
    falseDenialRate: derived.falseDenialRate,
    faithfulness: derived.faithfulness ?? finiteNumber(metrics.faithfulness) ?? complement(metrics.unsupportedSentenceRate),
    unsupportedClaimRate: derived.unsupportedClaimRate ?? finiteNumber(metrics.unsupportedClaimRate),
    unsupportedSentenceRate: finiteNumber(metrics.unsupportedSentenceRate),
    unsupportedAnswerRate: finiteNumber(metrics.unsupportedAnswerRate),
    citationPrecision: derived.citationPrecision ?? finiteNumber(metrics.citationPrecision),
    citationSupportPassRate: finiteNumber(metrics.citationSupportPassRate),
    citationCompleteness: derived.citationCompleteness,
    citationLocatorValidity: derived.citationLocatorValidity,
    requiredClaimMissCount: derived.requiredClaimMissCount,
    falseAnswerRate: derived.falseAnswerRate,
    falseRefusalRate: derived.falseRefusalRate,
    taskCompletionRate: derived.taskCompletionRate,
    taskOutcomeAccuracy: derived.taskOutcomeAccuracy,
    criticalTaskFailureCount: derived.criticalTaskFailureCount,
    criticalUnsupportedClaimCount: derived.criticalUnsupportedClaimCount,
    noAccessLeakCount: derived.noAccessLeakCount,
    injectionSuccessCount: finiteNumber(metrics.injectionSuccessCount),
    secretExposureCount: finiteNumber(metrics.secretExposureCount),
    eligibilityPropagationP50Ms: workload.eligibilityPropagationP50Ms,
    eligibilityPropagationP95Ms: workload.eligibilityPropagationP95Ms,
    eligibilityPropagationP99Ms: workload.eligibilityPropagationP99Ms,
    eligibilityPropagationMaxMs: workload.eligibilityPropagationMaxMs,
    eligibilityProbeSampleCount: workload.eligibilityProbeSampleCount,
    eligibilityMatrixCoverage: workload.eligibilityMatrixCoverage,
    eligibilityUnreconciledResourceCount: workload.eligibilityUnreconciledResourceCount,
    mttrMs: workload.mttrMs,
    recoveryP95Ms: workload.recoveryP95Ms,
    recoveryWithoutLossRate: workload.recoveryWithoutLossRate,
    recoveryLossCount: workload.recoveryLossCount,
    recoveryScenarioCoverage: workload.recoveryScenarioCoverage,
    recoverySampleCount: workload.recoverySampleCount,
    backlogAgeP99Ms: workload.backlogAgeP99Ms,
    backlogAgeSampleCount: workload.backlogAgeSampleCount,
    timeoutRate: workload.timeoutRate,
    retryExhaustionCount: workload.retryExhaustionCount,
    p50LatencyMs: derived.p50LatencyMs ?? finiteNumber(metrics.p50LatencyMs),
    p95LatencyMs: derived.p95LatencyMs ?? finiteNumber(metrics.p95LatencyMs),
    p99LatencyMs: derived.p99LatencyMs ?? finiteNumber(metrics.p99LatencyMs),
    averageLatencyMs: derived.averageLatencyMs ?? finiteNumber(metrics.averageLatencyMs),
    errorRate: finiteNumber(metrics.errorRate) ?? (total > 0 ? failedHttp / total : undefined),
    workloadProfileVersion: workload.workloadProfileVersion,
    runtimeProfileVersion: workload.runtimeProfileVersion,
    priceCatalogVersion: cost.priceCatalogVersion,
    datasetVersion: versionString(summary?.suite?.datasetSource?.datasetVersion),
    indexVersion: versionString(summary?.candidateConfig?.indexVersion),
    promptVersion: versionString(summary?.candidateConfig?.promptVersion),
    pipelineVersion: versionString(summary?.candidateConfig?.pipelineVersion),
    parserVersion: versionString(summary?.candidateConfig?.parserVersion),
    chunkerVersion: versionString(summary?.candidateConfig?.chunkerVersion),
    corpusProfileVersion: workload.corpusProfileVersion,
    aclDistributionVersion: workload.aclDistributionVersion,
    workloadConcurrency: workload.workloadConcurrency,
    documentSizeProfileVersion: workload.documentSizeProfileVersion,
    dependencyLatencyProfileVersion: workload.dependencyLatencyProfileVersion,
    qualitySliceMeasurements: mergeSliceMeasurements(derived.qualitySliceMeasurements, workload.qualitySliceMeasurements),
    eligibilityMatrixReport: workload.eligibilityMatrixReport,
    modelCostPerUnit: cost.modelCostPerUnit,
    embeddingCostPerUnit: cost.embeddingCostPerUnit,
    storageCostPerUnit: cost.storageCostPerUnit,
    workerCostPerUnit: cost.workerCostPerUnit,
    egressCostPerUnit: cost.egressCostPerUnit,
    totalCostPerUnit: cost.totalCostPerUnit,
    costEvidenceSampleCount: cost.costEvidenceSampleCount,
    chatCostEvidenceSampleCount: cost.chatCostEvidenceSampleCount,
    searchCostEvidenceSampleCount: cost.searchCostEvidenceSampleCount,
    ingestCostEvidenceSampleCount: cost.ingestCostEvidenceSampleCount,
    unitCostKind: cost.unitCostKind,
    chatCostPerRequest: cost.chatCostPerRequest,
    searchCostPerRequest: cost.searchCostPerRequest,
    ingestCostPerDocument: cost.ingestCostPerDocument,
    releaseAuditVersion: release.releaseAuditVersion,
    releaseAuditId: release.releaseAuditId,
    datasetSpecificBranchCount: release.datasetSpecificBranchCount,
    artifactManifestMismatchCount: release.artifactManifestMismatchCount
  })
}

export function dynamoMetricsAttributeValue(metrics) {
  return {
    M: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, dynamoValue(value)])
    )
  }
}

function dynamoValue(value) {
  if (typeof value === "number") return { N: String(value) }
  if (typeof value === "string") return { S: value }
  if (typeof value === "boolean") return { BOOL: value }
  if (Array.isArray(value)) return { L: value.map(dynamoValue) }
  if (value && typeof value === "object") {
    return { M: Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, dynamoValue(nested)])) }
  }
  return { NULL: true }
}

function compactObject(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => (
      typeof value === "number" && Number.isFinite(value)
    ) || (
      typeof value === "string" && value.trim().length > 0
    ) || (
      typeof value === "boolean"
    ) || (
      Array.isArray(value) && value.length > 0
    ) || (
      value && typeof value === "object" && Object.keys(value).length > 0
    ))
  )
}

function deriveCaseMetrics(summary, caseResults) {
  const recallAtK = caseResults.map((item) => finiteNumber(item?.retrieval?.recallAtK)).filter(isNumber)
  const recallAt20 = caseResults.map((item) => finiteNumber(item?.retrieval?.recallAt20)).filter(isNumber)
  const citationCoverage = caseResults.map((item) => item?.citation?.expectedFileHit).filter(isBoolean)
  const citationSupport = caseResults.map((item) => item?.citation?.citationSupportPass).filter(isBoolean)
  const answerable = caseResults.filter((item) => item?.answerability?.expectedAnswerable === true)
  const unanswerable = caseResults.filter((item) => item?.answerability?.expectedAnswerable === false)
  const tasks = isTaskRunner(summary)
    ? caseResults.filter((item) => item?.task?.expectedOutcome !== undefined)
    : []
  const generation = caseResults
    .map((item) => item?.generation)
    .filter((item) => Number.isInteger(item?.evaluatedClaimCount) && item.evaluatedClaimCount > 0 && Number.isInteger(item?.unsupportedClaimCount) && item.unsupportedClaimCount >= 0 && item.unsupportedClaimCount <= item.evaluatedClaimCount)
  const evaluatedClaimCount = generation.reduce((sum, item) => sum + item.evaluatedClaimCount, 0)
  const unsupportedClaimCount = generation.reduce((sum, item) => sum + item.unsupportedClaimCount, 0)
  const latencies = caseResults.map((item) => finiteNumber(item?.latency?.latencyMs)).filter(isNumber)
  const leakCounts = caseResults.map((item) => finiteNumber(item?.retrieval?.noAccessLeakCount)).filter(isNumber)
  const meanRecallAtK = average(recallAtK)
  const structured = deriveStructuredCaseQuality(caseResults, summary)
  return compactObject({
    retrievalRecallAtK: meanRecallAtK,
    retrievalRecallAt20: average(recallAt20),
    falseDenialRate: meanRecallAtK === undefined ? undefined : rounded(Math.max(0, 1 - meanRecallAtK)),
    citationPrecision: structured.citationPrecision ?? booleanRate(citationSupport),
    citationCompleteness: structured.citationCompleteness ?? booleanRate(citationCoverage),
    citationLocatorValidity: structured.citationLocatorValidity,
    requiredClaimMissCount: structured.requiredClaimMissCount,
    faithfulness: structured.faithfulness ?? (evaluatedClaimCount === 0 ? undefined : rounded(1 - unsupportedClaimCount / evaluatedClaimCount)),
    unsupportedClaimRate: structured.unsupportedClaimRate ?? (evaluatedClaimCount === 0 ? undefined : rounded(unsupportedClaimCount / evaluatedClaimCount)),
    criticalUnsupportedClaimCount: structured.criticalUnsupportedClaimCount,
    falseAnswerRate: unanswerable.length === 0
      ? undefined
      : rounded(unanswerable.filter((item) => item?.answerability?.actualResponseType === "answer").length / unanswerable.length),
    falseRefusalRate: answerable.length === 0
      ? undefined
      : rounded(answerable.filter((item) => item?.answerability?.actualResponseType === "refusal").length / answerable.length),
    taskCompletionRate: structured.taskCompletionRate ?? (tasks.length === 0
      ? undefined
      : rounded(tasks.filter((item) => item?.task?.actualOutcome === "complete").length / tasks.length)),
    taskOutcomeAccuracy: structured.taskOutcomeAccuracy ?? (tasks.length === 0
      ? undefined
      : rounded(tasks.filter((item) => item?.task?.actualOutcome === item?.task?.expectedOutcome).length / tasks.length)),
    criticalTaskFailureCount: structured.criticalTaskFailureCount,
    noAccessLeakCount: leakCounts.length === 0 ? undefined : leakCounts.reduce((sum, value) => sum + value, 0),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    p99LatencyMs: percentile(latencies, 0.99),
    averageLatencyMs: average(latencies),
    qualitySliceMeasurements: structured.qualitySliceMeasurements
  })
}

function deriveStructuredCaseQuality(caseResults, summary, includeSlices = true) {
  if (!isVersionedBenchmarkArtifact(summary) || caseResults.length === 0) return {}
  const claimsComplete = caseResults.every((item) => Array.isArray(item?.claims) && Array.isArray(item?.citations))
  const taskComplete = isTaskRunner(summary) && caseResults.every((item) => (
    item?.task?.scenario && item.task.expectedOutcome && item.task.actualOutcome
  ))
  const claims = claimsComplete ? caseResults.flatMap((item) => item.claims) : []
  const citations = claimsComplete ? caseResults.flatMap((item) => item.citations) : []
  const supportedClaims = claims.filter(claimSupported)
  const unsupportedClaims = claims.filter((claim) => !claimSupported(claim))
  const requiredClaims = claims.filter((claim) => claim.requiresCitation)
  const citationById = new Map(citations.map((citation) => [citation.citationId, citation]))
  const coveredRequiredClaims = requiredClaims.filter((claim) => claimSupported(claim) && claim.citationIds.some((citationId) => {
    const citation = citationById.get(citationId)
    return citation?.claimIds.includes(claim.claimId) && citation.relevant && citation.supportValid && citation.locatorValid
  }))
  const validCitations = citations.filter((citation) => citation.relevant && citation.supportValid)
  const locatorValidCitations = citations.filter((citation) => citation.locatorValid)
  const tasks = taskComplete ? caseResults.map((item) => item.task) : []
  const appropriateTasks = tasks.filter(appropriateTaskOutcome)
  const criticalTaskFailures = tasks.filter((task) => (
    (task.scenario.severity === "critical" || task.scenario.severity === "high") && !appropriateTaskOutcome(task)
  ))
  const base = compactObject({
    faithfulness: claimsComplete && claims.length > 0 ? rounded(supportedClaims.length / claims.length) : undefined,
    unsupportedClaimRate: claimsComplete && claims.length > 0 ? rounded(unsupportedClaims.length / claims.length) : undefined,
    criticalUnsupportedClaimCount: claimsComplete
      ? unsupportedClaims.filter((claim) => claim.severity === "critical" || claim.severity === "high").length
      : undefined,
    citationPrecision: claimsComplete && citations.length > 0 ? rounded(validCitations.length / citations.length) : undefined,
    citationCompleteness: claimsComplete && requiredClaims.length > 0 ? rounded(coveredRequiredClaims.length / requiredClaims.length) : undefined,
    citationLocatorValidity: claimsComplete && citations.length > 0 ? rounded(locatorValidCitations.length / citations.length) : undefined,
    requiredClaimMissCount: claimsComplete ? requiredClaims.length - coveredRequiredClaims.length : undefined,
    taskCompletionRate: taskComplete && tasks.length > 0 ? rounded(appropriateTasks.length / tasks.length) : undefined,
    taskOutcomeAccuracy: taskComplete && tasks.length > 0 ? rounded(tasks.filter((task) => task.actualOutcome === task.expectedOutcome).length / tasks.length) : undefined,
    criticalTaskFailureCount: taskComplete ? criticalTaskFailures.length : undefined
  })
  if (!includeSlices || !caseResults.every(hasCompleteSlice)) return base
  const groups = new Map()
  for (const item of caseResults) {
    for (const slice of caseSliceNames(item.slice)) {
      const grouped = groups.get(slice) ?? []
      grouped.push(item)
      groups.set(slice, grouped)
    }
  }
  return {
    ...base,
    qualitySliceMeasurements: [...groups.entries()].map(([slice, items]) => ({
      slice,
      sampleCount: items.length,
      measurements: structuredMetricsToSignals(deriveStructuredCaseQuality(items, summary, false), items.length)
    })).sort((left, right) => left.slice.localeCompare(right.slice))
  }
}

function claimSupported(claim) {
  return claim?.supported === true && Array.isArray(claim.supportSpans) && claim.supportSpans.length > 0 && claim.supportSpans.every((span) => span.locatorValid === true)
}

function appropriateTaskOutcome(task) {
  if (!task?.scenario || !task.expectedOutcome || !task.actualOutcome) return false
  if (task.actualOutcome === task.expectedOutcome) return true
  return task.scenario.allowedHandoffs.includes(task.actualOutcome)
}

function hasCompleteSlice(item) {
  const slice = item?.slice
  return Boolean(slice?.questionType && slice.tenantRole && slice.ocrMode && slice.language && typeof slice.multiEvidence === "boolean" && slice.answerability && slice.severity)
}

function caseSliceNames(slice) {
  return [
    `question_type=${safeSliceValue(slice.questionType)}`,
    `tenant_role=${safeSliceValue(slice.tenantRole)}`,
    `ocr_mode=${safeSliceValue(slice.ocrMode)}`,
    `language=${safeSliceValue(slice.language)}`,
    `multi_evidence=${slice.multiEvidence}`,
    `answerability=${safeSliceValue(slice.answerability)}`,
    `severity=${safeSliceValue(slice.severity)}`
  ]
}

function structuredMetricsToSignals(metrics, sampleCount) {
  return compactObject({
    "evaluation.slice_case_count": sampleCount,
    "generation.faithfulness": metrics.faithfulness,
    "generation.unsupported_claim_rate": metrics.unsupportedClaimRate,
    "generation.critical_unsupported_claim_count": metrics.criticalUnsupportedClaimCount,
    "citation.precision": metrics.citationPrecision,
    "citation.completeness": metrics.citationCompleteness,
    "citation.locator_validity": metrics.citationLocatorValidity,
    "citation.required_claim_miss_count": metrics.requiredClaimMissCount,
    "task.completion_rate": metrics.taskCompletionRate,
    "task.outcome_accuracy": metrics.taskOutcomeAccuracy,
    "task.critical_failure_count": metrics.criticalTaskFailureCount
  })
}

function deriveWorkloadMetrics(summary, evidence) {
  if (!approvedVersionedWorkloadEvidence(summary, evidence)) return {}
  const propagation = evidence.eligibilityProbes
    .map((probe) => durationMs(probe?.committedAt, probe?.deniedAt))
    .filter(isNumber)
  const recovery = evidence.recoveryScenarios
    .map((scenario) => ({
      duration: durationMs(scenario?.failedAt, scenario?.recoveredAt),
      withoutLoss: scenario?.reconciledWithoutLoss === true && scenario?.duplicateOrLostArtifactCount === 0,
      dependency: scenario?.dependency,
      retryExhausted: scenario?.retryExhausted === true,
      duplicateOrLostArtifactCount: scenario?.duplicateOrLostArtifactCount ?? 0
    }))
    .filter((item) => item.duration !== undefined)
  const recoveryDurations = recovery.map((item) => item.duration)
  const backlogAges = evidence.endpointStageSamples
    .map((item) => durationMs(item?.createdAt, item?.startedAt))
    .filter(isNumber)
  const endpointOutcomes = evidence.endpointStageSamples
  const unreconciledResourceIds = [...new Set(evidence.eligibilityProbes.flatMap((probe) => probe.unreflectedResourceIds))].sort()
  const qualitySliceMeasurements = [
    ...deriveEndpointStageSliceMeasurements(endpointOutcomes),
    ...deriveRecoverySliceMeasurements(recovery)
  ]
  return compactObject({
    workloadProfileVersion: evidence.version,
    runtimeProfileVersion: evidence.runtimeProfileVersion,
    corpusProfileVersion: evidence.dimensions.corpusProfileVersion,
    aclDistributionVersion: evidence.dimensions.aclDistributionVersion,
    workloadConcurrency: evidence.dimensions.concurrency,
    documentSizeProfileVersion: evidence.dimensions.documentSizeProfileVersion,
    dependencyLatencyProfileVersion: evidence.dimensions.dependencyLatencyProfileVersion,
    eligibilityPropagationP50Ms: percentile(propagation, 0.5),
    eligibilityPropagationP95Ms: percentile(propagation, 0.95),
    eligibilityPropagationP99Ms: percentile(propagation, 0.99),
    eligibilityPropagationMaxMs: propagation.length === 0 ? undefined : Math.max(...propagation),
    eligibilityProbeSampleCount: propagation.length,
    eligibilityMatrixCoverage: 1,
    eligibilityUnreconciledResourceCount: unreconciledResourceIds.length,
    mttrMs: average(recoveryDurations),
    recoveryP95Ms: percentile(recoveryDurations, 0.95),
    recoveryWithoutLossRate: recovery.length === 0
      ? undefined
      : rounded(recovery.filter((item) => item.withoutLoss).length / recovery.length),
    recoveryLossCount: recovery.filter((item) => !item.withoutLoss).length,
    recoveryScenarioCoverage: 1,
    recoverySampleCount: recovery.length,
    backlogAgeP99Ms: percentile(backlogAges, 0.99),
    backlogAgeSampleCount: backlogAges.length,
    timeoutRate: rounded(endpointOutcomes.filter((item) => item.outcome === "timeout").length / endpointOutcomes.length),
    retryExhaustionCount: endpointOutcomes.filter((item) => item.retryExhausted).length + recovery.filter((item) => item.retryExhausted).length,
    qualitySliceMeasurements,
    eligibilityMatrixReport: {
      schemaVersion: 1,
      triggerCount: ELIGIBILITY_TRIGGERS.length,
      pathCount: ELIGIBILITY_PATHS.length,
      probeCount: evidence.eligibilityProbes.length,
      p50Ms: percentile(propagation, 0.5),
      p95Ms: percentile(propagation, 0.95),
      p99Ms: percentile(propagation, 0.99),
      maxMs: propagation.length === 0 ? undefined : Math.max(...propagation),
      unreflectedResourceIds: unreconciledResourceIds,
      probes: evidence.eligibilityProbes.map((probe) => ({
        trigger: probe.trigger,
        path: probe.path,
        propagationMs: durationMs(probe.committedAt, probe.deniedAt),
        unreflectedResourceIds: [...probe.unreflectedResourceIds]
      }))
    }
  })
}

const ELIGIBILITY_TRIGGERS = ["share", "account", "role", "group", "classification", "usage", "quality", "expiry", "archive", "delete"]
const ELIGIBILITY_PATHS = ["active", "staged", "old_index", "cache", "session", "memory", "queued_worker"]
const RECOVERY_DEPENDENCIES = ["vector", "llm", "ocr", "queue"]
const OPERATION_ENDPOINTS = ["chat", "search", "ingest"]

function deriveEndpointStageSliceMeasurements(samples) {
  const grouped = new Map()
  for (const sample of samples) {
    const slice = `endpoint=${sample.endpoint}|stage=${safeSliceValue(sample.stage)}`
    const current = grouped.get(slice) ?? []
    current.push(sample)
    grouped.set(slice, current)
  }
  const result = []
  for (const [slice, items] of grouped.entries()) {
    const latencies = items.map((item) => durationMs(item.startedAt, item.completedAt)).filter(isNumber)
    const backlog = items.map((item) => durationMs(item.createdAt, item.startedAt)).filter(isNumber)
    const endpoint = items[0]?.endpoint
    const stageSlice = `stage=${safeSliceValue(items[0]?.stage)}`
    result.push({
      slice,
      sampleCount: items.length,
      measurements: {
        "reliability.success_rate": rounded(items.filter((item) => item.outcome === "success").length / items.length),
        "reliability.timeout_rate": rounded(items.filter((item) => item.outcome === "timeout").length / items.length),
        "reliability.error_rate": rounded(items.filter((item) => item.outcome === "error").length / items.length),
        "reliability.backlog_age_p99_ms": percentile(backlog, 0.99),
        "reliability.retry_exhaustion_count": items.filter((item) => item.retryExhausted).length
      }
    })
    result.push({
      slice: stageSlice,
      sampleCount: items.length,
      measurements: compactObject({
        [`performance.${endpoint}_p50_ms`]: percentile(latencies, 0.5),
        [`performance.${endpoint}_p95_ms`]: percentile(latencies, 0.95),
        [`performance.${endpoint}_p99_ms`]: percentile(latencies, 0.99)
      })
    })
  }
  return result
}

function deriveRecoverySliceMeasurements(recovery) {
  return RECOVERY_DEPENDENCIES.map((dependency) => {
    const items = recovery.filter((item) => item.dependency === dependency)
    const durations = items.map((item) => item.duration).filter(isNumber)
    return {
      slice: `dependency=${dependency}`,
      sampleCount: items.length,
      measurements: compactObject({
        "reliability.mttr_ms": average(durations),
        "reliability.recovery_without_loss_rate": items.length > 0 ? rounded(items.filter((item) => item.withoutLoss).length / items.length) : undefined,
        "reliability.recovery_loss_count": items.filter((item) => !item.withoutLoss).length,
        "reliability.recovery_scenario_coverage": items.length > 0 ? 1 : undefined
      })
    }
  })
}

function deriveUnitCostMetrics(summary, caseResults, catalog) {
  if (!approvedPriceCatalog(summary, catalog)) return {}
  const modelId = versionString(summary?.candidateConfig?.modelId)
  const embeddingModelId = versionString(summary?.candidateConfig?.embeddingModelId)
  const cases = caseResults.filter((item) => item?.cost?.usageComplete === true)
  const costs = []
  for (const item of cases) {
    const usage = item.cost
    const unitKind = usage.unitKind ?? costUnitKind(summary)
    if (!unitKind) continue
    const inputTokens = finiteNumber(usage.inputTokens) ?? 0
    const outputTokens = finiteNumber(usage.outputTokens) ?? 0
    const embeddingInputTokens = finiteNumber(usage.embeddingInputTokens) ?? 0
    const modelRate = modelId ? catalog.modelRates?.[modelId] : undefined
    const embeddingRate = embeddingModelId ? catalog.embeddingRates?.[embeddingModelId] : undefined
    if ((inputTokens > 0 || outputTokens > 0) && !validModelRate(modelRate)) continue
    if (embeddingInputTokens > 0 && !validEmbeddingRate(embeddingRate)) continue
    const model = ((inputTokens * (modelRate?.inputUsdPerMillionTokens ?? 0)) + (outputTokens * (modelRate?.outputUsdPerMillionTokens ?? 0))) / 1_000_000
    const embedding = (embeddingInputTokens * (embeddingRate?.usdPerMillionTokens ?? 0)) / 1_000_000
    const storage = ((finiteNumber(usage.storageByteHours) ?? 0) / 1_000_000_000) * catalog.storageUsdPerGbHour
    const worker = ((finiteNumber(usage.workerMilliseconds) ?? 0) / 1_000) * catalog.workerUsdPerSecond
    const egress = ((finiteNumber(usage.egressBytes) ?? 0) / 1_000_000_000) * catalog.egressUsdPerGb
    costs.push({ unitKind, model, embedding, storage, worker, egress, total: model + embedding + storage + worker + egress })
  }
  if (costs.length === 0) return {}
  const unitKinds = [...new Set(costs.map((item) => item.unitKind))]
  const unitCostKind = unitKinds.length === 1 ? unitKinds[0] : undefined
  const sameUnitCosts = unitCostKind ? costs : []
  const chatCosts = costs.filter((item) => item.unitKind === "chat_request")
  const searchCosts = costs.filter((item) => item.unitKind === "search_request")
  const ingestCosts = costs.filter((item) => item.unitKind === "ingest_document")
  const totalCostPerUnit = average(sameUnitCosts.map((item) => item.total))
  return compactObject({
    priceCatalogVersion: catalog.version,
    modelCostPerUnit: average(sameUnitCosts.map((item) => item.model)),
    embeddingCostPerUnit: average(sameUnitCosts.map((item) => item.embedding)),
    storageCostPerUnit: average(sameUnitCosts.map((item) => item.storage)),
    workerCostPerUnit: average(sameUnitCosts.map((item) => item.worker)),
    egressCostPerUnit: average(sameUnitCosts.map((item) => item.egress)),
    totalCostPerUnit,
    costEvidenceSampleCount: costs.length,
    chatCostEvidenceSampleCount: chatCosts.length,
    searchCostEvidenceSampleCount: searchCosts.length,
    ingestCostEvidenceSampleCount: ingestCosts.length,
    unitCostKind,
    chatCostPerRequest: average(chatCosts.map((item) => item.total)),
    searchCostPerRequest: average(searchCosts.map((item) => item.total)),
    ingestCostPerDocument: average(ingestCosts.map((item) => item.total))
  })
}

function deriveReleaseAuditMetrics(audit) {
  if (
    audit?.schemaVersion !== 1
    || audit?.auditVersion !== "rag-release-audit-v1"
    || !versionString(audit.auditId)
  ) return {}
  const datasetSpecificBranchCount = nonnegativeInteger(audit?.metrics?.datasetSpecificBranchCount)
  const artifactManifestMismatchCount = nonnegativeInteger(audit?.metrics?.artifactManifestMismatchCount)
  if (datasetSpecificBranchCount === undefined || artifactManifestMismatchCount === undefined) return {}
  return {
    releaseAuditVersion: audit.auditVersion,
    releaseAuditId: audit.auditId,
    datasetSpecificBranchCount,
    artifactManifestMismatchCount
  }
}

function isVersionedBenchmarkArtifact(summary) {
  return summary?.artifactContractVersion === 1
    && Boolean(versionString(summary?.suite?.suiteId))
    && Boolean(versionString(summary?.suite?.datasetSource?.datasetVersion))
    && Boolean(versionString(summary?.suite?.evaluatorProfile))
    && summary?.candidateConfig?.benchmarkSuiteId === summary?.suite?.suiteId
    && summary?.candidateConfig?.runner === summary?.suite?.runner
    && Array.isArray(summary?.caseResults)
}

function approvedVersionedWorkloadEvidence(summary, evidence) {
  const probeKeys = Array.isArray(evidence?.eligibilityProbes)
    ? evidence.eligibilityProbes.map((probe) => `${probe?.trigger}:${probe?.path}`)
    : []
  const expectedProbeKeys = ELIGIBILITY_TRIGGERS.flatMap((trigger) => ELIGIBILITY_PATHS.map((path) => `${trigger}:${path}`))
  const recoveryDependencies = new Set(Array.isArray(evidence?.recoveryScenarios) ? evidence.recoveryScenarios.map((item) => item?.dependency) : [])
  const endpointStages = new Set(Array.isArray(evidence?.endpointStageSamples) ? evidence.endpointStageSamples.map((item) => `${item?.endpoint}:${item?.stage}`) : [])
  return evidence?.schemaVersion === 1
    && Boolean(versionString(evidence.profileId))
    && Boolean(versionString(evidence.version))
    && Boolean(versionString(evidence.approvedBy))
    && validTimestamp(evidence.approvedAt)
    && Boolean(versionString(evidence.runtimeProfileVersion))
    && evidence.datasetVersion === summary?.suite?.datasetSource?.datasetVersion
    && evidence.version === summary?.candidateConfig?.workloadProfileVersion
    && evidence.runtimeProfileVersion === summary?.candidateConfig?.runtimeProfileVersion
    && evidence.dimensions?.corpusProfileVersion === summary?.candidateConfig?.corpusProfileVersion
    && evidence.dimensions?.aclDistributionVersion === summary?.candidateConfig?.aclDistributionVersion
    && evidence.dimensions?.concurrency === summary?.candidateConfig?.workloadConcurrency
    && evidence.dimensions?.documentSizeProfileVersion === summary?.candidateConfig?.documentSizeProfileVersion
    && evidence.dimensions?.dependencyLatencyProfileVersion === summary?.candidateConfig?.dependencyLatencyProfileVersion
    && Array.isArray(evidence.eligibilityProbes)
    && Array.isArray(evidence.recoveryScenarios)
    && Array.isArray(evidence.endpointStageSamples)
    && probeKeys.length === expectedProbeKeys.length
    && new Set(probeKeys).size === expectedProbeKeys.length
    && expectedProbeKeys.every((key) => probeKeys.includes(key))
    && evidence.eligibilityProbes.every((probe) => durationMs(probe?.committedAt, probe?.deniedAt) !== undefined && Array.isArray(probe?.unreflectedResourceIds))
    && RECOVERY_DEPENDENCIES.every((dependency) => recoveryDependencies.has(dependency))
    && evidence.recoveryScenarios.every((scenario) => durationMs(scenario?.failedAt, scenario?.recoveredAt) !== undefined && typeof scenario?.retryExhausted === "boolean" && typeof scenario?.reconciledWithoutLoss === "boolean" && Number.isInteger(scenario?.duplicateOrLostArtifactCount) && scenario.duplicateOrLostArtifactCount >= 0)
    && OPERATION_ENDPOINTS.every((endpoint) => endpointStages.has(`${endpoint}:${endpoint}`))
    && evidence.endpointStageSamples.every((item) => durationMs(item?.createdAt, item?.startedAt) !== undefined && durationMs(item?.startedAt, item?.completedAt) !== undefined && ["success", "timeout", "error"].includes(item?.outcome) && typeof item?.retryExhausted === "boolean")
}

function approvedPriceCatalog(summary, catalog) {
  return catalog?.schemaVersion === 1
    && Boolean(versionString(catalog.catalogId))
    && Boolean(versionString(catalog.version))
    && Boolean(versionString(catalog.approvedBy))
    && validTimestamp(catalog.approvedAt)
    && catalog.currency === "USD"
    && Boolean(versionString(catalog.region))
    && catalog.version === summary?.candidateConfig?.priceCatalogVersion
    && catalog.modelRates && typeof catalog.modelRates === "object"
    && catalog.embeddingRates && typeof catalog.embeddingRates === "object"
    && Object.values(catalog.modelRates).every(validModelRate)
    && Object.values(catalog.embeddingRates).every(validEmbeddingRate)
    && [catalog.storageUsdPerGbHour, catalog.workerUsdPerSecond, catalog.egressUsdPerGb].every(isNonnegativeNumber)
}

function costUnitKind(summary) {
  if (summary?.suite?.runner === "search" || summary?.mode === "search") return "search_request"
  if (summary?.suite?.runner === "ingest" || summary?.mode === "ingest") return "ingest_document"
  if (["agent", "conversation", "async_agent"].includes(summary?.suite?.runner) || summary?.mode === "agent") return "chat_request"
  return undefined
}

function isTaskRunner(summary) {
  return ["agent", "conversation", "async_agent"].includes(summary?.suite?.runner)
}

function mergeSliceMeasurements(...collections) {
  const merged = new Map()
  for (const item of collections.flat().filter(Boolean)) {
    const current = merged.get(item.slice)
    merged.set(item.slice, current
      ? {
          slice: item.slice,
          sampleCount: Math.max(current.sampleCount, item.sampleCount),
          measurements: { ...current.measurements, ...item.measurements }
        }
      : item)
  }
  return [...merged.values()].sort((left, right) => left.slice.localeCompare(right.slice))
}

function safeSliceValue(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown"
}

function percentile(values, quantile) {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)]
}

function average(values) {
  if (values.length === 0) return undefined
  return rounded(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function booleanRate(values) {
  if (values.length === 0) return undefined
  return rounded(values.filter(Boolean).length / values.length)
}

function durationMs(start, end) {
  if (!validTimestamp(start) || !validTimestamp(end)) return undefined
  const duration = Date.parse(end) - Date.parse(start)
  return duration >= 0 ? duration : undefined
}

function rounded(value) {
  return Number(value.toFixed(12))
}

function validModelRate(value) {
  return isNonnegativeNumber(value?.inputUsdPerMillionTokens) && isNonnegativeNumber(value?.outputUsdPerMillionTokens)
}

function validEmbeddingRate(value) {
  return isNonnegativeNumber(value?.usdPerMillionTokens)
}

function validTimestamp(value) {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value))
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : undefined
}

function isNonnegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isNumber(value) {
  return typeof value === "number"
}

function isBoolean(value) {
  return typeof value === "boolean"
}

function versionString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function complement(value) {
  const numeric = finiteNumber(value)
  return numeric === undefined ? undefined : 1 - numeric
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`)
  return value
}

function readOptionalJson(filePath) {
  if (!filePath) return undefined
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"))
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined
    throw error
  }
}

function isMainModule() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false
}
