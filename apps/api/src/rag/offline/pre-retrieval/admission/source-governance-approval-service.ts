import type { AppUser } from "../../../../auth.js"
import { hasPermission, isActiveAccount } from "../../../../authorization.js"
import type { ObjectStore } from "../../../../adapters/object-store.js"
import type { VerifiedIdentityProvider } from "../../../../adapters/verified-identity-provider.js"
import type {
  AuthoritativeAdmissionContext,
  DocumentManifest,
  DocumentQualityProfile,
  JsonValue,
  StagedPublicationFence,
  VersionedRecordReference
} from "../../../../types.js"
import type {
  SecurityMutationAuditIntent,
  SecurityMutationAuditOutboxPort,
  SecurityMutationResult
} from "../../../../security/security-mutation-audit-outbox.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  type RegisterRevocationCleanupInput,
  type RevocationCleanupTargetReference,
  type RevocationTrigger
} from "../../../_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "../../../_shared/security/revocation-cleanup-repair-outbox.js"
import { createVersionedReference } from "./source-admission.js"

export const SOURCE_GOVERNANCE_POLICY_VERSION = "source-governance-approval-v1" as const

export const SOURCE_CLASSIFICATION_LEVELS = ["public", "internal", "confidential", "restricted"] as const
export type SourceClassificationLevel = (typeof SOURCE_CLASSIFICATION_LEVELS)[number]

export const SOURCE_USAGE_PURPOSES = ["normal_rag", "external_model", "logging", "evaluation"] as const
export type SourceUsagePurpose = (typeof SOURCE_USAGE_PURPOSES)[number]

export type ExplicitSourceQualityProfile = Readonly<{
  knowledgeQualityStatus: "approved"
  verificationStatus: "verified"
  freshnessStatus: "current"
  supersessionStatus: "current"
  extractionQualityStatus: "high"
  ragEligibility: "eligible"
  confidence?: number
  flags: readonly []
}>

export type ApproveSourceGovernanceInput = Readonly<{
  expectedVersion: string
  reason: string
  classification: Readonly<{
    level: SourceClassificationLevel
    policyVersion: string
  }>
  usagePolicy: Readonly<{
    allowedPurposes: readonly SourceUsagePurpose[]
    externalModelAllowed: boolean
    loggingAllowed: boolean
    evaluationAllowed: boolean
    policyVersion: string
  }>
  qualityProfile: ExplicitSourceQualityProfile
  qualityPolicyVersion: string
  inspection: Readonly<{
    status: "passed"
    profileVersion: string
  }>
}>

export const SOURCE_GOVERNANCE_RESTRICTION_DIMENSIONS = ["classification", "quality", "lifecycle"] as const
export type SourceGovernanceRestrictionDimension = (typeof SOURCE_GOVERNANCE_RESTRICTION_DIMENSIONS)[number]

/**
 * A restriction is intentionally deny-only. Restoring eligibility requires a
 * fresh reviewed publication so stale derived records can never become usable
 * merely by clearing a flag on the registry record.
 */
export type RestrictSourceGovernanceInput = Readonly<{
  expectedVersion: string
  reason: string
  dimensions?: readonly SourceGovernanceRestrictionDimension[]
  deniedPurposes?: readonly SourceUsagePurpose[]
}>

export type ApprovedSourceGovernancePolicy = Readonly<{
  classification: ApproveSourceGovernanceInput["classification"]
  usagePolicy: ApproveSourceGovernanceInput["usagePolicy"]
  qualityProfile: DocumentQualityProfile
  inspection: ApproveSourceGovernanceInput["inspection"]
  classificationRef: VersionedRecordReference
  usagePolicyRef: VersionedRecordReference
  qualityRef: VersionedRecordReference
  approvedBy: string
  approvedAt: string
  reason: string
}>

export type SourceGovernanceStatus =
  | "unreviewed"
  | "approval_pending"
  | "approved"
  | "published"
  | "restricted"
  | "reconciliation_required"

export type SourceGovernanceRestriction = Readonly<{
  dimensions: readonly SourceGovernanceRestrictionDimension[]
  deniedPurposes: readonly SourceUsagePurpose[]
  restrictedBy: string
  restrictedAt: string
  reason: string
}>

export type SourceGovernanceAuditReconciliation = Readonly<{
  intentId: string
  result: SecurityMutationResult
  after: JsonValue
  resumeStatus: SourceGovernanceStatus
  resumeLastFailureCode?: string
  requestedAt: string
}>

export type SourceGovernanceRecord = Readonly<{
  schemaVersion: 1
  sourceId: string
  sourceVersion: string
  sourceManifestObjectKey: string
  tenantId: string
  ownerUserId: string
  status: SourceGovernanceStatus
  revision: number
  approval?: ApprovedSourceGovernancePolicy
  restriction?: SourceGovernanceRestriction
  auditIntentId?: string
  auditReconciliation?: SourceGovernanceAuditReconciliation
  stagedPublication?: Readonly<{
    runId: string
    candidateDocumentId: string
    candidateManifestObjectKey: string
  }>
  activeDocumentId?: string
  publishedAt?: string
  lastFailureCode?: string
  createdAt: string
  updatedAt: string
}>

export type VersionedSourceGovernanceRecord = Readonly<{
  record: SourceGovernanceRecord
  version: string
}>

export type StagedSourceGovernancePublication = Readonly<{
  runId: string
  candidate: DocumentManifest
}>

export interface SourceGovernancePublisher {
  stage(input: Readonly<{
    actor: AppUser
    source: DocumentManifest
    sourceVersion: string
    approval: ApprovedSourceGovernancePolicy
  }>): Promise<StagedSourceGovernancePublication>
  commit(input: Readonly<{
    actor: AppUser
    staged: StagedSourceGovernancePublication
  }>): Promise<Readonly<{ activeDocumentId: string; committedAt: string }>>
}

