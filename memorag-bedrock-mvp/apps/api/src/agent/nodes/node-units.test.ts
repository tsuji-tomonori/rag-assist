import assert from "node:assert/strict"
import test from "node:test"
import type { Dependencies } from "../../dependencies.js"
import type { RetrievedVector } from "../../types.js"
import { MockBedrockTextModel } from "../../adapters/mock-bedrock.js"
import { answerabilityGate } from "./answerability-gate.js"
import { createEmbedQueriesNode } from "./embed-queries.js"
import { finalizeResponse } from "./finalize-response.js"
import { createGenerateCluesNode } from "./generate-clues.js"
import { createRetrieveMemoryNode } from "./retrieve-memory.js"
import { rerankChunks } from "./rerank-chunks.js"
import { createSearchEvidenceNode } from "./search-evidence.js"
import { validateCitations } from "./validate-citations.js"
import { NO_ANSWER, type QaAgentState } from "../state.js"
import { tracedNode } from "../trace.js"
import type { DebugStep } from "../../types.js"

const chunk: RetrievedVector = {
  key: "doc-1-chunk-0001",
  score: 0.9,
  metadata: {
    kind: "chunk",
    documentId: "doc-1",
    fileName: "doc.txt",
    chunkId: "chunk-0001",
    text: "申請期限は翌月5営業日です。金額は5,000円です。申請システムから提出します。",
    createdAt: "2026-04-30T00:00:00.000Z"
  }
}

test("answerability gate covers no hit, low score, missing fact, and sufficient evidence branches", async () => {
  assert.equal((await answerabilityGate(state({ selectedChunks: [] }))).answerability?.reason, "no_relevant_chunks")
  assert.equal((await answerabilityGate(state({ selectedChunks: [{ ...chunk, score: 0.1 }], minScore: 0.2 }))).answerability?.reason, "low_similarity_score")
  assert.equal((await answerabilityGate(state({ question: "金額はいくらですか？", selectedChunks: [{ ...chunk, metadata: { ...chunk.metadata, text: "期限は翌月です。" } }] }))).answerability?.reason, "missing_required_fact")
  assert.equal((await answerabilityGate(state({ question: "申請方法と期限と金額は？", selectedChunks: [chunk] }))).answerability?.reason, "sufficient_evidence")
})

test("classification answers require actual requirements classification terms", async () => {
  const outlineChunk = {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      text: "2 Requirements Elicitation\n4.3 ATDD\nBDD\n4.4 UMLSysML\n5 Requirements Validation\n6.1 Requirements Scrubbing\n7.2 Kano"
    }
  }
  const classificationChunk = {
    ...chunk,
    key: "doc-1-chunk-0009",
    score: 0.3,
    metadata: {
      ...chunk.metadata,
      chunkId: "chunk-0009",
      text: "ソフトウェア要求の分類: ソフトウェア製品要求、ソフトウェアプロジェクト要求、機能要求、非機能要求、技術制約、サービス品質制約。"
    }
  }

  assert.equal(
    (await answerabilityGate(state({ question: "ソフトウェア要求の分類を洗い出して", selectedChunks: [outlineChunk] }))).answerability?.reason,
    "missing_required_fact"
  )

  assert.equal(
    (await answerabilityGate(state({ question: "ソフトウェア要求の分類を洗い出して", selectedChunks: [classificationChunk] }))).answerability?.reason,
    "sufficient_evidence"
  )

  assert.deepEqual(
    (await rerankChunks(state({ question: "ソフトウェア要求の分類を洗い出して", topK: 1, retrievedChunks: [outlineChunk, classificationChunk] }))).selectedChunks?.map(
      (selected) => selected.key
    ),
    ["doc-1-chunk-0009"]
  )
})

test("citation validation accepts used ids and rejects invalid or ungrounded answers", async () => {
  const ok = await validateCitations(
    state({
      selectedChunks: [chunk],
      rawAnswer: JSON.stringify({ isAnswerable: true, answer: "翌月5営業日です。", usedChunkIds: ["chunk-0001"] })
    })
  )
  assert.equal(ok.answer, "翌月5営業日です。")
  assert.equal(ok.citations?.length, 1)

  assert.equal((await validateCitations(state({ rawAnswer: "not-json" }))).answer, NO_ANSWER)
  assert.equal((await validateCitations(state({ rawAnswer: JSON.stringify({ isAnswerable: false }) }))).answer, NO_ANSWER)
  assert.equal(
    (await validateCitations(state({ selectedChunks: [chunk], rawAnswer: JSON.stringify({ isAnswerable: true, answer: "根拠なし", usedChunkIds: ["missing"] }) }))).answerability
      ?.reason,
    "citation_validation_failed"
  )
  assert.equal(
    (
      await validateCitations(
        state({
          question: "ソフトウェア要求の分類を洗い出して",
          selectedChunks: [chunk],
          rawAnswer: JSON.stringify({ isAnswerable: true, answer: "1. Requirements Elicitation\n2. BDD", usedChunkIds: ["chunk-0001"] })
        })
      )
    ).answerability?.reason,
    "citation_validation_failed"
  )
})

