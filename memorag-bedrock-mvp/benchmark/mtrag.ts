import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

type MtragRawConversation = {
  conversation_id?: string
  conversationId?: string
  id?: string
  domain?: string
  language?: string
  turns?: MtragRawTurn[]
  messages?: MtragRawTurn[]
}

type MtragRawTurn = {
  turn_id?: string
  turnId?: string
  id?: string
  question?: string
  query?: string
  answer?: string
  reference_answer?: string
  referenceAnswer?: string
  answerable?: boolean
  evidence?: MtragRawEvidence[]
  evidences?: MtragRawEvidence[]
  documents?: MtragRawEvidence[]
  standalone_question?: string
  standaloneQuestion?: string
  goldStandaloneQuestion?: string
}

type MtragRawEvidence = {
  doc_id?: string
  docId?: string
  id?: string
  title?: string
  text?: string
  passage?: string
  content?: string
}

type ConversationDatasetRow = {
  conversationId: string
  sourceDataset: "mtrag"
  language: string
  turns: ConversationTurn[]
  metadata?: Record<string, unknown>
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
  metadata?: Record<string, unknown>
}

const defaultDatasetOutput = ".local-data/mtrag/dataset.jsonl"
const defaultCorpusDir = ".local-data/mtrag/corpus"

if (isMainModule()) {
  await prepareMtragBenchmark(process.env)
}

export async function prepareMtragBenchmark(env: NodeJS.ProcessEnv): Promise<void> {
  const inputPath = requiredEnv(env.MTRAG_INPUT, "MTRAG_INPUT")
  const datasetOutput = env.MTRAG_DATASET_OUTPUT ?? defaultDatasetOutput
  const corpusDir = env.MTRAG_CORPUS_DIR ?? defaultCorpusDir
  const raw = JSON.parse(await readFile(inputPath, "utf-8")) as unknown
  const { rows, corpus } = convertMtragBenchmark(raw)

  await mkdir(path.dirname(datasetOutput), { recursive: true })
  await mkdir(corpusDir, { recursive: true })
  await writeFile(datasetOutput, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")
  for (const doc of corpus.values()) {
    await writeFile(path.join(corpusDir, doc.fileName), doc.text, "utf-8")
  }
  console.log(`Wrote ${rows.length} MTRAG conversations to ${datasetOutput}`)
  console.log(`Wrote ${corpus.size} MTRAG corpus documents to ${corpusDir}`)
}

export function convertMtragBenchmark(raw: unknown): {
  rows: ConversationDatasetRow[]
  corpus: Map<string, { fileName: string; text: string }>
} {
  const conversations = normalizeRawConversations(raw)
  const corpus = new Map<string, { fileName: string; text: string }>()
  const rows: ConversationDatasetRow[] = conversations.map((conversation, conversationIndex) => {
    const conversationId = safeId(
      conversation.conversation_id ?? conversation.conversationId ?? conversation.id ?? `mtrag-${String(conversationIndex + 1).padStart(6, "0")}`
    )
    const rawTurns = conversation.turns ?? conversation.messages ?? []
    if (rawTurns.length === 0) throw new Error(`MTRAG conversation has no turns: ${conversationId}`)
    const turns = rawTurns.map((turn, turnIndex) => {
      const evidence = turn.evidence ?? turn.evidences ?? turn.documents ?? []
      const expectedFiles: string[] = []
      for (const [evidenceIndex, item] of evidence.entries()) {
        const docId = safeId(item.doc_id ?? item.docId ?? item.id ?? `${conversationId}-doc-${turnIndex + 1}-${evidenceIndex + 1}`)
        const fileName = `${docId}.md`
        expectedFiles.push(fileName)
        if (!corpus.has(fileName)) {
          corpus.set(fileName, {
            fileName,
            text: [
              `# ${item.title ?? docId}`,
              "",
              "Source dataset: MTRAG",
              `Original document id: ${docId}`,
              "",
              item.text ?? item.passage ?? item.content ?? ""
            ].join("\n")
          })
        }
      }
      const answer = turn.answer ?? turn.reference_answer ?? turn.referenceAnswer
      return {
        turnId: safeId(turn.turn_id ?? turn.turnId ?? turn.id ?? `${conversationId}-t${String(turnIndex + 1).padStart(2, "0")}`),
        question: required(turn.question ?? turn.query, "question"),
        answerable: turn.answerable ?? Boolean(answer),
        referenceAnswer: answer,
        expectedContains: answer ? selectExpectedSpans(answer) : undefined,
        expectedFiles,
        requiresHistory: turnIndex > 0,
        goldStandaloneQuestion: turn.standalone_question ?? turn.standaloneQuestion ?? turn.goldStandaloneQuestion,
        metadata: {
          domain: conversation.domain
        }
      }
    })
    return {
      conversationId,
      sourceDataset: "mtrag" as const,
      language: conversation.language ?? "en",
      turns,
      metadata: { domain: conversation.domain }
    }
  })
  return { rows, corpus }
}

function normalizeRawConversations(raw: unknown): MtragRawConversation[] {
  if (Array.isArray(raw)) return raw as MtragRawConversation[]
  if (isRecord(raw)) {
    if (Array.isArray(raw.conversations)) return raw.conversations as MtragRawConversation[]
    if (Array.isArray(raw.data)) return raw.data as MtragRawConversation[]
  }
  throw new Error("MTRAG input must be an array or an object with conversations/data array")
}

function selectExpectedSpans(answer: string): string[] {
  const spans = answer
    .split(/[.;。]/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8)
    .slice(0, 2)
  return spans.length > 0 ? spans : [answer.trim()].filter(Boolean)
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "_")
}

function required(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${name}`)
  return value.trim()
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === new URL(`file://${process.argv[1]}`).href : false
}
