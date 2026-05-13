declare module "pdf-parse" {
  const pdfParse: (dataBuffer: Buffer | Uint8Array) => Promise<{ text: string }>
  export default pdfParse
}

declare module "mammoth" {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>
}
