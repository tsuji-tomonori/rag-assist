import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import type { RetrievedVector } from "../../types.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createSearchEvidenceNode(deps: Dependencies) {
  return async function searchEvidence(state: QaAgentState): Promise<QaAgentUpdate> {
    const queryEmbeddings =
      state.queryEmbeddings.length > 0
        ? state.queryEmbeddings
        : [
            {
              query: state.normalizedQuery ?? state.question,
              vector: await deps.textModel.embed(state.normalizedQuery ?? state.question, {
                modelId: state.embeddingModelId,
                dimensions: config.embeddingDimensions
              })
            }
          ]

    const retrievedByKey = new Map<string, RetrievedVector>()

    for (const item of queryEmbeddings) {
      const hits = await deps.evidenceVectorStore.query(item.vector, state.topK, { kind: "chunk" })
      for (const hit of hits) {
        const existing = retrievedByKey.get(hit.key)
        if (!existing || hit.score > existing.score) retrievedByKey.set(hit.key, hit)
      }
    }

    const retrievedChunks = [...retrievedByKey.values()].sort((a, b) => b.score - a.score).slice(0, Math.max(state.topK, 30))
    return { retrievedChunks }
  }
}
