import type { QaAgentState, QaAgentUpdate } from "../state.js"

const FOLLOW_UP_CUE = /^(その|それ|これ|あれ|上記|前述|同じ|では|じゃあ|あと|例外|期限|条件|手順|2つ目|二つ目|比較|違い|差分|what about|how about|and |then |that |those |it |they )/iu

export async function buildConversationState(state: QaAgentState): Promise<QaAgentUpdate> {
  const conversation = state.conversation
  const turns = conversation?.turns ?? state.conversationHistory
  const previousUserTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.text.trim()).filter(Boolean)
  const previousAssistantTurns = turns.filter((turn) => turn.role === "assistant").map((turn) => turn.text.trim()).filter(Boolean)
  const citations = turns.flatMap((turn) => "citations" in turn
    ? (turn.citations ?? []) as Array<{ documentId?: string; fileName?: string }>
    : [])
  const activeDocuments = unique([
    ...(conversation?.state?.activeDocuments ?? []),
    ...citations.flatMap((citation) => [citation.documentId, citation.fileName]).filter((value): value is string => Boolean(value))
  ]).slice(0, 8)
  const activeTopics = unique([
    ...(conversation?.state?.activeTopics ?? []),
    ...previousUserTurns.slice(-2).map(extractTopic).filter(Boolean),
    ...previousAssistantTurns.slice(-1).map(extractTopic).filter(Boolean)
  ]).slice(0, 6)
  const activeEntities = unique([
    ...(conversation?.state?.activeEntities ?? []),
    ...turns.flatMap((turn) => extractEntities(turn.text))
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
      previousCitationCount: citations.length,
      turnDependency
    }
  }
}

export async function decontextualizeQuery(state: QaAgentState): Promise<QaAgentUpdate> {
  const question = state.question.trim().replace(/\s+/g, " ")
  const conversationState = state.conversationState
  const topicPrefix = [
    ...(conversationState?.activeTopics ?? []),
    ...(conversationState?.activeEntities ?? [])
  ].filter(Boolean).slice(0, 4).join(" ")
  const isDependent = conversationState?.turnDependency && conversationState.turnDependency !== "standalone"
  const standaloneQuestion = isDependent && topicPrefix ? `${topicPrefix} ${question}`.trim() : question
  const retrievalQueries = unique([
    standaloneQuestion,
    question,
    ...(conversationState?.activeDocuments ?? []).slice(0, 3).map((document) => `${standaloneQuestion} ${document}`),
    ...(conversationState?.activeEntities ?? []).slice(0, 4).map((entity) => `${standaloneQuestion} ${entity}`)
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
  return text
    .replace(/[?？。.!！]/g, "")
    .replace(/(について|教えて|ください|ですか|ますか|とは|は|を).*/u, "")
    .trim()
    .slice(0, 80)
}

function extractEntities(text: string): string[] {
  const normalized = text.normalize("NFKC")
  const ascii = normalized.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}(?:規程|制度|申請|期限|条件|例外|手当|精算|承認)?/gu) ?? []
  return unique([...ascii, ...japanese].map((item) => item.trim()).filter((item) => item.length >= 2)).slice(0, 8)
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}
