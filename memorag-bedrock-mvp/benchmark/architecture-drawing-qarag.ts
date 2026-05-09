import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const architectureDrawingQaragSuiteId = "architecture-drawing-qarag-v0.1"

type SourceRow = {
  sourceId: string
  sourceName: string
  type: string
  publisher: string
  yearVersion: string
  primaryUse: string
  url: string
  notes: string
}

type SeedQa = {
  id: string
  taskCategory: string
  subSkill: string
  sourceId: string
  documentName: string
  pageOrSheet: string
  evidenceAnchor: string
  modalityScope: string
  retrievalSetting: string
  questionJa: string
  expectedAnswerJa: string
  acceptableAliasesOrNormalization: string
  scoringRule: string
  difficulty: string
  notes?: string
}

type ArchitectureDrawingQaragDefinition = {
  schemaVersion: 1
  suiteId: typeof architectureDrawingQaragSuiteId
  label: string
  description: string
  sources: SourceRow[]
  rubric?: unknown[]
  seedQa: SeedQa[]
}

type DatasetRow = {
  id: string
  question: string
  answerable: boolean
  expectedResponseType: "answer" | "refusal"
  referenceAnswer: string
  expectedContains?: string[]
  expectedFiles: string[]
  expectedPages?: string[]
  complexity: "simple" | "multi_hop" | "comparison" | "procedure" | "out_of_scope"
  unanswerableType?: "missing_fact" | "out_of_scope"
  metadata: Record<string, unknown>
}

type BenchmarkDefinitionSources = {
  sources: SourceRow[]
  seedQa: SeedQa[]
}

type PrepareOptions = {
  configPath: string
  datasetOutput: string
  corpusDir: string
  fetchImpl?: typeof fetch
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const defaultConfigPath = path.join(repoRoot, "benchmark", "architecture-drawing-qarag-v0.1.json")
const defaultDatasetOutput = ".local-data/architecture-drawing-qarag-v0.1/dataset.jsonl"
const defaultCorpusDir = ".local-data/architecture-drawing-qarag-v0.1/corpus"

export async function prepareArchitectureDrawingQaragBenchmark(options: PrepareOptions): Promise<{ datasetRows: number; corpusFiles: string[] }> {
  const definition = parseArchitectureDrawingQaragDefinition(await readFile(options.configPath, "utf-8"))
  const sourceFileNames = sourceFileNameMap(definition)
  const datasetRows = definition.seedQa.map((qa) => toDatasetRow(qa, sourceFileNames))

  await mkdir(path.dirname(options.datasetOutput), { recursive: true })
  await mkdir(options.corpusDir, { recursive: true })
  await writeFile(options.datasetOutput, datasetRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf-8")

  const usedSourceIds = new Set(definition.seedQa.map((qa) => qa.sourceId))
  const corpusFiles: string[] = []
  for (const source of definition.sources.filter((candidate) => usedSourceIds.has(candidate.sourceId))) {
    const fileName = sourceFileNames.get(source.sourceId)
    if (!fileName) continue
    const content = await downloadSource(source, options.fetchImpl ?? fetch)
    const outputPath = path.join(options.corpusDir, fileName)
    await writeFile(outputPath, content)
    corpusFiles.push(fileName)
  }

  return { datasetRows: datasetRows.length, corpusFiles }
}

export function parseArchitectureDrawingQaragDefinition(json: string): ArchitectureDrawingQaragDefinition {
  const parsed = JSON.parse(json) as ArchitectureDrawingQaragDefinition
  if (parsed.schemaVersion !== 1) throw new Error("Unsupported architecture drawing QARAG schemaVersion")
  if (parsed.suiteId !== architectureDrawingQaragSuiteId) throw new Error(`Unexpected architecture drawing QARAG suiteId: ${parsed.suiteId}`)
  if (!Array.isArray(parsed.sources) || !Array.isArray(parsed.seedQa)) throw new Error("Architecture drawing QARAG JSON must include sources and seedQa arrays")
  return parsed
}

export function toDatasetRows(definition: ArchitectureDrawingQaragDefinition): DatasetRow[] {
  const sourceFileNames = sourceFileNameMap(definition)
  return definition.seedQa.map((qa) => toDatasetRow(qa, sourceFileNames))
}

function sourceFileNameMap(parsed: BenchmarkDefinitionSources): Map<string, string> {
  return new Map(parsed.sources.map((source) => [source.sourceId, sourceFileName(source)]))
}

function sourceFileName(source: SourceRow): string {
  const ext = extensionFromUrl(source.url) ?? ".pdf"
  const slug = source.sourceName
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_.-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48)
  return `${source.sourceId.toLowerCase()}-${slug || "source"}${ext}`
}

function extensionFromUrl(rawUrl: string): string | undefined {
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase()
    if (pathname.endsWith(".pdf")) return ".pdf"
    if (pathname.endsWith(".md")) return ".md"
    if (pathname.endsWith(".txt")) return ".txt"
  } catch {
    return undefined
  }
  return undefined
}

