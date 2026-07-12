import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
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
import { config } from "../../../../config.js"
import type { ExtractedFigure, ExtractedTable, ExtractionWarning, JsonValue, ParsedDocument, PdfFileProfile, StructuredBlock } from "../../../../types.js"
import {
  classifyDegradationTrigger,
  measurePartialRuntimeRagGuards,
  safeDegradationDecision,
} from "../../../_shared/security/safe-degradation-policy.js"

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
  docxConverter?: MammothDocumentConverter
  /** Internal production seam: block fallback unless every mandatory guard outcome was observed. */
  enforceObservedFallbackGuards?: boolean
}

export type ExtractedDocument = {
  text: string
  blocks?: StructuredBlock[]
  sourceExtractorVersion: string
  parsedDocument?: ParsedDocument
  warnings?: ExtractionWarning[]
  counters?: Record<string, number>
  fileProfile?: PdfFileProfile
  extractionStatus?: "complete" | "partial"
  inputCharCount?: number
  outputCharCount?: number
  contentHash?: string
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

export type MammothConversionMessage = {
  type: "warning" | "error"
  message: string
  error?: unknown
}

export type MammothDocumentConverter = {
  convertToHtml(
    input: { buffer: Buffer },
    options?: { styleMap?: string[] }
  ): Promise<{ value: string; messages?: MammothConversionMessage[] }>
  extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages?: MammothConversionMessage[] }>
}

export type TextractServiceWarning = {
  ErrorCode?: string
  Pages?: number[]
}

export type TextractDetectionResult = {
  blocks: TextractBlock[]
  jobStatus: "SUCCEEDED" | "PARTIAL_SUCCESS"
  statusMessage?: string
  warnings: TextractServiceWarning[]
  expectedPageCount?: number
}

type NativePdfExtraction = {
  text: string
  pageCount?: number
  emptyPageNumbers: number[]
  warnings: ExtractionWarning[]
}

type PdfParsePageData = {
  getTextContent(options?: {
    normalizeWhitespace?: boolean
    disableCombineTextItems?: boolean
  }): Promise<{ items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean }> }>
}

export async function extractTextFromUpload(input: UploadLike): Promise<string> {
  return (await extractDocumentFromUpload(input)).text
}

export async function extractDocumentFromUpload(input: UploadLike): Promise<ExtractedDocument> {
  if (input.textractJson) return limitDocument(parseTextractJson(input.textractJson))
  if (input.text !== undefined) return limitDocument(textDocument(input.text, "direct-text-v1"))
  if (!input.contentBase64 && !input.contentBytes) throw new Error("Either text or contentBase64, or contentBytes is required")

  const buffer = input.contentBytes ?? Buffer.from(input.contentBase64 ?? "", "base64")
  const ext = path.extname(input.fileName).slice(1).toLowerCase() || undefined
  const mimeType = input.mimeType?.toLowerCase() ?? ""

  if (mimeType.includes("textract") || input.fileName.endsWith(".textract.json")) {
    return limitDocument(parseTextractJson(buffer.toString("utf-8")))
  }

  if (mimeType.includes("pdf") || ext === "pdf") {
    return limitDocument(await extractPdfDocument(input, buffer))
  }

  if (mimeType.includes("wordprocessingml") || ext === "docx") {
    return limitDocument(await extractDocxDocument(buffer, input.docxConverter))
  }

  if (isSupportedPlainTextUpload(ext, mimeType)) {
    return limitDocument(textDocument(buffer.toString("utf-8"), "utf8-v1"))
  }

  return limitDocument(unsupportedFormatDocument(buffer.length, ext, mimeType))
}

