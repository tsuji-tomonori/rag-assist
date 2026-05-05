import { executeComputationTools as executeTools } from "../computation.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function executeComputationTools(state: QaAgentState): Promise<QaAgentUpdate> {
  if (!state.temporalContext || !state.toolIntent) return { computedFacts: [] }
  if (!state.toolIntent.needsArithmeticCalculation && !state.toolIntent.needsTemporalCalculation && !state.toolIntent.needsAggregation && !state.toolIntent.needsTaskDeadlineIndex) {
    return { computedFacts: [] }
  }

  return {
    computedFacts: [
      ...state.computedFacts,
      ...executeTools(state.question, state.temporalContext, state.toolIntent)
    ]
  }
}
