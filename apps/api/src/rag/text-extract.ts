import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import {
  DetectDocumentTextCommand,
  GetDocumentTextDetectionCommand,
  StartDocumentTextDetectionCommand,
  TextractClient,
  type Block as AwsTextractBlock,
  type GetDocumentTextDetectionCommandOutput
} from "@aws-sdk/client-textract"
import { config } from "../config.js"
import type { ExtractedFigure, ExtractedTable, ExtractionWarning, JsonValue, ParsedDocument, PdfFileProfile, StructuredBlock } from "../types.js"

const execFileAsync = promisify(execFile)

export type UploadLike = {
  fileName: string
  text?: string
  contentBase64?: string
  contentBytes?: Buffer
  textractJson?: string
  mimeType?: string
  sourceS3Object?: SourceS3Object
  ocrDetector?: OcrTextDetector
  pdfTextExtractor?: (buffer: Buffer) => Promise<string>
}

export type ExtractedDocument = {
  text: string
  blocks?: StructuredBlock[]
  sourceExtractorVersion: string
  parsedDocument?: ParsedDocument
  warnings?: ExtractionWarning[]
  counters?: Record<string, number>
  fileProfile?: PdfFileProfile
}

type SourceS3Object = {
  bucketName: string
  key: string
}

export type OcrTextDetector = (input: {
  fileName: string
  mimeType?: string
  bytes: Buffer
  sourceS3Object?: SourceS3Object
}) => Promise<ExtractedDocument | undefined>

export async function extractTextFromUpload(input: UploadLike): Promise<string> {
  return (await extractDocumentFromUpload(input)).text
}

