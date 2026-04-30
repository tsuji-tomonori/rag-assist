import type { Dependencies } from "../../dependencies.js"
import { parseJsonObject } from "../../rag/json.js"
import { buildCluePrompt } from "../../rag/prompts.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"
import type { ClueJson } from "../types.js"
import { buildSearchClues } from "../utils.js"

export function createGenerateCluesNode(deps: Dependencies) {
  return async function generateClues(state: QaAgentState): Promise<QaAgentUpdate> {
    const memoryContext = state.memoryCards
      .map((hit) => hit.metadata.text ?? "")
      .filter(Boolean)
      .join("\n---\n")

    if (!memoryContext) {
      const query = state.normalizedQuery ?? state.question
      return {
        clues: [],
        expandedQueries: [query]
      }
    }

    const raw = await deps.textModel.generate(buildCluePrompt(state.question, memoryContext), {
      modelId: state.clueModelId,
      temperature: 0,
      maxTokens: 600
    })

    const clueJson = parseJsonObject<ClueJson>(raw)
    const clues = buildSearchClues(state.normalizedQuery ?? state.question, clueJson?.clues ?? [])

    return {
      clues,
      expandedQueries: clues
    }
  }
}
