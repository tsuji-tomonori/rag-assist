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
import { createDebugTraceDownloadMetadata, MemoRagService } from "./memorag-service.js"

test("service ingests text, lists manifests, persists debug traces, and deletes all document vectors", async () => {
  const { service, dataDir } = await createService()

  const manifest = await service.ingest({
    fileName: "requirements.txt",
    text: "ソフトウェア要求の分類。ソフトウェア製品要求、ソフトウェアプロジェクト要求、機能要求、非機能要求、技術制約、サービス品質制約。",
    metadata: { owner: "qa" }
  })

  assert.equal(manifest.fileName, "requirements.txt")
  assert.equal(manifest.chunkCount, 1)
  assert.equal(manifest.memoryCardCount, 1)
  assert.ok(manifest.evidenceVectorKeys?.length)
  assert.ok(manifest.memoryVectorKeys?.length)

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
  assert.equal(answer.debug?.steps.at(-1)?.label, "finalize_response")
  assert.match(String(answer.debug?.steps.at(-1)?.output?.answer ?? ""), /ソフトウェア要求/)

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
