import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  buildRequiredRagQualitySlices,
  RAG_QUALITY_POLICY_SCHEMA_VERSION,
  RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
  RAG_QUALITY_SIGNAL_CATALOG_VERSION,
  RAG_REQUIRED_SIGNAL_IDS,
  type RagQualityObservation,
  type RagQualityPolicyProfile,
  type RagQualitySignalId
} from "@memorag-mvp/contract/rag-quality-control"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import {
  ACTIVE_RAG_QUALITY_POLICY_KEY,
  assertRagSafetyInterlock,
  ProductionRagMonitor,
  RAG_SAFETY_STATE_KEY,
  type RagSafetyState
} from "./quality-control/production-rag-monitor.js"
import type { RagAlertNotification } from "./quality-control/rag-alert-publisher.js"

const observedAt = "2026-07-11T01:00:00.000Z"
const requiredCaseSlices = {
  questionTypes: ["fact"], tenantRoles: ["tenant-a:chat-user"], ocrModes: ["native"], languages: ["ja"],
  multiEvidence: ["true"], answerability: ["answerable"], severities: ["high"]
} as const

function higherIsBetter(signalId: RagQualitySignalId): boolean {
  return /(coverage|accuracy|quality|integrity|correctness|recall|retention|faithfulness|precision|completeness|success_rate|completion_rate|locator_validity)$/.test(signalId)
}

function approvedPolicy(): RagQualityPolicyProfile {
  return {
    schemaVersion: RAG_QUALITY_POLICY_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "production-rag",
    version: "approved-1",
    approvedBy: "quality-owner",
    approvedAt: observedAt,
    workloadProfileVersion: "workload-v1",
    runtimeProfileVersion: "runtime-v2",
    priceCatalogVersion: "price-v1",
    evidenceVersions: { dataset: "dataset-v1", model: "model-v1", index: "index-v1", prompt: "prompt-v1", pipeline: "pipeline-v1", parser: "parser-v1", chunker: "chunker-v1" },
    workloadDimensions: { corpusProfileVersion: "corpus-v1", aclDistributionVersion: "acl-v1", concurrency: 4, documentSizeProfileVersion: "size-v1", dependencyLatencyProfileVersion: "dependency-v1" },
    requiredCaseSlices,
    changeControl: { purpose: "neutral" },
    requiredSlices: buildRequiredRagQualitySlices(requiredCaseSlices),
    gates: RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (buildRequiredRagQualitySlices(requiredCaseSlices)[signalId] ?? ["overall"]).map((slice) => ({
      signalId,
      slice,
      comparator: higherIsBetter(signalId) ? "gte" : "lte",
      threshold: signalId.endsWith("_count") ? 0 : higherIsBetter(signalId) ? 0.8 : 10_000,
      thresholdApprovedBy: "quality-owner",
      thresholdApprovedAt: observedAt,
      minimumSampleCount: 1,
      minimumConfidence: 0.8
    }))),
    responsePolicy: {
      owner: "rag-on-call",
      runbookVersion: "rag-runbook-v1",
      allowedActions: ["promotion_freeze", "candidate_quarantine", "limited_answer", "rollback_last_known_safe"],
      lastKnownSafeRuntimeVersion: "runtime-v1"
    }
  }
}

function passingObservation(signalId: RagQualitySignalId, at = observedAt, slice = "overall"): RagQualityObservation {
  const releaseSignal = signalId.startsWith("release.")
  return {
    schemaVersion: RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "production-rag",
    profileVersion: "approved-1",
    signalId,
    slice,
    value: signalId.endsWith("_count") ? 0 : higherIsBetter(signalId) ? 0.95 : 10,
    available: true,
    sampleCount: 100,
    confidence: 0.99,
    observedAt: at,
    workloadProfileVersion: "workload-v1",
    runtimeProfileVersion: "runtime-v2",
    priceCatalogVersion: "price-v1",
    traceIds: [`trace:${signalId}`],
    source: {
      producerVersion: "test-producer-v1",
      artifactTypes: releaseSignal ? ["release_audit"] : ["test"],
      artifactIds: [`test:${signalId}`],
      versionDimensions: releaseSignal
        ? { dataset: ["dataset-v1"], model: ["model-v1"], index: ["index-v1"], prompt: ["prompt-v1"], pipeline: ["pipeline-v1"], parser: ["parser-v1"], chunker: ["chunker-v1"], workload: ["workload-v1"], runtime: ["runtime-v2"], price: ["price-v1"], releaseAudit: ["release-audit-v1"] }
        : { dataset: ["dataset-v1"], model: ["model-v1"], index: ["index-v1"], prompt: ["prompt-v1"], pipeline: ["pipeline-v1"], parser: ["parser-v1"], chunker: ["chunker-v1"], workload: ["workload-v1"], runtime: ["runtime-v2"], price: ["price-v1"] },
      missingVersionDimensions: []
    }
  }
}

