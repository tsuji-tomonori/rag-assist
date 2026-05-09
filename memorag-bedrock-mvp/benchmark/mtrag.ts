import { toMultiTurnDatasetRows, type MultiTurnBenchmarkTurn, type MultiTurnDatasetRow } from "./multiturn.js"

export const mtragSuiteId = "mtrag-v1"

export function convertMtragTurns(turns: MultiTurnBenchmarkTurn[]): MultiTurnDatasetRow[] {
  return toMultiTurnDatasetRows(turns).map((row) => ({
    ...row,
    metadata: {
      ...(row.metadata ?? {}),
      sourceDataset: "MTRAG/mtRAG",
      benchmarkFamily: "multi-turn-rag"
    }
  }))
}
