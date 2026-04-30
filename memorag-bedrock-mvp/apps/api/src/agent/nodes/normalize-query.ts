import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function normalizeQuery(state: QaAgentState): Promise<QaAgentUpdate> {
  const normalized = (state.normalizedQuery ?? state.question)
    .trim()
    .replace(/[？?]+$/g, "")
    .replace(/\s+/g, " ")

  return {
    normalizedQuery: normalized,
    expandedQueries: [normalized]
  }
}
