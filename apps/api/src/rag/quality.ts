import type {
  DocumentManifest,
  DocumentQualityProfile,
  ExtractionQualityStatus,
  FreshnessStatus,
  JsonValue,
  KnowledgeQualityStatus,
  QualityFlag,
  RagEligibilityStatus,
  SupersessionStatus,
  VerificationStatus
} from "../types.js"

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

export function isQualityApprovedForNormalRag(manifest: Pick<DocumentManifest, "metadata" | "qualityProfile">): boolean {
  return qualityGateForNormalRag(manifest).approved
}

export function qualityGateForNormalRag(manifest: Pick<DocumentManifest, "metadata" | "qualityProfile">): QualityGateDecision {
  const profile = resolveDocumentQualityProfile(manifest)
  return {
    profile,
    approved:
      profile.knowledgeQualityStatus !== "blocked" &&
      profile.ragEligibility === "eligible" &&
      profile.verificationStatus !== "rejected" &&
      profile.freshnessStatus !== "expired" &&
      profile.supersessionStatus !== "superseded" &&
      profile.extractionQualityStatus !== "unusable"
  }
}

export function qualityProfileCacheKey(manifest: Pick<DocumentManifest, "metadata" | "qualityProfile">): string {
  const profile = resolveDocumentQualityProfile(manifest)
  return JSON.stringify({
    knowledgeQualityStatus: profile.knowledgeQualityStatus,
    verificationStatus: profile.verificationStatus,
    freshnessStatus: profile.freshnessStatus,
    supersessionStatus: profile.supersessionStatus,
    extractionQualityStatus: profile.extractionQualityStatus,
    ragEligibility: profile.ragEligibility,
    confidence: profile.confidence,
    flags: profile.flags
  })
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
