import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

type CsvRecord = Record<string, string>

type AllganizeDatasetRow = {
  id: string
  question: string
  answerable: true
  referenceAnswer: string
  expectedAnswer?: string
  expectedContains?: string[]
  expectedFiles: string[]
  expectedPages: number[]
  complexity: "simple" | "multi_hop" | "comparison"
  metadata: {
    sourceDataset: "allganize/RAG-Evaluation-Dataset-JA"
    domain: string
    type: string
    targetFileName: string
    targetPageNo: number
  }
}

const datasetCsvUrl = "https://huggingface.co/datasets/allganize/RAG-Evaluation-Dataset-JA/resolve/main/rag_evaluation_result.csv"
const documentsCsvUrl = "https://huggingface.co/datasets/allganize/RAG-Evaluation-Dataset-JA/resolve/main/documents.csv"
const documentUrlFallbacks = new Map<string, string[]>([
  [
    "https://www.mof.go.jp/policy/filp/publication/filp_report/zaito2022/FILP_Report2022.pdf",
    ["https://warp.ndl.go.jp/20260305/20260303041739/https://www.mof.go.jp/policy/filp/publication/filp_report/zaito2022/FILP_Report2022.pdf"]
  ],
  [
    "https://cio.go.jp/sites/default/files/uploads/documents/cloud_policy_20210910.pdf",
    ["https://warp.ndl.go.jp/20250903/20250901001159/https://cio.go.jp/sites/default/files/uploads/documents/cloud_policy_20210910.pdf"]
  ]
])
const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")

if (isMainModule()) {
  await prepareAllganizeJaBenchmark(process.env)
}

export async function prepareAllganizeJaBenchmark(env: NodeJS.ProcessEnv): Promise<void> {
  const datasetOutput = resolveOutput(env.ALLGANIZE_RAG_DATASET_OUTPUT ?? ".local-data/allganize-rag-evaluation-ja/dataset.jsonl")
  const corpusDir = resolveOutput(env.ALLGANIZE_RAG_CORPUS_DIR ?? ".local-data/allganize-rag-evaluation-ja/corpus")
  const datasetRows = convertAllganizeRows(
    parseCsv(await readText(env.ALLGANIZE_RAG_EVAL_CSV_PATH, env.ALLGANIZE_RAG_EVAL_CSV_URL ?? datasetCsvUrl)),
    {
      limit: positiveInt(env.ALLGANIZE_RAG_LIMIT),
      domain: env.ALLGANIZE_RAG_DOMAIN,
      expectedMode: env.ALLGANIZE_RAG_EXPECTED_MODE === "strict-contains" ? "strict-contains" : "reference"
    }
  )

  await mkdir(path.dirname(datasetOutput), { recursive: true })
  await writeJsonl(datasetOutput, datasetRows)
  console.log(`Wrote ${datasetRows.length} Allganize RAG-Evaluation-Dataset-JA rows to ${datasetOutput}`)

  if (env.ALLGANIZE_RAG_DOWNLOAD_DOCUMENTS === "0") return

  const documentRows = parseCsv(await readText(env.ALLGANIZE_RAG_DOCUMENTS_CSV_PATH, env.ALLGANIZE_RAG_DOCUMENTS_CSV_URL ?? documentsCsvUrl))
  const requiredFiles = new Set(datasetRows.flatMap((row) => row.expectedFiles))
  await downloadAllganizeDocuments(documentRows, corpusDir, {
    domain: env.ALLGANIZE_RAG_DOMAIN,
    limit: positiveInt(env.ALLGANIZE_RAG_DOCUMENT_LIMIT),
    force: env.ALLGANIZE_RAG_FORCE_DOWNLOAD === "1",
    requiredFiles: env.ALLGANIZE_RAG_DOWNLOAD_ALL_DOCUMENTS === "1" ? undefined : requiredFiles
  })
}

export function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\""
        index += 1
      } else if (char === "\"") {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === "\"") {
      quoted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n") {
      row.push(trimCarriageReturn(field))
      rows.push(row)
      row = []
      field = ""
    } else {
      field += char
    }
  }
  if (field || row.length > 0) {
    row.push(trimCarriageReturn(field))
    rows.push(row)
  }

  const headers = rows.shift()?.map((header) => header.trim()) ?? []
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
}

export function convertAllganizeRows(rows: CsvRecord[], options: {
  limit?: number
  domain?: string
  expectedMode?: "reference" | "strict-contains"
} = {}): AllganizeDatasetRow[] {
  const selected = rows.filter((row) => !options.domain || row.domain === options.domain)
  const limited = options.limit ? selected.slice(0, options.limit) : selected
  return limited.map((row, index) => {
    const targetAnswer = required(row, "target_answer")
    const targetFileName = required(row, "target_file_name")
    const targetPageNo = Number(required(row, "target_page_no"))
    const converted: AllganizeDatasetRow = {
      id: `allganize-ja-${String(index + 1).padStart(3, "0")}`,
      question: required(row, "question"),
      answerable: true,
      referenceAnswer: targetAnswer,
      expectedFiles: [targetFileName],
      expectedPages: Number.isFinite(targetPageNo) ? [targetPageNo] : [],
      complexity: complexityFromType(row.type),
      metadata: {
        sourceDataset: "allganize/RAG-Evaluation-Dataset-JA",
        domain: row.domain ?? "",
        type: row.type ?? "",
        targetFileName,
        targetPageNo
      }
    }
    if (options.expectedMode === "strict-contains") {
      converted.expectedAnswer = targetAnswer
      converted.expectedContains = [targetAnswer]
    }
    return converted
  })
}

