import assert from "node:assert/strict"
import test from "node:test"

import { config } from "../config.js"
import { ragRuntimePolicy } from "../chat-orchestration/runtime-policy.js"
import type { Dependencies } from "../dependencies.js"
import type {
  AuthoritativeAdmissionContext,
  ChunkingPolicySnapshot,
  DocumentQualityProfile,
  SourceAdmissionRecord,
  VersionedRecordReference,
  VectorRecord
} from "../types.js"
import { verifyDerivedRecordSecurityEnvelope } from "./_shared/security/derived-record-security.js"
import { isQualityApprovedForNormalRag } from "./_shared/policies/quality-policy.js"
import { loadChunksForManifest } from "./_shared/storage/manifest-chunks.js"
import { chunkDocumentWithPolicy } from "./offline/pre-retrieval/chunking/chunker.service.js"
import { extractDocumentFromUpload } from "./offline/pre-retrieval/extraction/text-extractor.js"
import { runIngestPipeline } from "./offline/pre-retrieval/ingestion/ingest-run.service.js"
import { createVersionedReference, resolveSourceAdmission } from "./offline/pre-retrieval/admission/source-admission.js"
import { RAG_SAFETY_STATE_KEY, type RagSafetyState } from "./quality-control/production-rag-monitor.js"
import { buildNativeTextPdf } from "./test-support/native-text-pdf.js"

test("FR-068 source admission rejects caller-controlled protected attributes and quarantines incomplete authority", () => {
  const partial = resolveSourceAdmission({
    context: {
      mode: "authoritative",
      tenantId: "tenant-server",
      ownerUserId: "owner-server",
      authorizationRef: reference("authorization"),
      inspectionStatus: "passed"
    },
    metadata: {
      tenantId: "tenant-attacker",
      ownerUserId: "owner-attacker",
      aclGroups: ["attacker-admin"],
      qualityProfile: { ragEligibility: "eligible" },
      sourceGovernancePolicyVersion: "caller-approved-v999",
      sourceGovernanceStatus: "published",
      title: "caller title"
    },
    runtimeEnvironment: "production",
    admittedAt: "2026-07-11T00:00:00.000Z"
  })

  assert.equal(partial.record.status, "quarantined")
  assert.equal(partial.metadata.tenantId, "tenant-server")
  assert.equal(partial.metadata.ownerUserId, "owner-server")
  assert.equal(partial.metadata.aclGroups, undefined)
  assert.equal(partial.metadata.sourceGovernancePolicyVersion, undefined)
  assert.equal(partial.metadata.sourceGovernanceStatus, undefined)
  assert.equal(partial.metadata.title, "caller title")
  assert.ok(partial.record.rejectedProtectedMetadataKeys.includes("tenantId"))
  assert.ok(partial.record.rejectedProtectedMetadataKeys.includes("sourceGovernanceStatus"))
  assert.ok(partial.record.reasons.includes("classification_ref_missing_or_invalid"))
  assert.ok(partial.record.reasons.includes("quality_profile_missing"))
  assert.equal(partial.record.degradationDecision?.stage, "source_admission")
  assert.equal(partial.record.degradationDecision?.action, "fail")
  assert.equal(partial.record.degradationDecision?.safeToReturnContent, false)
  assert.ok(partial.record.degradationDecision?.missingGuards.includes("classification_usage"))

  const unknown = resolveSourceAdmission({
    context: { ...fullAdmissionContext(), inspectionStatus: "unknown" },
    runtimeEnvironment: "production",
    admittedAt: "2026-07-11T00:00:00.000Z"
  })
  assert.equal(unknown.record.status, "quarantined")
  assert.ok(unknown.record.reasons.includes("source_inspection_unknown"))

  const failed = resolveSourceAdmission({
    context: { ...fullAdmissionContext(), inspectionStatus: "failed" },
    runtimeEnvironment: "production",
    admittedAt: "2026-07-11T00:00:00.000Z"
  })
  assert.equal(failed.record.status, "rejected")
})