export async function extractDocumentFromUpload(input: UploadLike): Promise<ExtractedDocument> {
  if (input.textractJson) return limitDocument(parseTextractJson(input.textractJson))
  if (input.text !== undefined) return limitDocument(textDocument(input.text, "direct-text-v1"))
  if (!input.contentBase64 && !input.contentBytes) throw new Error("Either text or contentBase64, or contentBytes is required")

  const buffer = input.contentBytes ?? Buffer.from(input.contentBase64 ?? "", "base64")
  const ext = input.fileName.split(".").pop()?.toLowerCase()
  const mimeType = input.mimeType?.toLowerCase() ?? ""

  if (mimeType.includes("textract") || input.fileName.endsWith(".textract.json")) {
    return limitDocument(parseTextractJson(buffer.toString("utf-8")))
  }

  if (mimeType.includes("pdf") || ext === "pdf") {
    return limitDocument(await extractPdfDocument(input, buffer))
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
  logPdfExtractStage({ stage: "pdf-parse", phase: "start", fileSizeBytes: buffer.length })
  const pdfParse = (await import("pdf-parse")).default
  const parsed = await pdfParse(buffer)
  const parsedText = parsed.text ?? ""
  logPdfExtractStage({ stage: "pdf-parse", phase: "end", fileSizeBytes: buffer.length, textLength: parsedText.length })
  logPdfExtractStage({ stage: "pdftotext", phase: "start", fileSizeBytes: buffer.length })
  const pdftotextText = await extractWithPdftotext(buffer)
  logPdfExtractStage({ stage: "pdftotext", phase: "end", fileSizeBytes: buffer.length, textLength: pdftotextText?.length ?? 0 })

  if (!pdftotextText) return parsedText
  return pdfTextQualityScore(pdftotextText) > pdfTextQualityScore(parsedText) ? pdftotextText : parsedText
}

async function extractPdfDocument(input: UploadLike, buffer: Buffer): Promise<ExtractedDocument> {
  logPdfExtractStage({ stage: "pdf-extract", phase: "start", fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: buffer.length })
  const extractedText = await (input.pdfTextExtractor ?? extractPdfText)(buffer)
  logPdfExtractStage({ stage: "pdf-extract", phase: "end", fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: buffer.length, textLength: extractedText.length })
  if (pdfTextQualityScore(extractedText) > 0) {
    return textDocument(extractedText, "pdf-layout-v2", {
      fileProfile: profilePdfText(extractedText),
      warnings: [],
      counters: { pdfNativeTextChars: extractedText.length, ocrFallbackUsed: 0 }
    })
  }

  const ocrDetector = input.ocrDetector ?? detectTextWithTextract
  logPdfExtractStage({ stage: "textract", phase: "start", fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: buffer.length })
  const ocrDocument = await ocrDetector({
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: buffer,
    sourceS3Object: input.sourceS3Object
  })
  logPdfExtractStage({
    stage: "textract",
    phase: "end",
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: buffer.length,
    textLength: ocrDocument?.text.length ?? 0,
    sourceExtractorVersion: ocrDocument?.sourceExtractorVersion
  })
  if (ocrDocument) {
    const warnings = [
      ...(ocrDocument.warnings ?? []),
      ...lowConfidenceWarnings(ocrDocument)
    ]
    return withParsedDocument({
      ...ocrDocument,
      warnings,
      fileProfile: ocrDocument.fileProfile ?? "scanned_image",
      counters: { ...(ocrDocument.counters ?? {}), pdfNativeTextChars: extractedText.length, ocrFallbackUsed: 1 }
    })
  }
  return textDocument(extractedText, "pdf-layout-v2", {
    fileProfile: "image_only",
    warnings: [{
      code: "pdf_ocr_unavailable",
      message: "PDF native text was empty and OCR fallback did not return text.",
      severity: "warning"
    }],
    counters: { pdfNativeTextChars: extractedText.length, ocrFallbackUsed: 0 }
  })
}

async function detectTextWithTextract(input: {
  fileName: string
  mimeType?: string
  bytes: Buffer
  sourceS3Object?: SourceS3Object
}): Promise<ExtractedDocument | undefined> {
  if (!config.pdfOcrFallbackEnabled) return undefined

  try {
    const blocks = input.sourceS3Object
      ? await detectTextWithTextractAsync(input.sourceS3Object)
      : await detectTextWithTextractSync(input.bytes)
    if (blocks.length === 0) return undefined
    return textractBlocksDocument(blocks, "textract-detect-document-text-v1")
  } catch (error) {
    throw new Error(`PDF OCR fallback failed for ${input.fileName}: ${errorMessage(error)}`, { cause: error })
  }
}

async function detectTextWithTextractSync(bytes: Buffer): Promise<TextractBlock[]> {
  if (bytes.length > config.pdfOcrFallbackSyncMaxBytes) return []
  const client = new TextractClient({ region: config.region })
  const response = await client.send(new DetectDocumentTextCommand({ Document: { Bytes: new Uint8Array(bytes) } }))
  return normalizeTextractBlocks(response.Blocks ?? [])
}

async function detectTextWithTextractAsync(source: SourceS3Object): Promise<TextractBlock[]> {
  const client = new TextractClient({ region: config.region })
  const start = await client.send(new StartDocumentTextDetectionCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: source.bucketName,
        Name: source.key
      }
    }
  }))
  if (!start.JobId) throw new Error("Textract did not return JobId")

  const deadline = Date.now() + config.pdfOcrFallbackTimeoutMs
  let firstPage: GetDocumentTextDetectionCommandOutput | undefined
  while (Date.now() <= deadline) {
    const response = await client.send(new GetDocumentTextDetectionCommand({ JobId: start.JobId }))
    if (response.JobStatus === "SUCCEEDED" || response.JobStatus === "PARTIAL_SUCCESS") {
      firstPage = response
      break
    }
    if (response.JobStatus === "FAILED") throw new Error(response.StatusMessage || "Textract job failed")
    await sleep(config.pdfOcrFallbackPollIntervalMs)
  }
  if (!firstPage) throw new Error(`Textract job did not finish within ${config.pdfOcrFallbackTimeoutMs}ms`)

  const blocks = normalizeTextractBlocks(firstPage.Blocks ?? [])
  let nextToken = firstPage.NextToken
  while (nextToken) {
    const response = await client.send(new GetDocumentTextDetectionCommand({ JobId: start.JobId, NextToken: nextToken }))
    blocks.push(...normalizeTextractBlocks(response.Blocks ?? []))
    nextToken = response.NextToken
  }
  return blocks
}

function textractBlocksDocument(blocks: TextractBlock[], sourceExtractorVersion: string): ExtractedDocument {
  return parseTextractBlocks(blocks, sourceExtractorVersion)
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
  return parseTextractBlocks(payload.Blocks ?? payload.blocks ?? [], "textract-json-v1")
}