async function extractDocxDocument(buffer: Buffer, suppliedConverter?: MammothDocumentConverter): Promise<ExtractedDocument> {
  const mammoth = suppliedConverter ?? await loadMammothConverter()
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
  const htmlWarnings = mammothMessagesToExtractionWarnings(html.messages ?? [])
  const blocks = docxHtmlToStructuredBlocks(html.value, "docx-mammoth-html-v2")
  if (blocks.length > 0) {
    return {
      text: blocks.map((block) => block.text).join("\n\n"),
      blocks,
      sourceExtractorVersion: "docx-mammoth-html-v2",
      warnings: htmlWarnings,
      counters: { docxConversionMessageCount: htmlWarnings.length },
      extractionStatus: htmlWarnings.length > 0 ? "partial" : "complete"
    }
  }

  const parsed = await mammoth.extractRawText({ buffer })
  const warnings = [
    ...htmlWarnings,
    ...mammothMessagesToExtractionWarnings(parsed.messages ?? [])
  ]
  return textDocument(parsed.value, "docx-mammoth-raw-v1", {
    warnings,
    counters: { docxConversionMessageCount: warnings.length },
    extractionStatus: warnings.length > 0 ? "partial" : "complete"
  })
}

async function loadMammothConverter(): Promise<MammothDocumentConverter> {
  const mammothModule = await import("mammoth")
  return (mammothModule.default ?? mammothModule) as MammothDocumentConverter
}

function mammothMessagesToExtractionWarnings(messages: MammothConversionMessage[]): ExtractionWarning[] {
  return messages.map((entry) => ({
    code: entry.type === "error" ? "docx_conversion_error" : "docx_conversion_warning",
    message: `DOCX conversion reported possible content loss: ${entry.message || "unspecified conversion issue"}`,
    severity: "error"
  }))
}

function isSupportedPlainTextUpload(extension: string | undefined, mimeType: string): boolean {
  const supportedExtensions = new Set(["txt", "md", "markdown"])
  const supportedMimeTypes = new Set(["text/plain", "text/markdown", "text/x-markdown"])
  const canonicalMimeType = mimeType.split(";", 1)[0]?.trim() ?? ""
  if (extension && !supportedExtensions.has(extension)) return false
  if (canonicalMimeType && !supportedMimeTypes.has(canonicalMimeType)) return false
  return Boolean((extension && supportedExtensions.has(extension)) || supportedMimeTypes.has(canonicalMimeType))
}

function unsupportedFormatDocument(byteCount: number, extension: string | undefined, mimeType: string): ExtractedDocument {
  const format = extension ? `.${extension}` : mimeType || "unknown"
  return textDocument(
    "Unsupported document format; content extraction was not attempted.",
    "unsupported-format-v1",
    {
      warnings: [{
        code: "unsupported_document_format",
        message: `Document format ${format} is not supported for lossless text extraction.`,
        severity: "error"
      }],
      counters: { unsupportedInputBytes: byteCount },
      extractionStatus: "partial"
    }
  )
}

async function extractPdfText(buffer: Buffer, enforceObservedFallbackGuards = false): Promise<NativePdfExtraction> {
  logPdfExtractStage({ stage: "pdf-parse", phase: "start", fileSizeBytes: buffer.length })
  let parsedText = ""
  let parsedPageCount: number | undefined
  const warnings: ExtractionWarning[] = []
  try {
    const pdfParse = (await import("pdf-parse")).default
    const parsed = await pdfParse(buffer, { pagerender: renderPdfPageWithBoundary })
    parsedText = parsed.text ?? ""
    parsedPageCount = parsed.numpages
  } catch (error) {
    const degradationDecision = safeDegradationDecision({
      trigger: classifyDegradationTrigger(error),
      stage: "pdf_parse",
      requestedAction: "limited_answer",
      guardOutcomes: measurePartialRuntimeRagGuards({ trace_redaction: { passed: true, evidence: "fallback_error_is_redacted" } })
    })
    warnings.push({
      code: "pdf_parser_fallback",
      message: "Primary PDF parser failed; the guarded pdftotext fallback was selected.",
      severity: "warning",
      degradationDecision
    })
    console.warn(JSON.stringify({
      event: "document_extract_fallback",
      failedStage: "pdf-parse",
      fallbackStage: "pdftotext",
      fileSizeBytes: buffer.length,
      error: errorMessage(error)
    }))
    if (enforceObservedFallbackGuards && degradationDecision.action === "fail") throw error
  }
  logPdfExtractStage({ stage: "pdf-parse", phase: "end", fileSizeBytes: buffer.length, textLength: parsedText.length })
  logPdfExtractStage({ stage: "pdftotext", phase: "start", fileSizeBytes: buffer.length })
  const pdftotextText = await extractWithPdftotext(buffer)
  logPdfExtractStage({ stage: "pdftotext", phase: "end", fileSizeBytes: buffer.length, textLength: pdftotextText?.length ?? 0 })

  return analyzeNativePdfExtraction(
    selectNativePdfText(parsedText, pdftotextText),
    parsedPageCount,
    warnings
  )
}

