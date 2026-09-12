import { createHash } from "node:crypto"

import {
  DEBUG_TRACE_SANITIZE_POLICY_VERSION,
  type ChatToolInvocation,
  type Citation,
  type DebugStep,
  type DebugTrace,
  type DebugTraceVisibility
} from "../../../types.js"

const REDACTED_CONTENT = "[redacted:document-content]"
const REDACTED_VALUE = "[redacted:sensitive-value]"
const MAX_DIAGNOSTIC_TEXT_CHARS = 512

const secretPatterns: readonly RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bASIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|credential)\s*[:=]\s*[^\s,;]+/gi,
  /\bCANARY[_-]?(?:SECRET|TOKEN|PII)[A-Za-z0-9_-]*\b/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
] as const

export function sanitizeDebugTraceForPersistence(trace: DebugTrace): DebugTrace {
  return sanitizeDebugTrace(trace, "operator_sanitized")
}

export function sanitizeDebugTraceForView(trace: DebugTrace, visibility: DebugTraceVisibility = "operator_sanitized"): DebugTrace {
  return sanitizeDebugTrace(trace, visibility)
}

function sanitizeDebugTrace(trace: DebugTrace, visibility: DebugTraceVisibility): DebugTrace {
  const redactedFields = [
    "question",
    "answerPreview",
    "conversationHistory",
    "clarificationContext",
    "conversation",
    "conversationState",
    "decontextualizedQuery",
    "citations[].text",
    "retrieved[].text",
    "finalEvidence[].text",
    "steps[].detail",
    "steps[].summary",
    "steps[].output",
    "toolInvocations[].input",
    "toolInvocations[].output",
    "toolInvocations[].errorMessage"
]

  return {
    schemaVersion: trace.schemaVersion,
    runId: sanitizeDiagnosticText(trace.runId),
    requestTraceId: trace.requestTraceId ? sanitizeDiagnosticText(trace.requestTraceId) : undefined,
    parentTraceIds: trace.parentTraceIds?.map(sanitizeDiagnosticText),
    tenantPartitionId: trace.tenantPartitionId ? sanitizeDiagnosticText(trace.tenantPartitionId) : undefined,
    actorPartitionId: trace.actorPartitionId ? sanitizeDiagnosticText(trace.actorPartitionId) : undefined,
    securityResourceRefs: trace.securityResourceRefs?.map(sanitizeDiagnosticText),
    targetType: trace.targetType,
    visibility,
    sanitizePolicyVersion: DEBUG_TRACE_SANITIZE_POLICY_VERSION,
    exportRedaction: {
      policyVersion: DEBUG_TRACE_SANITIZE_POLICY_VERSION,
      visibility,
      redactedFields,
      notes: [
        "Diagnostic allowlist and content redaction are applied before persistence and again before view/export.",
        "Document bodies, conversation payloads, tool payloads, credentials, secrets, and personal email addresses are not retained."
      ]
    },
    question: diagnosticQuestionHash(trace.question),
    modelId: sanitizeDiagnosticText(trace.modelId),
    embeddingModelId: sanitizeDiagnosticText(trace.embeddingModelId),
    clueModelId: sanitizeDiagnosticText(trace.clueModelId),
    answerPreview: REDACTED_CONTENT,
    pipelineVersions: trace.pipelineVersions ? {
      chatOrchestrationWorkflowVersion: sanitizeDiagnosticText(trace.pipelineVersions.chatOrchestrationWorkflowVersion),
      agentWorkflowVersion: sanitizeDiagnosticText(trace.pipelineVersions.agentWorkflowVersion),
      chunkerVersion: sanitizeDiagnosticText(trace.pipelineVersions.chunkerVersion),
      sourceExtractorVersion: sanitizeDiagnosticText(trace.pipelineVersions.sourceExtractorVersion),
      memoryPromptVersion: sanitizeDiagnosticText(trace.pipelineVersions.memoryPromptVersion),
      promptVersion: sanitizeDiagnosticText(trace.pipelineVersions.promptVersion),
      indexVersion: sanitizeDiagnosticText(trace.pipelineVersions.indexVersion),
      embeddingModelId: sanitizeDiagnosticText(trace.pipelineVersions.embeddingModelId),
      embeddingDimensions: trace.pipelineVersions.embeddingDimensions
    } : undefined,
    replayVersionManifest: trace.replayVersionManifest ? sanitizeReplayVersionManifest(trace.replayVersionManifest) : undefined,
    decision: trace.decision ? sanitizeReplayDecision(trace.decision) : undefined,
    ragProfile: trace.ragProfile ? {
      id: sanitizeDiagnosticText(trace.ragProfile.id),
      version: sanitizeDiagnosticText(trace.ragProfile.version),
      retrievalProfileId: sanitizeDiagnosticText(trace.ragProfile.retrievalProfileId),
      retrievalProfileVersion: sanitizeDiagnosticText(trace.ragProfile.retrievalProfileVersion),
      answerPolicyId: sanitizeDiagnosticText(trace.ragProfile.answerPolicyId),
      answerPolicyVersion: sanitizeDiagnosticText(trace.ragProfile.answerPolicyVersion)
    } : undefined,
    topK: trace.topK,
    memoryTopK: trace.memoryTopK,
    minScore: trace.minScore,
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    totalLatencyMs: trace.totalLatencyMs,
    firstTokenTiming: trace.firstTokenTiming,
    status: trace.status,
    isAnswerable: trace.isAnswerable,
    citations: trace.citations.map(sanitizeCitation),
    retrieved: trace.retrieved.map(sanitizeCitation),
    finalEvidence: trace.finalEvidence?.map(sanitizeCitation),
    toolInvocations: trace.toolInvocations?.map(sanitizeToolInvocation),
    steps: trace.steps.map(sanitizeStep)
  }
}

