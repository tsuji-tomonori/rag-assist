import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseCsv } from "./allganize-ja.js"

type SourceDocRow = {
  source_doc_id: string
  title_ja: string
  publisher: string
  source_url: string
  topic: string
  benchmark_use: string
  notes: string
}

type PreparedMlitPdfBenchmark = {
  datasetOutput: string
  corpusDir: string
  documents: Array<{
    sourceDocId: string
    fileName: string
    sourceUrl: string
    outputPath: string
    skipped: boolean
  }>
}

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const suiteDir = path.join(benchmarkDir, "datasets", "mlit-pdf-figure-table-rag-seed-v1")
const defaultDatasetSource = path.join(suiteDir, "qa.jsonl")
const defaultSourceDocsPath = path.join(suiteDir, "source_docs.csv")
const defaultDatasetOutput = ".local-data/mlit-pdf-figure-table-rag-seed-v1/dataset.jsonl"
const defaultCorpusDir = ".local-data/mlit-pdf-figure-table-rag-seed-v1/corpus"

if (isMainModule()) {
  await prepareMlitPdfFigureTableRagBenchmark(process.env)
}

export async function prepareMlitPdfFigureTableRagBenchmark(
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch
): Promise<PreparedMlitPdfBenchmark> {
  const datasetSource = resolveExisting(env.MLIT_PDF_RAG_DATASET_SOURCE ?? defaultDatasetSource)
  const sourceDocsPath = resolveExisting(env.MLIT_PDF_RAG_SOURCE_DOCS_PATH ?? defaultSourceDocsPath)
  const datasetOutput = resolveOutput(env.MLIT_PDF_RAG_DATASET_OUTPUT ?? defaultDatasetOutput)
  const corpusDir = resolveOutput(env.MLIT_PDF_RAG_CORPUS_DIR ?? defaultCorpusDir)
  const force = env.MLIT_PDF_RAG_FORCE_DOWNLOAD === "1"

  await mkdir(path.dirname(datasetOutput), { recursive: true })
  await copyFile(datasetSource, datasetOutput)
  console.log(`Wrote MLIT PDF figure/table RAG dataset to ${datasetOutput}`)

  if (env.MLIT_PDF_RAG_DOWNLOAD_DOCUMENTS === "0") {
    return { datasetOutput, corpusDir, documents: [] }
  }

  const sourceDocs = parseSourceDocs(await readFile(sourceDocsPath, "utf-8"))
  await mkdir(corpusDir, { recursive: true })
  const documents = []
  for (const doc of sourceDocs) {
    const fileName = `${safeSourceDocId(doc.source_doc_id)}.pdf`
    const outputPath = path.join(corpusDir, fileName)
    if (!force && existsSync(outputPath)) {
      console.log(`MLIT PDF already exists: ${fileName}`)
      documents.push({ sourceDocId: doc.source_doc_id, fileName, sourceUrl: doc.source_url, outputPath, skipped: true })
      continue
    }
    await downloadPdf(fetchImpl, doc.source_url, outputPath, fileName)
    console.log(`Downloaded MLIT PDF: ${fileName}`)
    documents.push({ sourceDocId: doc.source_doc_id, fileName, sourceUrl: doc.source_url, outputPath, skipped: false })
  }

  return { datasetOutput, corpusDir, documents }
}

export function parseSourceDocs(text: string): SourceDocRow[] {
  return parseCsv(text).map((row) => ({
    source_doc_id: required(row, "source_doc_id"),
    title_ja: required(row, "title_ja"),
    publisher: required(row, "publisher"),
    source_url: required(row, "source_url"),
    topic: row.topic ?? "",
    benchmark_use: row.benchmark_use ?? "",
    notes: row.notes ?? ""
  }))
}

async function downloadPdf(fetchImpl: typeof fetch, url: string, outputPath: string, fileName: string): Promise<void> {
  let response: Response
  try {
    response = await fetchImpl(url)
  } catch (error) {
    throw new Error(`Failed to download MLIT PDF ${fileName} from ${url}: ${downloadErrorMessage(error)}`)
  }
  if (!response.ok) throw new Error(`Failed to download MLIT PDF ${fileName} from ${url}: HTTP ${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (!isPdf(body)) throw new Error(`Downloaded MLIT document is not a PDF: ${fileName}`)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, body)
}

function resolveOutput(input: string): string {
  return path.resolve(repoRoot, input)
}

function resolveExisting(input: string): string {
  const candidates = [process.cwd(), benchmarkDir, repoRoot].map((base) => path.resolve(base, input))
  return candidates.find((candidate) => existsSync(candidate)) ?? path.resolve(process.cwd(), input)
}

function required(row: Record<string, string>, key: string): string {
  const value = row[key]?.trim()
  if (!value) throw new Error(`MLIT source_docs.csv row is missing ${key}`)
  return value
}

function safeSourceDocId(value: string): string {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "_")
}

function isPdf(body: Buffer): boolean {
  return body.length >= 4 && body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46
}

function downloadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = (error as Error & { cause?: unknown }).cause
  return cause instanceof Error ? `${error.message}: ${cause.message}` : error.message
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1]
  if (!entryPoint) return false
  return path.resolve(entryPoint) === fileURLToPath(import.meta.url)
}
