import { randomUUID } from "node:crypto"
import { config } from "../../../../config.js"
import { ragRuntimePolicy } from "../../../../chat-orchestration/runtime-policy.js"
import type { Dependencies } from "../../../../dependencies.js"
import type { Chunk, DocumentLifecycleStatus, DocumentManifest, JsonValue, MemoryCard, SourceAdmissionRecord, StagedPublicationFence, StructuredBlock, VectorRecord } from "../../../../types.js"
import { documentQualityProfileFromMetadata } from "../../../_shared/policies/quality-policy.js"
import { createDerivedRecordSecurityEnvelope, isCompleteApprovedAdmission, reconcileDerivedArtifacts, stableHash } from "../../../_shared/security/derived-record-security.js"
import type { IngestAdmissionContext } from "../admission/source-admission.js"
import { resolveSourceAdmission } from "../admission/source-admission.js"
import { buildPipelineVersions } from "../indexing/index-version-store.js"
import { chunkDocumentWithPolicy, productionChunkingPolicy, summarizeDocumentStatistics } from "../chunking/chunker.service.js"
import { embedWithCache, mapWithConcurrency } from "../embedding/embedding-cache.js"
import { extractDocumentFromUpload, limitDocument, type ExtractedDocument } from "../extraction/text-extractor.js"
import { ProductionRagObservationProducer, bestEffortCapture } from "../../../quality-control/production-rag-observation-producer.js"
import { assertRagSafetyInterlock } from "../../../quality-control/production-rag-monitor.js"
import { tenantDocumentArtifactKey, tenantVectorKey } from "../../../_shared/storage/tenant-artifacts.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../../../_shared/security/revocation-cleanup-coordinator.js"
import { buildReplayVersionManifest } from "../../../_shared/replay/replay-version-manifest.js"
import { CURRENT_RAG_ELIGIBILITY_POLICY_VERSION } from "../../../_shared/security/current-rag-eligibility.js"
import { UNTRUSTED_CONTENT_POLICY_VERSION } from "../../../_shared/security/untrusted-content-policy.js"
import { RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION } from "../../../../security/resource-operation-authorization.js"
import { DEBUG_TRACE_SANITIZE_POLICY_VERSION } from "../../../../types.js"

export type IngestInput = {
  fileName: string
  text?: string
  contentBase64?: string
  contentBytes?: Buffer
  textractJson?: string
  mimeType?: string
  sourceS3Object?: {
    bucketName: string
    key: string
  }
  metadata?: Record<string, JsonValue>
  embeddingModelId?: string
  memoryModelId?: string
  skipMemory?: boolean
  structuredBlocks?: StructuredBlock[]
  sourceExtractorVersion?: string
  /** Server-internal admission decision input. This field is not accepted by public request schemas. */
  admissionContext?: IngestAdmissionContext
  /** Internal staged-publication fence. Public request schemas never accept this field. */
  publicationFence?: StagedPublicationFence
  /**
   * Server-only current authorization checks. Production callers must provide
   * the complete pair; public request schemas never accept this field.
   */
  currentAuthorization?: {
    authorizeExternalSideEffect: () => Promise<void>
    authorizeDurableCommit: () => Promise<void>
  }
  /** Internal deterministic identity seam used by replay/migration tests; public schemas omit it. */
  artifactIdOverride?: string
}

export type CreateMemoryCards = (input: {
  fileName: string
  text: string
  chunks: Chunk[]
  documentStatistics?: DocumentManifest["documentStatistics"]
  modelId?: string
}) => Promise<MemoryCard[]>

