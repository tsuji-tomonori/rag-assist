import { ROLE_CATALOG_VERSION } from "@memorag-mvp/contract/access-control"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import type {
  SecurityMutationAuditReconciliationOutboxPort,
  SecurityMutationAuditRedriveResult
} from "./security-mutation-audit-outbox.js"

export const SECURITY_MUTATION_AUDIT_REDRIVE_POLICY_VERSION =
  `security-audit-quarantine-redrive-v1:${ROLE_CATALOG_VERSION}` as const

export class SecurityMutationAuditQuarantineServiceError extends Error {
  constructor(readonly code: "forbidden" | "invalid_request" | "unavailable") {
    super("Security mutation audit quarantine operation failed")
    this.name = "SecurityMutationAuditQuarantineServiceError"
  }
}

/**
 * Tenant-scoped operator boundary for returning one quarantined audit intent to
 * the existing scheduled reconciliation path. It never invokes a resolver or
 * protected domain mutation directly.
 */
export class SecurityMutationAuditQuarantineService {
  constructor(private readonly outbox: SecurityMutationAuditReconciliationOutboxPort) {}

  async redrive(
    actor: AppUser,
    intentId: string,
    input: Readonly<{ idempotencyKey: string; reason: string }>
  ): Promise<SecurityMutationAuditRedriveResult> {
    if (!hasPermission(actor, "access:audit:redrive")) {
      throw new SecurityMutationAuditQuarantineServiceError("forbidden")
    }
    const tenantId = actor.tenantId
    if (!isCanonicalBoundedText(tenantId, 256)) {
      throw new SecurityMutationAuditQuarantineServiceError("unavailable")
    }
    if (
      !isCanonicalBoundedText(intentId, 256)
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(intentId)
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.idempotencyKey)
      || !isCanonicalBoundedText(input.reason, 1_000)
    ) throw new SecurityMutationAuditQuarantineServiceError("invalid_request")

    return this.outbox.redriveQuarantined(tenantId, intentId, {
      actorId: actor.userId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      policyVersion: SECURITY_MUTATION_AUDIT_REDRIVE_POLICY_VERSION
    })
  }
}

function isCanonicalBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && value.trim() === value
}