test("FR-069 approved ingest propagates the security envelope and reconciles manifest/vector artifacts", async () => {
  const harness = createPipelineHarness()
  const manifest = await runIngestPipeline(harness.deps, {
    fileName: "approved.md",
    text: "# Approved\n\nThis is approved knowledge with a stable source locator.",
    metadata: {
      tenantId: "tenant-attacker",
      ownerUserId: "owner-attacker",
      qualityProfile: { ragEligibility: "excluded" },
      title: "Approved title"
    },
    admissionContext: fullAdmissionContext()
  }, async ({ chunks }) => [{
    id: "memory-document",
    summary: "Approved summary",
    keywords: ["approved"],
    likelyQuestions: ["What is approved?"],
    constraints: [],
    text: "Approved summary",
    sourceChunkIds: chunks.map((chunk) => chunk.id)
  }])

  assert.equal(manifest.admission?.status, "approved")
  assert.equal(manifest.publicationEligible, true)
  assert.equal(manifest.processingStatus, "complete")
  assert.equal(manifest.metadata?.tenantId, "tenant-server")
  assert.equal(manifest.metadata?.ownerUserId, "owner-server")
  assert.equal(manifest.derivedIntegrity?.verified, true)
  assert.equal(isQualityApprovedForNormalRag(manifest), true)
  assert.equal(manifest.vectorKeys.length, 2)
  assert.equal(harness.evidenceRecords.length, 1)
  assert.equal(harness.memoryRecords.length, 1)
  assert.ok(manifest.securityEnvelope)
  assert.ok(manifest.chunks?.every((chunk) => chunk.securityEnvelope?.documentVersion === manifest.documentVersion))
  assert.ok([...harness.evidenceRecords, ...harness.memoryRecords].every((record) => {
    const envelope = record.metadata.securityEnvelope
    return envelope?.tenantId === "tenant-server"
      && envelope.documentId === manifest.documentId
      && envelope.documentVersion === manifest.documentVersion
      && Boolean(envelope.sourceLocator)
  }))

  const memoryLedger = JSON.parse(harness.objects.get(manifest.memoryCardsObjectKey!) ?? "{}") as {
    memoryCards?: Array<{ securityEnvelope?: { envelopeHash?: string } }>
  }
  assert.ok(memoryLedger.memoryCards?.[0]?.securityEnvelope?.envelopeHash)
  assert.deepEqual(
    (await loadChunksForManifest(harness.deps, manifest)).map((chunk) => chunk.id),
    manifest.chunks?.map((chunk) => chunk.id)
  )
  await assert.rejects(
    () => loadChunksForManifest(harness.deps, {
      ...manifest,
      chunks: manifest.chunks?.map((chunk, index) => index === 0 ? { ...chunk, id: "tampered-chunk-id" } : chunk)
    }),
    /does not reconcile/
  )

  const tampered = {
    ...harness.evidenceRecords[0]!.metadata.securityEnvelope!,
    tenantId: "tenant-tampered"
  }
  const reasons = verifyDerivedRecordSecurityEnvelope(tampered, {
    documentId: manifest.documentId,
    documentVersion: manifest.documentVersion!,
    admission: manifest.admission as SourceAdmissionRecord & {
      tenantId: string
      authorizationRef: VersionedRecordReference
      classificationRef: VersionedRecordReference
      usagePolicyRef: VersionedRecordReference
      qualityRef: VersionedRecordReference
      lifecycleRef: VersionedRecordReference
      provenanceRef: VersionedRecordReference
    }
  })
  assert.ok(reasons.includes("security_envelope_tenant_mismatch"))
  assert.ok(reasons.includes("security_envelope_hash_mismatch"))
})

test("FR-068 missing production admission context is fail-closed and emits no vectors", async () => {
  const harness = createPipelineHarness()
  await assert.rejects(() => runIngestPipeline(harness.deps, {
    fileName: "unknown.txt",
    text: "Unknown sources must not be published.",
    metadata: { tenantId: "caller-tenant", ragEligibility: "eligible" },
    skipMemory: true
  }, async () => []), /Authoritative tenant is required/)

  assert.equal(harness.evidenceRecords.length, 0)
  assert.equal(harness.memoryRecords.length, 0)
})

