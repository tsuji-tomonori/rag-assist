import { detectToolIntent as detectIntent } from "../computation.js"
import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"

export async function detectToolIntent(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  return {
    toolIntent: detectIntent(state.question)
  }
}
