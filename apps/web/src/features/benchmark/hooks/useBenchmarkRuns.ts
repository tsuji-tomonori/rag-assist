import { useCallback, useRef, useState } from "react"
import {
  cancelBenchmarkRun,
  listBenchmarkRuns,
  listBenchmarkSuites,
  startBenchmarkRun
} from "../api/benchmarkApi.js"
import type { BenchmarkRun, BenchmarkSuite } from "../types.js"
import { confirmedOperation, failedOperation, type OperationOutcome } from "../../../shared/ui/operationOutcome.js"

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
  const [benchmarkSuiteId, setBenchmarkSuiteId] = useState("")
  const [benchmarkModelId, setBenchmarkModelId] = useState(defaultModelId)
  const [benchmarkConcurrency, setBenchmarkConcurrency] = useState(1)
  const startingRef = useRef(false)
  const cancellingRunIdsRef = useRef(new Set<string>())

  const refreshBenchmarkRuns = useCallback(async () => {
    setBenchmarkRuns(await listBenchmarkRuns())
  }, [])

  const refreshBenchmarkSuites = useCallback(async () => {
    const suites = await listBenchmarkSuites()
    setBenchmarkSuites(suites)
    setBenchmarkSuiteId((current) => suites.find((suite) => suite.suiteId === current)?.suiteId ?? suites[0]?.suiteId ?? "")
  }, [])

  async function onStartBenchmark(): Promise<OperationOutcome<BenchmarkRun>> {
    if (startingRef.current) return failedOperation(new Error("性能テストは起動処理中です"))
    setLoading(true)
    setError(null)
    startingRef.current = true
    try {
      const selectedSuite = benchmarkSuites.find((suite) => suite.suiteId === benchmarkSuiteId)
      if (!selectedSuite) {
        const outcome = failedOperation(new Error("実行可能な benchmark suite を取得できていません。更新後に再実行してください。"))
        setError(outcome.message)
        return outcome
      }
      const created = await startBenchmarkRun({
        suiteId: benchmarkSuiteId,
        mode: selectedSuite.mode,
        runner: "codebuild",
        modelId: benchmarkModelId,
        embeddingModelId,
        topK: 6,
        memoryTopK: 4,
        minScore,
        concurrency: benchmarkConcurrency
      })
      setBenchmarkRuns((prev) => [created, ...prev.filter((run) => run.runId !== created.runId)])
      return confirmedOperation(created, {
        message: "API が性能テストの起動を受け付けました。実行状態は対象行で更新してください。",
        evidence: {
          actor: created.createdBy,
          resultReference: created.runId,
          version: created.updatedAt
        }
      })
    } catch (err) {
      const outcome = failedOperation(err)
      setError(outcome.message)
      return outcome
    } finally {
      startingRef.current = false
      setLoading(false)
    }
  }

  async function onCancelBenchmark(runId: string): Promise<OperationOutcome<BenchmarkRun>> {
    if (cancellingRunIdsRef.current.has(runId)) return failedOperation(new Error("この性能テストは取消処理中です"))
    cancellingRunIdsRef.current.add(runId)
    setLoading(true)
    setError(null)
    try {
      const cancelled = await cancelBenchmarkRun(runId)
      setBenchmarkRuns((prev) => [cancelled, ...prev.filter((run) => run.runId !== runId)])
      return confirmedOperation(cancelled, {
        message: "API が性能テストの取消結果を確定しました。",
        evidence: {
          actor: cancelled.createdBy,
          resultReference: cancelled.runId,
          version: cancelled.updatedAt
        }
      })
    } catch (err) {
      const outcome = failedOperation(err)
      setError(outcome.message)
      return outcome
    } finally {
      cancellingRunIdsRef.current.delete(runId)
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
