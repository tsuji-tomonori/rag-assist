import { createHash } from "node:crypto"
import type { Citation, DebugTrace, PipelineVersions, ReplayDecisionCode, ReplayDecisionReasonCode, ReplaySourceSnapshot, ReplayVersionManifest } from "../../../types.js"

export type ReplayVersionManifestInput = {
  citations: Citation[]
  sourceSnapshots?: ReplaySourceSnapshot[]
  pipelineVersions?: Partial<PipelineVersions>
  observedVersions?: Readonly<{
    parserVersion?: string
    ocrVersion?: string
    chunkerVersion?: string
    chunkingPolicyVersion?: string
    embeddingModelId?: string
    embeddingDimensions?: number
    indexVersion?: string
    promptVersion?: string
    pipelineVersion?: string
  }>
  ragProfile?: DebugTrace["ragProfile"]
  modelId?: string
  clueModelId?: string
  policyVersions: {
    authorization?: string
    eligibility?: string
    untrustedContent?: string
    traceSanitization?: string
  }
  question: string
  normalizedQuery?: string
  expandedQueries?: string[]
  candidateCount: number
  deniedCandidateCount?: number
  finalEvidenceCount: number
  responseStatus: ReplayVersionManifest["decisions"]["responseStatus"]
  decisionCode?: ReplayDecisionCode
  reasonCodes?: ReplayDecisionReasonCode[]
  totalLatencyMs: number
  nondeterministicFactors: string[]
}

/**
 * Creates replay metadata exclusively from values observed for this run. A
 * missing value remains null and is listed in missingVersions; it is never
 * substituted with a current runtime version.
 */
export function buildReplayVersionManifest(input: ReplayVersionManifestInput): ReplayVersionManifest {
  const pipeline = input.pipelineVersions
  const suppliedSources = new Map((input.sourceSnapshots ?? []).map((source) => [source.documentId, source]))
  const sources = [...new Map(input.citations.map((citation) => {
    const supplied = suppliedSources.get(citation.documentId)
    return [citation.documentId, normalizeSourceSnapshot({
      ...emptySourceSnapshot(citation.documentId, citation.documentVersion ?? null),
      ...supplied,
      documentId: citation.documentId,
      documentVersion: citation.documentVersion ?? supplied?.documentVersion ?? null
    })]
  })).values()].sort((left, right) => left.documentId.localeCompare(right.documentId))
  const sourceVersionsComplete = sources.length > 0 && sources.every((source) => Boolean(source.documentVersion))
  const datasetVersion = sourceVersionsComplete
    ? `source-set-sha256:${hash(JSON.stringify(sources.map((source) => ({
        documentId: source.documentId,
        documentVersion: source.documentVersion
      }))))}`
    : null
  const parserVersion = clean(input.observedVersions?.parserVersion)
    ?? consistentSourceValue(sources, (source) => source.parserVersion)
    ?? clean(pipeline?.sourceExtractorVersion)
  const ocrVersion = clean(input.observedVersions?.ocrVersion)
    ?? consistentSourceValue(sources, (source) => source.ocrVersion)
  const manifest: ReplayVersionManifest = {
    schemaVersion: 1,
    sourceSnapshots: sources,
    parserVersion,
    ocrVersion,
    chunkerVersion: clean(input.observedVersions?.chunkerVersion)
      ?? consistentSourceValue(sources, (source) => source.chunkerVersion)
      ?? clean(pipeline?.chunkerVersion),
    chunkingPolicyVersion: clean(input.observedVersions?.chunkingPolicyVersion)
      ?? consistentSourceValue(sources, (source) => source.chunkingPolicyVersion),
    embedding: {
      modelId: clean(input.observedVersions?.embeddingModelId)
        ?? consistentSourceValue(sources, (source) => source.embeddingModelId)
        ?? clean(pipeline?.embeddingModelId),
      dimensions: input.observedVersions?.embeddingDimensions
        ?? consistentSourceNumber(sources, (source) => source.embeddingDimensions)
        ?? pipeline?.embeddingDimensions
        ?? null
    },
    policyVersions: {
      ragProfile: input.ragProfile?.version ?? null,
      retrieval: input.ragProfile?.retrievalProfileVersion ?? null,
      answer: input.ragProfile?.answerPolicyVersion ?? null,
      authorization: input.policyVersions.authorization ?? null,
      eligibility: input.policyVersions.eligibility ?? null,
      untrustedContent: input.policyVersions.untrustedContent ?? null,
      traceSanitization: input.policyVersions.traceSanitization ?? null
    },
    indexVersion: clean(input.observedVersions?.indexVersion)
      ?? consistentSourceValue(sources, (source) => source.indexVersion)
      ?? clean(pipeline?.indexVersion),
    modelVersions: {
      answer: clean(input.modelId),
      clue: clean(input.clueModelId)
    },
    promptVersion: clean(input.observedVersions?.promptVersion)
      ?? consistentSourceValue(sources, (source) => source.promptVersion)
      ?? clean(pipeline?.promptVersion),
    pipelineVersion: clean(input.observedVersions?.pipelineVersion)
      ?? consistentSourceValue(sources, (source) => source.pipelineVersion)
      ?? clean(pipeline?.chatOrchestrationWorkflowVersion),
    datasetVersion,
    queryTransformation: {
      originalQuestionHash: hash(input.question),
      normalizedQueryHash: input.normalizedQuery ? hash(input.normalizedQuery) : null,
      expandedQuerySetHash: input.expandedQueries?.length ? hash(JSON.stringify(input.expandedQueries)) : null
    },
    decisions: {
      candidateCount: Math.max(0, input.candidateCount),
      deniedCandidateCount: Math.min(Math.max(0, input.candidateCount), Math.max(0, input.deniedCandidateCount ?? 0)),
      finalEvidenceCount: Math.max(0, input.finalEvidenceCount),
      responseStatus: input.responseStatus,
      decisionCode: input.decisionCode ?? defaultDecisionCode(input.responseStatus),
      reasonCodes: [...new Set(input.reasonCodes ?? [])].sort(),
      totalLatencyMs: Math.max(0, input.totalLatencyMs)
    },
    nondeterministicFactors: [...new Set(input.nondeterministicFactors.map((item) => item.trim()).filter(Boolean))].sort(),
    missingVersions: []
  }
  manifest.missingVersions = missingVersionPaths(manifest)
  return manifest
}

