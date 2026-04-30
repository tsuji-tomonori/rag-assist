import type { Dependencies } from "../../dependencies.js"
import { buildFinalAnswerPrompt } from "../../rag/prompts.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createGenerateAnswerNode(deps: Dependencies) {
  return async function generateAnswer(state: QaAgentState): Promise<QaAgentUpdate> {
    const rawAnswer = await deps.textModel.generate(buildFinalAnswerPrompt(state.question, state.selectedChunks), {
      modelId: state.modelId,
      temperature: 0,
      maxTokens: 1200
    })

    return { rawAnswer }
  }
}
