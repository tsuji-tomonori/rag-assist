import type {
  DocumentManifest,
  DocumentQualityProfile,
  ExtractionWarning,
  ExtractionQualityStatus,
  FreshnessStatus,
  JsonValue,
  KnowledgeQualityStatus,
  QualityFlag,
  RagEligibilityStatus,
  SupersessionStatus,
  VerificationStatus
} from "../../../types.js"

const verificationStatuses = new Set<VerificationStatus>(["verified", "unverified", "rejected"])
const freshnessStatuses = new Set<FreshnessStatus>(["current", "stale", "expired"])
const supersessionStatuses = new Set<SupersessionStatus>(["current", "superseded"])
const extractionQualityStatuses = new Set<ExtractionQualityStatus>(["high", "medium", "low", "unusable"])
const ragEligibilityStatuses = new Set<RagEligibilityStatus>(["eligible", "eligible_with_warning", "excluded"])
const knowledgeQualityStatuses = new Set<KnowledgeQualityStatus>(["approved", "warning", "blocked"])
const qualityFlags = new Set<QualityFlag>([
  "verification_required",
  "freshness_review_required",
  "superseded_by_newer_document",
  "low_extraction_confidence",
  "manual_rag_exclusion"
])

export type QualityGateDecision = {
  approved: boolean
  profile: DocumentQualityProfile
  reasons: string[]
}

export type QualityGateOptions = {
  /** Explicitly permits pre-admission manifests in local/test fixtures only. */
  allowLegacyLocalTestFixture?: boolean
}

export function documentQualityProfileFromMetadata(metadata: Record<string, JsonValue> | undefined): DocumentQualityProfile | undefined {
  if (!metadata) return undefined
  const nested = objectValue(metadata.qualityProfile)
  const profile: DocumentQualityProfile = {
    knowledgeQualityStatus: knowledgeQualityStatusValue(nested?.knowledgeQualityStatus ?? metadata.knowledgeQualityStatus),
    verificationStatus: verificationStatusValue(nested?.verificationStatus ?? metadata.verificationStatus),
    freshnessStatus: freshnessStatusValue(nested?.freshnessStatus ?? metadata.freshnessStatus),
    supersessionStatus: supersessionStatusValue(nested?.supersessionStatus ?? metadata.supersessionStatus),
    extractionQualityStatus: extractionQualityStatusValue(nested?.extractionQualityStatus ?? metadata.extractionQualityStatus),
    ragEligibility: ragEligibilityValue(nested?.ragEligibility ?? metadata.ragEligibility),
    confidence: numberValue(nested?.confidence ?? metadata.qualityConfidence),
    flags: flagValues(nested?.flags ?? metadata.qualityFlags),
    updatedAt: stringValue(nested?.updatedAt ?? metadata.qualityUpdatedAt),
    updatedBy: stringValue(nested?.updatedBy ?? metadata.qualityUpdatedBy)
  }
  return hasDefinedValue(profile) ? profile : undefined
}

export function normalizeDocumentQualityProfile(profile: DocumentQualityProfile | undefined): DocumentQualityProfile {
  return {
    knowledgeQualityStatus: profile?.knowledgeQualityStatus ?? "approved",
    verificationStatus: profile?.verificationStatus ?? "verified",
    freshnessStatus: profile?.freshnessStatus ?? "current",
    supersessionStatus: profile?.supersessionStatus ?? "current",
    extractionQualityStatus: profile?.extractionQualityStatus ?? "high",
    ragEligibility: profile?.ragEligibility ?? "eligible",
    confidence: profile?.confidence,
    flags: profile?.flags ?? [],
    updatedAt: profile?.updatedAt,
    updatedBy: profile?.updatedBy
  }
}

export function resolveDocumentQualityProfile(manifest: Pick<DocumentManifest, "metadata" | "qualityProfile">): DocumentQualityProfile {
  return normalizeDocumentQualityProfile({
    ...documentQualityProfileFromMetadata(manifest.metadata),
    ...manifest.qualityProfile
  })
}

type QualityGateManifest = Pick<
  DocumentManifest,
  "metadata" | "qualityProfile" | "extractionWarnings" | "chunks" | "parsedDocument" | "admission" | "derivedIntegrity" | "securityEnvelope" | "publicationEligible" | "processingStatus"
>

export function isQualityApprovedForNormalRag(manifest: QualityGateManifest, options: QualityGateOptions = {}): boolean {
  return qualityGateForNormalRag(manifest, options).approved
}

