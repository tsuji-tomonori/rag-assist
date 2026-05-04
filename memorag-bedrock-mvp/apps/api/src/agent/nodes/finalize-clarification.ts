import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function finalizeClarification(state: QaAgentState): Promise<QaAgentUpdate> {
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
