import type { z } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import { hasPermission } from "../authorization.js"
import type { AppUser } from "../auth.js"
import type { MemoRagService } from "../rag/memorag-service.js"
import type { DocumentManifestSchema, DocumentUploadRequestSchema, IngestUploadedDocumentRequestSchema } from "../schemas.js"

const benchmarkSeedSuites = new Set([
  "smoke-agent-v1",
  "standard-agent-v1",
  "clarification-smoke-v1",
  "allganize-rag-evaluation-ja-v1",
  "mmrag-docqa-v1",
  "mtrag-v1",
  "chatrag-bench-v1",
  "jp-public-pdf-qa-v1",
  "mtrag-v1",
  "chatrag-bench-v1",
  "mlit-pdf-figure-table-rag-seed-v1",
  "architecture-drawing-qarag-v0.1"
])
const maxBenchmarkSeedTextChars = 1_000_000
const maxBenchmarkSeedBase64Chars = 10_000_000
const benchmarkSeedMetadataKeys = new Set([
  "benchmarkSeed",
  "benchmarkSuiteId",
  "benchmarkSourceHash",
  "benchmarkIngestSignature",
  "benchmarkCorpusSkipMemory",
  "benchmarkEmbeddingModelId",
  "aclGroups",
  "docType",
  "lifecycleStatus",
  "source",
  "searchAliases",
  "drawingSourceType",
  "drawingSheetMetadata",
  "drawingRegionIndex",
  "drawingReferenceGraph"
])

type UploadPurpose = "document" | "benchmarkSeed" | "chatAttachment"

export function authorizeDocumentUpload(user: AppUser, body: z.infer<typeof DocumentUploadRequestSchema>) {
  if (hasPermission(user, "rag:doc:write:group")) return
  if (hasPermission(user, "benchmark:seed_corpus") && isBenchmarkSeedUpload(body)) return
  throw new HTTPException(403, { message: "Forbidden: benchmark seed upload requires isolated benchmark metadata" })
}

export function isBenchmarkSeedUpload(body: z.infer<typeof DocumentUploadRequestSchema>): boolean {
  if (!isBenchmarkSeedUploadMetadata(body)) return false
  if (body.text !== undefined) return isBenchmarkSeedTextUpload(body)
  if (body.contentBase64 !== undefined) return isBenchmarkSeedPdfUpload(body)
  return false
}

function isBenchmarkSeedDocumentManifest(manifest: z.infer<typeof DocumentManifestSchema>): boolean {
  const metadata = manifest.metadata
  return (manifest.lifecycleStatus ?? "active") === "active"
    && metadata?.benchmarkSeed === true
    && typeof metadata.benchmarkSuiteId === "string"
    && benchmarkSeedSuites.has(metadata.benchmarkSuiteId)
    && metadata.source === "benchmark-runner"
    && metadata.docType === "benchmark-corpus"
    && Array.isArray(metadata.aclGroups)
    && metadata.aclGroups.length === 1
    && metadata.aclGroups[0] === "BENCHMARK_RUNNER"
}

export function isBenchmarkSeedUploadedObjectIngest(body: z.infer<typeof IngestUploadedDocumentRequestSchema>): boolean {
  if (!isBenchmarkSeedUploadMetadata(body)) return false
  if (!isSafeBenchmarkSeedFileName(body.fileName)) return false
  if (body.mimeType === "application/pdf") return /\.pdf$/i.test(body.fileName)
  if (!body.mimeType || body.mimeType === "text/markdown" || body.mimeType === "text/plain") return /\.(md|txt)$/i.test(body.fileName)
  return false
}

function isBenchmarkSeedUploadMetadata(body: {
  fileName: string
  metadata?: Record<string, unknown>
}): boolean {
  const metadata = body.metadata
  if (!metadata) return false
  if (!Object.keys(metadata).every((key) => benchmarkSeedMetadataKeys.has(key))) return false
  if (metadata.benchmarkSeed !== true) return false
  if (typeof metadata.benchmarkSuiteId !== "string" || !benchmarkSeedSuites.has(metadata.benchmarkSuiteId)) return false
  if (typeof metadata.benchmarkSourceHash !== "string" || metadata.benchmarkSourceHash.length === 0) return false
  if (typeof metadata.benchmarkIngestSignature !== "string" || metadata.benchmarkIngestSignature.length === 0) return false
  if (typeof metadata.benchmarkCorpusSkipMemory !== "boolean") return false
  if (typeof metadata.benchmarkEmbeddingModelId !== "string" || metadata.benchmarkEmbeddingModelId.length === 0) return false
  if (metadata.source !== "benchmark-runner") return false
  if (metadata.docType !== "benchmark-corpus") return false
  if (metadata.lifecycleStatus !== "active") return false
  if (!Array.isArray(metadata.aclGroups) || metadata.aclGroups.length !== 1 || metadata.aclGroups[0] !== "BENCHMARK_RUNNER") return false
  if (metadata.searchAliases !== undefined && !isBenchmarkSearchAliases(metadata.searchAliases)) return false
  if (metadata.drawingSourceType !== undefined && !isBenchmarkDrawingSourceType(metadata.drawingSourceType)) return false
  if (metadata.drawingSheetMetadata !== undefined && !isBenchmarkDrawingSheetMetadata(metadata.drawingSheetMetadata)) return false
  if (metadata.drawingRegionIndex !== undefined && !isBenchmarkDrawingRegionIndex(metadata.drawingRegionIndex)) return false
  if (metadata.drawingReferenceGraph !== undefined && !isBenchmarkDrawingReferenceGraph(metadata.drawingReferenceGraph)) return false
  if (!isSafeBenchmarkSeedFileName(body.fileName)) return false
  return true
}

