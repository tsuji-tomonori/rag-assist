import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { cancelBenchmarkRun, listBenchmarkRuns, listBenchmarkSuites, startBenchmarkRun } from "../api/benchmarkApi.js"
import type { BenchmarkRun, BenchmarkSuite } from "../types.js"
import { useBenchmarkRuns } from "./useBenchmarkRuns.js"

vi.mock("../api/benchmarkApi.js", () => ({
  cancelBenchmarkRun: vi.fn(),
  listBenchmarkRuns: vi.fn(),
  listBenchmarkSuites: vi.fn(),
  startBenchmarkRun: vi.fn()
}))

const suite = (overrides: Partial<BenchmarkSuite> = {}): BenchmarkSuite => ({
  suiteId: "standard-agent-v1",
  label: "Agent standard",
  mode: "agent",
  datasetS3Key: "datasets/standard.jsonl",
  preset: "standard",
  defaultConcurrency: 2,
  ...overrides
})

const run = (overrides: Partial<BenchmarkRun> = {}): BenchmarkRun => ({
  runId: "run-1",
  status: "queued",
  mode: "agent",
  runner: "codebuild",
  suiteId: "standard-agent-v1",
  datasetS3Key: "datasets/standard.jsonl",
  createdBy: "user-1",
  createdAt: "2026-05-06T00:00:00.000Z",
  updatedAt: "2026-05-06T00:00:00.000Z",
  ...overrides
})

function createProps(overrides: Partial<Parameters<typeof useBenchmarkRuns>[0]> = {}): Parameters<typeof useBenchmarkRuns>[0] {
  return {
    embeddingModelId: "embed-model",
    minScore: 0.3,
    setLoading: vi.fn(),
    setError: vi.fn(),
    ...overrides
  }
}

describe("useBenchmarkRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listBenchmarkRuns).mockResolvedValue([run()])
    vi.mocked(listBenchmarkSuites).mockResolvedValue([suite({ suiteId: "search-standard-v1", mode: "search" })])
    vi.mocked(startBenchmarkRun).mockResolvedValue(run({ runId: "run-2", mode: "search", suiteId: "search-standard-v1" }))
    vi.mocked(cancelBenchmarkRun).mockResolvedValue(run({ runId: "run-2", status: "cancelled" }))
  })

  it("refreshes suites and starts the selected benchmark with runtime settings", async () => {
    const props = createProps()
    const { result } = renderHook(() => useBenchmarkRuns(props))

    await act(() => result.current.refreshBenchmarkSuites())
    act(() => result.current.setBenchmarkConcurrency(3))
    await act(() => result.current.onStartBenchmark())

    expect(result.current.benchmarkSuiteId).toBe("search-standard-v1")
    expect(startBenchmarkRun).toHaveBeenCalledWith({
      suiteId: "search-standard-v1",
      mode: "search",
      runner: "codebuild",
      modelId: "amazon.nova-lite-v1:0",
      embeddingModelId: "embed-model",
      topK: 6,
      memoryTopK: 4,
      minScore: 0.3,
      concurrency: 3
    })
    expect(result.current.benchmarkRuns[0]?.runId).toBe("run-2")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("refreshes runs, cancels by id, and reports API errors", async () => {
    const props = createProps()
    const { result } = renderHook(() => useBenchmarkRuns(props))

    await act(() => result.current.refreshBenchmarkRuns())
    await act(() => result.current.onCancelBenchmark("run-2"))
    await act(() => result.current.refreshBenchmarkSuites())
    vi.mocked(startBenchmarkRun).mockRejectedValueOnce(new Error("benchmark failed"))
    await act(() => result.current.onStartBenchmark())

    expect(result.current.benchmarkRuns[0]).toMatchObject({ runId: "run-2", status: "cancelled" })
    expect(cancelBenchmarkRun).toHaveBeenCalledWith("run-2")
    expect(props.setError).toHaveBeenCalledWith("benchmark failed")
  })

  it("keeps current suite when present, clears the selection when suites are empty, and reports string cancel errors", async () => {
    vi.mocked(listBenchmarkSuites).mockResolvedValueOnce([suite()]).mockResolvedValueOnce([])
    vi.mocked(cancelBenchmarkRun).mockRejectedValueOnce("cancel failed")
    const props = createProps()
    const { result } = renderHook(() => useBenchmarkRuns(props))

    await act(() => result.current.refreshBenchmarkSuites())
    expect(result.current.benchmarkSuiteId).toBe("standard-agent-v1")

    act(() => result.current.setBenchmarkSuiteId("custom-suite"))
    await act(() => result.current.refreshBenchmarkSuites())
    expect(result.current.benchmarkSuiteId).toBe("")

    await act(() => result.current.onCancelBenchmark("run-1"))
    expect(props.setError).toHaveBeenCalledWith("cancel failed")
  })

  it("does not start a benchmark when the selected suite is missing", async () => {
    const props = createProps()
    const { result } = renderHook(() => useBenchmarkRuns(props))

    act(() => result.current.setBenchmarkSuiteId("missing-suite"))
    await act(() => result.current.onStartBenchmark())

    expect(startBenchmarkRun).not.toHaveBeenCalled()
    expect(props.setError).toHaveBeenCalledWith("実行可能な benchmark suite を取得できていません。更新後に再実行してください。")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("starts the Japanese public PDF QA suite from the UI selection", async () => {
    vi.mocked(listBenchmarkSuites).mockResolvedValueOnce([
      suite(),
      suite({
        suiteId: "jp-public-pdf-qa-v1",
        label: "日本語公開PDF QA",
        datasetS3Key: "benchmark/dataset.jp-public-pdf-qa.jsonl",
        defaultConcurrency: 1
      })
    ])
    vi.mocked(startBenchmarkRun).mockResolvedValueOnce(run({
      runId: "run-jp-public-pdf",
      suiteId: "jp-public-pdf-qa-v1",
      datasetS3Key: "benchmark/dataset.jp-public-pdf-qa.jsonl"
    }))
    const props = createProps()
    const { result } = renderHook(() => useBenchmarkRuns(props))

    await act(() => result.current.refreshBenchmarkSuites())
    act(() => result.current.setBenchmarkSuiteId("jp-public-pdf-qa-v1"))
    await act(() => result.current.onStartBenchmark())

    expect(startBenchmarkRun).toHaveBeenCalledWith(expect.objectContaining({
      suiteId: "jp-public-pdf-qa-v1",
      mode: "agent",
      runner: "codebuild"
    }))
    expect(result.current.benchmarkRuns[0]).toMatchObject({
      runId: "run-jp-public-pdf",
      suiteId: "jp-public-pdf-qa-v1"
    })
  })
})