type SourceGovernanceApprovalServiceDeps = Readonly<{
  objectStore: ObjectStore
  auditOutbox?: SecurityMutationAuditOutboxPort
  identityProvider?: VerifiedIdentityProvider
  allowSnapshotActor?: boolean
  authorizeFullResource(actor: AppUser, manifest: DocumentManifest): Promise<void>
  publisher: SourceGovernancePublisher
  cleanupCoordinator?: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
  now?: () => Date
}>

export class SourceGovernanceDeniedError extends Error {
  constructor(message = "Source governance approval denied") {
    super(message)
    this.name = "SourceGovernanceDeniedError"
  }
}

export class SourceGovernanceValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SourceGovernanceValidationError"
  }
}

export class SourceGovernanceConflictError extends Error {
  constructor(message = "Source governance version conflict") {
    super(message)
    this.name = "SourceGovernanceConflictError"
  }
}

export class SourceGovernanceUnavailableError extends Error {
  constructor(message = "Source governance approval is unavailable") {
    super(message)
    this.name = "SourceGovernanceUnavailableError"
  }
}

/**
 * Versioned, fail-closed approval contract for a quarantined source. An audit
 * intent and a CAS-protected approval state exist before any staged artifact is
 * produced. The publisher may switch the active pointer only after the record
 * reaches `approved` and current actor/resource authorization is rechecked.
 */
export class SourceGovernanceApprovalService {
  private readonly now: () => Date

  constructor(private readonly deps: SourceGovernanceApprovalServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  async ensureInitialRecord(manifest: DocumentManifest): Promise<VersionedSourceGovernanceRecord> {
    const identity = sourceIdentity(manifest)
    const key = sourceGovernanceRecordKey(identity.tenantId, identity.sourceId)
    const existing = await readVersionedRecord(this.deps.objectStore, key)
    if (existing) {
      assertRecordIdentity(existing.record, identity, manifest)
      return existing
    }

    const now = this.now().toISOString()
    const initial: SourceGovernanceRecord = {
      schemaVersion: 1,
      sourceId: identity.sourceId,
      sourceVersion: identity.sourceVersion,
      sourceManifestObjectKey: manifest.manifestObjectKey,
      tenantId: identity.tenantId,
      ownerUserId: identity.ownerUserId,
      status: "unreviewed",
      revision: 1,
      createdAt: now,
      updatedAt: now
    }
    try {
      await this.deps.objectStore.putTextIfVersion(key, JSON.stringify(initial, null, 2), undefined, "application/json")
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
    }
    const stored = await readVersionedRecord(this.deps.objectStore, key)
    if (!stored) throw new SourceGovernanceUnavailableError("Source governance record was not persisted")
    assertRecordIdentity(stored.record, identity, manifest)
    return stored
  }

  async getCurrentRecord(actorSnapshot: AppUser, manifest: DocumentManifest): Promise<VersionedSourceGovernanceRecord> {
    const state = await this.ensureInitialRecord(manifest)
    const actor = await this.resolveCurrentActor(actorSnapshot)
    await this.assertApprovalAuthority(actor, manifest, state.record)
    return state
  }

  async approve(
    actorSnapshot: AppUser,
    manifest: DocumentManifest,
    rawInput: ApproveSourceGovernanceInput
  ): Promise<VersionedSourceGovernanceRecord> {
    const state = await this.ensureInitialRecord(manifest)
    const auditOutbox = this.deps.auditOutbox
    if (!auditOutbox) throw new SourceGovernanceUnavailableError("Source governance audit outbox is not configured")
    await this.assertPreviousAuditSettled(state, auditOutbox)

    const proposedAuditState = auditProposedState(rawInput)
    let intent: SecurityMutationAuditIntent
    try {
      intent = await auditOutbox.prepare({
        actorId: actorSnapshot.userId,
        tenantId: state.record.tenantId,
        targetType: "source",
        targetId: state.record.sourceId,
        operation: "source_governance.approve_publish",
        before: sourceGovernanceAuditValue(state.record),
        proposedAfter: proposedAuditState,
        reason: canonicalAuditReason(rawInput.reason),
        policyVersion: SOURCE_GOVERNANCE_POLICY_VERSION
      })
    } catch {
      throw new SourceGovernanceUnavailableError("Source governance audit intent could not be persisted")
    }

    let current = state
    let mutationStarted = false
    try {
      const input = validateApprovalInput(rawInput)
      if (input.expectedVersion !== state.version) throw new SourceGovernanceConflictError()
      if (
        state.record.status !== "unreviewed"
        && state.record.status !== "restricted"
        && state.record.status !== "reconciliation_required"
      ) {
        throw new SourceGovernanceConflictError(`Source governance state is ${state.record.status}`)
      }
      if (state.record.auditReconciliation) {
        throw new SourceGovernanceUnavailableError("A previous source governance audit is still reconciling")
      }
      if (state.record.restriction) {
        try {
          await new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore).assertResourceFenceReleased(
            state.record.tenantId,
            cleanupResourceType(manifest),
            state.record.sourceId
          )
        } catch {
          throw new SourceGovernanceConflictError("Source revocation cleanup is still fenced")
        }
      }

      const actor = await this.resolveCurrentActor(actorSnapshot)
      await this.assertApprovalAuthority(actor, manifest, state.record)
      const approvedAt = this.now().toISOString()
      const approval = buildApprovedPolicy(state.record, input, actor, approvedAt)
      current = await this.transition(current, {
        ...current.record,
        status: "approval_pending",
        revision: current.record.revision + 1,
        approval,
        restriction: undefined,
        auditIntentId: intent.intentId,
        auditReconciliation: undefined,
        stagedPublication: undefined,
        activeDocumentId: undefined,
        publishedAt: undefined,
        lastFailureCode: undefined,
        updatedAt: approvedAt
      })
      mutationStarted = true

      const staged = await this.deps.publisher.stage({
        actor,
        source: manifest,
        sourceVersion: governancePublicationSourceVersion(current.record),
        approval
      })
      assertApprovedStagedCandidate(staged, current.record, approval)
      current = await this.transition(current, {
        ...current.record,
        status: "approved",
        revision: current.record.revision + 1,
        stagedPublication: {
          runId: staged.runId,
          candidateDocumentId: staged.candidate.documentId,
          candidateManifestObjectKey: staged.candidate.manifestObjectKey
        },
        updatedAt: this.now().toISOString()
      })

      const currentActor = await this.resolveCurrentActor(actorSnapshot)
      await this.assertApprovalAuthority(currentActor, manifest, current.record)
      const committed = await this.deps.publisher.commit({ actor: currentActor, staged })
      if (committed.activeDocumentId !== staged.candidate.documentId) {
        throw new SourceGovernanceUnavailableError("Published source identity does not match the approved candidate")
      }
      current = await this.transition(current, {
        ...current.record,
        status: "published",
        revision: current.record.revision + 1,
        activeDocumentId: committed.activeDocumentId,
        publishedAt: committed.committedAt,
        updatedAt: this.now().toISOString()
      })
    } catch (error) {
      const result = auditResultFor(error)
      if (mutationStarted && current.record.status !== "published") {
        current = await this.markReconciliationRequired(current, failureCode(error)).catch(() => current)
      }
      const after = sourceGovernanceAuditValue(current.record)
      try {
        await auditOutbox.complete(intent.intentId, intent.draft.tenantId, result, after)
      } catch (auditError) {
        current = await this.recordAuditReconciliation(
          current,
          intent,
          result,
          after,
          auditError
        )
        throw new SourceGovernanceUnavailableError("Source governance failure audit is pending reconciliation")
      }
      throw error
    }

    const after = sourceGovernanceAuditValue(current.record)
    try {
      await auditOutbox.complete(intent.intentId, intent.draft.tenantId, "success", after)
    } catch (auditError) {
      await this.recordAuditReconciliation(
        current,
        intent,
        "success",
        after,
        auditError
      )
      throw new SourceGovernanceUnavailableError("Published source audit is pending reconciliation")
    }
    return current
  }

