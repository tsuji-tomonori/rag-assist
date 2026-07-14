import { parseJsonObject } from "../../../_shared/json.js"
import { selectAnswerPolicyForMetadata } from "../../../_shared/policies/answer-policy.js"
import { hasInvalidRequirementsClassificationAnswer, isRequirementsClassificationQuestion } from "../prompt/grounded-prompt-builder.js"
import { ragRuntimePolicy } from "../../../../chat-orchestration/runtime-policy.js"
import { validateAnswerRequirements } from "../../../../chat-orchestration/question-requirements.js"
import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../../../../chat-orchestration/state.js"
import { NO_ANSWER } from "../../../../chat-orchestration/state.js"
import type { AnswerJson } from "../../../../chat-orchestration/types.js"
import { toCitation } from "../../../../chat-orchestration/utils.js"

export async function validateCitations(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const answerJson = parseJsonObject<AnswerJson>(state.rawAnswer ?? "")

  if (!answerJson || answerJson.isAnswerable === false || !answerJson.answer?.trim()) {
    return citationFailure(state.rawAnswer)
  }

  const used = new Set(answerJson.usedChunkIds ?? [])
  const citations = state.selectedChunks
    .filter((hit) => used.size === 0 || used.has(hit.key) || used.has(hit.metadata.chunkId ?? ""))
    .map((hit) => toCitation(hit))
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
  const requirementIssues = validateAnswerRequirements(state.question, answerJson.answer)
  if (requirementIssues.length > 0) {
    return citationFailure(
      state.rawAnswer,
      `answer_requirement_coverage_failed: ${requirementIssues.map((issue) => issue.reason).join(" / ")}`
    )
  }

  return {
    answer: answerJson.answer.trim(),
    citations,
    usedComputedFactIds
  }
}

function validComputedFactIds(ids: string[], state: ChatOrchestrationState): string[] {
  const validIds = new Set(state.computedFacts.map((fact) => fact.id))
  return [...new Set(ids.map((id) => id.trim()).filter((id) => validIds.has(id)))]
}

function citationFailure(rawAnswer?: string, reasonDetail?: string): ChatOrchestrationUpdate {
  return {
    answerability: {
      isAnswerable: false,
      reason: "citation_validation_failed",
      confidence: 0
    },
    rawAnswer: reasonDetail ? `${rawAnswer ?? ""}\n${reasonDetail}` : rawAnswer,
    answer: NO_ANSWER,
    citations: []
  }
}
