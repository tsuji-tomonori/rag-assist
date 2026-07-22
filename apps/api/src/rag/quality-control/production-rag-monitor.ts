import { createHash } from "node:crypto"

import {
  RAG_QUALITY_OBSERVATION_SCHEMA_VERSION,
  RAG_QUALITY_SIGNAL_CATALOG_VERSION,
  RAG_REQUIRED_SIGNAL_IDS,
  runRagMonitoringControlLoop,
  type RagMonitoringEvidence,
  type RagQualityAlert,
  type RagQualityObservation,
  type RagQualityPolicyProfile,
  type RagSafetyAction
} from "@memorag-mvp/contract/rag-quality-control"

import type { ObjectStore } from "../../adapters/object-store.js"
import type { RagAlertNotification, RagAlertPublisher } from "./rag-alert-publisher.js"

export const ACTIVE_RAG_QUALITY_POLICY_KEY = "quality-control/policies/active.json"
export const RAG_SAFETY_STATE_KEY = "quality-control/runtime/safety-state.json"
const observationPrefix = "quality-control/observations/"
const alertPrefix = "quality-control/alerts/"
const notificationOutboxPrefix = "quality-control/notification-outbox/"
const notificationDeadLetterPrefix = "quality-control/notification-dlq/"
const actionPrefix = "quality-control/actions/"
const DEFAULT_SAFETY_STATE_VALIDITY_MS = 10 * 60_000
const MAX_SAFETY_STATE_WRITE_ATTEMPTS = 5
const MAX_NOTIFICATION_ATTEMPTS = 5

type RagAlertNotificationOutboxRecord = {
  schemaVersion: 1
  notification: RagAlertNotification
  attempts: number
  lastAttemptAt: string
  lastError: "publish_failed"
}

export type RagSafetyState = {
  schemaVersion: 1
  stateVersion: number
  policyId: string
  policyVersion: string
  activeRuntimeProfileVersion: string
  quarantinedRuntimeProfileVersions: string[]
  promotionFrozen: boolean
  documentQuarantineRequired: boolean
  responseMode: "normal" | "limited" | "refuse"
  lastActionAt?: string
  updatedAt: string
  validUntil: string
}

export class RagSafetyInterlockError extends Error {
  readonly code = "RAG_SAFETY_INTERLOCK"

  constructor(message = "RAG is temporarily unavailable because a required safety control is not satisfied.") {
    super(message)
    this.name = "RagSafetyInterlockError"
  }
}

export type RagSafetyInterlockOperation = "chat" | "search" | "ingest" | "publication" | "promotion"

export type RagSafetyInterlockDecision = {
  operation: RagSafetyInterlockOperation
  activeRuntimeProfileVersion: string
  responseMode: RagSafetyState["responseMode"]
  documentQuarantineRequired: boolean
  promotionFrozen: boolean
}

export class ProductionRagMonitor {
  private readonly safetyStateValidityMs: number
  private readonly alertPublisher: RagAlertPublisher | undefined

  constructor(
    private readonly objectStore: ObjectStore,
    options: { safetyStateValidityMs?: number; alertPublisher?: RagAlertPublisher } = {}
  ) {
    this.safetyStateValidityMs = validSafetyStateValidityMs(
      options.safetyStateValidityMs ?? Number(process.env.RAG_SAFETY_STATE_TTL_SECONDS) * 1_000
    )
    this.alertPublisher = options.alertPublisher
  }

  async recordObservation(observation: RagQualityObservation): Promise<void> {
    assertRagQualityObservation(observation)
    const timestamp = safeKeyPart(observation.observedAt)
    const versionFingerprint = createHash("sha256").update(observationVersionKey(observation)).digest("hex").slice(0, 24)
    const key = `${observationPrefix}${timestamp}/${safeKeyPart(observation.profileId)}/${safeKeyPart(observation.profileVersion)}/${safeKeyPart(observation.runtimeProfileVersion)}/${versionFingerprint}/${safeKeyPart(observation.signalId)}/${safeKeyPart(observation.slice)}.json`
    await this.objectStore.putText(key, `${JSON.stringify(observation, null, 2)}\n`, "application/json; charset=utf-8")
  }

