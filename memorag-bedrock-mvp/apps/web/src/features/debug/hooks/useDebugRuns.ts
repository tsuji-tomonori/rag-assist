import { useMemo, useState } from "react"
import { listDebugRuns, type DebugTrace } from "../../../api.js"
import { formatLatency } from "../../../shared/utils/format.js"

export function useDebugRuns({
  latestTrace,
  pendingDebugQuestion
}: {
  latestTrace?: DebugTrace
  pendingDebugQuestion: string | null
}) {
  const [debugRuns, setDebugRuns] = useState<DebugTrace[]>([])
  const [selectedRunId, setSelectedRunId] = useState("")
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null)
  const [allExpanded, setAllExpanded] = useState(false)

  async function refreshDebugRuns() {
    setDebugRuns(await listDebugRuns())
  }

  const selectedTrace = useMemo(() => {
    if (pendingDebugQuestion) return undefined
    if (selectedRunId) return debugRuns.find((run) => run.runId === selectedRunId) ?? latestTrace
    return latestTrace
  }, [debugRuns, latestTrace, pendingDebugQuestion, selectedRunId])

  const totalLatency = pendingDebugQuestion ? "処理中" : selectedTrace ? formatLatency(selectedTrace.totalLatencyMs) : "-"
  const selectedRunValue = pendingDebugQuestion ? "__processing__" : selectedTrace?.runId ?? ""

  return {
    debugRuns,
    setDebugRuns,
    selectedRunId,
    setSelectedRunId,
    expandedStepId,
    setExpandedStepId,
    allExpanded,
    setAllExpanded,
    selectedTrace,
    totalLatency,
    selectedRunValue,
    refreshDebugRuns
  }
}