async function recordPassingWindow(monitor: ProductionRagMonitor): Promise<void> {
  const slices = buildRequiredRagQualitySlices(requiredCaseSlices)
  for (const signalId of RAG_REQUIRED_SIGNAL_IDS) {
    for (const slice of slices[signalId] ?? ["overall"]) {
      await monitor.recordObservation(passingObservation(signalId, observedAt, slice))
    }
  }
}

test("FR-093 persists version/slice signals and keeps a passing runtime normal", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-pass-")))
  const monitor = new ProductionRagMonitor(store)
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(approvedPolicy()))
  await recordPassingWindow(monitor)

  const evidence = await monitor.evaluateWindow({
    windowStart: "2026-07-11T00:00:00.000Z",
    windowEnd: "2026-07-11T02:00:00.000Z",
    evaluatedAt: "2026-07-11T02:00:00.000Z"
  })
  const state = JSON.parse(await store.getText(RAG_SAFETY_STATE_KEY)) as RagSafetyState

  assert.equal(evidence.decision.status, "pass")
  assert.deepEqual(evidence.alerts, [])
  assert.equal(state.responseMode, "normal")
  assert.equal(state.activeRuntimeProfileVersion, "runtime-v2")
  assert.equal(state.stateVersion, 1)
  assert.equal(state.validUntil, "2026-07-11T02:10:00.000Z")
  await assert.doesNotReject(() => assertRagSafetyInterlock({
    objectStore: store,
    runtimeProfileVersion: "runtime-v2",
    required: true,
    now: "2026-07-11T02:05:00.000Z"
  }))
})

test("FR-093 keeps latest observations separate for each complete version dimension set", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-version-key-")))
  const monitor = new ProductionRagMonitor(store)
  const current = passingObservation("generation.faithfulness", "2026-07-11T01:00:00.000Z")
  const candidate = {
    ...current,
    observedAt: current.observedAt,
    traceIds: ["trace:candidate"],
    source: {
      ...current.source,
      versionDimensions: { ...current.source.versionDimensions, model: ["model-candidate-v3"] }
    }
  } satisfies RagQualityObservation
  await monitor.recordObservation(current)
  await monitor.recordObservation(candidate)

  const observations = await (monitor as unknown as {
    loadLatestObservations: (start: string, end: string) => Promise<RagQualityObservation[]>
  }).loadLatestObservations("2026-07-11T00:00:00.000Z", "2026-07-11T02:00:00.000Z")

  assert.equal(observations.length, 2)
  assert.deepEqual(new Set(observations.flatMap((item) => item.source.versionDimensions.model ?? [])), new Set(["model-v1", "model-candidate-v3"]))
})

test("FR-093 zero-tolerance drift persists alerts/actions and interlocks the unsafe runtime", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-fail-")))
  const notifications: RagAlertNotification[] = []
  const monitor = new ProductionRagMonitor(store, {
    alertPublisher: { publish: async (notification) => { notifications.push(notification) } }
  })
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(approvedPolicy()))
  await recordPassingWindow(monitor)
  await monitor.recordObservation({
    ...passingObservation("security.unauthorized_exposure_count", "2026-07-11T01:30:00.000Z"),
    value: 1,
    traceIds: ["trace:leak-canary"]
  })

  const evidence = await monitor.evaluateWindow({
    windowStart: "2026-07-11T00:00:00.000Z",
    windowEnd: "2026-07-11T02:00:00.000Z",
    evaluatedAt: "2026-07-11T02:00:00.000Z"
  })
  const state = JSON.parse(await store.getText(RAG_SAFETY_STATE_KEY)) as RagSafetyState

  assert.equal(evidence.decision.status, "fail")
  assert.equal(evidence.alerts.find((alert) => alert.signalId === "security.unauthorized_exposure_count")?.severity, "critical")
  assert.deepEqual(evidence.executedActions, ["promotion_freeze", "candidate_quarantine", "limited_answer"])
  assert.equal(state.promotionFrozen, true)
  assert.equal(state.responseMode, "limited")
  assert.ok(state.quarantinedRuntimeProfileVersions.includes("runtime-v2"))
  assert.ok((await store.listKeys("quality-control/alerts/")).length > 0)
  assert.ok((await store.listKeys("quality-control/actions/")).length > 0)
  const criticalNotification = notifications.find((item) => item.affected.signalId === "security.unauthorized_exposure_count")
  assert.equal(criticalNotification?.owner, "rag-on-call")
  assert.equal(criticalNotification?.profile.version, "approved-1")
  assert.equal(criticalNotification?.affected.runtimeProfileVersion, "runtime-v2")
  assert.equal(criticalNotification?.affected.slice, "overall")
  assert.equal(criticalNotification?.severity, "critical")
  assert.deepEqual(criticalNotification?.traceIds, ["trace:leak-canary"])
  assert.equal(criticalNotification?.runbookVersion, "rag-runbook-v1")
  assert.deepEqual(await store.listKeys("quality-control/notification-outbox/"), [])
  await assert.rejects(
    () => assertRagSafetyInterlock({
      objectStore: store,
      runtimeProfileVersion: "runtime-v2",
      required: true,
      now: "2026-07-11T02:05:00.000Z"
    }),
    /temporarily unavailable/
  )
})

