import { parseJsonObject } from "../../rag/json.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"
import { NO_ANSWER } from "../state.js"
import type { AnswerJson } from "../types.js"
import { toCitation } from "../utils.js"

export async function validateCitations(state: QaAgentState): Promise<QaAgentUpdate> {
  const answerJson = parseJsonObject<AnswerJson>(state.rawAnswer ?? "")

  if (!answerJson || answerJson.isAnswerable === false || !answerJson.answer?.trim()) {
    return citationFailure(state.rawAnswer)
  }

  const used = new Set(answerJson.usedChunkIds ?? [])
  const citations = state.selectedChunks
    .filter((hit) => used.size === 0 || used.has(hit.key) || used.has(hit.metadata.chunkId ?? ""))
    .map(toCitation)
    .slice(0, 5)

  if (state.strictGrounded && citations.length === 0) {
    return citationFailure(state.rawAnswer)
  }

  return {
    answer: answerJson.answer.trim(),
    citations
  }
}

function citationFailure(rawAnswer?: string): QaAgentUpdate {
  return {
    answerability: {
      isAnswerable: false,
      reason: "citation_validation_failed",
      confidence: 0
    },
    rawAnswer,
    answer: NO_ANSWER,
    citations: []
  }
}
