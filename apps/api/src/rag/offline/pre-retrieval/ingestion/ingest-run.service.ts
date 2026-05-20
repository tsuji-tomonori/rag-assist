import { randomUUID } from "node:crypto"
import { config } from "../../../../config.js"
import type { Dependencies } from "../../../../dependencies.js"
import type { Chunk, DocumentManifest, JsonValue, MemoryCard, StructuredBlock, VectorRecord } from "../../../../types.js"
import { documentQualityProfileFromMetadata } from "../../../_shared/policies/quality-policy.js"
import { buildPipelineVersions } from "../indexing/index-version-store.js"
import { chunkStructuredBlocks, chunkText, summarizeDocumentStatistics } from "../chunking/chunker.service.js"
import { embedWithCache, mapWithConcurrency } from "../embedding/embedding-cache.js"
import { extractDocumentFromUpload } from "../extraction/text-extractor.js"

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
}

export type CreateMemoryCards = (input: {
  fileName: string
  text: string
  chunks: Chunk[]
  documentStatistics?: DocumentManifest["documentStatistics"]
  modelId?: string
}) => Promise<MemoryCard[]>

export async function runIngestPipeline(deps: Dependencies, input: IngestInput, createMemoryCards: CreateMemoryCards): Promise<DocumentManifest> {
  const documentId = randomUUID()
  const createdAt = new Date().toISOString()
  const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
  logIngestStage({ stage: "extract", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length })
  const extracted = input.structuredBlocks?.length
    ? {
        text: input.text ?? input.structuredBlocks.map((block) => block.text).join("\n\n"),
        blocks: input.structuredBlocks,
        sourceExtractorVersion: input.sourceExtractorVersion ?? "structured-blocks-ledger-v1"
      }
    : await extractDocumentFromUpload(input)
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

  logIngestStage({ stage: "chunk", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, textLength: text.length })
  const chunks = extracted.blocks?.length
    ? chunkStructuredBlocks(extracted.blocks, config.chunkSizeChars, config.chunkOverlapChars)
    : chunkText(text, config.chunkSizeChars, config.chunkOverlapChars)
  if (chunks.length === 0) throw new Error("No chunks were produced from the uploaded document")
  logIngestStage({ stage: "chunk", phase: "end", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, textLength: text.length, chunkCount: chunks.length })

  const sourceObjectKey = `documents/${documentId}/source.txt`
  const structuredBlocksObjectKey = extracted.blocks?.length ? `documents/${documentId}/structured-blocks.json` : undefined
  const memoryCardsObjectKey = input.skipMemory ? undefined : `documents/${documentId}/memory-cards.json`
  const manifestObjectKey = `manifests/${documentId}.json`
  await deps.objectStore.putText(sourceObjectKey, text, "text/plain; charset=utf-8")
  if (structuredBlocksObjectKey && extracted.blocks) {
    await deps.objectStore.putText(
      structuredBlocksObjectKey,
      JSON.stringify({ schemaVersion: 2, blocks: extracted.blocks, parsedDocument: extracted.parsedDocument }, null, 2),
      "application/json"
    )
  }

  const documentStatistics = summarizeDocumentStatistics(chunks)
  const memoryCards = input.skipMemory
    ? []
    : await createMemoryCards({
        fileName: input.fileName,
        text,
        chunks,
        documentStatistics,
        modelId: input.memoryModelId
      })
  if (memoryCardsObjectKey) {
    await deps.objectStore.putText(memoryCardsObjectKey, JSON.stringify({ schemaVersion: 1, memoryCards }, null, 2), "application/json")
  }

  const evidenceVectorKeys: string[] = []
  const memoryVectorKeys: string[] = []
  const filterableMetadata = toFilterableVectorMetadata(input.metadata)
  const qualityProfile = documentQualityProfileFromMetadata(input.metadata)

  logIngestStage({ stage: "embedding", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: chunks.length })
  const evidenceRecords = await mapWithConcurrency(chunks, config.embeddingConcurrency, async (chunk) => {
    const vector = await embedWithCache(deps, {
      text: chunk.text,
      modelId: embeddingModelId,
      dimensions: config.embeddingDimensions
    })
    const key = `${documentId}-${chunk.id}`
    evidenceVectorKeys.push(key)
    return {
      key,
      vector,
      metadata: {
        kind: "chunk",
        documentId,
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
        extractionMethod: chunk.extractionMethod,
        lifecycleStatus: lifecycleStatus(input.metadata),
        ...filterableMetadata,
        createdAt
      }
    } satisfies VectorRecord
  })

  const memoryRecords = await mapWithConcurrency(memoryCards, config.embeddingConcurrency, async (card) => {
    const vector = await embedWithCache(deps, {
      text: card.text,
      modelId: embeddingModelId,
      dimensions: config.embeddingDimensions
    })
    const key = `${documentId}-${card.id}`
    memoryVectorKeys.push(key)
    return {
      key,
      vector,
      metadata: {
        kind: "memory",
        documentId,
        fileName: input.fileName,
        memoryId: card.id,
        objectKey: sourceObjectKey,
        text: card.text,
        sectionPath: card.sectionPath,
        pageStart: card.pageStart,
        pageEnd: card.pageEnd,
        sourceChunkIds: card.sourceChunkIds,
        lifecycleStatus: lifecycleStatus(input.metadata),
        ...filterableMetadata,
        createdAt
      }
    } satisfies VectorRecord
  })
  logIngestStage({ stage: "embedding", phase: "end", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: chunks.length, memoryCardCount: memoryCards.length })

  logIngestStage({ stage: "vector_put", phase: "start", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: evidenceRecords.length, memoryCardCount: memoryRecords.length })
  await deps.evidenceVectorStore.put(evidenceRecords)
  await deps.memoryVectorStore.put(memoryRecords)
  logIngestStage({ stage: "vector_put", phase: "end", documentId, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.contentBytes?.length, chunkCount: evidenceRecords.length, memoryCardCount: memoryRecords.length })

  const manifest: DocumentManifest = {
    documentId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    metadata: input.metadata,
    qualityProfile,
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
    chunks: chunks.map(toChunkMetadata),
    lifecycleStatus: lifecycleStatus(input.metadata),
    activeDocumentId: stringValue(input.metadata?.activeDocumentId),
    stagedFromDocumentId: stringValue(input.metadata?.stagedFromDocumentId),
    reindexMigrationId: stringValue(input.metadata?.reindexMigrationId),
    chunkCount: chunks.length,
    memoryCardCount: memoryCards.length,
    parsedDocument: extracted.parsedDocument,
    extractionWarnings: extracted.warnings,
    extractionCounters: extracted.counters,
    fileProfile: extracted.fileProfile,
    createdAt
  }

  await deps.objectStore.putText(manifestObjectKey, JSON.stringify(manifest, null, 2), "application/json")
  return manifest
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

function lifecycleStatus(metadata: Record<string, JsonValue> | undefined): VectorRecord["metadata"]["lifecycleStatus"] {
  const value = stringValue(metadata?.lifecycleStatus)
  return value === "staging" || value === "superseded" ? value : "active"
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