function parseTextractBlocks(blocks: TextractBlock[], sourceExtractorVersion: string): ExtractedDocument {
  const byId = new Map(blocks.map((block) => [block.Id ?? "", block]))

  const structured: StructuredBlock[] = []
  const tables: ExtractedTable[] = []
  const figures: ExtractedFigure[] = []
  const warnings: ExtractionWarning[] = []
  let readingOrder = 0
  for (const block of blocks) {
    if (block.BlockType === "TABLE") {
      const cells = childIds(block).map((id) => byId.get(id)).filter((candidate): candidate is TextractBlock => candidate?.BlockType === "CELL")
      const { structuredBlock, table } = textractTableBlock(block, cells, byId, sourceExtractorVersion)
      structured.push({ ...structuredBlock, readingOrder: readingOrder++ })
      tables.push(table)
      continue
    }
    if (block.BlockType === "LINE" && block.Text) {
      const kind = guessLineKind(block.Text)
      const figureId = kind === "figure" ? block.Id ?? `figure-${figures.length}` : undefined
      if (figureId) {
        figures.push({
          id: figureId,
          pageStart: block.Page,
          pageEnd: block.Page,
          sourceBlockId: block.Id,
          caption: normalizeLineText(block.Text).replace(/^Figure:\s*/i, ""),
          confidence: block.Confidence,
          bbox: bboxFromTextract(block)
        })
      }
      structured.push({
        id: block.Id ?? `line-${structured.length}`,
        kind,
        text: normalizeLineText(block.Text),
        pageStart: block.Page,
        pageEnd: block.Page,
        heading: headingFromLine(block.Text),
        sourceBlockId: block.Id,
        normalizedFrom: "textract-line",
        confidence: block.Confidence,
        readingOrder: readingOrder++,
        bbox: bboxFromTextract(block),
        sourceLocation: sourceLocationFromTextract(block),
        figureId,
        extractionMethod: sourceExtractorVersion
      })
    }
  }

  const counters = {
    blockCount: blocks.length,
    structuredBlockCount: structured.length,
    tableCount: tables.length,
    figureCount: figures.length,
    lowConfidenceBlockCount: structured.filter((block) => isLowConfidence(block.confidence)).length
  }
  const document = {
    text: structured.map((block) => block.text).join("\n\n"),
    blocks: structured,
    sourceExtractorVersion,
    warnings,
    counters,
    fileProfile: sourceExtractorVersion.startsWith("textract-detect") ? "scanned_image" as const : undefined
  }
  return withParsedDocument(document, { tables, figures })
}

function textractTableBlock(
  block: TextractBlock,
  cells: TextractBlock[],
  byId: Map<string, TextractBlock>,
  extractionMethod: string
): { structuredBlock: StructuredBlock; table: ExtractedTable } {
  const rows = new Map<number, Map<number, string>>()
  const tableCells: ExtractedTable["cells"] = []
  let maxColumn = 0
  for (const cell of cells) {
    const rowIndex = cell.RowIndex ?? 1
    const columnIndex = cell.ColumnIndex ?? 1
    maxColumn = Math.max(maxColumn, columnIndex)
    const row = rows.get(rowIndex) ?? new Map<number, string>()
    const text = childText(cell, byId)
    row.set(columnIndex, text)
    rows.set(rowIndex, row)
    tableCells.push({
      rowIndex,
      columnIndex,
      text,
      confidence: cell.Confidence,
      bbox: bboxFromTextract(cell),
      sourceBlockId: cell.Id
    })
  }
  const ordered = [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => {
    return Array.from({ length: maxColumn }, (_, index) => row.get(index + 1) ?? "")
  })
  const text = toMarkdownTable(ordered)
  const tableId = block.Id ?? "table"
  const confidence = averageConfidence([block.Confidence, ...cells.map((cell) => cell.Confidence)])
  const structuredBlock: StructuredBlock = {
    id: block.Id ?? "table",
    kind: "table",
    text,
    pageStart: block.Page,
    pageEnd: block.Page,
    sourceBlockId: block.Id,
    normalizedFrom: "textract-table",
    tableColumnCount: maxColumn || undefined,
    tableRowCount: ordered.length || undefined,
    tableId,
    tableConfidence: confidence,
    confidence,
    bbox: bboxFromTextract(block),
    sourceLocation: sourceLocationFromTextract(block),
    extractionMethod
  }
  return {
    structuredBlock,
    table: {
      id: tableId,
      pageStart: block.Page,
      pageEnd: block.Page,
      sourceBlockId: block.Id,
      markdown: text,
      rowCount: ordered.length,
      columnCount: maxColumn,
      confidence,
      bbox: bboxFromTextract(block),
      cells: tableCells
    }
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

function textDocument(
  text: string,
  sourceExtractorVersion: string,
  options: Pick<ExtractedDocument, "warnings" | "counters" | "fileProfile"> = {}
): ExtractedDocument {
  return withParsedDocument({ text, sourceExtractorVersion, ...options })
}

function limitDocument(document: ExtractedDocument): ExtractedDocument {
  const normalized = limit(document.text)
  if (!document.blocks) return withParsedDocument({ ...document, text: normalized })
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
  return withParsedDocument({ ...document, text: normalized, blocks })
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
  Confidence?: number
  Geometry?: {
    BoundingBox?: {
      Left?: number
      Top?: number
      Width?: number
      Height?: number
    }
  }
  Relationships?: Array<{ Type?: string; Ids?: string[] }>
}

function normalizeTextractBlocks(blocks: AwsTextractBlock[]): TextractBlock[] {
  return blocks.map((block) => ({
    Id: block.Id,
    BlockType: block.BlockType,
    Text: block.Text,
    Page: block.Page,
    RowIndex: block.RowIndex,
    ColumnIndex: block.ColumnIndex,
    Confidence: block.Confidence,
    Geometry: block.Geometry,
    Relationships: block.Relationships?.map((relationship) => ({
      Type: relationship.Type,
      Ids: relationship.Ids
    }))
  }))
}

function withParsedDocument(
  document: ExtractedDocument,
  extras: { tables?: ExtractedTable[]; figures?: ExtractedFigure[] } = {}
): ExtractedDocument {
  const blocks = document.blocks ?? []
  const parsedDocument: ParsedDocument = {
    schemaVersion: 2,
    text: document.text,
    sourceExtractorVersion: document.sourceExtractorVersion,
    fileProfile: document.fileProfile,
    pages: pagesFromBlocks(document.text, blocks, document.fileProfile),
    blocks: blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      text: block.text,
      pageStart: block.pageStart,
      pageEnd: block.pageEnd,
      sourceBlockId: block.sourceBlockId,
      normalizedFrom: block.normalizedFrom,
      extractionMethod: block.extractionMethod,
      bbox: block.bbox,
      confidence: block.confidence,
      readingOrder: block.readingOrder,
      sourceLocation: block.sourceLocation,
      tableId: block.tableId,
      figureId: block.figureId
    })),
    tables: extras.tables ?? document.parsedDocument?.tables,
    figures: extras.figures ?? document.parsedDocument?.figures,
    warnings: document.warnings,
    counters: document.counters
  }
  return { ...document, parsedDocument }
}