  /**
   * Commits the authoritative deny before any physical cleanup. This method is
   * additive/deny-only: concurrent callers use expectedVersion CAS and an old
   * publication cannot be re-enabled without a new approval/publication.
   */
  async restrict(
    actorSnapshot: AppUser,
    manifest: DocumentManifest,
    rawInput: RestrictSourceGovernanceInput
  ): Promise<VersionedSourceGovernanceRecord> {
    const state = await this.ensureInitialRecord(manifest)
    const auditOutbox = this.deps.auditOutbox
    if (!auditOutbox) throw new SourceGovernanceUnavailableError("Source governance audit outbox is not configured")
    await this.assertPreviousAuditSettled(state, auditOutbox)

    let intent: SecurityMutationAuditIntent
    try {
      intent = await auditOutbox.prepare({
        actorId: actorSnapshot.userId,
        tenantId: state.record.tenantId,
        targetType: "source",
        targetId: state.record.sourceId,
        operation: "source_governance.restrict",
        before: sourceGovernanceAuditValue(state.record),
        proposedAfter: restrictionAuditState(rawInput),
        reason: canonicalAuditReason(rawInput.reason),
        policyVersion: SOURCE_GOVERNANCE_POLICY_VERSION
      })
    } catch {
      throw new SourceGovernanceUnavailableError("Source governance audit intent could not be persisted")
    }

    let current = state
    try {
      const input = validateRestrictionInput(rawInput)
      if (input.expectedVersion !== state.version) throw new SourceGovernanceConflictError()
      if (state.record.status !== "published" && state.record.status !== "restricted") {
        throw new SourceGovernanceConflictError(`Source governance state is ${state.record.status}`)
      }
      const actor = await this.resolveCurrentActor(actorSnapshot)
      await this.assertApprovalAuthority(actor, manifest, state.record)
      const restrictedAt = this.now().toISOString()
      const existing = state.record.restriction
      const restriction: SourceGovernanceRestriction = {
        dimensions: canonicalRestrictions([...(existing?.dimensions ?? []), ...(input.dimensions ?? [])]),
        deniedPurposes: canonicalPurposes([...(existing?.deniedPurposes ?? []), ...(input.deniedPurposes ?? [])]),
        restrictedBy: actor.userId,
        restrictedAt,
        reason: input.reason
      }
      const nextRecord: SourceGovernanceRecord = {
        ...current.record,
        status: "restricted",
        revision: current.record.revision + 1,
        restriction,
        auditIntentId: intent.intentId,
        auditReconciliation: undefined,
        lastFailureCode: undefined,
        updatedAt: restrictedAt
      }
      const cleanupRegistration = revocationCleanupInput({
        manifest,
        record: nextRecord,
        recordVersion: sourceGovernanceRestrictionStateVersion(nextRecord),
        auditIntentId: intent.intentId
      })
      const repairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
      try {
        await repairOutbox.prepare({
          expectedBeforeDenyVersion: current.version,
          cleanupRegistration,
          preparedAt: restrictedAt
        })
      } catch {
        throw new SourceGovernanceUnavailableError("Source revocation cleanup repair intent could not be persisted")
      }
      try {
        current = await this.transition(current, nextRecord)
      } catch (error) {
        await repairOutbox.markAbandoned({
          tenantId: nextRecord.tenantId,
          resourceType: cleanupRegistration.resourceType,
          resourceId: nextRecord.sourceId,
          operationId: cleanupRegistration.operationId
        }, restrictedAt).catch(() => undefined)
        throw error
      }
      try {
        if (sourceGovernanceRestrictionStateVersion(current.record) !== cleanupRegistration.authoritativeDenyVersion) {
          throw new Error("Source governance deny version does not match its cleanup repair intent")
        }
        const committedRepair = await repairOutbox.markDenyCommitted({
          tenantId: nextRecord.tenantId,
          resourceType: cleanupRegistration.resourceType,
          resourceId: nextRecord.sourceId,
          operationId: cleanupRegistration.operationId
        }, restrictedAt)
        const coordinator = this.deps.cleanupCoordinator
          ?? new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore)
        await coordinator.register(committedRepair.cleanupRegistration)
        await repairOutbox.markCleanupRegistered(committedRepair, restrictedAt)
      } catch {
        current = await this.markReconciliationRequired(current, "revocation_cleanup_manifest_unavailable").catch(() => current)
        throw new SourceGovernanceUnavailableError("Revocation cleanup reconciliation could not be registered")
      }
    } catch (error) {
      const result = auditResultFor(error)
      const after = sourceGovernanceAuditValue(current.record)
      try {
        await auditOutbox.complete(intent.intentId, intent.draft.tenantId, result, after)
      } catch (auditError) {
        current = await this.recordAuditReconciliation(
          current,
          intent,
          result,
          after,
          auditError
        )
        throw new SourceGovernanceUnavailableError("Source governance restriction audit is pending reconciliation")
      }
      throw error
    }

