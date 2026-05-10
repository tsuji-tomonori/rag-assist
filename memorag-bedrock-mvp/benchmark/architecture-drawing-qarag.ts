import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { normalizeExpectedDrawingValue, type DrawingValueKind } from "./metrics/drawing-normalization.js"

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
  expectedNormalizedValues?: ExpectedNormalizedValue[]
  expectedFiles: string[]
  expectedPages?: string[]
  complexity: "simple" | "multi_hop" | "comparison" | "procedure" | "out_of_scope"
  unanswerableType?: "missing_fact" | "out_of_scope"
  metadata: Record<string, unknown>
}

type ExpectedNormalizedValue = {
  raw: string
  canonical: string
  kind: DrawingValueKind
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

type VisualPageRetrievalOptions = {
  enabled: boolean
  indexOutput?: string
  reportOutput?: string
  profileId?: string
}

type VisualPageIndexEntry = {
  sourceId: string
  fileName: string
  pageOrSheet: string
  sourceQaIds: string[]
  regionIds: string[]
  visualText: string
  pageImageArtifact: string
}

type VisualPageIndexArtifact = {
  schemaVersion: 1
  suiteId: typeof architectureDrawingQaragSuiteId
  profileId: string
  status: "candidate"
  enabledBy: "ARCHITECTURE_QARAG_VISUAL_PAGE_RETRIEVAL"
  defaultPath: false
  generatedAt: string
  pages: VisualPageIndexEntry[]
  adoptionGate: {
    requiredMetrics: string[]
    decision: "not_adopted_pending_ablation"
    reason: string
  }
}

type BenchmarkDefinitionSources = {
  sources: SourceRow[]
  seedQa: SeedQa[]
}

type PrepareOptions = {
  configPath: string
  datasetOutput: string
  corpusDir: string
  visualPageRetrieval?: VisualPageRetrievalOptions
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
  const visualPageIndex = visualPageIndexArtifact(definition, sourceFileNames, corpusMetadataBySource, options.visualPageRetrieval)
  const visualPageCandidates = visualPageIndex ? visualPageCandidatesByQa(visualPageIndex) : undefined
  const datasetRows = definition.seedQa.map((qa) => toDatasetRow(qa, sourceFileNames, corpusMetadataBySource.get(qa.sourceId), visualPageCandidates?.get(qa.id), visualPageIndex?.profileId))

  await mkdir(path.dirname(options.datasetOutput), { recursive: true })
  await mkdir(options.corpusDir, { recursive: true })
  await writeFile(options.datasetOutput, datasetRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf-8")
  if (visualPageIndex && options.visualPageRetrieval?.indexOutput) {
    await mkdir(path.dirname(options.visualPageRetrieval.indexOutput), { recursive: true })
    await writeFile(options.visualPageRetrieval.indexOutput, JSON.stringify(visualPageIndex, null, 2) + "\n", "utf-8")
  }
  if (visualPageIndex && options.visualPageRetrieval?.reportOutput) {
    await mkdir(path.dirname(options.visualPageRetrieval.reportOutput), { recursive: true })
    await writeFile(options.visualPageRetrieval.reportOutput, renderVisualPageRetrievalReport(visualPageIndex), "utf-8")
  }

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

function toDatasetRow(
  qa: SeedQa,
  sourceFileNames: Map<string, string>,
  corpusMetadata?: DrawingCorpusMetadata,
  visualPageCandidates?: VisualPageIndexEntry[],
  visualPageProfileId?: string
): DatasetRow {
  const answerable = qa.taskCategory !== "abstention"
  const expectedEvidenceRegions = corpusMetadata?.drawingRegionIndex.filter((region) => region.sourceQaIds.includes(qa.id)) ?? []
  const expectedNormalizedValues = expectedNormalizedValuesFor(qa)
  return {
    id: qa.id,
    question: qa.questionJa,
    answerable,
    expectedResponseType: answerable ? "answer" : "refusal",
    referenceAnswer: qa.expectedAnswerJa,
    ...(answerable ? { expectedContains: expectedContainsFromAnswer(qa.expectedAnswerJa) } : {}),
    ...(expectedNormalizedValues.length > 0 ? { expectedNormalizedValues } : {}),
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
      ...(visualPageCandidates && visualPageCandidates.length > 0
        ? {
            visualPageRetrieval: {
              profileId: visualPageProfileId,
              defaultPath: false,
              expectedPageCandidates: visualPageCandidates.map((candidate) => ({
                sourceId: candidate.sourceId,
                fileName: candidate.fileName,
                pageOrSheet: candidate.pageOrSheet,
                regionIds: candidate.regionIds
              }))
            }
          }
        : {}),
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

function expectedNormalizedValuesFor(qa: SeedQa): ExpectedNormalizedValue[] {
  if (qa.taskCategory === "abstention") return []
  if (!shouldEvaluateNormalizedValue(qa)) return []
  const raw = `${qa.expectedAnswerJa} ${qa.acceptableAliasesOrNormalization}`.trim()
  return normalizedKindsFor(qa).flatMap((kind) => {
    const canonical = normalizeExpectedDrawingValue({ raw, kind })
    return canonical ? [{ raw, canonical, kind }] : []
  })
}

function shouldEvaluateNormalizedValue(qa: SeedQa): boolean {
  const text = `${qa.taskCategory} ${qa.subSkill} ${qa.scoringRule} ${qa.questionJa} ${qa.expectedAnswerJa} ${qa.acceptableAliasesOrNormalization}`
  return /exact_normalized|縮尺|寸法|口径|管径|延長|φ|Φ|D\s*=|\d+\s*A|以上|以下|未満|以内|超/u.test(text)
}

function normalizedKindsFor(qa: SeedQa): DrawingValueKind[] {
  const text = `${qa.taskCategory} ${qa.subSkill} ${qa.questionJa} ${qa.expectedAnswerJa} ${qa.acceptableAliasesOrNormalization}`.normalize("NFKC")
  const kinds: DrawingValueKind[] = []
  if (/縮尺|scale|1\s*[:/]\s*\d+/iu.test(text)) kinds.push("scale")
  if (/延長|\bL\s*[=:]?\s*-?\d/iu.test(text)) kinds.push("length")
  if (/口径|管径|φ|Φ|\bD\s*=|\d+\s*A\b/iu.test(text)) kinds.push("diameter")
  if (/以上|以下|未満|以内|超|より大きい|より小さい|≧|≦|>=|<=|>|</u.test(text)) kinds.push("range")
  if (/寸法|dimension|\b-?\d+(?:\.\d+)?\s*(?:mm|cm|m)\b/iu.test(text)) kinds.push("dimension")
  return [...new Set(kinds)]
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

function visualPageIndexArtifact(
  definition: ArchitectureDrawingQaragDefinition,
  sourceFileNames: Map<string, string>,
  corpusMetadataBySource: Map<string, DrawingCorpusMetadata>,
  options?: VisualPageRetrievalOptions
): VisualPageIndexArtifact | undefined {
  if (!options?.enabled) return undefined
  const pages: VisualPageIndexEntry[] = []
  for (const source of definition.sources) {
    const fileName = sourceFileNames.get(source.sourceId)
    const corpusMetadata = corpusMetadataBySource.get(source.sourceId)
    if (!fileName || !corpusMetadata) continue
    const qaRows = definition.seedQa.filter((qa) => qa.sourceId === source.sourceId)
    const pageGroups = new Map<string, SeedQa[]>()
    for (const qa of qaRows) pageGroups.set(qa.pageOrSheet, [...(pageGroups.get(qa.pageOrSheet) ?? []), qa])
    for (const [pageOrSheet, pageQaRows] of pageGroups) {
      const regions = corpusMetadata.drawingRegionIndex.filter((region) => region.pageOrSheet === pageOrSheet)
      const sheet = corpusMetadata.drawingSheetMetadata.find((candidate) => candidate.pageOrSheet === pageOrSheet)
      pages.push({
        sourceId: source.sourceId,
        fileName,
        pageOrSheet,
        sourceQaIds: pageQaRows.map((qa) => qa.id),
        regionIds: regions.map((region) => region.regionId),
        visualText: [
          source.sourceName,
          pageOrSheet,
          sheet?.drawingNo,
          sheet?.sheetTitle,
          sheet?.scale,
          ...pageQaRows.flatMap((qa) => [qa.evidenceAnchor, qa.modalityScope, qa.subSkill])
        ].filter(Boolean).join(" | "),
        pageImageArtifact: `${fileName}.pages/${safePageSlug(pageOrSheet)}.png`
      })
    }
  }

  return {
    schemaVersion: 1,
    suiteId: architectureDrawingQaragSuiteId,
    profileId: options.profileId ?? "drawing-visual-page-candidate@1",
    status: "candidate",
    enabledBy: "ARCHITECTURE_QARAG_VISUAL_PAGE_RETRIEVAL",
    defaultPath: false,
    generatedAt: new Date().toISOString(),
    pages,
    adoptionGate: {
      requiredMetrics: ["page_recall_at_k", "answerable_accuracy", "unsupported_answer_rate", "p95_latency_ms", "no_access_leak_count"],
      decision: "not_adopted_pending_ablation",
      reason: "CI-reproducible visual embedding model and page rendering are not wired yet; this artifact defines the gated candidate index for ablation."
    }
  }
}

function visualPageCandidatesByQa(index: VisualPageIndexArtifact): Map<string, VisualPageIndexEntry[]> {
  const byQa = new Map<string, VisualPageIndexEntry[]>()
  for (const page of index.pages) {
    for (const qaId of page.sourceQaIds) byQa.set(qaId, [...(byQa.get(qaId) ?? []), page])
  }
  return byQa
}

function renderVisualPageRetrievalReport(index: VisualPageIndexArtifact): string {
  const bySource = new Map<string, number>()
  for (const page of index.pages) bySource.set(page.sourceId, (bySource.get(page.sourceId) ?? 0) + 1)
  return `# Architecture Drawing Visual Page Retrieval Candidate

- Suite: ${index.suiteId}
- Profile: ${index.profileId}
- Status: ${index.status}
- Default path: ${index.defaultPath ? "yes" : "no"}
- Enabled by: ${index.enabledBy}=1
- Indexed page candidates: ${index.pages.length}

## Adoption Decision

Not adopted as default yet.

Reason: ${index.adoptionGate.reason}

## Required Comparison Metrics

| metric | purpose |
| --- | --- |
${index.adoptionGate.requiredMetrics.map((metric) => `| ${metric} | baseline と visual candidate の比較 |`).join("\n")}

## Source Coverage

| source | page candidates |
| --- | ---: |
${[...bySource.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([sourceId, count]) => `| ${sourceId} | ${count} |`).join("\n")}

## Evaluation Notes

- Compare the baseline run summary with the visual candidate run summary.
- Keep \`no_access_leak_count=0\` as a hard gate.
- Promote to default only after page recall and answer quality improve without unacceptable latency, cost, or index-size growth.
`
}

function safePageSlug(pageOrSheet: string): string {
  return pageOrSheet.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "page"
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
  const visualPageRetrieval = process.env.ARCHITECTURE_QARAG_VISUAL_PAGE_RETRIEVAL === "1"
    ? {
        enabled: true,
        indexOutput: process.env.ARCHITECTURE_QARAG_VISUAL_PAGE_INDEX_OUTPUT ?? path.join(path.dirname(datasetOutput), "visual-page-index.json"),
        reportOutput: process.env.ARCHITECTURE_QARAG_VISUAL_PAGE_REPORT_OUTPUT ?? path.join(path.dirname(datasetOutput), "visual-page-retrieval-report.md"),
        profileId: process.env.ARCHITECTURE_QARAG_VISUAL_PAGE_PROFILE_ID
      }
    : undefined
  const result = await prepareArchitectureDrawingQaragBenchmark({ configPath, datasetOutput, corpusDir, visualPageRetrieval })
  const fingerprint = createHash("sha256").update(`${result.datasetRows}:${result.corpusFiles.join(",")}`).digest("hex").slice(0, 12)
  console.log(`Prepared ${architectureDrawingQaragSuiteId}: datasetRows=${result.datasetRows} corpusFiles=${result.corpusFiles.length} fingerprint=${fingerprint}`)
  if (visualPageRetrieval?.indexOutput) console.log(`Prepared visual page retrieval candidate index: ${visualPageRetrieval.indexOutput}`)
  if (visualPageRetrieval?.reportOutput) console.log(`Prepared visual page retrieval adoption report: ${visualPageRetrieval.reportOutput}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
}
