import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

type CorpusDocument = {
  fileName: string
  urls: string[]
}

type OcrImagePage = {
  pageId: string
  url: string
}

type PrepareOptions = {
  datasetOutput: string
  corpusDir: string
  forceDownload: boolean
  downloadDocuments: boolean
  fetchImpl: typeof fetch
}

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const sourceDatasetPath = path.join(benchmarkDir, "dataset.jp-public-pdf-qa.jsonl")

const textCorpusDocuments: CorpusDocument[] = [
  {
    fileName: "001655176.pdf",
    urls: ["https://www.mhlw.go.jp/content/10808000/001655176.pdf"]
  },
  {
    fileName: "01zyokan_202603.pdf",
    urls: ["https://www.stat.go.jp/museum/toukei150/nenshi/pdf/01zyokan_202603.pdf"]
  }
]

const dInfraBaseUrl = "https://d-infra.ier.hit-u.ac.jp/Japanese/govstat-database/statistical-yb/1927/tab_jpeg"
const ocrCorpusFileName = "1927-statistical-yearbook-scan.pdf"
const ocrImagePages: OcrImagePage[] = [
  "020",
  "021",
  "022",
  "024",
  "025",
  "026",
  "027",
  "028",
  "029",
  "036",
  "037",
  "038",
  "039",
  "040",
  "041",
  "042",
  "043",
  "044",
  "055",
  "056",
  "057",
  "058",
  "059",
  "062",
  "063",
  "064"
].map((pageId) => ({
  pageId,
  url: `${dInfraBaseUrl}/1927_${pageId}.jpg`
}))

if (isMainModule()) {
  await prepareJpPublicPdfQaBenchmark(process.env)
}

export async function prepareJpPublicPdfQaBenchmark(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): Promise<void> {
  await prepareJpPublicPdfQaBenchmarkWithOptions({
    datasetOutput: resolveOutput(env.JP_PUBLIC_PDF_QA_DATASET_OUTPUT ?? ".local-data/jp-public-pdf-qa-v1/dataset.jsonl"),
    corpusDir: resolveOutput(env.JP_PUBLIC_PDF_QA_CORPUS_DIR ?? ".local-data/jp-public-pdf-qa-v1/corpus"),
    forceDownload: env.JP_PUBLIC_PDF_QA_FORCE_DOWNLOAD === "1",
    downloadDocuments: env.JP_PUBLIC_PDF_QA_DOWNLOAD_DOCUMENTS !== "0",
    fetchImpl
  })
}

export async function prepareJpPublicPdfQaBenchmarkWithOptions(options: PrepareOptions): Promise<void> {
  await mkdir(path.dirname(options.datasetOutput), { recursive: true })
  await writeFile(options.datasetOutput, await readFile(sourceDatasetPath))
  console.log(`Wrote JP public PDF QA dataset to ${options.datasetOutput}`)

  if (!options.downloadDocuments) return

  await mkdir(options.corpusDir, { recursive: true })
  for (const document of textCorpusDocuments) {
    await downloadPdf(document.urls, path.join(options.corpusDir, document.fileName), document.fileName, options)
  }
  await downloadOcrImagePdf(path.join(options.corpusDir, ocrCorpusFileName), options)
}

async function downloadPdf(urls: string[], outputPath: string, fileName: string, options: PrepareOptions): Promise<void> {
  if (!options.forceDownload && existsSync(outputPath)) {
    console.log(`JP public PDF QA corpus already exists: ${fileName}`)
    return
  }
  const body = await downloadFirstPdf(urls, fileName, options.fetchImpl)
  await writeFile(outputPath, body)
  console.log(`Downloaded JP public PDF QA corpus: ${fileName}`)
}

async function downloadOcrImagePdf(outputPath: string, options: PrepareOptions): Promise<void> {
  if (!options.forceDownload && existsSync(outputPath)) {
    console.log(`JP public PDF QA OCR corpus already exists: ${ocrCorpusFileName}`)
    return
  }

  const images: JpegImage[] = []
  for (const page of ocrImagePages) {
    const image = await downloadJpeg(page.url, `d-infra page ${page.pageId}`, options.fetchImpl)
    images.push(image)
  }
  await writeFile(outputPath, createPdfFromJpegs(images))
  console.log(`Created JP public PDF QA OCR corpus: ${ocrCorpusFileName} (${images.length} image pages)`)
}

