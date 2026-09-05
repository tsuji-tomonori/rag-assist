import { randomUUID } from "node:crypto"
import type { ObjectStore } from "../adapters/object-store.js"
import type { JsonValue } from "../types.js"

export const SECURITY_MUTATION_AUDIT_SCHEMA_VERSION = 1 as const
export const SECURITY_MUTATION_AUDIT_MAX_RECONCILIATION_ATTEMPTS = 3 as const

export type SecurityMutationResult = "success" | "denied" | "conflict" | "failed"
export type SecurityMutationAuditReconciliationFailureCode =
  | "resolver_selection_failed"
  | "authoritative_resolution_failed"
  | "audit_completion_failed"

export type SecurityMutationAuditReconciliationEvidence = Readonly<{
  attempts: number
  maxAttempts: number
  lastFailureCode: SecurityMutationAuditReconciliationFailureCode
  lastAttemptedAt: string
  quarantinedAt?: string
}>

export type SecurityMutationAuditRedriveRecord = Readonly<{
  idempotencyKey: string
  actorId: string
  reason: string
  policyVersion: string
  requestedAt: string
  restoredStatus: "pending" | "finalization_pending"
  previousReconciliation: SecurityMutationAuditReconciliationEvidence
}>

export type SecurityMutationAuditRedriveCommand = Readonly<{
  actorId: string
  idempotencyKey: string
  reason: string
  policyVersion: string
}>

export type SecurityMutationAuditRedriveResult = Readonly<{
  intentId: string
  status: "pending" | "finalization_pending"
  idempotencyKey: string
  requestedAt: string
  redriveCount: number
}>

export type SecurityMutationAuditRedriveErrorCode =
  | "not_found"
  | "not_quarantined"
  | "idempotency_conflict"
  | "unavailable"

export type SecurityMutationAuditDraft = Readonly<{
  actorId: string
  tenantId: string
  targetType: string
  targetId: string
  operation: string
  before: JsonValue
  proposedAfter: JsonValue
  reason: string
  policyVersion: string
}>

export type SecurityMutationAuditIntent = Readonly<{
  schemaVersion: typeof SECURITY_MUTATION_AUDIT_SCHEMA_VERSION
  intentId: string
  status: "pending" | "finalization_pending" | "quarantined" | "completed"
  draft: SecurityMutationAuditDraft
  requestedCompletion?: Readonly<{
    result: SecurityMutationResult
    after: JsonValue
    requestedAt: string
  }>
  result?: SecurityMutationResult
  after?: JsonValue
  reconciliation?: SecurityMutationAuditReconciliationEvidence
  redriveHistory?: readonly SecurityMutationAuditRedriveRecord[]
  createdAt: string
  completedAt?: string
}>

export interface SecurityMutationAuditOutboxPort {
  prepare(draft: SecurityMutationAuditDraft): Promise<SecurityMutationAuditIntent>
  complete(intentId: string, tenantId: string, result: SecurityMutationResult, after: JsonValue): Promise<SecurityMutationAuditIntent>
  /** Production mutation paths use this to prevent a newer mutation overtaking pending finalization. */
  get?(tenantId: string, intentId: string): Promise<SecurityMutationAuditIntent>
}

export interface SecurityMutationAuditReconciliationOutboxPort extends SecurityMutationAuditOutboxPort {
  get(tenantId: string, intentId: string): Promise<SecurityMutationAuditIntent>
  listPending(tenantId: string, limit?: number): Promise<SecurityMutationAuditIntent[]>
  listAll(tenantId: string): Promise<SecurityMutationAuditIntent[]>
  recordReconciliationFailure(
    tenantId: string,
    intentId: string,
    failureCode: SecurityMutationAuditReconciliationFailureCode,
    maxAttempts: number
  ): Promise<SecurityMutationAuditIntent>
  redriveQuarantined(
    tenantId: string,
    intentId: string,
    input: SecurityMutationAuditRedriveCommand
  ): Promise<SecurityMutationAuditRedriveResult>
}

