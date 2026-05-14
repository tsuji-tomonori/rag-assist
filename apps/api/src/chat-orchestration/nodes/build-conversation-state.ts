import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"
import { buildSignalPhrase, extractSignalTerms } from "../text-signals.js"

const FOLLOW_UP_CUE = /^(その|それ|これ|あれ|上記|前述|同じ|では|じゃあ|あと|例外|期限|条件|手順|2つ目|二つ目|比較|違い|差分)/u

export async function buildConversationState(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const conversation = state.conversation
  const turns = conversation?.turns ?? state.conversationHistory
  const previousUserTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.text.trim()).filter(Boolean)
  const informativeAssistantTurns = turns
    .filter((turn) => turn.role === "assistant")
    .map((turn) => stripGenericAssistantPreamble(turn.text.trim()))
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
      .flatMap((turn) => extractEntities(turn.role === "assistant" ? stripGenericAssistantPreamble(turn.text) : turn.text))
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

export async function decontextualizeQuery(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const question = state.question.trim().replace(/\s+/g, " ")
  const conversationState = state.conversationState
  const topicPrefix = unique([
    ...(conversationState?.activeTopics ?? []),
    ...(conversationState?.activeEntities ?? [])
  ].map((item) => item.trim()).filter(Boolean)).slice(0, 4).join(" ")
  const isDependent = conversationState?.turnDependency && conversationState.turnDependency !== "standalone"
  const standaloneQuestion = isDependent && topicPrefix ? buildStandaloneQuestion(question, topicPrefix) : question
  const retrievalQueries = buildRetrievalQueries(question, standaloneQuestion, conversationState)

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

function buildRetrievalQueries(
  question: string,
  standaloneQuestion: string,
  conversationState: ChatOrchestrationState["conversationState"]
): string[] {
  if ((conversationState?.previousCitationCount ?? 0) > 0 && isCompactFollowUpQuestion(question)) {
    const citationAnchor = conversationState?.previousCitations
      ?.map((citation) => citation.fileName ?? citation.documentId ?? citation.chunkId)
      .find((value): value is string => Boolean(value))
    const documentAnchor = citationAnchor ?? conversationState?.activeDocuments?.[0]
    return unique([
      standaloneQuestion,
      question,
      ...(documentAnchor ? [`${standaloneQuestion} ${documentAnchor}`] : [])
    ]).slice(0, 3)
  }

  return unique([
    standaloneQuestion,
    question,
    ...(conversationState?.activeDocuments ?? []).slice(0, 3).map((document) => `${standaloneQuestion} ${document}`),
    ...(conversationState?.activeEntities ?? []).slice(0, 4).map((entity) => `${standaloneQuestion} ${entity}`),
    ...(conversationState?.previousCitations ?? []).slice(0, 3).flatMap((citation) => {
      const anchors = [citation.fileName, citation.documentId, citation.chunkId].filter((value): value is string => Boolean(value))
      return anchors.map((anchor) => `${standaloneQuestion} ${anchor}`)
    })
  ]).slice(0, 8)
}

function inferTurnDependency(question: string, historyCount: number, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim()
  if (historyCount === 0) return "standalone"
  const normalized = question.trim()
  if (FOLLOW_UP_CUE.test(normalized)) return "coreference"
  if (isShortFollowUpQuestion(normalized)) return "coreference"
  if (/比較|違い|差分|compare|difference/i.test(normalized)) return "comparison"
  if (/例外|条件|それ|これ|その|that|those|it/i.test(normalized)) return "ellipsis"
  return "standalone"
}

function isShortFollowUpQuestion(question: string): boolean {
  const tokens = question.normalize("NFKC").match(/[A-Za-z][A-Za-z0-9_-]*|[\p{Script=Han}\p{Script=Katakana}ー]{2,}|[\p{Script=Hiragana}]{3,}/gu) ?? []
  const signalCount = extractSignalTerms(question, 4).length
  return tokens.length > 0 && tokens.length <= 5 && signalCount > 0 && signalCount <= 2
}

function isCompactFollowUpQuestion(question: string): boolean {
  const normalized = question.trim()
  return isShortFollowUpQuestion(normalized) || FOLLOW_UP_CUE.test(normalized)
}

function extractTopic(text: string): string {
  const normalized = text
    .replace(/[?？。.!！]/g, "")
    .trim()
  const signalPhrase = buildSignalPhrase([normalized], normalized, 5)
  return signalPhrase.slice(0, 80)
}

function extractEntities(text: string): string[] {
  return extractSignalTerms(text, 8)
}

function buildStandaloneQuestion(question: string, topicPrefix: string): string {
  const subject = buildSignalPhrase([question], "", 4)
  const prefixes = unique([subject, topicPrefix].map((item) => item.trim()).filter(Boolean)).join(" ")
  return `${prefixes} ${question}`.trim()
}

function isGenericAssistantText(text: string): boolean {
  const normalized = text.normalize("NFKC").trim().toLowerCase()
  if (!normalized) return true
  if (/資料からは?回答できません|回答できません|noanswer|cannot answer|can't answer/.test(normalized)) return true
  return false
}

function stripGenericAssistantPreamble(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/^資料では次のように記載されています[。:：]?\s*/u, "")
    .replace(/^資料には次のように記載されています[。:：]?\s*/u, "")
    .replace(/^the provided (?:material|document) states[:,]?\s*/iu, "")
    .trim()
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
