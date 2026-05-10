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

type DrawingSourceType = "project_drawing" | "standard_detail" | "equipment_standard" | "benchmark_reference" | "external"

type NormalizedBbox = {
  unit: "normalized_page"
  x: number
  y: number
  width: number
  height: number
}

type DrawingRegionType = "titleblock" | "legend" | "table" | "note" | "detail"

type DrawingRegionMetadata = {
  regionId: string
  regionType: DrawingRegionType
  pageOrSheet: string
  bbox: NormalizedBbox
  bboxSource: "heuristic_region_candidate" | "page_extent"
  evidenceAnchor: string
  sourceQaIds: string[]
  confidence: number
}

type DrawingSheetMetadata = {
  pageOrSheet: string
  drawingNo?: string
  sheetTitle?: string
  scale?: string
  sourceQaIds: string[]
  confidence: number
}

type DrawingCorpusMetadata = {
  drawingSourceType: DrawingSourceType
  drawingSheetMetadata: DrawingSheetMetadata[]
  drawingRegionIndex: DrawingRegionMetadata[]
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
  const corpusMetadataBySource = drawingCorpusMetadataMap(definition)
  const datasetRows = definition.seedQa.map((qa) => toDatasetRow(qa, sourceFileNames, corpusMetadataBySource.get(qa.sourceId)))

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
    const corpusMetadata = corpusMetadataBySource.get(source.sourceId)
    if (corpusMetadata) {
      await writeFile(`${outputPath}.metadata.json`, JSON.stringify(corpusMetadata, null, 2) + "\n", "utf-8")
    }
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
  const corpusMetadataBySource = drawingCorpusMetadataMap(definition)
  return definition.seedQa.map((qa) => toDatasetRow(qa, sourceFileNames, corpusMetadataBySource.get(qa.sourceId)))
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

function toDatasetRow(qa: SeedQa, sourceFileNames: Map<string, string>, corpusMetadata?: DrawingCorpusMetadata): DatasetRow {
  const answerable = qa.taskCategory !== "abstention"
  const expectedEvidenceRegions = corpusMetadata?.drawingRegionIndex.filter((region) => region.sourceQaIds.includes(qa.id)) ?? []
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
      expectedEvidenceRegions,
      drawingSourceType: corpusMetadata?.drawingSourceType,
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

function drawingCorpusMetadataMap(definition: ArchitectureDrawingQaragDefinition): Map<string, DrawingCorpusMetadata> {
  return new Map(definition.sources.map((source) => {
    const qaRows = definition.seedQa.filter((qa) => qa.sourceId === source.sourceId)
    return [source.sourceId, {
      drawingSourceType: drawingSourceTypeFor(source),
      drawingSheetMetadata: drawingSheetMetadataFor(qaRows),
      drawingRegionIndex: drawingRegionIndexFor(source.sourceId, qaRows)
    }]
  }))
}

function drawingSourceTypeFor(source: SourceRow): DrawingSourceType {
  const text = `${source.type} ${source.primaryUse}`.toLowerCase()
  if (text.includes("public procurement drawing")) return "project_drawing"
  if (text.includes("equipment standard")) return "equipment_standard"
  if (text.includes("standard detail")) return "standard_detail"
  if (text.includes("benchmark")) return "benchmark_reference"
  return "external"
}

function drawingSheetMetadataFor(qaRows: SeedQa[]): DrawingSheetMetadata[] {
  const titleblockRows = qaRows.filter((qa) => qa.taskCategory === "titleblock/OCR")
  const byPage = new Map<string, SeedQa[]>()
  for (const qa of titleblockRows) byPage.set(qa.pageOrSheet, [...(byPage.get(qa.pageOrSheet) ?? []), qa])
  return [...byPage.entries()].map(([pageOrSheet, rows]) => {
    const drawingNo = firstDefined(rows.map(extractDrawingNo))
    const sheetTitle = firstDefined(rows.map(extractSheetTitle))
    const scale = firstDefined(rows.map(extractScale))
    return {
      pageOrSheet,
      ...(drawingNo ? { drawingNo } : {}),
      ...(sheetTitle ? { sheetTitle } : {}),
      ...(scale ? { scale } : {}),
      sourceQaIds: rows.map((row) => row.id),
      confidence: 0.75
    }
  })
}

function drawingRegionIndexFor(sourceId: string, qaRows: SeedQa[]): DrawingRegionMetadata[] {
  const groups = new Map<string, SeedQa[]>()
  for (const qa of qaRows) {
    const regionType = regionTypeFor(qa)
    if (!regionType) continue
    const key = `${regionType}:${qa.pageOrSheet}:${qa.evidenceAnchor}`
    groups.set(key, [...(groups.get(key) ?? []), qa])
  }
  return [...groups.values()].flatMap((rows, index) => {
    const first = rows[0]
    if (!first) return []
    const regionType = regionTypeFor(first) ?? "note"
    const bbox = bboxCandidateFor(regionType)
    return [{
      regionId: `${sourceId.toLowerCase()}-${regionType}-${String(index + 1).padStart(3, "0")}`,
      regionType,
      pageOrSheet: first.pageOrSheet,
      bbox,
      bboxSource: bbox.width === 1 && bbox.height === 1 ? "page_extent" : "heuristic_region_candidate",
      evidenceAnchor: first.evidenceAnchor,
      sourceQaIds: rows.map((row) => row.id),
      confidence: bbox.width === 1 && bbox.height === 1 ? 0.35 : 0.55
    }]
  })
}

function regionTypeFor(qa: SeedQa): DrawingRegionType | undefined {
  if (qa.taskCategory === "titleblock/OCR") return "titleblock"
  if (qa.taskCategory === "legend/abbreviation") return "legend"
  if (qa.taskCategory.includes("dimension rule") || qa.evidenceAnchor.includes("表")) return "table"
  if (qa.taskCategory.includes("detail") || qa.taskCategory === "cross-section navigation") return "detail"
  if (qa.taskCategory.includes("note") || qa.taskCategory.includes("open-ended")) return "note"
  return undefined
}

function bboxCandidateFor(regionType: DrawingRegionType): NormalizedBbox {
  if (regionType === "titleblock") return { unit: "normalized_page", x: 0.55, y: 0.72, width: 0.45, height: 0.28 }
  if (regionType === "legend") return { unit: "normalized_page", x: 0, y: 0, width: 1, height: 1 }
  if (regionType === "table") return { unit: "normalized_page", x: 0, y: 0, width: 1, height: 1 }
  if (regionType === "detail") return { unit: "normalized_page", x: 0, y: 0, width: 1, height: 1 }
  return { unit: "normalized_page", x: 0, y: 0, width: 1, height: 1 }
}

function extractDrawingNo(qa: SeedQa): string | undefined {
  const text = `${qa.questionJa} ${qa.expectedAnswerJa}`
  const explicit = text.match(/図面番号(?:は)?([A-ZＡ-Ｚ]?-?\d{1,3}|[０-９]{1,2}-[０-９]{1,2})/u)?.[1]
  const candidate = explicit ?? text.match(/\b[A-Z]-\d{2,3}\b/u)?.[0] ?? text.match(/\b\d{1,2}-\d{2}\b/u)?.[0]
  return candidate?.normalize("NFKC")
}

function extractSheetTitle(qa: SeedQa): string | undefined {
  if (!/(図面名称|図面名|図面種類)/u.test(qa.questionJa)) return undefined
  return qa.expectedAnswerJa.split(/[、。．]/u)[0]?.trim().normalize("NFKC") || undefined
}

function extractScale(qa: SeedQa): string | undefined {
  const text = `${qa.questionJa} ${qa.expectedAnswerJa}`.normalize("NFKC")
  const explicit = text.match(/縮尺(?:は)?([^、。．]+(?:\/\d+)?)/u)?.[1]?.trim()
  const ratio = explicit ?? text.match(/\b(?:A[13]:)?1\/\d+\b/u)?.[0] ?? text.match(/\b1:\d+\b/u)?.[0]
  return ratio
}

function firstDefined<T>(values: Array<T | undefined>): T | undefined {
  return values.find((value): value is T => value !== undefined)
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
