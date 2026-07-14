import type { ObjectStore } from "../../../../adapters/object-store.js"
import type { JsonValue } from "../../../../types.js"
import type {
  SecurityMutationAuditIntent,
  SecurityMutationAuditReconciliationOutboxPort,
  SecurityMutationResult
} from "../../../../security/security-mutation-audit-outbox.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "../../../../security/security-mutation-audit-reconciler.js"
import {
  readSourceGovernanceRecordById,
  sourceGovernanceAuditValue,
  sourceGovernanceRecordKey,
  sourceGovernanceTenantPrefix,
  type SourceGovernanceAuditReconciliation,
  type SourceGovernanceRecord,
  type VersionedSourceGovernanceRecord
} from "./source-governance-approval-service.js"

const SUPPORTED_OPERATIONS = [
  "source_governance.approve_publish",
  "source_governance.restrict"
] as const

/** Resolves pending source audit intents from the current tenant-bound registry row. */
export class SourceGovernanceAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  private readonly now: () => Date

  constructor(
    private readonly objectStore: ObjectStore,
    private readonly outbox: SecurityMutationAuditReconciliationOutboxPort,
    now: () => Date = () => new Date()
  ) {
    this.now = now
  }

  supports(draft: SecurityMutationAuditIntent["draft"]): boolean {
    return draft.targetType === "source"
      && SUPPORTED_OPERATIONS.includes(draft.operation as (typeof SUPPORTED_OPERATIONS)[number])
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) throw new Error("Unsupported source governance audit intent")
    const state = await readSourceGovernanceRecordById(
      this.objectStore,
      intent.draft.tenantId,
      intent.draft.targetId
    )
    if (!state) throw new Error("Authoritative source governance target was not found")

    const marker = state.record.auditReconciliation
    if (marker?.intentId === intent.intentId) {
      validateMarker(marker, state.record)
      if (
        intent.requestedCompletion
        && (
          marker.result !== intent.requestedCompletion.result
          || !sameJson(marker.after, intent.requestedCompletion.after)
        )
      ) throw new Error("Source governance reconciliation marker conflicts with the audit completion request")
      return { result: marker.result, after: marker.after }
    }

    const authoritativeAfter = sourceGovernanceAuditValue(state.record)
    if (intent.requestedCompletion) {
      assertRequestedCompletionIsAuthoritative(intent, state.record, authoritativeAfter)
      return {
        result: intent.requestedCompletion.result,
        after: intent.requestedCompletion.after
      }
    }

    if (state.record.auditIntentId === intent.intentId) {
      if (isSuccessfulPostState(intent, state.record)) return { result: "success", after: authoritativeAfter }
      return { result: "failed", after: authoritativeAfter }
    }
    if (sameJson(intent.draft.before, authoritativeAfter)) {
      return { result: "failed", after: authoritativeAfter }
    }
    throw new Error("Current source governance state cannot authoritatively resolve the audit intent")
  }

  async afterCompleted(intent: SecurityMutationAuditIntent): Promise<void> {
    const state = await readSourceGovernanceRecordById(
      this.objectStore,
      intent.draft.tenantId,
      intent.draft.targetId
    )
    if (!state || state.record.auditReconciliation?.intentId !== intent.intentId) return
    await this.restoreCompletedMarker(state, intent)
  }

  async repairCompleted(tenantId: string): Promise<number> {
    const prefix = sourceGovernanceTenantPrefix(tenantId)
    const keys = (await this.objectStore.listKeys(prefix)).filter((key) => key.endsWith(".json")).sort()
    let repaired = 0
    for (const key of keys) {
      const sourceId = sourceIdFromKey(key, tenantId)
      const state = await readSourceGovernanceRecordById(this.objectStore, tenantId, sourceId)
      if (!state?.record.auditReconciliation) continue
      const intent = await this.outbox.get(tenantId, state.record.auditReconciliation.intentId)
      if (intent.status !== "completed") continue
      await this.restoreCompletedMarker(state, intent)
      repaired += 1
    }
    return repaired
  }

  private async restoreCompletedMarker(
    state: VersionedSourceGovernanceRecord,
    intent: SecurityMutationAuditIntent
  ): Promise<void> {
    const marker = state.record.auditReconciliation
    if (!marker || marker.intentId !== intent.intentId) return
    if (
      !this.supports(intent.draft)
      || intent.draft.tenantId !== state.record.tenantId
      || intent.draft.targetId !== state.record.sourceId
    ) throw new Error("Completed audit event does not identify its source governance marker")
    validateMarker(marker, state.record)
    if (
      intent.status !== "completed"
      || intent.result !== marker.result
      || !sameJson(intent.after, marker.after)
    ) throw new Error("Completed audit event does not match its source governance reconciliation marker")

    const next: SourceGovernanceRecord = {
      ...state.record,
      status: marker.resumeStatus,
      revision: state.record.revision + 1,
      auditReconciliation: undefined,
      lastFailureCode: marker.resumeLastFailureCode,
      updatedAt: this.now().toISOString()
    }
    const key = sourceGovernanceRecordKey(state.record.tenantId, state.record.sourceId)
    try {
      await this.objectStore.putTextIfVersion(
        key,
        JSON.stringify(next, null, 2),
        state.version,
        "application/json"
      )
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const winner = await readSourceGovernanceRecordById(
        this.objectStore,
        state.record.tenantId,
        state.record.sourceId
      )
      if (!winner || winner.record.auditReconciliation?.intentId === intent.intentId) throw error
    }
  }
}

