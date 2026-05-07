import type { Dependencies } from "../../dependencies.js"
import { parseJsonObject } from "../../rag/json.js"
import { buildSufficientContextPrompt } from "../../rag/prompts.js"
import { llmOptions, ragRuntimePolicy } from "../runtime-policy.js"
import { NO_ANSWER, isPrimaryRequiredFact, requiredFactNecessity, type QaAgentState, type QaAgentUpdate, type RequiredFact, type SufficientContextJudgement } from "../state.js"

type JudgeJson = Partial<SufficientContextJudgement>

export function createSufficientContextGateNode(deps: Dependencies) {
  return async function sufficientContextGate(state: QaAgentState): Promise<QaAgentUpdate> {
    const requiredFacts = state.searchPlan.requiredFacts.map((fact) => {
      const type = fact.factType ? `type=${fact.factType}` : "type=unknown"
      const necessity = ` necessity=${requiredFactNecessity(fact)}`
      const scope = fact.scope ? ` scope=${fact.scope}` : ""
      return `${fact.description} (${type}${necessity}${scope})`
    }).filter(Boolean)
    const raw = await deps.textModel.generate(
      buildSufficientContextPrompt(state.question, requiredFacts, state.selectedChunks, state.computedFacts),
      llmOptions("sufficientContext", state.modelId)
    )
    const judgement = normalizeJudgement(parseJsonObject<JudgeJson>(raw), state)

    if (judgement.label === "ANSWERABLE") {
      return {
        sufficientContext: judgement,
        searchPlan: updateRequiredFactStatuses(state, judgement),
        answerability: {
          ...state.answerability,
          isAnswerable: true,
          reason: "sufficient_evidence",
          confidence: Math.max(state.answerability.confidence, judgement.confidence)
        }
      }
    }

    if (canProceedWithGroundedPartialEvidence(state, judgement)) {
      return {
        sufficientContext: {
          ...judgement,
          reason: `${judgement.reason} 後段の引用検証と回答支持検証で確認できるため、取得済み根拠で回答生成へ進みます。`
        },
        searchPlan: updateRequiredFactStatuses(state, judgement),
        answerability: {
          ...state.answerability,
          isAnswerable: true,
          reason: "sufficient_evidence",
          confidence: Math.max(
            state.answerability.confidence,
            Math.min(ragRuntimePolicy.confidence.partialEvidenceCap, judgement.confidence || ragRuntimePolicy.confidence.partialEvidenceFallback)
          )
        }
      }
    }

    return {
      sufficientContext: judgement,
      searchPlan: updateRequiredFactStatuses(state, judgement),
      answerability: {
        ...state.answerability,
        isAnswerable: false,
        reason: judgement.conflictingFacts.length > 0 ? "conflicting_evidence" : "missing_required_fact",
        confidence: judgement.confidence
      },
      answer: NO_ANSWER,
      citations: []
    }
  }
}

function canProceedWithGroundedPartialEvidence(state: QaAgentState, judgement: SufficientContextJudgement): boolean {
  if (judgement.label !== "PARTIAL") return false
  if (!state.answerability.isAnswerable) return false
  if (state.selectedChunks.length === 0) return false
  if (judgement.supportedFacts.length === 0 && judgement.supportingChunkIds.length === 0) return false
  if (!hasSupportedPrimaryEvidence(state, judgement)) return false
  if (hasUnresolvedPrimaryMissingFact(state, judgement)) return false
  if (hasPrimaryConflict(state, judgement)) return false
  if (state.retrievalEvaluation.retrievalQuality === "irrelevant") return false
  if (state.retrievalEvaluation.retrievalQuality === "conflicting" && hasPrimaryFactId(state, state.retrievalEvaluation.conflictingFactIds)) return false
  if (state.selectedChunks[0]?.score !== undefined && state.selectedChunks[0].score < state.minScore) return false
  return true
}

function hasUnresolvedPrimaryMissingFact(state: QaAgentState, judgement: SufficientContextJudgement): boolean {
  const primaryFacts = primaryRequiredFacts(state.searchPlan.requiredFacts)
  if (primaryFacts.length === 0) return false
  const supportedFacts = judgement.supportedFacts.map(normalize)
  const missingFacts = judgement.missingFacts.map(normalize)
  const missingFactIds = new Set(state.retrievalEvaluation.missingFactIds)

  return primaryFacts.some((fact) => {
    if (primaryFactSupportedByEvidence(state, fact, supportedFacts)) return false
    if (missingFactIds.has(fact.id)) return true
    return missingFacts.some((missing) => judgementMentionsFact(fact, missing))
  })
}

function hasPrimaryConflict(state: QaAgentState, judgement: SufficientContextJudgement): boolean {
  if (hasPrimaryFactId(state, state.retrievalEvaluation.conflictingFactIds)) return true
  const conflictingFacts = judgement.conflictingFacts.map(normalize)
  if (conflictingFacts.length === 0) return false
  return primaryRequiredFacts(state.searchPlan.requiredFacts).some((fact) => conflictingFacts.some((conflict) => judgementMentionsFact(fact, conflict)))
}

