import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function analyzeInput(state: QaAgentState): Promise<QaAgentUpdate> {
  return {
    normalizedQuery: state.question.trim().replace(/\s+/g, " ")
  }
}
