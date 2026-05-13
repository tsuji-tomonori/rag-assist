import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

type RawRecord = Record<string, unknown>

type ConversationDatasetRow = {
  conversationId: string
  sourceDataset: "chatrag-bench"
  language: string
  turns: ConversationTurn[]
  metadata: {
    subset: string
    originalId?: string
  }
}

type ConversationTurn = {
  turnId: string
  question: string
  answerable: boolean
  referenceAnswer?: string
  expectedContains?: string[]
  expectedFiles: string[]
  requiresHistory: boolean
  goldStandaloneQuestion?: string
  metadata: {
    subset: string
    originalId?: string
  }
}

const defaultDatasetOutput = ".local-data/chatrag-bench/dataset.jsonl"
const defaultCorpusDir = ".local-data/chatrag-bench/corpus"

if (isMainModule()) {
  await prepareChatRagBench(process.env)
}

export async function prepareChatRagBench(env: NodeJS.ProcessEnv): Promise<void> {
  const inputDir = requiredEnv(env.CHATRAG_INPUT_DIR, "CHATRAG_INPUT_DIR")
  const datasetOutput = env.CHATRAG_DATASET_OUTPUT ?? defaultDatasetOutput
  const corpusDir = env.CHATRAG_CORPUS_DIR ?? defaultCorpusDir
  const { rows, corpus } = convertChatRagBench(await readJsonRecords(inputDir))

  await mkdir(path.dirname(datasetOutput), { recursive: true })
  await mkdir(corpusDir, { recursive: true })
  await writeFile(datasetOutput, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")
  for (const doc of corpus.values()) {
    await writeFile(path.join(corpusDir, doc.fileName), doc.text, "utf-8")
  }
  console.log(`Wrote ${rows.length} ChatRAG Bench conversations to ${datasetOutput}`)
  console.log(`Wrote ${corpus.size} ChatRAG Bench corpus documents to ${corpusDir}`)
}

export function convertChatRagBench(recordsBySubset: Map<string, RawRecord[]>): {
  rows: ConversationDatasetRow[]
  corpus: Map<string, { fileName: string; text: string }>
} {
  const rows: ConversationDatasetRow[] = []
  const corpus = new Map<string, { fileName: string; text: string }>()

  for (const [subset, records] of recordsBySubset.entries()) {
    records.forEach((record, index) => {
      const originalId = stringValue(record.id) ?? stringValue(record.conversation_id) ?? stringValue(record.conversationId)
      const conversationId = safeId(originalId ?? `${subset}-${String(index + 1).padStart(6, "0")}`)
      const passageText = stringValue(record.passage) ?? stringValue(record.context) ?? stringValue(record.document) ?? stringValue(record.story)
      const passageTitle = stringValue(record.title) ?? stringValue(record.document_title) ?? conversationId
      const defaultFileName = `${safeId(`${subset}_${conversationId}`)}.md`
      if (passageText && !corpus.has(defaultFileName)) {
        corpus.set(defaultFileName, {
          fileName: defaultFileName,
          text: [
            `# ${passageTitle}`,
            "",
            "Source dataset: ChatRAG Bench",
            `Subset: ${subset}`,
            `Original conversation id: ${conversationId}`,
            "",
            passageText
          ].join("\n")
        })
      }

      const rawTurns = arrayValue(record.turns) ?? arrayValue(record.messages)
      const turns = rawTurns
        ? convertTurns(rawTurns, { subset, conversationId, originalId, defaultFileName: passageText ? defaultFileName : undefined })
        : convertFlatRecord(record, { subset, conversationId, originalId, defaultFileName: passageText ? defaultFileName : undefined })
      if (turns.length === 0) throw new Error(`ChatRAG Bench record has no turns: ${conversationId}`)

      rows.push({
        conversationId,
        sourceDataset: "chatrag-bench",
        language: stringValue(record.language) ?? "en",
        turns,
        metadata: { subset, originalId }
      })
    })
  }

  return { rows, corpus }
}

async function readJsonRecords(inputDir: string): Promise<Map<string, RawRecord[]>> {
  const entries = await readdir(inputDir)
  const result = new Map<string, RawRecord[]>()
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json") && !entry.endsWith(".jsonl")) continue
    const filePath = path.join(inputDir, entry)
    const subset = path.basename(entry).replace(/\.jsonl?$/u, "")
    const text = await readFile(filePath, "utf-8")
    const rows = entry.endsWith(".jsonl")
      ? text.split(/\r?\n/u).filter((line) => line.trim()).map((line) => JSON.parse(line) as RawRecord)
      : normalizeJsonFile(JSON.parse(text))
    result.set(subset, rows)
  }
  if (result.size === 0) throw new Error(`ChatRAG Bench input directory has no .json or .jsonl files: ${inputDir}`)
  return result
}