test("FR-090 ingest reauthorizes immediately before and after the durable bundle and compensates a racing revoke", async () => {
  const harness = createPipelineHarness()
  let durableChecks = 0
  let externalChecks = 0

  await assert.rejects(runIngestPipeline(harness.deps, {
    fileName: "revoked-during-commit.md",
    text: "This document must not survive a revoke racing the ingest commit.",
    admissionContext: fullAdmissionContext(),
    skipMemory: true,
    currentAuthorization: {
      authorizeExternalSideEffect: async () => { externalChecks += 1 },
      authorizeDurableCommit: async () => {
        durableChecks += 1
        if (durableChecks === 2) throw new Error("permission_revoked")
      }
    }
  }, async () => []), /permission_revoked/)

  assert.equal(externalChecks, 1)
  assert.equal(durableChecks, 2)
  assert.deepEqual(
    [...harness.objects.keys()].filter((key) => !key.startsWith("embedding-cache/")),
    [],
    "source, ledger, manifest, and publication objects are compensated; the tenant-partitioned non-text embedding cache may remain"
  )
  assert.deepEqual(harness.evidenceRecords, [])
  assert.deepEqual(harness.memoryRecords, [])
})

test("FR-093 document quarantine interlock retains ingest only as non-publishable staging", async () => {
  const harness = createPipelineHarness()
  const safetyState: RagSafetyState = {
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: ragRuntimePolicy.profile.version,
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: false,
    documentQuarantineRequired: true,
    responseMode: "normal",
    updatedAt: "2026-07-11T00:00:00.000Z",
    validUntil: "2099-01-01T00:00:00.000Z"
  }
  await harness.deps.objectStore.putText(RAG_SAFETY_STATE_KEY, JSON.stringify(safetyState))

  const manifest = await runIngestPipeline(harness.deps, {
    fileName: "monitor-quarantine.md",
    text: "The monitoring interlock must prevent active publication.",
    admissionContext: fullAdmissionContext(),
    skipMemory: true
  }, async () => [])

  assert.equal(manifest.admission?.status, "quarantined")
  assert.ok(manifest.admission?.reasons.includes("rag_monitor_document_quarantine"))
  assert.equal(manifest.lifecycleStatus, "staging")
  assert.equal(manifest.processingStatus, "quarantined")
  assert.equal(manifest.publicationEligible, false)
  assert.deepEqual(manifest.vectorKeys, [])
  assert.deepEqual(harness.evidenceRecords, [])
  assert.deepEqual(harness.memoryRecords, [])
})

test("FR-082 extraction truncation is explicit, partial, and cannot reach vector publication", async () => {
  const oversized = "x".repeat(config.maxUploadChars + 17)
  const extracted = await extractDocumentFromUpload({ fileName: "oversized.txt", text: oversized })

  assert.equal(extracted.extractionStatus, "partial")
  assert.equal(extracted.inputCharCount, oversized.length)
  assert.equal(extracted.outputCharCount, config.maxUploadChars)
  assert.equal(extracted.text.length, config.maxUploadChars)
  assert.ok(extracted.warnings?.some((warning) => warning.code === "extraction_content_truncated" && warning.severity === "error"))

  const harness = createPipelineHarness()
  const manifest = await runIngestPipeline(harness.deps, {
    fileName: "oversized.txt",
    text: oversized,
    admissionContext: fullAdmissionContext(),
    skipMemory: true
  }, async () => [])
  assert.equal(manifest.processingStatus, "partial")
  assert.equal(manifest.parsedDocument?.extractionStatus, "partial")
  assert.equal(manifest.publicationEligible, false)
  assert.deepEqual(manifest.vectorKeys, [])
  assert.equal(harness.evidenceRecords.length, 0)
})

test("FR-082 a mixed native/empty PDF extraction result is quarantined before vector publication", async () => {
  const harness = createPipelineHarness()
  const manifest = await runIngestPipeline(harness.deps, {
    fileName: "mixed-native-empty.pdf",
    contentBytes: buildNativeTextPdf([
      ["1. Policy", "Native text remains available."],
      []
    ]),
    mimeType: "application/pdf",
    ...{
      // Test-only extractor seam consumed by extractDocumentFromUpload through
      // the pipeline's internal upload shape; it is not part of IngestInput.
      pdfTextExtractor: async () => "1. Policy\nNative text remains available.\f\f"
    },
    admissionContext: fullAdmissionContext(),
    skipMemory: true
  }, async () => [])

  assert.equal(manifest.processingStatus, "partial")
  assert.equal(manifest.parsedDocument?.extractionStatus, "partial")
  assert.ok(manifest.parsedDocument?.warnings?.some((warning) => warning.code === "pdf_native_page_text_missing" && warning.page === 2))
  assert.equal(manifest.publicationEligible, false)
  assert.ok(manifest.admission?.reasons.includes("partial_extraction_not_publishable"))
  assert.deepEqual(manifest.vectorKeys, [])
  assert.deepEqual(harness.evidenceRecords, [])
})

