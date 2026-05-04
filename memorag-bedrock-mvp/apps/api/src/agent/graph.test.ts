import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import test from "node:test"
import type { Dependencies } from "../dependencies.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import { MemoRagService } from "../rag/memorag-service.js"
import { applyQaAgentUpdate } from "./graph.js"
import type { QaAgentState } from "./state.js"
import type { DebugStep } from "../types.js"

test("fixed MemoRAG workflow answers from selected evidence and records fixed trace steps", async () => {
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
      "clarification_gate",
      "plan_search",
      "execute_search_action",
      "retrieval_evaluator",
      "clarification_gate",
      "evaluate_search_progress",
      "rerank_chunks",
      "answerability_gate",
      "sufficient_context_gate",
      "generate_answer",
      "validate_citations",
      "verify_answer_support",
      "finalize_response"
    ]
  )
  const planStep = result.debug?.steps.find((step) => step.label === "plan_search")
  const actionStep = result.debug?.steps.find((step) => step.label === "execute_search_action")
  assert.match(planStep?.detail ?? "", /requiredFacts:/)
  assert.match(planStep?.detail ?? "", /actions:/)
  assert.match(actionStep?.detail ?? "", /action=evidence_search/)
  assert.match(actionStep?.detail ?? "", /newEvidenceCount=/)
  assert.match(actionStep?.detail ?? "", /retrievalDiagnostics:/)
  assert.match(actionStep?.detail ?? "", /lexicalCount=/)
  assert.match(actionStep?.detail ?? "", /sources=lexical:/)
  const sufficientContextStep = result.debug?.steps.find((step) => step.label === "sufficient_context_gate")
  assert.match(sufficientContextStep?.detail ?? "", /label=ANSWERABLE/)
  assert.match(sufficientContextStep?.detail ?? "", /supportingChunkIds:/)
  const retrievalStep = result.debug?.steps.find((step) => step.label === "retrieval_evaluator")
  assert.match(retrievalStep?.detail ?? "", /retrievalQuality=sufficient/)
  assert.match(retrievalStep?.detail ?? "", /nextAction=rerank/)
  const supportStep = result.debug?.steps.find((step) => step.label === "verify_answer_support")
  assert.match(supportStep?.detail ?? "", /supported=true/)
  assert.deepEqual(supportStep?.output?.answerSupport && typeof supportStep.output.answerSupport === "object" ? (supportStep.output.answerSupport as Record<string, unknown>).unsupportedSentences : undefined, [])
})

test("fixed workflow executes nodes in the declared order", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "remote-work-policy.txt",
    text: "在宅勤務手当は、月10日以上在宅勤務を実施した従業員に月額5,000円を支給する。申請期限は翌月5営業日まで。"
  })

  const result = await service.chat({
    question: "在宅勤務手当の申請期限はいつですか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.deepEqual(
    result.debug?.steps.map((step) => step.label),
    [
      "analyze_input",
      "normalize_query",
      "retrieve_memory",
      "generate_clues",
      "clarification_gate",
      "plan_search",
      "execute_search_action",
      "retrieval_evaluator",
      "clarification_gate",
      "evaluate_search_progress",
      "rerank_chunks",
      "answerability_gate",
      "sufficient_context_gate",
      "generate_answer",
      "validate_citations",
      "verify_answer_support",
      "finalize_response"
    ]
  )
})

test("fixed workflow branches on evaluate_search_progress decisions", async () => {
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

  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(labels.filter((label) => label === "plan_search").length, 2)
  assert.equal(labels.filter((label) => label === "execute_search_action").length, 2)
  assert.equal(labels.filter((label) => label === "retrieval_evaluator").length, 2)
  assert.equal(labels.filter((label) => label === "evaluate_search_progress").length, 2)
  assert.ok(labels.indexOf("evaluate_search_progress") < labels.indexOf("rerank_chunks"))
  assert.equal(labels.at(-1), "finalize_refusal")

  const evaluationSteps = result.debug?.steps.filter((step) => step.label === "evaluate_search_progress") ?? []
  assert.deepEqual(evaluationSteps.map((step) => step.output?.searchDecision), ["continue_search", "done"])
})

