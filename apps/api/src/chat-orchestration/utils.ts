import type { Citation, EvidenceAuthorityStatus, EvidenceRole, RetrievedVector } from "../types.js"
import { ragRuntimePolicy } from "./runtime-policy.js"

export function toCitation(hit: RetrievedVector, evidence?: {
  topic?: string
  role?: EvidenceRole
  authorizationEvaluatedAt?: string
}): Citation {
  const sourceType = hit.metadata.sourceType ?? hit.metadata.drawingSourceType
  const citation: Citation = {
    documentId: hit.metadata.documentId,
    fileName: hit.metadata.fileName,
    chunkId: hit.metadata.chunkId ?? hit.metadata.memoryId,
    score: Number(hit.score.toFixed(4)),
    text: hit.metadata.text ?? ""
  }
  if (hit.metadata.documentVersion) citation.documentVersion = hit.metadata.documentVersion
  if (hit.metadata.pageStart) citation.pageStart = hit.metadata.pageStart
  if (hit.metadata.pageEnd) citation.pageEnd = hit.metadata.pageEnd
  if (hit.metadata.pageOrSheet) citation.pageOrSheet = hit.metadata.pageOrSheet
  if (hit.metadata.drawingNo) citation.drawingNo = hit.metadata.drawingNo
  if (hit.metadata.sheetTitle) citation.sheetTitle = hit.metadata.sheetTitle
  if (hit.metadata.scale) citation.scale = hit.metadata.scale
  if (hit.metadata.regionId) citation.regionId = hit.metadata.regionId
  if (hit.metadata.regionType) citation.regionType = hit.metadata.regionType
  if (sourceType) citation.sourceType = sourceType
  if (hit.metadata.bbox !== undefined) citation.bbox = hit.metadata.bbox
  const topic = evidence?.topic ?? hit.metadata.evidenceTopic
  if (topic) citation.topic = topic
  citation.evidenceRole = evidence?.role ?? hit.metadata.evidenceRole ?? "background"
  citation.authorityStatus = evidenceAuthorityStatus(hit)
  if (hit.metadata.effectiveFrom) citation.effectiveFrom = hit.metadata.effectiveFrom
  if (hit.metadata.effectiveUntil) citation.effectiveUntil = hit.metadata.effectiveUntil
  citation.sourceLocator = hit.metadata.sourceLocation ?? hit.metadata.securityEnvelope?.sourceLocator ?? fallbackSourceLocator(hit)
  if (evidence?.authorizationEvaluatedAt) {
    citation.authorizationDecision = "allowed"
    citation.authorizationEvaluatedAt = evidence.authorizationEvaluatedAt
  }
  return citation
}

function evidenceAuthorityStatus(hit: RetrievedVector): EvidenceAuthorityStatus {
  if (hit.metadata.authorityStatus === "authoritative" || hit.metadata.authorityStatus === "secondary") return hit.metadata.authorityStatus
  return hit.metadata.securityEnvelope?.provenanceRef ? "authoritative" : "unknown"
}

function fallbackSourceLocator(hit: RetrievedVector): Citation["sourceLocator"] {
  const locator: NonNullable<Citation["sourceLocator"]> = {}
  if (hit.metadata.pageStart) locator.pageStart = hit.metadata.pageStart
  if (hit.metadata.pageEnd) locator.pageEnd = hit.metadata.pageEnd
  if (hit.metadata.sectionPath?.length) locator.sectionPath = [...hit.metadata.sectionPath]
  if (hit.metadata.sourceBlockId) locator.sourceBlockId = hit.metadata.sourceBlockId
  return Object.keys(locator).length > 0 ? locator : undefined
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

export function buildSearchClues(question: string, generatedClues: string[]): string[] {
  return unique([question, ...generatedClues]).slice(0, ragRuntimePolicy.limits.searchClueLimit)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function compactDetail(lines: Array<string | undefined>, maxChars = 1400): string {
  return lines.filter(Boolean).join("\n").slice(0, maxChars)
}