    const after = sourceGovernanceAuditValue(current.record)
    try {
      await auditOutbox.complete(intent.intentId, intent.draft.tenantId, "success", after)
    } catch (auditError) {
      await this.recordAuditReconciliation(
        current,
        intent,
        "success",
        after,
        auditError
      )
      throw new SourceGovernanceUnavailableError("Restricted source audit is pending reconciliation")
    }
    return current
  }

  private async resolveCurrentActor(snapshot: AppUser): Promise<AppUser> {
    if (this.deps.identityProvider) {
      let identity
      try {
        identity = await this.deps.identityProvider.getCurrentIdentityBySubject(snapshot.userId)
      } catch {
        throw new SourceGovernanceUnavailableError("Current actor identity could not be verified")
      }
      if (!identity || identity.userId !== snapshot.userId || identity.accountStatus !== "active") {
        throw new SourceGovernanceDeniedError()
      }
      return {
        userId: identity.userId,
        identityUsername: identity.username,
        email: identity.email,
        cognitoGroups: [...identity.cognitoGroups],
        accountStatus: identity.accountStatus,
        tenantId: identity.tenantId
      }
    }
    if (!this.deps.allowSnapshotActor || !isActiveAccount(snapshot) || !snapshot.userId.trim() || !snapshot.tenantId?.trim()) {
      throw new SourceGovernanceUnavailableError("Authoritative current actor identity is not configured")
    }
    return {
      ...snapshot,
      userId: snapshot.userId.trim(),
      tenantId: snapshot.tenantId.trim(),
      cognitoGroups: [...snapshot.cognitoGroups]
    }
  }

  private async assertApprovalAuthority(
    actor: AppUser,
    manifest: DocumentManifest,
    record: SourceGovernanceRecord
  ): Promise<void> {
    if (
      !isActiveAccount(actor)
      || actor.tenantId !== record.tenantId
      || sourceIdentity(manifest).tenantId !== record.tenantId
      || !hasPermission(actor, "rag:source:approve")
    ) throw new SourceGovernanceDeniedError()
    try {
      await this.deps.authorizeFullResource(actor, manifest)
    } catch {
      throw new SourceGovernanceDeniedError()
    }
  }

  private async transition(
    current: VersionedSourceGovernanceRecord,
    next: SourceGovernanceRecord
  ): Promise<VersionedSourceGovernanceRecord> {
    const key = sourceGovernanceRecordKey(current.record.tenantId, current.record.sourceId)
    try {
      await this.deps.objectStore.putTextIfVersion(
        key,
        JSON.stringify(next, null, 2),
        current.version,
        "application/json"
      )
    } catch (error) {
      if (isConditionalWriteError(error)) throw new SourceGovernanceConflictError()
      throw new SourceGovernanceUnavailableError("Source governance state could not be persisted")
    }
    const stored = await readVersionedRecord(this.deps.objectStore, key)
    if (!stored || stored.record.revision !== next.revision || stored.record.auditIntentId !== next.auditIntentId) {
      throw new SourceGovernanceUnavailableError("Source governance state verification failed")
    }
    return stored
  }

  private async markReconciliationRequired(
    current: VersionedSourceGovernanceRecord,
    lastFailureCode: string
  ): Promise<VersionedSourceGovernanceRecord> {
    return this.transition(current, {
      ...current.record,
      status: "reconciliation_required",
      revision: current.record.revision + 1,
      lastFailureCode,
      updatedAt: this.now().toISOString()
    })
  }

  private async recordAuditReconciliation(
    current: VersionedSourceGovernanceRecord,
    intent: SecurityMutationAuditIntent,
    result: SecurityMutationResult,
    after: JsonValue,
    auditError: unknown
  ): Promise<VersionedSourceGovernanceRecord> {
    void auditError
    return this.transition(current, {
      ...current.record,
      status: "reconciliation_required",
      revision: current.record.revision + 1,
      auditIntentId: intent.intentId,
      auditReconciliation: {
        intentId: intent.intentId,
        result,
        after,
        resumeStatus: current.record.status,
        resumeLastFailureCode: current.record.lastFailureCode,
        requestedAt: this.now().toISOString()
      },
      lastFailureCode: "security_audit_completion_pending",
      updatedAt: this.now().toISOString()
    }).catch(() => current)
  }

  private async assertPreviousAuditSettled(
    state: VersionedSourceGovernanceRecord,
    auditOutbox: SecurityMutationAuditOutboxPort
  ): Promise<void> {
    if (state.record.auditReconciliation) {
      throw new SourceGovernanceUnavailableError("A previous source governance audit is still reconciling")
    }
    const previousIntentId = state.record.auditIntentId
    if (!previousIntentId || !auditOutbox.get) return
    let previous: SecurityMutationAuditIntent
    try {
      previous = await auditOutbox.get(state.record.tenantId, previousIntentId)
    } catch {
      throw new SourceGovernanceUnavailableError("Previous source governance audit status could not be verified")
    }
    if (previous.status !== "completed") {
      throw new SourceGovernanceUnavailableError("A previous source governance audit is still pending")
    }
  }
}

