import type { Chunk, DocumentStatistics, StructuredBlock } from "../types.js"

export function chunkText(text: string, chunkSize = 1200, overlap = 200): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\f+/g, "\n\f\n").trim()
  if (!normalized) return []

  const chunks: Chunk[] = []
  let index = 0
  let cursor = 0
  let page = 1
  let sectionPath: string[] = []

  for (const segment of normalized.split(/\n?\f\n?/)) {
    const segmentStart = cursor
    cursor += segment.length + 1

    const pageText = segment.replace(/\n{3,}/g, "\n\n").trim()
    if (!pageText) {
      page += 1
      continue
    }

    const heading = firstHeading(pageText)
    if (heading) sectionPath = nextSectionPath(sectionPath, heading)

    index = appendSegmentChunks({
      text: pageText,
      baseStart: segmentStart,
      chunkSize,
      overlap,
      startIndex: index,
      chunks,
      sectionPath,
      heading,
      page
    })
    page += 1
  }

  linkChunks(chunks)
  return chunks
}

export function chunkStructuredBlocks(blocks: StructuredBlock[], chunkSize = 1200, overlap = 200): Chunk[] {
  const chunks: Chunk[] = []
  let index = 0
  let cursor = 0
  let sectionPath: string[] = []

  for (const block of blocks) {
    const text = block.text.replace(/\r\n/g, "\n").trim()
    if (!text) continue
    if (block.heading) sectionPath = nextSectionPath(sectionPath, block.heading)
    const blockSectionPath = block.sectionPath ?? (sectionPath.length > 0 ? sectionPath : undefined)
    index = appendSegmentChunks({
      text,
      baseStart: cursor,
      chunkSize: block.kind === "text" ? chunkSize : Math.max(chunkSize, text.length),
      overlap: block.kind === "text" ? overlap : 0,
      startIndex: index,
      chunks,
      sectionPath: blockSectionPath ?? [],
      heading: block.heading ?? blockSectionPath?.at(-1),
      page: block.pageStart ?? 1,
      block
    })
    cursor += text.length + 1
  }

  linkChunks(chunks)
  return chunks
}

export function summarizeDocumentStatistics(chunks: Chunk[]): DocumentStatistics {
  const sectionIds = new Set(chunks.map((chunk) => chunk.parentSectionId ?? chunk.sectionPath?.join(">")).filter(Boolean))
  const kindCount = (kind: NonNullable<Chunk["chunkKind"]>) => chunks.filter((chunk) => chunk.chunkKind === kind).length
  const headingCount = chunks.filter((chunk) => chunk.heading || (chunk.sectionPath?.length ?? 0) > 0).length
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0)
  return {
    chunkCount: chunks.length,
    sectionCount: sectionIds.size,
    tableCount: kindCount("table"),
    listCount: kindCount("list"),
    codeCount: kindCount("code"),
    figureCount: kindCount("figure"),
    averageChunkChars: chunks.length === 0 ? 0 : Math.round(totalChars / chunks.length),
    headingDensity: chunks.length === 0 ? 0 : Number((headingCount / chunks.length).toFixed(4))
  }
}

function appendSegmentChunks(input: {
  text: string
  baseStart: number
  chunkSize: number
  overlap: number
  startIndex: number
  chunks: Chunk[]
  sectionPath: string[]
  heading?: string
  page: number
  block?: StructuredBlock
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
        endChar: baseStart + end,
        sectionPath: input.sectionPath.length > 0 ? [...input.sectionPath] : undefined,
        heading: input.heading,
        parentSectionId: input.sectionPath.length > 0 ? sectionId(input.sectionPath) : undefined,
        chunkHash: hashString(chunk),
        pageStart: input.block?.pageStart ?? input.page,
        pageEnd: input.block?.pageEnd ?? input.block?.pageStart ?? input.page,
        chunkKind: input.block?.kind ?? detectChunkKind(chunk),
        sourceBlockId: input.block?.sourceBlockId ?? input.block?.id,
        normalizedFrom: input.block?.normalizedFrom,
        tableColumnCount: input.block?.tableColumnCount,
        listDepth: input.block?.listDepth,
        codeLanguage: input.block?.codeLanguage,
        figureCaption: input.block?.figureCaption,
        extractionMethod: input.block?.extractionMethod
      })
      index += 1
    }
    if (end >= text.length) break
    start = Math.max(0, end - safeOverlap)
  }

  return index
}

function detectChunkKind(text: string): Chunk["chunkKind"] {
  if (/^```/m.test(text)) return "code"
  if (/^\|.+\|\n\|[-:|\s]+\|/m.test(text)) return "table"
  if (/^\s*(?:[-*]|\d+[.)])\s+/m.test(text)) return "list"
  if (/^(?:Figure|図表|図)\s*[:：]/im.test(text)) return "figure"
  return "text"
}

function firstHeading(text: string): string | undefined {
  for (const line of text.split("\n").slice(0, 8)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const markdown = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (markdown?.[1]) return markdown[1].trim()
    const numbered = trimmed.match(/^(?:第?\d+(?:\.\d+)*[章節]?|[0-9]+[.)])\s+(.+)$/)
    if (numbered?.[1]) return numbered[1].trim()
    if (trimmed.length <= 80 && /[:：]$/.test(trimmed)) return trimmed.replace(/[:：]$/, "").trim()
    break
  }
  return undefined
}

function nextSectionPath(current: string[], heading: string): string[] {
  if (current.at(-1) === heading) return current
  return [...current.slice(0, 3), heading].slice(-4)
}

function linkChunks(chunks: Chunk[]): void {
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    if (!chunk) continue
    const prev = chunks[index - 1]
    const next = chunks[index + 1]
    if (prev && prev.sectionPath?.join("/") === chunk.sectionPath?.join("/")) chunk.previousChunkId = prev.id
    if (next && next.sectionPath?.join("/") === chunk.sectionPath?.join("/")) chunk.nextChunkId = next.id
  }
}

function sectionId(sectionPath: string[]): string {
  return `section:${hashString(sectionPath.join(">"))}`
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}