export class SecurityMutationAuditRedriveError extends Error {
  constructor(readonly code: SecurityMutationAuditRedriveErrorCode, options?: ErrorOptions) {
    super("Security mutation audit quarantine redrive failed", options)
    this.name = "SecurityMutationAuditRedriveError"
  }
}

export class SecurityMutationAuditCompletionPendingError extends Error {
  constructor(
    readonly intent: SecurityMutationAuditIntent,
    options?: ErrorOptions
  ) {
    super("Security mutation audit finalization remains pending", options)
    this.name = "SecurityMutationAuditCompletionPendingError"
  }
}

/**
 * Durable publication intent used when the protected store and audit store do
 * not share a database transaction. The intent is persisted before mutation;
 * a pending intent is therefore sufficient for deterministic reconciliation.
 */
export class ObjectStoreSecurityMutationAuditOutbox implements SecurityMutationAuditReconciliationOutboxPort {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async prepare(draft: SecurityMutationAuditDraft): Promise<SecurityMutationAuditIntent> {
    validateDraft(draft)
    const intent: SecurityMutationAuditIntent = {
      schemaVersion: SECURITY_MUTATION_AUDIT_SCHEMA_VERSION,
      intentId: `security_mutation_${randomUUID()}`,
      status: "pending",
      draft,
      createdAt: this.now().toISOString()
    }
    await this.objectStore.putTextIfVersion(
      intentKey(draft.tenantId, intent.intentId),
      JSON.stringify(intent, null, 2),
      undefined,
      "application/json"
    )
    return intent
  }

  async complete(
    intentId: string,
    tenantId: string,
    result: SecurityMutationResult,
    after: JsonValue
  ): Promise<SecurityMutationAuditIntent> {
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(intentId, "intentId")
    if (!isSecurityMutationResult(result) || !isJsonValue(after)) {
      throw new Error("Security mutation audit completion is invalid")
    }
    const key = intentKey(tenantId, intentId)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await this.readVersioned(tenantId, intentId)
      const parsed = current.intent
      if (parsed.status === "completed") return assertSameCompletion(parsed, result, after)

      let staged = parsed
      let stagedVersion = current.version
      if (parsed.status === "pending") {
        staged = {
          ...parsed,
          status: "finalization_pending",
          requestedCompletion: {
            result,
            after,
            requestedAt: this.now().toISOString()
          }
        }
        try {
          await this.objectStore.putTextIfVersion(
            key,
            JSON.stringify(staged, null, 2),
            current.version,
            "application/json"
          )
        } catch (error) {
          if (isConditionalWriteError(error)) continue
          throw error
        }
        const durable = await this.readVersioned(tenantId, intentId)
        staged = durable.intent
        stagedVersion = durable.version
      }

      const requested = staged.requestedCompletion
      if (!requested || requested.result !== result || !sameJson(requested.after, after)) {
        throw new Error("Security mutation audit intent is pending a different result")
      }
      const completed: SecurityMutationAuditIntent = {
        ...staged,
        status: "completed",
        result: requested.result,
        after: requested.after,
        completedAt: this.now().toISOString()
      }
      try {
        await this.objectStore.putTextIfVersion(
          key,
          JSON.stringify(completed, null, 2),
          stagedVersion,
          "application/json"
        )
        return completed
      } catch (error) {
        if (isConditionalWriteError(error)) continue
        throw new SecurityMutationAuditCompletionPendingError(staged, { cause: error })
      }
    }

