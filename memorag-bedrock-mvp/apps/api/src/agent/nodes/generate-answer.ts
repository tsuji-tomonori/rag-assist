import type { Dependencies } from "../../dependencies.js"
import { buildFinalAnswerPrompt, formatConversationHistory } from "../../rag/prompts.js"
import { llmOptions } from "../runtime-policy.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createGenerateAnswerNode(deps: Dependencies) {
  return async function generateAnswer(state: QaAgentState): Promise<QaAgentUpdate> {
    const rawAnswer = await deps.textModel.generate(
      buildFinalAnswerPrompt(
        state.question,
        state.selectedChunks,
        state.computedFacts,
        state.temporalContext,
        formatConversationHistory(state.conversationHistory)
      ),
      llmOptions("finalAnswer", state.modelId)
    )

    return { rawAnswer }
  }
}
