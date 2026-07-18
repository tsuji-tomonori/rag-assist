import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import test from "node:test"
import type { Dependencies } from "../dependencies.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalFavoriteStore } from "../adapters/local-favorite-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalChatRunStore } from "../adapters/local-chat-run-store.js"
import { LocalChatRunEventStore } from "../adapters/local-chat-run-event-store.js"
import { LocalDocumentIngestRunStore } from "../adapters/local-document-ingest-run-store.js"
import { LocalDocumentIngestRunEventStore } from "../adapters/local-document-ingest-run-event-store.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import { MemoRagService } from "../rag/memorag-service.js"
import { answerReplayCandidateCounts, answerReplayDecision, applyChatOrchestrationUpdate, runChatOrchestration } from "./graph.js"
import type { ChatOrchestrationState } from "./state.js"
import { CHAT_ORCHESTRATION_TRACE_TARGET_TYPE, type DebugStep, type DebugTrace } from "../types.js"

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
      "build_temporal_context",
      "normalize_search_scope",
      "detect_tool_intent",
      "build_conversation_state",
      "decontextualize_query",
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
      "reauthorize_evidence",
      "answerability_gate",
      "sufficient_context_gate",
      "generate_answer",
      "reauthorize_evidence",
      "validate_citations",
      "verify_answer_support",
      "reauthorize_evidence",
      "finalize_response"
    ]
  )
  const planStep = result.debug?.steps.find((step) => step.label === "plan_search")
  const actionStep = result.debug?.steps.find((step) => step.label === "execute_search_action")
  assertSafeDebugStep(planStep, "plan_search")
  assertSafeDebugStep(actionStep, "execute_search_action")
  const sufficientContextStep = result.debug?.steps.find((step) => step.label === "sufficient_context_gate")
  assertSafeDebugStep(sufficientContextStep, "sufficient_context_gate")
  const retrievalStep = result.debug?.steps.find((step) => step.label === "retrieval_evaluator")
  assertSafeDebugStep(retrievalStep, "retrieval_evaluator")
  const supportStep = result.debug?.steps.find((step) => step.label === "verify_answer_support")
  assertSafeDebugStep(supportStep, "verify_answer_support")
  assertSanitizedDebugTrace(result.debug)
})

test("fixed MemoRAG workflow clamps minScore before debug trace persistence", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "score-policy.txt",
    text: "稟議の承認期限は申請から5営業日以内です。"
  })

  const result = await service.chat({
    question: "稟議の承認期限は？",
    includeDebug: true,
    minScore: 2,
    maxIterations: 1
  })

  assert.equal(result.debug?.minScore, 1)
})

test("FR-074 answer replay carries measured pre/post authorization candidate counts", async () => {
  const deps = await createTestDeps()
  const service = new MemoRagService(deps)
  const reader = {
    userId: "answer-trace-reader",
    email: "answer-trace-reader@example.com",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active" as const,
    tenantId: "default"
  }
  const manifest = await service.ingest({
    fileName: "reader-policy.txt",
    text: "orchard access review requires the approved reader policy.",
    skipMemory: true,
    metadata: { tenantId: "default", ownerUserId: reader.userId, allowedUsers: [reader.userId] }
  })
  let protectedReadCount = 0
  const result = await runChatOrchestration(deps, {
    question: "What does the orchard access review require?",
    includeDebug: true,
    useMemory: false,
    minScore: 0.01,
    maxIterations: 1
  }, reader, {
    emit: async () => undefined,
    authorizeProtectedRead: async () => {
      protectedReadCount += 1
      if (protectedReadCount !== 3) return
      const current = JSON.parse(await deps.objectStore.getText(manifest.manifestObjectKey)) as Record<string, unknown>
      const metadata = current.metadata as Record<string, unknown> | undefined
      await deps.objectStore.putText(manifest.manifestObjectKey, JSON.stringify({
        ...current,
        metadata: {
          ...metadata,
          ownerUserId: "another-user",
          allowedUsers: ["another-user"]
        }
      }), "application/json")
    }
  })

  assert.ok(result.debug)
  const searchTraces = (await Promise.all(
    (result.debug?.parentTraceIds ?? []).map((traceId) => service.getDebugRun(traceId))
  )).filter((trace): trace is DebugTrace => trace?.targetType === "rag_run" && trace.runId.startsWith("search_"))
  const measuredCandidateCount = searchTraces.reduce((sum, trace) => sum + (trace.decision?.candidateCount ?? 0), 0)
  const measuredDeniedCandidateCount = searchTraces.reduce((sum, trace) => sum + (trace.decision?.deniedCandidateCount ?? 0), 0)
  assert.ok(measuredCandidateCount > 0)
  assert.equal(measuredDeniedCandidateCount, 0)
  assert.equal(result.debug?.decision?.candidateCount, measuredCandidateCount)
  assert.equal(result.debug?.decision?.deniedCandidateCount, measuredDeniedCandidateCount + 1)
  assert.equal(result.debug?.decision?.finalEvidenceCount, 0)
  assert.equal(result.debug?.decision?.decisionCode, "rejected")
  assert.deepEqual(result.debug?.decision?.reasonCodes, ["permission_revoked"])
})

