import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

type MmLongBenchRow = {
  doc_id: string
  doc_type: string
  question: string
  answer: string
  evidence_pages: string
  evidence_sources: string
  answer_format: string
}

type DatasetServerRowsResponse = {
  rows?: Array<{
    row_idx: number
    row: Partial<MmLongBenchRow>
  }>
  num_rows_total?: number
}

type MmragDocqaDatasetRow = {
  id: string
  question: string
  answerable: boolean
  expectedResponseType: "answer" | "refusal"
  referenceAnswer?: string
  expectedAnswer?: string
  expectedContains?: string[]
  expectedFiles: string[]
  expectedPages: number[]
  expectedFactSlots: Array<{
    id: string
    description?: string
    mustContain?: string | string[]
    expectedFiles?: string[]
  }>
  topK: 20
  memoryTopK: 6
  minScore: 0.15
  useMemory: boolean
  metadata: {
    sourceDataset: "yubo2333/MMLongBench-Doc"
    sourceSplit: "train"
    sourceRowIndex: number
    docId: string
    docType: string
    evidenceSources: string[]
    answerFormat: string
  }
}

const datasetName = "yubo2333/MMLongBench-Doc"
const defaultConfig = "default"
const defaultSplit = "train"
const datasetRowsUrl = "https://datasets-server.huggingface.co/rows"
const documentBaseUrl = "https://huggingface.co/datasets/yubo2333/MMLongBench-Doc/resolve/main/documents"
const expectedFullQuestionCount = 1091
const pageLength = 100
const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")

if (isMainModule()) {
  await prepareMmragDocqaBenchmark(process.env)
}

export async function prepareMmragDocqaBenchmark(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): Promise<void> {
  const datasetOutput = resolveOutput(env.MMRAG_DOCQA_DATASET_OUTPUT ?? ".local-data/mmrag-docqa-v1/dataset.jsonl")
  const corpusDir = resolveOutput(env.MMRAG_DOCQA_CORPUS_DIR ?? ".local-data/mmrag-docqa-v1/corpus")
  const expectedRows = positiveInt(env.MMRAG_DOCQA_EXPECTED_TOTAL) ?? expectedFullQuestionCount
  const allowRowCountDrift = env.MMRAG_DOCQA_ALLOW_ROW_COUNT_DRIFT === "1"
  const useMemory = env.MMRAG_DOCQA_USE_MEMORY === "1"

  const sourceRows = await fetchAllRows(fetchImpl)
  if (!allowRowCountDrift && sourceRows.length !== expectedRows) {
    throw new Error(`Expected ${expectedRows} MMLongBench-Doc rows for mmrag-docqa-v1, got ${sourceRows.length}`)
  }

  const datasetRows = sourceRows.map((row, index) => convertMmLongBenchRow(row, index, { useMemory }))
  await mkdir(path.dirname(datasetOutput), { recursive: true })
  await writeJsonl(datasetOutput, datasetRows)
  console.log(`Wrote ${datasetRows.length} MMRAG-DocQA rows to ${datasetOutput}`)

  if (env.MMRAG_DOCQA_DOWNLOAD_DOCUMENTS === "0") return

  await downloadDocuments(
    [...new Set(datasetRows.flatMap((row) => row.expectedFiles))].sort(),
    corpusDir,
    {
      force: env.MMRAG_DOCQA_FORCE_DOWNLOAD === "1",
      fetchImpl
    }
  )
}

export function convertMmLongBenchRow(row: MmLongBenchRow, index: number, options: { useMemory?: boolean } = {}): MmragDocqaDatasetRow {
  const docId = safeDocumentFileName(required(row.doc_id, "doc_id"))
  const question = required(row.question, "question")
  const answer = required(row.answer, "answer")
  const evidencePages = parseNumberList(row.evidence_pages)
  const evidenceSources = parseStringList(row.evidence_sources)
  const answerFormat = row.answer_format?.trim() || "Unknown"
  const answerable = !isNotAnswerable(answer)
  const expectedContains = answerable ? expectedContainsForAnswer(answer, answerFormat) : []
  const expectedFactSlots = answerable
    ? [
        {
          id: "answer_core",
          description: "Reference answer from MMLongBench-Doc.",
          mustContain: expectedContains.length > 0 ? expectedContains : answer,
          expectedFiles: [docId]
        }
      ]
    : []

  return {
    id: `mmlongbench-doc-${String(index + 1).padStart(4, "0")}`,
    question,
    answerable,
    expectedResponseType: answerable ? "answer" : "refusal",
    ...(answerable
      ? {
          referenceAnswer: answer,
          expectedAnswer: answer,
          ...(expectedContains.length > 0 ? { expectedContains } : {})
        }
      : {}),
    expectedFiles: [docId],
    expectedPages: evidencePages,
    expectedFactSlots,
    topK: 20,
    memoryTopK: 6,
    minScore: 0.15,
    useMemory: options.useMemory ?? false,
    metadata: {
      sourceDataset: datasetName,
      sourceSplit: defaultSplit,
      sourceRowIndex: index,
      docId,
      docType: row.doc_type?.trim() ?? "",
      evidenceSources,
      answerFormat
    }
  }
}