test("fixed workflow refuses unresolved conflicting evidence when search budget ends", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({ fileName: "deadline-a.txt", text: "申請期限は翌月5営業日です。", skipMemory: true })
  await service.ingest({ fileName: "deadline-b.txt", text: "申請期限は月末です。", skipMemory: true })

  const result = await service.chat({
    question: "申請期限はいつですか？",
    includeDebug: true,
    minScore: 0.01,
    maxIterations: 1
  })

  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(result.isAnswerable, false)
  assert.equal(result.answer, "資料からは回答できません。")
  assert.equal(labels.includes("generate_answer"), false)
  const evaluateStep = result.debug?.steps.find((step) => step.label === "evaluate_search_progress")
  const evaluation = evaluateStep?.output?.retrievalEvaluation as Record<string, unknown> | undefined
  assert.equal(evaluation?.retrievalQuality, "conflicting")
  assert.equal(result.debug?.steps.at(-1)?.label, "finalize_refusal")
})

test("fixed workflow returns corpus-grounded clarification before answer generation", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({ fileName: "expense-deadline.txt", text: "経費精算の申請期限は30日以内です。" })
  await service.ingest({ fileName: "vacation-deadline.txt", text: "休暇申請の申請期限は前日までです。" })

  const result = await service.chat({
    question: "申請期限は？",
    includeDebug: true,
    minScore: 0.01,
    maxIterations: 1
  })

  assert.equal(result.responseType, "clarification")
  assert.equal(result.isAnswerable, false)
  assert.equal(result.needsClarification, true)
  assert.match(result.answer, /どの申請種別の期限/)
  assert.ok((result.clarification?.options.length ?? 0) >= 2)
  assert.ok((result.clarification?.options.length ?? 0) <= 5)
  assert.ok(result.clarification?.options.every((option) => option.grounding.length > 0))
  assert.equal(Object.hasOwn(result.clarification ?? {}, "rejectedOptions"), false)
  assert.deepEqual(result.citations, [])
  assert.deepEqual(result.retrieved, [])
  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(labels.includes("generate_answer"), false)
  assert.equal(labels.at(-1), "finalize_clarification")
  const clarificationStep = result.debug?.steps.find((step) => step.label === "clarification_gate" && step.output?.clarification)
  assert.match(clarificationStep?.detail ?? "", /ambiguityScore=/)
  assert.match(clarificationStep?.detail ?? "", /groundedOptionCount=/)
  assert.match(clarificationStep?.detail ?? "", /rejectedOptions:/)
})

test("fixed workflow merges node updates into state and appends trace entries", () => {
  const initial = state({
    normalizedQuery: "old query",
    iteration: 1,
    retrievedChunks: [],
    trace: [debugStep(1, "analyze_input")]
  })

  const next = applyQaAgentUpdate(initial, {
    normalizedQuery: "new query",
    iteration: 2,
    searchDecision: "done",
    trace: debugStep(2, "normalize_query")
  })

  assert.equal(next.question, initial.question)
  assert.equal(next.normalizedQuery, "new query")
  assert.equal(next.iteration, 2)
  assert.equal(next.searchDecision, "done")
  assert.deepEqual(next.retrievedChunks, [])
  assert.deepEqual(
    next.trace.map((step) => step.label),
    ["analyze_input", "normalize_query"]
  )
})

test("fixed workflow appends multiple trace entries without replacing existing trace", () => {
  const initial = state({ trace: [debugStep(1, "analyze_input")] })

  const next = applyQaAgentUpdate(initial, {
    trace: [debugStep(2, "normalize_query"), debugStep(3, "retrieve_memory")]
  })

  assert.deepEqual(
    next.trace.map((step) => step.label),
    ["analyze_input", "normalize_query", "retrieve_memory"]
  )
})