test("FR-074 answer replay derives canonical failure decisions without exposing raw error content", () => {
  const authorizationDecision = answerReplayDecision(state({
    answerability: { isAnswerable: false, reason: "authorization_revoked", confidence: 1 }
  }), false, false)
  assert.deepEqual(authorizationDecision, {
    decisionCode: "rejected",
    reasonCodes: ["permission_revoked"]
  })

  const dependencyDecision = answerReplayDecision(state({
    trace: [{
      ...debugStep(1, "generate_answer"),
      status: "error",
      detail: "Bearer raw-secret-must-not-leak",
      output: { error: "Bearer raw-secret-must-not-leak" },
      degradationDecision: {
        policyVersion: "rag-safe-degradation-v1",
        trigger: "timeout",
        stage: "generate_answer",
        action: "refuse",
        enforcedGuards: [],
        missingGuards: [],
        safeToReturnContent: false,
        guardOutcomes: []
      }
    } as unknown as DebugStep]
  }), false, false)
  assert.deepEqual(dependencyDecision, {
    decisionCode: "failed",
    reasonCodes: ["dependency_error"]
  })
  assert.doesNotMatch(JSON.stringify(dependencyDecision), /raw-secret-must-not-leak/)
})

test("FR-074 answer dependency failure persists only canonical failure codes", async () => {
  const deps = await createTestDeps()
  const service = new MemoRagService(deps)
  await service.ingest({
    fileName: "dependency-failure-policy.txt",
    text: "Dependency failure answers must persist canonical replay decisions.",
    skipMemory: true
  })
  deps.textModel = new MockBedrockTextModel({
    generate: new Error("Bearer dependency-raw-canary-must-not-leak")
  })

  const result = await service.chat({
    question: "How are dependency failures recorded?",
    includeDebug: true,
    useMemory: false,
    minScore: 0.01,
    maxIterations: 1
  })

  assert.equal(result.debug?.decision?.responseStatus, "error")
  assert.equal(result.debug?.decision?.decisionCode, "failed")
  assert.deepEqual(result.debug?.decision?.reasonCodes, ["dependency_error"])
  assert.doesNotMatch(JSON.stringify(result.debug), /dependency-raw-canary-must-not-leak/)
})

test("FR-074 answer replay adds late current-authorization denials to measured search diagnostics", () => {
  const firstDiagnostics = replayDiagnostics(5, 2)
  const secondDiagnostics = replayDiagnostics(4, 1)
  const counts = answerReplayCandidateCounts(state({
    actionHistory: [
      { action: { type: "evidence_search", query: "first", topK: 4 }, hitCount: 3, newEvidenceCount: 3, retrievalDiagnostics: firstDiagnostics, summary: "first" },
      { action: { type: "evidence_search", query: "second", topK: 4 }, hitCount: 3, newEvidenceCount: 2, retrievalDiagnostics: secondDiagnostics, summary: "second" }
    ],
    retrievalDiagnostics: { ...secondDiagnostics, deniedCandidateCount: 2 }
  }), 5)

  assert.deepEqual(counts, { candidateCount: 9, deniedCandidateCount: 4 })
})

