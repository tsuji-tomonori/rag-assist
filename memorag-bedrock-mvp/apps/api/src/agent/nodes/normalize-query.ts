import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function normalizeQuery(state: QaAgentState): Promise<QaAgentUpdate> {
  const base = (state.normalizedQuery ?? state.question)
    .trim()
    .replace(/[？?]+$/g, "")
    .replace(/\s+/g, " ")
  const normalized = state.conversationHistory.length > 0 && looksContextDependent(base)
    ? deterministicRewriteFromHistory(base, state.conversationHistory)
    : base

  return {
    normalizedQuery: normalized,
    expandedQueries: normalized === base ? [normalized] : [normalized, base]
  }
}

function looksContextDependent(question: string): boolean {
  return /(それ|これ|あれ|さっき|先ほど|前の|上記|同じ|違い|では|にも|でも|その場合|also|that|those|previous|same|it|they|them)/iu.test(question)
}

function deterministicRewriteFromHistory(
  question: string,
  history: Array<{ role: "user" | "assistant"; text: string }>
): string {
  const lastUser = [...history].reverse().find((turn) => turn.role === "user")?.text
  if (!lastUser) return question

  const topic = lastUser
    .trim()
    .replace(/[？?。.!！]+$/gu, "")
    .replace(/[はをが]$/u, "")
    .replace(/\s+/g, " ")
  if (!topic) return question
  return `${topic}について、${question}`
}