test("FR-093 failed alert delivery is retried from a durable outbox on the next monitor window", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-notification-retry-")))
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(approvedPolicy()))
  const failing = new ProductionRagMonitor(store, {
    alertPublisher: { publish: async () => { throw new Error("simulated SNS outage") } }
  })
  await recordPassingWindow(failing)
  await failing.recordObservation({
    ...passingObservation("security.unauthorized_exposure_count", "2026-07-11T01:30:00.000Z"),
    value: 1,
    traceIds: ["trace:notification-retry"]
  })
  await failing.evaluateWindow({
    windowStart: "2026-07-11T00:00:00.000Z",
    windowEnd: "2026-07-11T02:00:00.000Z",
    evaluatedAt: "2026-07-11T02:00:00.000Z"
  })
  assert.ok((await store.listKeys("quality-control/notification-outbox/")).length > 0)

  const retried: RagAlertNotification[] = []
  const recovered = new ProductionRagMonitor(store, {
    alertPublisher: { publish: async (notification) => { retried.push(notification) } }
  })
  await recovered.evaluateWindow({
    windowStart: "2026-07-11T00:00:00.000Z",
    windowEnd: "2026-07-11T02:00:00.000Z",
    evaluatedAt: "2026-07-11T02:05:00.000Z"
  })
  assert.ok(retried.some((notification) => notification.traceIds.includes("trace:notification-retry")))
  assert.deepEqual(await store.listKeys("quality-control/notification-outbox/"), [])
})

test("FR-093 required monitoring fails closed when safety state is absent", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-missing-")))
  await assert.rejects(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", required: true }),
    /safety state is unavailable/
  )
  await assert.doesNotReject(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", required: false })
  )
})

test("FR-093 rejects a rolled-back candidate runtime and permits only the active last-known-safe runtime", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-runtime-mismatch-")))
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: "runtime-v1",
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: false,
    documentQuarantineRequired: false,
    responseMode: "normal",
    updatedAt: observedAt,
    validUntil: "2099-01-01T00:00:00.000Z"
  } satisfies RagSafetyState))

  await assert.rejects(
    () => assertRagSafetyInterlock({
      objectStore: store,
      runtimeProfileVersion: "runtime-v2",
      operation: "search",
      required: true
    }),
    /not the active monitored runtime/
  )
  await assert.doesNotReject(() => assertRagSafetyInterlock({
    objectStore: store,
    runtimeProfileVersion: "runtime-v1",
    operation: "search",
    required: true
  }))
})

test("FR-093 enforces promotion freeze and document quarantine at the affected boundaries", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-operation-interlocks-")))
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: "runtime-v2",
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: true,
    documentQuarantineRequired: true,
    responseMode: "normal",
    updatedAt: observedAt,
    validUntil: "2099-01-01T00:00:00.000Z"
  } satisfies RagSafetyState))

  const ingest = await assertRagSafetyInterlock({
    objectStore: store,
    runtimeProfileVersion: "runtime-v2",
    operation: "ingest",
    required: true
  })
  assert.equal(ingest?.documentQuarantineRequired, true)
  await assert.rejects(
    () => assertRagSafetyInterlock({
      objectStore: store,
      runtimeProfileVersion: "runtime-v2",
      operation: "publication",
      required: true
    }),
    /promotion is frozen/
  )
  await assert.rejects(
    () => assertRagSafetyInterlock({
      objectStore: store,
      runtimeProfileVersion: "runtime-v2",
      operation: "promotion",
      required: true
    }),
    /promotion is frozen/
  )
})

