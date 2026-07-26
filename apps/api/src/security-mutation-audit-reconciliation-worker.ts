import { config } from "./config.js"
import type {
  SecurityMutationAuditReconciliationResult
} from "./security/security-mutation-audit-reconciler.js"

export type SecurityMutationAuditReconciliationEvent = Readonly<{
  tenantId?: unknown
  limit?: unknown
}>

type AuditReconciliationTarget = Readonly<{
  reconcileTenant(tenantId: string, limit?: number): Promise<SecurityMutationAuditReconciliationResult>
}>

export function createSecurityMutationAuditReconciliationHandler(input: Readonly<{
  authorizedTenantId: string
  reconciler: AuditReconciliationTarget
}>) {
  return async (
    event: SecurityMutationAuditReconciliationEvent
  ): Promise<SecurityMutationAuditReconciliationResult> => {
    if (!input.authorizedTenantId || input.authorizedTenantId.trim() !== input.authorizedTenantId) {
      throw new Error("Security mutation audit worker tenant is not configured")
    }
    if (typeof event.tenantId !== "string" || event.tenantId !== input.authorizedTenantId) {
      throw new Error("Security mutation audit worker tenant is not authorized")
    }
    const limit = event.limit === undefined ? 100 : event.limit
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Security mutation audit worker limit is invalid")
    }
    return input.reconciler.reconcileTenant(input.authorizedTenantId, limit)
  }
}

/**
 * Build the cost-priority EventBridge consumer.
 *
 * The synchronous mutation path still writes the durable audit intent. Only
 * background enumeration/finalization is deferred: this consumer validates
 * the tenant boundary and returns without constructing an S3-backed outbox or
 * listing source-governance records.
 */
export function createCostPrioritySecurityMutationAuditReconciliationHandler(authorizedTenantId: string) {
  return createSecurityMutationAuditReconciliationHandler({
    authorizedTenantId,
    reconciler: {
      reconcileTenant: async (tenantId) => ({
        tenantId,
        scanned: 0,
        completed: 0,
        repaired: 0
      })
    }
  })
}

export async function handler(
  event: SecurityMutationAuditReconciliationEvent
): Promise<SecurityMutationAuditReconciliationResult> {
  return createCostPrioritySecurityMutationAuditReconciliationHandler(config.authTenantId)(event)
}
