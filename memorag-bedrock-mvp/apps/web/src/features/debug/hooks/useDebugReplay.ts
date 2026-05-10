import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import type { DebugTrace } from "../types.js"
import { buildDebugReplayEnvelope, parseDebugReplayJson, type DebugReplayEnvelope } from "../utils/debugTraceReplay.js"

export function useDebugReplay({
  trace,
  pending
}: {
  trace?: DebugTrace
  pending: boolean
}) {
  const [replayEnvelope, setReplayEnvelope] = useState<DebugReplayEnvelope | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const envelope = useMemo(() => (pending ? null : replayEnvelope ?? (trace ? buildDebugReplayEnvelope(trace) : null)), [pending, replayEnvelope, trace])
  const activeTrace = envelope?.rawTrace ?? trace
  const selectedNode = envelope?.graph.nodes.find((node) => node.id === selectedNodeId) ?? envelope?.graph.nodes[0]
  const selectedDetail = selectedNode ? envelope?.details[selectedNode.detailRef] : undefined

  useEffect(() => {
    setSelectedNodeId(null)
  }, [trace?.runId, replayEnvelope?.runSummary.runId])

  useEffect(() => {
    if (!expanded) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false)
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [expanded])

  async function onUploadDebugJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const nextEnvelope = parseDebugReplayJson(parsed)
      setReplayEnvelope(nextEnvelope)
      setSelectedNodeId(nextEnvelope.graph.nodes[0]?.id ?? null)
      setUploadError(null)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error))
    }
  }

  function clearReplay() {
    setReplayEnvelope(null)
    setUploadError(null)
    setSelectedNodeId(null)
  }

  return {
    replayEnvelope,
    envelope,
    activeTrace,
    selectedNode,
    selectedDetail,
    expanded,
    uploadError,
    setExpanded,
    setSelectedNodeId,
    onUploadDebugJson,
    clearReplay
  }
}