test("FR-082 unsupported spreadsheet bytes are quarantined before vector publication", async () => {
  const harness = createPipelineHarness()
  const manifest = await runIngestPipeline(harness.deps, {
    fileName: "budget.xlsx",
    contentBytes: Buffer.from("spreadsheet payload"),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    admissionContext: fullAdmissionContext(),
    skipMemory: true
  }, async () => [])

  assert.equal(manifest.processingStatus, "partial")
  assert.equal(manifest.parsedDocument?.extractionStatus, "partial")
  assert.ok(manifest.parsedDocument?.warnings?.some((warning) => (
    warning.code === "unsupported_document_format" && warning.severity === "error"
  )))
  assert.equal(manifest.publicationEligible, false)
  assert.ok(manifest.admission?.reasons.includes("partial_extraction_not_publishable"))
  assert.deepEqual(manifest.vectorKeys, [])
  assert.deepEqual(harness.evidenceRecords, [])
})

test("FR-082 two-page OCR output missing page two is quarantined before vector publication", async () => {
  const harness = createPipelineHarness()
  const manifest = await runIngestPipeline(harness.deps, {
    fileName: "two-page-scan.pdf",
    textractJson: JSON.stringify({
      JobStatus: "SUCCEEDED",
      DocumentMetadata: { Pages: 2 },
      Blocks: [{ Id: "line-1", BlockType: "LINE", Text: "Page one OCR text", Page: 1 }]
    }),
    admissionContext: fullAdmissionContext(),
    skipMemory: true
  }, async () => [])

  assert.equal(manifest.processingStatus, "partial")
  assert.equal(manifest.parsedDocument?.extractionStatus, "partial")
  assert.ok(manifest.parsedDocument?.warnings?.some((warning) => (
    warning.code === "textract_page_text_missing" && warning.page === 2 && warning.severity === "error"
  )))
  assert.deepEqual(manifest.parsedDocument?.pages?.map((page) => page.pageNumber), [1, 2])
  assert.equal(manifest.publicationEligible, false)
  assert.ok(manifest.admission?.reasons.includes("partial_extraction_not_publishable"))
  assert.deepEqual(manifest.vectorKeys, [])
  assert.deepEqual(harness.evidenceRecords, [])
})

test("FR-092 versioned structure-aware policy is deterministic and quarantines budget violations", () => {
  const policy = chunkPolicy({ maxChars: 24, maxTokens: 24, overlapChars: 4, minTokens: 1 })
  const input = {
    text: "First sentence. Second sentence. Third sentence.",
    documentVersion: "document-version-1",
    policy
  }
  const first = chunkDocumentWithPolicy(input)
  const second = chunkDocumentWithPolicy(input)

  assert.equal(first.publicationEligible, true)
  assert.deepEqual(
    first.chunks.map((chunk) => ({ id: chunk.id, hash: chunk.chunkHash, start: chunk.startChar, end: chunk.endChar })),
    second.chunks.map((chunk) => ({ id: chunk.id, hash: chunk.chunkHash, start: chunk.startChar, end: chunk.endChar }))
  )
  assert.ok(first.chunks.every((chunk) => chunk.text.length <= policy.maxChars && chunk.sourceLocation?.startChar === chunk.startChar))

  const atomic = chunkDocumentWithPolicy({
    text: "| header |\n| --- |\n| a very long table value |",
    blocks: [{ id: "table-1", sourceBlockId: "table-1", kind: "table", text: "| header |\n| --- |\n| a very long table value |" }],
    documentVersion: "document-version-2",
    policy: chunkPolicy({ maxChars: 12, maxTokens: 12, overlapChars: 0, minTokens: 1 })
  })
  assert.equal(atomic.publicationEligible, false)
  assert.ok(atomic.violations.some((violation) => violation.code === "oversized_atomic_block"))
  assert.ok(atomic.violations.some((violation) => violation.code === "char_budget_exceeded"))

  const tiny = chunkDocumentWithPolicy({
    text: "tiny",
    documentVersion: "document-version-3",
    policy: chunkPolicy({ maxChars: 20, maxTokens: 20, overlapChars: 0, minTokens: 8 })
  })
  assert.equal(tiny.publicationEligible, false)
  assert.ok(tiny.violations.some((violation) => violation.code === "fragment_below_minimum"))
})