export async function runIngestPipeline(deps: Dependencies, input: IngestInput, createMemoryCards: CreateMemoryCards): Promise<DocumentManifest> {
  const pipelineStartedMs = Date.now()
  assertPublicationFence(input.publicationFence)
  const safety = await assertRagSafetyInterlock({
    objectStore: deps.objectStore,
    runtimeProfileVersion: ragRuntimePolicy.profile.version,
    operation: "ingest"
  })
  if ((config.authEnabled || config.nodeEnv === "production") && !input.currentAuthorization) {
    throw new Error("Current ingest authorization callbacks are required")
  }
  const documentId = input.publicationFence?.artifactId ?? canonicalArtifactId(input.artifactIdOverride) ?? randomUUID()
  const createdAt = new Date().toISOString()
  const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
  const resolvedAdmission = resolveSourceAdmission({
    context: input.admissionContext ?? deps.localTestIngestAdmissionContext,
    metadata: input.metadata,
    runtimeEnvironment: config.nodeEnv,
    admittedAt: createdAt
  })
  let admission = safety?.documentQuarantineRequired
    ? quarantineAdmission(resolvedAdmission.record, "rag_monitor_document_quarantine")
    : resolvedAdmission.record
  const metadata = { ...resolvedAdmission.metadata }
  const tenantId = admission.tenantId?.trim()
  if (!tenantId) throw new Error("Authoritative tenant is required before document artifact persistence")
  logIngestStage({ stage: "extract", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length })
  const extracted: ExtractedDocument = input.structuredBlocks?.length
      ? (() => {
        const structuredText = input.text ?? input.structuredBlocks.map((block) => block.text).join("\n\n")
        return limitDocument({
          text: structuredText,
          blocks: input.structuredBlocks,
          sourceExtractorVersion: input.sourceExtractorVersion ?? "structured-blocks-ledger-v1"
        })
      })()
    : await extractDocumentFromUpload({ ...input, enforceObservedFallbackGuards: true })
  logIngestStage({
    stage: "extract",
    phase: "end",
    documentId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.contentBytes?.length,
    textLength: extracted.text.length,
    blockCount: extracted.blocks?.length,
    sourceExtractorVersion: extracted.sourceExtractorVersion
  })
  const pipelineVersions = buildPipelineVersions({
    embeddingModelId,
    embeddingDimensions: config.embeddingDimensions,
    sourceExtractorVersion: extracted.sourceExtractorVersion
  })
  const text = extracted.text
  if (!text) throw new Error("Uploaded document did not contain extractable text")
  const documentVersion = stableHash({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sourceExtractorVersion: extracted.sourceExtractorVersion,
    sourceContentHash: extracted.contentHash ?? stableHash(text)
  })

  logIngestStage({ stage: "chunk", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, textLength: text.length })
  const chunking = chunkDocumentWithPolicy({
    text,
    blocks: extracted.blocks,
    documentVersion,
    policy: productionChunkingPolicy(config.chunkSizeChars, config.chunkOverlapChars)
  })
  const chunks = chunking.chunks
  if (chunks.length === 0) throw new Error("No chunks were produced from the uploaded document")
  logIngestStage({ stage: "chunk", phase: "end", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, textLength: text.length, chunkCount: chunks.length })

  if (extracted.extractionStatus === "partial") admission = quarantineAdmission(admission, "partial_extraction_not_publishable")
  if (!chunking.publicationEligible) admission = quarantineAdmission(admission, "chunk_policy_violation")
  let lifecycle: DocumentLifecycleStatus = admission.status === "approved" ? admittedLifecycle(metadata) : "staging"
  let processingStatus: NonNullable<DocumentManifest["processingStatus"]> = admission.status === "rejected"
    ? "rejected"
    : extracted.extractionStatus === "partial"
      ? "partial"
      : admission.status === "approved" ? "complete" : "quarantined"
  metadata.lifecycleStatus = lifecycle
  const completeAdmission = isCompleteApprovedAdmission(admission) ? admission : undefined
  const publicationCandidate = Boolean(completeAdmission && extracted.extractionStatus !== "partial" && chunking.publicationEligible)
  const documentSecurityEnvelope = completeAdmission
    ? createDerivedRecordSecurityEnvelope({
        documentId,
        documentVersion,
        admission: completeAdmission,
        sourceLocator: { source: input.fileName, startChar: 0, endChar: text.length }
      })
    : undefined
  const securedChunks = completeAdmission
    ? chunks.map((chunk) => ({
        ...chunk,
        securityEnvelope: createDerivedRecordSecurityEnvelope({
          documentId,
          documentVersion,
          admission: completeAdmission,
          sourceLocator: chunk.sourceLocation ?? {
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            sectionPath: chunk.sectionPath,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
            sourceBlockId: chunk.sourceBlockId
          }
        })
      }))
    : chunks

  const legacyDocumentObjectPrefix = input.publicationFence
    ? `${input.publicationFence.stageNamespace}/documents/${documentId}`
    : `documents/${documentId}`
  const documentObjectPrefix = tenantDocumentArtifactKey(deps, tenantId, legacyDocumentObjectPrefix)
  const sourceObjectKey = `${documentObjectPrefix}/source.txt`
  const structuredBlocksObjectKey = extracted.blocks?.length ? `${documentObjectPrefix}/structured-blocks.json` : undefined
  const legacyManifestObjectKey = input.publicationFence
    ? `${input.publicationFence.stageNamespace}/manifests/${documentId}.json`
    : `manifests/${documentId}.json`
  const manifestObjectKey = tenantDocumentArtifactKey(deps, tenantId, legacyManifestObjectKey)
  const structuredBlocksLedger = extracted.blocks?.length
    ? JSON.stringify({ schemaVersion: 2, blocks: extracted.blocks, parsedDocument: extracted.parsedDocument }, null, 2)
    : undefined

  const documentStatistics = summarizeDocumentStatistics(securedChunks)
  if (!input.skipMemory && publicationCandidate) await input.currentAuthorization?.authorizeExternalSideEffect()
  const generatedMemoryCards = input.skipMemory || !publicationCandidate
    ? []
    : await createMemoryCards({
        fileName: input.fileName,
        text,
        chunks: securedChunks,
        documentStatistics,
        modelId: input.memoryModelId
      })
  const memoryCards = completeAdmission
    ? generatedMemoryCards.map((card) => ({
        ...card,
        sourceChunkIds: card.sourceChunkIds?.length ? [...card.sourceChunkIds] : securedChunks.map((chunk) => chunk.id),
        securityEnvelope: createDerivedRecordSecurityEnvelope({
          documentId,
          documentVersion,
          admission: completeAdmission,
          sourceLocator: {
            pageStart: card.pageStart,
            pageEnd: card.pageEnd,
            sectionPath: card.sectionPath,
            sourceChunkIds: card.sourceChunkIds?.length ? [...card.sourceChunkIds] : securedChunks.map((chunk) => chunk.id)
          }
        })
      }))
    : generatedMemoryCards
  const memoryCardsObjectKey = input.skipMemory || !publicationCandidate ? undefined : `${documentObjectPrefix}/memory-cards.json`
  const memoryCardsLedger = memoryCardsObjectKey
    ? JSON.stringify({ schemaVersion: 1, memoryCards }, null, 2)
    : undefined

  const filterableMetadata = toFilterableVectorMetadata(metadata)
  const qualityProfile = documentQualityProfileFromMetadata(metadata)

  logIngestStage({ stage: "embedding", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: securedChunks.length })
  if (publicationCandidate) await input.currentAuthorization?.authorizeExternalSideEffect()
  const evidenceRecords = publicationCandidate ? await mapWithConcurrency(securedChunks, config.embeddingConcurrency, async (chunk) => {
    const vector = await embedWithCache(deps, {
      text: chunk.text,
      modelId: embeddingModelId,
      dimensions: config.embeddingDimensions,
      partitionKey: completeAdmission!.tenantId
    })
    const legacyKey = input.publicationFence
      ? `${documentId}-g${input.publicationFence.generation}-${chunk.id}`
      : `${documentId}-${chunk.id}`
    const key = tenantVectorKey(deps, tenantId, legacyKey)
    return {
      key,
      vector,
      metadata: {
        kind: "chunk",
        documentId,
        documentVersion,
        fileName: input.fileName,
        chunkId: chunk.id,
        objectKey: sourceObjectKey,
        text: chunk.text,
        sectionPath: chunk.sectionPath,
        heading: chunk.heading,
        parentSectionId: chunk.parentSectionId,
        previousChunkId: chunk.previousChunkId,
        nextChunkId: chunk.nextChunkId,
        chunkHash: chunk.chunkHash,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        chunkKind: chunk.chunkKind,
        sourceBlockId: chunk.sourceBlockId,
        normalizedFrom: chunk.normalizedFrom,
        tableColumnCount: chunk.tableColumnCount,
        tableId: chunk.tableId,
        tableRowCount: chunk.tableRowCount,
        tableConfidence: chunk.tableConfidence,
        listDepth: chunk.listDepth,
        codeLanguage: chunk.codeLanguage,
        figureCaption: chunk.figureCaption,
        figureId: chunk.figureId,
        confidence: chunk.confidence,
        readingOrder: chunk.readingOrder,
        bbox: chunk.bbox,
        sourceLocation: chunk.sourceLocation,
        securityEnvelope: chunk.securityEnvelope,
        publicationFence: input.publicationFence,
        extractionMethod: chunk.extractionMethod,
        lifecycleStatus: lifecycle,
        ...filterableMetadata,
        createdAt
      }
    } satisfies VectorRecord
  }) : []

  const memoryRecords = publicationCandidate ? await mapWithConcurrency(memoryCards, config.embeddingConcurrency, async (card) => {
    const vector = await embedWithCache(deps, {
      text: card.text,
      modelId: embeddingModelId,
      dimensions: config.embeddingDimensions,
      partitionKey: completeAdmission!.tenantId
    })
    const legacyKey = input.publicationFence
      ? `${documentId}-g${input.publicationFence.generation}-${card.id}`
      : `${documentId}-${card.id}`
    const key = tenantVectorKey(deps, tenantId, legacyKey)
    return {
      key,
      vector,
      metadata: {
        kind: "memory",
        documentId,
        documentVersion,
        fileName: input.fileName,
        memoryId: card.id,
        objectKey: sourceObjectKey,
        text: card.text,
        sectionPath: card.sectionPath,
        pageStart: card.pageStart,
        pageEnd: card.pageEnd,
        sourceChunkIds: card.sourceChunkIds,
        sourceLocation: card.securityEnvelope?.sourceLocator,
        securityEnvelope: card.securityEnvelope,
        publicationFence: input.publicationFence,
        lifecycleStatus: lifecycle,
        ...filterableMetadata,
        createdAt
      }
    } satisfies VectorRecord
  }) : []
  logIngestStage({ stage: "embedding", phase: "end", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: chunks.length, memoryCardCount: memoryCards.length })

  const manifestProjection = {
    documentId,
    documentVersion,
    admission,
    documentSecurityEnvelopeHash: documentSecurityEnvelope?.envelopeHash,
    publicationFence: input.publicationFence,
    chunkingPolicy: chunking.policy,
    chunkIds: securedChunks.map((chunk) => chunk.id),
    memoryCardIds: memoryCards.map((card) => card.id),
    sourceObjectKey,
    structuredBlocksObjectKey,
    memoryCardsObjectKey
  }
  const derivedIntegrity = completeAdmission
    ? {
      ...reconcileDerivedArtifacts({
          documentId,
          documentVersion,
          admission: completeAdmission,
          expectedChunkIds: securedChunks.map((chunk) => chunk.id),
          expectedMemoryCardIds: memoryCards.map((card) => card.id),
          evidenceRecords,
          memoryRecords,
          manifestProjection
        }),
        objectHashes: {
          source: stableHash(text),
          structuredBlocks: structuredBlocksLedger ? stableHash(structuredBlocksLedger) : undefined,
          memoryCards: memoryCardsLedger ? stableHash(memoryCardsLedger) : undefined
        }
      }
    : {
        schemaVersion: 1 as const,
        expectedChunkCount: securedChunks.length,
        expectedMemoryCardCount: memoryCards.length,
        evidenceRecordCount: evidenceRecords.length,
        memoryRecordCount: memoryRecords.length,
        manifestHash: stableHash(manifestProjection),
        recordSetHash: stableHash([]),
        objectHashes: {
          source: stableHash(text),
          structuredBlocks: structuredBlocksLedger ? stableHash(structuredBlocksLedger) : undefined,
          memoryCards: memoryCardsLedger ? stableHash(memoryCardsLedger) : undefined
        },
        verified: false,
        reasons: ["complete_approved_admission_missing"]
      }

  let publicationEligible = publicationCandidate && derivedIntegrity.verified
  if (publicationCandidate && !derivedIntegrity.verified) {
    admission = quarantineAdmission(admission, "derived_artifact_reconciliation_failed")
    lifecycle = "staging"
    processingStatus = "quarantined"
    metadata.lifecycleStatus = lifecycle
    publicationEligible = false
  }

  const evidenceVectorKeys = publicationEligible ? evidenceRecords.map((record) => record.key) : []
  const memoryVectorKeys = publicationEligible ? memoryRecords.map((record) => record.key) : []
  const manifest: DocumentManifest = {
    documentId,
    documentVersion,
    traceId: `ingest:${documentId}:${documentVersion}`,
    replayVersionManifest: buildReplayVersionManifest({
      citations: [{ documentId, documentVersion, fileName: input.fileName, score: 1, text: "" }],
      sourceSnapshots: [{
        documentId,
        documentVersion,
        ingestTraceId: `ingest:${documentId}:${documentVersion}`,
        parserVersion: extracted.sourceExtractorVersion,
        ocrVersion: /(?:^|[-_.])(ocr|textract)(?:$|[-_.])/iu.test(extracted.sourceExtractorVersion)
          ? extracted.sourceExtractorVersion
          : null,
        chunkerVersion: pipelineVersions.chunkerVersion,
        chunkingPolicyVersion: chunking.policy.version,
        embeddingModelId,
        embeddingDimensions: config.embeddingDimensions,
        indexVersion: pipelineVersions.indexVersion,
        promptVersion: pipelineVersions.promptVersion,
        pipelineVersion: pipelineVersions.chatOrchestrationWorkflowVersion
      }],
      ragProfile: {
        id: ragRuntimePolicy.profile.id,
        version: ragRuntimePolicy.profile.version,
        retrievalProfileId: ragRuntimePolicy.profile.retrieval.id,
        retrievalProfileVersion: ragRuntimePolicy.profile.retrieval.version,
        answerPolicyId: ragRuntimePolicy.profile.answerPolicy.id,
        answerPolicyVersion: ragRuntimePolicy.profile.answerPolicy.version
      },
      policyVersions: {
        authorization: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
        eligibility: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
        untrustedContent: UNTRUSTED_CONTENT_POLICY_VERSION,
        traceSanitization: DEBUG_TRACE_SANITIZE_POLICY_VERSION
      },
      question: input.fileName,
      candidateCount: securedChunks.length,
      deniedCandidateCount: publicationEligible ? 0 : securedChunks.length,
      finalEvidenceCount: publicationEligible ? securedChunks.length : 0,
      responseStatus: publicationEligible ? "success" : "warning",
      decisionCode: publicationEligible ? "completed" : admission.status === "rejected" ? "rejected" : "refused",
      reasonCodes: publicationEligible
        ? []
        : admission.status === "rejected" ? ["admission_rejected"] : ["publication_not_eligible"],
      totalLatencyMs: Math.max(0, Date.now() - pipelineStartedMs),
      nondeterministicFactors: [
        "parser-and-ocr-service-revision",
        "embedding-provider-service-revision",
        "dependency-latency-and-retry-schedule"
      ]
    }),
    fileName: input.fileName,
    mimeType: input.mimeType,
    metadata,
    qualityProfile,
    admission,
    derivedIntegrity,
    securityEnvelope: documentSecurityEnvelope,
    chunkingPolicy: chunking.policy,
    chunkingViolations: chunking.violations,
    publicationEligible,
    processingStatus,
    publicationFence: input.publicationFence,
    sourceObjectKey,
    structuredBlocksObjectKey,
    memoryCardsObjectKey,
    manifestObjectKey,
    vectorKeys: [...evidenceVectorKeys, ...memoryVectorKeys],
    memoryVectorKeys,
    evidenceVectorKeys,
    embeddingModelId,
    embeddingDimensions: config.embeddingDimensions,
    chunkerVersion: pipelineVersions.chunkerVersion,
    sourceExtractorVersion: pipelineVersions.sourceExtractorVersion,
    memoryPromptVersion: pipelineVersions.memoryPromptVersion,
    indexVersion: pipelineVersions.indexVersion,
    pipelineVersions,
    documentStatistics,
    chunks: securedChunks.map(toChunkMetadata),
    lifecycleStatus: lifecycle,
    activeDocumentId: stringValue(metadata.activeDocumentId),
    stagedFromDocumentId: stringValue(metadata.stagedFromDocumentId),
    reindexMigrationId: stringValue(metadata.reindexMigrationId),
    chunkCount: securedChunks.length,
    memoryCardCount: memoryCards.length,
    parsedDocument: extracted.parsedDocument,
    extractionWarnings: extracted.warnings,
    extractionCounters: extracted.counters,
    fileProfile: extracted.fileProfile,
    createdAt
  }

  const committedObjectKeys: string[] = []
  try {
    await input.currentAuthorization?.authorizeDurableCommit()
    await deps.objectStore.putText(sourceObjectKey, text, "text/plain; charset=utf-8")
    committedObjectKeys.push(sourceObjectKey)
    if (structuredBlocksObjectKey && structuredBlocksLedger) {
      await deps.objectStore.putText(structuredBlocksObjectKey, structuredBlocksLedger, "application/json")
      committedObjectKeys.push(structuredBlocksObjectKey)
    }
    if (memoryCardsObjectKey && memoryCardsLedger) {
      await deps.objectStore.putText(memoryCardsObjectKey, memoryCardsLedger, "application/json")
      committedObjectKeys.push(memoryCardsObjectKey)
    }
    if (publicationEligible) {
      logIngestStage({ stage: "vector_put", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: evidenceRecords.length, memoryCardCount: memoryRecords.length })
      await deps.evidenceVectorStore.put(evidenceRecords)
      await deps.memoryVectorStore.put(memoryRecords)
      logIngestStage({ stage: "vector_put", phase: "end", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: evidenceRecords.length, memoryCardCount: memoryRecords.length })
    }
    await deps.objectStore.putText(manifestObjectKey, JSON.stringify(manifest, null, 2), "application/json")
    committedObjectKeys.push(manifestObjectKey)
    // Detect a revoke that raced any write in the commit bundle before the
    // caller can publish a successful worker result.
    await input.currentAuthorization?.authorizeDurableCommit()
  } catch (error) {
    await cleanupArtifactsOrRegisterReconciliation(deps, manifest, [
      deps.evidenceVectorStore.delete(evidenceRecords.map((record) => record.key)),
      deps.memoryVectorStore.delete(memoryRecords.map((record) => record.key)),
      ...committedObjectKeys.map((key) => deps.objectStore.deleteObject(key))
    ])
    throw error
  }
  await bestEffortCapture("ingest_manifest", () => new ProductionRagObservationProducer(deps.objectStore).captureIngestManifest({
    manifest,
    latencyMs: Math.max(0, Date.now() - pipelineStartedMs)
  }))
  return manifest
}

