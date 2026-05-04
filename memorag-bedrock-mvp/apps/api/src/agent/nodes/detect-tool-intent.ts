import { detectToolIntent as detectIntent } from "../computation.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function detectToolIntent(state: QaAgentState): Promise<QaAgentUpdate> {
  return {
    toolIntent: detectIntent(state.question)
  }
}