export function createApprovedSourceAdmissionContext(
  source: DocumentManifest,
  approval: ApprovedSourceGovernancePolicy,
  fence: StagedPublicationFence
): AuthoritativeAdmissionContext {
  const identity = sourceIdentity(source)
  const admission = source.admission
  if (!admission?.authorizationRef || !admission.provenanceRef) {
    throw new SourceGovernanceValidationError("Source authorization or provenance authority is missing")
  }
  const metadata = source.metadata ?? {}
  const rawScopeType = stringValue(metadata.scopeType)
  const scopeType = rawScopeType === "group" || rawScopeType === "chat" || rawScopeType === "benchmark"
    ? rawScopeType
    : "personal"
  return {
    mode: "authoritative",
    tenantId: identity.tenantId,
    ownerUserId: identity.ownerUserId,
    authorizationRef: admission.authorizationRef,
    classificationRef: approval.classificationRef,
    usagePolicyRef: approval.usagePolicyRef,
    qualityRef: approval.qualityRef,
    lifecycleRef: createVersionedReference(
      `source-governance:${identity.tenantId}:${identity.sourceId}:lifecycle`,
      SOURCE_GOVERNANCE_POLICY_VERSION,
      { status: "staging", runId: fence.runId, fencingToken: fence.fencingToken }
    ),
    provenanceRef: admission.provenanceRef,
    inspectionStatus: "passed",
    qualityProfile: approval.qualityProfile,
    lifecycleStatus: "staging",
    scope: {
      scopeType,
      groupIds: stringArray(metadata.groupIds ?? metadata.groupId),
      folderIds: stringArray(metadata.folderIds ?? metadata.folderId),
      allowedUsers: stringArray(metadata.allowedUsers ?? metadata.userIds),
      temporaryScopeId: stringValue(metadata.temporaryScopeId),
      expiresAt: stringValue(metadata.expiresAt)
    },
    lifecycleMetadata: {
      activeDocumentId: identity.sourceId,
      stagedFromDocumentId: identity.sourceId,
      reindexMigrationId: fence.runId
    }
  }
}

function validateApprovalInput(input: ApproveSourceGovernanceInput): ApproveSourceGovernanceInput {
  if (!input.expectedVersion.trim() || input.expectedVersion.trim() !== input.expectedVersion) {
    throw new SourceGovernanceValidationError("expectedVersion is required and must be canonical")
  }
  if (!input.reason.trim() || input.reason.trim() !== input.reason) {
    throw new SourceGovernanceValidationError("reason is required and must be canonical")
  }
  if (!SOURCE_CLASSIFICATION_LEVELS.includes(input.classification.level)) {
    throw new SourceGovernanceValidationError("classification level is invalid")
  }
  for (const version of [
    input.classification.policyVersion,
    input.usagePolicy.policyVersion,
    input.qualityPolicyVersion,
    input.inspection.profileVersion
  ]) {
    if (!version.trim() || version.trim() !== version) {
      throw new SourceGovernanceValidationError("All governance profile versions are required and must be canonical")
    }
  }
  if (input.inspection.status !== "passed") {
    throw new SourceGovernanceValidationError("Source inspection must pass before approval")
  }
  const purposes = [...input.usagePolicy.allowedPurposes]
  if (
    purposes.length === 0
    || purposes.length !== new Set(purposes).size
    || purposes.some((purpose) => !SOURCE_USAGE_PURPOSES.includes(purpose))
    || !purposes.includes("normal_rag")
  ) throw new SourceGovernanceValidationError("Usage policy must explicitly and uniquely allow normal_rag")
  const purposeFlags: ReadonlyArray<readonly [SourceUsagePurpose, boolean]> = [
    ["external_model", input.usagePolicy.externalModelAllowed],
    ["logging", input.usagePolicy.loggingAllowed],
    ["evaluation", input.usagePolicy.evaluationAllowed]
  ]
  if (purposeFlags.some(([purpose, allowed]) => purposes.includes(purpose) !== allowed)) {
    throw new SourceGovernanceValidationError("Usage policy purpose flags are inconsistent")
  }
  const quality = input.qualityProfile
  if (
    quality.knowledgeQualityStatus !== "approved"
    || quality.verificationStatus !== "verified"
    || quality.freshnessStatus !== "current"
    || quality.supersessionStatus !== "current"
    || quality.extractionQualityStatus !== "high"
    || quality.ragEligibility !== "eligible"
    || !Array.isArray(quality.flags)
    || quality.flags.length !== 0
    || (quality.confidence !== undefined && (!Number.isFinite(quality.confidence) || quality.confidence < 0 || quality.confidence > 1))
  ) throw new SourceGovernanceValidationError("Quality profile is not explicitly publishable")
  return {
    ...input,
    usagePolicy: {
      ...input.usagePolicy,
      allowedPurposes: [...purposes].sort() as SourceUsagePurpose[]
    }
  }
}

