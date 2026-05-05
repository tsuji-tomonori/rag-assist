import type { RetrievedVector } from "../../types.js"
import type { Clarification, ClarificationOption, QaAgentState, QaAgentUpdate } from "../state.js"

const referencePattern = /(それ|これ|上記|前述|この件|その件)/
const genericTerms = ["期限", "条件", "手順", "方法", "対象", "申請", "利用", "設定", "削除", "費用", "権限"]
const slotByTerm = new Map([
  ["期限", "対象"],
  ["条件", "対象"],
  ["手順", "対象"],
  ["方法", "対象"],
  ["対象", "適用範囲"],
  ["申請", "申請種別"],
  ["利用", "対象サービス"],
  ["設定", "対象機能"],
  ["削除", "対象データ"],
  ["費用", "対象サービス"],
  ["権限", "対象ロール"]
])
const privateAsciiLabelPattern = /\b(acl|tenant|tenantid|allowed[-_\s]?users|internal[-_\s]?alias)\b/i
const privateJapaneseLabelPattern = /(内部alias|内部エイリアス|非公開|機密)/i

export async function clarificationGate(state: QaAgentState): Promise<QaAgentUpdate> {
  const query = (state.normalizedQuery ?? state.question).trim()
  const candidates = buildOptions(state, query)
  const score = scoreAmbiguity(state, query, candidates.options.length)
  const reason = inferReason(state, query, candidates.options.length)
  const notClearlyUnanswerable = hasCandidateEvidence(state)
  const hasSearchedEvidence = state.actionHistory.length > 0 || state.retrievedChunks.length > 0
  const canAskBeforeSearch = reason === "unresolved_reference"
  const needsClarification =
    score >= 0.65 &&
    candidates.options.length >= 2 &&
    notClearlyUnanswerable &&
    (hasSearchedEvidence || canAskBeforeSearch) &&
    !hasSufficientSupportedEvidence(state, query) &&
    !hasExplicitQuestionScope(query, state) &&
    reason !== "not_needed"

  const clarification: Clarification = {
    needsClarification,
    reason: needsClarification ? reason : "not_needed",
    question: needsClarification ? buildQuestion(query, candidates.missingSlots) : "",
    options: needsClarification ? candidates.options.slice(0, 5) : [],
    missingSlots: needsClarification ? candidates.missingSlots : [],
    confidence: needsClarification ? Math.min(0.95, Math.max(0.55, score)) : Math.min(0.49, score),
    ambiguityScore: score,
    groundedOptionCount: candidates.options.length,
    rejectedOptions: candidates.rejectedOptions
  }

  return { clarification }
}

function scoreAmbiguity(state: QaAgentState, query: string, optionCount: number): number {
  const clusterEntropy = optionCount >= 3 ? 1 : optionCount === 2 ? 0.82 : 0
  const topClusterMargin = computeTopClusterMargin([...state.memoryCards, ...state.retrievedChunks])
  const missingSlotScore = hasGenericScopeNeed(query) && !hasSpecificTarget(query, state) ? 1 : 0
  const unresolvedReferenceScore = referencePattern.test(query) && state.resolvedReferences.length === 0 ? 1 : 0
  const conflictScopeScore = state.retrievalEvaluation.conflictingFactIds.length > 0 ? 1 : 0
  const genericQueryScore = significantTerms(query).length <= 2 && hasGenericScopeNeed(query) ? 1 : 0

  return clamp(
    0.25 * clusterEntropy +
      0.2 * (1 - topClusterMargin) +
      0.2 * missingSlotScore +
      0.15 * unresolvedReferenceScore +
      0.1 * conflictScopeScore +
      0.1 * genericQueryScore
  )
}

function inferReason(
  state: QaAgentState,
  query: string,
  optionCount: number
): Clarification["reason"] {
  if (referencePattern.test(query) && state.resolvedReferences.length === 0) return "unresolved_reference"
  if (state.retrievalEvaluation.conflictingFactIds.length > 0 && optionCount >= 2) return "conflicting_scope"
  if (hasGenericScopeNeed(query) && optionCount >= 2) return "multiple_candidate_intents"
  if (hasGenericScopeNeed(query)) return "missing_scope"
  return "not_needed"
}

function buildOptions(
  state: QaAgentState,
  query: string
): { options: ClarificationOption[]; missingSlots: string[]; rejectedOptions: string[] } {
  const rejectedOptions: string[] = []
  const byLabel = new Map<string, ClarificationOption>()
  const records: Array<{ hit: RetrievedVector; source: ClarificationOption["source"] }> = [
    ...state.memoryCards.map((hit) => ({ hit, source: "memory" as const })),
    ...state.retrievedChunks.map((hit) => ({ hit, source: "evidence" as const }))
  ]

  for (const { hit, source } of records) {
    const label = selectPublicLabel(hit, query)
    if (!label) {
      rejectedOptions.push(hit.metadata.fileName || hit.key)
      continue
    }
    if (query.includes(label)) continue
    const existing = byLabel.get(label)
    const grounding = {
      documentId: hit.metadata.documentId,
      fileName: hit.metadata.fileName,
      chunkId: hit.metadata.chunkId,
      heading: hit.metadata.heading ?? hit.metadata.sectionPath?.at(-1)
    }
    const option: ClarificationOption = {
      id: `opt-${byLabel.size + 1}`,
      label,
      resolvedQuery: buildResolvedQuery(query, label),
      reason: `${source === "memory" ? "memory card" : "検索候補"}に根拠があります。`,
      source,
      grounding: [grounding]
    }
    if (existing) {
      existing.grounding = [...existing.grounding, grounding].slice(0, 3)
      continue
    }
    byLabel.set(label, option)
  }

  const options = [...byLabel.values()]
    .filter((option) => option.grounding.length > 0)
    .slice(0, 5)
    .map((option, index) => ({ ...option, id: `opt-${index + 1}` }))

  return {
    options,
    missingSlots: inferMissingSlots(query),
    rejectedOptions: rejectedOptions.slice(0, 8)
  }
}

