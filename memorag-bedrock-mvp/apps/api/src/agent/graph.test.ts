import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import test from "node:test"
import type { Dependencies } from "../dependencies.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import { MemoRagService } from "../rag/memorag-service.js"

test("LangGraph MemoRAG workflow answers from selected evidence and records fixed trace steps", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "remote-work-policy.txt",
    text: "在宅勤務手当は、月10日以上在宅勤務を実施した従業員に月額5,000円を支給する。申請期限は翌月5営業日までで、勤怠システムから申請する。"
  })

  const result = await service.chat({
    question: "在宅勤務手当の申請期限はいつですか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /翌月5営業日/)
  assert.ok(result.citations.length > 0)
  assert.deepEqual(
    result.debug?.steps.map((step) => step.label),
    [
      "analyze_input",
      "normalize_query",
      "retrieve_memory",
      "generate_clues",
      "plan_search",
      "execute_search_action",
      "evaluate_search_progress",
      "rerank_chunks",
      "answerability_gate",
      "generate_answer",
      "validate_citations",
      "finalize_response"
    ]
  )
  const planStep = result.debug?.steps.find((step) => step.label === "plan_search")
  const actionStep = result.debug?.steps.find((step) => step.label === "execute_search_action")
  assert.match(planStep?.detail ?? "", /requiredFacts:/)
  assert.match(planStep?.detail ?? "", /actions:/)
  assert.match(actionStep?.detail ?? "", /action=evidence_search/)
  assert.match(actionStep?.detail ?? "", /newEvidenceCount=/)
})

test("LangGraph debug trace keeps the full finalize response detail", async () => {
  const deps = await createTestDeps()
  const baseTextModel = deps.textModel
  const longAnswer = `在宅勤務手当の申請期限は翌月5営業日までです。${"詳細説明。".repeat(220)}END_OF_FINALIZE_RESPONSE`
  deps.textModel = {
    embed: baseTextModel.embed.bind(baseTextModel),
    generate: async (prompt, options) => {
      if (prompt.includes("FINAL_ANSWER_JSON")) {
        return JSON.stringify({ isAnswerable: true, answer: longAnswer, usedChunkIds: [] })
      }
      return baseTextModel.generate(prompt, options)
    }
  }
  const service = new MemoRagService(deps)

  await service.ingest({
    fileName: "remote-work-policy.txt",
    text: "在宅勤務手当は、月10日以上在宅勤務を実施した従業員に月額5,000円を支給する。申請期限は翌月5営業日までで、勤怠システムから申請する。"
  })

  const result = await service.chat({
    question: "在宅勤務手当の申請期限はいつですか？",
    includeDebug: true,
    minScore: 0.05
  })

  const finalizeStep = result.debug?.steps.find((step) => step.label === "finalize_response")
  assert.equal(result.answer.endsWith("END_OF_FINALIZE_RESPONSE"), true)
  assert.equal(result.debug?.answerPreview, longAnswer)
  assert.equal(finalizeStep?.detail, longAnswer)
})

test("LangGraph MemoRAG workflow refuses before answer generation when evidence is missing", async () => {
  const service = new MemoRagService(await createTestDeps())

  const result = await service.chat({
    question: "存在しない手当の金額はいくらですか？",
    includeDebug: true,
    minScore: 0.05
  })

  assert.equal(result.isAnswerable, false)
  assert.equal(result.answer, "資料からは回答できません。")
  assert.equal(result.citations.length, 0)
  assert.ok(result.debug)
  assert.equal(result.debug.steps.some((step) => step.label === "generate_answer"), false)
  assert.equal(result.debug.steps.at(-1)?.label, "finalize_refusal")
})

async function createTestDeps(): Promise<Dependencies> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-agent-test-"))
  return {
    objectStore: new LocalObjectStore(dataDir),
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    evidenceVectorStore: new LocalVectorStore(dataDir, "evidence-vectors.json"),
    textModel: new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir)
  }
}


test("LangGraph search cycle loops until maxIterations when retrieval score is too low", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "benefit.txt",
    text: "在宅勤務手当は月額5,000円。"
  })

  const result = await service.chat({
    question: "在宅勤務手当の申請期限はいつですか？",
    includeDebug: true,
    minScore: 0.99,
    maxIterations: 2
  })

  assert.equal(result.isAnswerable, false)
  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(labels.filter((label) => label === "plan_search").length, 2)
  assert.equal(labels.filter((label) => label === "execute_search_action").length, 2)
  assert.equal(labels.filter((label) => label === "evaluate_search_progress").length, 2)
  assert.equal(labels.includes("rerank_chunks"), true)
  assert.equal(labels.at(-1), "finalize_refusal")
})

test("LangGraph search cycle stops after two consecutive no-new-evidence iterations", async () => {
  const service = new MemoRagService(await createTestDeps())

  const result = await service.chat({
    question: "資料にない制度の詳細を教えてください。",
    includeDebug: true,
    minScore: 0.01,
    maxIterations: 5
  })

  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(labels.filter((label) => label === "evaluate_search_progress").length, 2)
  assert.equal(labels.includes("rerank_chunks"), true)
  assert.equal(labels.at(-1), "finalize_refusal")
})
