import type { JsonValue } from "../types.js"
import {
  SECURITY_MUTATION_AUDIT_MAX_RECONCILIATION_ATTEMPTS,
  type SecurityMutationAuditDraft,
  type SecurityMutationAuditIntent,
  type SecurityMutationAuditReconciliationFailureCode,
  type SecurityMutationAuditReconciliationOutboxPort,
  type SecurityMutationResult
} from "./security-mutation-audit-outbox.js"

export type SecurityMutationAuditAuthoritativeResolution = Readonly<{
  result: SecurityMutationResult
  after: JsonValue
}>

export interface SecurityMutationAuditAuthoritativeResolver {
  supports(draft: SecurityMutationAuditDraft): boolean
  resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution>
  afterCompleted?(intent: SecurityMutationAuditIntent): Promise<void>
  repairCompleted?(tenantId: string): Promise<number>
}

export type SecurityMutationAuditReconciliationResult = Readonly<{
  tenantId: string
  scanned: number
  completed: number
  repaired: number
  repairDeferred: number
  retryScheduled: number
  quarantined: number
}>

/**
 * Tenant-scoped consumer for durable mutation intents. Resolution is delegated
 * to an authoritative domain reader and is rechecked before every final CAS.
 */
export class SecurityMutationAuditReconciler {
  constructor(
    private readonly outbox: SecurityMutationAuditReconciliationOutboxPort,
    private readonly resolvers: readonly SecurityMutationAuditAuthoritativeResolver[],
    private readonly maxAttempts = SECURITY_MUTATION_AUDIT_MAX_RECONCILIATION_ATTEMPTS
  ) {
    if (resolvers.length === 0) throw new Error("At least one security mutation audit resolver is required")
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) {
      throw new Error("Security mutation audit reconciliation attempt limit is invalid")
    }
  }

  async reconcileTenant(tenantId: string, limit = 100): Promise<SecurityMutationAuditReconciliationResult> {
    assertCanonicalIdentifier(tenantId, "tenantId")
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Security mutation audit reconciliation limit is invalid")
    }

    let repaired = 0
    let repairDeferred = 0
    for (const resolver of this.resolvers) {
      try {
        repaired += await resolver.repairCompleted?.(tenantId) ?? 0
      } catch {
        repairDeferred += 1
      }
    }

    const pending = await this.outbox.listPending(tenantId, limit)
    let completed = 0
    let retryScheduled = 0
    let quarantined = 0
    for (const intent of pending) {
      if (
        intent.draft.tenantId !== tenantId
        || (intent.status !== "pending" && intent.status !== "finalization_pending")
      ) {
        throw new Error("Security mutation audit pending enumeration crossed its tenant boundary")
      }
      let failureCode: SecurityMutationAuditReconciliationFailureCode = "resolver_selection_failed"
      try {
        const matching = this.resolvers.filter((resolver) => resolver.supports(intent.draft))
        if (matching.length !== 1) throw new Error("Security mutation audit intent has no unique authoritative resolver")
        const resolver = matching[0]!
        failureCode = "authoritative_resolution_failed"
        const resolution = await resolver.resolve(intent)
        validateResolution(resolution)
        if (
          intent.requestedCompletion
          && (
            intent.requestedCompletion.result !== resolution.result
            || !sameJson(intent.requestedCompletion.after, resolution.after)
          )
        ) throw new Error("Authoritative state does not confirm the requested audit completion")

        failureCode = "audit_completion_failed"
        const finalIntent = await this.outbox.complete(
          intent.intentId,
          tenantId,
          resolution.result,
          resolution.after
        )
        if (finalIntent.status !== "completed") {
          throw new Error("Security mutation audit finalization did not produce a completed event")
        }
        completed += 1
        try {
          await resolver.afterCompleted?.(finalIntent)
        } catch {
          repairDeferred += 1
        }
      } catch {
        const recorded = await this.outbox.recordReconciliationFailure(
          tenantId,
          intent.intentId,
          failureCode,
          this.maxAttempts
        )
        if (recorded.status === "quarantined") quarantined += 1
        else if (recorded.status !== "completed") retryScheduled += 1
      }
    }

    return { tenantId, scanned: pending.length, completed, repaired, repairDeferred, retryScheduled, quarantined }
  }
}

function validateResolution(resolution: SecurityMutationAuditAuthoritativeResolution): void {
  if (!["success", "denied", "conflict", "failed"].includes(resolution.result) || !isJsonValue(resolution.after)) {
    throw new Error("Security mutation audit authoritative resolution is invalid")
  }
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

function sameJson(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertCanonicalIdentifier(value: string, field: string): void {
  if (!value || value.trim() !== value) throw new Error(`Security mutation audit ${field} is invalid`)
}