async function downloadAllganizeDocuments(rows: CsvRecord[], corpusDir: string, options: {
  domain?: string
  limit?: number
  force: boolean
  requiredFiles?: Set<string>
}): Promise<void> {
  await mkdir(corpusDir, { recursive: true })
  const selected = rows.filter((row) =>
    (!options.domain || row.domain === options.domain)
      && (!options.requiredFiles || options.requiredFiles.has(row.file_name ?? ""))
  )
  const limited = options.limit ? selected.slice(0, options.limit) : selected
  for (const row of limited) {
    const fileName = safeBaseName(required(row, "file_name"))
    const outputPath = path.join(corpusDir, fileName)
    if (!options.force && existsSync(outputPath)) {
      console.log(`Allganize document already exists: ${fileName}`)
      continue
    }
    const sourceUrl = required(row, "url")
    const downloadedFrom = await downloadBinary(documentUrls(sourceUrl), outputPath, fileName)
    const fallbackNote = downloadedFrom === sourceUrl ? "" : ` (fallback URL: ${downloadedFrom})`
    console.log(`Downloaded Allganize document: ${fileName}${fallbackNote}`)
  }
}

async function readText(filePath: string | undefined, url: string): Promise<string> {
  if (filePath) return readFile(resolveExisting(filePath), "utf-8")
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  return response.text()
}

async function downloadBinary(urls: string[], outputPath: string, fileName: string): Promise<string> {
  const failures: string[] = []
  for (const url of urls) {
    const downloaded = await tryDownloadBinary(url, outputPath, failures)
    if (downloaded) return downloaded
  }

  for (const url of urls) {
    const archivedUrl = await resolveWarpLatestUrl(url, failures)
    if (!archivedUrl || urls.includes(archivedUrl)) continue
    const downloaded = await tryDownloadBinary(archivedUrl, outputPath, failures)
    if (downloaded) return downloaded
  }

  throw new Error(`Failed to download Allganize document ${fileName}. Tried ${failures.join("; ")}`)
}

async function tryDownloadBinary(url: string, outputPath: string, failures: string[]): Promise<string | undefined> {
  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    failures.push(`${url}: ${downloadErrorMessage(error)}`)
    return undefined
  }
  if (!response.ok) {
    failures.push(`${url}: HTTP ${response.status}`)
    return undefined
  }
  const body = Buffer.from(await response.arrayBuffer())
  if (!isPdf(body)) {
    failures.push(`${url}: non-PDF response`)
    return undefined
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, body)
  return url
}

async function writeJsonl(filePath: string, rows: unknown[]): Promise<void> {
  await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")
}

function complexityFromType(type: string | undefined): AllganizeDatasetRow["complexity"] {
  if (type === "table" || type === "image") return "comparison"
  return "simple"
}

function resolveOutput(input: string): string {
  return path.resolve(repoRoot, input)
}

function resolveExisting(input: string): string {
  const candidates = [process.cwd(), benchmarkDir, repoRoot].map((base) => path.resolve(base, input))
  return candidates.find((candidate) => existsSync(candidate)) ?? path.resolve(process.cwd(), input)
}

function required(row: CsvRecord, key: string): string {
  const value = row[key]?.trim()
  if (!value) throw new Error(`Allganize CSV row is missing ${key}`)
  return value
}

function safeBaseName(fileName: string): string {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._()-]/g, "_")
}

function documentUrls(url: string): string[] {
  return [url, ...(documentUrlFallbacks.get(url) ?? [])]
}

function downloadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = (error as Error & { cause?: unknown }).cause
  return cause instanceof Error ? `${error.message}: ${cause.message}` : error.message
}

async function resolveWarpLatestUrl(url: string, failures: string[]): Promise<string | undefined> {
  const lookupUrl = `https://warp.ndl.go.jp/web/latest/${url}`
  let response: Response
  try {
    response = await fetch(lookupUrl)
  } catch (error) {
    failures.push(`${lookupUrl}: ${downloadErrorMessage(error)}`)
    return undefined
  }
  if (!response.ok) {
    failures.push(`${lookupUrl}: HTTP ${response.status}`)
    return undefined
  }
  const html = await response.text()
  const match = html.match(/<iframe[^>]+src="(?<src>\/\d{8}\/\d{14}\/[^"]+)"/)
  const archivedPath = match?.groups?.src
  if (!archivedPath) {
    failures.push(`${lookupUrl}: WARP archive URL not found`)
    return undefined
  }
  return new URL(archivedPath.replaceAll("&amp;", "&"), "https://warp.ndl.go.jp").toString()
}

function isPdf(body: Buffer): boolean {
  return body.length >= 4 && body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function trimCarriageReturn(value: string): string {
  return value.endsWith("\r") ? value.slice(0, -1) : value
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1]
  if (!entryPoint) return false
  return path.resolve(entryPoint) === fileURLToPath(import.meta.url)
}
