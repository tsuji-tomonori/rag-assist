import assert from "node:assert/strict"
import test from "node:test"
import { convertChatRagBench } from "./chatrag-bench.js"
import { convertMtragBenchmark } from "./mtrag.js"
import { evaluateConversationTurn, summarizeConversationResults } from "./metrics/conversation.js"

test("MTRAG adapter converts conversations and evidence to dataset rows and corpus", () => {
  const { rows, corpus } = convertMtragBenchmark([
    {
      conversation_id: "conv 1",
      turns: [
        {
          question: "What is the deadline?",
          answer: "Submit within 30 days.",
          evidence: [{ doc_id: "doc 1", title: "Policy", text: "Submit within 30 days." }]
        },
        {
          question: "Does that apply overseas?",
          answer: "It applies to overseas travel.",
          standalone_question: "Does the deadline apply to overseas travel?",
          evidence: [{ doc_id: "doc 1", title: "Policy", text: "It applies to overseas travel." }]
        }
      ]
    }
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.conversationId, "conv_1")
  assert.equal(rows[0]?.turns[1]?.requiresHistory, true)
  assert.equal(rows[0]?.turns[1]?.goldStandaloneQuestion, "Does the deadline apply to overseas travel?")
  assert.equal(corpus.has("doc_1.md"), true)
})

test("ChatRAG Bench adapter converts subset records to conversation rows", () => {
  const input = new Map([
    ["coqa", [{
      id: "story-1",
      story: "Employees need manager approval. Contractors need sponsor review.",
      questions: ["Who needs manager approval?", "What about contractors?"],
      answers: ["Employees need manager approval.", "Contractors need sponsor review."]
    }]]
  ])
  const { rows, corpus } = convertChatRagBench(input)

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.sourceDataset, "chatrag-bench")
  assert.equal(rows[0]?.turns.length, 2)
  assert.equal(rows[0]?.turns[1]?.requiresHistory, true)
  assert.equal(corpus.size, 1)
})

test("conversation metrics summarize turn, conversation, history, abstention, and retrieval rates", () => {
  const evaluation = evaluateConversationTurn(
    {
      answerable: true,
      expectedContains: ["30 days"],
      expectedFiles: ["policy.md"]
    },
    {
      responseType: "answer",
      answer: "Submit within 30 days.",
      citations: [{ fileName: "policy.md" }],
      retrieved: [{ fileName: "policy.md" }]
    },
    200
  )
  assert.equal(evaluation.answerCorrect, true)
  assert.equal(evaluation.retrievalRecallAtK, true)

  const summary = summarizeConversationResults([
    { conversationId: "conv-1", turnId: "t1", requiresHistory: false, status: 200, evaluation },
    {
      conversationId: "conv-2",
      turnId: "t1",
      requiresHistory: true,
      status: 200,
      evaluation: evaluateConversationTurn(
        { answerable: false, expectedResponseType: "refusal" },
        { responseType: "refusal", answer: "資料からは回答できません。" },
        200
      )
    }
  ])

  assert.equal(summary.totalConversations, 2)
  assert.equal(summary.metrics.turnAnswerCorrectRate, 1)
  assert.equal(summary.metrics.conversationSuccessRate, 1)
  assert.equal(summary.metrics.abstentionAccuracy, 1)
  assert.equal(summary.metrics.retrievalRecallAtK, 1)
})