export async function deleteUncommittedIngestArtifacts(deps: Dependencies, manifest: DocumentManifest): Promise<void> {
  await cleanupArtifactsOrRegisterReconciliation(deps, manifest, [
    deps.evidenceVectorStore.delete(manifest.evidenceVectorKeys ?? []),
    deps.memoryVectorStore.delete(manifest.memoryVectorKeys ?? []),
    deps.objectStore.deleteObject(manifest.manifestObjectKey),
    deps.objectStore.deleteObject(manifest.sourceObjectKey),
    ...(manifest.structuredBlocksObjectKey ? [deps.objectStore.deleteObject(manifest.structuredBlocksObjectKey)] : []),
    ...(manifest.memoryCardsObjectKey ? [deps.objectStore.deleteObject(manifest.memoryCardsObjectKey)] : [])
  ])
}

async function cleanupArtifactsOrRegisterReconciliation(
  deps: Dependencies,
  manifest: DocumentManifest,
  cleanupOperations: readonly Promise<unknown>[]
): Promise<void> {
  const results = await Promise.allSettled(cleanupOperations)
  if (results.every((result) => result.status === "fulfilled")) return
  await registerUncommittedIngestCleanupReconciliation(deps, manifest)
}

export async function registerUncommittedIngestCleanupReconciliation(
  deps: Dependencies,
  manifest: DocumentManifest
): Promise<void> {
  const tenantId = manifest.admission?.tenantId ?? stringValue(manifest.metadata?.tenantId)
  if (!tenantId) throw new Error("Failed ingest cleanup has no authoritative tenant for reconciliation")
  const knownTargets = [
    { scope: "source" as const, reference: manifest.sourceObjectKey },
    { scope: "source" as const, reference: manifest.manifestObjectKey },
    ...(manifest.structuredBlocksObjectKey ? [{ scope: "chunk" as const, reference: manifest.structuredBlocksObjectKey }] : []),
    ...(manifest.chunks ?? []).map((chunk) => ({ scope: "chunk" as const, reference: `${manifest.documentId}:${chunk.id}` })),
    ...(manifest.memoryCardsObjectKey ? [{ scope: "memory" as const, reference: manifest.memoryCardsObjectKey }] : []),
    ...(manifest.memoryVectorKeys ?? []).map((reference) => ({ scope: "memory" as const, reference })),
    ...[...manifest.vectorKeys, ...(manifest.evidenceVectorKeys ?? [])].map((reference) => ({ scope: "active_index" as const, reference })),
    { scope: "cache" as const, reference: `document:${manifest.documentId}` },
    { scope: "grant" as const, reference: `source-governance:${manifest.publicationControl?.sourceId ?? manifest.documentId}` }
  ]
  await new ObjectStoreRevocationCleanupCoordinator(deps.objectStore).register({
    operationId: `ingest-compensation:${manifest.documentId}:${manifest.documentVersion ?? manifest.createdAt}`,
    tenantId,
    resourceType: manifest.metadata?.scopeType === "chat" ? "temporary_attachment" : "document",
    resourceId: manifest.documentId,
    trigger: "deleted",
    deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
    authoritativeDenyVersion: `uncommitted:${manifest.documentVersion ?? manifest.createdAt}`,
    authoritativeDenyConfirmedAt: manifest.updatedAt ?? manifest.createdAt,
    knownTargets
  })
}