  async evaluateWindow(input: { windowStart: string; windowEnd: string; evaluatedAt?: string }): Promise<RagMonitoringEvidence> {
    await this.flushAlertNotificationOutbox()
    const policy = JSON.parse(await this.objectStore.getText(ACTIVE_RAG_QUALITY_POLICY_KEY)) as RagQualityPolicyProfile
    const observations = await this.loadLatestObservations(input.windowStart, input.windowEnd)
    const evaluatedAt = input.evaluatedAt ?? new Date().toISOString()
    const loadedState = await this.loadSafetyState(policy, evaluatedAt)
    let state = loadedState.state
    const actionRecords: RagSafetyAction[] = []

    const evidence = await runRagMonitoringControlLoop({
      policy,
      observations,
      evaluatedAt,
      notify: async (alert) => this.persistAndPublishAlert(alert, observations),
      executeAction: async (action) => {
        state = applySafetyAction(state, policy, action, evaluatedAt)
        actionRecords.push(action)
      }
    })

    if (evidence.decision.status === "pass") {
      state = {
        ...state,
        policyId: policy.profileId,
        policyVersion: policy.version,
        activeRuntimeProfileVersion: policy.runtimeProfileVersion,
        updatedAt: evaluatedAt
      }
    }
    state = {
      ...state,
      validUntil: timestampAfter(evaluatedAt, this.safetyStateValidityMs)
    }
    await this.persistSafetyState(state, loadedState.version)
    for (const action of actionRecords) {
      const key = `${actionPrefix}${safeKeyPart(evaluatedAt)}/${safeKeyPart(action)}.json`
      await this.objectStore.putText(key, `${JSON.stringify({
        action,
        policyId: policy.profileId,
        policyVersion: policy.version,
        runtimeProfileVersion: policy.runtimeProfileVersion,
        evaluatedAt,
        blockingReasons: evidence.decision.blockingReasons
      }, null, 2)}\n`, "application/json; charset=utf-8")
    }
    return evidence
  }

  private async loadLatestObservations(windowStart: string, windowEnd: string): Promise<RagQualityObservation[]> {
    const keys = await this.objectStore.listKeys(observationPrefix)
    const records = await Promise.all(keys.filter((key) => key.endsWith(".json")).map(async (key) => {
      try {
        const observation = JSON.parse(await this.objectStore.getText(key)) as RagQualityObservation
        assertRagQualityObservation(observation)
        return observation
      } catch {
        return undefined
      }
    }))
    const latest = new Map<string, RagQualityObservation>()
    for (const record of records) {
      if (!record || record.observedAt < windowStart || record.observedAt > windowEnd) continue
      const key = `${record.signalId}\u0000${record.slice}\u0000${observationVersionKey(record)}`
      const current = latest.get(key)
      if (!current || current.observedAt < record.observedAt) latest.set(key, record)
    }
    return [...latest.values()]
  }

  private async loadSafetyState(
    policy: RagQualityPolicyProfile,
    now: string
  ): Promise<{ state: RagSafetyState; version: string | undefined }> {
    try {
      const stored = await this.objectStore.getTextWithVersion(RAG_SAFETY_STATE_KEY)
      const state = JSON.parse(stored.text) as RagSafetyState
      assertRagSafetyState(state)
      return { state, version: stored.version }
    } catch (error) {
      if (!isMissingObject(error)) throw error
      return { state: {
        schemaVersion: 1,
        stateVersion: 0,
        policyId: policy.profileId,
        policyVersion: policy.version,
        activeRuntimeProfileVersion: policy.runtimeProfileVersion,
        quarantinedRuntimeProfileVersions: [],
        promotionFrozen: false,
        documentQuarantineRequired: false,
        responseMode: "normal",
        updatedAt: now,
        validUntil: now
      }, version: undefined }
    }
  }

  private async persistSafetyState(candidate: RagSafetyState, expectedVersion: string | undefined): Promise<void> {
    let next = candidate
    let version = expectedVersion
    for (let attempt = 0; attempt < MAX_SAFETY_STATE_WRITE_ATTEMPTS; attempt += 1) {
      next = { ...next, stateVersion: Math.max(1, next.stateVersion + 1) }
      try {
        await this.objectStore.putTextIfVersion(
          RAG_SAFETY_STATE_KEY,
          `${JSON.stringify(next, null, 2)}\n`,
          version,
          "application/json; charset=utf-8"
        )
        return
      } catch (error) {
        if (!isConditionalWrite(error)) throw error
      }
      const stored = await this.objectStore.getTextWithVersion(RAG_SAFETY_STATE_KEY)
      const current = JSON.parse(stored.text) as RagSafetyState
      assertRagSafetyState(current)
      next = mergeSafetyStates(current, next)
      version = stored.version
    }
    throw new Error("RAG safety state update did not converge after conditional-write retries")
  }

