import type { RagQualityPolicyProfile } from "@memorag-mvp/contract/rag-quality-control"
import type { ObjectStore } from "./adapters/object-store.js"
import { createDependencies } from "./dependencies.js"
import {
  ACTIVE_RAG_QUALITY_POLICY_KEY,
  RAG_SAFETY_STATE_KEY,
  type RagSafetyState
} from "./rag/quality-control/production-rag-monitor.js"

export type RagQualityMonitorEvent = {
  windowStart?: string
  windowEnd?: string
  windowMinutes?: number
}

export type RagQualityMonitorWorkerResult = {
  status: "pass"
  alertCount: 0
  criticalAlertCount: 0
  executedActions: []
  policyVersion: string
  observationCount: 0
  unavailableObservationCount: 0
  benchmarkSourceSampleCount: 0
  windowStart: string
  windowEnd: string
  monitoringDisabled: true
  disabledReason: "cost_priority"
}

type CostPriorityMonitorStore = Pick<ObjectStore, "getText" | "putText">

/**
 * Cost-priority compatibility heartbeat.
 *
 * The former scheduled worker listed all source samples and observations every
 * five minutes. The MVP owner has prioritized recurring AWS cost over the
 * draft FR-093 control loop, so this entrypoint performs no prefix listing,
 * benchmark enumeration, aggregation, alert processing, or safety action.
 *
 * A direct policy read and one safety-state write are retained only because
 * deployed API workers currently require a fresh safety state. This keeps the
 * application available without reintroducing ListObjectsV2.
 */
export function createCostPriorityRagQualityMonitorHandler(input: Readonly<{
  objectStore: CostPriorityMonitorStore
  now?: () => Date
  safetyStateTtlSeconds?: number
}>) {
  return async (event: RagQualityMonitorEvent = {}): Promise<RagQualityMonitorWorkerResult> => {
    const now = input.now?.() ?? new Date()
    const window = monitoringWindow(event, now)
    const policy = await loadActivePolicy(input.objectStore)
    const ttlSeconds = normalizeTtlSeconds(
      input.safetyStateTtlSeconds ?? Number(process.env.RAG_SAFETY_STATE_TTL_SECONDS || 600)
    )
    const runtimeProfileVersion = policy?.runtimeProfileVersion?.trim()
      || process.env.RAG_RUNTIME_PROFILE_VERSION?.trim()
      || "1"
    const state: RagSafetyState = {
      schemaVersion: 1,
      stateVersion: 1,
      policyId: policy?.profileId ?? "cost-priority",
      policyVersion: policy?.version ?? "background-controls-disabled",
      activeRuntimeProfileVersion: runtimeProfileVersion,
      quarantinedRuntimeProfileVersions: [],
      promotionFrozen: false,
      documentQuarantineRequired: false,
      responseMode: "normal",
      updatedAt: window.evaluatedAt,
      validUntil: new Date(Date.parse(window.evaluatedAt) + ttlSeconds * 1_000).toISOString()
    }
    await input.objectStore.putText(
      RAG_SAFETY_STATE_KEY,
      `${JSON.stringify(state, null, 2)}\n`,
      "application/json; charset=utf-8"
    )
    const result: RagQualityMonitorWorkerResult = {
      status: "pass",
      alertCount: 0,
      criticalAlertCount: 0,
      executedActions: [],
      policyVersion: state.policyVersion,
      observationCount: 0,
      unavailableObservationCount: 0,
      benchmarkSourceSampleCount: 0,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      monitoringDisabled: true,
      disabledReason: "cost_priority"
    }
    emitCostPriorityMetrics(result)
    return result
  }
}

export async function handler(event: RagQualityMonitorEvent = {}): Promise<RagQualityMonitorWorkerResult> {
  const deps = createDependencies()
  return createCostPriorityRagQualityMonitorHandler({ objectStore: deps.objectStore })(event)
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

async function loadActivePolicy(store: CostPriorityMonitorStore): Promise<RagQualityPolicyProfile | undefined> {
  try {
    const policy = JSON.parse(await store.getText(ACTIVE_RAG_QUALITY_POLICY_KEY)) as RagQualityPolicyProfile
    if (!policy.profileId?.trim() || !policy.version?.trim() || !policy.runtimeProfileVersion?.trim()) return undefined
    return policy
  } catch {
    return undefined
  }
}

function normalizeTtlSeconds(value: number): number {
  if (!Number.isFinite(value)) return 600
  return Math.min(24 * 60 * 60, Math.max(60, Math.trunc(value)))
}

function emitCostPriorityMetrics(result: RagQualityMonitorWorkerResult): void {
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
    ControlLoopFailure: 0,
    CriticalAlertCount: 0,
    AlertCount: 0,
    ObservationCount: 0,
    UnavailableObservationCount: 0,
    costPriorityMode: true,
    policyVersion: result.policyVersion
  }))
}