function assertRequestedCompletionIsAuthoritative(
  intent: SecurityMutationAuditIntent,
  record: SourceGovernanceRecord,
  authoritativeAfter: JsonValue
): void {
  const requested = intent.requestedCompletion
  if (!requested || !sameJson(requested.after, authoritativeAfter)) {
    throw new Error("Current source governance state does not match the requested audit completion")
  }
  const correlated = record.auditIntentId === intent.intentId || sameJson(intent.draft.before, authoritativeAfter)
  if (!correlated) throw new Error("Current source governance state is not correlated with the audit intent")
  if (requested.result === "success" && !isSuccessfulPostState(intent, record)) {
    throw new Error("Current source governance state does not confirm successful mutation")
  }
}

function isSuccessfulPostState(intent: SecurityMutationAuditIntent, record: SourceGovernanceRecord): boolean {
  if (record.auditIntentId !== intent.intentId) return false
  if (intent.draft.operation === "source_governance.approve_publish") return record.status === "published"
  if (intent.draft.operation === "source_governance.restrict") return record.status === "restricted"
  return false
}

function validateMarker(marker: SourceGovernanceAuditReconciliation, record: SourceGovernanceRecord): void {
  if (
    !marker.intentId
    || marker.intentId.trim() !== marker.intentId
    || !isSecurityMutationResult(marker.result)
    || !isCanonicalTimestamp(marker.requestedAt)
    || ![
      "unreviewed",
      "approval_pending",
      "approved",
      "published",
      "restricted",
      "reconciliation_required"
    ].includes(marker.resumeStatus)
    || record.status !== "reconciliation_required"
    || record.auditIntentId !== marker.intentId
    || record.revision < 2
  ) throw new Error("Source governance audit reconciliation marker is invalid")
  const resumed: SourceGovernanceRecord = {
    ...record,
    status: marker.resumeStatus,
    revision: record.revision - 1,
    auditReconciliation: undefined,
    lastFailureCode: marker.resumeLastFailureCode
  }
  if (!sameJson(sourceGovernanceAuditValue(resumed), marker.after)) {
    throw new Error("Source governance audit reconciliation marker does not match authoritative post-state")
  }
}

function sourceIdFromKey(key: string, tenantId: string): string {
  const prefix = sourceGovernanceTenantPrefix(tenantId)
  if (!key.startsWith(prefix) || !key.endsWith(".json")) {
    throw new Error("Source governance enumeration crossed its tenant prefix")
  }
  let sourceId: string
  try {
    sourceId = decodeURIComponent(key.slice(prefix.length, -".json".length))
  } catch {
    throw new Error("Source governance storage key is malformed")
  }
  if (key !== sourceGovernanceRecordKey(tenantId, sourceId)) {
    throw new Error("Source governance storage key is non-canonical")
  }
  return sourceId
}

function isSecurityMutationResult(value: unknown): value is SecurityMutationResult {
  return value === "success" || value === "denied" || value === "conflict" || value === "failed"
}

function isCanonicalTimestamp(value: string): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value)
}

function sameJson(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isConditionalWriteError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "PRECONDITION_FAILED"
    || candidate.name === "PreconditionFailed"
    || candidate.$metadata?.httpStatusCode === 412
    || candidate.message?.includes("Conditional write failed") === true
}