function validateRestrictionInput(input: RestrictSourceGovernanceInput): RestrictSourceGovernanceInput {
  if (!input.expectedVersion.trim() || input.expectedVersion.trim() !== input.expectedVersion) {
    throw new SourceGovernanceValidationError("expectedVersion is required and must be canonical")
  }
  if (!input.reason.trim() || input.reason.trim() !== input.reason) {
    throw new SourceGovernanceValidationError("reason is required and must be canonical")
  }
  const dimensions = canonicalRestrictions(input.dimensions ?? [])
  const deniedPurposes = canonicalPurposes(input.deniedPurposes ?? [])
  if (dimensions.length === 0 && deniedPurposes.length === 0) {
    throw new SourceGovernanceValidationError("At least one governance restriction is required")
  }
  if ((input.dimensions ?? []).length !== dimensions.length || (input.deniedPurposes ?? []).length !== deniedPurposes.length) {
    throw new SourceGovernanceValidationError("Governance restrictions must be unique and valid")
  }
  return { ...input, dimensions, deniedPurposes }
}

function canonicalRestrictions(values: readonly SourceGovernanceRestrictionDimension[]): SourceGovernanceRestrictionDimension[] {
  return [...new Set(values)].filter((value) => SOURCE_GOVERNANCE_RESTRICTION_DIMENSIONS.includes(value)).sort()
}

function canonicalPurposes(values: readonly SourceUsagePurpose[]): SourceUsagePurpose[] {
  return [...new Set(values)].filter((value) => SOURCE_USAGE_PURPOSES.includes(value)).sort()
}

function buildApprovedPolicy(
  record: SourceGovernanceRecord,
  input: ApproveSourceGovernanceInput,
  actor: AppUser,
  approvedAt: string
): ApprovedSourceGovernancePolicy {
  const classification = { ...input.classification }
  const usagePolicy = { ...input.usagePolicy, allowedPurposes: [...input.usagePolicy.allowedPurposes] }
  const qualityProfile: DocumentQualityProfile = {
    ...input.qualityProfile,
    flags: [],
    updatedAt: approvedAt,
    updatedBy: actor.userId
  }
  const prefix = `source-governance:${record.tenantId}:${record.sourceId}`
  return {
    classification,
    usagePolicy,
    qualityProfile,
    inspection: { ...input.inspection },
    classificationRef: createVersionedReference(`${prefix}:classification`, classification.policyVersion, classification as unknown as JsonValue),
    usagePolicyRef: createVersionedReference(`${prefix}:usage`, usagePolicy.policyVersion, usagePolicy as unknown as JsonValue),
    qualityRef: createVersionedReference(`${prefix}:quality`, input.qualityPolicyVersion, qualityProfile as JsonValue),
    approvedBy: actor.userId,
    approvedAt,
    reason: input.reason
  }
}

function assertApprovedStagedCandidate(
  staged: StagedSourceGovernancePublication,
  record: SourceGovernanceRecord,
  approval: ApprovedSourceGovernancePolicy
): void {
  const candidate = staged.candidate
  if (
    !staged.runId
    || candidate.publicationFence?.runId !== staged.runId
    || candidate.lifecycleStatus !== "staging"
    || candidate.processingStatus !== "complete"
    || candidate.publicationEligible !== true
    || candidate.admission?.status !== "approved"
    || candidate.admission.inspectionStatus !== "passed"
    || candidate.admission.tenantId !== record.tenantId
    || candidate.admission.classificationRef?.hash !== approval.classificationRef.hash
    || candidate.admission.usagePolicyRef?.hash !== approval.usagePolicyRef.hash
    || candidate.admission.qualityRef?.hash !== approval.qualityRef.hash
    || candidate.derivedIntegrity?.verified !== true
  ) throw new SourceGovernanceUnavailableError("Staged candidate did not preserve the approved governance profile")
}

function sourceIdentity(manifest: DocumentManifest): {
  sourceId: string
  sourceVersion: string
  tenantId: string
  ownerUserId: string
} {
  const sourceId = manifest.publicationControl?.sourceId?.trim() || manifest.documentId.trim()
  const sourceVersion = manifest.documentVersion?.trim()
  const tenantId = manifest.admission?.tenantId?.trim() || stringValue(manifest.metadata?.tenantId)?.trim()
  const ownerUserId = manifest.admission?.ownerUserId?.trim() || stringValue(manifest.metadata?.ownerUserId)?.trim()
  if (!sourceId || !sourceVersion || !tenantId || !ownerUserId) {
    throw new SourceGovernanceValidationError("Source identity, tenant, owner, or version is missing")
  }
  return { sourceId, sourceVersion, tenantId, ownerUserId }
}

function assertRecordIdentity(
  record: SourceGovernanceRecord,
  identity: ReturnType<typeof sourceIdentity>,
  manifest?: DocumentManifest,
  options: { allowCurrentPublicationArtifact?: boolean } = {}
): void {
  const isPublishedArtifact = Boolean(
    manifest?.publicationControl?.sourceId === record.sourceId
    && (record.activeDocumentId === manifest.documentId || options.allowCurrentPublicationArtifact)
  )
  if (
    record.schemaVersion !== 1
    || record.sourceId !== identity.sourceId
    || record.tenantId !== identity.tenantId
    || record.ownerUserId !== identity.ownerUserId
    || (!isPublishedArtifact && record.sourceVersion !== identity.sourceVersion)
  ) throw new SourceGovernanceConflictError("Source governance identity changed")
}