    const winner = await this.get(tenantId, intentId)
    if (winner.status === "completed") return assertSameCompletion(winner, result, after)
    if (
      winner.status === "finalization_pending"
      && winner.requestedCompletion?.result === result
      && sameJson(winner.requestedCompletion.after, after)
    ) throw new SecurityMutationAuditCompletionPendingError(winner)
    throw new Error("Security mutation audit finalization did not converge")
  }

  async get(tenantId: string, intentId: string): Promise<SecurityMutationAuditIntent> {
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(intentId, "intentId")
    return (await this.readVersioned(tenantId, intentId)).intent
  }

  async listPending(tenantId: string, limit = 100): Promise<SecurityMutationAuditIntent[]> {
    assertIdentifier(tenantId, "tenantId")
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Security mutation audit pending-list limit is invalid")
    }
    const intents = await this.listAll(tenantId)
    return intents.filter((intent) => intent.status !== "completed" && intent.status !== "quarantined").slice(0, limit)
  }

  async recordReconciliationFailure(
    tenantId: string,
    intentId: string,
    failureCode: SecurityMutationAuditReconciliationFailureCode,
    maxAttempts: number
  ): Promise<SecurityMutationAuditIntent> {
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(intentId, "intentId")
    if (!isReconciliationFailureCode(failureCode)) {
      throw new Error("Security mutation audit reconciliation failure code is invalid")
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) {
      throw new Error("Security mutation audit reconciliation attempt limit is invalid")
    }
    const key = intentKey(tenantId, intentId)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await this.readVersioned(tenantId, intentId)
      if (current.intent.status === "completed" || current.intent.status === "quarantined") return current.intent
      if (current.intent.reconciliation && current.intent.reconciliation.maxAttempts !== maxAttempts) {
        throw new Error("Security mutation audit reconciliation attempt policy changed while pending")
      }
      const attempts = (current.intent.reconciliation?.attempts ?? 0) + 1
      const attemptedAt = this.now().toISOString()
      const quarantined = attempts >= maxAttempts
      const updated: SecurityMutationAuditIntent = {
        ...current.intent,
        status: quarantined ? "quarantined" : current.intent.status,
        reconciliation: {
          attempts,
          maxAttempts,
          lastFailureCode: failureCode,
          lastAttemptedAt: attemptedAt,
          ...(quarantined ? { quarantinedAt: attemptedAt } : {})
        }
      }
      try {
        await this.objectStore.putTextIfVersion(
          key,
          JSON.stringify(updated, null, 2),
          current.version,
          "application/json"
        )
        return updated
      } catch (error) {
        if (isConditionalWriteError(error)) continue
        throw error
      }
    }
    const winner = await this.get(tenantId, intentId)
    if (winner.status === "completed" || winner.status === "quarantined") return winner
    throw new Error("Security mutation audit reconciliation failure recording did not converge")
  }

  async redriveQuarantined(
    tenantId: string,
    intentId: string,
    input: SecurityMutationAuditRedriveCommand
  ): Promise<SecurityMutationAuditRedriveResult> {
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(intentId, "intentId")
    validateRedriveInput(input)
    const key = intentKey(tenantId, intentId)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await this.readRedriveCandidate(tenantId, intentId)
      const existing = findRedrive(current.intent, input.idempotencyKey)
      if (existing) return sameRedriveResult(current.intent, existing, input)
      if (current.intent.status !== "quarantined" || !current.intent.reconciliation) {
        throw new SecurityMutationAuditRedriveError("not_quarantined")
      }

      const restoredStatus = current.intent.requestedCompletion ? "finalization_pending" : "pending"
      const record: SecurityMutationAuditRedriveRecord = {
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId,
        reason: input.reason,
        policyVersion: input.policyVersion,
        requestedAt: this.now().toISOString(),
        restoredStatus,
        previousReconciliation: current.intent.reconciliation
      }
      const history = [...(current.intent.redriveHistory ?? []), record]
      const updated: SecurityMutationAuditIntent = {
        ...current.intent,
        status: restoredStatus,
        reconciliation: undefined,
        redriveHistory: history
      }
      try {
        await this.objectStore.putTextIfVersion(
          key,
          JSON.stringify(updated, null, 2),
          current.version,
          "application/json"
        )
        return redriveResult(updated.intentId, record, history.length)
      } catch (error) {
        if (isConditionalWriteError(error)) continue
        throw new SecurityMutationAuditRedriveError("unavailable", { cause: error })
      }
    }

    const winner = await this.readRedriveCandidate(tenantId, intentId)
    const existing = findRedrive(winner.intent, input.idempotencyKey)
    if (existing) return sameRedriveResult(winner.intent, existing, input)
    if (winner.intent.status !== "quarantined") {
      throw new SecurityMutationAuditRedriveError("not_quarantined")
    }
    throw new SecurityMutationAuditRedriveError("unavailable")
  }

  async listAll(tenantId: string): Promise<SecurityMutationAuditIntent[]> {
    assertIdentifier(tenantId, "tenantId")
    const prefix = intentPrefix(tenantId)
    const keys = (await this.objectStore.listKeys(prefix))
      .filter((key) => key.endsWith(".json"))
      .sort()
    return Promise.all(keys.map(async (key) => {
      const stored = await this.objectStore.getTextWithVersion(key)
      const intent = parseAndValidateIntent(stored.text, tenantId)
      if (key !== intentKey(tenantId, intent.intentId)) {
        throw new Error("Security mutation audit intent storage key mismatch")
      }
      return intent
    }))
  }

  private async readVersioned(
    tenantId: string,
    intentId: string
  ): Promise<{ intent: SecurityMutationAuditIntent; version: string }> {
    let stored
    try {
      stored = await this.objectStore.getTextWithVersion(intentKey(tenantId, intentId))
    } catch (error) {
      if (isMissingObjectError(error)) throw new Error("Security mutation audit intent was not found", { cause: error })
      throw error
    }
    return {
      intent: parseAndValidateIntent(stored.text, tenantId, intentId),
      version: stored.version
    }
  }

  private async readRedriveCandidate(
    tenantId: string,
    intentId: string
  ): Promise<{ intent: SecurityMutationAuditIntent; version: string }> {
    try {
      return await this.readVersioned(tenantId, intentId)
    } catch (error) {
      if (error instanceof Error && error.message === "Security mutation audit intent was not found") {
        throw new SecurityMutationAuditRedriveError("not_found", { cause: error })
      }
      if (error instanceof SecurityMutationAuditRedriveError) throw error
      throw new SecurityMutationAuditRedriveError("unavailable", { cause: error })
    }
  }
}

