import type { Chunk } from "../types.js"

export function chunkText(text: string, chunkSize = 1200, overlap = 200): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (!normalized) return []

  const chunks: Chunk[] = []
  let start = 0
  let index = 0
  const safeOverlap = Math.min(overlap, Math.floor(chunkSize / 2))

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length)
    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", end)
      const sentenceBreak = Math.max(normalized.lastIndexOf("。", end), normalized.lastIndexOf(". ", end))
      const candidate = Math.max(paragraphBreak, sentenceBreak)
      if (candidate > start + Math.floor(chunkSize * 0.55)) end = candidate + 1
    }

    const chunk = normalized.slice(start, end).trim()
    if (chunk) {
      chunks.push({
        id: `chunk-${String(index).padStart(4, "0")}`,
        text: chunk,
        startChar: start,
        endChar: end
      })
      index += 1
    }
    if (end >= normalized.length) break
    start = Math.max(0, end - safeOverlap)
  }

  return chunks
}