/** Reads the current source registry state without creating or mutating it. */
export async function readCurrentSourceGovernanceRecord(
  objectStore: ObjectStore,
  manifest: DocumentManifest,
  options: { allowCurrentPublicationArtifact?: boolean } = {}
): Promise<VersionedSourceGovernanceRecord | undefined> {
  const identity = sourceIdentity(manifest)
  const state = await readVersionedRecord(objectStore, sourceGovernanceRecordKey(identity.tenantId, identity.sourceId))
  if (!state) return undefined
  assertRecordIdentity(state.record, identity, manifest, options)
  return state
}

/**
 * Removes only the untouched initial governance row created for an ingest
 * that is being compensated. A reviewed, staged, published, or concurrently
 * changed row is never deleted.
 */
export async function discardUncommittedSourceGovernanceRecord(
  objectStore: ObjectStore,
  manifest: DocumentManifest
): Promise<boolean> {
  const identity = sourceIdentity(manifest)
  const key = sourceGovernanceRecordKey(identity.tenantId, identity.sourceId)
  const first = await readVersionedRecord(objectStore, key)
  if (!first || !isDiscardableInitialRecord(first.record, manifest)) return false
  const current = await readVersionedRecord(objectStore, key)
  if (!current || current.version !== first.version || !isDiscardableInitialRecord(current.record, manifest)) return false
  await objectStore.deleteObject(key)
  return true
}

function isDiscardableInitialRecord(record: SourceGovernanceRecord, manifest: DocumentManifest): boolean {
  return record.status === "unreviewed"
    && record.revision === 1
    && record.sourceManifestObjectKey === manifest.manifestObjectKey
    && record.sourceVersion === sourceIdentity(manifest).sourceVersion
    && record.approval === undefined
    && record.stagedPublication === undefined
    && record.activeDocumentId === undefined
}

function revocationCleanupInput(input: {
  manifest: DocumentManifest
  record: SourceGovernanceRecord
  recordVersion: string
  auditIntentId: string
}): RegisterRevocationCleanupInput & { operationId: string } {
  const restriction = input.record.restriction
  if (!restriction) throw new SourceGovernanceUnavailableError("Current governance restriction is missing")
  return {
    operationId: `source-governance:${input.auditIntentId}`,
    tenantId: input.record.tenantId,
    resourceType: input.manifest.metadata?.scopeType === "chat" ? "temporary_attachment" : "document",
    resourceId: input.record.sourceId,
    trigger: restrictionTrigger(restriction),
    deniedPurposes: restriction.deniedPurposes,
    authoritativeDenyVersion: input.recordVersion,
    authoritativeDenyConfirmedAt: restriction.restrictedAt,
    knownTargets: cleanupTargets(input.manifest, restriction)
  }
}

export function sourceGovernanceRestrictionStateVersion(record: SourceGovernanceRecord): string {
  if (!record.restriction || !record.auditIntentId) {
    throw new SourceGovernanceUnavailableError("Current governance restriction identity is incomplete")
  }
  const hash = createVersionedReference(
    `source-governance:${record.tenantId}:${record.sourceId}:restriction`,
    SOURCE_GOVERNANCE_POLICY_VERSION,
    {
      revision: record.revision,
      status: record.status,
      auditIntentId: record.auditIntentId,
      restriction: {
        ...record.restriction,
        dimensions: [...record.restriction.dimensions],
        deniedPurposes: [...record.restriction.deniedPurposes]
      }
    }
  ).hash
  return `source-governance:${record.revision}:${record.auditIntentId}:${hash}`
}

function cleanupResourceType(manifest: DocumentManifest): "document" | "temporary_attachment" {
  return manifest.metadata?.scopeType === "chat" ? "temporary_attachment" : "document"
}

function restrictionTrigger(restriction: SourceGovernanceRestriction): RevocationTrigger {
  if (restriction.dimensions.includes("lifecycle")) return "archived"
  if (restriction.dimensions.includes("classification")) return "classification_restricted"
  if (restriction.dimensions.includes("quality")) return "quality_restricted"
  return "usage_restricted"
}

function cleanupTargets(
  manifest: DocumentManifest,
  restriction: SourceGovernanceRestriction
): RevocationCleanupTargetReference[] {
  const targets: RevocationCleanupTargetReference[] = []
  const resourceIneligible = restriction.dimensions.includes("classification")
    || restriction.dimensions.includes("lifecycle")
  if (resourceIneligible) {
    targets.push(
      { scope: "source", reference: manifest.sourceObjectKey },
      { scope: "source", reference: manifest.manifestObjectKey }
    )
    if (manifest.structuredBlocksObjectKey) targets.push({ scope: "chunk", reference: manifest.structuredBlocksObjectKey })
    for (const chunk of manifest.chunks ?? []) targets.push({ scope: "chunk", reference: `${manifest.documentId}:${chunk.id}` })
    if (manifest.memoryCardsObjectKey) targets.push({ scope: "memory", reference: manifest.memoryCardsObjectKey })
    for (const key of manifest.memoryVectorKeys ?? []) targets.push({ scope: "memory", reference: key })
    for (const key of [...manifest.vectorKeys, ...(manifest.evidenceVectorKeys ?? [])]) {
      targets.push({ scope: "active_index", reference: `${manifest.indexVersion ?? "unknown"}:${key}` })
    }
    if (manifest.publicationFence) {
      targets.push({ scope: "staged_index", reference: manifest.publicationFence.stageNamespace })
    }
    if (manifest.stagedFromDocumentId) {
      targets.push({ scope: "old_index", reference: manifest.stagedFromDocumentId })
    }
  }
  if (restriction.dimensions.includes("quality") || restriction.deniedPurposes.includes("evaluation")) {
    targets.push({ scope: "evaluation_artifact", reference: `quality-control:source-governance:${manifest.publicationControl?.sourceId ?? manifest.documentId}` })
  }
  return targets
}

