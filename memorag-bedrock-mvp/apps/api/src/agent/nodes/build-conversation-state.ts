import type { QaAgentState, QaAgentUpdate } from "../state.js"

const FOLLOW_UP_CUE = /^(その|それ|これ|あれ|上記|前述|同じ|では|じゃあ|あと|例外|期限|条件|手順|2つ目|二つ目|比較|違い|差分|what about|how about|and |then |that |those |it |they )/iu

export async function buildConversationState(state: QaAgentState): Promise<QaAgentUpdate> {
  const conversation = state.conversation
  const turns = conversation?.turns ?? state.conversationHistory
  const previousUserTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.text.trim()).filter(Boolean)
  const informativeAssistantTurns = turns
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.text.trim())
    .filter((text) => text && !isGenericAssistantText(text))
  const citations = turns.flatMap((turn) => "citations" in turn
    ? (turn.citations ?? []) as Array<{ documentId?: string; fileName?: string; chunkId?: string; pageStart?: number; pageEnd?: number }>
    : [])
  const previousCitations = uniqueCitations(citations).slice(0, 12)
  const activeDocuments = unique([
    ...(conversation?.state?.activeDocuments ?? []),
    ...citations.flatMap((citation) => [citation.documentId, citation.fileName]).filter((value): value is string => Boolean(value))
  ]).slice(0, 8)
  const activeTopics = unique([
    ...(conversation?.state?.activeTopics ?? []),
    ...previousUserTurns.slice(-2).map(extractTopic).filter(Boolean),
    ...informativeAssistantTurns.slice(-1).map(extractTopic).filter(Boolean)
  ]).slice(0, 6)
  const activeEntities = unique([
    ...(conversation?.state?.activeEntities ?? []),
    ...turns
      .filter((turn) => turn.role === "user" || !isGenericAssistantText(turn.text))
      .flatMap((turn) => extractEntities(turn.text))
  ]).slice(0, 12)
  const turnDependency = inferTurnDependency(state.question, turns.length, conversation?.turnDependency)

  return {
    conversationState: {
      conversationId: conversation?.conversationId,
      turnId: conversation?.turnId,
      turnIndex: conversation?.turnIndex,
      activeEntities,
      activeDocuments,
      activeTopics,
      constraints: unique(conversation?.state?.constraints ?? []).slice(0, 6),
      previousCitations,
      previousCitationCount: citations.length,
      turnDependency
    }
  }
}

export async function decontextualizeQuery(state: QaAgentState): Promise<QaAgentUpdate> {
  const question = state.question.trim().replace(/\s+/g, " ")
  const conversationState = state.conversationState
  const topicPrefix = unique([
    ...(conversationState?.activeTopics ?? []),
    ...(conversationState?.activeEntities ?? [])
  ].map((item) => item.trim()).filter(Boolean)).slice(0, 4).join(" ")
  const isDependent = conversationState?.turnDependency && conversationState.turnDependency !== "standalone"
  const standaloneQuestion = isDependent && topicPrefix ? buildStandaloneQuestion(question, topicPrefix) : question
  const retrievalQueries = unique([
    standaloneQuestion,
    question,
    ...(conversationState?.activeDocuments ?? []).slice(0, 3).map((document) => `${standaloneQuestion} ${document}`),
    ...(conversationState?.activeEntities ?? []).slice(0, 4).map((entity) => `${standaloneQuestion} ${entity}`),
    ...(conversationState?.previousCitations ?? []).slice(0, 3).flatMap((citation) => {
      const anchors = [citation.fileName, citation.documentId, citation.chunkId].filter((value): value is string => Boolean(value))
      return anchors.map((anchor) => `${standaloneQuestion} ${anchor}`)
    })
  ]).slice(0, 8)

  return {
    decontextualizedQuery: {
      standaloneQuestion,
      retrievalQueries,
      carriedEntities: conversationState?.activeEntities ?? [],
      carriedDocuments: conversationState?.activeDocuments ?? [],
      turnDependency: conversationState?.turnDependency ?? "standalone",
      shouldUsePreviousCitations: (conversationState?.previousCitationCount ?? 0) > 0
    }
  }
}

