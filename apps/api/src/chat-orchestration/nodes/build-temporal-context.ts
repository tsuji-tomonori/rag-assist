import { buildTemporalContext as buildContext } from "../computation.js"
import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"

export async function buildTemporalContext(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  return {
    temporalContext: buildContext(
      state.question,
      new Date(),
      "Asia/Tokyo",
      state.asOfDate ? { date: state.asOfDate, source: state.asOfDateSource ?? "benchmark" } : undefined
    )
  }
}