test("benchmark search filters keep agent retrieval scoped to isolated benchmark corpus", async () => {
  const service = new MemoRagService(await createTestDeps())
  const runner = {
    userId: "local-dev",
    cognitoGroups: ["BENCHMARK_RUNNER"],
    accountStatus: "active" as const,
    tenantId: "default"
  }

  await service.ingest({
    fileName: "software_requirements_chapter01_ja_A4_final.tex",
    text: "MMRAG-DocQA という語は含みますが、この通常文書は benchmark corpus ではありません。要求分類と要求管理の説明です。",
    skipMemory: true
  })
  await service.ingest({
    fileName: "mmrag-docqa-method.md",
    text: [
      "MMRAG-DocQA is a Document Question-Answering benchmark target.",
      "It focuses on hierarchical index behavior and multi-granularity retrieval behavior.",
      "The expected retrieval evidence includes both section-level context and chunk-level context."
    ].join("\n"),
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "mmrag-docqa-v1",
      benchmarkSourceHash: "hash",
      benchmarkIngestSignature: "signature",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner"
    }
  })
  await service.ingest({
    fileName: "other-benchmark-suite.md",
    text: "MMRAG-DocQA is mentioned here, but this is a different benchmark suite corpus.",
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "standard-agent-v1",
      benchmarkSourceHash: "other-hash",
      benchmarkIngestSignature: "other-signature",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner"
    }
  })

  const result = await service.chat(
    {
      question: "MMRAG-DocQA の検索観点として、どの2つの粒度を比較対象にしますか？",
      includeDebug: true,
      useMemory: false,
      minScore: 0.05,
      searchFilters: {
        source: "benchmark-runner",
        docType: "benchmark-corpus",
        benchmarkSuiteId: "mmrag-docqa-v1"
      }
    },
    runner
  )

  assert.equal(result.isAnswerable, true)
  assert.ok(result.retrieved.length > 0)
  assert.equal(result.retrieved.every((item) => item.fileName === "mmrag-docqa-method.md"), true)
  assert.equal(result.finalEvidence?.every((item) => item.fileName === "mmrag-docqa-method.md"), true)
  assert.equal(result.citations.some((item) => item.fileName === "mmrag-docqa-method.md"), true)
  assert.equal(result.retrieved.some((item) => item.fileName === "software_requirements_chapter01_ja_A4_final.tex"), false)
  assert.equal(result.retrieved.some((item) => item.fileName === "other-benchmark-suite.md"), false)
  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(labels.filter((label) => label === "execute_search_action").length, 2)
  assert.equal(labels.filter((label) => label === "execute_search_action").length < 3, true)
  assertSafeDebugStep(result.debug?.steps.find((step) => step.label === "sufficient_context_gate"), "sufficient_context_gate")
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
      "build_temporal_context",
      "normalize_search_scope",
      "detect_tool_intent",
      "build_conversation_state",
      "decontextualize_query",
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
      "reauthorize_evidence",
      "answerability_gate",
      "sufficient_context_gate",
      "generate_answer",
      "reauthorize_evidence",
      "validate_citations",
      "verify_answer_support",
      "reauthorize_evidence",
      "finalize_response"
    ]
  )
})

