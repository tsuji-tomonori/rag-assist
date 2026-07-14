import { createDependencies } from "./dependencies.js"
import { config } from "./config.js"
import { ProductionRagMonitor } from "./rag/quality-control/production-rag-monitor.js"
import { ProductionRagObservationProducer } from "./rag/quality-control/production-rag-observation-producer.js"
import { createRagAlertPublisherFromEnvironment } from "./rag/quality-control/rag-alert-publisher.js"

export type RagQualityMonitorEvent = {
  windowStart?: string
  windowEnd?: string
  windowMinutes?: number
}

export type RagQualityMonitorWorkerResult = {
  status: "pass" | "fail"
  alertCount: number
  criticalAlertCount: number
  executedActions: string[]
  policyVersion: string
  observationCount: number
  unavailableObservationCount: number
  benchmarkSourceSampleCount: number
  windowStart: string
  windowEnd: string
}

export async function handler(event: RagQualityMonitorEvent = {}): Promise<RagQualityMonitorWorkerResult> {
  const deps = createDependencies()
  const window = monitoringWindow(event)
  const monitor = new ProductionRagMonitor(deps.objectStore, {
    alertPublisher: createRagAlertPublisherFromEnvironment()
  })
  const producer = new ProductionRagObservationProducer(deps.objectStore)
  let benchmarkSourceSampleCount = 0
  try {
    benchmarkSourceSampleCount = await producer.captureCompletedBenchmarks(
      await deps.benchmarkRunStore.list(config.benchmarkEvaluationTenantId, 500),
      window
    )
  } catch (error) {
    console.warn("Benchmark quality source collection failed", { error })
  }
  const observations = await producer.aggregateAndRecordWindow(monitor, {
    ...window,
    observedAt: window.windowEnd
  })
  const evidence = await monitor.evaluateWindow(window)
  const criticalAlertCount = evidence.alerts.filter((alert) => alert.severity === "critical").length
  const result: RagQualityMonitorWorkerResult = {
    status: evidence.decision.status,
    alertCount: evidence.alerts.length,
    criticalAlertCount,
    executedActions: [...evidence.executedActions],
    policyVersion: evidence.decision.policyVersion,
    observationCount: observations.length,
    unavailableObservationCount: observations.filter((observation) => !observation.available).length,
    benchmarkSourceSampleCount,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd
  }
  emitControlLoopMetrics(result)
  return result
}

export function monitoringWindow(event: RagQualityMonitorEvent, now = new Date()): { windowStart: string; windowEnd: string; evaluatedAt: string } {
  const windowEnd = event.windowEnd ? new Date(event.windowEnd) : now
  const minutes = Number.isFinite(event.windowMinutes) ? Math.min(24 * 60, Math.max(1, Math.floor(event.windowMinutes!))) : 5
  const windowStart = event.windowStart ? new Date(event.windowStart) : new Date(windowEnd.getTime() - minutes * 60_000)
  if (!Number.isFinite(windowStart.getTime()) || !Number.isFinite(windowEnd.getTime()) || windowStart >= windowEnd) {
    throw new Error("Invalid monitoring observation window")
  }
  return { windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString(), evaluatedAt: now.toISOString() }
}

function emitControlLoopMetrics(result: RagQualityMonitorWorkerResult): void {
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: "MemoRAG/QualityControl",
        Dimensions: [[]],
        Metrics: [
          { Name: "ControlLoopHeartbeat", Unit: "Count" },
          { Name: "ControlLoopFailure", Unit: "Count" },
          { Name: "CriticalAlertCount", Unit: "Count" },
          { Name: "AlertCount", Unit: "Count" },
          { Name: "ObservationCount", Unit: "Count" },
          { Name: "UnavailableObservationCount", Unit: "Count" }
        ]
      }]
    },
    ControlLoopHeartbeat: 1,
    ControlLoopFailure: result.status === "fail" ? 1 : 0,
    CriticalAlertCount: result.criticalAlertCount,
    AlertCount: result.alertCount,
    ObservationCount: result.observationCount,
    UnavailableObservationCount: result.unavailableObservationCount,
    policyVersion: result.policyVersion,
    executedActions: result.executedActions
  }))
}
