import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdtemp } from "node:fs/promises"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import type { DebugTrace } from "../types.js"
import { createDebugTraceDownloadMetadata, formatDebugTraceJson, MemoRagService } from "./memorag-service.js"

test("service ingests text, lists manifests, persists debug traces, and deletes all document vectors", async () => {
  const { service, dataDir } = await createService()

  const manifest = await service.ingest({
    fileName: "requirements.txt",
    text: "ソフトウェア要求の分類。ソフトウェア製品要求、ソフトウェアプロジェクト要求、機能要求、非機能要求、技術制約、サービス品質制約。",
    metadata: { owner: "qa" }
  })

  assert.equal(manifest.fileName, "requirements.txt")
  assert.equal(manifest.chunkCount, 1)
  assert.ok(manifest.memoryCardCount >= 1)
  assert.ok(manifest.evidenceVectorKeys?.length)
  assert.ok(manifest.memoryVectorKeys?.length)
  assert.equal(manifest.pipelineVersions?.chunkerVersion, "chunk-text-v1")
  assert.ok(manifest.chunks?.[0]?.chunkHash)

  const listed = await service.listDocuments()
  assert.deepEqual(listed.map((doc) => doc.documentId), [manifest.documentId])

  const answer = await service.chat({
    question: "ソフトウェア要求の分類を洗い出して",
    includeDebug: true,
    minScore: 0.01
  })
  assert.equal(answer.isAnswerable, true)
  assert.ok(answer.debug?.runId)
  assert.equal(answer.debug?.schemaVersion, 1)
  assert.equal(answer.debug?.pipelineVersions?.promptVersion, "rag-prompts-v1")
  assert.equal(answer.debug?.steps.at(-1)?.label, "finalize_response")
  assert.match(String(answer.debug?.steps.at(-1)?.output?.answer ?? ""), /ソフトウェア製品要求|分類/)

  const debugRuns = await service.listDebugRuns()
  assert.equal(debugRuns.length, 1)
  assert.deepEqual(await service.getDebugRun(answer.debug?.runId ?? ""), debugRuns[0])

  const deleted = await service.deleteDocument(manifest.documentId)
  assert.equal(deleted.documentId, manifest.documentId)
  assert.equal(deleted.deletedVectorCount, manifest.vectorKeys.length)
  assert.deepEqual(await service.listDocuments(), [])

  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as { records: unknown[] }
  const memoryDb = JSON.parse(await readFile(path.join(dataDir, "memory-vectors.json"), "utf-8")) as { records: unknown[] }
  assert.equal(evidenceDb.records.length, 0)
  assert.equal(memoryDb.records.length, 0)
})

test("service rejects empty uploads and missing documents", async () => {
  const { service } = await createService()

  await assert.rejects(() => service.ingest({ fileName: "empty.txt", text: "   " }), /extractable text|No chunks/)
  await assert.rejects(() => service.deleteDocument("missing-document-id"))
  assert.equal(await service.getDebugRun("missing-run"), undefined)
})

test("service reindexes documents through embedding cache compatible pipeline versions", async () => {
  const { service } = await createService()
  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "# 申請手順\n申請期限は翌月5営業日です。\n\n# 例外\n例外承認者は部長です。",
    metadata: { tenantId: "tenant-a" }
  })

  assert.ok(manifest.chunks?.some((chunk) => chunk.sectionPath?.includes("申請手順")))
  const reindexed = await service.reindexDocument(manifest.documentId)
  assert.notEqual(reindexed.documentId, manifest.documentId)
  assert.equal(reindexed.metadata?.reindexedFromDocumentId, manifest.documentId)
  assert.equal(reindexed.embeddingModelId, manifest.embeddingModelId)
  assert.ok(reindexed.memoryCardCount >= manifest.memoryCardCount)
})

