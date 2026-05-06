import { parseJsonObject } from "../../rag/json.js"
import { hasInvalidRequirementsClassificationAnswer, isRequirementsClassificationQuestion } from "../../rag/prompts.js"
import { selectAnswerPolicyForMetadata } from "../../rag/profiles.js"
import { ragRuntimePolicy } from "../runtime-policy.js"
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
    .slice(0, ragRuntimePolicy.limits.citationLimit)
  const usedComputedFactIds = validComputedFactIds(answerJson.usedComputedFactIds ?? [], state)

  if (state.strictGrounded && citations.length === 0 && usedComputedFactIds.length === 0) {
    return citationFailure(state.rawAnswer)
  }

  const answerPolicy = selectAnswerPolicyForMetadata(
    state.selectedChunks.map((chunk) => chunk.metadata as unknown as Record<string, unknown>),
    ragRuntimePolicy.profile.answerPolicy
  )
  if (isRequirementsClassificationQuestion(state.question) && hasInvalidRequirementsClassificationAnswer(answerJson.answer, answerPolicy)) {
    return citationFailure(state.rawAnswer)
  }

  return {
    answer: answerJson.answer.trim(),
    citations,
    usedComputedFactIds
  }
}

function validComputedFactIds(ids: string[], state: QaAgentState): string[] {
  const validIds = new Set(state.computedFacts.map((fact) => fact.id))
  return [...new Set(ids.map((id) => id.trim()).filter((id) => validIds.has(id)))]
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