function isBenchmarkSeedTextUpload(body: z.infer<typeof DocumentUploadRequestSchema>): boolean {
  if (!body.text || body.text.length > maxBenchmarkSeedTextChars || body.contentBase64 || body.textractJson) return false
  if (!/\.(md|txt)$/i.test(body.fileName)) return false
  return !body.mimeType || body.mimeType === "text/markdown" || body.mimeType === "text/plain"
}

function isBenchmarkSearchAliases(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.entries(value).every(([term, expansions]) =>
    typeof term === "string"
      && term.trim().length > 0
      && Array.isArray(expansions)
      && expansions.length > 0
      && expansions.every((item) => typeof item === "string" && item.trim().length > 0)
  )
}

function isBenchmarkDrawingSourceType(value: unknown): boolean {
  return value === "project_drawing"
    || value === "standard_detail"
    || value === "equipment_standard"
    || value === "benchmark_reference"
    || value === "external"
}

function isBenchmarkDrawingSheetMetadata(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false
    const metadata = item as Record<string, unknown>
    return typeof metadata.pageOrSheet === "string"
      && metadata.pageOrSheet.length > 0
      && optionalString(metadata.drawingNo)
      && optionalString(metadata.sheetTitle)
      && optionalString(metadata.scale)
      && isStringArray(metadata.sourceQaIds)
      && typeof metadata.confidence === "number"
      && metadata.confidence >= 0
      && metadata.confidence <= 1
  })
}

function isBenchmarkDrawingRegionIndex(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false
    const region = item as Record<string, unknown>
    return typeof region.regionId === "string"
      && region.regionId.length > 0
      && (region.regionType === "titleblock" || region.regionType === "legend" || region.regionType === "table" || region.regionType === "note" || region.regionType === "detail")
      && typeof region.pageOrSheet === "string"
      && region.pageOrSheet.length > 0
      && isNormalizedBbox(region.bbox)
      && (region.bboxSource === "heuristic_region_candidate" || region.bboxSource === "page_extent")
      && typeof region.evidenceAnchor === "string"
      && isStringArray(region.sourceQaIds)
      && typeof region.confidence === "number"
      && region.confidence >= 0
      && region.confidence <= 1
  })
}

function isBenchmarkDrawingReferenceGraph(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const graph = value as Record<string, unknown>
  return graph.schemaVersion === 1
    && Array.isArray(graph.nodes)
    && graph.nodes.every(isBenchmarkDrawingGraphNode)
    && Array.isArray(graph.edges)
    && graph.edges.every(isBenchmarkDrawingGraphEdge)
    && Array.isArray(graph.detailIndex)
    && graph.detailIndex.every(isBenchmarkDrawingGraphDetail)
    && Array.isArray(graph.calloutEdges)
    && graph.calloutEdges.every(isBenchmarkDrawingGraphCalloutEdge)
    && Array.isArray(graph.conflicts)
    && graph.conflicts.every(isBenchmarkDrawingGraphConflict)
}

function isBenchmarkDrawingGraphNode(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const node = value as Record<string, unknown>
  return typeof node.nodeId === "string"
    && node.nodeId.length > 0
    && (node.nodeType === "page" || node.nodeType === "region" || node.nodeType === "detail" || node.nodeType === "section" || node.nodeType === "callout")
    && typeof node.pageOrSheet === "string"
    && node.pageOrSheet.length > 0
    && isNormalizedBbox(node.bbox)
    && typeof node.label === "string"
    && isStringArrayAllowEmpty(node.sourceQaIds)
    && typeof node.confidence === "number"
    && node.confidence >= 0
    && node.confidence <= 1
}

