import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createEmbedQueriesNode(deps: Dependencies) {
  return async function embedQueries(state: QaAgentState): Promise<QaAgentUpdate> {
    const queries = state.expandedQueries.length > 0 ? state.expandedQueries : [state.normalizedQuery ?? state.question]
    const queryEmbeddings = []

    for (const query of queries) {
      queryEmbeddings.push({
        query,
        vector: await deps.textModel.embed(query, {
          modelId: state.embeddingModelId,
          dimensions: config.embeddingDimensions
        })
      })
    }

    return { queryEmbeddings }
  }
}
