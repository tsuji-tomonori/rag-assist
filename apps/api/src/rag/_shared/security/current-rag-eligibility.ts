import type {
  DerivedRecordSecurityEnvelope,
  DocumentManifest,
  SourceAdmissionRecord,
  VersionedRecordReference
} from "../../../types.js"
import type { AppUser } from "../../../auth.js"
import type { ObjectStore } from "../../../adapters/object-store.js"
import {
  readCurrentSourceGovernanceRecord,
  type SourceUsagePurpose
} from "../../offline/pre-retrieval/admission/source-governance-approval-service.js"
import {
  ProductionRagObservationProducer,
  bestEffortCapture
} from "../../quality-control/production-rag-observation-producer.js"
import { isManifestCurrentPublication } from "../publication/staged-publication-coordinator.js"

export const CURRENT_RAG_ELIGIBILITY_POLICY_VERSION = "current-rag-eligibility-v1"

export type RagUsePurpose = "normal_answer" | "benchmark_evaluation" | "citation" | "cache" | "debug"

export type CurrentRagEligibilitySnapshot = {
  policyVersion: typeof CURRENT_RAG_ELIGIBILITY_POLICY_VERSION
  documentId: string
  documentVersion: string
  tenantId?: string
  lifecycleActive: boolean
  admissionApproved: boolean
  authorizationAllowed: boolean
  classificationAllowed: boolean
  usageAllowed: boolean
  qualityAllowed: boolean
  expiresAt?: string
  authorizationRef?: VersionedRecordReference
  classificationRef?: VersionedRecordReference
  usagePolicyRef?: VersionedRecordReference
  qualityRef?: VersionedRecordReference
  lifecycleRef?: VersionedRecordReference
  provenanceRef?: VersionedRecordReference
}

export type CurrentRagEligibilityReason =
  | "eligible"
  | "identity_unverified"
  | "account_inactive"
  | "actor_tenant_missing"
  | "security_envelope_missing"
  | "document_mismatch"
  | "document_version_mismatch"
  | "tenant_mismatch"
  | "admission_not_approved"
  | "authorization_denied"
  | "classification_denied"
  | "usage_denied"
  | "quality_denied"
  | "lifecycle_inactive"
  | "expired"
  | "reference_missing"
  | "reference_changed"

export type CurrentRagEligibilityDecision = {
  allowed: boolean
  policyVersion: typeof CURRENT_RAG_ELIGIBILITY_POLICY_VERSION
  purpose: RagUsePurpose
  reason: CurrentRagEligibilityReason
}

const referenceKeys = [
  "authorizationRef",
  "classificationRef",
  "usagePolicyRef",
  "qualityRef",
  "lifecycleRef",
  "provenanceRef"
] as const

export function evaluateCurrentRagEligibility(input: {
  actor: Pick<AppUser, "accountStatus" | "tenantId">
  identityVerified: boolean
  purpose: RagUsePurpose
  envelope?: DerivedRecordSecurityEnvelope
  current: CurrentRagEligibilitySnapshot
  now?: Date
}): CurrentRagEligibilityDecision {
  const deny = (reason: CurrentRagEligibilityReason): CurrentRagEligibilityDecision => ({
    allowed: false,
    policyVersion: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
    purpose: input.purpose,
    reason
  })
  if (!input.identityVerified) return deny("identity_unverified")
  if (input.actor.accountStatus !== "active") return deny("account_inactive")
  if (!input.actor.tenantId) return deny("actor_tenant_missing")
  if (!input.envelope) return deny("security_envelope_missing")
  if (input.envelope.documentId !== input.current.documentId) return deny("document_mismatch")
  if (input.envelope.documentVersion !== input.current.documentVersion) return deny("document_version_mismatch")
  if (!input.current.tenantId || input.envelope.tenantId !== input.current.tenantId || input.actor.tenantId !== input.current.tenantId) return deny("tenant_mismatch")
  if (!input.current.admissionApproved) return deny("admission_not_approved")
  if (!input.current.authorizationAllowed) return deny("authorization_denied")
  if (!input.current.classificationAllowed) return deny("classification_denied")
  if (!input.current.usageAllowed) return deny("usage_denied")
  if (!input.current.qualityAllowed) return deny("quality_denied")
  if (!input.current.lifecycleActive) return deny("lifecycle_inactive")
  if (input.current.expiresAt && Date.parse(input.current.expiresAt) <= (input.now ?? new Date()).getTime()) return deny("expired")

  for (const key of referenceKeys) {
    const envelopeReference = input.envelope[key]
    const currentReference = input.current[key]
    if (!validReference(envelopeReference) || !validReference(currentReference)) return deny("reference_missing")
    if (!sameReference(envelopeReference, currentReference)) return deny("reference_changed")
  }
  return {
    allowed: true,
    policyVersion: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
    purpose: input.purpose,
    reason: "eligible"
  }
}

