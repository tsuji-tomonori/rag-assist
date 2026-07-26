import { createHash } from "node:crypto"
import type {
  DerivedArtifactIntegrity,
  DerivedRecordSecurityEnvelope,
  SourceAdmissionRecord,
  SourceLocation,
  VectorRecord,
  VersionedRecordReference
} from "../../../types.js"

type CompleteAdmission = SourceAdmissionRecord & {
  tenantId: string
  authorizationRef: VersionedRecordReference
  classificationRef: VersionedRecordReference
  usagePolicyRef: VersionedRecordReference
  qualityRef: VersionedRecordReference
  lifecycleRef: VersionedRecordReference
  provenanceRef: VersionedRecordReference
}

export function isCompleteApprovedAdmission(admission: SourceAdmissionRecord): admission is CompleteAdmission {
  return admission.status === "approved"
    && admission.inspectionStatus === "passed"
    && admission.malwareScan?.status === "clean"
    && Boolean(admission.malwareScan.profileVersion)
    && Boolean(admission.tenantId)
    && hasReference(admission.authorizationRef)
    && hasReference(admission.classificationRef)
    && hasReference(admission.usagePolicyRef)
    && hasReference(admission.qualityRef)
    && hasReference(admission.lifecycleRef)
    && hasReference(admission.provenanceRef)
}

export function createDerivedRecordSecurityEnvelope(input: {
  documentId: string
  documentVersion: string
  admission: CompleteAdmission
  sourceLocator: SourceLocation
}): DerivedRecordSecurityEnvelope {
  const unsigned = {
    schemaVersion: 1 as const,
    documentId: input.documentId,
    documentVersion: input.documentVersion,
    tenantId: input.admission.tenantId,
    authorizationRef: input.admission.authorizationRef,
    classificationRef: input.admission.classificationRef,
    usagePolicyRef: input.admission.usagePolicyRef,
    qualityRef: input.admission.qualityRef,
    lifecycleRef: input.admission.lifecycleRef,
    provenanceRef: input.admission.provenanceRef,
    sourceLocator: input.sourceLocator
  }
  return { ...unsigned, envelopeHash: stableHash(unsigned) }
}

export function verifyDerivedRecordSecurityEnvelope(
  envelope: DerivedRecordSecurityEnvelope | undefined,
  expected: { documentId: string; documentVersion: string; admission: CompleteAdmission }
): string[] {
  if (!envelope) return ["security_envelope_missing"]
  const reasons: string[] = []
  if (envelope.documentId !== expected.documentId) reasons.push("security_envelope_document_mismatch")
  if (envelope.documentVersion !== expected.documentVersion) reasons.push("security_envelope_document_version_mismatch")
  if (envelope.tenantId !== expected.admission.tenantId) reasons.push("security_envelope_tenant_mismatch")
  for (const key of [
    "authorizationRef",
    "classificationRef",
    "usagePolicyRef",
    "qualityRef",
    "lifecycleRef",
    "provenanceRef"
  ] as const) {
    if (stableHash(envelope[key]) !== stableHash(expected.admission[key])) reasons.push(`security_envelope_${key}_mismatch`)
  }
  if (!hasSourceLocator(envelope.sourceLocator)) reasons.push("security_envelope_source_locator_missing")
  const { envelopeHash: _hash, ...unsigned } = envelope
  if (stableHash(unsigned) !== envelope.envelopeHash) reasons.push("security_envelope_hash_mismatch")
  return reasons
}

export function reconcileDerivedArtifacts(input: {
  documentId: string
  documentVersion: string
  admission: CompleteAdmission
  expectedChunkIds: string[]
  expectedMemoryCardIds: string[]
  evidenceRecords: VectorRecord[]
  memoryRecords: VectorRecord[]
  manifestProjection: unknown
}): DerivedArtifactIntegrity {
  const reasons: string[] = []
  if (input.evidenceRecords.length !== input.expectedChunkIds.length) reasons.push("evidence_record_count_mismatch")
  if (input.memoryRecords.length !== input.expectedMemoryCardIds.length) reasons.push("memory_record_count_mismatch")

  const evidenceIds = input.evidenceRecords.map((record) => record.metadata.chunkId).filter(isString).sort()
  const memoryIds = input.memoryRecords.map((record) => record.metadata.memoryId).filter(isString).sort()
  if (!sameStrings(evidenceIds, [...input.expectedChunkIds].sort())) reasons.push("evidence_record_identity_mismatch")
  if (!sameStrings(memoryIds, [...input.expectedMemoryCardIds].sort())) reasons.push("memory_record_identity_mismatch")

  for (const record of [...input.evidenceRecords, ...input.memoryRecords]) {
    reasons.push(...verifyDerivedRecordSecurityEnvelope(record.metadata.securityEnvelope, input))
  }

  return {
    schemaVersion: 1,
    expectedChunkCount: input.expectedChunkIds.length,
    expectedMemoryCardCount: input.expectedMemoryCardIds.length,
    evidenceRecordCount: input.evidenceRecords.length,
    memoryRecordCount: input.memoryRecords.length,
    manifestHash: stableHash(input.manifestProjection),
    recordSetHash: derivedRecordSetHash([...input.evidenceRecords, ...input.memoryRecords]),
    verified: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  }
}

export function derivedRecordSetHash(records: VectorRecord[]): string {
  return stableHash(records
    .map((record) => ({
      key: record.key,
      metadataHash: stableHash(record.metadata),
      vectorHash: stableHash(record.vector)
    }))
    .sort((left, right) => left.key.localeCompare(right.key)))
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null"
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(",")}}`
}

function hasReference(reference: VersionedRecordReference | undefined): reference is VersionedRecordReference {
  return Boolean(reference?.id && reference.version && /^[a-f0-9]{64}$/i.test(reference.hash))
}

function hasSourceLocator(locator: SourceLocation): boolean {
  return Boolean(
    locator.sourceBlockId
    || locator.sourceChunkIds?.length
    || (Number.isInteger(locator.startChar) && Number.isInteger(locator.endChar) && locator.endChar! >= locator.startChar!)
    || Number.isInteger(locator.page)
    || Number.isInteger(locator.pageStart)
  )
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isString(value: string | undefined): value is string {
  return typeof value === "string"
}