export function qualityGateForNormalRag(manifest: QualityGateManifest, options: QualityGateOptions = {}): QualityGateDecision {
  const profile = resolveDocumentQualityProfile(manifest)
  const temporaryAttachment = isScopedTemporaryAttachment(manifest)
  const suppliedProfile = {
    ...documentQualityProfileFromMetadata(manifest.metadata),
    ...manifest.qualityProfile
  }
  const strictReasons = options.allowLegacyLocalTestFixture ? [] : [
    ...requiredQualityFieldReasons(suppliedProfile),
    ...(manifest.admission?.status === "approved" ? [] : ["source_admission_not_approved"]),
    ...requiredAdmissionReferenceReasons(manifest),
    ...(manifest.derivedIntegrity?.verified === true ? [] : ["derived_integrity_not_verified"]),
    ...(manifest.securityEnvelope ? [] : ["document_security_envelope_missing"]),
    ...(manifest.publicationEligible === true ? [] : ["publication_not_eligible"]),
    ...(manifest.processingStatus === undefined || manifest.processingStatus === "complete" ? [] : ["ingest_processing_incomplete"])
  ]
  const reasons = [
    ...strictReasons,
    ...(!temporaryAttachment && profile.knowledgeQualityStatus !== "approved" ? ["knowledge_quality_not_approved"] : []),
    ...((temporaryAttachment
      ? profile.ragEligibility !== "eligible" && profile.ragEligibility !== "eligible_with_warning"
      : profile.ragEligibility !== "eligible") ? ["rag_not_eligible"] : []),
    ...(!temporaryAttachment && profile.verificationStatus !== "verified" ? ["verification_not_verified"] : []),
    ...(profile.freshnessStatus !== "current" ? ["freshness_not_current"] : []),
    ...(profile.supersessionStatus !== "current" ? ["superseded_by_newer_document"] : []),
    ...(profile.extractionQualityStatus !== "high" ? ["extraction_quality_not_high"] : []),
    ...((profile.flags ?? []).some((flag) => flag === "manual_rag_exclusion" || (!temporaryAttachment && flag === "verification_required")) ? ["quality_flag_blocks_publication"] : []),
    ...extractionConfidenceRestrictionReasons(manifest)
  ]
  return {
    profile,
    reasons: [...new Set(reasons)].sort(),
    approved: reasons.length === 0
  }
}

function isScopedTemporaryAttachment(manifest: QualityGateManifest): boolean {
  const metadata = manifest.metadata
  const expiresAt = typeof metadata?.expiresAt === "string" ? Date.parse(metadata.expiresAt) : Number.NaN
  return metadata?.scopeType === "chat"
    && typeof metadata.ownerUserId === "string"
    && metadata.ownerUserId.length > 0
    && typeof metadata.tenantId === "string"
    && metadata.tenantId.length > 0
    && typeof metadata.temporaryScopeId === "string"
    && metadata.temporaryScopeId.length > 0
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now()
    && profileAllowsTemporaryAttachment(manifest)
}

function profileAllowsTemporaryAttachment(manifest: QualityGateManifest): boolean {
  const profile = resolveDocumentQualityProfile(manifest)
  return profile.knowledgeQualityStatus === "warning"
    && profile.verificationStatus === "unverified"
    && profile.ragEligibility === "eligible_with_warning"
    && profile.extractionQualityStatus === "high"
}

export function qualityProfileCacheKey(manifest: QualityGateManifest): string {
  const profile = resolveDocumentQualityProfile(manifest)
  return JSON.stringify({
    knowledgeQualityStatus: profile.knowledgeQualityStatus,
    verificationStatus: profile.verificationStatus,
    freshnessStatus: profile.freshnessStatus,
    supersessionStatus: profile.supersessionStatus,
    extractionQualityStatus: profile.extractionQualityStatus,
    ragEligibility: profile.ragEligibility,
    confidence: profile.confidence,
    flags: profile.flags,
    admissionStatus: manifest.admission?.status,
    qualityReferenceHash: manifest.admission?.qualityRef?.hash,
    derivedIntegrityVerified: manifest.derivedIntegrity?.verified,
    documentSecurityEnvelopeHash: manifest.securityEnvelope?.envelopeHash,
    publicationEligible: manifest.publicationEligible,
    processingStatus: manifest.processingStatus,
    extractionRestrictions: extractionConfidenceRestrictionReasons(manifest)
  })
}

