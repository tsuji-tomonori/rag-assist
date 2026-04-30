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
    minScore: 0.05
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
      "embed_queries",
      "search_evidence",
      "rerank_chunks",
      "answerability_gate",
      "generate_answer",
      "validate_citations",
      "finalize_response"
    ]
  )
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
