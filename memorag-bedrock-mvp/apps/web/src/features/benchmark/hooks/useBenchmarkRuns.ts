import { useCallback, useState } from "react"
import {
  cancelBenchmarkRun,
  listBenchmarkRuns,
  listBenchmarkSuites,
  startBenchmarkRun
} from "../api/benchmarkApi.js"
import type { BenchmarkRun, BenchmarkSuite } from "../types.js"

const defaultModelId = "amazon.nova-lite-v1:0"

export function useBenchmarkRuns({
  embeddingModelId,
  minScore,
  setLoading,
  setError
}: {
  embeddingModelId: string
  minScore: number
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [benchmarkRuns, setBenchmarkRuns] = useState<BenchmarkRun[]>([])
  const [benchmarkSuites, setBenchmarkSuites] = useState<BenchmarkSuite[]>([])
  const [benchmarkSuiteId, setBenchmarkSuiteId] = useState("standard-agent-v1")
  const [benchmarkModelId, setBenchmarkModelId] = useState(defaultModelId)
  const [benchmarkConcurrency, setBenchmarkConcurrency] = useState(1)

  const refreshBenchmarkRuns = useCallback(async () => {
    setBenchmarkRuns(await listBenchmarkRuns())
  }, [])

  const refreshBenchmarkSuites = useCallback(async () => {
    const suites = await listBenchmarkSuites()
    setBenchmarkSuites(suites)
    setBenchmarkSuiteId((current) => suites.find((suite) => suite.suiteId === current)?.suiteId ?? suites[0]?.suiteId ?? current)
  }, [])

  async function onStartBenchmark() {
    setLoading(true)
    setError(null)
    try {
      const selectedSuite = benchmarkSuites.find((suite) => suite.suiteId === benchmarkSuiteId)
      const created = await startBenchmarkRun({
        suiteId: benchmarkSuiteId,
        mode: selectedSuite?.mode ?? "agent",
        runner: "codebuild",
        modelId: benchmarkModelId,
        embeddingModelId,
        topK: 6,
        memoryTopK: 4,
        minScore,
        concurrency: benchmarkConcurrency
      })
      setBenchmarkRuns((prev) => [created, ...prev.filter((run) => run.runId !== created.runId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onCancelBenchmark(runId: string) {
    setLoading(true)
    setError(null)
    try {
      const cancelled = await cancelBenchmarkRun(runId)
      setBenchmarkRuns((prev) => [cancelled, ...prev.filter((run) => run.runId !== runId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return {
    benchmarkRuns,
    benchmarkSuites,
    benchmarkSuiteId,
    benchmarkModelId,
    benchmarkConcurrency,
    setBenchmarkSuiteId,
    setBenchmarkModelId,
    setBenchmarkConcurrency,
    refreshBenchmarkRuns,
    refreshBenchmarkSuites,
    onStartBenchmark,
    onCancelBenchmark
  }
}