function fullAdmissionContext(): AuthoritativeAdmissionContext {
  return {
    mode: "authoritative",
    tenantId: "tenant-server",
    ownerUserId: "owner-server",
    authorizationRef: reference("authorization"),
    classificationRef: reference("classification"),
    usagePolicyRef: reference("usage-policy"),
    qualityRef: reference("quality"),
    lifecycleRef: reference("lifecycle"),
    provenanceRef: reference("provenance"),
    inspectionStatus: "passed",
    qualityProfile: approvedQualityProfile(),
    lifecycleStatus: "active",
    scope: { scopeType: "personal", allowedUsers: ["owner-server"] }
  }
}

function approvedQualityProfile(): DocumentQualityProfile {
  return {
    knowledgeQualityStatus: "approved",
    verificationStatus: "verified",
    freshnessStatus: "current",
    supersessionStatus: "current",
    extractionQualityStatus: "high",
    ragEligibility: "eligible",
    flags: []
  }
}

function reference(kind: string) {
  return createVersionedReference(`server:${kind}`, "v1", `${kind}:approved`)
}

function chunkPolicy(overrides: Partial<ChunkingPolicySnapshot>): ChunkingPolicySnapshot {
  return {
    schemaVersion: 1,
    policyId: "test-policy",
    version: "v1",
    strategy: "structure_aware",
    tokenizer: "unicode_code_point_v1",
    maxChars: 120,
    maxTokens: 120,
    overlapChars: 10,
    minTokens: 1,
    preserveAtomicBlocks: true,
    stableIdAlgorithm: "sha256_locator_content_v1",
    ...overrides
  }
}

function createPipelineHarness(): {
  deps: Dependencies
  objects: Map<string, string>
  evidenceRecords: VectorRecord[]
  memoryRecords: VectorRecord[]
} {
  const objects = new Map<string, string>()
  const evidenceRecords: VectorRecord[] = []
  const memoryRecords: VectorRecord[] = []
  const vectorStore = (sink: VectorRecord[]) => ({
    put: async (records: VectorRecord[]) => { sink.push(...records) },
    query: async () => [],
    delete: async (keys: string[]) => {
      const denied = new Set(keys)
      const retained = sink.filter((record) => !denied.has(record.key))
      sink.splice(0, sink.length, ...retained)
    }
  })
  const objectStore = {
    putText: async (key: string, text: string) => { objects.set(key, text) },
    putTextIfVersion: async (key: string, text: string) => { objects.set(key, text) },
    putBytes: async (key: string, bytes: Uint8Array) => { objects.set(key, Buffer.from(bytes).toString("base64")) },
    getText: async (key: string) => {
      const value = objects.get(key)
      if (value === undefined) throw new Error(`not found: ${key}`)
      return value
    },
    getTextWithVersion: async (key: string) => ({ text: objects.get(key) ?? "", version: "v1" }),
    getBytes: async (key: string) => Buffer.from(objects.get(key) ?? "", "base64"),
    getObjectSize: async (key: string) => objects.get(key)?.length ?? 0,
    deleteObject: async (key: string) => { objects.delete(key) },
    listKeys: async (prefix: string) => [...objects.keys()].filter((key) => key.startsWith(prefix))
  }
  const deps = {
    objectStore,
    evidenceVectorStore: vectorStore(evidenceRecords),
    memoryVectorStore: vectorStore(memoryRecords),
    textModel: {
      embed: async (text: string) => [text.length, 1],
      generate: async () => "{}"
    }
  } as unknown as Dependencies
  return { deps, objects, evidenceRecords, memoryRecords }
}