export function containsSensitiveOutput(value: string): boolean {
  return secretPatterns.some((pattern) => {
    pattern.lastIndex = 0
    const matched = pattern.test(value)
    pattern.lastIndex = 0
    return matched
  })
}

function sanitizeCitation(citation: Citation): Citation {
  return {
    documentId: sanitizeDiagnosticText(citation.documentId),
    documentVersion: citation.documentVersion ? sanitizeDiagnosticText(citation.documentVersion) : undefined,
    fileName: sanitizeDiagnosticText(citation.fileName),
    chunkId: citation.chunkId ? sanitizeDiagnosticText(citation.chunkId) : undefined,
    pageStart: citation.pageStart,
    pageEnd: citation.pageEnd,
    pageOrSheet: citation.pageOrSheet ? sanitizeDiagnosticText(citation.pageOrSheet) : undefined,
    drawingNo: citation.drawingNo ? sanitizeDiagnosticText(citation.drawingNo) : undefined,
    sheetTitle: citation.sheetTitle ? sanitizeDiagnosticText(citation.sheetTitle) : undefined,
    scale: citation.scale ? sanitizeDiagnosticText(citation.scale) : undefined,
    regionId: citation.regionId ? sanitizeDiagnosticText(citation.regionId) : undefined,
    regionType: citation.regionType ? sanitizeDiagnosticText(citation.regionType) : undefined,
    sourceType: citation.sourceType ? sanitizeDiagnosticText(citation.sourceType) : undefined,
    score: citation.score,
    text: REDACTED_CONTENT,
    topic: citation.topic ? sanitizeDiagnosticText(citation.topic) : undefined,
    evidenceRole: citation.evidenceRole,
    authorityStatus: citation.authorityStatus,
    effectiveFrom: citation.effectiveFrom,
    effectiveUntil: citation.effectiveUntil,
    sourceLocator: citation.sourceLocator ? sanitizeSourceLocation(citation.sourceLocator) : undefined,
    authorizationDecision: citation.authorizationDecision,
    authorizationEvaluatedAt: citation.authorizationEvaluatedAt
  }
}

