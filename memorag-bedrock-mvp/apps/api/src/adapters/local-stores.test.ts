import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "./local-object-store.js"
import { LocalConversationHistoryStore } from "./local-conversation-history-store.js"
import { LocalQuestionStore } from "./local-question-store.js"
import { LocalVectorStore } from "./local-vector-store.js"

test("local object store writes, lists nested keys, reads, and deletes objects", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-object-test-"))
  const store = new LocalObjectStore(dataDir)

  assert.deepEqual(await store.listKeys("manifests/"), [])
  await store.putText("/manifests/doc-1.json", "{\"ok\":true}")
  await store.putText("manifests/nested/doc-2.json", "{\"ok\":true}")

  assert.deepEqual((await store.listKeys("manifests/")).sort(), ["manifests/doc-1.json", "manifests/nested/doc-2.json"])
  assert.equal(await store.getText("manifests/doc-1.json"), "{\"ok\":true}")

  await store.deleteObject("manifests/doc-1.json")
  assert.deepEqual(await store.listKeys("manifests/"), ["manifests/nested/doc-2.json"])
})

test("local vector store upserts, filters, ranks, and deletes vectors", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-vector-test-"))
  const store = new LocalVectorStore(dataDir)

  await store.put([])
  await store.put([
    {
      key: "doc-1-chunk",
      vector: [1, 0],
      metadata: {
        kind: "chunk",
        documentId: "doc-1",
        fileName: "a.txt",
        chunkId: "chunk-0001",
        text: "A",
        createdAt: "2026-04-30T00:00:00.000Z"
      }
    },
    {
      key: "doc-2-memory",
      vector: [0, 1],
      metadata: {
        kind: "memory",
        documentId: "doc-2",
        fileName: "b.txt",
        memoryId: "memory-0001",
        text: "B",
        createdAt: "2026-04-30T00:00:00.000Z"
      }
    }
  ])
  await store.put([
    {
      key: "doc-1-chunk",
      vector: [0.9, 0.1],
      metadata: {
        kind: "chunk",
        documentId: "doc-1",
        fileName: "a.txt",
        chunkId: "chunk-0001",
        text: "A updated",
        createdAt: "2026-04-30T00:00:01.000Z"
      }
    }
  ])

  const chunkHits = await store.query([1, 0], 5, { kind: "chunk", documentId: "doc-1" })
  assert.equal(chunkHits.length, 1)
  assert.equal(chunkHits[0]?.metadata.text, "A updated")
  assert.ok((chunkHits[0]?.score ?? 0) > 0.9)

  const zeroHits = await store.query([0, 0], 5)
  assert.equal(zeroHits[0]?.score, 0)

  await store.delete([])
  await store.delete(["doc-1-chunk"])
  assert.deepEqual((await store.query([1, 0], 5)).map((hit) => hit.key), ["doc-2-memory"])
})

test("local question store creates, lists, answers, resolves, and rejects missing questions", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-question-test-"))
  const store = new LocalQuestionStore(dataDir)

  assert.deepEqual(await store.list(), [])

  const question = await store.create({
    title: "資料外の確認",
    question: "担当者へ確認してください。",
    requesterName: "  ",
    requesterDepartment: "  ",
    assigneeDepartment: "  ",
    category: "  ",
    sourceQuestion: "資料外の質問は？",
    chatAnswer: "資料からは回答できません。"
  })

  assert.equal(question.status, "open")
  assert.equal(question.requesterName, "山田 太郎")
  assert.equal(question.assigneeDepartment, "総務部")
  assert.equal((await store.get(question.questionId))?.questionId, question.questionId)
  assert.deepEqual((await store.list()).map((item) => item.questionId), [question.questionId])

  const answered = await store.answer(question.questionId, {
    answerTitle: "回答",
    answerBody: "担当者の確認結果です。",
    responderName: "  ",
    responderDepartment: "  ",
    references: "社内確認",
    internalMemo: "memo",
    notifyRequester: false
  })
  assert.equal(answered.status, "answered")
  assert.equal(answered.responderName, "佐藤 花子")
  assert.equal(answered.responderDepartment, "総務部")
  assert.equal(answered.notifyRequester, false)

  const resolved = await store.resolve(question.questionId)
  assert.equal(resolved.status, "resolved")
  assert.ok(resolved.resolvedAt)
  await assert.rejects(() => store.answer("missing", { answerTitle: "x", answerBody: "y" }), /Question not found/)
})

test("local conversation history store persists per-user conversations and deletes them", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-history-test-"))
  const store = new LocalConversationHistoryStore(dataDir)

  assert.deepEqual(await store.list("user-1"), [])

  await store.save("user-1", {
    id: "conversation-1",
    title: "分類について",
    updatedAt: "2026-05-02T00:00:00.000Z",
    messages: [{ role: "user", text: "分類は？", createdAt: "2026-05-02T00:00:00.000Z" }]
  })
  await store.save("user-2", {
    id: "conversation-2",
    title: "別ユーザー",
    updatedAt: "2026-05-02T00:00:01.000Z",
    messages: [{ role: "user", text: "見えない会話", createdAt: "2026-05-02T00:00:01.000Z" }]
  })
  await store.save("user-1", {
    id: "conversation-1",
    title: "分類について更新",
    updatedAt: "2026-05-02T00:00:02.000Z",
    messages: [
      { role: "user", text: "分類は？", createdAt: "2026-05-02T00:00:00.000Z" },
      { role: "assistant", text: "製品要求とプロジェクト要求です。", createdAt: "2026-05-02T00:00:02.000Z" }
    ]
  })

  const history = await store.list("user-1")
  assert.equal(history.length, 1)
  assert.equal(history[0]?.schemaVersion, 1)
  assert.equal(history[0]?.title, "分類について更新")
  assert.equal(history[0]?.messages.length, 2)

  await store.delete("user-1", "conversation-1")
  assert.deepEqual(await store.list("user-1"), [])
  assert.equal((await store.list("user-2")).length, 1)
})