function inferTurnDependency(question: string, historyCount: number, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim()
  if (historyCount === 0) return "standalone"
  const normalized = question.trim()
  if (FOLLOW_UP_CUE.test(normalized)) return "coreference"
  if (/比較|違い|差分|compare|difference/i.test(normalized)) return "comparison"
  if (/例外|条件|それ|これ|その|that|those|it/i.test(normalized)) return "ellipsis"
  return "standalone"
}

function extractTopic(text: string): string {
  const normalized = text
    .replace(/[?？。.!！]/g, "")
    .trim()
  if (/[A-Za-z]/.test(normalized)) return extractEnglishTopic(normalized).slice(0, 80)
  return normalized.replace(/(について|教えて|ください|ですか|ますか|とは|は|を).*/u, "").trim().slice(0, 80)
}

function extractEntities(text: string): string[] {
  const normalized = text.normalize("NFKC")
  const ascii = normalized.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}(?:規程|制度|申請|期限|条件|例外|手当|精算|承認)?/gu) ?? []
  return unique([...ascii, ...japanese].map((item) => item.trim()).filter(isUsefulEntity)).slice(0, 8)
}

function buildStandaloneQuestion(question: string, topicPrefix: string): string {
  const followUp = question.match(/^(?:what|how)\s+about\s+(.+?)\??$/iu)
  if (followUp?.[1]) return `${followUp[1].trim()} ${topicPrefix} ${question}`.trim()
  return `${topicPrefix} ${question}`.trim()
}

function extractEnglishTopic(text: string): string {
  const normalized = text
    .replace(/\b(?:who|what|when|where|which|how|why)\b/giu, " ")
    .replace(/\b(?:can|could|should|would|do|does|did|is|are|was|were|the|a|an|about)\b/giu, " ")
    .replace(/\b(?:request|need|needs|required|require|requires|issued|tell|show|explain)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
  return normalized || text
}

function isUsefulEntity(item: string): boolean {
  if (item.length < 2) return false
  const normalized = item.normalize("NFKC").toLowerCase()
  return !ENGLISH_ENTITY_STOP_WORDS.has(normalized) && !JAPANESE_ENTITY_STOP_WORDS.has(item.normalize("NFKC"))
}

function isGenericAssistantText(text: string): boolean {
  const normalized = text.normalize("NFKC").trim().toLowerCase()
  if (!normalized) return true
  if (/資料からは?回答できません|回答できません|noanswer|cannot answer|can't answer/.test(normalized)) return true
  return false
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function uniqueCitations(citations: Array<{ documentId?: string; fileName?: string; chunkId?: string; pageStart?: number; pageEnd?: number }>) {
  const seen = new Set<string>()
  const result: Array<{ documentId?: string; fileName?: string; chunkId?: string; pageStart?: number; pageEnd?: number }> = []
  for (const citation of citations) {
    if (!citation.documentId && !citation.fileName && !citation.chunkId) continue
    const key = [citation.documentId, citation.fileName, citation.chunkId, citation.pageStart, citation.pageEnd].join(":")
    if (seen.has(key)) continue
    seen.add(key)
    result.push({
      documentId: citation.documentId,
      fileName: citation.fileName,
      chunkId: citation.chunkId,
      pageStart: citation.pageStart,
      pageEnd: citation.pageEnd
    })
  }
  return result
}

const ENGLISH_ENTITY_STOP_WORDS = new Set([
  "and",
  "are",
  "about",
  "can",
  "could",
  "did",
  "does",
  "how",
  "need",
  "needs",
  "request",
  "required",
  "requires",
  "should",
  "that",
  "the",
  "then",
  "they",
  "those",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "would"
])

const JAPANESE_ENTITY_STOP_WORDS = new Set(["資料", "回答"])
