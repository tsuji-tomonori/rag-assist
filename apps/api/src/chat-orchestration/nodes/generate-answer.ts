import type { Dependencies } from "../../dependencies.js"
import { buildFinalAnswerPrompt, formatConversationHistory } from "../../rag/prompts.js"
import type { VectorMetadata } from "../../types.js"
import { llmOptions } from "../runtime-policy.js"
import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"

export function createGenerateAnswerNode(deps: Dependencies) {
  return async function generateAnswer(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
    const rawAnswer = await deps.textModel.generate(
      buildFinalAnswerPrompt(
        state.question,
        state.selectedChunks,
        state.computedFacts,
        state.temporalContext,
        formatConversationHistory(state.conversationHistory),
        { style: benchmarkAnswerStyle(state) }
      ),
      llmOptions("finalAnswer", state.modelId)
    )

    return { rawAnswer }
  }
}

function benchmarkAnswerStyle(state: ChatOrchestrationState): "benchmark_grounded_short" | undefined {
  const filters = state.searchFilters
  if (filters?.source === "benchmark-runner" || filters?.docType === "benchmark-corpus" || filters?.benchmarkSuiteId) {
    return "benchmark_grounded_short"
  }
  if (
    state.selectedChunks.some((chunk) => {
      const metadata = chunk.metadata as VectorMetadata
      return metadata.source === "benchmark-runner" || metadata.docType === "benchmark-corpus" || Boolean(metadata.benchmarkSuiteId)
    })
  ) {
    return "benchmark_grounded_short"
  }
  return undefined
}