test("fixed workflow answers explicit temporal calculations from computed facts without retrieval", async () => {
  const service = new MemoRagService(await createTestDeps())

  const result = await service.chat({
    question: "2026年5月3日時点で、2026-05-10まであと何日？",
    includeDebug: true,
    minScore: 0.05
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /あと7日|7日/)
  assert.deepEqual(result.citations, [])
  assert.deepEqual(
    result.debug?.steps.map((step) => step.label),
    [
      "analyze_input",
      "build_temporal_context",
      "normalize_search_scope",
      "detect_tool_intent",
      "build_conversation_state",
      "decontextualize_query",
      "execute_computation_tools",
      "answerability_gate",
      "generate_answer",
      "validate_citations",
      "verify_answer_support",
      "finalize_response"
    ]
  )
  const computationStep = result.debug?.steps.find((step) => step.label === "execute_computation_tools")
  assertSafeDebugStep(computationStep, "execute_computation_tools")
  const supportStep = result.debug?.steps.find((step) => step.label === "verify_answer_support")
  assertSafeDebugStep(supportStep, "verify_answer_support")
})

test("fixed workflow uses injected asOfDate for test and benchmark temporal contexts", async () => {
  const service = new MemoRagService(await createTestDeps())

  const result = await service.chat({
    question: "2026-05-10まであと何日？",
    asOfDate: "2026-05-03",
    asOfDateSource: "test",
    includeDebug: true
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /7日/)
  const temporalStep = result.debug?.steps.find((step) => step.label === "build_temporal_context")
  assertSafeDebugStep(temporalStep, "build_temporal_context")
})

test("fixed workflow fails fast for invalid injected asOfDate before retrieval", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "remote-work-policy.txt",
    text: "在宅勤務手当の申請期限は翌月5営業日までです。"
  })

  const result = await service.chat({
    question: "在宅勤務手当の申請期限はいつですか？",
    asOfDate: "2026-99-99",
    asOfDateSource: "test",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, false)
  assert.equal(result.answer, "資料からは回答できません。")
  assert.equal(result.debug?.steps.some((step) => step.label === "retrieve_memory"), false)
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_search_action"), false)
  const temporalStep = result.debug?.steps.find((step) => step.label === "build_temporal_context")
  assertSafeDebugStep(temporalStep, "build_temporal_context", "error")
})

test("fixed workflow answers polite current date questions from temporal context", async () => {
  const service = new MemoRagService(await createTestDeps())

  const result = await service.chat({
    question: "今日の日付は何日ですか？",
    asOfDate: "2026-05-03",
    asOfDateSource: "test",
    includeDebug: true
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /2026-05-03/)
  const computationStep = result.debug?.steps.find((step) => step.label === "execute_computation_tools")
  assertSafeDebugStep(computationStep, "execute_computation_tools")
  assert.equal(result.debug?.steps.some((step) => step.label === "retrieve_memory"), false)
})

test("fixed workflow sends current-month deadline questions to RAG instead of current-date computation", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "deadline.txt",
    text: "今月の締切は20日です。"
  })

  const result = await service.chat({
    question: "今月の締切は何日ですか？",
    asOfDate: "2026-05-03",
    asOfDateSource: "test",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /20日/)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_computation_tools"), false)
})

test("fixed workflow falls back to RAG when arithmetic intent has no usable computation", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "benefit.txt",
    text: "在宅勤務手当は月額5,000円です。"
  })

  const result = await service.chat({
    question: "5,000円の在宅勤務手当はいくらですか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /5,000円/)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
})

test("fixed workflow sends document-source arithmetic verification questions to RAG", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "pricing-note.txt",
    text: "この資料では、1,200円を15人で12か月使う場合の総額は記載していません。"
  })

  const result = await service.chat({
    question: "この資料では1,200円を15人で12か月使うと総額いくらと記載されていますか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_computation_tools"), false)
})

test("fixed workflow answers document-grounded threshold comparison questions", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "handbook.md",
    text: "経費精算は申請から30日以内に行う必要があります。1万円以上の経費精算では領収書の添付が必要です。",
    skipMemory: true
  })

  const result = await service.chat({
    question: "5200円の経費精算では領収書いる?",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /該当しません|必要条件に該当しません/)
  assert.ok(result.citations.length > 0)
  const extractionStep = result.debug?.steps.find((step) => step.label === "extract_policy_computations")
  assertSafeDebugStep(extractionStep, "extract_policy_computations")
  const supportStep = result.debug?.steps.find((step) => step.label === "verify_answer_support")
  assertSafeDebugStep(supportStep, "verify_answer_support")
})

test("fixed workflow keeps not-required threshold rules from becoming required answers", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "handbook.md",
    text: "1万円未満の経費精算では領収書の添付は不要です。",
    skipMemory: true
  })

  const result = await service.chat({
    question: "5200円の経費精算では領収書いる?",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /不要/)
  assert.doesNotMatch(result.answer, /^必要です。/)
  const extractionStep = result.debug?.steps.find((step) => step.label === "extract_policy_computations")
  assertSafeDebugStep(extractionStep, "extract_policy_computations")
})