async function renderPdfPageWithBoundary(pageData: PdfParsePageData): Promise<string> {
  const content = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false
  })
  let lastY: number | undefined
  let text = ""
  for (const item of content.items) {
    const value = item.str ?? ""
    const y = item.transform?.[5]
    if (text && (item.hasEOL || (lastY !== undefined && y !== undefined && y !== lastY))) text += "\n"
    text += value
    lastY = y
  }
  return `${text}\f`
}

function analyzeNativePdfExtraction(
  text: string,
  expectedPageCount?: number,
  warnings: ExtractionWarning[] = []
): NativePdfExtraction {
  const pageSegments = text.split(/\f/u)
  if (pageSegments.at(-1)?.trim() === "" && pageSegments.length > Math.max(1, expectedPageCount ?? 0)) pageSegments.pop()
  const pageCount = Math.max(expectedPageCount ?? 0, pageSegments.length)
  const emptyPageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .filter((pageNumber) => !(pageSegments[pageNumber - 1] ?? "").trim())
  return { text, pageCount: pageCount || undefined, emptyPageNumbers, warnings }
}

export function selectNativePdfText(parsedText: string, pdftotextText: string | undefined): string {
  if (!pdftotextText) return parsedText
  const layoutScore = pdfTextQualityScore(pdftotextText)
  if (layoutScore > 0 && /\f/u.test(pdftotextText)) return pdftotextText
  return layoutScore >= pdfTextQualityScore(parsedText) ? pdftotextText : parsedText
}

async function extractPdfDocument(input: UploadLike, buffer: Buffer): Promise<ExtractedDocument> {
  logPdfExtractStage({ stage: "pdf-extract", phase: "start", fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: buffer.length })
  const native = input.pdfTextExtractor
    ? analyzeNativePdfExtraction(await input.pdfTextExtractor(buffer))
    : await extractPdfText(buffer, input.enforceObservedFallbackGuards)
  const extractedText = native.text
  logPdfExtractStage({ stage: "pdf-extract", phase: "end", fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: buffer.length, textLength: extractedText.length })
  if (pdfTextQualityScore(extractedText) > 0) {
    const missingPageWarnings: ExtractionWarning[] = native.emptyPageNumbers.map((page) => ({
      code: "pdf_native_page_text_missing",
      message: "PDF page had no usable native text; publication requires OCR or explicit review.",
      severity: "error",
      page,
      pageStart: page,
      pageEnd: page
    }))
    return nativePdfDocument(extractedText, {
      fileProfile: profilePdfText(extractedText),
      warnings: [...native.warnings, ...missingPageWarnings],
      counters: {
        pdfNativeTextChars: extractedText.length,
        pdfNativePageCount: native.pageCount ?? 0,
        pdfNativeEmptyPageCount: native.emptyPageNumbers.length,
        ocrFallbackUsed: 0
      },
      extractionStatus: missingPageWarnings.length > 0 ? "partial" : "complete"
    })
  }

  const ocrDetector = input.ocrDetector ?? detectTextWithTextract
  const ocrFallbackWarning: ExtractionWarning = {
    code: "pdf_ocr_fallback",
    message: "Native PDF text was unusable; the guarded OCR fallback was selected.",
    severity: "warning",
    degradationDecision: safeDegradationDecision({
      trigger: "dependency_error",
      stage: "pdf_ocr_fallback",
      requestedAction: "limited_answer",
      guardOutcomes: measurePartialRuntimeRagGuards({ trace_redaction: { passed: true, evidence: "fallback_warning_is_redacted" } })
    })
  }
  if (input.enforceObservedFallbackGuards && ocrFallbackWarning.degradationDecision?.action === "fail") {
    throw new Error("OCR fallback blocked because mandatory guard outcomes were not observed")
  }
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
    const expectedPageCount = Math.max(
      native.pageCount ?? 0,
      ocrDocument.counters?.textractExpectedPageCount ?? 0
    )
    const observedPageNumbers = observedTextPageNumbers(ocrDocument)
    const missingPageNumbers = Array.from({ length: expectedPageCount }, (_, index) => index + 1)
      .filter((page) => !observedPageNumbers.has(page))
    const warnings = [
      ...native.warnings,
      ocrFallbackWarning,
      ...(ocrDocument.warnings ?? []),
      ...lowConfidenceWarnings(ocrDocument),
      ...missingPageNumbers.map((page): ExtractionWarning => ({
        code: "pdf_ocr_page_text_missing",
        message: "PDF page had no usable OCR text; publication requires explicit review.",
        severity: "error",
        page,
        pageStart: page,
        pageEnd: page
      }))
    ]
    return withParsedDocument({
      ...ocrDocument,
      warnings,
      fileProfile: ocrDocument.fileProfile ?? "scanned_image",
      counters: {
        ...(ocrDocument.counters ?? {}),
        pdfNativeTextChars: extractedText.length,
        pdfNativePageCount: native.pageCount ?? 0,
        pdfExpectedPageCount: expectedPageCount,
        pdfOcrObservedPageCount: observedPageNumbers.size,
        pdfOcrMissingPageCount: missingPageNumbers.length,
        ocrFallbackUsed: 1
      },
      extractionStatus: ocrDocument.extractionStatus === "partial" || warnings.some((warning) => warning.severity === "error")
        ? "partial"
        : "complete"
    })
  }
  return nativePdfDocument(extractedText, {
    fileProfile: "image_only",
    warnings: [
      ...native.warnings,
      ocrFallbackWarning,
      {
        code: "pdf_ocr_unavailable",
        message: "PDF native text was empty and OCR fallback did not return text.",
        severity: "error"
      }
    ],
    counters: {
      pdfNativeTextChars: extractedText.length,
      pdfNativePageCount: native.pageCount ?? 0,
      pdfExpectedPageCount: native.pageCount ?? 0,
      pdfOcrObservedPageCount: 0,
      pdfOcrMissingPageCount: native.pageCount ?? 0,
      ocrFallbackUsed: 0
    },
    extractionStatus: "partial"
  })
}

