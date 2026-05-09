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

type ParsedBenchmark = {
  sources: SourceRow[]
  seedQa: SeedQa[]
}

type PrepareOptions = {
  markdownPath: string
  datasetOutput: string
  corpusDir: string
  fetchImpl?: typeof fetch
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const defaultMarkdownPath = path.join(repoRoot, "benchmark", "architecture-drawing-qarag-v0.1.md")
const defaultDatasetOutput = ".local-data/architecture-drawing-qarag-v0.1/dataset.jsonl"
const defaultCorpusDir = ".local-data/architecture-drawing-qarag-v0.1/corpus"

export async function prepareArchitectureDrawingQaragBenchmark(options: PrepareOptions): Promise<{ datasetRows: number; corpusFiles: string[] }> {
  const markdown = await readFile(options.markdownPath, "utf-8")
  const parsed = parseArchitectureDrawingQaragMarkdown(markdown)
  const sourceFileNames = sourceFileNameMap(parsed)
  const datasetRows = parsed.seedQa.map((qa) => toDatasetRow(qa, sourceFileNames))

  await mkdir(path.dirname(options.datasetOutput), { recursive: true })
  await mkdir(options.corpusDir, { recursive: true })
  await writeFile(options.datasetOutput, datasetRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf-8")

  const usedSourceIds = new Set(parsed.seedQa.map((qa) => qa.sourceId))
  const corpusFiles: string[] = []
  for (const source of parsed.sources.filter((candidate) => usedSourceIds.has(candidate.sourceId))) {
    const fileName = sourceFileNames.get(source.sourceId)
    if (!fileName) continue
    const content = await downloadSource(source, options.fetchImpl ?? fetch)
    const outputPath = path.join(options.corpusDir, fileName)
    await writeFile(outputPath, content)
    corpusFiles.push(fileName)
  }

  return { datasetRows: datasetRows.length, corpusFiles }
}

export function parseArchitectureDrawingQaragMarkdown(markdown: string): ParsedBenchmark {
  const sources = parseSources(markdown)
  const seedQa = parseSeedQa(markdown)
  return { sources, seedQa }
}

export function toDatasetRows(markdown: string): DatasetRow[] {
  const parsed = parseArchitectureDrawingQaragMarkdown(markdown)
  const sourceFileNames = sourceFileNameMap(parsed)
  return parsed.seedQa.map((qa) => toDatasetRow(qa, sourceFileNames))
}

function parseSources(markdown: string): SourceRow[] {
  const section = sectionBody(markdown, "## 公的図面・参照ソース")
  const rows = tableRows(section)
  return rows.map((cells) => ({
    sourceId: cells[0] ?? "",
    sourceName: cells[1] ?? "",
    type: cells[2] ?? "",
    publisher: cells[3] ?? "",
    yearVersion: cells[4] ?? "",
    primaryUse: cells[5] ?? "",
    url: cells[6] ?? "",
    notes: cells[7] ?? ""
  })).filter((row) => row.sourceId && row.url)
}

function parseSeedQa(markdown: string): SeedQa[] {
  const section = sectionBody(markdown, "## Seed QA")
  const blocks = section.split(/\n(?=### )/).filter((block) => block.startsWith("### "))
  return blocks.map((block) => {
    const lines = block.split("\n")
    const heading = lines[0]?.replace(/^###\s+/, "") ?? ""
    const [id = "", taskCategory = "", subSkill = ""] = heading.split(" / ").map((part) => part.trim())
    const bullets = new Map<string, string>()
    for (const line of lines.slice(1)) {
      const match = /^-\s+([^:]+):\s*(.*)$/.exec(line)
      if (!match) continue
      const [, key = "", value = ""] = match
      bullets.set(key.trim(), unwrapCode(value.trim()))
    }
    return {
      id,
      taskCategory,
      subSkill,
      sourceId: bullets.get("source_id") ?? "",
      documentName: bullets.get("document_name") ?? "",
      pageOrSheet: bullets.get("page_or_sheet") ?? "",
      evidenceAnchor: bullets.get("evidence_anchor") ?? "",
      modalityScope: bullets.get("modality_scope") ?? "",
      retrievalSetting: bullets.get("retrieval_setting") ?? "",
      questionJa: bullets.get("question_ja") ?? "",
      expectedAnswerJa: bullets.get("expected_answer_ja") ?? "",
      acceptableAliasesOrNormalization: bullets.get("acceptable_aliases_or_normalization") ?? "",
      scoringRule: bullets.get("scoring_rule") ?? "",
      difficulty: bullets.get("difficulty") ?? "",
      notes: bullets.get("notes")
    }
  }).filter((qa) => qa.id && qa.questionJa)
}

function sectionBody(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading)
  if (start < 0) throw new Error(`Missing section: ${heading}`)
  const bodyStart = start + heading.length
  const next = markdown.slice(bodyStart).search(/\n## /)
  return next < 0 ? markdown.slice(bodyStart) : markdown.slice(bodyStart, bodyStart + next)
}

function tableRows(section: string): string[][] {
  return section.split("\n")
    .filter((line) => line.startsWith("| "))
    .slice(2)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
}

function splitMarkdownTableRow(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let escaped = false
  for (const char of line.trim().replace(/^\|/, "").replace(/\|$/, "")) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if (char === "|") {
      cells.push(cleanCell(current))
      current = ""
      continue
    }
    current += char
  }
  cells.push(cleanCell(current))
  return cells
}

function cleanCell(value: string): string {
  return value.trim().replace(/<br>/g, "\n")
}

function unwrapCode(value: string): string {
  return value.replace(/^`/, "").replace(/`$/, "").replace(/<br>/g, "\n").trim()
}

function sourceFileNameMap(parsed: ParsedBenchmark): Map<string, string> {
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
  const markdownPath = process.env.ARCHITECTURE_QARAG_MARKDOWN ?? defaultMarkdownPath
  const datasetOutput = process.env.ARCHITECTURE_QARAG_DATASET_OUTPUT ?? defaultDatasetOutput
  const corpusDir = process.env.ARCHITECTURE_QARAG_CORPUS_DIR ?? defaultCorpusDir
  const result = await prepareArchitectureDrawingQaragBenchmark({ markdownPath, datasetOutput, corpusDir })
  const fingerprint = createHash("sha256").update(`${result.datasetRows}:${result.corpusFiles.join(",")}`).digest("hex").slice(0, 12)
  console.log(`Prepared ${architectureDrawingQaragSuiteId}: datasetRows=${result.datasetRows} corpusFiles=${result.corpusFiles.length} fingerprint=${fingerprint}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
}
