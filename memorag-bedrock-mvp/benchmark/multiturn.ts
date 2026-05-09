export type MultiTurnBenchmarkTurn = {
  id: string
  conversationId: string
  turnIndex: number
  question: string
  expectedStandaloneQuestion?: string
  turnDependency?: string
  expectedContains?: string[]
  expectedFiles?: string[]
  expectedPages?: Array<number | string>
  answerable?: boolean
  metadata?: Record<string, unknown>
}

export type MultiTurnDatasetRow = MultiTurnBenchmarkTurn & {
  history?: Array<{
    role: "user" | "assistant"
    text: string
  }>
  expectedResponseType?: "answer" | "refusal" | "clarification"
}

export function toMultiTurnDatasetRows(turns: MultiTurnBenchmarkTurn[]): MultiTurnDatasetRow[] {
  const byConversation = new Map<string, MultiTurnBenchmarkTurn[]>()
  for (const turn of turns) {
    byConversation.set(turn.conversationId, [...(byConversation.get(turn.conversationId) ?? []), turn])
  }

  const rows: MultiTurnDatasetRow[] = []
  for (const conversationTurns of byConversation.values()) {
    const ordered = [...conversationTurns].sort((a, b) => a.turnIndex - b.turnIndex)
    const history: MultiTurnDatasetRow["history"] = []
    for (const turn of ordered) {
      rows.push({
        ...turn,
        history: [...history],
        expectedResponseType: turn.answerable === false ? "refusal" : "answer"
      })
      history.push({ role: "user", text: turn.question })
    }
  }
  return rows.sort((a, b) => a.conversationId === b.conversationId ? a.turnIndex - b.turnIndex : 0)
}