function validateDraft(draft: SecurityMutationAuditDraft): void {
  for (const value of [
    draft.actorId,
    draft.tenantId,
    draft.targetType,
    draft.targetId,
    draft.operation,
    draft.reason,
    draft.policyVersion
  ]) {
    if (!value || value.trim() !== value) throw new Error("Security mutation audit field is missing or non-canonical")
  }
  if (!isJsonValue(draft.before) || !isJsonValue(draft.proposedAfter)) {
    throw new Error("Security mutation audit state is not valid JSON")
  }
}

function parseAndValidateIntent(
  text: string,
  tenantId: string,
  expectedIntentId?: string
): SecurityMutationAuditIntent {
  let intent: SecurityMutationAuditIntent
  try {
    intent = JSON.parse(text) as SecurityMutationAuditIntent
  } catch {
    throw new Error("Security mutation audit intent is not valid JSON")
  }
  if (
    intent.schemaVersion !== SECURITY_MUTATION_AUDIT_SCHEMA_VERSION
    || !["pending", "finalization_pending", "quarantined", "completed"].includes(intent.status)
    || intent.draft?.tenantId !== tenantId
    || (expectedIntentId !== undefined && intent.intentId !== expectedIntentId)
  ) throw new Error("Security mutation audit intent identity mismatch")
  assertIdentifier(intent.intentId, "intentId")
  validateDraft(intent.draft)
  if (
    intent.status === "pending"
    && (intent.requestedCompletion || "result" in intent || "after" in intent || "completedAt" in intent)
  ) {
    throw new Error("Pending security mutation audit intent contains final state")
  }
  if (intent.status === "finalization_pending") {
    validateRequestedCompletion(intent.requestedCompletion)
    if ("result" in intent || "after" in intent || "completedAt" in intent) {
      throw new Error("Finalization-pending audit intent is already finalized")
    }
  }
  if (intent.status === "quarantined") {
    if (intent.requestedCompletion) validateRequestedCompletion(intent.requestedCompletion)
    if ("result" in intent || "after" in intent || "completedAt" in intent) {
      throw new Error("Quarantined security mutation audit intent contains final state")
    }
  }
  if (intent.status === "completed") {
    if (
      !isSecurityMutationResult(intent.result)
      || !("after" in intent)
      || !isJsonValue(intent.after)
      || !isCanonicalTimestamp(intent.completedAt)
    ) {
      throw new Error("Completed security mutation audit intent is inconsistent")
    }
    // Earlier schema-v1 writers did not stage requestedCompletion. Keep those
    // completed, immutable records readable during rolling deployment.
    if (intent.requestedCompletion) {
      validateRequestedCompletion(intent.requestedCompletion)
      if (
        intent.result !== intent.requestedCompletion.result
        || !sameJson(intent.after, intent.requestedCompletion.after)
      ) throw new Error("Completed security mutation audit intent is inconsistent")
    }
  }
  if (!isCanonicalTimestamp(intent.createdAt)) throw new Error("Security mutation audit timestamp is invalid")
  if (intent.reconciliation) validateReconciliation(intent.reconciliation, intent.status)
  validateRedriveHistory(intent.redriveHistory, intent.requestedCompletion)
  return intent
}

