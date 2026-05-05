import type { QaAgentState, QaAgentUpdate } from "../state.js"

const aliasReplacements: Array<[RegExp, string]> = [
  [/育休/g, "育児休業"]
]

export async function normalizeQuery(state: QaAgentState): Promise<QaAgentUpdate> {
  const normalized = (state.normalizedQuery ?? state.question)
    .trim()
    .replace(/[？?]+$/g, "")
    .replace(/\s+/g, " ")

  return {
    normalizedQuery: normalizeAliases(normalized),
    expandedQueries: [normalizeAliases(normalized)]
  }
}

function normalizeAliases(query: string): string {
  return aliasReplacements.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), query)
}
