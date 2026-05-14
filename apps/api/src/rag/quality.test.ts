import assert from "node:assert/strict"
import test from "node:test"

import {
  documentQualityProfileFromMetadata,
  isQualityApprovedForNormalRag,
  qualityGateForNormalRag,
  qualityProfileCacheKey
} from "./quality.js"

test("document quality profile normalizes nested and flat metadata values", () => {
  const profile = documentQualityProfileFromMetadata({
    qualityProfile: {
      knowledgeQualityStatus: "warning",
      verificationStatus: "unverified",
      freshnessStatus: "stale",
      supersessionStatus: "current",
      extractionQualityStatus: "medium",
      ragEligibility: "eligible_with_warning",
      confidence: 0.82,
      flags: ["low_extraction_confidence", "low_extraction_confidence", "unknown"],
      updatedAt: "2026-05-14T09:00:00.000Z",
      updatedBy: "reviewer@example.com"
    },
    verificationStatus: "verified"
  })

  assert.deepEqual(profile, {
    knowledgeQualityStatus: "warning",
    verificationStatus: "unverified",
    freshnessStatus: "stale",
    supersessionStatus: "current",
    extractionQualityStatus: "medium",
    ragEligibility: "eligible_with_warning",
    confidence: 0.82,
    flags: ["low_extraction_confidence"],
    updatedAt: "2026-05-14T09:00:00.000Z",
    updatedBy: "reviewer@example.com"
  })
})

test("document quality profile ignores invalid metadata and absent profiles", () => {
  assert.equal(documentQualityProfileFromMetadata(undefined), undefined)
  assert.equal(documentQualityProfileFromMetadata({ qualityProfile: ["invalid"] }), undefined)
  assert.equal(documentQualityProfileFromMetadata({ qualityProfile: { confidence: Number.NaN } }), undefined)
  assert.deepEqual(documentQualityProfileFromMetadata({
    knowledgeQualityStatus: "approved",
    verificationStatus: "invalid",
    qualityFlags: ["manual_rag_exclusion", 10]
  }), {
    knowledgeQualityStatus: "approved",
    verificationStatus: undefined,
    freshnessStatus: undefined,
    supersessionStatus: undefined,
    extractionQualityStatus: undefined,
    ragEligibility: undefined,
    confidence: undefined,
    flags: ["manual_rag_exclusion"],
    updatedAt: undefined,
    updatedBy: undefined
  })
})

test("normal RAG quality gate blocks every explicit disqualifier", () => {
  assert.equal(isQualityApprovedForNormalRag({ metadata: undefined, qualityProfile: undefined }), true)

  const blockedProfiles = [
    { knowledgeQualityStatus: "blocked" },
    { ragEligibility: "excluded" },
    { verificationStatus: "rejected" },
    { freshnessStatus: "expired" },
    { supersessionStatus: "superseded" },
    { extractionQualityStatus: "unusable" }
  ] as const

  for (const qualityProfile of blockedProfiles) {
    assert.equal(qualityGateForNormalRag({ metadata: undefined, qualityProfile }).approved, false)
  }
})

test("quality profile cache key is stable for gate-relevant fields", () => {
  assert.equal(
    qualityProfileCacheKey({
      metadata: {
        qualityProfile: {
          ragEligibility: "excluded",
          qualityUpdatedBy: "ignored"
        }
      },
      qualityProfile: {
        ragEligibility: "eligible",
        flags: ["verification_required"]
      }
    }),
    JSON.stringify({
      knowledgeQualityStatus: "approved",
      verificationStatus: "verified",
      freshnessStatus: "current",
      supersessionStatus: "current",
      extractionQualityStatus: "high",
      ragEligibility: "eligible",
      confidence: undefined,
      flags: ["verification_required"]
    })
  )
})