test("fixed workflow binds threshold polarity at clause level", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "handbook.md",
    text: "1万円以上の経費精算では領収書の添付が必要で、1万円未満では不要です。",
    skipMemory: true
  })

  const result = await service.chat({
    question: "15000円の経費精算では領収書いる?",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /必要/)
  assert.doesNotMatch(result.answer, /^不要です。/)
  const extractionStep = result.debug?.steps.find((step) => step.label === "extract_policy_computations")
  assertSafeDebugStep(extractionStep, "extract_policy_computations")
})

test("fixed workflow answers self-contained arithmetic verification from computed facts", async () => {
  const service = new MemoRagService(await createTestDeps())

  const result = await service.chat({
    question: "1,200円を15人で12か月使うと216,000円で合っていますか？",
    includeDebug: true
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /216,000円|216000円/)
  const computationStep = result.debug?.steps.find((step) => step.label === "execute_computation_tools")
  assertSafeDebugStep(computationStep, "execute_computation_tools")
  assert.equal(result.debug?.steps.some((step) => step.label === "retrieve_memory"), false)
})

test("fixed workflow sends business-day document questions to RAG instead of compute-only unavailable", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "remote-work-policy.txt",
    text: "在宅勤務手当の申請期限は翌月5営業日までです。"
  })

  const result = await service.chat({
    question: "在宅勤務手当の申請期限は何営業日ですか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /5営業日/)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_computation_tools"), false)
})

test("fixed workflow sends explicit-date document verification questions to RAG", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "expense-policy.txt",
    text: "経費精算の提出期限は2026年5月15日です。"
  })

  const result = await service.chat({
    question: "経費精算の期限は2026-05-10ですか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /2026年5月15日|2026-05-15/)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_computation_tools"), false)
})

test("fixed workflow sends relative-deadline document verification questions to RAG", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "expense-policy.txt",
    text: "経費精算の提出期限は申請から30日以内です。"
  })

  const result = await service.chat({
    question: "経費精算の期限は申請から30日以内ですか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /申請から30日以内/)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_computation_tools"), false)
})

test("fixed workflow sends document date verification questions to RAG instead of current-date computation", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "policy.txt",
    text: "この規程の発行日は2026年5月10日です。"
  })

  const result = await service.chat({
    question: "この資料の日付を確認してください",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.match(result.answer, /2026年5月10日|2026-05-10/)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_computation_tools"), false)
})

test("fixed workflow sends document-source deadline status questions to RAG", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "policy.txt",
    text: "この資料では、2026年5月1日の期限切れ判定は記載していません。"
  })

  const result = await service.chat({
    question: "この資料では2026-05-01期限切れと記載されていますか？",
    includeDebug: true,
    minScore: 0.05,
    maxIterations: 1
  })

  assert.equal(result.isAnswerable, true)
  assert.ok(result.debug?.steps.some((step) => step.label === "retrieve_memory"))
  assert.ok(result.debug?.steps.some((step) => step.label === "execute_search_action"))
  assert.equal(result.debug?.steps.some((step) => step.label === "execute_computation_tools"), false)
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
  assert.equal(evaluationSteps.length, 2)
  for (const step of evaluationSteps) assertSafeDebugStep(step, "evaluate_search_progress")
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
  assertSafeDebugStep(evaluateStep, "evaluate_search_progress")
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
  assert.ok(labels.includes("execute_search_action"))
  assert.equal(labels.includes("generate_answer"), false)
  assert.equal(labels.at(-1), "finalize_clarification")
  const clarificationStep = result.debug?.steps.filter((step) => step.label === "clarification_gate").at(-1)
  assertSafeDebugStep(clarificationStep, "clarification_gate")
})

test("fixed workflow answers explicit scoped questions instead of clarifying from memory candidates", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({ fileName: "expense-deadline.txt", text: "経費精算の申請期限は30日以内です。" })
  await service.ingest({ fileName: "vacation-deadline.txt", text: "休暇申請の申請期限は前営業日までです。" })

  const result = await service.chat({
    question: "経費精算の申請期限は？",
    includeDebug: true,
    minScore: 0.01,
    maxIterations: 1
  })

  assert.equal(result.responseType, "answer")
  assert.equal(result.isAnswerable, true)
  assert.equal(result.needsClarification, false)
  assert.match(result.answer, /30日以内/)
  assert.ok(result.retrieved.length > 0)
  const firstClarification = result.debug?.steps.find((step) => step.label === "clarification_gate")
  assertSafeDebugStep(firstClarification, "clarification_gate")
})