test("fixed workflow debug trace keeps the full finalize response detail", async () => {
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
  assert.deepEqual(finalizeStep?.output, { answer: longAnswer })
})

test("fixed MemoRAG workflow refuses before answer generation when evidence is missing", async () => {
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
  assert.equal(result.debug.steps.some((step) => step.label === "sufficient_context_gate"), false)
  assert.equal(result.debug.steps.at(-1)?.label, "finalize_refusal")
  assert.deepEqual(result.debug.steps.at(-1)?.output, {
    answer: "資料からは回答できません。",
    citations: []
  })
})

test("fixed workflow refuses when sufficient context judge returns partial", async () => {
  const deps = await createTestDeps()
  const baseTextModel = deps.textModel
  deps.textModel = {
    embed: baseTextModel.embed.bind(baseTextModel),
    generate: async (prompt, options) => {
      if (prompt.includes("SUFFICIENT_CONTEXT_JSON")) {
        return JSON.stringify({
          label: "PARTIAL",
          confidence: 0.64,
          requiredFacts: ["経費精算の期限", "例外承認者"],
          supportedFacts: ["経費精算の期限"],
          missingFacts: ["例外承認者"],
          conflictingFacts: [],
          supportingChunkIds: ["chunk-0001"],
          reason: "例外承認者の根拠がありません。"
        })
      }
      return baseTextModel.generate(prompt, options)
    }
  }
  const service = new MemoRagService(deps)

  await service.ingest({
    fileName: "expense-policy.txt",
    text: "経費精算の期限は30日以内です。申請システムから提出します。"
  })

  const result = await service.chat({
    question: "経費精算の期限と例外承認者は？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, false)
  assert.equal(result.answer, "資料からは回答できません。")
  assert.equal(result.debug?.steps.some((step) => step.label === "generate_answer"), false)
  const gateStep = result.debug?.steps.find((step) => step.label === "sufficient_context_gate")
  assert.match(gateStep?.detail ?? "", /label=PARTIAL/)
  assert.match(gateStep?.detail ?? "", /例外承認者/)
})

async function createTestDeps(): Promise<Dependencies> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-agent-test-"))
  return {
    objectStore: new LocalObjectStore(dataDir),
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    evidenceVectorStore: new LocalVectorStore(dataDir, "evidence-vectors.json"),
    textModel: new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir),
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir)
  }
}


test("fixed workflow search cycle loops until maxIterations when retrieval score is too low", async () => {
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
  assert.equal(labels.filter((label) => label === "retrieval_evaluator").length, 2)
  assert.equal(labels.filter((label) => label === "evaluate_search_progress").length, 2)
  assert.equal(labels.includes("rerank_chunks"), true)
  assert.equal(labels.at(-1), "finalize_refusal")

  const actionSteps = result.debug?.steps.filter((step) => step.label === "execute_search_action") ?? []
  assert.match(actionSteps[0]?.summary ?? "", /action=evidence_search, hits=1, new=1/)
  assert.match(actionSteps[0]?.detail ?? "", /newEvidenceCount=1 topScore=/)
  assert.match(actionSteps[1]?.summary ?? "", /action=query_rewrite, hits=1, new=0/)
  assert.match(actionSteps[1]?.detail ?? "", /newEvidenceCount=0 topScore=/)
  assert.match(actionSteps[1]?.detail ?? "", /query rewrite 後のhybrid検索で1件取得し、新規根拠は0件でした。/)
})

test("fixed workflow search cycle stops after two consecutive no-new-evidence iterations", async () => {
  const service = new MemoRagService(await createTestDeps())

  const result = await service.chat({
    question: "資料にない制度の詳細を教えてください。",
    includeDebug: true,
    minScore: 0.01,
    maxIterations: 5
  })

  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(labels.filter((label) => label === "evaluate_search_progress").length, 2)
  assert.equal(labels.filter((label) => label === "retrieval_evaluator").length, 2)
  assert.equal(labels.includes("rerank_chunks"), true)
  assert.equal(labels.at(-1), "finalize_refusal")
})

