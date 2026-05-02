import { config } from "../config.js"
import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type UploadLike = {
  fileName: string
  text?: string
  contentBase64?: string
  mimeType?: string
}

export async function extractTextFromUpload(input: UploadLike): Promise<string> {
  if (input.text !== undefined) return limit(input.text)
  if (!input.contentBase64) throw new Error("Either text or contentBase64 is required")

  const buffer = Buffer.from(input.contentBase64, "base64")
  const ext = input.fileName.split(".").pop()?.toLowerCase()
  const mimeType = input.mimeType?.toLowerCase() ?? ""

  if (mimeType.includes("pdf") || ext === "pdf") {
    return limit(await extractPdfText(buffer))
  }

  if (mimeType.includes("wordprocessingml") || ext === "docx") {
    const mammoth = await import("mammoth")
    const parsed = await mammoth.extractRawText({ buffer })
    return limit(parsed.value)
  }

  return limit(buffer.toString("utf-8"))
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

function pdfTextQualityScore(text: string): number {
  const normalized = text.replace(/\s+/g, "")
  if (!normalized) return 0

  const japaneseChars = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)?.length ?? 0
  const latinChars = normalized.match(/[A-Za-z]/g)?.length ?? 0
  const dotLeaders = text.match(/\. \. \./g)?.length ?? 0
  return normalized.length + japaneseChars * 2 + latinChars * 0.25 - dotLeaders * 80
}

function limit(text: string): string {
  const normalized = text.split("\u0000").join("").trim()
  if (normalized.length > config.maxUploadChars) {
    return normalized.slice(0, config.maxUploadChars)
  }
  return normalized
}
