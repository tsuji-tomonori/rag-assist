import type { JsonValue } from "../types.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent,
  SecurityMutationAuditReconciliationOutboxPort,
  SecurityMutationResult
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
}>

/**
 * Tenant-scoped consumer for durable mutation intents. Resolution is delegated
 * to an authoritative domain reader and is rechecked before every final CAS.
 */
export class SecurityMutationAuditReconciler {
  constructor(
    private readonly outbox: SecurityMutationAuditReconciliationOutboxPort,
    private readonly resolvers: readonly SecurityMutationAuditAuthoritativeResolver[]
  ) {
    if (resolvers.length === 0) throw new Error("At least one security mutation audit resolver is required")
  }

  async reconcileTenant(tenantId: string, limit = 100): Promise<SecurityMutationAuditReconciliationResult> {
    assertCanonicalIdentifier(tenantId, "tenantId")
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Security mutation audit reconciliation limit is invalid")
    }

    let repaired = 0
    for (const resolver of this.resolvers) {
      repaired += await resolver.repairCompleted?.(tenantId) ?? 0
    }

    const pending = await this.outbox.listPending(tenantId, limit)
    let completed = 0
    for (const intent of pending) {
      if (intent.draft.tenantId !== tenantId || intent.status === "completed") {
        throw new Error("Security mutation audit pending enumeration crossed its tenant boundary")
      }
      const matching = this.resolvers.filter((resolver) => resolver.supports(intent.draft))
      if (matching.length !== 1) {
        throw new Error("Security mutation audit intent has no unique authoritative resolver")
      }
      const resolver = matching[0]!
      const resolution = await resolver.resolve(intent)
      validateResolution(resolution)
      if (
        intent.requestedCompletion
        && (
          intent.requestedCompletion.result !== resolution.result
          || !sameJson(intent.requestedCompletion.after, resolution.after)
        )
      ) throw new Error("Authoritative state does not confirm the requested audit completion")

      const finalIntent = await this.outbox.complete(
        intent.intentId,
        tenantId,
        resolution.result,
        resolution.after
      )
      if (finalIntent.status !== "completed") {
        throw new Error("Security mutation audit finalization did not produce a completed event")
      }
      await resolver.afterCompleted?.(finalIntent)
      completed += 1
    }

    return { tenantId, scanned: pending.length, completed, repaired }
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