function requiredQualityFieldReasons(profile: DocumentQualityProfile): string[] {
  const reasons: string[] = []
  if (!profile.knowledgeQualityStatus) reasons.push("knowledge_quality_status_missing")
  if (!profile.verificationStatus) reasons.push("verification_status_missing")
  if (!profile.freshnessStatus) reasons.push("freshness_status_missing")
  if (!profile.supersessionStatus) reasons.push("supersession_status_missing")
  if (!profile.extractionQualityStatus) reasons.push("extraction_quality_status_missing")
  if (!profile.ragEligibility) reasons.push("rag_eligibility_missing")
  return reasons
}

function requiredAdmissionReferenceReasons(manifest: QualityGateManifest): string[] {
  const admission = manifest.admission
  const references = [
    ["authorization_ref_missing", admission?.authorizationRef],
    ["classification_ref_missing", admission?.classificationRef],
    ["usage_policy_ref_missing", admission?.usagePolicyRef],
    ["quality_ref_missing", admission?.qualityRef],
    ["lifecycle_ref_missing", admission?.lifecycleRef],
    ["provenance_ref_missing", admission?.provenanceRef]
  ] as const
  return references
    .filter(([, reference]) => !reference?.id || !reference.version || !/^[a-f0-9]{64}$/i.test(reference.hash))
    .map(([reason]) => reason)
}

function extractionConfidenceRestrictionReasons(
  manifest: Pick<DocumentManifest, "extractionWarnings" | "chunks" | "parsedDocument">
): string[] {
  const reasons = new Set<string>()
  for (const warning of [...(manifest.extractionWarnings ?? []), ...(manifest.parsedDocument?.warnings ?? [])]) {
    if (isLowConfidenceWarning(warning)) reasons.add("low_confidence_extraction_warning")
  }
  if ((manifest.chunks ?? []).some((chunk) => typeof chunk.confidence === "number" && chunk.confidence < 70)) reasons.add("low_confidence_chunk")
  if ((manifest.parsedDocument?.pages ?? []).some((page) => typeof page.confidence === "number" && page.confidence < 70)) reasons.add("low_confidence_page")
  if ((manifest.parsedDocument?.tables ?? []).some((table) => typeof table.confidence === "number" && table.confidence < 70)) reasons.add("low_confidence_table")
  if ((manifest.parsedDocument?.figures ?? []).some((figure) => typeof figure.confidence === "number" && figure.confidence < 70)) reasons.add("low_confidence_figure")
  return [...reasons].sort()
}

function isLowConfidenceWarning(warning: ExtractionWarning): boolean {
  return warning.severity === "error" || (typeof warning.confidence === "number" && warning.confidence < 70)
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function numberValue(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function flagValues(value: JsonValue | undefined): QualityFlag[] | undefined {
  if (!Array.isArray(value)) return undefined
  const flags = value.filter((item): item is QualityFlag => typeof item === "string" && qualityFlags.has(item as QualityFlag))
  return flags.length > 0 ? [...new Set(flags)] : undefined
}

function knowledgeQualityStatusValue(value: JsonValue | undefined): KnowledgeQualityStatus | undefined {
  return typeof value === "string" && knowledgeQualityStatuses.has(value as KnowledgeQualityStatus) ? value as KnowledgeQualityStatus : undefined
}

function verificationStatusValue(value: JsonValue | undefined): VerificationStatus | undefined {
  return typeof value === "string" && verificationStatuses.has(value as VerificationStatus) ? value as VerificationStatus : undefined
}

function freshnessStatusValue(value: JsonValue | undefined): FreshnessStatus | undefined {
  return typeof value === "string" && freshnessStatuses.has(value as FreshnessStatus) ? value as FreshnessStatus : undefined
}

function supersessionStatusValue(value: JsonValue | undefined): SupersessionStatus | undefined {
  return typeof value === "string" && supersessionStatuses.has(value as SupersessionStatus) ? value as SupersessionStatus : undefined
}

function extractionQualityStatusValue(value: JsonValue | undefined): ExtractionQualityStatus | undefined {
  return typeof value === "string" && extractionQualityStatuses.has(value as ExtractionQualityStatus) ? value as ExtractionQualityStatus : undefined
}

function ragEligibilityValue(value: JsonValue | undefined): RagEligibilityStatus | undefined {
  return typeof value === "string" && ragEligibilityStatuses.has(value as RagEligibilityStatus) ? value as RagEligibilityStatus : undefined
}

function hasDefinedValue(profile: DocumentQualityProfile): boolean {
  return Object.values(profile).some((value) => value !== undefined)
}