function pagesFromBlocks(text: string, blocks: StructuredBlock[], fileProfile?: PdfFileProfile) {
  if (blocks.length === 0) {
    const pages = text.split(/\f+/)
    return pages.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText.trim(),
      fileProfile,
      confidence: undefined
    }))
  }
  const pages = new Map<number, StructuredBlock[]>()
  for (const block of blocks) {
    const page = block.pageStart ?? 1
    pages.set(page, [...(pages.get(page) ?? []), block])
  }
  return [...pages.entries()].sort(([a], [b]) => a - b).map(([pageNumber, pageBlocks]) => ({
    pageNumber,
    text: pageBlocks.map((block) => block.text).join("\n\n"),
    fileProfile,
    confidence: averageConfidence(pageBlocks.map((block) => block.confidence))
  }))
}

function bboxFromTextract(block: TextractBlock): JsonValue | undefined {
  const box = block.Geometry?.BoundingBox
  if (!box) return undefined
  return {
    unit: "normalized_page",
    x: box.Left ?? 0,
    y: box.Top ?? 0,
    width: box.Width ?? 0,
    height: box.Height ?? 0
  }
}

function sourceLocationFromTextract(block: TextractBlock) {
  const bbox = bboxFromTextract(block)
  if (!bbox && !block.Page) return undefined
  return {
    page: block.Page,
    pageStart: block.Page,
    pageEnd: block.Page,
    bbox,
    unit: bbox ? "normalized_page" as const : undefined,
    source: "textract"
  }
}

function averageConfidence(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => typeof value === "number")
  if (present.length === 0) return undefined
  return Number((present.reduce((sum, value) => sum + value, 0) / present.length).toFixed(2))
}

function isLowConfidence(confidence: number | undefined): boolean {
  return typeof confidence === "number" && confidence < 70
}

function lowConfidenceWarnings(document: ExtractedDocument): ExtractionWarning[] {
  return (document.blocks ?? []).filter((block) => isLowConfidence(block.confidence)).map((block) => ({
    code: "ocr_low_confidence_block",
    message: "OCR fallback returned a low-confidence block.",
    severity: "warning",
    page: block.pageStart,
    sourceBlockId: block.sourceBlockId ?? block.id,
    confidence: block.confidence
  }))
}

function profilePdfText(text: string): PdfFileProfile {
  const pages = text.split(/\f+/).map((page) => pdfTextQualityScore(page))
  if (pages.length <= 1) return "digital_text"
  const textPages = pages.filter((score) => score > 0).length
  if (textPages === pages.length) return "digital_text"
  if (textPages === 0) return "image_only"
  return "mixed"
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function logPdfExtractStage(input: {
  stage: "pdf-extract" | "pdf-parse" | "pdftotext" | "textract"
  phase: "start" | "end"
  fileName?: string
  mimeType?: string
  fileSizeBytes: number
  textLength?: number
  sourceExtractorVersion?: string
}): void {
  console.info(JSON.stringify({
    event: "document_extract_stage",
    stage: input.stage,
    phase: input.phase,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    textLength: input.textLength,
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
