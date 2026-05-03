import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { config } from "../config.js"
import type { StructuredBlock } from "../types.js"

const execFileAsync = promisify(execFile)

export type UploadLike = {
  fileName: string
  text?: string
  contentBase64?: string
  textractJson?: string
  mimeType?: string
}

export type ExtractedDocument = {
  text: string
  blocks?: StructuredBlock[]
  sourceExtractorVersion: string
}

export async function extractTextFromUpload(input: UploadLike): Promise<string> {
  return (await extractDocumentFromUpload(input)).text
}

export async function extractDocumentFromUpload(input: UploadLike): Promise<ExtractedDocument> {
  if (input.textractJson) return limitDocument(parseTextractJson(input.textractJson))
  if (input.text !== undefined) return limitDocument(textDocument(input.text, "direct-text-v1"))
  if (!input.contentBase64) throw new Error("Either text or contentBase64 is required")

  const buffer = Buffer.from(input.contentBase64, "base64")
  const ext = input.fileName.split(".").pop()?.toLowerCase()
  const mimeType = input.mimeType?.toLowerCase() ?? ""

  if (mimeType.includes("textract") || input.fileName.endsWith(".textract.json")) {
    return limitDocument(parseTextractJson(buffer.toString("utf-8")))
  }

  if (mimeType.includes("pdf") || ext === "pdf") {
    return limitDocument(textDocument(await extractPdfText(buffer), "pdf-layout-v2"))
  }

  if (mimeType.includes("wordprocessingml") || ext === "docx") {
    return limitDocument(await extractDocxDocument(buffer))
  }

  return limitDocument(textDocument(buffer.toString("utf-8"), "utf8-v1"))
}

async function extractDocxDocument(buffer: Buffer): Promise<ExtractedDocument> {
  const mammothModule = await import("mammoth")
  const mammoth = (mammothModule.default ?? mammothModule) as {
    convertToHtml(input: { buffer: Buffer }, options?: { styleMap?: string[] }): Promise<{ value: string }>
    extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>
  }
  const html = await mammoth.convertToHtml({ buffer }, {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Code'] => pre:fresh",
      "p[style-name='Caption'] => figure > figcaption:fresh"
    ]
  })
  const blocks = htmlToBlocks(html.value, "docx-mammoth-html-v2")
  if (blocks.length > 0) return { text: blocks.map((block) => block.text).join("\n\n"), blocks, sourceExtractorVersion: "docx-mammoth-html-v2" }

  const parsed = await mammoth.extractRawText({ buffer })
  return textDocument(parsed.value, "docx-mammoth-raw-v1")
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default
  const parsed = await pdfParse(buffer)
  const parsedText = parsed.text ?? ""
  const pdftotextText = await extractWithPdftotext(buffer)

  if (!pdftotextText) return parsedText
  return pdfTextQualityScore(pdftotextText) > pdfTextQualityScore(parsedText) ? pdftotextText : parsedText
}

