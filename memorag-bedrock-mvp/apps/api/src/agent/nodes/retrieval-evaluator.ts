import type { RetrievedVector } from "../../types.js"
import type { QaAgentState, QaAgentUpdate, RequiredFact, RetrievalEvaluation } from "../state.js"

export async function retrievalEvaluator(state: QaAgentState): Promise<QaAgentUpdate> {
  const topScore = state.retrievedChunks[0]?.score ?? 0
  const facts = state.searchPlan.requiredFacts.length > 0 ? state.searchPlan.requiredFacts : fallbackFacts(state.question)
  const factAssessments = facts.map((fact) => assessFact(fact, state.retrievedChunks))
  const supportedFactIds = factAssessments.filter((assessment) => assessment.status === "supported").map((assessment) => assessment.fact.id)
  const missingFactIds = factAssessments.filter((assessment) => assessment.status === "missing").map((assessment) => assessment.fact.id)
  const conflictingFactIds = factAssessments.filter((assessment) => assessment.status === "conflicting").map((assessment) => assessment.fact.id)
  const retrievalQuality = classifyRetrieval(state, topScore, missingFactIds, conflictingFactIds)
  const nextAction = chooseNextAction(state, retrievalQuality, missingFactIds)
  const supportingChunkKeysByFact = new Map(
    factAssessments.map((assessment) => [assessment.fact.id, assessment.supportingChunkKeys] as const)
  )

  const retrievalEvaluation: RetrievalEvaluation = {
    retrievalQuality,
    missingFactIds,
    conflictingFactIds,
    supportedFactIds,
    nextAction,
    reason: buildReason(state, retrievalQuality, topScore, missingFactIds, conflictingFactIds)
  }

  const answerability =
    retrievalQuality === "conflicting"
      ? {
          ...state.answerability,
          isAnswerable: false,
          reason: "conflicting_evidence" as const,
          confidence: 0.2
        }
      : undefined

  return {
    retrievalEvaluation,
    ...(answerability ? { answerability } : {}),
    searchPlan: {
      ...state.searchPlan,
      requiredFacts: facts.map((fact) => ({
        ...fact,
        status: conflictingFactIds.includes(fact.id) ? "conflicting" : supportedFactIds.includes(fact.id) ? "supported" : "missing",
        supportingChunkKeys: supportingChunkKeysByFact.get(fact.id) ?? fact.supportingChunkKeys
      }))
    }
  }
}

type FactAssessment = {
  fact: RequiredFact
  status: RequiredFact["status"]
  supportingChunkKeys: string[]
}

function fallbackFacts(question: string): RequiredFact[] {
  return [
    {
      id: "fact-1",
      description: question,
      priority: 1,
      status: "missing",
      supportingChunkKeys: []
    }
  ]
}

function assessFact(fact: RequiredFact, chunks: RetrievedVector[]): FactAssessment {
  const supportingChunkKeys = chunks.filter((chunk) => supportsFact(fact.description, chunk.metadata.text ?? "")).map((chunk) => chunk.key)
  const conflicting = chunks.some((chunk) => supportsFact(fact.description, chunk.metadata.text ?? "") && hasConflictSignal(chunk.metadata.text ?? ""))
  return {
    fact,
    status: conflicting ? "conflicting" : supportingChunkKeys.length > 0 ? "supported" : "missing",
    supportingChunkKeys
  }
}

function classifyRetrieval(
  state: QaAgentState,
  topScore: number,
  missingFactIds: string[],
  conflictingFactIds: string[]
): RetrievalEvaluation["retrievalQuality"] {
  if (conflictingFactIds.length > 0) return "conflicting"
  if (state.retrievedChunks.length === 0 || topScore < state.searchPlan.stopCriteria.minTopScore) return "irrelevant"
  if (missingFactIds.length > 0) return "partial"
  return "sufficient"
}

function chooseNextAction(
  state: QaAgentState,
  retrievalQuality: RetrievalEvaluation["retrievalQuality"],
  missingFactIds: string[]
): RetrievalEvaluation["nextAction"] {
  if (retrievalQuality === "sufficient") return { type: "rerank", objective: "answer_with_supported_evidence" }
  if (retrievalQuality === "conflicting") return { type: "finalize_refusal", reason: "conflicting_evidence" }

  const missingDescriptions = state.searchPlan.requiredFacts
    .filter((fact) => missingFactIds.includes(fact.id))
    .map((fact) => fact.description)
    .slice(0, 3)
  const queryParts = [state.normalizedQuery ?? state.question, ...missingDescriptions].filter(Boolean)
  return {
    type: "evidence_search",
    query: [...new Set(queryParts)].join(" "),
    topK: state.topK
  }
}

function buildReason(
  state: QaAgentState,
  retrievalQuality: RetrievalEvaluation["retrievalQuality"],
  topScore: number,
  missingFactIds: string[],
  conflictingFactIds: string[]
): string {
  if (retrievalQuality === "sufficient") return "必要事実が検索済み evidence chunk で支持されているため、rerank に進みます。"
  if (retrievalQuality === "conflicting") return `矛盾を示す evidence が見つかりました: ${conflictingFactIds.join(", ")}`
  if (retrievalQuality === "irrelevant") {
    if (state.retrievedChunks.length === 0) return "検索結果がないため、追加 evidence search を試みます。"
    return `topScore=${topScore.toFixed(4)} が minTopScore=${state.searchPlan.stopCriteria.minTopScore} を下回るため、追加 evidence search を試みます。`
  }
  return `不足している必要事実があります: ${missingFactIds.join(", ")}`
}

function supportsFact(fact: string, text: string): boolean {
  const terms = significantTerms(fact)
  const normalizedText = normalize(text)
  if (terms.length === 0) return normalize(fact).length > 0 && normalizedText.includes(normalize(fact))
  const matched = terms.filter((term) => normalizedText.includes(normalize(term))).length
  if (terms.length === 1) return matched === 1
  return matched === terms.length
}

function significantTerms(text: string): string[] {
  const normalized = text.normalize("NFKC")
  const ascii = normalized.match(/[A-Za-z0-9][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu) ?? []
  return [...new Set([...ascii, ...japanese].map((term) => term.trim()).filter((term) => !isStopTerm(term)))]
}

function isStopTerm(term: string): boolean {
  return ["資料", "回答", "質問", "方法", "手順", "条件", "期限"].includes(term)
}

function hasConflictSignal(text: string): boolean {
  return /矛盾|相反|食い違|廃止|無効|取り消し|取消|conflict|contradict/i.test(text)
}

function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, "").toLowerCase()
}