function validateReconciliation(
  value: NonNullable<SecurityMutationAuditIntent["reconciliation"]>,
  status: SecurityMutationAuditIntent["status"]
): void {
  if (
    !Number.isInteger(value.attempts)
    || value.attempts < 1
    || !Number.isInteger(value.maxAttempts)
    || value.maxAttempts < 1
    || value.maxAttempts > 100
    || value.attempts > value.maxAttempts
    || !isReconciliationFailureCode(value.lastFailureCode)
    || !isCanonicalTimestamp(value.lastAttemptedAt)
  ) throw new Error("Security mutation audit reconciliation evidence is invalid")
  if (status === "quarantined") {
    if (value.attempts !== value.maxAttempts || !isCanonicalTimestamp(value.quarantinedAt)) {
      throw new Error("Security mutation audit quarantine evidence is invalid")
    }
  } else if (value.quarantinedAt !== undefined) {
    throw new Error("Security mutation audit non-quarantined intent contains quarantine evidence")
  }
}

function validateRequestedCompletion(
  requested: SecurityMutationAuditIntent["requestedCompletion"]
): asserts requested is NonNullable<SecurityMutationAuditIntent["requestedCompletion"]> {
  if (
    !requested
    || !isSecurityMutationResult(requested.result)
    || !isJsonValue(requested.after)
    || !isCanonicalTimestamp(requested.requestedAt)
  ) throw new Error("Security mutation audit completion request is invalid")
}

function validateRedriveHistory(
  history: SecurityMutationAuditIntent["redriveHistory"],
  requestedCompletion: SecurityMutationAuditIntent["requestedCompletion"]
): void {
  if (history === undefined) return
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error("Security mutation audit redrive history is invalid")
  }
  const keys = new Set<string>()
  for (const record of history) {
    if (
      !isCanonicalIdempotencyKey(record.idempotencyKey)
      || !isCanonicalBoundedText(record.actorId, 256)
      || !isCanonicalBoundedText(record.reason, 1_000)
      || !isCanonicalBoundedText(record.policyVersion, 256)
      || !isCanonicalTimestamp(record.requestedAt)
      || (record.restoredStatus !== "pending" && record.restoredStatus !== "finalization_pending")
      || (record.restoredStatus === "finalization_pending" && !requestedCompletion)
      || keys.has(record.idempotencyKey)
    ) throw new Error("Security mutation audit redrive history is invalid")
    validateReconciliation(record.previousReconciliation, "quarantined")
    keys.add(record.idempotencyKey)
  }
}