function hasSupportedPrimaryEvidence(state: QaAgentState, judgement: SufficientContextJudgement): boolean {
  const primaryFacts = primaryRequiredFacts(state.searchPlan.requiredFacts)
  const supportedFacts = judgement.supportedFacts.map(normalize)
  if (primaryFacts.length === 0) return false
  return primaryFacts.some((fact) => primaryFactSupportedByEvidence(state, fact, supportedFacts))
}

function primaryRequiredFacts(facts: RequiredFact[]): RequiredFact[] {
  return facts.filter(isPrimaryRequiredFact)
}

function hasPrimaryFactId(state: QaAgentState, factIds: string[]): boolean {
  if (factIds.length === 0) return false
  return state.searchPlan.requiredFacts.some((fact) => factIds.includes(fact.id) && isPrimaryRequiredFact(fact))
}

function primaryFactSupportedByEvidence(state: QaAgentState, fact: RequiredFact, supportedFacts: string[]): boolean {
  if (state.retrievalEvaluation.supportedFactIds.includes(fact.id)) return true
  if (fact.status === "supported" || fact.supportingChunkKeys.length > 0) return true
  return supportedFacts.some((supported) => judgementMentionsFact(fact, supported))
}

function judgementMentionsFact(fact: RequiredFact, normalizedJudgementText: string): boolean {
  if (!normalizedJudgementText) return false
  return factReferences(fact).some((reference) => {
    const normalizedReference = normalize(reference)
    return normalizedReference.length > 0 && (normalizedJudgementText === normalizedReference || normalizedJudgementText.includes(normalizedReference) || normalizedReference.includes(normalizedJudgementText))
  })
}

function factReferences(fact: RequiredFact): string[] {
  return [fact.id, fact.description]
}

function normalizeJudgement(parsed: JudgeJson | undefined, state: QaAgentState): SufficientContextJudgement {
  const label = parsed?.label === "ANSWERABLE" || parsed?.label === "PARTIAL" || parsed?.label === "UNANSWERABLE" ? parsed.label : "UNANSWERABLE"
  const confidence = clamp(parsed?.confidence ?? 0)
  const requiredFacts = cleanStrings(parsed?.requiredFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const supportedFacts = cleanStrings(parsed?.supportedFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const missingFacts = cleanStrings(parsed?.missingFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const conflictingFacts = cleanStrings(parsed?.conflictingFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const supportingChunkIds = validSupportingChunkIds(cleanStrings(parsed?.supportingChunkIds), state)
  const fallbackSupportingChunkIds =
    label === "ANSWERABLE" && supportingChunkIds.length === 0
      ? state.selectedChunks.slice(0, ragRuntimePolicy.limits.supportingChunkFallbackLimit).map((chunk) => chunk.key)
      : supportingChunkIds
  const fallbackReason = label === "ANSWERABLE" ? "必要事実が根拠チャンクで支持されています。" : "根拠チャンクだけでは回答に必要な事実が不足しています。"

  return {
    label,
    confidence,
    requiredFacts: requiredFacts.length > 0 ? requiredFacts : state.searchPlan.requiredFacts.map((fact) => fact.description),
    supportedFacts,
    missingFacts: label === "ANSWERABLE" ? [] : missingFacts,
    conflictingFacts,
    supportingChunkIds: fallbackSupportingChunkIds,
    reason:
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, ragRuntimePolicy.limits.judgeReasonMaxChars)
        : fallbackReason
  }
}

function updateRequiredFactStatuses(state: QaAgentState, judgement: SufficientContextJudgement): QaAgentState["searchPlan"] {
  const supported = judgement.supportedFacts.map(normalize)
  const missing = judgement.missingFacts.map(normalize)
  const conflicting = judgement.conflictingFacts.map(normalize)

  return {
    ...state.searchPlan,
    requiredFacts: state.searchPlan.requiredFacts.map((fact) => {
      const normalized = normalize(fact.description)
      const status = conflicting.some((item) => item && normalized.includes(item))
        ? "conflicting"
        : supported.some((item) => item && (normalized.includes(item) || item.includes(normalized)))
          ? "supported"
          : missing.some((item) => item && (normalized.includes(item) || item.includes(normalized)))
            ? "missing"
            : judgement.label === "ANSWERABLE"
              ? "supported"
              : fact.status
      return {
        ...fact,
        status,
        supportingChunkKeys: status === "supported" ? judgement.supportingChunkIds : fact.supportingChunkKeys
      }
    })
  }
}

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
}

function validSupportingChunkIds(ids: string[], state: QaAgentState): string[] {
  const validIds = new Set(state.selectedChunks.flatMap((chunk) => [chunk.key, chunk.metadata.chunkId].filter(Boolean)))
  const byChunkId = new Map(state.selectedChunks.map((chunk) => [chunk.metadata.chunkId, chunk.key]))
  return [...new Set(ids.map((id) => byChunkId.get(id) ?? id).filter((id) => validIds.has(id)))]
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase()
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
