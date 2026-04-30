import type { Chunk } from "../types.js"

export function chunkText(text: string, chunkSize = 1200, overlap = 200): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\f+/g, "\n\f\n").trim()
  if (!normalized) return []

  const chunks: Chunk[] = []
  let index = 0
  let cursor = 0

  for (const segment of normalized.split(/\n?\f\n?/)) {
    const segmentStart = cursor
    cursor += segment.length + 1

    const pageText = segment.replace(/\n{3,}/g, "\n\n").trim()
    if (!pageText) continue

    index = appendSegmentChunks({
      text: pageText,
      baseStart: segmentStart,
      chunkSize,
      overlap,
      startIndex: index,
      chunks
    })
  }

  return chunks
}

function appendSegmentChunks(input: {
  text: string
  baseStart: number
  chunkSize: number
  overlap: number
  startIndex: number
  chunks: Chunk[]
}): number {
  const { text, baseStart, chunkSize, overlap, chunks } = input
  const safeOverlap = Math.min(overlap, Math.floor(chunkSize / 2))
  let start = 0
  let index = input.startIndex

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", end)
      const sentenceBreak = Math.max(text.lastIndexOf("。", end), text.lastIndexOf(". ", end))
      const candidate = Math.max(paragraphBreak, sentenceBreak)
      if (candidate > start + Math.floor(chunkSize * 0.55)) end = candidate + 1
    }

    const chunk = text.slice(start, end).trim()
    if (chunk) {
      chunks.push({
        id: `chunk-${String(index).padStart(4, "0")}`,
        text: chunk,
        startChar: baseStart + start,
        endChar: baseStart + end
      })
      index += 1
    }
    if (end >= text.length) break
    start = Math.max(0, end - safeOverlap)
  }

  return index
}