function observedTextPageNumbers(document: ExtractedDocument): Set<number> {
  const observed = new Set<number>()
  for (const block of document.blocks ?? []) {
    if (!normalizeText(block.text)) continue
    const pageStart = block.pageStart ?? block.sourceLocation?.pageStart ?? block.sourceLocation?.page
    const pageEnd = block.pageEnd ?? block.sourceLocation?.pageEnd ?? pageStart
    if (!pageStart || pageStart < 1) continue
    for (let page = pageStart; page <= Math.max(pageStart, pageEnd ?? pageStart); page += 1) observed.add(page)
  }
  for (const page of document.parsedDocument?.pages ?? []) {
    if (page.pageNumber > 0 && normalizeText(page.text ?? "")) observed.add(page.pageNumber)
  }
  return observed
}

function nativePdfDocument(
  text: string,
  options: Pick<ExtractedDocument, "warnings" | "counters" | "fileProfile" | "extractionStatus">
): ExtractedDocument {
  const normalized = normalizeText(text)
  return {
    text: normalized,
    blocks: nativePdfTextToStructuredBlocks(normalized, "pdf-layout-v3"),
    sourceExtractorVersion: "pdf-layout-v3",
    ...options
  }
}

export function nativePdfTextToStructuredBlocks(text: string, extractionMethod: string): StructuredBlock[] {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const rawPages = normalized.split(/\f+/)
  const blocks: StructuredBlock[] = []
  let currentSectionPath: string[] | undefined
  let sourceCursor = 0

  rawPages.forEach((rawPage, pageIndex) => {
    const pageNumber = pageIndex + 1
    const pageText = rawPage.trim()
    const pageLeadingOffset = pageText ? rawPage.indexOf(pageText) : 0
    const pageStartOffset = sourceCursor + Math.max(0, pageLeadingOffset)
    let pageCursor = 0
    const rawParagraphs = pageText.split(/\n\s*\n+/).flatMap(splitNativePdfParagraph)
    for (const paragraph of rawParagraphs) {
      const relativeOffset = pageText.indexOf(paragraph, pageCursor)
      if (relativeOffset < 0) continue
      const startChar = pageStartOffset + relativeOffset
      const endChar = startChar + paragraph.length
      const sourceBlockId = `native-pdf-page-${pageNumber}-block-${blocks.length + 1}`
      const heading = headingFromLine(paragraph)
      if (heading) currentSectionPath = [heading]
      blocks.push({
        id: sourceBlockId,
        kind: guessLineKind(paragraph),
        text: paragraph,
        pageStart: pageNumber,
        pageEnd: pageNumber,
        heading,
        sectionPath: currentSectionPath,
        sourceBlockId,
        normalizedFrom: "pdf-native-layout",
        readingOrder: blocks.length,
        extractionMethod,
        sourceLocation: {
          source: "pdf-native",
          page: pageNumber,
          pageStart: pageNumber,
          pageEnd: pageNumber,
          sectionPath: currentSectionPath,
          startChar,
          endChar,
          sourceBlockId
        }
      })
      pageCursor = relativeOffset + paragraph.length
    }
    sourceCursor += rawPage.length
    const separatorLength = normalized.slice(sourceCursor).match(/^\f+/)?.[0].length ?? 0
    sourceCursor += separatorLength
  })
  return blocks
}