export async function putDocumentVectorRecords(deps: Dependencies, input: { evidenceRecords: VectorRecord[]; memoryRecords: VectorRecord[] }): Promise<void> {
  await deps.evidenceVectorStore.put(input.evidenceRecords)
  await deps.memoryVectorStore.put(input.memoryRecords)
}

function toChunkMetadata(chunk: Chunk): NonNullable<DocumentManifest["chunks"]>[number] {
  const { text: _text, ...metadata } = chunk
  return metadata
}

function toFilterableVectorMetadata(metadata: Record<string, JsonValue> | undefined): Partial<VectorRecord["metadata"]> {
  if (!metadata) return {}
  const aclGroups = stringArray(metadata.aclGroups ?? metadata.allowedGroups) ?? []
  const allowedUsers = stringArray(metadata.allowedUsers ?? metadata.userIds)
  const groupIds = stringArray(metadata.groupIds ?? metadata.groupId) ?? []
  const filterable: Partial<VectorRecord["metadata"]> = {}
  const tenantId = stringValue(metadata.tenantId)
  const department = stringValue(metadata.department)
  const source = stringValue(metadata.source)
  const docType = stringValue(metadata.docType)
  const benchmarkSuiteId = stringValue(metadata.benchmarkSuiteId)
  const scopeType = stringValue(metadata.scopeType)
  const ownerUserId = stringValue(metadata.ownerUserId)
  const temporaryScopeId = stringValue(metadata.temporaryScopeId)
  const expiresAt = stringValue(metadata.expiresAt)
  const domainPolicy = stringValue(metadata.domainPolicy)
  const ragPolicy = stringValue(metadata.ragPolicy)
  const answerPolicy = stringValue(metadata.answerPolicy)
  const ragEligibility = ragEligibilityValue(metadata.ragEligibility ?? objectValue(metadata.qualityProfile)?.ragEligibility)
  const drawingSourceType = drawingSourceTypeValue(metadata.drawingSourceType)
  const pageOrSheet = stringValue(metadata.pageOrSheet)
  const drawingNo = stringValue(metadata.drawingNo)
  const sheetTitle = stringValue(metadata.sheetTitle)
  const scale = stringValue(metadata.scale)
  const regionId = stringValue(metadata.regionId)
  const regionType = stringValue(metadata.regionType)
  const sourceType = stringValue(metadata.sourceType)
  const bbox = metadata.bbox
  const aclGroup = stringValue(metadata.aclGroup) ?? aclGroups[0]
  if (tenantId) filterable.tenantId = tenantId
  if (department) filterable.department = department
  if (source) filterable.source = source
  if (docType) filterable.docType = docType
  if (benchmarkSuiteId) filterable.benchmarkSuiteId = benchmarkSuiteId
  if (scopeType === "personal" || scopeType === "group" || scopeType === "chat" || scopeType === "benchmark") filterable.scopeType = scopeType
  if (groupIds[0]) filterable.groupId = groupIds[0]
  if (groupIds.length > 0) filterable.groupIds = groupIds
  if (ownerUserId) filterable.ownerUserId = ownerUserId
  if (temporaryScopeId) filterable.temporaryScopeId = temporaryScopeId
  if (expiresAt) filterable.expiresAt = expiresAt
  if (domainPolicy) filterable.domainPolicy = domainPolicy
  if (ragPolicy) filterable.ragPolicy = ragPolicy
  if (answerPolicy) filterable.answerPolicy = answerPolicy
  if (ragEligibility) filterable.ragEligibility = ragEligibility
  if (drawingSourceType) filterable.drawingSourceType = drawingSourceType
  if (pageOrSheet) filterable.pageOrSheet = pageOrSheet
  if (drawingNo) filterable.drawingNo = drawingNo
  if (sheetTitle) filterable.sheetTitle = sheetTitle
  if (scale) filterable.scale = scale
  if (regionId) filterable.regionId = regionId
  if (regionType) filterable.regionType = regionType
  if (sourceType) filterable.sourceType = sourceType
  if (bbox !== undefined) filterable.bbox = bbox
  if (aclGroup) filterable.aclGroup = aclGroup
  if (aclGroups.length > 0) filterable.aclGroups = aclGroups
  if (allowedUsers && allowedUsers.length > 0) filterable.allowedUsers = allowedUsers
  return filterable
}