async function downloadFirstPdf(urls: string[], fileName: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const failures: string[] = []
  for (const url of urls) {
    try {
      const body = await downloadBinary(url, fetchImpl)
      if (!isPdf(body)) {
        failures.push(`${url}: non-PDF response`)
        continue
      }
      return body
    } catch (error) {
      failures.push(`${url}: ${errorMessage(error)}`)
    }
  }
  throw new Error(`Failed to download JP public PDF QA document ${fileName}. Tried ${failures.join("; ")}`)
}

async function downloadJpeg(url: string, label: string, fetchImpl: typeof fetch): Promise<JpegImage> {
  const body = await downloadBinary(url, fetchImpl)
  if (!isJpeg(body)) throw new Error(`Failed to download ${label} from ${url}: non-JPEG response`)
  const size = jpegSize(body)
  return { body, width: size.width, height: size.height }
}

async function downloadBinary(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  let response: Response
  try {
    response = await fetchImpl(url)
  } catch (error) {
    throw new Error(errorMessage(error), { cause: error })
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`)
  return Buffer.from(await response.arrayBuffer())
}

type JpegImage = {
  body: Buffer
  width: number
  height: number
}

export function createPdfFromJpegs(images: JpegImage[]): Buffer {
  if (images.length === 0) throw new Error("Cannot create OCR PDF without image pages")

  const objects: Buffer[] = []
  const addObject = (content: string | Buffer): number => {
    objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content, "latin1"))
    return objects.length
  }

  const catalogObject = addObject("<< /Type /Catalog /Pages 2 0 R >>")
  const pagesObject = addObject("<< /Type /Pages /Count 0 /Kids [] >>")
  const pageObjects: number[] = []

  for (const image of images) {
    const imageObject = addObject(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.body.length} >>\nstream\n`, "latin1"),
      image.body,
      Buffer.from("\nendstream", "latin1")
    ]))
    const content = `q\n${image.width} 0 0 ${image.height} 0 0 cm\n/Im0 Do\nQ\n`
    const contentObject = addObject(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`)
    const pageObject = addObject(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${image.width} ${image.height}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`)
    pageObjects.push(pageObject)
  }

  objects[pagesObject - 1] = Buffer.from(`<< /Type /Pages /Count ${pageObjects.length} /Kids [${pageObjects.map((objectId) => `${objectId} 0 R`).join(" ")}] >>`, "latin1")
  if (catalogObject !== 1) throw new Error("Unexpected PDF object order")

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")]
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index]
    if (!object) throw new Error(`PDF object ${index + 1} was not created`)
    offsets.push(totalLength(chunks))
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "latin1"), object, Buffer.from("\nendobj\n", "latin1"))
  }
  const xrefOffset = totalLength(chunks)
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, "latin1"))
  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(Buffer.from(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`, "latin1"))
  }
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "latin1"))
  return Buffer.concat(chunks)
}

function jpegSize(body: Buffer): { width: number; height: number } {
  let offset = 2
  while (offset + 9 < body.length) {
    if (body[offset] !== 0xff) throw new Error("Invalid JPEG marker")
    const marker = body.readUInt8(offset + 1)
    const length = body.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: body.readUInt16BE(offset + 5),
        width: body.readUInt16BE(offset + 7)
      }
    }
    offset += 2 + length
  }
  throw new Error("JPEG size marker was not found")
}

function isPdf(body: Buffer): boolean {
  return body.subarray(0, 5).toString("ascii") === "%PDF-"
}

function isJpeg(body: Buffer): boolean {
  return body.length > 4 && body[0] === 0xff && body[1] === 0xd8 && body.at(-2) === 0xff && body.at(-1) === 0xd9
}

function totalLength(chunks: Buffer[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.length, 0)
}

function resolveOutput(input: string): string {
  return path.resolve(repoRoot, input)
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  return error.message
}

function isMainModule(): boolean {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
}
