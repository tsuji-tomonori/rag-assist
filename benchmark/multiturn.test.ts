import assert from "node:assert/strict"
import test from "node:test"
import { convertChatRagBenchTurns } from "./chatrag.js"
import { convertMtragTurns } from "./mtrag.js"

test("multi-turn adapters preserve conversation order and history", () => {
  const rows = convertMtragTurns([
    {
      id: "turn-2",
      conversationId: "conv-1",
      turnIndex: 2,
      question: "その例外は？",
      expectedStandaloneQuestion: "経費精算期限の例外条件は？",
      turnDependency: "coreference",
      expectedContains: ["上長承認"]
    },
    {
      id: "turn-1",
      conversationId: "conv-1",
      turnIndex: 1,
      question: "経費精算の期限は？",
      expectedContains: ["30日以内"]
    }
  ])

  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.id, "turn-1")
  assert.equal(rows[1]?.id, "turn-2")
  assert.deepEqual(rows[1]?.history, [{ role: "user", text: "経費精算の期限は？" }])
  assert.equal(rows[1]?.metadata?.benchmarkFamily, "multi-turn-rag")
})

test("ChatRAG adapter marks source dataset metadata", () => {
  const rows = convertChatRagBenchTurns([{
    id: "chat-1",
    conversationId: "chat-conv",
    turnIndex: 1,
    question: "What is the policy?",
    answerable: true
  }])

  assert.equal(rows[0]?.metadata?.sourceDataset, "ChatRAG Bench")
  assert.equal(rows[0]?.expectedResponseType, "answer")
})
