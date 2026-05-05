import { config } from "../config.js"
import type { GenerateOptions } from "../adapters/text-model.js"

type LlmTask =
  | "clue"
  | "finalAnswer"
  | "sufficientContext"
  | "retrievalJudge"
  | "answerSupport"
  | "answerRepair"
  | "memoryCard"

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(clampNumber(value, min, max))
}

const maxTopK = Math.max(1, config.ragMaxTopK)
const maxMemoryTopK = Math.max(1, config.ragMaxMemoryTopK)
const maxIterations = Math.max(1, config.ragMaxIterations)
const minEvidenceCountMin = Math.max(1, config.ragMinEvidenceCountMin)
const minEvidenceCountMax = Math.max(minEvidenceCountMin, config.ragMinEvidenceCountMax)
const sourceScoreMax = clampNumber(config.ragRetrievalMaxSourceScore, 0, 1)
const crossQueryRrfBoostCap = clampNumber(config.ragCrossQueryRrfBoostCap, 0, 1)

export const ragRuntimePolicy = {
  retrieval: {
    defaultTopK: clampInt(config.ragDefaultTopK, 1, maxTopK),
    maxTopK,
    defaultMemoryTopK: clampInt(config.ragDefaultMemoryTopK, 1, maxMemoryTopK),
    maxMemoryTopK,
    defaultMinScore: clampNumber(config.minRetrievalScore, -1, 1),
    defaultMaxIterations: clampInt(config.ragDefaultMaxIterations, 1, maxIterations),
    maxIterations,
    searchCandidateMinTopK: Math.max(1, config.ragSearchCandidateMinTopK),
    defaultSearchBenchmarkTopK: Math.max(1, config.ragDefaultSearchBenchmarkTopK),
    lexicalTopK: Math.max(1, config.ragSearchLexicalTopK),
    semanticTopK: Math.max(1, config.ragSearchSemanticTopK),
    memoryPrefetchMultiplier: Math.max(1, config.ragMemoryPrefetchMultiplier),
    memoryPrefetchMaxTopK: Math.max(1, config.ragMemoryPrefetchMaxTopK),
    minEvidenceCountMin,
    minEvidenceCountMax,
    maxNoNewEvidenceStreak: Math.max(1, config.ragMaxNoNewEvidenceStreak),
    referenceMaxDepth: Math.max(0, config.ragReferenceMaxDepth),
    searchBudgetCalls: Math.max(0, config.ragSearchBudgetCalls),
    contextWindowDecay: clampNumber(config.ragContextWindowDecay, 0, 1),
    contextWindowMaxScore: clampNumber(config.ragContextWindowMaxScore, 0, 1),
    lexicalBaseScore: clampNumber(config.ragRetrievalLexicalBaseScore, 0, sourceScoreMax),
    lexicalLogDivisor: Math.max(Number.EPSILON, config.ragRetrievalLexicalLogDivisor),
    sourceScoreMax,
    crossQueryRrfBoostCap,
    crossQueryRrfBoostMultiplier: Math.max(0, config.ragCrossQueryRrfBoostMultiplier)
  },
  llm: {
    temperature: clampNumber(config.ragLlmTemperature, 0, 1),
    maxTokens: {
      clue: Math.max(1, config.ragClueMaxTokens),
      finalAnswer: Math.max(1, config.ragFinalAnswerMaxTokens),
      sufficientContext: Math.max(1, config.ragSufficientContextMaxTokens),
      retrievalJudge: Math.max(1, config.ragRetrievalJudgeMaxTokens),
      answerSupport: Math.max(1, config.ragAnswerSupportMaxTokens),
      answerRepair: Math.max(1, config.ragAnswerRepairMaxTokens),
      memoryCard: Math.max(1, config.ragMemoryCardMaxTokens)
    } satisfies Record<LlmTask, number>
  },
  confidence: {
    computedFact: clampNumber(config.ragComputedFactConfidence, 0, 1),
    missingClassificationFact: clampNumber(config.ragFactCoverageMissingClassificationConfidence, 0, 1),
    missingAmountFact: clampNumber(config.ragFactCoverageMissingAmountConfidence, 0, 1),
    missingDateFact: clampNumber(config.ragFactCoverageMissingDateConfidence, 0, 1),
    missingProcedureFact: clampNumber(config.ragFactCoverageMissingProcedureConfidence, 0, 1),
    supportedFactCoverage: clampNumber(config.ragFactCoverageSupportedConfidence, 0, 1),
    answerabilityMax: clampNumber(config.ragAnswerabilityMaxConfidence, 0, 1),
    partialEvidenceCap: clampNumber(config.ragPartialEvidenceConfidenceCap, 0, 1),
    partialEvidenceFallback: clampNumber(config.ragPartialEvidenceFallbackConfidence, 0, 1),
    llmJudgeNoConflictMin: clampNumber(config.ragLlmJudgeNoConflictMinConfidence, 0, 1),
    answerSupportSupportedFallback: clampNumber(config.ragSupportSupportedFallbackConfidence, 0, 1),
    answerSupportUnsupportedFallback: clampNumber(config.ragSupportUnsupportedFallbackConfidence, 0, 1)
  },
  limits: {
    judgeChunkLimit: Math.max(1, config.ragJudgeChunkLimit),
    judgeReasonMaxChars: Math.max(1, config.ragJudgeReasonMaxChars),
    requiredFactLimit: Math.max(1, config.ragRequiredFactLimit),
    supportingChunkFallbackLimit: Math.max(1, config.ragSupportingChunkFallbackLimit),
    unsupportedSentenceLimit: Math.max(1, config.ragUnsupportedSentenceLimit),
    answerabilityDebugAssessmentLimit: Math.max(1, config.ragAnswerabilityDebugAssessmentLimit),
    answerabilitySentenceScanLimit: Math.max(1, config.ragAnswerabilitySentenceScanLimit),
    expandedQueryLimit: Math.max(1, config.ragExpandedQueryLimit),
    queryRewriteFactLimit: Math.max(1, config.ragQueryRewriteFactLimit),
    actionFactLimit: Math.max(1, config.ragActionFactLimit),
    factReferenceLimit: Math.max(1, config.ragFactReferenceLimit),
    riskSignalValueLimit: Math.max(1, config.ragRiskSignalValueLimit),
    memorySummaryMaxChars: Math.max(1, config.ragMemorySummaryMaxChars),
    memoryKeywordLimit: Math.max(1, config.ragMemoryKeywordLimit),
    memoryQuestionLimit: Math.max(1, config.ragMemoryQuestionLimit),
    memoryConstraintLimit: Math.max(1, config.ragMemoryConstraintLimit),
    sectionMemoryLimit: Math.max(1, config.ragSectionMemoryLimit),
    conceptMemoryTermLimit: Math.max(1, config.ragConceptMemoryTermLimit),
    conceptMemorySourceChunkLimit: Math.max(1, config.ragConceptMemorySourceChunkLimit),
    citationLimit: Math.max(1, config.ragCitationLimit),
    searchClueLimit: Math.max(1, config.ragSearchClueLimit),
    clarificationOptionLimit: Math.max(1, config.ragClarificationOptionLimit),
    clarificationGroundingLimit: Math.max(1, config.ragClarificationGroundingLimit),
    clarificationRejectedOptionLimit: Math.max(1, config.ragClarificationRejectedOptionLimit),
    clarificationMissingSlotLimit: Math.max(1, config.ragClarificationMissingSlotLimit),
    aliasExpansionLimit: Math.max(1, config.ragAliasExpansionLimit)
  }
} as const

