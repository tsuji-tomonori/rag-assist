import { buildTemporalContext as buildContext } from "../computation.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export async function buildTemporalContext(state: QaAgentState): Promise<QaAgentUpdate> {
  return {
    temporalContext: buildContext(
      state.question,
      new Date(),
      "Asia/Tokyo",
      state.asOfDate ? { date: state.asOfDate, source: state.asOfDateSource ?? "benchmark" } : undefined
    )
  }
}