function defaultDecisionCode(status: ReplayVersionManifest["decisions"]["responseStatus"]): ReplayDecisionCode {
  if (status === "success") return "completed"
  if (status === "warning") return "refused"
  return "failed"
}

function missingVersionPaths(manifest: ReplayVersionManifest): string[] {
  const required: Array<[string, unknown]> = [
    ["sourceSnapshots", manifest.sourceSnapshots.length > 0 && manifest.sourceSnapshots.every((item) => Boolean(item.documentVersion))],
    ["parserVersion", manifest.parserVersion],
    ["ocrVersion", manifest.ocrVersion],
    ["chunkerVersion", manifest.chunkerVersion],
    ["chunkingPolicyVersion", manifest.chunkingPolicyVersion],
    ["embedding.modelId", manifest.embedding.modelId],
    ["embedding.dimensions", manifest.embedding.dimensions],
    ["policyVersions.ragProfile", manifest.policyVersions.ragProfile],
    ["policyVersions.retrieval", manifest.policyVersions.retrieval],
    ["policyVersions.answer", manifest.policyVersions.answer],
    ["policyVersions.authorization", manifest.policyVersions.authorization],
    ["policyVersions.eligibility", manifest.policyVersions.eligibility],
    ["policyVersions.untrustedContent", manifest.policyVersions.untrustedContent],
    ["policyVersions.traceSanitization", manifest.policyVersions.traceSanitization],
    ["indexVersion", manifest.indexVersion],
    ["modelVersions.answer", manifest.modelVersions.answer],
    ["modelVersions.clue", manifest.modelVersions.clue],
    ["promptVersion", manifest.promptVersion],
    ["pipelineVersion", manifest.pipelineVersion],
    ["datasetVersion", manifest.datasetVersion]
  ]
  return required.filter(([, value]) => value === null || value === false || value === "").map(([path]) => path)
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function clean(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeSourceSnapshot(source: ReplaySourceSnapshot): ReplaySourceSnapshot {
  return {
    documentId: source.documentId,
    documentVersion: cleanNullable(source.documentVersion),
    ingestTraceId: cleanNullable(source.ingestTraceId),
    parserVersion: cleanNullable(source.parserVersion),
    ocrVersion: cleanNullable(source.ocrVersion),
    chunkerVersion: cleanNullable(source.chunkerVersion),
    chunkingPolicyVersion: cleanNullable(source.chunkingPolicyVersion),
    embeddingModelId: cleanNullable(source.embeddingModelId),
    embeddingDimensions: Number.isFinite(source.embeddingDimensions) ? source.embeddingDimensions : null,
    indexVersion: cleanNullable(source.indexVersion),
    promptVersion: cleanNullable(source.promptVersion),
    pipelineVersion: cleanNullable(source.pipelineVersion)
  }
}

function emptySourceSnapshot(documentId: string, documentVersion: string | null): ReplaySourceSnapshot {
  return {
    documentId,
    documentVersion,
    ingestTraceId: null,
    parserVersion: null,
    ocrVersion: null,
    chunkerVersion: null,
    chunkingPolicyVersion: null,
    embeddingModelId: null,
    embeddingDimensions: null,
    indexVersion: null,
    promptVersion: null,
    pipelineVersion: null
  }
}

function consistentSourceValue(
  sources: ReplaySourceSnapshot[],
  select: (source: ReplaySourceSnapshot) => string | null
): string | null {
  if (sources.length === 0) return null
  const values = sources.map(select)
  if (values.some((value) => value === null)) return null
  const unique = [...new Set(values)]
  return unique.length === 1 ? unique[0]! : null
}

function consistentSourceNumber(
  sources: ReplaySourceSnapshot[],
  select: (source: ReplaySourceSnapshot) => number | null
): number | null {
  if (sources.length === 0) return null
  const values = sources.map(select)
  if (values.some((value) => value === null)) return null
  const unique = [...new Set(values)]
  return unique.length === 1 ? unique[0]! : null
}

function cleanNullable(value: string | null): string | null {
  return value === null ? null : clean(value)
}