async function extractWithPdftotext(buffer: Buffer): Promise<string | undefined> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "memorag-pdf-"))
  const filePath = path.join(tempDir, "source.pdf")
  try {
    await fs.writeFile(filePath, buffer)
    const { stdout } = await execFileAsync("pdftotext", ["-layout", filePath, "-"], {
      maxBuffer: config.maxUploadChars * 4,
      timeout: 20_000
    })
    return stdout
  } catch {
    return undefined
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

function parseTextractJson(jsonText: string): ExtractedDocument {
  const payload = JSON.parse(jsonText) as { Blocks?: TextractBlock[]; blocks?: TextractBlock[] }
  const blocks = payload.Blocks ?? payload.blocks ?? []
  const byId = new Map(blocks.map((block) => [block.Id ?? "", block]))

  const structured: StructuredBlock[] = []
  for (const block of blocks) {
    if (block.BlockType === "TABLE") {
      const cells = childIds(block).map((id) => byId.get(id)).filter((candidate): candidate is TextractBlock => candidate?.BlockType === "CELL")
      structured.push(textractTableBlock(block, cells, byId))
      continue
    }
    if (block.BlockType === "LINE" && block.Text) {
      structured.push({
        id: block.Id ?? `line-${structured.length}`,
        kind: guessLineKind(block.Text),
        text: normalizeLineText(block.Text),
        pageStart: block.Page,
        pageEnd: block.Page,
        heading: headingFromLine(block.Text),
        sourceBlockId: block.Id,
        normalizedFrom: "textract-line",
        extractionMethod: "textract-json-v1"
      })
    }
  }

  return { text: structured.map((block) => block.text).join("\n\n"), blocks: structured, sourceExtractorVersion: "textract-json-v1" }
}

function textractTableBlock(block: TextractBlock, cells: TextractBlock[], byId: Map<string, TextractBlock>): StructuredBlock {
  const rows = new Map<number, Map<number, string>>()
  let maxColumn = 0
  for (const cell of cells) {
    const rowIndex = cell.RowIndex ?? 1
    const columnIndex = cell.ColumnIndex ?? 1
    maxColumn = Math.max(maxColumn, columnIndex)
    const row = rows.get(rowIndex) ?? new Map<number, string>()
    row.set(columnIndex, childText(cell, byId))
    rows.set(rowIndex, row)
  }
  const ordered = [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => {
    return Array.from({ length: maxColumn }, (_, index) => row.get(index + 1) ?? "")
  })
  const text = toMarkdownTable(ordered)
  return {
    id: block.Id ?? "table",
    kind: "table",
    text,
    pageStart: block.Page,
    pageEnd: block.Page,
    sourceBlockId: block.Id,
    normalizedFrom: "textract-table",
    tableColumnCount: maxColumn || undefined,
    extractionMethod: "textract-json-v1"
  }
}

function htmlToBlocks(html: string, extractionMethod: string): StructuredBlock[] {
  const blocks: StructuredBlock[] = []
  const pattern = /<(h[1-6]|p|li|pre|table|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    const tag = (match[1] ?? "").toLowerCase()
    const inner = match[2] ?? ""
    const plain = decodeHtml(stripTags(inner)).trim()
    if (!plain && tag !== "table") continue
    if (tag.startsWith("h")) {
      blocks.push({ id: `html-${blocks.length}`, kind: "text", text: plain, heading: plain, normalizedFrom: "docx-heading", extractionMethod })
    } else if (tag === "li") {
      blocks.push({ id: `html-${blocks.length}`, kind: "list", text: `- ${plain}`, listDepth: 1, normalizedFrom: "docx-list", extractionMethod })
    } else if (tag === "pre") {
      blocks.push({ id: `html-${blocks.length}`, kind: "code", text: `\`\`\`\n${plain}\n\`\`\``, normalizedFrom: "docx-code", extractionMethod })
    } else if (tag === "table") {
      blocks.push({ id: `html-${blocks.length}`, kind: "table", text: htmlTableToMarkdown(inner), normalizedFrom: "docx-table", extractionMethod })
    } else if (tag === "figcaption") {
      blocks.push({ id: `html-${blocks.length}`, kind: "figure", text: `Figure: ${plain}`, figureCaption: plain, normalizedFrom: "docx-figure", extractionMethod })
    } else {
      blocks.push({ id: `html-${blocks.length}`, kind: "text", text: plain, normalizedFrom: "docx-paragraph", extractionMethod })
    }
  }
  return mergeAdjacentLists(blocks)
}

function htmlTableToMarkdown(inner: string): string {
  const rows = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) => {
    return [...(rowMatch[1] ?? "").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) => decodeHtml(stripTags(cellMatch[1] ?? "")).trim())
  })
  return toMarkdownTable(rows)
}

