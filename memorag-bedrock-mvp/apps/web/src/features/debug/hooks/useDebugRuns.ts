import { useMemo, useState } from "react"
import { listDebugRuns } from "../api/debugApi.js"
import type { DebugTrace } from "../types.js"
import { formatLatency } from "../../../shared/utils/format.js"

export function useDebugRuns() {
  const [debugRuns, setDebugRuns] = useState<DebugTrace[]>([])
  const [selectedRunId, setSelectedRunId] = useState("")
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null)
  const [allExpanded, setAllExpanded] = useState(false)

  async function refreshDebugRuns() {
    setDebugRuns(await listDebugRuns())
  }

  return {
    debugRuns,
    setDebugRuns,
    selectedRunId,
    setSelectedRunId,
    expandedStepId,
    setExpandedStepId,
    allExpanded,
    setAllExpanded,
    refreshDebugRuns
  }
}

export function useDebugSelection({
  debugRuns,
  selectedRunId,
  latestTrace,
  pendingDebugQuestion
}: {
  debugRuns: DebugTrace[]
  selectedRunId: string
  latestTrace?: DebugTrace
  pendingDebugQuestion: string | null
}) {
  const selectedTrace = useMemo(() => {
    if (pendingDebugQuestion) return undefined
    if (selectedRunId) return debugRuns.find((run) => run.runId === selectedRunId) ?? latestTrace
    return latestTrace
  }, [debugRuns, latestTrace, pendingDebugQuestion, selectedRunId])

  const totalLatency = pendingDebugQuestion ? "処理中" : selectedTrace ? formatLatency(selectedTrace.totalLatencyMs) : "-"
  const selectedRunValue = pendingDebugQuestion ? "__processing__" : selectedTrace?.runId ?? ""

  return {
    selectedTrace,
    totalLatency,
    selectedRunValue
  }
}