export function normalizeTopK(value: number | undefined): number {
  return clampInt(value ?? ragRuntimePolicy.retrieval.defaultTopK, 1, ragRuntimePolicy.retrieval.maxTopK)
}

export function normalizeMemoryTopK(value: number | undefined): number {
  return clampInt(value ?? ragRuntimePolicy.retrieval.defaultMemoryTopK, 1, ragRuntimePolicy.retrieval.maxMemoryTopK)
}

export function normalizeMaxIterations(value: number | undefined): number {
  return clampInt(value ?? ragRuntimePolicy.retrieval.defaultMaxIterations, 1, ragRuntimePolicy.retrieval.maxIterations)
}

export function deriveMinEvidenceCount(topK: number): number {
  return clampInt(topK, ragRuntimePolicy.retrieval.minEvidenceCountMin, ragRuntimePolicy.retrieval.minEvidenceCountMax)
}

export function expandedSearchTopK(topK: number): number {
  return Math.max(topK, ragRuntimePolicy.retrieval.searchCandidateMinTopK)
}

export function llmOptions(task: LlmTask, modelId: string): GenerateOptions {
  return {
    modelId,
    temperature: ragRuntimePolicy.llm.temperature,
    maxTokens: ragRuntimePolicy.llm.maxTokens[task]
  }
}