test("service manages reviewed alias artifacts and audit log", async () => {
  const { service, dataDir } = await createService()
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }

  const alias = await service.createAlias(actor, {
    term: "PTO",
    expansions: ["有給休暇", "休暇申請"],
    scope: { tenantId: "tenant-a" }
  })
  assert.equal(alias.status, "draft")
  assert.equal(alias.term, "pto")

  const updated = await service.updateAlias(actor, alias.aliasId, { expansions: ["年次有給休暇"] })
  assert.deepEqual(updated?.expansions, ["年次有給休暇"])

  const reviewed = await service.reviewAlias(actor, alias.aliasId, { decision: "approve", comment: "社内用語として確認済み" })
  assert.equal(reviewed?.status, "approved")

  const published = await service.publishAliases(actor)
  assert.equal(published.aliasCount, 1)
  assert.match(published.version, /^alias_/)

  const audit = await service.listAliasAuditLog()
  assert.deepEqual(audit.map((item) => item.action).sort(), ["create", "publish", "review", "update"])

  const latest = JSON.parse(await readFile(path.join(dataDir, "objects", "aliases", "latest.json"), "utf-8")) as { objectKey: string }
  assert.match(latest.objectKey, /^aliases\/alias_/)
})

test("service delegates human question lifecycle to the question store", async () => {
  const { service } = await createService()

  const question = await service.createQuestion({
    title: "資料外の質問",
    question: "担当者へ確認してください。",
    sourceQuestion: "資料外の質問は？",
    chatAnswer: "資料からは回答できません。"
  })
  assert.equal(question.status, "open")
  assert.equal((await service.listQuestions())[0]?.questionId, question.questionId)
  assert.equal((await service.getQuestion(question.questionId))?.questionId, question.questionId)

  const answered = await service.answerQuestion(question.questionId, {
    answerTitle: "回答",
    answerBody: "担当者の確認結果です。",
    references: "社内確認"
  })
  assert.equal(answered.status, "answered")
  assert.equal(answered.answerBody, "担当者の確認結果です。")

  const resolved = await service.resolveQuestion(question.questionId)
  assert.equal(resolved.status, "resolved")
})

test("service chat returns refusal and error debug trace when external dependencies fail", async () => {
  const { service } = await createService({
    textModel: new MockBedrockTextModel({ embed: new Error("Bedrock embed timeout") }),
    evidenceQueryError: new Error("Vector query failed"),
    objectGetErrorPrefix: "debug-runs/",
    objectGetError: new Error("S3 get failed")
  })

  const result = await service.chat({
    question: "仕様は？",
    includeDebug: true
  })

  assert.equal(result.isAnswerable, false)
  assert.equal(result.answer, "資料からは回答できません。")
  assert.equal(result.debug?.status, "warning")
  const errorStep = result.debug?.steps.find((step) => step.status === "error")
  assert.ok(errorStep)
  assert.match(errorStep?.detail ?? "", /Bedrock embed timeout|Vector query failed/)
  await assert.rejects(() => service.listDebugRuns(), /S3 get failed/)
})

test("debug trace download metadata forces attachment and sanitizes the file name", () => {
  const metadata = createDebugTraceDownloadMetadata("run/with:unsafe*chars")

  assert.deepEqual(metadata, {
    fileName: "debug-trace-run_with_unsafe_chars.json",
    objectKey: "downloads/debug-trace-run_with_unsafe_chars.json",
    contentDisposition: 'attachment; filename="debug-trace-run_with_unsafe_chars.json"'
  })
})