test("fixed workflow answers parental leave deadline questions with abbreviation and start date", async () => {
  const service = new MemoRagService(await createTestDeps())
  const handbook = await readFile(new URL("../../../../benchmark/corpus/standard-agent-v1/handbook.md", import.meta.url), "utf-8")

  await service.ingest({ fileName: "handbook.md", text: handbook })

  const result = await service.chat({
    question: "8/1から育休を取る場合、いつまでに申請する必要がある?",
    includeDebug: true,
    minScore: 0.01,
    maxIterations: 1,
    asOfDate: "2026-05-05",
    asOfDateSource: "test"
  })

  assert.equal(result.responseType, "answer")
  assert.equal(result.needsClarification, false)
  assert.match(result.answer, /2026-07-01|7月1日|7\/1/)
  assert.match(result.answer, /開始日の1か月前|申請期限/)
  const labels = result.debug?.steps.map((step) => step.label) ?? []
  assert.equal(labels.at(-1), "finalize_response")
  assert.equal(labels.includes("finalize_clarification"), false)
  const computationStep = result.debug?.steps.find((step) => step.label === "execute_computation_tools")
  assertSafeDebugStep(computationStep, "execute_computation_tools")
})

test("fixed workflow derives relative policy deadlines for deadline wording variants without unavailable facts", async () => {
  const service = new MemoRagService(await createTestDeps())
  const handbook = await readFile(new URL("../../../../benchmark/corpus/standard-agent-v1/handbook.md", import.meta.url), "utf-8")

  await service.ingest({ fileName: "handbook.md", text: handbook })

  for (const question of [
    "8/1から育休を取る場合、申請期限は？",
    "8/1から育休を取る場合、提出期限は？",
    "8/1から育休を取る場合、締切は？"
  ]) {
    const result = await service.chat({
      question,
      includeDebug: true,
      minScore: 0.01,
      maxIterations: 1,
      asOfDate: "2026-05-05",
      asOfDateSource: "test"
    })

    assert.equal(result.responseType, "answer")
    assert.equal(result.needsClarification, false)
    assert.match(result.answer, /2026-07-01|7月1日|7\/1/)
    const computationStep = result.debug?.steps.find((step) => step.label === "execute_computation_tools")
    assertSafeDebugStep(computationStep, "execute_computation_tools")
  }
})

