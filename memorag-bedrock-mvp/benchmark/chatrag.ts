import { toMultiTurnDatasetRows, type MultiTurnBenchmarkTurn, type MultiTurnDatasetRow } from "./multiturn.js"

export const chatragBenchSuiteId = "chatrag-bench-v1"

export function convertChatRagBenchTurns(turns: MultiTurnBenchmarkTurn[]): MultiTurnDatasetRow[] {
  return toMultiTurnDatasetRows(turns).map((row) => ({
    ...row,
    metadata: {
      ...(row.metadata ?? {}),
      sourceDataset: "ChatRAG Bench",
      benchmarkFamily: "conversational-rag"
    }
  }))
}
