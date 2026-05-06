import type { RetrievedVector } from "../../types.js"
import type { Dependencies } from "../../dependencies.js"
import { parseJsonObject } from "../../rag/json.js"
import { buildRetrievalJudgePrompt } from "../../rag/prompts.js"
import { llmOptions, ragRuntimePolicy } from "../runtime-policy.js"
import type { QaAgentState, QaAgentUpdate, RequiredFact, RetrievalEvaluation, RetrievalLlmJudge, RetrievalRiskSignal } from "../state.js"

type RetrievalJudgeJson = Partial<RetrievalLlmJudge>

export function createRetrievalEvaluatorNode(deps: Dependencies) {
  return async function retrievalEvaluatorWithJudge(state: QaAgentState): Promise<QaAgentUpdate> {
    const heuristicUpdate = await retrievalEvaluator(state)
    const riskSignals = heuristicUpdate.retrievalEvaluation?.riskSignals ?? []
    if (riskSignals.length === 0) return heuristicUpdate

    try {
      const relevantChunks = selectJudgeChunks(state.retrievedChunks, riskSignals)
      const raw = await deps.textModel.generate(
        buildRetrievalJudgePrompt(state.question, state.searchPlan.requiredFacts, riskSignals, relevantChunks),
        llmOptions("retrievalJudge", state.modelId)
      )
      const judge = normalizeRetrievalJudge(parseJsonObject<RetrievalJudgeJson>(raw), state, riskSignals)
      return applyRetrievalJudge(state, heuristicUpdate, judge)
    } catch (error) {
      const evaluation = heuristicUpdate.retrievalEvaluation
      if (!evaluation) return heuristicUpdate
      return {
        ...heuristicUpdate,
        retrievalEvaluation: {
          ...evaluation,
          reason: `${evaluation.reason} LLM judge は失敗したため heuristic 判定を維持します: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }
  }
}

export async function retrievalEvaluator(state: QaAgentState): Promise<QaAgentUpdate> {
  const topScore = state.retrievedChunks[0]?.score ?? 0
  const facts = state.searchPlan.requiredFacts.length > 0 ? state.searchPlan.requiredFacts : fallbackFacts(state.question)
  const factAssessments = facts.map((fact) => assessFact(fact, state.retrievedChunks, state.searchPlan.stopCriteria.minTopScore))
  const supportedFactIds = factAssessments.filter((assessment) => assessment.status === "supported").map((assessment) => assessment.fact.id)
  const missingFactIds = factAssessments.filter((assessment) => assessment.status === "missing").map((assessment) => assessment.fact.id)
  const conflictingFactIds = factAssessments.filter((assessment) => assessment.status === "conflicting").map((assessment) => assessment.fact.id)
  const riskSignals = factAssessments.flatMap((assessment) => assessment.riskSignals)
  const retrievalQuality = classifyRetrieval(state, topScore, missingFactIds, conflictingFactIds)
  const nextAction = chooseNextAction(state, retrievalQuality, supportedFactIds, missingFactIds, conflictingFactIds)
  const supportingChunkKeysByFact = new Map(
    factAssessments.map((assessment) => [assessment.fact.id, assessment.supportingChunkKeys] as const)
  )

  const retrievalEvaluation: RetrievalEvaluation = {
    retrievalQuality,
    missingFactIds,
    conflictingFactIds,
    supportedFactIds,
    riskSignals,
    nextAction,
    reason: buildReason(state, retrievalQuality, topScore, missingFactIds, conflictingFactIds, riskSignals)
  }

  return {
    retrievalEvaluation,
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

function selectJudgeChunks(chunks: RetrievedVector[], riskSignals: RetrievalRiskSignal[]): RetrievedVector[] {
  const riskChunkKeys = new Set(riskSignals.flatMap((signal) => signal.chunkKeys))
  const selected = chunks.filter((chunk) => riskChunkKeys.has(chunk.key))
  return (selected.length > 0 ? selected : chunks).slice(0, ragRuntimePolicy.limits.judgeChunkLimit)
}

function normalizeRetrievalJudge(
  parsed: RetrievalJudgeJson | undefined,
  state: QaAgentState,
  riskSignals: RetrievalRiskSignal[]
): RetrievalLlmJudge {
  const label = parsed?.label === "CONFLICT" || parsed?.label === "NO_CONFLICT" || parsed?.label === "UNCLEAR" ? parsed.label : "UNCLEAR"
  const confidence = clamp(parsed?.confidence ?? 0)
  const validFactIds = new Set(state.searchPlan.requiredFacts.map((fact) => fact.id))
  const fallbackFactIds = riskSignals.map((signal) => signal.factId).filter((id): id is string => typeof id === "string" && id.length > 0)
  const factIds = cleanStrings(parsed?.factIds).filter((id) => validFactIds.has(id))
  const validChunkIds = new Set(state.retrievedChunks.flatMap((chunk) => [chunk.key, chunk.metadata.chunkId].filter((id): id is string => typeof id === "string" && id.length > 0)))
  const byChunkId = new Map(state.retrievedChunks.map((chunk) => [chunk.metadata.chunkId, chunk.key]))

  return {
    label,
    confidence,
    factIds: factIds.length > 0 ? factIds : [...new Set(fallbackFactIds)],
    supportingChunkIds: validIds(cleanStrings(parsed?.supportingChunkIds), validChunkIds, byChunkId),
    contradictionChunkIds: validIds(cleanStrings(parsed?.contradictionChunkIds), validChunkIds, byChunkId),
    reason:
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, ragRuntimePolicy.limits.judgeReasonMaxChars)
        : "LLM judge では判定理由が返されませんでした。"
  }
}

function applyRetrievalJudge(state: QaAgentState, update: QaAgentUpdate, judge: RetrievalLlmJudge): QaAgentUpdate {
  const evaluation = update.retrievalEvaluation
  const searchPlan = update.searchPlan
  if (!evaluation || !searchPlan) return update

  if (judge.label === "NO_CONFLICT" && judge.confidence >= ragRuntimePolicy.confidence.llmJudgeNoConflictMin) {
    const resolvedFactIds = new Set(judge.factIds.length > 0 ? judge.factIds : evaluation.conflictingFactIds)
    const conflictingFactIds = evaluation.conflictingFactIds.filter((factId) => !resolvedFactIds.has(factId))
    const supportedFactIds = [...new Set([...evaluation.supportedFactIds, ...resolvedFactIds])]
    const retrievalQuality = conflictingFactIds.length === 0 && evaluation.missingFactIds.length === 0 ? "sufficient" : "partial"
    const nextAction =
      retrievalQuality === "sufficient"
        ? { type: "rerank" as const, objective: "answer_with_supported_evidence" }
        : chooseNextAction(state, retrievalQuality, evaluation.supportedFactIds, evaluation.missingFactIds, conflictingFactIds)

    return {
      ...update,
      retrievalEvaluation: {
        ...evaluation,
        retrievalQuality,
        conflictingFactIds,
        supportedFactIds,
        llmJudge: judge,
        nextAction,
        reason: `LLM judge が value mismatch を scope 差分または誤検出と判定しました: ${judge.reason}`
      },
      searchPlan: {
        ...searchPlan,
        requiredFacts: searchPlan.requiredFacts.map((fact) => ({
          ...fact,
          status: resolvedFactIds.has(fact.id) ? "supported" : conflictingFactIds.includes(fact.id) ? "conflicting" : fact.status
        }))
      }
    }
  }

  return {
    ...update,
    retrievalEvaluation: {
      ...evaluation,
      llmJudge: judge,
      reason: `${evaluation.reason} LLM judge=${judge.label}: ${judge.reason}`
    }
  }
}

type FactAssessment = {
  fact: RequiredFact
  status: RequiredFact["status"]
  supportingChunkKeys: string[]
  riskSignals: RetrievalRiskSignal[]
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

function assessFact(fact: RequiredFact, chunks: RetrievedVector[], minFactSupportScore: number): FactAssessment {
  const supportingChunks = chunks.filter((chunk) => chunk.score >= minFactSupportScore && supportsFact(fact.description, chunk.metadata.text ?? ""))
  const supportingChunkKeys = supportingChunks.map((chunk) => chunk.key)
  const riskSignals = detectValueMismatch(fact, supportingChunks)
  return {
    fact,
    status: riskSignals.length > 0 ? "conflicting" : supportingChunkKeys.length > 0 ? "supported" : "missing",
    supportingChunkKeys,
    riskSignals
  }
}

function classifyRetrieval(
  state: QaAgentState,
  topScore: number,
  missingFactIds: string[],
  conflictingFactIds: string[]
): RetrievalEvaluation["retrievalQuality"] {
  if (state.retrievedChunks.length === 0 || topScore < state.searchPlan.stopCriteria.minTopScore) return "irrelevant"
  if (conflictingFactIds.length > 0) return "conflicting"
  if (missingFactIds.length > 0) return "partial"
  return "sufficient"
}

function chooseNextAction(
  state: QaAgentState,
  retrievalQuality: RetrievalEvaluation["retrievalQuality"],
  supportedFactIds: string[],
  missingFactIds: string[],
  conflictingFactIds: string[]
): RetrievalEvaluation["nextAction"] {
  if (retrievalQuality === "sufficient") return { type: "rerank", objective: "answer_with_supported_evidence" }
  if (retrievalQuality === "irrelevant" && !hasTriedAction(state, "query_rewrite")) {
    return {
      type: "query_rewrite",
      strategy: state.searchPlan.complexity === "ambiguous" ? "entity" : "keyword",
      input: state.normalizedQuery ?? state.question
    }
  }
  if (conflictingFactIds.length > 0 || retrievalQuality === "conflicting") {
    const conflictingDescriptions = state.searchPlan.requiredFacts
      .filter((fact) => conflictingFactIds.includes(fact.id))
      .map((fact) => fact.description)
      .slice(0, ragRuntimePolicy.limits.actionFactLimit)
    return {
      type: "evidence_search",
      query: [...new Set([state.normalizedQuery ?? state.question, ...conflictingDescriptions, "現行 最新 施行日 適用条件 旧制度"])].join(" "),
      topK: state.topK
    }
  }

  const expandableChunkKey = firstExpandableChunkKey(state, supportedFactIds)
  if (expandableChunkKey) {
    return {
      type: "expand_context",
      chunkKey: expandableChunkKey,
      window: 1
    }
  }

  const missingDescriptions = state.searchPlan.requiredFacts
    .filter((fact) => missingFactIds.includes(fact.id))
    .map((fact) => fact.description)
    .slice(0, ragRuntimePolicy.limits.actionFactLimit)
  const queryParts = [state.normalizedQuery ?? state.question, ...missingDescriptions].filter(Boolean)
  return {
    type: "evidence_search",
    query: [...new Set(queryParts)].join(" "),
    topK: state.topK
  }
}

function hasTriedAction(state: QaAgentState, type: RetrievalEvaluation["nextAction"]["type"]): boolean {
  return state.actionHistory.some((observation) => observation.action.type === type)
}

function firstExpandableChunkKey(state: QaAgentState, supportedFactIds: string[]): string | undefined {
  if (supportedFactIds.length === 0) return undefined
  const expandedKeys = new Set(
    state.actionHistory
      .map((observation) => observation.action)
      .filter((action): action is Extract<RetrievalEvaluation["nextAction"], { type: "expand_context" }> => action.type === "expand_context")
      .map((action) => action.chunkKey)
  )
  const candidateKeys = state.searchPlan.requiredFacts
    .filter((fact) => supportedFactIds.includes(fact.id))
    .flatMap((fact) => fact.supportingChunkKeys)
  return candidateKeys.find((key) => !expandedKeys.has(key))
}

function buildReason(
  state: QaAgentState,
  retrievalQuality: RetrievalEvaluation["retrievalQuality"],
  topScore: number,
  missingFactIds: string[],
  conflictingFactIds: string[],
  riskSignals: RetrievalRiskSignal[]
): string {
  if (retrievalQuality === "sufficient") return "必要事実が検索済み evidence chunk で支持されているため、rerank に進みます。"
  if (conflictingFactIds.length > 0) {
    const values = riskSignals.flatMap((signal) => signal.values ?? []).slice(0, ragRuntimePolicy.limits.riskSignalValueLimit)
    const valueNote = values.length > 0 ? ` values=${values.join(", ")}` : ""
    return `同一 fact の値が食い違う候補があるため、現行条件と適用範囲を確認する追加 evidence search を試みます: ${conflictingFactIds.join(", ")}${valueNote}`
  }
  if (retrievalQuality === "irrelevant") {
    if (state.retrievedChunks.length === 0) return "検索結果がないため、追加 evidence search を試みます。"
    return `topScore=${topScore.toFixed(4)} が minTopScore=${state.searchPlan.stopCriteria.minTopScore} を下回るため、追加 evidence search を試みます。`
  }
  return `不足している必要事実があります: ${missingFactIds.join(", ")}`
}

function supportsFact(fact: string, text: string): boolean {
  const terms = significantTerms(fact)
  const normalizedText = normalize(text)
  if (terms.length === 0 || terms.every(isGenericSingleFactTerm)) return false
  if (requiresValueAnchor(fact) && !hasValueAnchor(text)) return false
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
  return ["回答", "質問"].includes(term)
}

function isGenericSingleFactTerm(term: string): boolean {
  return ["資料", "方法", "手順", "条件", "期限"].includes(term)
}

function requiresValueAnchor(fact: string): boolean {
  return /期限|期日|締切|締め切り/.test(fact.normalize("NFKC"))
}

function hasValueAnchor(text: string): boolean {
  return /(\d+\s*(?:営業日|日|週間|週|か月|ヶ月|月|年|時間|分)|翌月|当月|月末|月初|末日|以内|まで|\d{4}[-/年]\d{1,2}(?:[-/月]\d{1,2}日?)?)/u.test(
    text.normalize("NFKC")
  )
}

function detectValueMismatch(fact: RequiredFact, chunks: RetrievedVector[]): RetrievalRiskSignal[] {
  if (chunks.length < 2) return []

  const claims = chunks.flatMap((chunk) => extractFactClaims(fact.description, chunk))
  const values = [...new Map(claims.map((claim) => [claim.normalizedValue, claim.value] as const)).values()]
  if (values.length < 2) return []

  return [
    {
      type: "value_mismatch",
      factId: fact.id,
      chunkKeys: [...new Set(claims.map((claim) => claim.chunkKey))],
      values,
      reason: `同一 fact に対して複数の排他的な値候補が見つかりました: ${values.join(", ")}`
    }
  ]
}

type FactClaim = {
  chunkKey: string
  value: string
  normalizedValue: string
}

function extractFactClaims(fact: string, chunk: RetrievedVector): FactClaim[] {
  const kind = factValueKind(fact)
  if (!kind) return []

  const sentences = splitSentences(chunk.metadata.text ?? "")
  return sentences.flatMap((sentence) => {
    if (!supportsFact(fact, sentence)) return []
    return extractValues(kind, sentence).map((value) => ({
      chunkKey: chunk.key,
      value,
      normalizedValue: normalizeValue(value)
    }))
  })
}

function factValueKind(fact: string): "deadline" | "money" | undefined {
  const normalized = fact.normalize("NFKC")
  if (/期限|期日|締切|締め切り/.test(normalized)) return "deadline"
  if (/金額|費用|料金|価格|単価|上限|下限|円/.test(normalized)) return "money"
  return undefined
}

function extractValues(kind: "deadline" | "money", sentence: string): string[] {
  const normalized = sentence.normalize("NFKC")
  const matches =
    kind === "deadline"
      ? (normalized.match(/(?:翌月|当月|前月)?\s*\d+\s*(?:営業日|日)|\d+\s*(?:営業日|日|週間|週|か月|ヶ月|月|年|時間|分)\s*以内|月末|月初|末日|\d{4}[-/年]\d{1,2}(?:[-/月]\d{1,2}日?)?/gu) ?? [])
      : (normalized.match(/\d[\d,]*(?:\.\d+)?\s*(?:円|万円|千円|USD|ドル)/giu) ?? [])
  return [...new Set(matches.map((match) => match.trim()).filter(Boolean))]
}

function splitSentences(text: string): string[] {
  return text
    .normalize("NFKC")
    .split(/(?<=[。！？!?])|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function normalizeValue(value: string): string {
  return value.normalize("NFKC").replace(/[\s,]/g, "").toLowerCase()
}

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
}

function validIds(ids: string[], validIdsSet: Set<string>, byChunkId: Map<string | undefined, string>): string[] {
  return [...new Set(ids.map((id) => byChunkId.get(id) ?? id).filter((id) => validIdsSet.has(id)))]
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, "").toLowerCase()
}