test("fixed workflow search plan trace records complexity, facts, actions, and stop criteria from input", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "workflow.txt",
    text: "経費精算の申請手順は、申請システムで領収書を添付し、上長承認を受けて提出する。期限は30日以内です。"
  })

  const result = await service.chat({
    question: "経費精算の申請手順と期限は？",
    includeDebug: true,
    useMemory: false,
    minScore: 0.07,
    topK: 3,
    maxIterations: 2
  })

  const planStep = result.debug?.steps.find((step) => step.label === "plan_search")

  assert.equal(planStep?.summary, "plan actions=1, facts=1")
  assert.match(planStep?.detail ?? "", /complexity=procedure/)
  assert.match(planStep?.detail ?? "", /intent=経費精算の申請手順と期限は/)
  assert.match(planStep?.detail ?? "", /stop=maxIterations:2, minTopScore:0.07, minEvidenceCount:3, maxNoNewEvidenceStreak:2/)
  assert.match(planStep?.detail ?? "", /- fact-1 priority=1 status=missing: 経費精算の申請手順と期限は？/)
  assert.match(planStep?.detail ?? "", /- evidence_search query="経費精算の申請手順と期限は" topK=3/)
})

function state(overrides: Partial<QaAgentState> = {}): QaAgentState {
  return {
    runId: "run-test",
    question: "question",
    modelId: "model",
    embeddingModelId: "embed",
    clueModelId: "clue",
    useMemory: true,
    debug: true,
    topK: 3,
    memoryTopK: 2,
    minScore: 0.2,
    strictGrounded: true,
    iteration: 0,
    referenceQueue: [],
    resolvedReferences: [],
    unresolvedReferenceTargets: [],
    visitedDocumentIds: [],
    searchBudget: {
      maxReferenceDepth: 2,
      remainingCalls: 3
    },
    memoryCards: [],
    clues: [],
    expandedQueries: [],
    queryEmbeddings: [],
    searchPlan: {
      complexity: "simple",
      intent: "question",
      requiredFacts: [],
      actions: [],
      stopCriteria: {
        maxIterations: 3,
        minTopScore: 0.2,
        minEvidenceCount: 2,
        maxNoNewEvidenceStreak: 2
      }
    },
    actionHistory: [],
    retrievalEvaluation: {
      retrievalQuality: "irrelevant",
      missingFactIds: [],
      conflictingFactIds: [],
      supportedFactIds: [],
      nextAction: {
        type: "evidence_search",
        query: "",
        topK: 3
      },
      reason: ""
    },
    maxIterations: 3,
    newEvidenceCount: 0,
    noNewEvidenceStreak: 0,
    searchDecision: "continue_search",
    retrievedChunks: [],
    selectedChunks: [],
    answerability: {
      isAnswerable: false,
      reason: "not_checked",
      confidence: 0
    },
    sufficientContext: {
      label: "UNANSWERABLE",
      confidence: 0,
      requiredFacts: [],
      supportedFacts: [],
      missingFacts: [],
      conflictingFacts: [],
      supportingChunkIds: [],
      reason: ""
    },
    answerSupport: {
      supported: false,
      unsupportedSentences: [],
      supportingChunkIds: [],
      contradictionChunkIds: [],
      confidence: 0,
      totalSentences: 0,
      reason: ""
    },
    clarification: {
      needsClarification: false,
      reason: "not_needed",
      question: "",
      options: [],
      missingSlots: [],
      confidence: 0,
      groundedOptionCount: 0,
      rejectedOptions: []
    },
    citations: [],
    trace: [],
    ...overrides
  }
}

function debugStep(id: number, label: string): DebugStep {
  return {
    id,
    label,
    status: "success",
    latencyMs: 0,
    summary: `${label} completed`,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:00.000Z"
  }
}