  private async persistAndPublishAlert(
    alert: RagQualityAlert,
    observations: RagQualityObservation[]
  ): Promise<void> {
    const key = `${alertPrefix}${safeKeyPart(alert.createdAt)}/${safeKeyPart(alert.alertId)}.json`
    await this.objectStore.putText(key, `${JSON.stringify(alert, null, 2)}\n`, "application/json; charset=utf-8")
    const observation = observations.find((item) => item.signalId === alert.signalId && item.slice === alert.slice)
    const notification = toAlertNotification(alert, observation)
    if (!this.alertPublisher) {
      await this.persistNotificationOutbox(notification, 0, alert.createdAt)
      return
    }
    try {
      await this.alertPublisher.publish(notification)
    } catch {
      await this.persistNotificationOutbox(notification, 1, alert.createdAt)
    }
  }

  private async flushAlertNotificationOutbox(limit = 100): Promise<void> {
    if (!this.alertPublisher) return
    const keys = (await this.objectStore.listKeys(notificationOutboxPrefix)).filter((key) => key.endsWith(".json")).slice(0, limit)
    for (const key of keys) {
      let record: RagAlertNotificationOutboxRecord
      try {
        record = JSON.parse(await this.objectStore.getText(key)) as RagAlertNotificationOutboxRecord
        assertNotificationOutboxRecord(record)
      } catch {
        continue
      }
      try {
        await this.alertPublisher.publish(record.notification)
        await this.objectStore.deleteObject(key)
      } catch {
        const attempts = record.attempts + 1
        const attemptedAt = new Date().toISOString()
        const next = { ...record, attempts, lastAttemptAt: attemptedAt }
        if (attempts >= MAX_NOTIFICATION_ATTEMPTS) {
          await this.objectStore.putText(
            `${notificationDeadLetterPrefix}${safeKeyPart(record.notification.alertId)}.json`,
            `${JSON.stringify(next, null, 2)}\n`,
            "application/json; charset=utf-8"
          )
          await this.objectStore.deleteObject(key)
        } else {
          await this.objectStore.putText(key, `${JSON.stringify(next, null, 2)}\n`, "application/json; charset=utf-8")
        }
      }
    }
  }

  private async persistNotificationOutbox(
    notification: RagAlertNotification,
    attempts: number,
    attemptedAt: string
  ): Promise<void> {
    const record: RagAlertNotificationOutboxRecord = {
      schemaVersion: 1,
      notification,
      attempts,
      lastAttemptAt: attemptedAt,
      lastError: "publish_failed"
    }
    await this.objectStore.putText(
      `${notificationOutboxPrefix}${safeKeyPart(notification.alertId)}.json`,
      `${JSON.stringify(record, null, 2)}\n`,
      "application/json; charset=utf-8"
    )
  }
}

function observationVersionKey(observation: RagQualityObservation): string {
  const dimensions = Object.entries(observation.source.versionDimensions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, values]) => `${name}=${[...values].sort().join(",")}`)
    .join("|")
  return [
    observation.profileId,
    observation.profileVersion,
    observation.workloadProfileVersion,
    observation.runtimeProfileVersion,
    observation.priceCatalogVersion,
    dimensions
  ].join("\u0000")
}

export async function assertRagSafetyInterlock(input: {
  objectStore: ObjectStore
  runtimeProfileVersion: string
  operation?: RagSafetyInterlockOperation
  required?: boolean
  now?: string
}): Promise<RagSafetyInterlockDecision | undefined> {
  const configuredMonitoringRequired = process.env.RAG_MONITORING_REQUIRED
  const required = input.required ?? configuredMonitoringRequired === "1"
  const explicitlyDisabled = input.required === false
    || (input.required === undefined && configuredMonitoringRequired === "0")
  if (explicitlyDisabled) return
  const operation = input.operation ?? "chat"
  let state: RagSafetyState
  try {
    state = JSON.parse(await input.objectStore.getText(RAG_SAFETY_STATE_KEY)) as RagSafetyState
  } catch {
    if (required) throw new RagSafetyInterlockError("RAG safety state is unavailable.")
    return
  }
  assertRagSafetyState(state)
  const now = input.now ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(now)) || Date.parse(state.validUntil) <= Date.parse(now)) {
    throw new RagSafetyInterlockError("RAG safety state is expired.")
  }
  if (state.activeRuntimeProfileVersion !== input.runtimeProfileVersion) {
    throw new RagSafetyInterlockError("The requested RAG runtime is not the active monitored runtime.")
  }
  const runtimeQuarantined = state.quarantinedRuntimeProfileVersions.includes(input.runtimeProfileVersion)
  if (runtimeQuarantined && operation !== "ingest") {
    throw new RagSafetyInterlockError()
  }
  if ((operation === "chat" || operation === "search") && state.responseMode !== "normal") {
    throw new RagSafetyInterlockError(`RAG ${state.responseMode} response mode is active.`)
  }
  if ((operation === "publication" || operation === "promotion") && state.promotionFrozen) {
    throw new RagSafetyInterlockError("RAG promotion is frozen by the monitoring control loop.")
  }
  if (operation === "publication" && state.documentQuarantineRequired) {
    throw new RagSafetyInterlockError("RAG document publication is blocked while quarantine is required.")
  }
  return {
    operation,
    activeRuntimeProfileVersion: state.activeRuntimeProfileVersion,
    responseMode: state.responseMode,
    documentQuarantineRequired: state.documentQuarantineRequired || runtimeQuarantined,
    promotionFrozen: state.promotionFrozen
  }
}