function selectPublicLabel(hit: RetrievedVector, query: string): string | undefined {
  const text = [
    hit.metadata.heading,
    ...(hit.metadata.sectionPath ?? []),
    hit.metadata.text,
    hit.metadata.fileName.replace(/\.[^.]+$/, "")
  ]
    .filter(Boolean)
    .join("\n")
  if (isPrivateLabel(text)) return undefined
  const terms = significantTerms(text).filter((term) => !genericTerms.includes(term) && !isPrivateLabel(term))
  const queryTerms = significantTerms(query)
  const scoped = terms.find((term) => queryTerms.some((queryTerm) => text.includes(`${term}${queryTerm}`) || text.includes(`${term}の${queryTerm}`)))
  const label = scoped ?? terms[0]
  if (!label || isPrivateLabel(label)) return undefined
  return label.slice(0, 40)
}

function isPrivateLabel(value: string): boolean {
  return privateAsciiLabelPattern.test(value) || privateJapaneseLabelPattern.test(value)
}

function buildResolvedQuery(query: string, label: string): string {
  const normalized = query.replace(referencePattern, label)
  if (normalized !== query) return normalized
  if (/^(期限|条件|手順|方法|対象|申請|費用|権限)/.test(query)) return `${label}の${query}`
  return query.includes(label) ? query : `${label}について、${query}`
}

function buildQuestion(query: string, missingSlots: string[]): string {
  const slot = missingSlots[0] ?? "対象"
  if (/期限/.test(query)) return `どの${slot}の期限を確認しますか？`
  if (/手順|方法/.test(query)) return `どの${slot}の手順を確認しますか？`
  if (/条件|対象|利用/.test(query)) return `どの${slot}について確認しますか？`
  return `どの${slot}について確認しますか？`
}

function inferMissingSlots(query: string): string[] {
  if (/申請/.test(query) && /期限|条件|手順|方法|対象/.test(query)) return ["申請種別"]
  const slots = genericTerms
    .filter((term) => query.includes(term))
    .map((term) => slotByTerm.get(term) ?? "対象")
  return [...new Set(slots.length > 0 ? slots : ["対象"])].slice(0, 3)
}

function hasCandidateEvidence(state: QaAgentState): boolean {
  return state.memoryCards.length + state.retrievedChunks.length > 0
}

function hasSufficientSupportedEvidence(state: QaAgentState, query: string): boolean {
  return (
    hasSpecificSubjectCue(query) &&
    state.retrievalEvaluation.retrievalQuality === "sufficient" &&
    state.retrievalEvaluation.missingFactIds.length === 0 &&
    state.retrievalEvaluation.conflictingFactIds.length === 0 &&
    state.retrievalEvaluation.supportedFactIds.length > 0
  )
}

function hasSpecificSubjectCue(query: string): boolean {
  return significantTerms(query)
    .filter((term) => !genericTerms.includes(term) && !isQuestionIntentTerm(term) && !isGenericCompoundTerm(term))
    .some((term) => term.length >= 2)
}

function hasExplicitQuestionScope(query: string, state: QaAgentState): boolean {
  if (!hasGenericScopeNeed(query) || referencePattern.test(query)) return false
  const queryTerms = significantTerms(query).filter((term) => !genericTerms.includes(term) && !isQuestionIntentTerm(term))
  if (queryTerms.length === 0) return false

  const labels = [...state.memoryCards, ...state.retrievedChunks]
    .map((hit) => selectPublicLabel(hit, query))
    .filter((label): label is string => Boolean(label))

  if (labels.some((label) => query.includes(label))) return true
  return queryTerms.some((term) => labels.some((label) => label.includes(term) || term.includes(label)))
}

function hasGenericScopeNeed(query: string): boolean {
  return genericTerms.some((term) => query.includes(term)) || referencePattern.test(query)
}

function hasSpecificTarget(query: string, state: QaAgentState): boolean {
  const labels = [...state.memoryCards, ...state.retrievedChunks]
    .map((hit) => selectPublicLabel(hit, query))
    .filter((label): label is string => Boolean(label))
  return labels.some((label) => query.includes(label))
}

function computeTopClusterMargin(hits: RetrievedVector[]): number {
  const scores = hits
    .filter((hit) => hit.score > 0)
    .map((hit) => hit.score)
    .sort((a, b) => b - a)
  if (scores.length < 2) return 1
  const [first, second] = scores
  return clamp(Math.abs((first ?? 0) - (second ?? 0)))
}

function significantTerms(text: string): string[] {
  const normalized = text.normalize("NFKC")
  const ascii = normalized.match(/[A-Za-z0-9][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu) ?? []
  return [...new Set([...japanese, ...ascii].map((term) => term.trim()).filter((term) => !isStopTerm(term)))]
}

function isStopTerm(term: string): boolean {
  return ["こと", "もの", "ため", "場合", "資料", "文書", "社内", "確認", "回答", "情報"].includes(term)
}

function isQuestionIntentTerm(term: string): boolean {
  return ["何日", "何日前", "いつ", "どこ", "誰", "部署", "必要", "対象", "条件", "期限", "方法", "手順"].includes(term)
}

function isGenericCompoundTerm(term: string): boolean {
  return /^(申請期限|提出期限|取得期限|キャンセル期限|対象家族|適用範囲|申請種別)$/.test(term)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))))
}
