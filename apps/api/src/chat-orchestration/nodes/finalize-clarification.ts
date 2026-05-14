import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"

export async function finalizeClarification(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const question = state.clarification.question || "確認したい対象を選択してください。"
  return {
    answer: question,
    answerability: {
      isAnswerable: false,
      reason: "missing_required_fact",
      confidence: state.clarification.confidence
    },
    citations: []
  }
}