function toDatasetRow(qa: SeedQa, sourceFileNames: Map<string, string>): DatasetRow {
  const answerable = qa.taskCategory !== "abstention"
  return {
    id: qa.id,
    question: qa.questionJa,
    answerable,
    expectedResponseType: answerable ? "answer" : "refusal",
    referenceAnswer: qa.expectedAnswerJa,
    ...(answerable ? { expectedContains: expectedContainsFromAnswer(qa.expectedAnswerJa) } : {}),
    expectedFiles: [sourceFileNames.get(qa.sourceId) ?? `${qa.sourceId}.pdf`],
    ...(qa.pageOrSheet ? { expectedPages: [qa.pageOrSheet] } : {}),
    complexity: complexityFor(qa),
    ...(!answerable ? { unanswerableType: "missing_fact" as const } : {}),
    metadata: {
      benchmarkSuiteId: architectureDrawingQaragSuiteId,
      sourceId: qa.sourceId,
      documentName: qa.documentName,
      pageOrSheet: qa.pageOrSheet,
      evidenceAnchor: qa.evidenceAnchor,
      modalityScope: qa.modalityScope,
      taskCategory: qa.taskCategory,
      subSkill: qa.subSkill,
      retrievalSetting: qa.retrievalSetting,
      scoringRule: qa.scoringRule,
      difficulty: qa.difficulty,
      acceptableAliasesOrNormalization: qa.acceptableAliasesOrNormalization,
      notes: qa.notes
    }
  }
}

function expectedContainsFromAnswer(answer: string): string[] {
  const firstSentence = answer.split(/[。．]/)[0]?.trim()
  if (!firstSentence) return []
  if (firstSentence.length <= 40) return [firstSentence]
  return firstSentence.split(/[、，,]/).map((part) => part.trim()).filter(Boolean).slice(0, 2)
}

function complexityFor(qa: SeedQa): DatasetRow["complexity"] {
  if (qa.taskCategory === "abstention") return "out_of_scope"
  if (qa.taskCategory === "comparative") return "comparison"
  if (qa.taskCategory === "cross-section navigation" || qa.retrievalSetting.includes("cross")) return "multi_hop"
  if (qa.taskCategory.includes("extraction") || qa.taskCategory.includes("OCR") || qa.taskCategory.includes("legend")) return "simple"
  return "procedure"
}

async function downloadSource(source: SourceRow, fetcher: typeof fetch): Promise<Buffer> {
  const response = await fetcher(source.url)
  if (!response.ok) throw new Error(`Failed to download ${source.sourceId} from ${source.url}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  const configPath = process.env.ARCHITECTURE_QARAG_CONFIG ?? defaultConfigPath
  const datasetOutput = process.env.ARCHITECTURE_QARAG_DATASET_OUTPUT ?? defaultDatasetOutput
  const corpusDir = process.env.ARCHITECTURE_QARAG_CORPUS_DIR ?? defaultCorpusDir
  const result = await prepareArchitectureDrawingQaragBenchmark({ configPath, datasetOutput, corpusDir })
  const fingerprint = createHash("sha256").update(`${result.datasetRows}:${result.corpusFiles.join(",")}`).digest("hex").slice(0, 12)
  console.log(`Prepared ${architectureDrawingQaragSuiteId}: datasetRows=${result.datasetRows} corpusFiles=${result.corpusFiles.length} fingerprint=${fingerprint}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
}