function splitNativePdfParagraph(rawParagraph: string): string[] {
  const lines = rawParagraph.split(/\n+/u).map((line) => line.trim()).filter(Boolean)
  if (lines.length <= 1) return lines
  const paragraphs: string[] = []
  let bodyLines: string[] = []
  const flushBody = () => {
    if (bodyLines.length === 0) return
    paragraphs.push(bodyLines.join("\n"))
    bodyLines = []
  }
  for (const line of lines) {
    if (headingFromLine(line)) {
      flushBody()
      paragraphs.push(line)
      continue
    }
    bodyLines.push(line)
  }
  flushBody()
  return paragraphs
}

async function detectTextWithTextract(input: {
  fileName: string
  mimeType?: string
  bytes: Buffer
  sourceS3Object?: SourceS3Object
}): Promise<ExtractedDocument | undefined> {
  if (!config.pdfOcrFallbackEnabled) return undefined

  try {
    const result = input.sourceS3Object
      ? await detectTextWithTextractAsync(input.sourceS3Object)
      : await detectTextWithTextractSync(input.bytes)
    if (
      result.blocks.length === 0
      && result.jobStatus === "SUCCEEDED"
      && result.warnings.length === 0
      && !result.expectedPageCount
    ) return undefined
    return textractDetectionDocument(result, "textract-detect-document-text-v1")
  } catch (error) {
    throw new Error(`PDF OCR fallback failed for ${input.fileName}: ${errorMessage(error)}`, { cause: error })
  }
}

async function detectTextWithTextractSync(bytes: Buffer): Promise<TextractDetectionResult> {
  if (bytes.length > config.pdfOcrFallbackSyncMaxBytes) {
    return { blocks: [], jobStatus: "SUCCEEDED", warnings: [] }
  }
  const client = new TextractClient({ region: config.region })
  const response = await client.send(new DetectDocumentTextCommand({ Document: { Bytes: new Uint8Array(bytes) } }))
  return {
    blocks: normalizeTextractBlocks(response.Blocks ?? []),
    jobStatus: "SUCCEEDED",
    warnings: [],
    expectedPageCount: response.DocumentMetadata?.Pages
  }
}

async function detectTextWithTextractAsync(source: SourceS3Object): Promise<TextractDetectionResult> {
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

  const responses = [firstPage]
  let nextToken = firstPage.NextToken
  while (nextToken) {
    const response = await client.send(new GetDocumentTextDetectionCommand({ JobId: start.JobId, NextToken: nextToken }))
    responses.push(response)
    nextToken = response.NextToken
  }
  return aggregateTextractDetectionResponses(responses)
}

