import type { ChatOrchestrationUpdate } from "../state.js"
import { NO_ANSWER } from "../state.js"

export async function finalizeRefusal(): Promise<ChatOrchestrationUpdate> {
  return {
    answer: NO_ANSWER,
    citations: []
  }
}
