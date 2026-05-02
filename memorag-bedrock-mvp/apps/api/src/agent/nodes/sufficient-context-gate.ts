import type { Dependencies } from "../../dependencies.js"
import { parseJsonObject } from "../../rag/json.js"
import { buildSufficientContextPrompt } from "../../rag/prompts.js"
import { NO_ANSWER, type QaAgentState, type QaAgentUpdate, type SufficientContextJudgement } from "../state.js"

type JudgeJson = Partial<SufficientContextJudgement>

export function createSufficientContextGateNode(deps: Dependencies) {
  return async function sufficientContextGate(state: QaAgentState): Promise<QaAgentUpdate> {
    const requiredFacts = state.searchPlan.requiredFacts.map((fact) => fact.description).filter(Boolean)
    const raw = await deps.textModel.generate(buildSufficientContextPrompt(state.question, requiredFacts, state.selectedChunks), {
      modelId: state.modelId,
      temperature: 0,
      maxTokens: 900
    })
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

function normalizeJudgement(parsed: JudgeJson | undefined, state: QaAgentState): SufficientContextJudgement {
  const label = parsed?.label === "ANSWERABLE" || parsed?.label === "PARTIAL" || parsed?.label === "UNANSWERABLE" ? parsed.label : "UNANSWERABLE"
  const confidence = clamp(parsed?.confidence ?? 0)
  const requiredFacts = cleanStrings(parsed?.requiredFacts).slice(0, 12)
  const supportedFacts = cleanStrings(parsed?.supportedFacts).slice(0, 12)
  const missingFacts = cleanStrings(parsed?.missingFacts).slice(0, 12)
  const conflictingFacts = cleanStrings(parsed?.conflictingFacts).slice(0, 12)
  const supportingChunkIds = validSupportingChunkIds(cleanStrings(parsed?.supportingChunkIds), state)
  const fallbackSupportingChunkIds = label === "ANSWERABLE" && supportingChunkIds.length === 0 ? state.selectedChunks.slice(0, 4).map((chunk) => chunk.key) : supportingChunkIds
  const fallbackReason = label === "ANSWERABLE" ? "必要事実が根拠チャンクで支持されています。" : "根拠チャンクだけでは回答に必要な事実が不足しています。"

  return {
    label,
    confidence,
    requiredFacts: requiredFacts.length > 0 ? requiredFacts : state.searchPlan.requiredFacts.map((fact) => fact.description),
    supportedFacts,
    missingFacts: label === "ANSWERABLE" ? [] : missingFacts,
    conflictingFacts,
    supportingChunkIds: fallbackSupportingChunkIds,
    reason: typeof parsed?.reason === "string" && parsed.reason.trim() ? parsed.reason.trim().slice(0, 800) : fallbackReason
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