export function aggregateTextractDetectionResponses(
  responses: Array<Pick<
  GetDocumentTextDetectionCommandOutput,
  "Blocks" | "DocumentMetadata" | "JobStatus" | "StatusMessage" | "Warnings"
  >>
): TextractDetectionResult {
  const expectedPageCount = Math.max(0, ...responses.map((response) => response.DocumentMetadata?.Pages ?? 0))
  return {
    blocks: responses.flatMap((response) => normalizeTextractBlocks(response.Blocks ?? [])),
    jobStatus: responses.some((response) => response.JobStatus === "PARTIAL_SUCCESS")
      ? "PARTIAL_SUCCESS"
      : "SUCCEEDED",
    statusMessage: responses.find((response) => response.StatusMessage)?.StatusMessage,
    warnings: responses.flatMap((response) => (response.Warnings ?? []).map((warning) => ({
      ErrorCode: warning.ErrorCode,
      Pages: warning.Pages
    }))),
    expectedPageCount: expectedPageCount || undefined
  }
}

export function textractDetectionDocument(
  result: TextractDetectionResult,
  sourceExtractorVersion = "textract-detect-document-text-v1"
): ExtractedDocument {
  const document = parseTextractBlocks(result.blocks, sourceExtractorVersion)
  const observedPageNumbers = observedTextPageNumbers(document)
  const missingPageNumbers = Array.from({ length: result.expectedPageCount ?? 0 }, (_, index) => index + 1)
    .filter((page) => !observedPageNumbers.has(page))
  const serviceWarnings = result.warnings.flatMap((warning): ExtractionWarning[] => {
    const pages = warning.Pages?.filter((page) => page > 0) ?? []
    const message = `Textract reported possible page loss (${warning.ErrorCode || "unspecified warning"}).`
    if (pages.length === 0) return [{ code: "textract_service_warning", message, severity: "error" }]
    return pages.map((page) => ({
      code: "textract_service_warning",
      message,
      severity: "error",
      page,
      pageStart: page,
      pageEnd: page
    }))
  })
  const warnings: ExtractionWarning[] = [
    ...(document.warnings ?? []),
    ...(result.jobStatus === "PARTIAL_SUCCESS" ? [{
      code: "textract_partial_success",
      message: result.statusMessage
        ? `Textract completed with partial success: ${result.statusMessage}`
        : "Textract completed with partial success; publication requires explicit review.",
      severity: "error" as const
    }] : []),
    ...serviceWarnings,
    ...missingPageNumbers.map((page): ExtractionWarning => ({
      code: "textract_page_text_missing",
      message: "Textract returned no usable text for an expected document page.",
      severity: "error",
      page,
      pageStart: page,
      pageEnd: page
    }))
  ]
  return withParsedDocument({
    ...document,
    warnings,
    counters: {
      ...(document.counters ?? {}),
      textractExpectedPageCount: result.expectedPageCount ?? 0,
      textractObservedPageCount: observedPageNumbers.size,
      textractMissingPageCount: missingPageNumbers.length,
      textractServiceWarningCount: result.warnings.length,
      textractPartialSuccess: result.jobStatus === "PARTIAL_SUCCESS" ? 1 : 0
    },
    extractionStatus: warnings.some((warning) => warning.severity === "error") ? "partial" : "complete"
  })
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
  const payload = JSON.parse(jsonText) as {
    Blocks?: TextractBlock[]
    blocks?: TextractBlock[]
    DocumentMetadata?: { Pages?: number }
    JobStatus?: "SUCCEEDED" | "PARTIAL_SUCCESS"
    StatusMessage?: string
    Warnings?: TextractServiceWarning[]
  }
  return textractDetectionDocument({
    blocks: payload.Blocks ?? payload.blocks ?? [],
    jobStatus: payload.JobStatus ?? "SUCCEEDED",
    statusMessage: payload.StatusMessage,
    warnings: payload.Warnings ?? [],
    expectedPageCount: payload.DocumentMetadata?.Pages
  }, "textract-json-v1")
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

export function docxHtmlToStructuredBlocks(html: string, extractionMethod: string): StructuredBlock[] {
  const blocks: StructuredBlock[] = []
  const sectionHeadings: string[] = []
  let cursor = 0
  const pattern = /<(h[1-6]|p|li|pre|table|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    const tag = (match[1] ?? "").toLowerCase()
    const inner = match[2] ?? ""
    const plain = decodeHtml(stripTags(inner)).trim()
    if (!plain && tag !== "table") continue
    const id = `html-${blocks.length}`
    let block: StructuredBlock
    if (tag.startsWith("h")) {
      const level = Number(tag.slice(1))
      sectionHeadings.length = Math.max(0, level - 1)
      sectionHeadings[level - 1] = plain
      block = { id, kind: "text", text: plain, heading: plain, normalizedFrom: "docx-heading", extractionMethod }
    } else if (tag === "li") {
      block = { id, kind: "list", text: `- ${plain}`, listDepth: 1, normalizedFrom: "docx-list", extractionMethod }
    } else if (tag === "pre") {
      block = { id, kind: "code", text: `\`\`\`\n${plain}\n\`\`\``, normalizedFrom: "docx-code", extractionMethod }
    } else if (tag === "table") {
      block = { id, kind: "table", text: htmlTableToMarkdown(inner), normalizedFrom: "docx-table", extractionMethod }
    } else if (tag === "figcaption") {
      block = { id, kind: "figure", text: `Figure: ${plain}`, figureCaption: plain, normalizedFrom: "docx-figure", extractionMethod }
    } else {
      block = { id, kind: "text", text: plain, normalizedFrom: "docx-paragraph", extractionMethod }
    }
    const sectionPath = sectionHeadings.filter(Boolean)
    const startChar = cursor
    const endChar = startChar + block.text.length
    blocks.push({
      ...block,
      sectionPath,
      sourceBlockId: id,
      readingOrder: blocks.length,
      sourceLocation: {
        source: "docx",
        sectionPath,
        startChar,
        endChar,
        sourceBlockId: id
      }
    })
    cursor = endChar + 2
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
      previous.sourceLocation = previous.sourceLocation && block.sourceLocation
        ? { ...previous.sourceLocation, endChar: block.sourceLocation.endChar }
        : previous.sourceLocation
      continue
    }
    merged.push({ ...block })
  }
  return merged
}