export function currentEligibilitySnapshotFromManifest(input: {
  manifest: DocumentManifest
  authorizationAllowed: boolean
  classificationAllowed?: boolean
  usageAllowed?: boolean
  qualityAllowed: boolean
}): CurrentRagEligibilitySnapshot {
  const admission: SourceAdmissionRecord | undefined = input.manifest.admission
  return {
    policyVersion: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
    documentId: input.manifest.documentId,
    documentVersion: input.manifest.securityEnvelope?.documentVersion ?? "",
    tenantId: admission?.tenantId,
    lifecycleActive: input.manifest.lifecycleStatus === "active",
    admissionApproved: admission?.status === "approved" && admission.inspectionStatus === "passed",
    authorizationAllowed: input.authorizationAllowed,
    classificationAllowed: input.classificationAllowed ?? Boolean(admission?.classificationRef),
    usageAllowed: input.usageAllowed ?? Boolean(admission?.usagePolicyRef),
    qualityAllowed: input.qualityAllowed,
    expiresAt: typeof input.manifest.metadata?.expiresAt === "string" ? input.manifest.metadata.expiresAt : undefined,
    authorizationRef: admission?.authorizationRef,
    classificationRef: admission?.classificationRef,
    usagePolicyRef: admission?.usagePolicyRef,
    qualityRef: admission?.qualityRef,
    lifecycleRef: admission?.lifecycleRef,
    provenanceRef: admission?.provenanceRef
  }
}

/**
 * Resolves mutable governance state at use time. Missing, unreadable, stale, or
 * mismatched registry state is denied in production. The only bypass is the
 * explicit local-test fixture seam carried by test dependencies.
 */