function sanitizeStep(step: DebugStep): DebugStep {
  return {
    id: step.id,
    label: sanitizeDiagnosticText(step.label),
    status: step.status,
    latencyMs: step.latencyMs,
    modelId: step.modelId ? sanitizeDiagnosticText(step.modelId) : undefined,
    summary: `${sanitizeDiagnosticText(step.label)}:${step.status}`,
    hitCount: step.hitCount,
    tokenCount: step.tokenCount,
    startedAt: step.startedAt,
    completedAt: step.completedAt
  }
}

function sanitizeToolInvocation(invocation: ChatToolInvocation): ChatToolInvocation {
  return {
    invocationId: sanitizeDiagnosticText(invocation.invocationId),
    orchestrationRunId: sanitizeDiagnosticText(invocation.orchestrationRunId),
    toolId: sanitizeDiagnosticText(invocation.toolId),
    requesterUserId: pseudonymousId(invocation.requesterUserId),
    status: invocation.status,
    input: { redacted: true },
    inputSummary: { redacted: true },
    outputSummary: invocation.output === undefined && invocation.outputSummary === undefined ? undefined : { redacted: true },
    errorCode: invocation.errorCode ? sanitizeDiagnosticText(invocation.errorCode) : undefined,
    errorMessage: invocation.errorMessage ? REDACTED_VALUE : undefined,
    approvedBy: invocation.approvedBy ? pseudonymousId(invocation.approvedBy) : undefined,
    approvedAt: invocation.approvedAt,
    startedAt: invocation.startedAt,
    completedAt: invocation.completedAt
  }
}

