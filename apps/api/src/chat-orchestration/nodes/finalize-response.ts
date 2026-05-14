import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"
import { NO_ANSWER } from "../state.js"

export async function finalizeResponse(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  if (!state.answerability.isAnswerable || !state.answer || state.answer === NO_ANSWER) {
    return {
      answer: NO_ANSWER,
      citations: [],
      answerability: {
        isAnswerable: false,
        reason: state.answerability.reason === "sufficient_evidence" ? "citation_validation_failed" : state.answerability.reason,
        confidence: state.answerability.confidence
      }
    }
  }

  return {
    answer: state.answer.trim()
  }
}