export async function currentEligibilitySnapshotFromAuthoritativeState(input: {
  objectStore: ObjectStore
  manifest: DocumentManifest
  authorizationAllowed: boolean
  classificationAllowed?: boolean
  usageAllowed?: boolean
  qualityAllowed: boolean
  purpose: RagUsePurpose
  roles?: string[]
  allowLocalTestFixture?: boolean
}): Promise<CurrentRagEligibilitySnapshot> {
  const base = currentEligibilitySnapshotFromManifest(input)
  let currentPublicationArtifact = false
  if (input.manifest.publicationControl) {
    try {
      currentPublicationArtifact = await isManifestCurrentPublication({ objectStore: input.objectStore }, input.manifest)
    } catch {
      currentPublicationArtifact = false
    }
  }
  let state
  try {
    state = await readCurrentSourceGovernanceRecord(input.objectStore, input.manifest, {
      allowCurrentPublicationArtifact: currentPublicationArtifact
    })
  } catch {
    return denyMutableGovernance(base)
  }
  if (!state) {
    if (input.allowLocalTestFixture || isOwnerScopedTemporaryAttachment(input.manifest)) return base
    return denyMutableGovernance(base)
  }

  const { record } = state
  const approval = record.approval
  const admission = input.manifest.admission
  const activeState = record.status === "published" || record.status === "restricted"
  const activeArtifact = record.activeDocumentId === input.manifest.documentId || currentPublicationArtifact
  const referencesMatch = Boolean(
    approval
    && sameOptionalReference(admission?.classificationRef, approval.classificationRef)
    && sameOptionalReference(admission?.usagePolicyRef, approval.usagePolicyRef)
    && sameOptionalReference(admission?.qualityRef, approval.qualityRef)
  )
  const deniedDimensions = new Set(record.restriction?.dimensions ?? [])
  const deniedPurposes = new Set(record.restriction?.deniedPurposes ?? [])
  const sourcePurpose = sourceUsagePurpose(input.purpose)
  const purposeFlagAllowed = sourcePurpose === "external_model"
    ? approval?.usagePolicy.externalModelAllowed === true
    : sourcePurpose === "logging"
      ? approval?.usagePolicy.loggingAllowed === true
      : sourcePurpose === "evaluation"
        ? approval?.usagePolicy.evaluationAllowed === true
        : true
  const approvedPurpose = Boolean(
    approval?.usagePolicy.allowedPurposes.includes(sourcePurpose)
    && purposeFlagAllowed
  )

  const snapshot: CurrentRagEligibilitySnapshot = {
    ...base,
    classificationAllowed: base.classificationAllowed
      && activeState
      && activeArtifact
      && referencesMatch
      && !deniedDimensions.has("classification"),
    usageAllowed: base.usageAllowed
      && activeState
      && activeArtifact
      && referencesMatch
      && approvedPurpose
      && !deniedPurposes.has(sourcePurpose),
    qualityAllowed: base.qualityAllowed
      && activeState
      && activeArtifact
      && referencesMatch
      && !deniedDimensions.has("quality"),
    lifecycleActive: base.lifecycleActive
      && activeState
      && activeArtifact
      && !deniedDimensions.has("lifecycle")
  }
  const restriction = record.restriction
  const restrictionApplies = Boolean(restriction && record.status === "restricted" && (
    restriction.dimensions.length > 0
    || restriction.deniedPurposes.includes(sourcePurpose)
  ))
  if (restriction && restrictionApplies) {
    const detectedAt = new Date().toISOString()
    const restrictedAtMs = Date.parse(restriction.restrictedAt)
    if (Number.isFinite(restrictedAtMs)) {
      await bestEffortCapture("eligibility_propagation", () => new ProductionRagObservationProducer(input.objectStore)
        .captureEligibilityProbeOnce({
          probeId: `source-governance:${record.tenantId}:${record.sourceId}:${record.revision}:${sourcePurpose}`,
          detectedAt,
          propagationMs: Math.max(0, Date.parse(detectedAt) - restrictedAtMs),
          tenantId: record.tenantId,
          roles: input.roles,
          pipelineVersions: input.manifest.pipelineVersions
        }))
    }
  }
  return snapshot
}

function isOwnerScopedTemporaryAttachment(manifest: DocumentManifest): boolean {
  const metadata = manifest.metadata
  const expiresAt = typeof metadata?.expiresAt === "string" ? Date.parse(metadata.expiresAt) : Number.NaN
  return metadata?.scopeType === "chat"
    && typeof metadata.ownerUserId === "string"
    && metadata.ownerUserId.length > 0
    && typeof metadata.tenantId === "string"
    && metadata.tenantId === manifest.admission?.tenantId
    && typeof metadata.temporaryScopeId === "string"
    && metadata.temporaryScopeId.length > 0
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now()
    && manifest.admission?.status === "approved"
    && manifest.admission.inspectionStatus === "passed"
}

function denyMutableGovernance(base: CurrentRagEligibilitySnapshot): CurrentRagEligibilitySnapshot {
  return {
    ...base,
    classificationAllowed: false,
    usageAllowed: false,
    qualityAllowed: false,
    lifecycleActive: false
  }
}

function sourceUsagePurpose(purpose: RagUsePurpose): SourceUsagePurpose {
  if (purpose === "benchmark_evaluation") return "evaluation"
  if (purpose === "debug") return "logging"
  return "normal_rag"
}

function sameOptionalReference(
  left: VersionedRecordReference | undefined,
  right: VersionedRecordReference | undefined
): boolean {
  return Boolean(left && right && sameReference(left, right))
}

function sameReference(left: VersionedRecordReference, right: VersionedRecordReference): boolean {
  return left.id === right.id && left.version === right.version && left.hash === right.hash
}

function validReference(value: VersionedRecordReference | undefined): value is VersionedRecordReference {
  return Boolean(value?.id && value.version && /^[0-9a-f]{64}$/i.test(value.hash))
}