test("FR-093 permits quarantined-runtime ingest only as document quarantine while other RAG operations fail closed", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-runtime-quarantine-ingest-")))
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: "runtime-v2",
    quarantinedRuntimeProfileVersions: ["runtime-v2"],
    promotionFrozen: true,
    documentQuarantineRequired: false,
    responseMode: "limited",
    updatedAt: observedAt,
    validUntil: "2099-01-01T00:00:00.000Z"
  } satisfies RagSafetyState))

  const ingest = await assertRagSafetyInterlock({
    objectStore: store,
    runtimeProfileVersion: "runtime-v2",
    operation: "ingest",
    required: true
  })
  assert.equal(ingest?.documentQuarantineRequired, true)

  for (const operation of ["chat", "search", "publication", "promotion"] as const) {
    await assert.rejects(
      () => assertRagSafetyInterlock({
        objectStore: store,
        runtimeProfileVersion: "runtime-v2",
        operation,
        required: true
      }),
      /temporarily unavailable/
    )
  }
})

test("FR-093 rejects malformed state and applies limited/refuse mode to direct chat and search", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-response-mode-")))
  const base: RagSafetyState = {
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: "runtime-v2",
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: false,
    documentQuarantineRequired: false,
    responseMode: "limited",
    updatedAt: observedAt,
    validUntil: "2099-01-01T00:00:00.000Z"
  }
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify(base))
  await assert.rejects(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", operation: "chat", required: true }),
    /limited response mode/
  )
  await assert.rejects(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", operation: "search", required: true }),
    /limited response mode/
  )

  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify({ ...base, updatedAt: "not-a-timestamp" }))
  await assert.rejects(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", operation: "ingest", required: true }),
    /invalid or unsupported/
  )
})

test("FR-093 rejects an expired normal safety state instead of trusting stale green state", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-expired-state-")))
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: "runtime-v2",
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: false,
    documentQuarantineRequired: false,
    responseMode: "normal",
    updatedAt: "2020-01-01T00:00:00.000Z",
    validUntil: "2020-01-01T00:10:00.000Z"
  } satisfies RagSafetyState))

  await assert.rejects(
    () => assertRagSafetyInterlock({
      objectStore: store,
      runtimeProfileVersion: "runtime-v2",
      required: true,
      now: "2026-07-11T02:00:00.000Z"
    }),
    /safety state is expired/
  )
})

test("FR-093 a concurrent passing window cannot clear a newer restrictive safety action", async () => {
  const restrictedState: RagSafetyState = {
    schemaVersion: 1,
    stateVersion: 2,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: "runtime-v1",
    quarantinedRuntimeProfileVersions: ["runtime-v2"],
    promotionFrozen: true,
    documentQuarantineRequired: true,
    responseMode: "refuse",
    lastActionAt: "2026-07-11T02:00:30.000Z",
    updatedAt: "2026-07-11T02:00:30.000Z",
    validUntil: "2026-07-11T02:20:00.000Z"
  }
  class RestrictiveRaceObjectStore extends LocalObjectStore {
    private injected = false

    override async putTextIfVersion(
      key: string,
      text: string,
      expectedVersion: string | undefined,
      contentType?: string
    ): Promise<void> {
      if (key === RAG_SAFETY_STATE_KEY && !this.injected) {
        this.injected = true
        await super.putText(key, JSON.stringify(restrictedState), "application/json")
      }
      await super.putTextIfVersion(key, text, expectedVersion, contentType)
    }
  }

  const store = new RestrictiveRaceObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-state-race-")))
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify(approvedPolicy()))
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify({
    ...restrictedState,
    stateVersion: 1,
    activeRuntimeProfileVersion: "runtime-v2",
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: false,
    documentQuarantineRequired: false,
    responseMode: "normal",
    lastActionAt: undefined,
    updatedAt: "2026-07-11T01:50:00.000Z"
  } satisfies RagSafetyState))
  const monitor = new ProductionRagMonitor(store)
  await recordPassingWindow(monitor)

  const evidence = await monitor.evaluateWindow({
    windowStart: "2026-07-11T00:00:00.000Z",
    windowEnd: "2026-07-11T02:00:00.000Z",
    evaluatedAt: "2026-07-11T02:00:00.000Z"
  })
  const state = JSON.parse(await store.getText(RAG_SAFETY_STATE_KEY)) as RagSafetyState
  assert.equal(evidence.decision.status, "pass")
  assert.equal(state.stateVersion, 3)
  assert.equal(state.activeRuntimeProfileVersion, "runtime-v1")
  assert.equal(state.promotionFrozen, true)
  assert.equal(state.documentQuarantineRequired, true)
  assert.equal(state.responseMode, "refuse")
  assert.deepEqual(state.quarantinedRuntimeProfileVersions, ["runtime-v2"])
})