test("debug trace JSON for answerable runs matches the v1 schema example", () => {
  const trace: DebugTrace = {
    schemaVersion: 1,
    runId: "run_answerable",
    question: "期限はいつですか？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:01.000Z",
    totalLatencyMs: 1000,
    status: "success",
    answerPreview: "期限は翌月5営業日までです。",
    isAnswerable: true,
    citations: [
      {
        documentId: "doc-1",
        fileName: "policy.txt",
        chunkId: "chunk-0001",
        score: 0.91,
        text: "申請期限は翌月5営業日までです。"
      }
    ],
    retrieved: [
      {
        documentId: "doc-1",
        fileName: "policy.txt",
        chunkId: "chunk-0001",
        score: 0.91,
        text: "申請期限は翌月5営業日までです。"
      }
    ],
    steps: [
      {
        id: 1,
        label: "retrieve_memory",
        status: "success",
        latencyMs: 12,
        modelId: "amazon.titan-embed-text-v2:0",
        summary: "memory hits=1",
        output: {
          memoryCards: [
            {
              key: "doc-1-memory-0000",
              score: 0.8,
              metadata: {
                kind: "memory",
                documentId: "doc-1",
                fileName: "policy.txt",
                memoryId: "memory-0000",
                text: "Summary: 申請期限",
                createdAt: "2026-05-01T00:00:00.000Z"
              }
            }
          ]
        },
        hitCount: 1,
        startedAt: "2026-05-02T00:00:00.000Z",
        completedAt: "2026-05-02T00:00:00.012Z"
      },
      {
        id: 2,
        label: "finalize_response",
        status: "success",
        latencyMs: 3,
        summary: "finalized",
        detail: "期限は翌月5営業日までです。",
        output: {
          answer: "期限は翌月5営業日までです。"
        },
        tokenCount: 10,
        startedAt: "2026-05-02T00:00:00.997Z",
        completedAt: "2026-05-02T00:00:01.000Z"
      }
    ]
  }

  assert.equal(formatDebugTraceJson(trace), `{
  "schemaVersion": 1,
  "runId": "run_answerable",
  "question": "期限はいつですか？",
  "modelId": "amazon.nova-lite-v1:0",
  "embeddingModelId": "amazon.titan-embed-text-v2:0",
  "clueModelId": "amazon.nova-lite-v1:0",
  "topK": 6,
  "memoryTopK": 4,
  "minScore": 0.2,
  "startedAt": "2026-05-02T00:00:00.000Z",
  "completedAt": "2026-05-02T00:00:01.000Z",
  "totalLatencyMs": 1000,
  "status": "success",
  "answerPreview": "期限は翌月5営業日までです。",
  "isAnswerable": true,
  "citations": [
    {
      "documentId": "doc-1",
      "fileName": "policy.txt",
      "chunkId": "chunk-0001",
      "score": 0.91,
      "text": "申請期限は翌月5営業日までです。"
    }
  ],
  "retrieved": [
    {
      "documentId": "doc-1",
      "fileName": "policy.txt",
      "chunkId": "chunk-0001",
      "score": 0.91,
      "text": "申請期限は翌月5営業日までです。"
    }
  ],
  "steps": [
    {
      "id": 1,
      "label": "retrieve_memory",
      "status": "success",
      "latencyMs": 12,
      "modelId": "amazon.titan-embed-text-v2:0",
      "summary": "memory hits=1",
      "output": {
        "memoryCards": [
          {
            "key": "doc-1-memory-0000",
            "score": 0.8,
            "metadata": {
              "kind": "memory",
              "documentId": "doc-1",
              "fileName": "policy.txt",
              "memoryId": "memory-0000",
              "text": "Summary: 申請期限",
              "createdAt": "2026-05-01T00:00:00.000Z"
            }
          }
        ]
      },
      "hitCount": 1,
      "startedAt": "2026-05-02T00:00:00.000Z",
      "completedAt": "2026-05-02T00:00:00.012Z"
    },
    {
      "id": 2,
      "label": "finalize_response",
      "status": "success",
      "latencyMs": 3,
      "summary": "finalized",
      "detail": "期限は翌月5営業日までです。",
      "output": {
        "answer": "期限は翌月5営業日までです。"
      },
      "tokenCount": 10,
      "startedAt": "2026-05-02T00:00:00.997Z",
      "completedAt": "2026-05-02T00:00:01.000Z"
    }
  ]
}`)
})