function validateRedriveInput(
  input: SecurityMutationAuditRedriveCommand
): void {
  if (
    !isCanonicalBoundedText(input.actorId, 256)
    || !isCanonicalIdempotencyKey(input.idempotencyKey)
    || !isCanonicalBoundedText(input.reason, 1_000)
    || !isCanonicalBoundedText(input.policyVersion, 256)
  ) throw new SecurityMutationAuditRedriveError("unavailable")
}

function findRedrive(
  intent: SecurityMutationAuditIntent,
  idempotencyKey: string
): SecurityMutationAuditRedriveRecord | undefined {
  return intent.redriveHistory?.find((record) => record.idempotencyKey === idempotencyKey)
}

function sameRedriveResult(
  intent: SecurityMutationAuditIntent,
  record: SecurityMutationAuditRedriveRecord,
  input: SecurityMutationAuditRedriveCommand
): SecurityMutationAuditRedriveResult {
  if (
    record.actorId !== input.actorId
    || record.reason !== input.reason
    || record.policyVersion !== input.policyVersion
  ) {
    throw new SecurityMutationAuditRedriveError("idempotency_conflict")
  }
  const index = intent.redriveHistory?.findIndex((candidate) => candidate.idempotencyKey === record.idempotencyKey) ?? -1
  if (index < 0) throw new SecurityMutationAuditRedriveError("unavailable")
  return redriveResult(intent.intentId, record, index + 1)
}

function redriveResult(
  intentId: string,
  record: SecurityMutationAuditRedriveRecord,
  redriveCount: number
): SecurityMutationAuditRedriveResult {
  return {
    intentId,
    status: record.restoredStatus,
    idempotencyKey: record.idempotencyKey,
    requestedAt: record.requestedAt,
    redriveCount
  }
}

function assertSameCompletion(
  intent: SecurityMutationAuditIntent,
  result: SecurityMutationResult,
  after: JsonValue
): SecurityMutationAuditIntent {
  if (intent.result === result && sameJson(intent.after, after)) return intent
  throw new Error("Security mutation audit intent is already completed with a different result")
}

function assertIdentifier(value: string, field: string): void {
  if (!value || value.trim() !== value) throw new Error(`Security mutation audit ${field} is invalid`)
}

function isCanonicalTimestamp(value: string | undefined): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value)
}

function isCanonicalBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && value.trim() === value
}

function isCanonicalIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
}

function sameJson(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isSecurityMutationResult(value: unknown): value is SecurityMutationResult {
  return value === "success" || value === "denied" || value === "conflict" || value === "failed"
}

function isReconciliationFailureCode(value: unknown): value is SecurityMutationAuditReconciliationFailureCode {
  return value === "resolver_selection_failed"
    || value === "authoritative_resolution_failed"
    || value === "audit_completion_failed"
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  return Object.values(value).every(isJsonValue)
}

function isConditionalWriteError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "PRECONDITION_FAILED"
    || candidate.name === "PreconditionFailed"
    || candidate.$metadata?.httpStatusCode === 412
    || candidate.message?.includes("Conditional write failed") === true
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "ENOENT"
    || candidate.name === "NoSuchKey"
    || candidate.name === "NotFound"
    || candidate.$metadata?.httpStatusCode === 404
    || candidate.message?.includes("NoSuchKey") === true
    || candidate.message?.includes("no such file") === true
}

function intentKey(tenantId: string, intentId: string): string {
  return `${intentPrefix(tenantId)}${encodeURIComponent(intentId)}.json`
}

function intentPrefix(tenantId: string): string {
  return `security-audit/intents/${encodeURIComponent(tenantId)}/`
}
