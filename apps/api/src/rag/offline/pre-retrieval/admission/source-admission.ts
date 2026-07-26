import { createHash } from "node:crypto"
import type {
  AuthoritativeAdmissionContext,
  DocumentLifecycleStatus,
  IngestAdmissionContext,
  JsonValue,
  LocalTestFixtureAdmissionContext,
  SourceAdmissionRecord,
  VersionedRecordReference
} from "../../../../types.js"
import {
  MANDATORY_RAG_GUARDS,
  measureRuntimeRagGuards,
  safeDegradationDecision,
  type MandatoryRagGuard
} from "../../../_shared/security/safe-degradation-policy.js"

export type { AuthoritativeAdmissionContext, IngestAdmissionContext, LocalTestFixtureAdmissionContext }

export type SourceAdmissionResult = {
  metadata: Record<string, JsonValue>
  record: SourceAdmissionRecord
}

const PROTECTED_METADATA_KEYS = new Set([
  "tenantId",
  "ownerUserId",
  "scopeType",
  "groupId",
  "groupIds",
  "folderId",
  "folderIds",
  "aclGroup",
  "aclGroups",
  "allowedGroups",
  "allowedUsers",
  "userIds",
  "temporaryScopeId",
  "expiresAt",
  "domainPolicy",
  "ragPolicy",
  "answerPolicy",
  "ragEligibility",
  "qualityProfile",
  "knowledgeQualityStatus",
  "verificationStatus",
  "freshnessStatus",
  "supersessionStatus",
  "extractionQualityStatus",
  "classification",
  "classificationRef",
  "usagePolicyRef",
  "qualityRef",
  "authorizationRef",
  "lifecycleRef",
  "provenanceRef",
  "lifecycleStatus",
  "activeDocumentId",
  "stagedFromDocumentId",
  "reindexMigrationId",
  "sourceAdmissionStatus",
  "inspectionStatus",
  "malwareScan",
  "malwareScanStatus",
  "malwareScanProfileVersion",
  "sourceGovernancePolicyVersion",
  "sourceGovernanceStatus"
])