test("debug trace JSON for refusal runs matches the v1 schema example", () => {
  const trace: DebugTrace = {
    schemaVersion: 1,
    runId: "run_refusal",
    question: "資料にない制度は？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:00.200Z",
    totalLatencyMs: 200,
    status: "warning",
    answerPreview: "資料からは回答できません。",
    isAnswerable: false,
    citations: [],
    retrieved: [],
    steps: [
      {
        id: 1,
        label: "answerability_gate",
        status: "warning",
        latencyMs: 8,
        summary: "answerable=false, reason=no_relevant_chunks",
        detail: "reason=no_relevant_chunks\nconfidence=0",
        output: {
          answerability: {
            isAnswerable: false,
            reason: "no_relevant_chunks",
            confidence: 0
          },
          answer: "資料からは回答できません。",
          citations: []
        },
        startedAt: "2026-05-02T00:00:00.100Z",
        completedAt: "2026-05-02T00:00:00.108Z"
      }
    ]
  }

  assert.deepEqual(JSON.parse(formatDebugTraceJson(trace)), {
    schemaVersion: 1,
    runId: "run_refusal",
    question: "資料にない制度は？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:00.200Z",
    totalLatencyMs: 200,
    status: "warning",
    answerPreview: "資料からは回答できません。",
    isAnswerable: false,
    citations: [],
    retrieved: [],
    steps: [
      {
        id: 1,
        label: "answerability_gate",
        status: "warning",
        latencyMs: 8,
        summary: "answerable=false, reason=no_relevant_chunks",
        detail: "reason=no_relevant_chunks\nconfidence=0",
        output: {
          answerability: {
            isAnswerable: false,
            reason: "no_relevant_chunks",
            confidence: 0
          },
          answer: "資料からは回答できません。",
          citations: []
        },
        startedAt: "2026-05-02T00:00:00.100Z",
        completedAt: "2026-05-02T00:00:00.108Z"
      }
    ]
  })
})

test("service ingest falls back when memory JSON parse fails and surfaces generate timeout", async () => {
  const { service: parseFallbackService } = await createService({
    textModel: new MockBedrockTextModel({ invalidJsonOnGenerate: true })
  })
  const manifest = await parseFallbackService.ingest({
    fileName: "doc.txt",
    text: "これは要件定義の本文です。"
  })
  assert.equal(manifest.memoryCardCount, 1)

  const { service: timeoutService } = await createService({
    textModel: new MockBedrockTextModel({ generate: new Error("Bedrock generate timeout") })
  })
  await assert.rejects(
    () => timeoutService.ingest({ fileName: "doc.txt", text: "これは要件定義の本文です。" }),
    /Bedrock generate timeout/
  )
})

async function createService(options: {
  textModel?: MockBedrockTextModel
  evidenceQueryError?: Error
  objectGetErrorPrefix?: string
  objectGetError?: Error
} = {}): Promise<{ service: MemoRagService; dataDir: string }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-service-test-"))
  const baseObjectStore = new LocalObjectStore(dataDir)
  const baseEvidenceStore = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const deps = {
    objectStore: {
      putText: (...args: Parameters<LocalObjectStore["putText"]>) => baseObjectStore.putText(...args),
      getText: async (key: string) => {
        if (options.objectGetError && options.objectGetErrorPrefix && key.startsWith(options.objectGetErrorPrefix)) {
          throw options.objectGetError
        }
        return baseObjectStore.getText(key)
      },
      deleteObject: (...args: Parameters<LocalObjectStore["deleteObject"]>) => baseObjectStore.deleteObject(...args),
      listKeys: (...args: Parameters<LocalObjectStore["listKeys"]>) => baseObjectStore.listKeys(...args)
    },
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    evidenceVectorStore: {
      put: (...args: Parameters<LocalVectorStore["put"]>) => baseEvidenceStore.put(...args),
      query: async (...args: Parameters<LocalVectorStore["query"]>) => {
        if (options.evidenceQueryError) throw options.evidenceQueryError
        return baseEvidenceStore.query(...args)
      },
      delete: (...args: Parameters<LocalVectorStore["delete"]>) => baseEvidenceStore.delete(...args)
    },
    textModel: options.textModel ?? new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir)
  } as unknown as Dependencies
  return { service: new MemoRagService(deps), dataDir }
}
