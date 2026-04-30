import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdtemp } from "node:fs/promises"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import { MemoRagService } from "./memorag-service.js"

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

async function createService(): Promise<{ service: MemoRagService; dataDir: string }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-service-test-"))
  const deps = {
    objectStore: new LocalObjectStore(dataDir),
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    evidenceVectorStore: new LocalVectorStore(dataDir, "evidence-vectors.json"),
    textModel: new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir)
  } as unknown as Dependencies
  return { service: new MemoRagService(deps), dataDir }
}