function drawingSourceTypeValue(value: JsonValue | undefined): VectorRecord["metadata"]["drawingSourceType"] | undefined {
  if (value === "project_drawing" || value === "standard_detail" || value === "equipment_standard" || value === "benchmark_reference" || value === "external") return value
  return undefined
}

function ragEligibilityValue(value: JsonValue | undefined): VectorRecord["metadata"]["ragEligibility"] | undefined {
  if (value === "eligible" || value === "eligible_with_warning" || value === "excluded") return value
  return undefined
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined
}

function admittedLifecycle(metadata: Record<string, JsonValue> | undefined): DocumentLifecycleStatus {
  const value = stringValue(metadata?.lifecycleStatus)
  return value === "staging" || value === "superseded" ? value : "active"
}

function quarantineAdmission(admission: SourceAdmissionRecord, reason: string): SourceAdmissionRecord {
  if (admission.status === "rejected") {
    return { ...admission, reasons: [...new Set([...admission.reasons, reason])].sort() }
  }
  return {
    ...admission,
    status: "quarantined",
    reasons: [...new Set([...admission.reasons, reason])].sort()
  }
}

function assertPublicationFence(fence: StagedPublicationFence | undefined): void {
  if (!fence) return
  if (
    !fence.runId || !fence.artifactId || !fence.idempotencyKey || !fence.sourceId || !fence.fencingToken
    || !Number.isInteger(fence.generation) || fence.generation <= 0
    || !fence.stageNamespace.startsWith(`staging/publications/${fence.runId}/generation-${fence.generation}`)
    || fence.stageNamespace.includes("..")
  ) {
    throw new Error("Invalid staged publication fence")
  }
}