async function fetchAllRows(fetchImpl: typeof fetch): Promise<MmLongBenchRow[]> {
  const firstPage = await fetchRowsPage(fetchImpl, 0)
  const total = firstPage.num_rows_total
  if (typeof total !== "number" || !Number.isInteger(total) || total <= 0) {
    throw new Error("Failed to determine MMLongBench-Doc total row count")
  }

  const rows = rowsFromResponse(firstPage)
  for (let offset = pageLength; offset < total; offset += pageLength) {
    rows.push(...rowsFromResponse(await fetchRowsPage(fetchImpl, offset)))
  }
  if (rows.length !== total) throw new Error(`Fetched ${rows.length} MMLongBench-Doc rows but dataset server reported ${total}`)
  return rows
}

async function fetchRowsPage(fetchImpl: typeof fetch, offset: number): Promise<DatasetServerRowsResponse> {
  const url = new URL(datasetRowsUrl)
  url.searchParams.set("dataset", datasetName)
  url.searchParams.set("config", defaultConfig)
  url.searchParams.set("split", defaultSplit)
  url.searchParams.set("offset", String(offset))
  url.searchParams.set("length", String(pageLength))

  const response = await fetchImpl(url)
  const text = await response.text()
  if (!response.ok) throw new Error(`Failed to fetch MMLongBench-Doc rows at offset ${offset}: HTTP ${response.status} ${text}`)
  return text ? (JSON.parse(text) as DatasetServerRowsResponse) : {}
}

function rowsFromResponse(response: DatasetServerRowsResponse): MmLongBenchRow[] {
  return (response.rows ?? []).map(({ row }) => ({
    doc_id: required(row.doc_id, "doc_id"),
    doc_type: row.doc_type ?? "",
    question: required(row.question, "question"),
    answer: required(row.answer, "answer"),
    evidence_pages: row.evidence_pages ?? "[]",
    evidence_sources: row.evidence_sources ?? "[]",
    answer_format: row.answer_format ?? ""
  }))
}

async function downloadDocuments(
  fileNames: string[],
  corpusDir: string,
  options: {
    force: boolean
    fetchImpl: typeof fetch
  }
): Promise<void> {
  await mkdir(corpusDir, { recursive: true })
  for (const fileName of fileNames) {
    const outputPath = path.join(corpusDir, fileName)
    if (!options.force && existsSync(outputPath)) {
      console.log(`MMRAG-DocQA document already exists: ${fileName}`)
      continue
    }

    const response = await options.fetchImpl(`${documentBaseUrl}/${encodeURIComponent(fileName)}`)
    if (!response.ok) throw new Error(`Failed to download MMRAG-DocQA document ${fileName}: HTTP ${response.status}`)
    const body = Buffer.from(await response.arrayBuffer())
    if (!isPdf(body)) throw new Error(`Downloaded MMRAG-DocQA document is not a PDF: ${fileName}`)
    await writeFile(outputPath, body)
    console.log(`Downloaded MMRAG-DocQA document: ${fileName}`)
  }
}

async function writeJsonl(filePath: string, rows: unknown[]): Promise<void> {
  await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")
}

function expectedContainsForAnswer(answer: string, answerFormat: string): string[] {
  const listItems = answerFormat === "List" ? parseStringList(answer) : []
  if (listItems.length > 0) return listItems
  return [answer]
}

function parseNumberList(value: string | undefined): number[] {
  return parseList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
}

function parseStringList(value: string | undefined): string[] {
  return parseList(value)
    .map((item) => String(item).trim())
    .filter(Boolean)
}

function parseList(value: string | undefined): unknown[] {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === "[]") return []
  try {
    const normalized = trimmed.replaceAll("'", "\"")
    const parsed = JSON.parse(normalized) as unknown
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return [trimmed]
  }
}

function isNotAnswerable(value: string): boolean {
  return value.trim().toLowerCase() === "not answerable"
}

function safeDocumentFileName(fileName: string): string {
  const baseName = path.basename(fileName)
  if (!baseName.toLowerCase().endsWith(".pdf")) throw new Error(`MMLongBench-Doc document is not a PDF: ${fileName}`)
  return baseName
}

function required(value: string | undefined, key: string): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new Error(`MMLongBench-Doc row is missing ${key}`)
  return trimmed
}

function resolveOutput(input: string): string {
  return path.resolve(repoRoot, input)
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function isPdf(body: Buffer): boolean {
  return body.length >= 4 && body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1]
  if (!entryPoint) return false
  return path.resolve(entryPoint) === fileURLToPath(import.meta.url)
}
