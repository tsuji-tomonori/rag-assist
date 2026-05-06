import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

const scriptPath = path.resolve(__dirname, "../scripts/update-benchmark-run-metrics.mjs")
const importModule = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>

test("extracts admin-visible agent benchmark metrics from summary JSON", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): Record<string, number>
  }

  assert.deepEqual(script.buildBenchmarkRunMetrics({
    total: 3,
    succeeded: 3,
    failedHttp: 0,
    metrics: {
      answerableAccuracy: 0.75,
      abstentionRecall: null,
      retrievalRecallAt20: 1,
      p50LatencyMs: 1200,
      p95LatencyMs: 3400,
      averageLatencyMs: 2100
    }
  }), {
    total: 3,
    succeeded: 3,
    failedHttp: 0,
    answerableAccuracy: 0.75,
    retrievalRecallAt20: 1,
    p50LatencyMs: 1200,
    p95LatencyMs: 3400,
    averageLatencyMs: 2100,
    errorRate: 0
  })
})

test("maps search benchmark recall@20 into run metrics", async () => {
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    buildBenchmarkRunMetrics(summary: unknown): Record<string, number>
    dynamoMetricsAttributeValue(metrics: Record<string, number>): unknown
  }
  const metrics = script.buildBenchmarkRunMetrics({
    total: 2,
    succeeded: 1,
    failedHttp: 1,
    metrics: {
      recallAt20: 0.5,
      expectedFileHitRate: 1,
      p50LatencyMs: 10,
      p95LatencyMs: 20,
      averageLatencyMs: 15
    }
  })

  assert.equal(metrics.retrievalRecallAt20, 0.5)
  assert.equal(metrics.errorRate, 0.5)
  assert.deepEqual(script.dynamoMetricsAttributeValue(metrics), {
    M: {
      total: { N: "2" },
      succeeded: { N: "1" },
      failedHttp: { N: "1" },
      expectedFileHitRate: { N: "1" },
      retrievalRecallAt20: { N: "0.5" },
      p50LatencyMs: { N: "10" },
      p95LatencyMs: { N: "20" },
      averageLatencyMs: { N: "15" },
      errorRate: { N: "0.5" }
    }
  })
})