function isBenchmarkDrawingGraphEdge(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const edge = value as Record<string, unknown>
  return typeof edge.edgeId === "string"
    && edge.edgeId.length > 0
    && (edge.edgeType === "contains" || edge.edgeType === "references" || edge.edgeType === "same_as")
    && typeof edge.sourceNodeId === "string"
    && edge.sourceNodeId.length > 0
    && typeof edge.targetNodeId === "string"
    && edge.targetNodeId.length > 0
    && isNormalizedBbox(edge.sourceBbox)
    && isNormalizedBbox(edge.targetBbox)
    && typeof edge.label === "string"
    && isStringArrayAllowEmpty(edge.sourceQaIds)
    && typeof edge.confidence === "number"
    && edge.confidence >= 0
    && edge.confidence <= 1
}

function isBenchmarkDrawingGraphDetail(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const detail = value as Record<string, unknown>
  return typeof detail.detailNo === "string"
    && detail.detailNo.length > 0
    && optionalString(detail.detailTitle)
    && typeof detail.pageOrSheet === "string"
    && detail.pageOrSheet.length > 0
    && typeof detail.nodeId === "string"
    && detail.nodeId.length > 0
    && isNormalizedBbox(detail.bbox)
    && isStringArray(detail.sourceQaIds)
}

function isBenchmarkDrawingGraphCalloutEdge(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const edge = value as Record<string, unknown>
  return typeof edge.sourceNodeId === "string"
    && edge.sourceNodeId.length > 0
    && isNormalizedBbox(edge.sourceBbox)
    && typeof edge.refDetailNo === "string"
    && edge.refDetailNo.length > 0
    && typeof edge.targetNodeId === "string"
    && edge.targetNodeId.length > 0
    && isNormalizedBbox(edge.targetBbox)
    && typeof edge.confidence === "number"
    && edge.confidence >= 0
    && edge.confidence <= 1
    && isStringArray(edge.sourceQaIds)
}

function isBenchmarkDrawingGraphConflict(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const conflict = value as Record<string, unknown>
  return typeof conflict.sourceNodeId === "string"
    && conflict.sourceNodeId.length > 0
    && typeof conflict.targetNodeId === "string"
    && conflict.targetNodeId.length > 0
    && conflict.conflictType === "source_priority"
    && typeof conflict.evidence === "string"
    && conflict.evidence.length > 0
}

function isNormalizedBbox(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const bbox = value as Record<string, unknown>
  return bbox.unit === "normalized_page"
    && normalizedCoordinate(bbox.x)
    && normalizedCoordinate(bbox.y)
    && normalizedCoordinate(bbox.width)
    && normalizedCoordinate(bbox.height)
    && Number(bbox.x) + Number(bbox.width) <= 1
    && Number(bbox.y) + Number(bbox.height) <= 1
}

function normalizedCoordinate(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string"
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0)
}

function isStringArrayAllowEmpty(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
}

function isBenchmarkSeedPdfUpload(body: z.infer<typeof DocumentUploadRequestSchema>): boolean {
  if (!body.contentBase64 || body.text || body.textractJson) return false
  if (!/\.pdf$/i.test(body.fileName)) return false
  if (body.mimeType !== "application/pdf") return false
  return isValidBenchmarkSeedBase64(body.contentBase64)
}

function isSafeBenchmarkSeedFileName(fileName: string): boolean {
  return fileName.length > 0 && !fileName.includes("/") && !fileName.includes("\\")
}

function isValidBenchmarkSeedBase64(value: string): boolean {
  if (value.length === 0 || value.length > maxBenchmarkSeedBase64Chars || value.length % 4 !== 0) return false
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false
  return Buffer.byteLength(value, "base64") > 0
}

export function authorizeUploadedDocumentIngest(user: AppUser, purpose: UploadPurpose, body: z.infer<typeof IngestUploadedDocumentRequestSchema>) {
  if (purpose === "chatAttachment") {
    if (hasPermission(user, "chat:create")) return
    throw new HTTPException(403, { message: "Forbidden: missing chat:create" })
  }
  if (purpose === "benchmarkSeed") {
    if (hasPermission(user, "benchmark:seed_corpus") && isBenchmarkSeedUploadedObjectIngest(body)) return
    throw new HTTPException(403, { message: "Forbidden: benchmark seed upload requires isolated benchmark metadata" })
  }
  if (hasPermission(user, "rag:doc:write:group")) return
  throw new HTTPException(403, { message: "Forbidden: missing rag:doc:write:group" })
}

export async function authorizeDocumentDelete(service: MemoRagService, user: AppUser, documentId: string) {
  if (hasPermission(user, "rag:doc:delete:group")) return
  if (!hasPermission(user, "benchmark:seed_corpus")) {
    throw new HTTPException(403, { message: "Forbidden: missing document delete permission" })
  }
  const manifest = await service.getDocumentManifest(documentId)
  if (!isBenchmarkSeedDocumentManifest(manifest)) {
    throw new HTTPException(403, { message: "Forbidden: benchmark seed delete requires isolated benchmark metadata" })
  }
}