function governancePublicationSourceVersion(record: SourceGovernanceRecord): string {
  const approval = record.approval
  if (!approval) throw new SourceGovernanceUnavailableError("Approved governance policy is missing")
  return createVersionedReference(
    `source-governance:${record.tenantId}:${record.sourceId}:publication`,
    SOURCE_GOVERNANCE_POLICY_VERSION,
    {
      sourceVersion: record.sourceVersion,
      classificationRef: approval.classificationRef,
      usagePolicyRef: approval.usagePolicyRef,
      qualityRef: approval.qualityRef,
      inspection: approval.inspection
    }
  ).hash
}

export function sourceGovernanceRecordKey(tenantId: string, sourceId: string): string {
  return `source-governance/${encodeURIComponent(tenantId)}/${encodeURIComponent(sourceId)}.json`
}

export function sourceGovernanceTenantPrefix(tenantId: string): string {
  return `source-governance/${encodeURIComponent(tenantId)}/`
}

/** Reads one tenant-bound authoritative row without creating a fallback row. */
export async function readSourceGovernanceRecordById(
  objectStore: ObjectStore,
  tenantId: string,
  sourceId: string
): Promise<VersionedSourceGovernanceRecord | undefined> {
  assertCanonicalGovernanceIdentifier(tenantId)
  assertCanonicalGovernanceIdentifier(sourceId)
  const state = await readVersionedRecord(objectStore, sourceGovernanceRecordKey(tenantId, sourceId))
  if (!state) return undefined
  assertStoredSourceGovernanceRecord(state.record, tenantId, sourceId)
  return state
}

async function readVersionedRecord(
  objectStore: ObjectStore,
  key: string
): Promise<VersionedSourceGovernanceRecord | undefined> {
  try {
    const stored = await objectStore.getTextWithVersion(key)
    return { record: JSON.parse(stored.text) as SourceGovernanceRecord, version: stored.version }
  } catch (error) {
    if (isMissingObjectError(error)) return undefined
    throw error
  }
}

export function sourceGovernanceAuditValue(record: SourceGovernanceRecord): JsonValue {
  return {
    status: record.status,
    revision: record.revision,
    sourceVersion: record.sourceVersion,
    classificationRef: record.approval?.classificationRef ?? null,
    usagePolicyRef: record.approval?.usagePolicyRef ?? null,
    qualityRef: record.approval?.qualityRef ?? null,
    stagedRunId: record.stagedPublication?.runId ?? null,
    activeDocumentId: record.activeDocumentId ?? null,
    restrictedDimensions: [...(record.restriction?.dimensions ?? [])],
    deniedPurposes: [...(record.restriction?.deniedPurposes ?? [])],
    reconciliationRequired: record.status === "reconciliation_required"
  }
}

function assertCanonicalGovernanceIdentifier(value: string): void {
  if (!value || value.trim() !== value) throw new Error("Source governance identifier is invalid")
}

function assertStoredSourceGovernanceRecord(
  record: SourceGovernanceRecord,
  tenantId: string,
  sourceId: string
): void {
  if (
    record.schemaVersion !== 1
    || record.tenantId !== tenantId
    || record.sourceId !== sourceId
    || !Number.isInteger(record.revision)
    || record.revision < 1
    || ![
      "unreviewed",
      "approval_pending",
      "approved",
      "published",
      "restricted",
      "reconciliation_required"
    ].includes(record.status)
  ) throw new Error("Source governance record identity is invalid")
}

function auditProposedState(input: ApproveSourceGovernanceInput): JsonValue {
  return {
    status: "published",
    classification: {
      level: input.classification?.level ?? null,
      policyVersion: input.classification?.policyVersion ?? null
    },
    usagePolicyVersion: input.usagePolicy?.policyVersion ?? null,
    allowedPurposes: Array.isArray(input.usagePolicy?.allowedPurposes) ? [...input.usagePolicy.allowedPurposes] : [],
    qualityPolicyVersion: input.qualityPolicyVersion ?? null,
    inspectionProfileVersion: input.inspection?.profileVersion ?? null
  }
}

function restrictionAuditState(input: RestrictSourceGovernanceInput): JsonValue {
  return {
    status: "restricted",
    dimensions: Array.isArray(input.dimensions) ? [...input.dimensions] : [],
    deniedPurposes: Array.isArray(input.deniedPurposes) ? [...input.deniedPurposes] : []
  }
}

function canonicalAuditReason(reason: string): string {
  return typeof reason === "string" && reason.trim() ? reason.trim() : "invalid_or_missing_reason"
}

function auditResultFor(error: unknown): SecurityMutationResult {
  if (error instanceof SourceGovernanceConflictError) return "conflict"
  if (error instanceof SourceGovernanceDeniedError || error instanceof SourceGovernanceValidationError) return "denied"
  return "failed"
}

function failureCode(error: unknown): string {
  if (error instanceof SourceGovernanceDeniedError) return "authorization_revoked"
  if (error instanceof SourceGovernanceConflictError) return "concurrent_state_conflict"
  if (error instanceof SourceGovernanceValidationError) return "approval_validation_failed"
  return "publication_failed"
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function stringArray(value: JsonValue | undefined): string[] | undefined {
  const values = typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  const canonical = [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort()
  return canonical.length > 0 ? canonical : undefined
}

function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as Error & { code?: string; name?: string }).code
  const name = (error as Error & { name?: string }).name
  return code === "ENOENT" || name === "NoSuchKey" || name === "NotFound" || /not found|no such key/i.test(error.message)
}

function isConditionalWriteError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const value = error as Error & { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return value.code === "PRECONDITION_FAILED"
    || value.name === "PreconditionFailed"
    || value.$metadata?.httpStatusCode === 412
    || /conditional write|precondition/i.test(value.message)
}