export function resolveSourceAdmission(input: {
  context?: IngestAdmissionContext
  metadata?: Record<string, JsonValue>
  runtimeEnvironment: string
  admittedAt: string
}): SourceAdmissionResult {
  const rejectedProtectedMetadataKeys = Object.keys(input.metadata ?? {})
    .filter((key) => PROTECTED_METADATA_KEYS.has(key))
    .sort()
  const metadata = Object.fromEntries(
    Object.entries(input.metadata ?? {}).filter(([key]) => !PROTECTED_METADATA_KEYS.has(key))
  )

  if (input.context?.mode === "local_test_fixture" && input.runtimeEnvironment !== "production") {
    const fixtureId = input.context.fixtureId.trim()
    const fixtureMetadata: Record<string, JsonValue> = { ...(input.metadata ?? {}) }
    const tenantId = metadataString(fixtureMetadata.tenantId) || input.context.tenantId?.trim() || `fixture-tenant-${fixtureId}`
    const ownerUserId = metadataString(fixtureMetadata.ownerUserId) || input.context.ownerUserId?.trim() || `fixture-owner-${fixtureId}`
    if (!fixtureId) {
      return unresolvedAdmission(metadata, rejectedProtectedMetadataKeys, input.admittedAt, "local_test_fixture_id_missing")
    }
    const reference = (kind: string) => fixtureReference(fixtureId, kind)
    const hasFixtureAccessControl = [
      "aclGroup",
      "aclGroups",
      "allowedGroups",
      "allowedUsers",
      "userIds",
      "groupId",
      "groupIds",
      "folderId",
      "folderIds"
    ].some((key) => fixtureMetadata[key] !== undefined)
    return {
      metadata: {
        ...fixtureMetadata,
        tenantId,
        ownerUserId,
        scopeType: fixtureMetadata.scopeType ?? "personal",
        ...(!hasFixtureAccessControl ? { allowedUsers: [ownerUserId] } : {}),
        ragEligibility: fixtureMetadata.ragEligibility ?? "eligible",
        lifecycleStatus: fixtureMetadata.lifecycleStatus ?? "active"
      },
      record: {
        schemaVersion: 1,
        status: "approved",
        tenantId,
        ownerUserId,
        authorizationRef: reference("authorization"),
        classificationRef: reference("classification"),
        usagePolicyRef: reference("usage-policy"),
        qualityRef: reference("quality"),
        lifecycleRef: reference("lifecycle"),
        provenanceRef: reference("provenance"),
        inspectionStatus: "passed",
        malwareScan: { status: "clean", profileVersion: "local-test-fixture-v1" },
        reasons: [],
        rejectedProtectedMetadataKeys: [],
        admittedAt: input.admittedAt
      }
    }
  }

  if (!input.context || input.context.mode !== "authoritative") {
    const reason = input.context?.mode === "local_test_fixture"
      ? "local_test_fixture_forbidden_in_production"
      : "authoritative_admission_context_missing"
    return unresolvedAdmission(metadata, rejectedProtectedMetadataKeys, input.admittedAt, reason)
  }

  const context = input.context
  const tenantId = context.tenantId.trim()
  const ownerUserId = context.ownerUserId.trim()
  const inspectionStatus = context.inspectionStatus ?? "unknown"
  const malwareScanStatus = context.malwareScan?.status ?? "unknown"
  const malwareScanProfileVersion = context.malwareScan?.profileVersion?.trim()
  const references = {
    authorizationRef: validReference(context.authorizationRef),
    classificationRef: validReference(context.classificationRef),
    usagePolicyRef: validReference(context.usagePolicyRef),
    qualityRef: validReference(context.qualityRef),
    lifecycleRef: validReference(context.lifecycleRef),
    provenanceRef: validReference(context.provenanceRef)
  }
  const reasons: string[] = []
  if (!tenantId) reasons.push("tenant_id_missing")
  if (!ownerUserId) reasons.push("owner_user_id_missing")
  for (const [key, reference] of Object.entries(references)) {
    if (!reference) reasons.push(`${key.replace(/Ref$/, "_ref").replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`)}_missing_or_invalid`)
  }
  if (!context.qualityProfile) reasons.push("quality_profile_missing")
  if (!context.lifecycleStatus) reasons.push("lifecycle_status_missing")
  if (!context.scope) reasons.push("authorization_scope_missing")
  if (inspectionStatus === "unknown") reasons.push("source_inspection_unknown")
  if (inspectionStatus === "failed") reasons.push("source_inspection_failed")
  if (malwareScanStatus !== "clean") reasons.push(`source_malware_scan_${malwareScanStatus}`)
  if (malwareScanStatus === "clean" && !malwareScanProfileVersion) reasons.push("source_malware_scan_profile_version_missing")

  const status = inspectionStatus === "failed" || malwareScanStatus === "infected"
    ? "rejected"
    : reasons.length > 0 ? "quarantined" : "approved"
  const lifecycleStatus: DocumentLifecycleStatus = status === "approved"
    ? context.lifecycleStatus ?? "staging"
    : "staging"

  const authoritativeMetadata: Record<string, JsonValue> = {
    ...metadata,
    ...(tenantId ? { tenantId } : {}),
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(context.qualityProfile ? { qualityProfile: context.qualityProfile as JsonValue } : {}),
    ...(context.qualityProfile?.ragEligibility ? { ragEligibility: context.qualityProfile.ragEligibility } : {}),
    lifecycleStatus
  }
  if (context.scope) {
    authoritativeMetadata.scopeType = context.scope.scopeType
    if (context.scope.groupIds?.length) {
      const primaryGroupId = context.scope.groupIds[0]!
      authoritativeMetadata.groupId = primaryGroupId
      authoritativeMetadata.groupIds = [...context.scope.groupIds]
      authoritativeMetadata.aclGroup = primaryGroupId
      authoritativeMetadata.aclGroups = [...context.scope.groupIds]
    }
    if (context.scope.folderIds?.length) {
      authoritativeMetadata.folderId = context.scope.folderIds[0]!
      authoritativeMetadata.folderIds = [...context.scope.folderIds]
    }
    if (context.scope.allowedUsers?.length) authoritativeMetadata.allowedUsers = [...context.scope.allowedUsers]
    if (context.scope.temporaryScopeId) authoritativeMetadata.temporaryScopeId = context.scope.temporaryScopeId
    if (context.scope.expiresAt) authoritativeMetadata.expiresAt = context.scope.expiresAt
  }
  if (context.lifecycleMetadata?.activeDocumentId) authoritativeMetadata.activeDocumentId = context.lifecycleMetadata.activeDocumentId
  if (context.lifecycleMetadata?.stagedFromDocumentId) authoritativeMetadata.stagedFromDocumentId = context.lifecycleMetadata.stagedFromDocumentId
  if (context.lifecycleMetadata?.reindexMigrationId) authoritativeMetadata.reindexMigrationId = context.lifecycleMetadata.reindexMigrationId

  return {
    metadata: authoritativeMetadata,
    record: {
      schemaVersion: 1,
      status,
      tenantId: tenantId || undefined,
      ownerUserId: ownerUserId || undefined,
      ...references,
      inspectionStatus,
      malwareScan: {
        status: malwareScanStatus,
        ...(malwareScanProfileVersion ? { profileVersion: malwareScanProfileVersion } : {})
      },
      reasons,
      rejectedProtectedMetadataKeys,
      admittedAt: input.admittedAt,
      degradationDecision: status === "approved" ? undefined : admissionDegradationDecision(reasons)
    }
  }
}

export function createVersionedReference(id: string, version: string, value: JsonValue | string): VersionedRecordReference {
  return {
    id,
    version,
    hash: createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex")
  }
}

function unresolvedAdmission(
  metadata: Record<string, JsonValue>,
  rejectedProtectedMetadataKeys: string[],
  admittedAt: string,
  reason: string
): SourceAdmissionResult {
  return {
    metadata: { ...metadata, lifecycleStatus: "staging" },
    record: {
      schemaVersion: 1,
      status: "quarantined",
      inspectionStatus: "unknown",
      malwareScan: { status: "unknown" },
      reasons: [reason],
      rejectedProtectedMetadataKeys,
      admittedAt,
      degradationDecision: admissionDegradationDecision([reason])
    }
  }
}

function admissionDegradationDecision(reasons: string[]) {
  const missing = new Set<MandatoryRagGuard>()
  if (reasons.some((reason) => /tenant|owner|context_missing|fixture_forbidden/.test(reason))) missing.add("authentication")
  if (reasons.some((reason) => /authorization|scope/.test(reason))) missing.add("authorization")
  if (reasons.some((reason) => /classification|usage/.test(reason))) missing.add("classification_usage")
  if (reasons.some((reason) => /quality|inspection|malware|lifecycle/.test(reason))) {
    missing.add("grounding")
    missing.add("citation")
  }
  return safeDegradationDecision({
    trigger: "dependency_error",
    stage: "source_admission",
    requestedAction: "fail",
    guardOutcomes: measureRuntimeRagGuards(Object.fromEntries(MANDATORY_RAG_GUARDS.map((guard) => [guard, {
      passed: !missing.has(guard),
      evidence: missing.has(guard) ? "admission_runtime_check_failed" : "admission_runtime_check_passed"
    }])) as Record<MandatoryRagGuard, { passed: boolean; evidence: string }>)
  })
}

function fixtureReference(fixtureId: string, kind: string): VersionedRecordReference {
  return createVersionedReference(`fixture:${fixtureId}:${kind}`, "fixture-v1", `${fixtureId}:${kind}`)
}

function validReference(reference: VersionedRecordReference | undefined): VersionedRecordReference | undefined {
  if (!reference?.id.trim() || !reference.version.trim() || !/^[a-f0-9]{64}$/i.test(reference.hash)) return undefined
  return { id: reference.id.trim(), version: reference.version.trim(), hash: reference.hash.toLowerCase() }
}

function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key]!)}`).join(",")}}`
}

function metadataString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
