import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createRetrieveMemoryNode(deps: Dependencies) {
  return async function retrieveMemory(state: QaAgentState): Promise<QaAgentUpdate> {
    if (!state.useMemory) {
      return { memoryCards: [] }
    }

    const vector = await deps.textModel.embed(state.normalizedQuery ?? state.question, {
      modelId: state.embeddingModelId,
      dimensions: config.embeddingDimensions
    })

    const memoryCards = await deps.memoryVectorStore.query(vector, state.memoryTopK, { kind: "memory" })
    return { memoryCards }
  }
}
