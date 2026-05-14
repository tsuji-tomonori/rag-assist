import type { RetrievedVector } from "../../types.js"
import type { Dependencies } from "../../dependencies.js"
import { parseJsonObject } from "../../rag/json.js"
import { buildRetrievalJudgePrompt } from "../../rag/prompts.js"
import { llmOptions, ragRuntimePolicy } from "../runtime-policy.js"
import { isPrimaryRequiredFact, type Claim, type ConflictCandidate, type ChatOrchestrationState, type ChatOrchestrationUpdate, type RequiredFact, type RetrievalEvaluation, type RetrievalLlmJudge, type RetrievalRiskSignal } from "../state.js"

type RetrievalJudgeJson = Partial<RetrievalLlmJudge>

export function createRetrievalEvaluatorNode(deps: Dependencies) {
  return async function retrievalEvaluatorWithJudge(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
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

export async function retrievalEvaluator(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const topScore = state.retrievedChunks[0]?.score ?? 0
  const facts = state.searchPlan.requiredFacts.length > 0 ? state.searchPlan.requiredFacts : fallbackFacts(state.question)
  const factAssessments = facts.map((fact) => assessFact(fact, state.retrievedChunks, state.searchPlan.stopCriteria.minTopScore))
  const supportedFactIds = factAssessments.filter((assessment) => assessment.status === "supported").map((assessment) => assessment.fact.id)
  const missingFactIds = factAssessments.filter((assessment) => assessment.status === "missing").map((assessment) => assessment.fact.id)
  const conflictingFactIds = factAssessments.filter((assessment) => assessment.status === "conflicting").map((assessment) => assessment.fact.id)
  const primaryMissingFactIds = primaryFactIds(facts, missingFactIds)
  const primaryConflictingFactIds = primaryFactIds(facts, conflictingFactIds)
  const riskSignals = factAssessments.flatMap((assessment) => assessment.riskSignals)
  const claims = factAssessments.flatMap((assessment) => assessment.claims)
  const conflictCandidates = factAssessments.flatMap((assessment) => assessment.conflictCandidates)
  const retrievalQuality = classifyRetrieval(state, topScore, primaryMissingFactIds, primaryConflictingFactIds)
  const nextAction = chooseNextAction(state, retrievalQuality, supportedFactIds, primaryMissingFactIds, primaryConflictingFactIds)
  const supportingChunkKeysByFact = new Map(
    factAssessments.map((assessment) => [assessment.fact.id, assessment.supportingChunkKeys] as const)
  )

  const retrievalEvaluation: RetrievalEvaluation = {
    retrievalQuality,
    missingFactIds,
    conflictingFactIds,
    supportedFactIds,
    riskSignals,
    claims,
    conflictCandidates,
    nextAction,
    reason: buildReason(state, retrievalQuality, topScore, primaryMissingFactIds, primaryConflictingFactIds, riskSignals)
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
  state: ChatOrchestrationState,
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

function applyRetrievalJudge(state: ChatOrchestrationState, update: ChatOrchestrationUpdate, judge: RetrievalLlmJudge): ChatOrchestrationUpdate {
  const evaluation = update.retrievalEvaluation
  const searchPlan = update.searchPlan
  if (!evaluation || !searchPlan) return update

  if (judge.label === "NO_CONFLICT" && judge.confidence >= ragRuntimePolicy.confidence.llmJudgeNoConflictMin) {
    const resolvedFactIds = new Set(judge.factIds.length > 0 ? judge.factIds : evaluation.conflictingFactIds)
    const conflictingFactIds = evaluation.conflictingFactIds.filter((factId) => !resolvedFactIds.has(factId))
    const supportedFactIds = [...new Set([...evaluation.supportedFactIds, ...resolvedFactIds])]
    const primaryMissingFactIds = primaryFactIds(searchPlan.requiredFacts, evaluation.missingFactIds)
    const primaryConflictingFactIds = primaryFactIds(searchPlan.requiredFacts, conflictingFactIds)
    const retrievalQuality = primaryConflictingFactIds.length === 0 && primaryMissingFactIds.length === 0 ? "sufficient" : primaryConflictingFactIds.length > 0 ? "conflicting" : "partial"
    const nextAction =
      retrievalQuality === "sufficient"
        ? { type: "rerank" as const, objective: "answer_with_supported_evidence" }
        : chooseNextAction(state, retrievalQuality, supportedFactIds, primaryMissingFactIds, primaryConflictingFactIds)

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
  claims: Claim[]
  conflictCandidates: ConflictCandidate[]
}

function fallbackFacts(question: string): RequiredFact[] {
  return [
    {
      id: "fact-1",
      description: question,
      necessity: "primary",
      priority: 1,
      status: "missing",
      supportingChunkKeys: []
    }
  ]
}

function primaryFactIds(facts: RequiredFact[], factIds: string[]): string[] {
  if (factIds.length === 0) return []
  const factsById = new Map(facts.map((fact) => [fact.id, fact]))
  return factIds.filter((factId) => {
    const fact = factsById.get(factId)
    return !fact || isPrimaryRequiredFact(fact)
  })
}

function assessFact(fact: RequiredFact, chunks: RetrievedVector[], minFactSupportScore: number): FactAssessment {
  const supportingChunks = chunks.filter((chunk) => chunk.score >= minFactSupportScore && supportsFact(fact, chunk.metadata.text ?? ""))
  const supportingChunkKeys = supportingChunks.map((chunk) => chunk.key)
  const { riskSignals, claims, conflictCandidates } = detectValueMismatch(fact, supportingChunks)
  return {
    fact,
    status: riskSignals.length > 0 ? "conflicting" : supportingChunkKeys.length > 0 ? "supported" : "missing",
    supportingChunkKeys,
    riskSignals,
    claims,
    conflictCandidates
  }
}

function classifyRetrieval(
  state: ChatOrchestrationState,
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
  state: ChatOrchestrationState,
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

function hasTriedAction(state: ChatOrchestrationState, type: RetrievalEvaluation["nextAction"]["type"]): boolean {
  return state.actionHistory.some((observation) => observation.action.type === type)
}

function firstExpandableChunkKey(state: ChatOrchestrationState, supportedFactIds: string[]): string | undefined {
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
  state: ChatOrchestrationState,
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

function supportsFact(fact: RequiredFact | string, text: string): boolean {
  const terms = factSupportTerms(fact)
  const normalizedText = normalize(text)
  if (!hasFactTypeAnchor(fact, text)) return false
  if (terms.length === 0 || terms.every(isGenericSingleFactTerm)) return hasStandaloneFactTypeSupport(fact, text)
  const matched = terms.filter((term) => normalizedText.includes(normalize(term))).length
  if (terms.length === 1) return matched === 1
  return matched >= Math.min(2, terms.length)
}

function factSupportTerms(fact: RequiredFact | string): string[] {
  const source = typeof fact === "string" ? fact : fact.subject ?? fact.description
  const stripped = stripFactFacets(source)
  const strippedTerms = significantTerms(stripped)
  if (strippedTerms.length > 0 && !strippedTerms.every(isGenericSingleFactTerm)) return strippedTerms
  return significantTerms(source)
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
  return ["資料", "方法", "手順", "条件", "期限", "金額", "担当", "分類", "制度", "申請"].includes(term)
}

function hasFactTypeAnchor(fact: RequiredFact | string, text: string): boolean {
  const factType = typeof fact === "string" ? undefined : fact.factType
  const haystack = `${typeof fact === "string" ? fact : fact.description}\n${text}`.normalize("NFKC")
  if (factType === "amount") return /\d[\d,]*(?:\.\d+)?\s*(?:円|万円|千円|USD|ドル)|金額|費用|料金|価格|単価|上限|下限/u.test(haystack)
  if (factType === "date" || factType === "duration") return hasValueAnchor(text) || /期限|期日|締切|締め切り|開始日|終了日|日付/u.test(haystack)
  if (factType === "count") return /\d+\s*(?:回|件|個|名|人)|毎月|毎年|週次|月次|年次|頻度/u.test(haystack)
  if (factType === "procedure") return /方法|手順|やり方|フロー|申請|提出|登録|設定|入力/u.test(haystack)
  if (factType === "person") return /担当|承認者|責任者|部署|報告先|依頼先|[一-龠ァ-ヶーA-Za-z0-9_-]+部/u.test(haystack)
  if (factType === "condition") return /条件|対象|例外|適用範囲/u.test(haystack)
  if (factType === "classification") return /分類|種類|区分/u.test(haystack)
  return !requiresValueAnchor(typeof fact === "string" ? fact : fact.description) || hasValueAnchor(text)
}

function hasStandaloneFactTypeSupport(fact: RequiredFact | string, text: string): boolean {
  const factType = typeof fact === "string" ? undefined : fact.factType
  if (factType === "amount") return /\d[\d,]*(?:\.\d+)?\s*(?:円|万円|千円|USD|ドル)/iu.test(text.normalize("NFKC"))
  if (factType === "date" || factType === "duration") return hasValueAnchor(text)
  if (factType === "procedure") return /方法|手順|やり方|フロー|申請|提出|登録|設定|入力/u.test(text.normalize("NFKC"))
  return false
}

function stripFactFacets(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/(現行|旧制度|新制度|最新版|現在|過去|[0-9０-９]{4}年)/gu, "")
    .replace(/(金額|費用|料金|価格|単価|上限|下限|いくら|期限|期日|締切|締め切り|開始日|終了日|日付|期間|日数|頻度|回数|方法|手順|やり方|フロー|申請|提出|担当|承認者|責任者|部署|報告先|依頼先|条件|対象|例外|適用範囲|分類|種類|区分)/gu, "")
    .replace(/(と|および|及び|かつ|または|又は|、|,|\/)+/gu, " ")
    .replace(/の\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
}

function requiresValueAnchor(fact: string): boolean {
  return /期限|期日|締切|締め切り/.test(fact.normalize("NFKC"))
}

function hasValueAnchor(text: string): boolean {
  return /(\d+\s*(?:営業日|日|週間|週|か月|ヶ月|月|年|時間|分)|翌月|当月|月末|月初|末日|以内|まで|\d{4}[-/年]\d{1,2}(?:[-/月]\d{1,2}日?)?)/u.test(
    text.normalize("NFKC")
  )
}

function detectValueMismatch(fact: RequiredFact, chunks: RetrievedVector[]): { riskSignals: RetrievalRiskSignal[]; claims: Claim[]; conflictCandidates: ConflictCandidate[] } {
  if (chunks.length < 2) return { riskSignals: [], claims: [], conflictCandidates: [] }

  const claims = chunks.flatMap((chunk) => extractFactClaims(fact, chunk))
  const groups = new Map<string, Claim[]>()
  const subjectPredicateGroups = new Map<string, Claim[]>()
  for (const claim of claims) {
    const key = [normalize(claim.subject), normalize(claim.predicate), normalize(claim.scope ?? "default")].join("|")
    groups.set(key, [...(groups.get(key) ?? []), claim])
    const subjectPredicateKey = [normalize(claim.subject), normalize(claim.predicate)].join("|")
    subjectPredicateGroups.set(subjectPredicateKey, [...(subjectPredicateGroups.get(subjectPredicateKey) ?? []), claim])
  }
  const conflictCandidates: ConflictCandidate[] = []
  const candidateKeys = new Set<string>()
  for (const group of groups.values()) {
    const values = [...new Map(group.map((claim) => [normalizeValue(claim.value), claim.value] as const)).values()]
    if (values.length < 2) continue
    const first = group[0]
    if (!first) continue
    const candidateKey = [normalize(first.subject), normalize(first.predicate), normalize(first.scope ?? "default")].join("|")
    candidateKeys.add(candidateKey)
    conflictCandidates.push({
      factId: fact.id,
      subject: first.subject,
      predicate: first.predicate,
      scope: first.scope,
      values,
      chunkKeys: [...new Set(group.map((claim) => claim.sourceChunkId))],
      reason: `同一 subject/predicate/scope の typed claim に排他的な値があります: ${values.join(", ")}`
    })
  }
  for (const group of subjectPredicateGroups.values()) {
    const hasUnscoped = group.some((claim) => !claim.scope)
    const scopedClaims = group.filter((claim) => claim.scope)
    if (!hasUnscoped || scopedClaims.length === 0) continue
    const values = [...new Map(group.map((claim) => [normalizeValue(claim.value), claim.value] as const)).values()]
    if (values.length < 2) continue
    const first = group[0]
    if (!first) continue
    const candidateKey = [normalize(first.subject), normalize(first.predicate), "uncertain"].join("|")
    if (candidateKeys.has(candidateKey)) continue
    candidateKeys.add(candidateKey)
    conflictCandidates.push({
      factId: fact.id,
      subject: first.subject,
      predicate: first.predicate,
      scope: "uncertain",
      values,
      chunkKeys: [...new Set(group.map((claim) => claim.sourceChunkId))],
      reason: `scope なし claim と明示 scope claim に値違いがあります。追加確認が必要です: ${values.join(", ")}`
    })
  }
  if (conflictCandidates.length === 0) return { riskSignals: [], claims, conflictCandidates }

  const riskSignals = conflictCandidates.map((candidate): RetrievalRiskSignal => ({
      type: candidate.scope === "uncertain" ? "uncertain_scope_conflict" : "typed_claim_conflict",
      factId: fact.id,
      chunkKeys: candidate.chunkKeys,
      values: candidate.values,
      claims: claims.filter((claim) => candidate.chunkKeys.includes(claim.sourceChunkId)),
      conflictCandidate: candidate,
      reason: candidate.reason
    }))
  return { riskSignals, claims, conflictCandidates }
}

function extractFactClaims(fact: RequiredFact, chunk: RetrievedVector): Claim[] {
  const kinds = factValueKinds(fact)
  if (kinds.length === 0) return []

  const sentences = splitSentences(chunk.metadata.text ?? "")
  return sentences.flatMap((sentence) => {
    if (!supportsFact(fact, sentence)) return []
    return kinds.flatMap((kind) =>
      extractValues(kind, sentence).map((value) => ({
        subject: inferClaimSubject(fact, sentence),
        predicate: kind,
        value,
        valueType: kind,
        unit: inferClaimUnit(value),
        scope: inferClaimScope(sentence),
        effectiveDate: inferEffectiveDate(sentence),
        sourceChunkId: chunk.key,
        sentence
      }))
    )
  })
}

function factValueKinds(fact: RequiredFact | string): Claim["valueType"][] {
  const factType = typeof fact === "string" ? undefined : fact.factType
  const normalized = (typeof fact === "string" ? fact : `${fact.description} ${fact.expectedValueType ?? ""}`).normalize("NFKC")
  const kinds: Claim["valueType"][] = []
  if (factType === "amount") kinds.push("money")
  if (factType === "date") kinds.push("date")
  if (factType === "duration") kinds.push("duration", "date")
  if (factType === "count") kinds.push("count")
  if (factType === "status") kinds.push("status")
  if (factType === "version") kinds.push("version")
  if (factType === "condition") kinds.push("condition")
  if (/期限|期日|締切|締め切り|開始日|終了日|日付/.test(normalized)) kinds.push("date")
  if (/金額|費用|料金|価格|単価|上限|下限|いくら|(?:\d[\d,]*(?:\.\d+)?|[一二三四五六七八九十百千万億兆]+)\s*(?:円|万円|千円)/.test(normalized)) kinds.push("money")
  if (/期間|日数|何日|何営業日/.test(normalized)) kinds.push("duration")
  if (/回数|頻度|何回/.test(normalized)) kinds.push("count")
  if (/状態|ステータス|有効|無効|現行/.test(normalized)) kinds.push("status")
  if (/版|バージョン|version/i.test(normalized)) kinds.push("version")
  if (/条件|対象|例外|適用範囲/.test(normalized)) kinds.push("condition")
  return [...new Set(kinds)]
}

function extractValues(kind: Claim["valueType"], sentence: string): string[] {
  const normalized = sentence.normalize("NFKC")
  const patterns: Record<Claim["valueType"], RegExp> = {
    date: /(?:翌月|当月|前月)?\s*\d+\s*(?:営業日|日)|月末|月初|末日|\d{4}[-/年]\d{1,2}(?:[-/月]\d{1,2}日?)?/gu,
    money: /\d[\d,]*(?:\.\d+)?\s*(?:円|万円|千円|USD|ドル)/giu,
    duration: /\d+\s*(?:営業日|日|週間|週|か月|ヶ月|月|年|時間|分)\s*(?:以内|以上|以下|未満)?/gu,
    count: /\d+\s*(?:回|件|個|名|人)|毎月|毎年|週次|月次|年次/gu,
    status: /(?:有効|無効|承認済み|未承認|現行|旧制度|廃止|停止中|利用可|利用不可)/gu,
    version: /v?\d+(?:\.\d+){1,3}|(?:第|ver\.?)\s*\d+\s*版/giu,
    condition: /(?:対象|条件|例外|適用範囲)[^。！？!?]{0,80}/gu
  }
  const matches = normalized.match(patterns[kind]) ?? []
  return [...new Set(matches.map((match) => match.trim()).filter(Boolean))]
}

function inferClaimSubject(fact: RequiredFact, sentence: string): string {
  const source = fact.subject ?? fact.description
  const subject = stripFactFacets(source) || source
  return (subject.match(/^[^はをの、。?？]{2,60}/u)?.[0] ?? sentence.slice(0, 40)).trim()
}

function inferClaimScope(sentence: string): string | undefined {
  return sentence.match(/現行|旧制度|新制度|最新版|現在|過去|[0-9０-９]{4}年|[A-Za-z0-9_-]+部/u)?.[0]
}

function inferEffectiveDate(sentence: string): string | undefined {
  return sentence.match(/\d{4}[-/年]\d{1,2}(?:[-/月]\d{1,2}日?)?/u)?.[0]
}

function inferClaimUnit(value: string): string | undefined {
  return value.match(/円|万円|千円|USD|ドル|営業日|日|週間|週|か月|ヶ月|月|年|時間|分|回|件|個|名|人/u)?.[0]
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