test("finalize response preserves grounded answers and converts invalid final states to refusals", async () => {
  assert.deepEqual(await finalizeResponse(state({ answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.9 }, answer: "  OK  " })), {
    answer: "OK"
  })
  assert.equal(
    (await finalizeResponse(state({ answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.4 }, answer: NO_ANSWER }))).answerability?.reason,
    "citation_validation_failed"
  )
  assert.equal(
    (await finalizeResponse(state({ answerability: { isAnswerable: false, reason: "low_similarity_score", confidence: 0.1 } }))).answerability?.reason,
    "low_similarity_score"
  )
})

test("query nodes handle memory-disabled, fallback, generated clue, and search merge paths", async () => {
  const deps = createDeps()
  assert.deepEqual(await createRetrieveMemoryNode(deps)(state({ useMemory: false })), { memoryCards: [] })

  const noMemoryClues = await createGenerateCluesNode(deps)(state({ memoryCards: [] }))
  assert.deepEqual(noMemoryClues, { clues: [], expandedQueries: ["question"] })

  const generatedClues = await createGenerateCluesNode(deps)(state({ memoryCards: [{ ...chunk, metadata: { ...chunk.metadata, kind: "memory", memoryId: "memory-1" } }] }))
  assert.ok((generatedClues.expandedQueries?.length ?? 0) > 1)

  const fallbackEmbeddings = await createEmbedQueriesNode(deps)(state({ expandedQueries: [] }))
  assert.equal(fallbackEmbeddings.queryEmbeddings?.length, 1)

  const search = await createSearchEvidenceNode(deps)(state({ queryEmbeddings: [{ query: "q", vector: [1, 0] }] }))
  assert.deepEqual(search.retrievedChunks?.map((hit) => hit.key), ["doc-1-chunk-0001"])
})

test("traced node records success, warning, model ids, details, and thrown errors", async () => {
  const success = await tracedNode("search_evidence", async () => ({ retrievedChunks: [chunk] }))(state({ trace: [] }))
  const successTrace = success.trace as unknown as DebugStep
  assert.equal(successTrace.status, "success")
  assert.equal(successTrace.modelId, "embed")
  assert.equal(successTrace.hitCount, 1)
  assert.match(successTrace.detail ?? "", /doc.txt/)

  const warning = await tracedNode("generate_answer", async () => ({ answer: NO_ANSWER }))(state({ trace: [] }))
  const warningTrace = warning.trace as unknown as DebugStep
  assert.equal(warningTrace.status, "warning")
  assert.equal(warningTrace.tokenCount, 4)

  const error = await tracedNode("generate_clues", async () => {
    throw new Error("boom")
  })(state({ trace: [] }))
  const errorTrace = error.trace as unknown as DebugStep
  assert.equal(error.answer, NO_ANSWER)
  assert.equal(errorTrace.status, "error")
  assert.equal(errorTrace.modelId, undefined)
})

function createDeps(): Dependencies {
  return {
    objectStore: {
      putText: async () => undefined,
      getText: async () => "",
      deleteObject: async () => undefined,
      listKeys: async () => []
    },
    memoryVectorStore: {
      put: async () => undefined,
      query: async () => [{ ...chunk, metadata: { ...chunk.metadata, kind: "memory", memoryId: "memory-1" } }],
      delete: async () => undefined
    },
    evidenceVectorStore: {
      put: async () => undefined,
      query: async () => [chunk, { ...chunk, key: "doc-1-chunk-0001", score: 0.8 }],
      delete: async () => undefined
    },
    textModel: new MockBedrockTextModel(),
    questionStore: {
      create: async () => {
        throw new Error("not used")
      },
      list: async () => [],
      get: async () => undefined,
      answer: async () => {
        throw new Error("not used")
      },
      resolve: async () => {
        throw new Error("not used")
      }
    }
  } as unknown as Dependencies
}

function state(overrides: Record<string, unknown> = {}): QaAgentState {
  return {
    runId: "run",
    question: "question",
    modelId: "model",
    embeddingModelId: "embed",
    clueModelId: "clue",
    useMemory: true,
    debug: false,
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    strictGrounded: true,
    normalizedQuery: undefined,
    memoryCards: [],
    clues: [],
    expandedQueries: [],
    queryEmbeddings: [],
    retrievedChunks: [],
    selectedChunks: [chunk],
    answerability: { isAnswerable: false, reason: "not_checked", confidence: 0 },
    rawAnswer: undefined,
    answer: undefined,
    citations: [],
    trace: [],
    ...overrides
  } as unknown as QaAgentState
}
