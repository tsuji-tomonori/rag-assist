import assert from "node:assert/strict"
import test from "node:test"

import {
  CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
  evaluateCurrentRagEligibility,
  type CurrentRagEligibilitySnapshot
} from "./_shared/security/current-rag-eligibility.js"
import type { DerivedRecordSecurityEnvelope, VersionedRecordReference } from "../types.js"

function reference(kind: string, version = "v1"): VersionedRecordReference {
  return { id: kind, version, hash: "a".repeat(64) }
}

function envelope(): DerivedRecordSecurityEnvelope {
  return {
    schemaVersion: 1,
    documentId: "doc-1",
    documentVersion: "document-v1",
    tenantId: "tenant-a",
    authorizationRef: reference("authorization"),
    classificationRef: reference("classification"),
    usagePolicyRef: reference("usage"),
    qualityRef: reference("quality"),
    lifecycleRef: reference("lifecycle"),
    provenanceRef: reference("provenance"),
    sourceLocator: { startChar: 0, endChar: 10 },
    envelopeHash: "b".repeat(64)
  }
}

function snapshot(): CurrentRagEligibilitySnapshot {
  const value = envelope()
  return {
    policyVersion: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
    documentId: value.documentId,
    documentVersion: value.documentVersion,
    tenantId: value.tenantId,
    lifecycleActive: true,
    admissionApproved: true,
    authorizationAllowed: true,
    classificationAllowed: true,
    usageAllowed: true,
    qualityAllowed: true,
    authorizationRef: value.authorizationRef,
    classificationRef: value.classificationRef,
    usagePolicyRef: value.usagePolicyRef,
    qualityRef: value.qualityRef,
    lifecycleRef: value.lifecycleRef,
    provenanceRef: value.provenanceRef
  }
}

function decide(overrides: Partial<Parameters<typeof evaluateCurrentRagEligibility>[0]> = {}) {
  return evaluateCurrentRagEligibility({
    actor: { accountStatus: "active", tenantId: "tenant-a" },
    identityVerified: true,
    purpose: "normal_answer",
    envelope: envelope(),
    current: snapshot(),
    now: new Date("2026-07-11T00:00:00.000Z"),
    ...overrides
  })
}

test("FR-069/070 requires every current authorization/classification/usage/quality/lifecycle reference", () => {
  assert.deepEqual(decide(), {
    allowed: true,
    policyVersion: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
    purpose: "normal_answer",
    reason: "eligible"
  })

  const current = snapshot()
  current.classificationRef = undefined
  assert.equal(decide({ current }).reason, "reference_missing")

  const changed = snapshot()
  changed.usagePolicyRef = reference("usage", "v2")
  assert.equal(decide({ current: changed }).reason, "reference_changed")
})
test("FR-070 denies before evidence for inactive account, cross-tenant, revoked, ineligible, or expired state", () => {
  assert.equal(decide({ actor: { accountStatus: "suspended", tenantId: "tenant-a" } }).reason, "account_inactive")
  assert.equal(decide({ actor: { accountStatus: "active", tenantId: "tenant-b" } }).reason, "tenant_mismatch")

  for (const [field, reason] of [
    ["authorizationAllowed", "authorization_denied"],
    ["classificationAllowed", "classification_denied"],
    ["usageAllowed", "usage_denied"],
    ["qualityAllowed", "quality_denied"],
    ["lifecycleActive", "lifecycle_inactive"],
    ["admissionApproved", "admission_not_approved"]
  ] as const) {
    const current = { ...snapshot(), [field]: false }
    assert.equal(decide({ current }).reason, reason)
  }

  assert.equal(decide({ current: { ...snapshot(), expiresAt: "2026-07-10T23:59:59.000Z" } }).reason, "expired")
})

test("FR-070 fails closed for missing or mismatched derived record identity", () => {
  assert.equal(decide({ envelope: undefined }).reason, "security_envelope_missing")
  assert.equal(decide({ envelope: { ...envelope(), documentId: "doc-other" } }).reason, "document_mismatch")
  assert.equal(decide({ envelope: { ...envelope(), documentVersion: "document-old" } }).reason, "document_version_mismatch")
})
