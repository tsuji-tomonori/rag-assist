import { config } from "../config.js"

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
    const pdfParse = (await import("pdf-parse")).default
    const parsed = await pdfParse(buffer)
    return limit(parsed.text)
  }

  if (mimeType.includes("wordprocessingml") || ext === "docx") {
    const mammoth = await import("mammoth")
    const parsed = await mammoth.extractRawText({ buffer })
    return limit(parsed.value)
  }

  return limit(buffer.toString("utf-8"))
}

function limit(text: string): string {
  const normalized = text.replace(/\u0000/g, "").trim()
  if (normalized.length > config.maxUploadChars) {
    return normalized.slice(0, config.maxUploadChars)
  }
  return normalized
}
