declare module "pdf-parse" {
  type PdfTextItem = { str?: string; transform?: number[]; hasEOL?: boolean }
  type PdfPageData = {
    getTextContent(options?: { normalizeWhitespace?: boolean; disableCombineTextItems?: boolean }): Promise<{ items: PdfTextItem[] }>
  }
  const pdfParse: (
    dataBuffer: Buffer | Uint8Array,
    options?: { pagerender?: (pageData: PdfPageData) => Promise<string>; max?: number; version?: string }
  ) => Promise<{ text: string; numpages: number; numrender: number }>
  export default pdfParse
}

declare module "mammoth" {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>
}