function normalizeJsonFile(value: unknown): RawRecord[] {
  if (Array.isArray(value)) return value as RawRecord[]
  if (isRecord(value)) {
    if (Array.isArray(value.data)) return value.data as RawRecord[]
    if (Array.isArray(value.conversations)) return value.conversations as RawRecord[]
    if (Array.isArray(value.records)) return value.records as RawRecord[]
  }
  throw new Error("ChatRAG Bench JSON file must be an array or an object with data/conversations/records array")
}

function convertTurns(rawTurns: unknown[], options: {
  subset: string
  conversationId: string
  originalId?: string
  defaultFileName?: string
}): ConversationTurn[] {
  return rawTurns.map((value, index) => {
    if (!isRecord(value)) throw new Error(`Invalid turn in ${options.conversationId}`)
    const answer = stringValue(value.answer) ?? stringValue(value.referenceAnswer) ?? stringValue(value.reference_answer)
    const expectedFiles = fileList(value.expectedFiles) ?? fileList(value.expected_file_names) ?? (options.defaultFileName ? [options.defaultFileName] : [])
    return {
      turnId: safeId(stringValue(value.turnId) ?? stringValue(value.turn_id) ?? stringValue(value.id) ?? `${options.conversationId}-t${String(index + 1).padStart(2, "0")}`),
      question: required(stringValue(value.question) ?? stringValue(value.query), "question"),
      answerable: booleanValue(value.answerable) ?? Boolean(answer),
      referenceAnswer: answer,
      expectedContains: answer ? selectExpectedSpans(answer) : undefined,
      expectedFiles,
      requiresHistory: booleanValue(value.requiresHistory) ?? index > 0,
      goldStandaloneQuestion: stringValue(value.goldStandaloneQuestion) ?? stringValue(value.standalone_question) ?? stringValue(value.rewrite),
      metadata: {
        subset: options.subset,
        originalId: options.originalId
      }
    }
  })
}

function convertFlatRecord(record: RawRecord, options: {
  subset: string
  conversationId: string
  originalId?: string
  defaultFileName?: string
}): ConversationTurn[] {
  const questions = arrayValue(record.question) ?? arrayValue(record.questions)
  const answers = arrayValue(record.answer) ?? arrayValue(record.answers)
  if (questions) {
    return questions.map((question, index) => {
      const answer = stringValue(answers?.[index])
      return {
        turnId: `${options.conversationId}-t${String(index + 1).padStart(2, "0")}`,
        question: required(stringValue(question), "question"),
        answerable: Boolean(answer),
        referenceAnswer: answer,
        expectedContains: answer ? selectExpectedSpans(answer) : undefined,
        expectedFiles: options.defaultFileName ? [options.defaultFileName] : [],
        requiresHistory: index > 0,
        metadata: {
          subset: options.subset,
          originalId: options.originalId
        }
      }
    })
  }

  const answer = stringValue(record.answer) ?? stringValue(record.referenceAnswer)
  return [{
    turnId: `${options.conversationId}-t01`,
    question: required(stringValue(record.question) ?? stringValue(record.query), "question"),
    answerable: booleanValue(record.answerable) ?? Boolean(answer),
    referenceAnswer: answer,
    expectedContains: answer ? selectExpectedSpans(answer) : undefined,
    expectedFiles: options.defaultFileName ? [options.defaultFileName] : [],
    requiresHistory: false,
    metadata: {
      subset: options.subset,
      originalId: options.originalId
    }
  }]
}

function selectExpectedSpans(answer: string): string[] {
  const spans = answer
    .split(/[.;。]/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8)
    .slice(0, 2)
  return spans.length > 0 ? spans : [answer.trim()].filter(Boolean)
}

function fileList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map((item) => stringValue(item)).filter((item): item is string => Boolean(item))
}

function arrayValue(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`)
  return value
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "_")
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === new URL(`file://${process.argv[1]}`).href : false
}