function textDocument(
  text: string,
  sourceExtractorVersion: string,
  options: Pick<ExtractedDocument, "warnings" | "counters" | "fileProfile" | "extractionStatus"> = {}
): ExtractedDocument {
  return withParsedDocument({ text, sourceExtractorVersion, ...options })
}

export function limitDocument(document: ExtractedDocument): ExtractedDocument {
  const fullText = normalizeText(document.text)
  const normalized = fullText.slice(0, config.maxUploadChars)
  const truncated = fullText.length > normalized.length
  const truncationLocation = truncated ? truncationImpact(document.blocks, normalized.length) : undefined
  const warnings: ExtractionWarning[] = [
    ...(document.warnings ?? []),
    ...(truncated ? [{
      code: "extraction_content_truncated",
      message: `Extraction output exceeded ${config.maxUploadChars} characters and is not eligible for publication.`,
      severity: "error" as const,
      startChar: normalized.length,
      endChar: fullText.length,
      ...truncationLocation
    }] : [])
  ]
  const partial = truncated
    || document.extractionStatus === "partial"
    || warnings.some((warning) => warning.severity === "error")
  const extractionMetadata = {
    extractionStatus: partial ? "partial" as const : "complete" as const,
    inputCharCount: fullText.length,
    outputCharCount: normalized.length,
    contentHash: createHash("sha256").update(fullText).digest("hex"),
    warnings,
    counters: {
      ...(document.counters ?? {}),
      extractionInputChars: fullText.length,
      extractionOutputChars: normalized.length,
      extractionTruncatedChars: Math.max(0, fullText.length - normalized.length)
    }
  }
  if (!document.blocks) return withParsedDocument({ ...document, ...extractionMetadata, text: normalized })
  let total = 0
  const blocks: StructuredBlock[] = []
  for (const block of document.blocks) {
    if (total >= config.maxUploadChars) break
    const remaining = config.maxUploadChars - total
    const text = normalizeText(block.text).slice(0, remaining)
    if (!text) continue
    blocks.push({
      ...block,
      text,
      sourceLocation: block.sourceLocation
        ? {
            ...block.sourceLocation,
            endChar: block.sourceLocation.startChar === undefined
              ? block.sourceLocation.endChar
              : block.sourceLocation.startChar + text.length
          }
        : undefined
    })
    total += text.length
    if (total < config.maxUploadChars) total += Math.min(2, config.maxUploadChars - total)
  }
  return withParsedDocument({ ...document, ...extractionMetadata, text: normalized, blocks })
}

