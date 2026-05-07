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
      chunkSize: isAtomicStructuredBlock(block) ? Math.max(chunkSize, text.length) : chunkSize,
      overlap: isAtomicStructuredBlock(block) ? 0 : overlap,
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
  const units = buildSemanticUnits(text, chunkSize)
  let unitIndex = 0
  let index = input.startIndex

  while (unitIndex < units.length) {
    const startUnitIndex = unitIndex
    const start = units[startUnitIndex]?.start ?? 0
    let endUnitIndex = startUnitIndex
    let end = units[endUnitIndex]?.end ?? text.length

    while (endUnitIndex + 1 < units.length) {
      const candidateEnd = units[endUnitIndex + 1]?.end ?? end
      if (candidateEnd - start > chunkSize) break
      endUnitIndex += 1
      end = candidateEnd
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
    unitIndex = nextUnitIndexWithOverlap(units, startUnitIndex, endUnitIndex, safeOverlap)
  }

  return index
}

type SemanticUnit = {
  start: number
  end: number
}

function buildSemanticUnits(text: string, chunkSize: number): SemanticUnit[] {
  return splitParagraphs(text).flatMap((paragraph) => splitParagraphUnit(text, paragraph, chunkSize))
}

function splitParagraphs(text: string): SemanticUnit[] {
  const units: SemanticUnit[] = []
  let cursor = 0

  while (cursor < text.length) {
    const separator = text.slice(cursor).match(/\n{2,}/)
    const rawEnd = separator?.index === undefined ? text.length : cursor + separator.index
    const paragraph = trimSpan(text, cursor, rawEnd)
    if (paragraph) units.push(paragraph)
    cursor = separator ? rawEnd + separator[0].length : text.length
  }

  return units
}

function splitParagraphUnit(text: string, unit: SemanticUnit, chunkSize: number): SemanticUnit[] {
  const paragraph = text.slice(unit.start, unit.end)
  const listItems = splitListItems(paragraph, unit.start)
  if (listItems.length > 1) return listItems.flatMap((item) => splitLongUnit(text, item, chunkSize))
  if (unit.end - unit.start <= chunkSize) return [unit]
  const sentences = splitSentences(paragraph, unit.start)
  if (sentences.length > 1) return sentences.flatMap((sentence) => splitLongUnit(text, sentence, chunkSize))
  return splitLongUnit(text, unit, chunkSize)
}

function splitListItems(paragraph: string, baseStart: number): SemanticUnit[] {
  const lines = lineSpans(paragraph)
  const items: SemanticUnit[] = []
  let currentStart: number | undefined
  let currentEnd: number | undefined

  for (const line of lines) {
    const raw = paragraph.slice(line.start, line.end)
    if (/^\s*(?:[-*]|\d+[.)])\s+/.test(raw)) {
      if (currentStart !== undefined && currentEnd !== undefined) {
        const item = trimSpan(paragraph, currentStart, currentEnd)
        if (item) items.push({ start: baseStart + item.start, end: baseStart + item.end })
      }
      currentStart = line.start
      currentEnd = line.end
      continue
    }
    if (currentStart !== undefined) currentEnd = line.end
  }

  if (currentStart !== undefined && currentEnd !== undefined) {
    const item = trimSpan(paragraph, currentStart, currentEnd)
    if (item) items.push({ start: baseStart + item.start, end: baseStart + item.end })
  }

  return items
}

function splitSentences(paragraph: string, baseStart: number): SemanticUnit[] {
  const units: SemanticUnit[] = []
  let start = 0

  for (let index = 0; index < paragraph.length; index += 1) {
    const char = paragraph[index]
    const next = paragraph[index + 1] ?? ""
    const isJapaneseSentenceEnd = char !== undefined && /[。！？]/.test(char)
    const isAsciiSentenceEnd = char !== undefined && /[.!?]/.test(char) && (!next || /\s/.test(next))
    if (!isJapaneseSentenceEnd && !isAsciiSentenceEnd) continue

    const sentence = trimSpan(paragraph, start, index + 1)
    if (sentence) units.push({ start: baseStart + sentence.start, end: baseStart + sentence.end })
    start = index + 1
  }

  const rest = trimSpan(paragraph, start, paragraph.length)
  if (rest) units.push({ start: baseStart + rest.start, end: baseStart + rest.end })
  return units
}

function splitLongUnit(text: string, unit: SemanticUnit, chunkSize: number): SemanticUnit[] {
  if (unit.end - unit.start <= chunkSize) return [unit]

  const units: SemanticUnit[] = []
  let start = unit.start

  while (start < unit.end) {
    let end = Math.min(start + chunkSize, unit.end)
    if (end < unit.end) {
      const candidate = preferredFallbackBreak(text, start, end)
      if (candidate > start + Math.floor(chunkSize * 0.55)) end = candidate
    }
    const span = trimSpan(text, start, end)
    if (span) units.push(span)
    if (end >= unit.end) break
    start = end
  }

  return units
}

function nextUnitIndexWithOverlap(units: SemanticUnit[], startUnitIndex: number, endUnitIndex: number, safeOverlap: number): number {
  const nextIndex = endUnitIndex + 1
  if (nextIndex >= units.length) return nextIndex
  if (safeOverlap <= 0) return nextIndex

  let overlapStart = nextIndex
  for (let index = endUnitIndex; index >= startUnitIndex; index -= 1) {
    const start = units[index]?.start
    const end = units[endUnitIndex]?.end
    if (start === undefined || end === undefined) break
    if (end - start > safeOverlap) break
    overlapStart = index
  }

  return overlapStart === startUnitIndex ? nextIndex : overlapStart
}

function preferredFallbackBreak(text: string, start: number, end: number): number {
  const candidates = ["\n", "。", "、", "，", "、", ",", " "]
    .map((delimiter) => text.lastIndexOf(delimiter, end - 1))
    .filter((candidate) => candidate >= start)
  const candidate = Math.max(...candidates)
  if (!Number.isFinite(candidate) || candidate < start) return end
  return candidate + 1
}

function lineSpans(text: string): SemanticUnit[] {
  const spans: SemanticUnit[] = []
  let start = 0
  for (let index = 0; index <= text.length; index += 1) {
    if (index < text.length && text[index] !== "\n") continue
    spans.push({ start, end: index })
    start = index + 1
  }
  return spans
}

function trimSpan(text: string, start: number, end: number): SemanticUnit | undefined {
  let trimmedStart = start
  let trimmedEnd = end
  while (trimmedStart < trimmedEnd && /\s/.test(text[trimmedStart] ?? "")) trimmedStart += 1
  while (trimmedEnd > trimmedStart && /\s/.test(text[trimmedEnd - 1] ?? "")) trimmedEnd -= 1
  if (trimmedStart >= trimmedEnd) return undefined
  return { start: trimmedStart, end: trimmedEnd }
}

function isAtomicStructuredBlock(block: StructuredBlock): boolean {
  return block.kind === "table" || block.kind === "code" || block.kind === "figure"
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