test("fixed workflow merges node updates into state and appends trace entries", () => {
  const initial = state({
    normalizedQuery: "old query",
    iteration: 1,
    retrievedChunks: [],
    trace: [debugStep(1, "analyze_input")]
  })

  const next = applyChatOrchestrationUpdate(initial, {
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

  const next = applyChatOrchestrationUpdate(initial, {
    trace: [debugStep(2, "normalize_query"), debugStep(3, "retrieve_memory")]
  })

  assert.deepEqual(
    next.trace.map((step) => step.label),
    ["analyze_input", "normalize_query", "retrieve_memory"]
  )
})

test("fixed workflow returns the full answer while public debug redacts finalize response content", async () => {
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
  assert.equal(result.debug?.answerPreview, "[redacted:document-content]")
  assertSafeDebugStep(finalizeStep, "finalize_response")
  assert.doesNotMatch(JSON.stringify(result.debug), /END_OF_FINALIZE_RESPONSE/)
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
  assertSafeDebugStep(result.debug.steps.at(-1), "finalize_refusal")
})

test("fixed workflow continues when sufficient context judge returns partial with supported primary evidence", async () => {
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

  assert.equal(result.isAnswerable, true)
  assert.notEqual(result.answer, "資料からは回答できません。")
  assert.equal(result.debug?.steps.some((step) => step.label === "generate_answer"), true)
  const gateStep = result.debug?.steps.find((step) => step.label === "sufficient_context_gate")
  assertSafeDebugStep(gateStep, "sufficient_context_gate")
})

test("fixed workflow answers English ChatRAG VPN follow-up without refusal contamination", async () => {
  const service = new MemoRagService(await createTestDeps())

  await service.ingest({
    fileName: "chatrag_sample_it.md",
    text: [
      "Employees with manager approval can request VPN access.",
      "Contractors need both manager approval and a sponsor review before VPN access is issued."
    ].join("\n"),
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "chatrag-bench-v1",
      benchmarkSourceHash: "hash",
      benchmarkIngestSignature: "signature",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner"
    }
  })

  const runner = {
    userId: "local-dev",
    cognitoGroups: ["BENCHMARK_RUNNER"],
    accountStatus: "active" as const,
    tenantId: "default"
  }
  const first = await service.chat(
    {
      question: "Who can request VPN access?",
      includeDebug: true,
      useMemory: false,
      minScore: 0.05,
      maxIterations: 2,
      searchFilters: {
        source: "benchmark-runner",
        docType: "benchmark-corpus",
        benchmarkSuiteId: "chatrag-bench-v1"
      }
    },
    runner
  )

  assert.equal(first.isAnswerable, true)
  assert.match(first.answer, /Employees with manager approval can request VPN access/)
  assert.equal(first.citations.some((item) => item.fileName === "chatrag_sample_it.md"), true)
  assert.equal(first.debug?.steps.filter((step) => step.label === "execute_search_action").length, 1)

  const second = await service.chat(
    {
      question: "What about contractors?",
      includeDebug: true,
      useMemory: false,
      minScore: 0.05,
      maxIterations: 2,
      conversation: {
        conversationId: "chatrag-vpn",
        turnId: "turn-2",
        turnIndex: 2,
        turns: [
          { role: "user", text: "Who can request VPN access?" },
          { role: "assistant", text: first.answer, citations: first.citations }
        ]
      },
      searchFilters: {
        source: "benchmark-runner",
        docType: "benchmark-corpus",
        benchmarkSuiteId: "chatrag-bench-v1"
      }
    },
    runner
  )

  assert.equal(second.isAnswerable, true)
  assert.match(second.answer, /Contractors need both manager approval and a sponsor review/)
  assert.equal(second.retrieved.some((item) => item.fileName === "chatrag_sample_it.md"), true)
  assert.equal(second.debug?.steps.filter((step) => step.label === "execute_search_action").length, 1)
  assert.equal(second.debug?.steps.some((step) => step.label === "extract_policy_computations"), false)
  const clueStep = second.debug?.steps.find((step) => step.label === "generate_clues")
  assertSafeDebugStep(clueStep, "generate_clues")
  const actionStep = second.debug?.steps.find((step) => step.label === "execute_search_action")
  assertSafeDebugStep(actionStep, "execute_search_action")
  const rewriteStep = second.debug?.steps.find((step) => step.label === "decontextualize_query")
  assertSafeDebugStep(rewriteStep, "decontextualize_query")
  assert.doesNotMatch(JSON.stringify(second.debug), /What about contractors|Who can request VPN access|sponsor review/)
})

async function createTestDeps(): Promise<Dependencies> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-agent-test-"))
  return { ragGuardProfile: safeTestRagGuardProfile(),
    objectStore: new LocalObjectStore(dataDir),
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    evidenceVectorStore: new LocalVectorStore(dataDir, "evidence-vectors.json"),
    textModel: new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir),
    favoriteStore: new LocalFavoriteStore(dataDir),
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir),
    chatRunStore: new LocalChatRunStore(dataDir),
    chatRunEventStore: new LocalChatRunEventStore(dataDir),
    documentIngestRunStore: new LocalDocumentIngestRunStore(dataDir),
    documentIngestRunEventStore: new LocalDocumentIngestRunEventStore(dataDir),
    documentGroupStore: new LocalDocumentGroupStore(dataDir),
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir),
    localTestIngestAdmissionContext: {
      mode: "local_test_fixture",
      fixtureId: "chat-orchestration-test",
      tenantId: "default",
      ownerUserId: "local-dev"
    }
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
  assert.equal(actionSteps.length, 2)
  for (const step of actionSteps) assertSafeDebugStep(step, "execute_search_action")
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

