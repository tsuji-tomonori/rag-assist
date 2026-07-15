import { randomUUID } from "node:crypto"
import type { ObjectStore } from "../adapters/object-store.js"
import type { JsonValue } from "../types.js"

export const SECURITY_MUTATION_AUDIT_SCHEMA_VERSION = 1 as const

export type SecurityMutationResult = "success" | "denied" | "conflict" | "failed"

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
  status: "pending" | "finalization_pending" | "completed"
  draft: SecurityMutationAuditDraft
  requestedCompletion?: Readonly<{
    result: SecurityMutationResult
    after: JsonValue
    requestedAt: string
  }>
  result?: SecurityMutationResult
  after?: JsonValue
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
    return intents.filter((intent) => intent.status !== "completed").slice(0, limit)
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
    || !["pending", "finalization_pending", "completed"].includes(intent.status)
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
  return intent
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

function sameJson(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isSecurityMutationResult(value: unknown): value is SecurityMutationResult {
  return value === "success" || value === "denied" || value === "conflict" || value === "failed"
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
