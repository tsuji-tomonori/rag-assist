import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useDebugSelection } from "./useDebugRuns.js"
import type { DebugTrace } from "../types.js"

const trace: DebugTrace = {
  schemaVersion: 1,
  runId: "run-1",
  question: "社内規程を確認して",
  modelId: "amazon.nova-lite-v1:0",
  embeddingModelId: "amazon.titan-embed-text-v2:0",
  clueModelId: "amazon.nova-lite-v1:0",
  topK: 6,
  memoryTopK: 4,
  minScore: 0.2,
  startedAt: "2026-05-03T00:00:00.000Z",
  completedAt: "2026-05-03T00:00:01.250Z",
  totalLatencyMs: 1250,
  status: "success",
  answerPreview: "回答",
  isAnswerable: true,
  citations: [],
  retrieved: [],
  steps: []
}

describe("useDebugSelection", () => {
  it("pending 中は処理中表示を優先する", () => {
    const initialProps: Parameters<typeof useDebugSelection>[0] = {
      debugRuns: [],
      selectedRunId: "",
      latestTrace: trace,
      pendingDebugQuestion: "社内規程を確認して"
    }
    const { result, rerender } = renderHook((props: Parameters<typeof useDebugSelection>[0]) => useDebugSelection(props), {
      initialProps: {
        ...initialProps
      }
    })

    expect(result.current.selectedTrace).toBeUndefined()
    expect(result.current.totalLatency).toBe("処理中")
    expect(result.current.selectedRunValue).toBe("__processing__")

    rerender({
      debugRuns: [],
      selectedRunId: "",
      latestTrace: trace,
      pendingDebugQuestion: null
    })

    expect(result.current.selectedTrace).toBe(trace)
    expect(result.current.selectedRunValue).toBe("run-1")
  })
})