function truncationImpact(
  blocks: StructuredBlock[] | undefined,
  cutoff: number
): Pick<ExtractionWarning, "page" | "pageStart" | "pageEnd" | "sectionPath" | "sourceBlockId"> | undefined {
  if (!blocks?.length) return undefined
  let inferredOffset = 0
  let impacted = blocks.at(-1)
  for (const block of blocks) {
    const blockEnd = block.sourceLocation?.endChar
      ?? inferredOffset + normalizeText(block.text).length
    if (blockEnd > cutoff) {
      impacted = block
      break
    }
    inferredOffset = blockEnd + 2
  }
  if (!impacted) return undefined
  return {
    page: impacted.pageStart,
    pageStart: impacted.pageStart ?? impacted.sourceLocation?.pageStart ?? impacted.sourceLocation?.page,
    pageEnd: impacted.pageEnd ?? impacted.sourceLocation?.pageEnd ?? impacted.sourceLocation?.page,
    sectionPath: impacted.sectionPath ?? impacted.sourceLocation?.sectionPath,
    sourceBlockId: impacted.sourceBlockId ?? impacted.sourceLocation?.sourceBlockId
  }
}

function normalizeText(text: string): string {
  return text.split("\u0000").join("").trim()
}

function pdfTextQualityScore(text: string): number {
  const normalized = text.replace(/\s+/g, "")
  if (!normalized) return 0

  const japaneseChars = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)?.length ?? 0
  const latinChars = normalized.match(/[A-Za-z]/g)?.length ?? 0
  const dotLeaders = text.match(/\. \. \./g)?.length ?? 0
  return normalized.length + japaneseChars * 2 + latinChars * 0.25 - dotLeaders * 80
}

export type TextractBlock = {
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
    pages: pagesFromBlocks(
      document.text,
      blocks,
      document.fileProfile,
      expectedPageCountFromCounters(document.counters),
      document.warnings
    ),
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
    counters: document.counters,
    extractionStatus: document.extractionStatus,
    inputCharCount: document.inputCharCount,
    outputCharCount: document.outputCharCount,
    contentHash: document.contentHash
  }
  return { ...document, parsedDocument }
}

function pagesFromBlocks(
  text: string,
  blocks: StructuredBlock[],
  fileProfile?: PdfFileProfile,
  expectedPageCount = 0,
  warnings: ExtractionWarning[] = []
) {
  const pages = new Map<number, StructuredBlock[]>()
  const rawTextPages = blocks.length === 0 ? text.split(/\f/u) : []
  if (blocks.length === 0) {
    rawTextPages.forEach((_, index) => pages.set(index + 1, []))
  } else {
    for (const block of blocks) {
      const page = block.pageStart ?? 1
      pages.set(page, [...(pages.get(page) ?? []), block])
    }
  }
  for (let page = 1; page <= expectedPageCount; page += 1) {
    if (!pages.has(page)) pages.set(page, [])
  }
  return [...pages.entries()].sort(([a], [b]) => a - b).map(([pageNumber, pageBlocks]) => ({
    pageNumber,
    text: blocks.length === 0
      ? (rawTextPages[pageNumber - 1] ?? "").trim()
      : pageBlocks.map((block) => block.text).join("\n\n"),
    fileProfile,
    confidence: averageConfidence(pageBlocks.map((block) => block.confidence)),
    warnings: warnings.filter((warning) => warningAppliesToPage(warning, pageNumber))
  }))
}

function expectedPageCountFromCounters(counters: Record<string, number> | undefined): number {
  return Math.max(
    counters?.pdfNativePageCount ?? 0,
    counters?.pdfExpectedPageCount ?? 0,
    counters?.textractExpectedPageCount ?? 0
  )
}

function warningAppliesToPage(warning: ExtractionWarning, page: number): boolean {
  if (warning.page === page) return true
  if (warning.pageStart === undefined) return false
  return page >= warning.pageStart && page <= (warning.pageEnd ?? warning.pageStart)
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
  if (!bbox && !block.Page && !block.Id) return undefined
  return {
    page: block.Page,
    pageStart: block.Page,
    pageEnd: block.Page,
    bbox,
    unit: bbox ? "normalized_page" as const : undefined,
    source: "textract",
    sourceBlockId: block.Id
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
