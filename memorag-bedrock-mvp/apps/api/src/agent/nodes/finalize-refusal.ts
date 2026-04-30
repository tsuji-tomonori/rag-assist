import type { QaAgentUpdate } from "../state.js"
import { NO_ANSWER } from "../state.js"

export async function finalizeRefusal(): Promise<QaAgentUpdate> {
  return {
    answer: NO_ANSWER,
    citations: []
  }
}