function toMarkdownTable(rows: string[][]): string {
  const safeRows = rows.filter((row) => row.some(Boolean))
  if (safeRows.length === 0) return ""
  const width = Math.max(...safeRows.map((row) => row.length))
  const normalized = safeRows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""))
  const header = normalized[0] ?? []
  const body = normalized.slice(1)
  return [
    `| ${header.map(escapeTableCell).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map(escapeTableCell).join(" | ")} |`)
  ].join("\n")
}

function mergeAdjacentLists(blocks: StructuredBlock[]): StructuredBlock[] {
  const merged: StructuredBlock[] = []
  for (const block of blocks) {
    const previous = merged.at(-1)
    if (block.kind === "list" && previous?.kind === "list") {
      previous.text = `${previous.text}\n${block.text}`
      continue
    }
    merged.push({ ...block })
  }
  return merged
}

function textDocument(text: string, sourceExtractorVersion: string): ExtractedDocument {
  return { text, sourceExtractorVersion }
}

function limitDocument(document: ExtractedDocument): ExtractedDocument {
  const normalized = limit(document.text)
  if (!document.blocks) return { ...document, text: normalized }
  let total = 0
  const blocks: StructuredBlock[] = []
  for (const block of document.blocks) {
    if (total >= config.maxUploadChars) break
    const remaining = config.maxUploadChars - total
    const text = limit(block.text).slice(0, remaining)
    if (!text) continue
    blocks.push({ ...block, text })
    total += text.length + 2
  }
  return { ...document, text: normalized, blocks }
}

function limit(text: string): string {
  const normalized = text.split("\u0000").join("").trim()
  if (normalized.length > config.maxUploadChars) return normalized.slice(0, config.maxUploadChars)
  return normalized
}

function pdfTextQualityScore(text: string): number {
  const normalized = text.replace(/\s+/g, "")
  if (!normalized) return 0

  const japaneseChars = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)?.length ?? 0
  const latinChars = normalized.match(/[A-Za-z]/g)?.length ?? 0
  const dotLeaders = text.match(/\. \. \./g)?.length ?? 0
  return normalized.length + japaneseChars * 2 + latinChars * 0.25 - dotLeaders * 80
}

type TextractBlock = {
  Id?: string
  BlockType?: string
  Text?: string
  Page?: number
  RowIndex?: number
  ColumnIndex?: number
  Relationships?: Array<{ Type?: string; Ids?: string[] }>
}

function childIds(block: TextractBlock): string[] {
  return block.Relationships?.filter((relationship) => relationship.Type === "CHILD").flatMap((relationship) => relationship.Ids ?? []) ?? []
}

function childText(block: TextractBlock, byId: Map<string, TextractBlock>): string {
  const ids = block.Relationships?.filter((relationship) => relationship.Type === "CHILD").flatMap((relationship) => relationship.Ids ?? []) ?? []
  return ids.map((id) => byId.get(id)?.Text).filter(Boolean).join(" ")
}

function guessLineKind(text: string): StructuredBlock["kind"] {
  if (/^\s*(?:[-*]|\d+[.)])\s+/.test(text)) return "list"
  if (/^(?:Figure|図表|図)\s*[:：]/i.test(text)) return "figure"
  return "text"
}

function normalizeLineText(text: string): string {
  if (/^\s*(?:[-*]|\d+[.)])\s+/.test(text)) return text.replace(/^\s*\d+[.)]\s+/, "- ").trim()
  return text.trim()
}

function headingFromLine(text: string): string | undefined {
  const trimmed = text.trim()
  if (/^#{1,6}\s+/.test(trimmed)) return trimmed.replace(/^#{1,6}\s+/, "")
  if (/^(?:第?\d+(?:\.\d+)*[章節]?|[0-9]+[.)])\s+/.test(trimmed) && trimmed.length <= 100) return trimmed.replace(/^(?:第?\d+(?:\.\d+)*[章節]?|[0-9]+[.)])\s+/, "")
  return undefined
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ")
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|")
}