function assertRagSafetyState(state: RagSafetyState): void {
  if (
    state.schemaVersion !== 1
    || !Number.isInteger(state.stateVersion)
    || state.stateVersion < 1
    || !state.policyId?.trim()
    || !state.policyVersion?.trim()
    || !state.activeRuntimeProfileVersion?.trim()
    || !Array.isArray(state.quarantinedRuntimeProfileVersions)
    || state.quarantinedRuntimeProfileVersions.some((version) => typeof version !== "string" || !version.trim())
    || typeof state.promotionFrozen !== "boolean"
    || typeof state.documentQuarantineRequired !== "boolean"
    || !["normal", "limited", "refuse"].includes(state.responseMode)
    || !Number.isFinite(Date.parse(state.updatedAt))
    || !Number.isFinite(Date.parse(state.validUntil))
    || Date.parse(state.validUntil) <= Date.parse(state.updatedAt)
  ) throw new RagSafetyInterlockError("RAG safety state is invalid or unsupported.")
}

function applySafetyAction(
  state: RagSafetyState,
  policy: RagQualityPolicyProfile,
  action: RagSafetyAction,
  now: string
): RagSafetyState {
  const next: RagSafetyState = { ...state, updatedAt: now, lastActionAt: now }
  if (action === "promotion_freeze") next.promotionFrozen = true
  if (action === "candidate_quarantine") {
    next.quarantinedRuntimeProfileVersions = [...new Set([...next.quarantinedRuntimeProfileVersions, policy.runtimeProfileVersion])]
  }
  if (action === "document_quarantine") next.documentQuarantineRequired = true
  if (action === "rollback_last_known_safe" && policy.responsePolicy.lastKnownSafeRuntimeVersion) {
    next.activeRuntimeProfileVersion = policy.responsePolicy.lastKnownSafeRuntimeVersion
  }
  if (action === "limited_answer") next.responseMode = next.responseMode === "refuse" ? "refuse" : "limited"
  if (action === "refuse_answer") next.responseMode = "refuse"
  return next
}

function mergeSafetyStates(current: RagSafetyState, candidate: RagSafetyState): RagSafetyState {
  const responseRank = { normal: 0, limited: 1, refuse: 2 } as const
  const currentActionIsNewer = Boolean(
    current.lastActionAt
    && (!candidate.lastActionAt || Date.parse(current.lastActionAt) >= Date.parse(candidate.lastActionAt))
  )
  return {
    ...candidate,
    stateVersion: Math.max(current.stateVersion, candidate.stateVersion),
    activeRuntimeProfileVersion: currentActionIsNewer
      ? current.activeRuntimeProfileVersion
      : candidate.activeRuntimeProfileVersion,
    quarantinedRuntimeProfileVersions: [...new Set([
      ...current.quarantinedRuntimeProfileVersions,
      ...candidate.quarantinedRuntimeProfileVersions
    ])],
    promotionFrozen: current.promotionFrozen || candidate.promotionFrozen,
    documentQuarantineRequired: current.documentQuarantineRequired || candidate.documentQuarantineRequired,
    responseMode: responseRank[current.responseMode] > responseRank[candidate.responseMode]
      ? current.responseMode
      : candidate.responseMode,
    lastActionAt: latestTimestamp(current.lastActionAt, candidate.lastActionAt),
    updatedAt: latestTimestamp(current.updatedAt, candidate.updatedAt)!,
    validUntil: latestTimestamp(current.validUntil, candidate.validUntil)!
  }
}

