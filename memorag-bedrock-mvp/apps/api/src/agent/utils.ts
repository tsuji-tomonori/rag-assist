import type { Citation, RetrievedVector } from "../types.js"
import { ragRuntimePolicy } from "./runtime-policy.js"

export function toCitation(hit: RetrievedVector): Citation {
  const sourceType = hit.metadata.sourceType ?? hit.metadata.drawingSourceType
  const citation: Citation = {
    documentId: hit.metadata.documentId,
    fileName: hit.metadata.fileName,
    chunkId: hit.metadata.chunkId ?? hit.metadata.memoryId,
    score: Number(hit.score.toFixed(4)),
    text: hit.metadata.text ?? ""
  }
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
  return citation
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

export function buildSearchClues(question: string, generatedClues: string[]): string[] {
  const anchors = question.includes("分類") ? ragRuntimePolicy.profile.answerPolicy.searchClueAnchors : []
  return unique([question, ...anchors, ...generatedClues]).slice(0, ragRuntimePolicy.limits.searchClueLimit)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function compactDetail(lines: Array<string | undefined>, maxChars = 1400): string {
  return lines.filter(Boolean).join("\n").slice(0, maxChars)
}
