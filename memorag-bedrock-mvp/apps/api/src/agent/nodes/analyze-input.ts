import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function analyzeInput(state: QaAgentState): Promise<QaAgentUpdate> {
  const effectiveQuestion = buildEffectiveQuestion(state)

  return {
    question: effectiveQuestion,
    normalizedQuery: effectiveQuestion.trim().replace(/\s+/g, " "),
    clarificationContext: state.clarificationContext
  }
}

function buildEffectiveQuestion(state: QaAgentState): string {
  const question = state.question.trim().replace(/\s+/g, " ")
  const originalQuestion = state.clarificationContext?.originalQuestion?.trim().replace(/\s+/g, " ")
  const selectedValue = state.clarificationContext?.selectedValue?.trim().replace(/\s+/g, " ")
  if (!originalQuestion || state.clarificationContext?.selectedOptionId) return question
  if (!selectedValue || selectedValue === question) return `${originalQuestion} ${question}`.trim()
  return `${originalQuestion} ${selectedValue} ${question}`.trim()
}