function canonicalArtifactId(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const normalized = value.trim()
  if (normalized !== value || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(normalized)) {
    throw new Error("Internal artifact identity is invalid")
  }
  return normalized
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function stringArray(value: JsonValue | undefined): string[] | undefined {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) {
    const values = value.filter((item): item is string => typeof item === "string")
    return values.length > 0 ? values : undefined
  }
  return undefined
}

function logIngestStage(input: {
  stage: "extract" | "chunk" | "embedding" | "vector_put"
  phase: "start" | "end"
  documentId?: string
  fileName?: string
  mimeType?: string
  fileSizeBytes?: number
  textLength?: number
  blockCount?: number
  chunkCount?: number
  memoryCardCount?: number
  sourceExtractorVersion?: string
}): void {
  console.info(JSON.stringify({
    event: "document_ingest_stage",
    stage: input.stage,
    phase: input.phase,
    documentId: input.documentId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    textLength: input.textLength,
    blockCount: input.blockCount,
    chunkCount: input.chunkCount,
    memoryCardCount: input.memoryCardCount,
    sourceExtractorVersion: input.sourceExtractorVersion,
    memory: memoryUsageSnapshot()
  }))
}

function memoryUsageSnapshot(): Record<string, number> {
  const usage = process.memoryUsage()
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers
  }
}