function latestTimestamp(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) return right
  if (!right) return left
  return Date.parse(left) >= Date.parse(right) ? left : right
}

function timestampAfter(timestamp: string, durationMs: number): string {
  const value = Date.parse(timestamp)
  if (!Number.isFinite(value)) throw new Error("Invalid RAG safety-state evaluation timestamp")
  return new Date(value + durationMs).toISOString()
}

function validSafetyStateValidityMs(value: number): number {
  return Number.isFinite(value) && value >= 60_000
    ? Math.floor(value)
    : DEFAULT_SAFETY_STATE_VALIDITY_MS
}

function isMissingObject(error: unknown): boolean {
  const value = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return value.code === "ENOENT"
    || value.name === "NoSuchKey"
    || value.$metadata?.httpStatusCode === 404
}

function isConditionalWrite(error: unknown): boolean {
  const value = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return value.code === "PRECONDITION_FAILED"
    || value.name === "PreconditionFailed"
    || value.$metadata?.httpStatusCode === 412
}

function toAlertNotification(
  alert: RagQualityAlert,
  observation: RagQualityObservation | undefined
): RagAlertNotification {
  return {
    schemaVersion: 1,
    alertId: safeNotificationString(alert.alertId),
    severity: alert.severity,
    owner: safeNotificationString(alert.owner),
    profile: {
      id: safeNotificationString(alert.policyId),
      version: safeNotificationString(alert.policyVersion)
    },
    affected: {
      runtimeProfileVersion: safeNotificationString(alert.runtimeProfileVersion),
      signalId: safeNotificationString(alert.signalId),
      slice: safeNotificationString(alert.slice),
      versionDimensions: Object.fromEntries(Object.entries(observation?.source.versionDimensions ?? {}).map(([dimension, versions]) => [
        safeNotificationString(dimension),
        versions.slice(0, 20).map(safeNotificationString)
      ]))
    },
    reason: safeNotificationString(alert.reason),
    traceIds: alert.traceIds.slice(0, 20).map(safeNotificationString),
    runbookVersion: safeNotificationString(alert.runbookVersion),
    createdAt: alert.createdAt
  }
}

function assertNotificationOutboxRecord(record: RagAlertNotificationOutboxRecord): void {
  if (
    record.schemaVersion !== 1
    || record.notification?.schemaVersion !== 1
    || !record.notification.alertId?.trim()
    || !Number.isInteger(record.attempts)
    || record.attempts < 0
  ) throw new Error("Invalid RAG alert notification outbox record")
}

function safeNotificationString(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0
      return code <= 31 || code === 127 ? " " : character
    })
    .join("")
    .trim()
    .slice(0, 512)
}

function safeKeyPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, "_")
}

export function assertRagQualityObservation(observation: RagQualityObservation): void {
  const validIdentity = observation.schemaVersion === RAG_QUALITY_OBSERVATION_SCHEMA_VERSION
    && observation.signalCatalogVersion === RAG_QUALITY_SIGNAL_CATALOG_VERSION
    && Boolean(observation.profileId?.trim())
    && Boolean(observation.profileVersion?.trim())
    && Boolean(observation.slice?.trim())
    && Boolean(observation.workloadProfileVersion?.trim())
    && Boolean(observation.runtimeProfileVersion?.trim())
    && Boolean(observation.priceCatalogVersion?.trim())
    && RAG_REQUIRED_SIGNAL_IDS.includes(observation.signalId)
    && Number.isFinite(Date.parse(observation.observedAt))
    && Number.isInteger(observation.sampleCount)
    && observation.sampleCount >= 0
    && Boolean(observation.source?.producerVersion?.trim())
    && Array.isArray(observation.source?.artifactTypes)
    && Array.isArray(observation.source?.artifactIds)
    && observation.source?.versionDimensions !== undefined
    && Array.isArray(observation.source?.missingVersionDimensions)
    && Object.values(observation.source?.versionDimensions ?? {}).every((versions) => (
      Array.isArray(versions) && versions.every((version) => typeof version === "string" && Boolean(version.trim()))
    ))
  if (!validIdentity) throw new Error("Invalid RAG quality observation identity")
  if (observation.available) {
    if (
      observation.value === null
      || !Number.isFinite(observation.value)
      || observation.sampleCount < 1
      || observation.confidence === null
      || observation.confidence < 0
      || observation.confidence > 1
    ) throw new Error("Available RAG quality observation is incomplete")
    return
  }
  if (observation.value !== null || observation.confidence !== null) {
    throw new Error("Unavailable RAG quality observation must not contain a value or confidence")
  }
}