test("fixed workflow search plan trace retains safe status without exposing input or plan bodies", async () => {
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

  assertSafeDebugStep(planStep, "plan_search")
  assert.doesNotMatch(JSON.stringify(result.debug), /経費精算の申請手順と期限|complexity=procedure|requiredFacts/)
})

function assertSafeDebugStep(
  step: DebugStep | undefined,
  label: string,
  expectedStatus?: DebugStep["status"]
): asserts step is DebugStep {
  assert.ok(step)
  assert.equal(step.label, label)
  if (expectedStatus) assert.equal(step.status, expectedStatus)
  assert.equal(step.summary, `${step.label}:${step.status}`)
  assert.equal(step.detail, undefined)
  assert.equal(step.output, undefined)
}

function assertSanitizedDebugTrace(trace: DebugTrace | undefined): asserts trace is DebugTrace {
  assert.ok(trace)
  assert.equal(trace.targetType, CHAT_ORCHESTRATION_TRACE_TARGET_TYPE)
  assert.equal(trace.visibility, "operator_sanitized")
  assert.match(trace.question, /^sha256:[0-9a-f]{64}$/)
  assert.equal(trace.answerPreview, "[redacted:document-content]")
  assert.equal(trace.conversationHistory, undefined)
  assert.equal(trace.conversation, undefined)
  assert.equal(trace.conversationState, undefined)
  assert.equal(trace.decontextualizedQuery, undefined)
  assert.ok(trace.citations.every((citation) => citation.text === "[redacted:document-content]"))
  assert.ok(trace.retrieved.every((citation) => citation.text === "[redacted:document-content]"))
  assert.ok(trace.steps.every((step) => (
    step.summary === `${step.label}:${step.status}` &&
    step.detail === undefined &&
    step.output === undefined
  )))
}

function state(overrides: Partial<ChatOrchestrationState> = {}): ChatOrchestrationState {
  return {
    runId: "run-test",
    question: "question",
    conversationHistory: [],
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
      claims: [],
      conflictCandidates: [],
      nextAction: {
        type: "evidence_search",
        query: "",
        topK: 3
      },
      reason: ""
    },
    temporalContext: undefined,
    asOfDate: undefined,
    asOfDateSource: undefined,
    toolIntent: undefined,
    computedFacts: [],
    usedComputedFactIds: [],
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
      supportingComputedFactIds: [],
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

function replayDiagnostics(candidateCount: number, deniedCandidateCount: number) {
  return {
    queryCount: 1,
    traceIds: [],
    indexVersions: ["index-v1"],
    aliasVersions: ["alias-v1"],
    lexicalCount: candidateCount,
    semanticCount: 0,
    fusedCount: candidateCount - deniedCandidateCount,
    candidateCount,
    deniedCandidateCount,
    sourceCounts: {
      lexical: candidateCount - deniedCandidateCount,
      semantic: 0,
      hybrid: 0,
      memory: 0
    }
  }
}

test("FR-089 orchestration rejects an injected unsafe profile before downstream access", async () => {
  const deps = await createTestDeps()
  let downstreamAccessed = false
  const guardedObjectStore = new Proxy(deps.objectStore, {
    get(target, property, receiver) {
      downstreamAccessed = true
      return Reflect.get(target, property, receiver)
    }
  })

  await assert.rejects(
    () => runChatOrchestration({
      ...deps,
      objectStore: guardedObjectStore,
      ragGuardProfile: {
        ...deps.ragGuardProfile,
        guards: { ...deps.ragGuardProfile.guards, grounding: false }
      }
    }, { question: "must not reach the orchestration graph" }),
    (error) => error instanceof Error
      && error.name === "UnsafeRagDegradationProfileError"
      && error.message.includes("grounding")
  )
  assert.equal(downstreamAccessed, false)
})

function safeTestRagGuardProfile(): Dependencies["ragGuardProfile"] {
  return {
    id: "test-safe-rag",
    version: "test-safe-rag-v1",
    guards: {
      authentication: true,
      authorization: true,
      classification_usage: true,
      prompt_injection: true,
      tool_policy: true,
      grounding: true,
      citation: true,
      output_secret: true,
      trace_redaction: true
    }
  }
}
