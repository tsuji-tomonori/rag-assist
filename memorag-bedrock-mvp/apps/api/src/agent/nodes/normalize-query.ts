import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function normalizeQuery(state: QaAgentState): Promise<QaAgentUpdate> {
  const normalized = (state.decontextualizedQuery?.standaloneQuestion ?? state.normalizedQuery ?? state.question)
    .trim()
    .replace(/[？?]+$/g, "")
    .replace(/\s+/g, " ")
  const expandedQueries = [...new Set([
    normalized,
    ...(state.decontextualizedQuery?.retrievalQueries ?? [])
  ].map((query) => query.trim().replace(/[？?]+$/g, "").replace(/\s+/g, " ")).filter(Boolean))]

  return {
    normalizedQuery: normalized,
    expandedQueries
  }
}
