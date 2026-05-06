import type { Citation, RetrievedVector } from "../types.js"
import { ragRuntimePolicy } from "./runtime-policy.js"

export function toCitation(hit: RetrievedVector): Citation {
  return {
    documentId: hit.metadata.documentId,
    fileName: hit.metadata.fileName,
    chunkId: hit.metadata.chunkId ?? hit.metadata.memoryId,
    score: Number(hit.score.toFixed(4)),
    text: hit.metadata.text ?? ""
  }
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
