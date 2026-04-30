import { selectFinalAnswerChunks } from "../../rag/prompts.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function rerankChunks(state: QaAgentState): Promise<QaAgentUpdate> {
  const reranked = [...state.retrievedChunks].sort((a, b) => b.score - a.score).slice(0, state.topK)
  return {
    selectedChunks: selectFinalAnswerChunks(state.question, reranked)
  }
}