function diagnosticQuestionHash(value: string): string {
  if (/^sha256:[0-9a-f]{64}$/.test(value)) return value
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function sanitizeSourceLocation(location: NonNullable<Citation["sourceLocator"]>): NonNullable<Citation["sourceLocator"]> {
  return {
    page: location.page,
    pageStart: location.pageStart,
    pageEnd: location.pageEnd,
    unit: location.unit,
    source: location.source ? sanitizeDiagnosticText(location.source) : undefined,
    sectionPath: location.sectionPath?.map(sanitizeDiagnosticText),
    startChar: location.startChar,
    endChar: location.endChar,
    sourceBlockId: location.sourceBlockId ? sanitizeDiagnosticText(location.sourceBlockId) : undefined,
    sourceChunkIds: location.sourceChunkIds?.map(sanitizeDiagnosticText)
  }
}

function sanitizeReplayVersionManifest(manifest: NonNullable<DebugTrace["replayVersionManifest"]>): NonNullable<DebugTrace["replayVersionManifest"]> {
  const safe = (value: string | null): string | null => value === null ? null : sanitizeDiagnosticText(value)
  return {
    schemaVersion: manifest.schemaVersion,
    sourceSnapshots: manifest.sourceSnapshots.map((snapshot) => ({
      documentId: sanitizeDiagnosticText(snapshot.documentId),
      documentVersion: safe(snapshot.documentVersion),
      ingestTraceId: safe(snapshot.ingestTraceId),
      parserVersion: safe(snapshot.parserVersion),
      ocrVersion: safe(snapshot.ocrVersion),
      chunkerVersion: safe(snapshot.chunkerVersion),
      chunkingPolicyVersion: safe(snapshot.chunkingPolicyVersion),
      embeddingModelId: safe(snapshot.embeddingModelId),
      embeddingDimensions: snapshot.embeddingDimensions,
      indexVersion: safe(snapshot.indexVersion),
      promptVersion: safe(snapshot.promptVersion),
      pipelineVersion: safe(snapshot.pipelineVersion)
    })),
    parserVersion: safe(manifest.parserVersion),
    ocrVersion: safe(manifest.ocrVersion),
    chunkerVersion: safe(manifest.chunkerVersion),
    chunkingPolicyVersion: safe(manifest.chunkingPolicyVersion),
    embedding: { modelId: safe(manifest.embedding.modelId), dimensions: manifest.embedding.dimensions },
    policyVersions: {
      ragProfile: safe(manifest.policyVersions.ragProfile),
      retrieval: safe(manifest.policyVersions.retrieval),
      answer: safe(manifest.policyVersions.answer),
      authorization: safe(manifest.policyVersions.authorization),
      eligibility: safe(manifest.policyVersions.eligibility),
      untrustedContent: safe(manifest.policyVersions.untrustedContent),
      traceSanitization: safe(manifest.policyVersions.traceSanitization)
    },
    indexVersion: safe(manifest.indexVersion),
    modelVersions: { answer: safe(manifest.modelVersions.answer), clue: safe(manifest.modelVersions.clue) },
    promptVersion: safe(manifest.promptVersion),
    pipelineVersion: safe(manifest.pipelineVersion),
    datasetVersion: safe(manifest.datasetVersion),
    queryTransformation: {
      originalQuestionHash: sanitizeDiagnosticText(manifest.queryTransformation.originalQuestionHash),
      normalizedQueryHash: safe(manifest.queryTransformation.normalizedQueryHash),
      expandedQuerySetHash: safe(manifest.queryTransformation.expandedQuerySetHash)
    },
    decisions: sanitizeReplayDecision(manifest.decisions),
    nondeterministicFactors: manifest.nondeterministicFactors.map(sanitizeDiagnosticText),
    missingVersions: manifest.missingVersions.map(sanitizeDiagnosticText)
  }
}

function sanitizeReplayDecision(decision: NonNullable<DebugTrace["decision"]>): NonNullable<DebugTrace["decision"]> {
  const fallbackDecisionCode = decision.responseStatus === "success" ? "completed" : decision.responseStatus === "warning" ? "refused" : "failed"
  const decisionCode = canonicalDecisionCode(decision.decisionCode) ?? fallbackDecisionCode
  return {
    candidateCount: Math.max(0, decision.candidateCount),
    deniedCandidateCount: Math.min(Math.max(0, decision.candidateCount), Math.max(0, decision.deniedCandidateCount ?? 0)),
    finalEvidenceCount: Math.max(0, decision.finalEvidenceCount),
    responseStatus: decision.responseStatus,
    decisionCode,
    reasonCodes: canonicalReasonCodes(decision.reasonCodes),
    totalLatencyMs: Math.max(0, decision.totalLatencyMs)
  }
}

function canonicalDecisionCode(value: unknown): NonNullable<DebugTrace["decision"]>["decisionCode"] | undefined {
  return value === "completed" || value === "refused" || value === "rejected" || value === "failed" || value === "cancelled"
    ? value
    : undefined
}

function canonicalReasonCodes(value: unknown): NonNullable<DebugTrace["decision"]>["reasonCodes"] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<NonNullable<DebugTrace["decision"]>["reasonCodes"][number]>([
    "authorization_denied",
    "safety_interlock",
    "dependency_error",
    "admission_rejected",
    "publication_not_eligible",
    "permission_revoked",
    "execution_error",
    "insufficient_evidence",
    "clarification_required",
    "output_secret_detected",
    "cancelled"
  ])
  return [...new Set(value.filter((item): item is NonNullable<DebugTrace["decision"]>["reasonCodes"][number] => allowed.has(item)))].sort()
}

function sanitizeDiagnosticText(value: string): string {
  let sanitized = value
  for (const pattern of secretPatterns) sanitized = sanitized.replace(pattern, REDACTED_VALUE)
  const normalized = [...sanitized].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    const allowedWhitespace = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d
    return (!allowedWhitespace && codePoint <= 0x1f) || codePoint === 0x7f ? " " : character
  }).join("").trim()
  return normalized.length <= MAX_DIAGNOSTIC_TEXT_CHARS
    ? normalized
    : `${normalized.slice(0, MAX_DIAGNOSTIC_TEXT_CHARS)}…[truncated]`
}

function pseudonymousId(value: string): string {
  if (/^actor:[0-9a-f]{16}$/.test(value)) return value
  return `actor:${createHash("sha256").update(value).digest("hex").slice(0, 16)}`
}
