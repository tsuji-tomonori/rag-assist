import assert from "node:assert/strict"
import test from "node:test"
import type { Dependencies } from "../../dependencies.js"
import type { RetrievedVector } from "../../types.js"
import { MockBedrockTextModel } from "../../adapters/mock-bedrock.js"
import { answerabilityGate } from "./answerability-gate.js"
import { clarificationGate } from "./clarification-gate.js"
import { createEmbedQueriesNode } from "./embed-queries.js"
import { finalizeResponse } from "./finalize-response.js"
import { createGenerateCluesNode } from "./generate-clues.js"
import { createRetrievalEvaluatorNode, retrievalEvaluator } from "./retrieval-evaluator.js"
import { createRetrieveMemoryNode } from "./retrieve-memory.js"
import { rerankChunks } from "./rerank-chunks.js"
import { createSearchEvidenceNode } from "./search-evidence.js"
import { createSufficientContextGateNode } from "./sufficient-context-gate.js"
import { validateCitations } from "./validate-citations.js"
import { createVerifyAnswerSupportNode } from "./verify-answer-support.js"
import { NO_ANSWER, type QaAgentState } from "../state.js"
import { tracedNode } from "../trace.js"
import type { DebugStep } from "../../types.js"

const chunk: RetrievedVector = {
  key: "doc-1-chunk-0001",
  score: 0.9,
  metadata: {
    kind: "chunk",
    documentId: "doc-1",
    fileName: "doc.txt",
    chunkId: "chunk-0001",
    text: "申請期限は翌月5営業日です。金額は5,000円です。申請システムから提出します。",
    createdAt: "2026-04-30T00:00:00.000Z"
  }
}

test("answerability gate covers no hit, low score, missing fact, and sufficient evidence branches", async () => {
  assert.equal((await answerabilityGate(state({ selectedChunks: [] }))).answerability?.reason, "no_relevant_chunks")

  const lowScore = await answerabilityGate(state({ selectedChunks: [{ ...chunk, score: 0.1 }], minScore: 0.2 }))
  assert.equal(lowScore.answerability?.reason, "low_similarity_score")
  assert.equal(lowScore.answerability?.sentenceAssessments?.[0]?.status, "ng")

  const missingAmount = await answerabilityGate(state({ question: "金額はいくらですか？", selectedChunks: [{ ...chunk, metadata: { ...chunk.metadata, text: "期限は翌月です。" } }] }))
  assert.equal(missingAmount.answerability?.reason, "missing_required_fact")
  assert.equal(missingAmount.answerability?.sentenceAssessments?.[0]?.status, "ng")
  assert.match(missingAmount.answerability?.sentenceAssessments?.[0]?.sentence ?? "", /期限/)

  const sufficient = await answerabilityGate(state({ question: "申請方法と期限と金額は？", selectedChunks: [chunk] }))
  assert.equal(sufficient.answerability?.reason, "sufficient_evidence")
  assert.ok(sufficient.answerability?.sentenceAssessments?.some((assessment) => assessment.status === "ok" && (assessment.checks ?? []).includes("amount")))
  assert.ok(sufficient.answerability?.sentenceAssessments?.some((assessment) => assessment.status === "ok" && (assessment.checks ?? []).includes("date")))
  assert.ok(sufficient.answerability?.sentenceAssessments?.some((assessment) => assessment.status === "ok" && (assessment.checks ?? []).includes("procedure")))
})

test("classification answers require actual requirements classification terms", async () => {
  const outlineChunk = {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      text: "2 Requirements Elicitation\n4.3 ATDD\nBDD\n4.4 UMLSysML\n5 Requirements Validation\n6.1 Requirements Scrubbing\n7.2 Kano"
    }
  }
  const classificationChunk = {
    ...chunk,
    key: "doc-1-chunk-0009",
    score: 0.3,
    metadata: {
      ...chunk.metadata,
      chunkId: "chunk-0009",
      text: "ソフトウェア要求の分類: ソフトウェア製品要求、ソフトウェアプロジェクト要求、機能要求、非機能要求、技術制約、サービス品質制約。"
    }
  }

  assert.equal(
    (await answerabilityGate(state({ question: "ソフトウェア要求の分類を洗い出して", selectedChunks: [outlineChunk] }))).answerability?.reason,
    "missing_required_fact"
  )

  assert.equal(
    (await answerabilityGate(state({ question: "ソフトウェア要求の分類を洗い出して", selectedChunks: [classificationChunk] }))).answerability?.reason,
    "sufficient_evidence"
  )

  assert.deepEqual(
    (await rerankChunks(state({ question: "ソフトウェア要求の分類を洗い出して", topK: 1, retrievedChunks: [outlineChunk, classificationChunk] }))).selectedChunks?.map(
      (selected) => selected.key
    ),
    ["doc-1-chunk-0009"]
  )
})

test("sufficient context gate accepts supported evidence and refuses partial evidence", async () => {
  const answerableDeps = createDeps()
  const answerable = await createSufficientContextGateNode(answerableDeps)(
    state({
      answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.7 },
      searchPlan: {
        complexity: "simple",
        intent: "申請期限",
        requiredFacts: [{ id: "deadline", description: "申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )

  assert.equal(answerable.sufficientContext?.label, "ANSWERABLE")
  assert.equal(answerable.answerability?.isAnswerable, true)
  assert.equal(answerable.searchPlan?.requiredFacts?.[0]?.status, "supported")
  assert.deepEqual(answerable.sufficientContext?.supportingChunkIds, ["doc-1-chunk-0001"])

  const partialDeps = createDeps()
  const baseModel = partialDeps.textModel
  partialDeps.textModel = {
    embed: baseModel.embed.bind(baseModel),
    generate: async (prompt, options) => {
      if (prompt.includes("SUFFICIENT_CONTEXT_JSON")) {
        return JSON.stringify({
          label: "PARTIAL",
          confidence: 0.62,
          requiredFacts: ["申請期限", "例外承認者"],
          supportedFacts: ["申請期限"],
          missingFacts: ["例外承認者"],
          conflictingFacts: [],
          supportingChunkIds: ["chunk-0001"],
          reason: "例外承認者の根拠がありません。"
        })
      }
      return baseModel.generate(prompt, options)
    }
  }
  const partial = await createSufficientContextGateNode(partialDeps)(state({ answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.7 } }))

  assert.equal(partial.sufficientContext?.label, "PARTIAL")
  assert.equal(partial.answerability?.isAnswerable, false)
  assert.equal(partial.answerability?.reason, "missing_required_fact")
  assert.equal(partial.answer, NO_ANSWER)
  assert.deepEqual(partial.sufficientContext?.supportingChunkIds, ["doc-1-chunk-0001"])
})

test("citation validation accepts used ids and rejects invalid or ungrounded answers", async () => {
  const ok = await validateCitations(
    state({
      selectedChunks: [chunk],
      rawAnswer: JSON.stringify({ isAnswerable: true, answer: "翌月5営業日です。", usedChunkIds: ["chunk-0001"] })
    })
  )
  assert.equal(ok.answer, "翌月5営業日です。")
  assert.equal(ok.citations?.length, 1)

  assert.equal((await validateCitations(state({ rawAnswer: "not-json" }))).answer, NO_ANSWER)
  assert.equal((await validateCitations(state({ rawAnswer: JSON.stringify({ isAnswerable: false }) }))).answer, NO_ANSWER)
  assert.equal(
    (await validateCitations(state({ selectedChunks: [chunk], rawAnswer: JSON.stringify({ isAnswerable: true, answer: "根拠なし", usedChunkIds: ["missing"] }) }))).answerability
      ?.reason,
    "citation_validation_failed"
  )
  assert.equal(
    (
      await validateCitations(
        state({
          question: "ソフトウェア要求の分類を洗い出して",
          selectedChunks: [chunk],
          rawAnswer: JSON.stringify({ isAnswerable: true, answer: "1. Requirements Elicitation\n2. BDD", usedChunkIds: ["chunk-0001"] })
        })
      )
    ).answerability?.reason,
    "citation_validation_failed"
  )

  assert.equal(
    (
      await validateCitations(
        state({
          selectedChunks: [],
          computedFacts: [
            {
              id: "date-001",
              kind: "current_date",
              inputFactIds: [],
              today: "2026-05-03",
              timezone: "Asia/Tokyo",
              explanation: "Asia/Tokyo の基準日は 2026-05-03 です。"
            }
          ],
          rawAnswer: JSON.stringify({ isAnswerable: true, answer: "今日の日付は2026-05-03です。", usedChunkIds: [], usedComputedFactIds: ["missing"] })
        })
      )
    ).answerability?.reason,
    "citation_validation_failed"
  )
})

test("answer support verifier accepts supported answers and rejects unsupported sentences", async () => {
  const supported = await createVerifyAnswerSupportNode(createDeps())(
    state({
      answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.9 },
      answer: "申請期限は翌月5営業日です。",
      citations: [
        {
          documentId: "doc-1",
          fileName: "doc.txt",
          chunkId: "chunk-0001",
          score: 0.9,
          text: chunk.metadata.text ?? ""
        }
      ]
    })
  )

  assert.equal(supported.answerSupport?.supported, true)
  assert.deepEqual(supported.answerSupport?.unsupportedSentences, [])
  assert.deepEqual(supported.answerSupport?.supportingChunkIds, ["doc-1-chunk-0001"])

  const deps = createDeps()
  const baseModel = deps.textModel
  deps.textModel = {
    embed: baseModel.embed.bind(baseModel),
    generate: async (prompt, options) => {
      if (prompt.includes("ANSWER_SUPPORT_JSON")) {
        return JSON.stringify({
          supported: false,
          unsupportedSentences: [{ sentence: "例外時は部長承認が必要です。", reason: "根拠チャンクに例外承認者の記載がありません。" }],
          supportingChunkIds: ["chunk-0001"],
          contradictionChunkIds: [],
          confidence: 0.77,
          totalSentences: 2,
          reason: "一部の回答文が根拠範囲を超えています。"
        })
      }
      return baseModel.generate(prompt, options)
    }
  }

  const unsupported = await createVerifyAnswerSupportNode(deps)(
    state({
      answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.9 },
      answer: "申請期限は翌月5営業日です。例外時は部長承認が必要です。",
      citations: [
        {
          documentId: "doc-1",
          fileName: "doc.txt",
          chunkId: "chunk-0001",
          score: 0.9,
          text: chunk.metadata.text ?? ""
        }
      ]
    })
  )

  assert.equal(unsupported.answerSupport?.supported, false)
  assert.equal(unsupported.answerability?.reason, "unsupported_answer")
  assert.equal(unsupported.answer, NO_ANSWER)
  assert.deepEqual(unsupported.citations, [])
  assert.deepEqual(unsupported.answerSupport?.supportingChunkIds, ["doc-1-chunk-0001"])
})

test("answer support verifier repairs unsupported answers once with supported-only facts", async () => {
  const deps = createDeps()
  const baseModel = deps.textModel
  let supportCalls = 0
  deps.textModel = {
    embed: baseModel.embed.bind(baseModel),
    generate: async (prompt, options) => {
      if (prompt.includes("ANSWER_SUPPORT_JSON")) {
        supportCalls += 1
        if (supportCalls === 1) {
          return JSON.stringify({
            supported: false,
            unsupportedSentences: [{ sentence: "例外時は部長承認が必要です。", reason: "根拠がありません。" }],
            supportingChunkIds: ["chunk-0001"],
            contradictionChunkIds: [],
            confidence: 0.7,
            totalSentences: 2,
            reason: "一部 unsupported です。"
          })
        }
        return JSON.stringify({
          supported: true,
          unsupportedSentences: [],
          supportingChunkIds: ["chunk-0001"],
          contradictionChunkIds: [],
          confidence: 0.9,
          totalSentences: 1,
          reason: "修復後の回答は根拠で支持されています。"
        })
      }
      if (prompt.includes("SUPPORTED_ONLY_ANSWER_JSON")) {
        return JSON.stringify({ isAnswerable: true, answer: "申請期限は翌月5営業日です。", usedChunkIds: ["chunk-0001"] })
      }
      return baseModel.generate(prompt, options)
    }
  }

  const repaired = await createVerifyAnswerSupportNode(deps)(
    state({
      answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.9 },
      answer: "申請期限は翌月5営業日です。例外時は部長承認が必要です。",
      selectedChunks: [chunk],
      citations: [
        {
          documentId: "doc-1",
          fileName: "doc.txt",
          chunkId: "chunk-0001",
          score: 0.9,
          text: chunk.metadata.text ?? ""
        }
      ]
    })
  )

  assert.equal(repaired.answer, "申請期限は翌月5営業日です。")
  assert.equal(repaired.answerSupport?.supported, true)
  assert.equal(repaired.citations?.length, 1)
})

test("finalize response preserves grounded answers and converts invalid final states to refusals", async () => {
  assert.deepEqual(await finalizeResponse(state({ answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.9 }, answer: "  OK  " })), {
    answer: "OK"
  })
  assert.equal(
    (await finalizeResponse(state({ answerability: { isAnswerable: true, reason: "sufficient_evidence", confidence: 0.4 }, answer: NO_ANSWER }))).answerability?.reason,
    "citation_validation_failed"
  )
  assert.equal(
    (await finalizeResponse(state({ answerability: { isAnswerable: false, reason: "low_similarity_score", confidence: 0.1 } }))).answerability?.reason,
    "low_similarity_score"
  )
})

test("query nodes handle memory-disabled, fallback, generated clue, and search merge paths", async () => {
  const deps = createDeps()
  assert.deepEqual(await createRetrieveMemoryNode(deps, user())(state({ useMemory: false })), { memoryCards: [] })

  const guardedDeps = createDeps()
  guardedDeps.memoryVectorStore = {
    put: async () => undefined,
    query: async () => [
      { ...chunk, key: "active-memory", metadata: { ...chunk.metadata, kind: "memory", memoryId: "memory-1", aclGroup: "GROUP_A" } },
      { ...chunk, key: "staging-memory", metadata: { ...chunk.metadata, kind: "memory", memoryId: "memory-2", lifecycleStatus: "staging", aclGroup: "GROUP_A" } },
      { ...chunk, key: "forbidden-memory", metadata: { ...chunk.metadata, kind: "memory", memoryId: "memory-3", aclGroup: "GROUP_B" } }
    ],
    delete: async () => undefined
  }
  const guardedMemory = await createRetrieveMemoryNode(guardedDeps, { userId: "user-a", cognitoGroups: ["GROUP_A"] })(state({ memoryTopK: 3 }))
  assert.deepEqual(guardedMemory.memoryCards?.map((hit) => hit.key), ["active-memory"])

  const noMemoryClues = await createGenerateCluesNode(deps)(state({ memoryCards: [] }))
  assert.deepEqual(noMemoryClues, { clues: [], expandedQueries: ["question"] })

  const generatedClues = await createGenerateCluesNode(deps)(state({ memoryCards: [{ ...chunk, metadata: { ...chunk.metadata, kind: "memory", memoryId: "memory-1" } }] }))
  assert.ok((generatedClues.expandedQueries?.length ?? 0) > 1)

  const fallbackEmbeddings = await createEmbedQueriesNode(deps)(state({ expandedQueries: [] }))
  assert.equal(fallbackEmbeddings.queryEmbeddings?.length, 1)

  const search = await createSearchEvidenceNode(deps, user())(state({ queryEmbeddings: [{ query: "q", vector: [1, 0] }] }))
  assert.deepEqual(search.retrievedChunks?.map((hit) => hit.key), ["doc-1-chunk-0001"])
  assert.equal(search.retrievalDiagnostics?.semanticCount, 2)

  const multiQuerySearch = await createSearchEvidenceNode(deps, user())(
    state({
      queryEmbeddings: [
        { query: "申請期限", vector: [1, 0] },
        { query: "提出期限", vector: [0.9, 0.1] }
      ]
    })
  )
  assert.equal(multiQuerySearch.retrievalDiagnostics?.queryCount, 2)
  assert.equal(multiQuerySearch.retrievedChunks?.[0]?.metadata.crossQueryRank, 1)
  assert.ok((multiQuerySearch.retrievedChunks?.[0]?.metadata.crossQueryRrfScore ?? 0) > 0)
})

test("retrieval evaluator routes fact coverage conservatively", async () => {
  const sufficient = await retrievalEvaluator(
    state({
      question: "申請期限は？",
      retrievedChunks: [chunk],
      searchPlan: {
        complexity: "simple",
        intent: "申請期限",
        requiredFacts: [{ id: "deadline", description: "申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(sufficient.retrievalEvaluation?.retrievalQuality, "sufficient")
  assert.deepEqual(sufficient.retrievalEvaluation?.supportedFactIds, ["deadline"])
  assert.equal(sufficient.retrievalEvaluation?.nextAction.type, "rerank")
  assert.equal(sufficient.searchPlan?.requiredFacts[0]?.status, "supported")

  const partial = await retrievalEvaluator(
    state({
      question: "申請期限と例外承認者は？",
      retrievedChunks: [chunk],
      searchPlan: {
        complexity: "multi_hop",
        intent: "申請期限と例外承認者",
        requiredFacts: [
          { id: "deadline", description: "申請期限", priority: 1, status: "missing", supportingChunkKeys: [] },
          { id: "exception-approver", description: "例外承認者", priority: 2, status: "missing", supportingChunkKeys: [] }
        ],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(partial.retrievalEvaluation?.retrievalQuality, "partial")
  assert.deepEqual(partial.retrievalEvaluation?.missingFactIds, ["exception-approver"])
  assert.equal(partial.retrievalEvaluation?.nextAction.type, "evidence_search")
  assert.match(partial.retrievalEvaluation?.nextAction.type === "evidence_search" ? partial.retrievalEvaluation.nextAction.query : "", /例外承認者/)

  const irrelevant = await retrievalEvaluator(state({ retrievedChunks: [{ ...chunk, score: 0.1 }], minScore: 0.2 }))
  assert.equal(irrelevant.retrievalEvaluation?.retrievalQuality, "irrelevant")
  assert.equal(irrelevant.retrievalEvaluation?.nextAction.type, "query_rewrite")

  const irrelevantAfterRewrite = await retrievalEvaluator(
    state({
      retrievedChunks: [{ ...chunk, score: 0.1 }],
      minScore: 0.2,
      actionHistory: [
        {
          action: { type: "query_rewrite", strategy: "keyword", input: "question" },
          hitCount: 1,
          newEvidenceCount: 0,
          topScore: 0.1,
          summary: "rewritten"
        }
      ]
    })
  )
  assert.equal(irrelevantAfterRewrite.retrievalEvaluation?.retrievalQuality, "irrelevant")
  assert.equal(irrelevantAfterRewrite.retrievalEvaluation?.nextAction.type, "evidence_search")

  const partialWithKnownSupport = await retrievalEvaluator(
    state({
      question: "申請期限と例外承認者は？",
      retrievedChunks: [chunk],
      searchPlan: {
        complexity: "multi_hop",
        intent: "申請期限と例外承認者",
        requiredFacts: [
          { id: "deadline", description: "申請期限", priority: 1, status: "supported", supportingChunkKeys: ["doc-1-chunk-0001"] },
          { id: "exception-approver", description: "例外承認者", priority: 2, status: "missing", supportingChunkKeys: [] }
        ],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(partialWithKnownSupport.retrievalEvaluation?.retrievalQuality, "partial")
  assert.equal(partialWithKnownSupport.retrievalEvaluation?.nextAction.type, "expand_context")
  assert.equal(
    partialWithKnownSupport.retrievalEvaluation?.nextAction.type === "expand_context"
      ? partialWithKnownSupport.retrievalEvaluation.nextAction.chunkKey
      : "",
    "doc-1-chunk-0001"
  )

  const genericDeadline = await retrievalEvaluator(
    state({
      question: "期限は？",
      retrievedChunks: [chunk],
      searchPlan: {
        complexity: "simple",
        intent: "期限",
        requiredFacts: [{ id: "deadline-generic", description: "期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(genericDeadline.retrievalEvaluation?.retrievalQuality, "partial")
  assert.deepEqual(genericDeadline.retrievalEvaluation?.supportedFactIds, [])
  assert.deepEqual(genericDeadline.retrievalEvaluation?.missingFactIds, ["deadline-generic"])

  const noValue = await retrievalEvaluator(
    state({
      question: "申請期限は？",
      retrievedChunks: [{ ...chunk, metadata: { ...chunk.metadata, text: "申請期限については社内資料を確認してください。" } }],
      searchPlan: {
        complexity: "simple",
        intent: "申請期限",
        requiredFacts: [{ id: "deadline", description: "申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(noValue.retrievalEvaluation?.retrievalQuality, "partial")
  assert.deepEqual(noValue.retrievalEvaluation?.supportedFactIds, [])
  assert.deepEqual(noValue.retrievalEvaluation?.missingFactIds, ["deadline"])

  const currentRuleWithStatusCue = await retrievalEvaluator(
    state({
      question: "現行制度の申請期限は？",
      retrievedChunks: [
        {
          ...chunk,
          metadata: {
            ...chunk.metadata,
            text: "旧制度は廃止され、現行制度では申請期限は翌月5営業日です。"
          }
        }
      ],
      searchPlan: {
        complexity: "simple",
        intent: "現行制度の申請期限",
        requiredFacts: [{ id: "current-deadline", description: "現行制度の申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(currentRuleWithStatusCue.retrievalEvaluation?.retrievalQuality, "sufficient")
  assert.deepEqual(currentRuleWithStatusCue.retrievalEvaluation?.conflictingFactIds, [])
  assert.equal(currentRuleWithStatusCue.retrievalEvaluation?.nextAction.type, "rerank")

  const valueMismatch = await retrievalEvaluator(
    state({
      question: "現行制度の申請期限は？",
      retrievedChunks: [
        {
          ...chunk,
          key: "doc-1-chunk-0001",
          metadata: {
            ...chunk.metadata,
            chunkId: "chunk-0001",
            text: "現行制度の申請期限は翌月5営業日です。"
          }
        },
        {
          ...chunk,
          key: "doc-1-chunk-0002",
          score: 0.88,
          metadata: {
            ...chunk.metadata,
            chunkId: "chunk-0002",
            text: "現行制度の申請期限は翌月10営業日です。"
          }
        }
      ],
      searchPlan: {
        complexity: "simple",
        intent: "現行制度の申請期限",
        requiredFacts: [{ id: "current-deadline", description: "現行制度の申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(valueMismatch.retrievalEvaluation?.retrievalQuality, "conflicting")
  assert.deepEqual(valueMismatch.retrievalEvaluation?.supportedFactIds, [])
  assert.deepEqual(valueMismatch.retrievalEvaluation?.conflictingFactIds, ["current-deadline"])
  assert.equal(valueMismatch.retrievalEvaluation?.riskSignals?.[0]?.type, "value_mismatch")
  assert.deepEqual(valueMismatch.retrievalEvaluation?.riskSignals?.[0]?.values, ["翌月5営業日", "翌月10営業日"])
  assert.equal(valueMismatch.retrievalEvaluation?.nextAction.type, "evidence_search")
  assert.match(valueMismatch.retrievalEvaluation?.nextAction.type === "evidence_search" ? valueMismatch.retrievalEvaluation.nextAction.query : "", /現行 最新/)

  const scopedOldAndCurrent = await retrievalEvaluator(
    state({
      question: "現行制度の申請期限は？",
      retrievedChunks: [
        {
          ...chunk,
          key: "doc-1-chunk-0003",
          metadata: {
            ...chunk.metadata,
            chunkId: "chunk-0003",
            text: "旧制度の申請期限は翌月10日でした。"
          }
        },
        {
          ...chunk,
          key: "doc-1-chunk-0004",
          score: 0.91,
          metadata: {
            ...chunk.metadata,
            chunkId: "chunk-0004",
            text: "現行制度の申請期限は翌月5営業日です。"
          }
        }
      ],
      searchPlan: {
        complexity: "simple",
        intent: "現行制度の申請期限",
        requiredFacts: [{ id: "current-deadline", description: "現行制度の申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.equal(scopedOldAndCurrent.retrievalEvaluation?.retrievalQuality, "sufficient")
  assert.deepEqual(scopedOldAndCurrent.retrievalEvaluation?.conflictingFactIds, [])
  assert.deepEqual(scopedOldAndCurrent.retrievalEvaluation?.riskSignals, [])

  const lowScoreTermMatch = await retrievalEvaluator(
    state({
      question: "申請期限は？",
      retrievedChunks: [{ ...chunk, score: 0.41 }],
      searchPlan: {
        complexity: "simple",
        intent: "申請期限",
        requiredFacts: [{ id: "deadline", description: "申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
        actions: [],
        stopCriteria: { maxIterations: 3, minTopScore: 0.7, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
      }
    })
  )
  assert.notEqual(lowScoreTermMatch.retrievalEvaluation?.retrievalQuality, "sufficient")
  assert.deepEqual(lowScoreTermMatch.retrievalEvaluation?.supportedFactIds, [])
})

test("clarification gate asks only with grounded options and leaves clear queries alone", async () => {
  const expense = {
    ...chunk,
    key: "expense-memory",
    score: 0.91,
    metadata: {
      ...chunk.metadata,
      kind: "memory" as const,
      memoryId: "memory-expense",
      text: "経費精算の申請期限は30日以内です。"
    }
  }
  const vacation = {
    ...chunk,
    key: "vacation-memory",
    score: 0.9,
    metadata: {
      ...chunk.metadata,
      kind: "memory" as const,
      memoryId: "memory-vacation",
      text: "休暇申請の申請期限は前日までです。"
    }
  }
  const privateLabel = {
    ...chunk,
    key: "private-memory",
    score: 0.89,
    metadata: {
      ...chunk.metadata,
      kind: "memory" as const,
      memoryId: "memory-private",
      text: "非公開の機密申請は内部aliasだけで管理します。"
    }
  }

  const ambiguous = await clarificationGate(state({
    question: "申請期限は？",
    normalizedQuery: "申請期限",
    memoryCards: [privateLabel, expense, vacation],
    actionHistory: [{ action: { type: "evidence_search", query: "申請期限", topK: 3 }, hitCount: 2, newEvidenceCount: 2, summary: "searched" }]
  }))

  assert.equal(ambiguous.clarification?.needsClarification, true)
  assert.equal(ambiguous.clarification?.reason, "multiple_candidate_intents")
  assert.deepEqual(ambiguous.clarification?.missingSlots, ["申請種別"])
  assert.deepEqual(ambiguous.clarification?.options.map((option) => option.label), ["経費精算", "休暇申請"])
  assert.ok(ambiguous.clarification?.options.every((option) => option.grounding.length > 0))
  assert.ok(ambiguous.clarification?.options.every((option) => !/(非公開|機密|内部alias)/.test(option.label)))

  const clear = await clarificationGate(state({
    question: "経費精算の申請期限は？",
    normalizedQuery: "経費精算の申請期限",
    memoryCards: [expense, vacation]
  }))
  assert.equal(clear.clarification?.needsClarification, false)

  const noCandidate = await clarificationGate(state({
    question: "社長の昨日の昼食は？",
    normalizedQuery: "社長の昨日の昼食"
  }))
  assert.equal(noCandidate.clarification?.needsClarification, false)

  const internalControl = await clarificationGate(state({
    question: "申請期限は？",
    normalizedQuery: "申請期限",
    actionHistory: [{ action: { type: "evidence_search", query: "申請期限", topK: 3 }, hitCount: 2, newEvidenceCount: 2, summary: "searched" }],
    memoryCards: [
      {
        ...chunk,
        key: "internal-control-memory",
        score: 0.92,
        metadata: {
          ...chunk.metadata,
          kind: "memory" as const,
          memoryId: "memory-internal-control",
          text: "内部統制申請の期限は四半期末です。"
        }
      },
      expense
    ]
  }))
  assert.equal(internalControl.clarification?.needsClarification, true)
  assert.ok(internalControl.clarification?.options.some((option) => option.label.includes("内部統制")))
})

test("retrieval evaluator LLM judge handles uncertain value mismatch cases", async () => {
  const mismatchState = state({
    question: "現行制度の申請期限は？",
    retrievedChunks: [
      {
        ...chunk,
        key: "doc-1-chunk-0001",
        metadata: {
          ...chunk.metadata,
          chunkId: "chunk-0001",
          text: "現行制度の申請期限は翌月5営業日です。"
        }
      },
      {
        ...chunk,
        key: "doc-1-chunk-0002",
        score: 0.88,
        metadata: {
          ...chunk.metadata,
          chunkId: "chunk-0002",
          text: "現行制度の申請期限は翌月10営業日です。"
        }
      }
    ],
    searchPlan: {
      complexity: "simple",
      intent: "現行制度の申請期限",
      requiredFacts: [{ id: "current-deadline", description: "現行制度の申請期限", priority: 1, status: "missing", supportingChunkKeys: [] }],
      actions: [],
      stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
    }
  })

  const noConflict = createRetrievalEvaluatorNode({
    ...createDeps(),
    textModel: {
      embed: async () => [1],
      generate: async () =>
        JSON.stringify({
          label: "NO_CONFLICT",
          confidence: 0.91,
          factIds: ["current-deadline"],
          supportingChunkIds: ["doc-1-chunk-0001"],
          contradictionChunkIds: [],
          reason: "片方は補足情報であり、回答根拠には翌月5営業日を使える。"
        })
    }
  })
  const resolved = await noConflict(mismatchState)
  assert.equal(resolved.retrievalEvaluation?.llmJudge?.label, "NO_CONFLICT")
  assert.equal(resolved.retrievalEvaluation?.retrievalQuality, "sufficient")
  assert.deepEqual(resolved.retrievalEvaluation?.conflictingFactIds, [])
  assert.equal(resolved.retrievalEvaluation?.nextAction.type, "rerank")
  assert.equal(resolved.searchPlan?.requiredFacts[0]?.status, "supported")

  const conflict = createRetrievalEvaluatorNode({
    ...createDeps(),
    textModel: {
      embed: async () => [1],
      generate: async () =>
        JSON.stringify({
          label: "CONFLICT",
          confidence: 0.88,
          factIds: ["current-deadline"],
          supportingChunkIds: [],
          contradictionChunkIds: ["doc-1-chunk-0001", "doc-1-chunk-0002"],
          reason: "同一 scope で申請期限の値が排他的です。"
        })
    }
  })
  const judgedConflict = await conflict(mismatchState)
  assert.equal(judgedConflict.retrievalEvaluation?.llmJudge?.label, "CONFLICT")
  assert.equal(judgedConflict.retrievalEvaluation?.retrievalQuality, "conflicting")
  assert.deepEqual(judgedConflict.retrievalEvaluation?.conflictingFactIds, ["current-deadline"])
  assert.equal(judgedConflict.retrievalEvaluation?.nextAction.type, "evidence_search")
})

test("traced node records success, warning, model ids, details, and thrown errors", async () => {
  const success = await tracedNode("search_evidence", async () => ({ retrievedChunks: [chunk] }))(state({ trace: [] }))
  const successTrace = success.trace as unknown as DebugStep
  assert.equal(successTrace.status, "success")
  assert.equal(successTrace.modelId, "embed")
  assert.equal(successTrace.hitCount, 1)
  assert.match(successTrace.detail ?? "", /doc.txt/)
  assert.equal(successTrace.output?.retrievedChunks, undefined)

  const warning = await tracedNode("generate_answer", async () => ({ answer: NO_ANSWER }))(state({ trace: [] }))
  const warningTrace = warning.trace as unknown as DebugStep
  assert.equal(warningTrace.status, "warning")
  assert.equal(warningTrace.tokenCount, 4)
  assert.equal(warningTrace.output?.answer, NO_ANSWER)

  const answerability = await tracedNode("answerability_gate", async () => answerabilityGate(state({ question: "金額はいくらですか？", selectedChunks: [chunk] })))(state({ trace: [] }))
  const answerabilityTrace = answerability.trace as unknown as DebugStep
  assert.match(answerabilityTrace.detail ?? "", /判定に使った文/)
  assert.match(answerabilityTrace.detail ?? "", /\[OK\]/)

  const error = await tracedNode("generate_clues", async () => {
    throw new Error("boom")
  })(state({ trace: [] }))
  const errorTrace = error.trace as unknown as DebugStep
  assert.equal(error.answer, NO_ANSWER)
  assert.equal(errorTrace.status, "error")
  assert.equal(errorTrace.modelId, undefined)
  assert.equal(errorTrace.output?.answer, NO_ANSWER)
})

function createDeps(): Dependencies {
  return {
    objectStore: {
      putText: async () => undefined,
      getText: async (key: string) => {
        if (key === "manifests/doc-1.json") {
          return JSON.stringify({
            documentId: "doc-1",
            fileName: "doc.txt",
            sourceObjectKey: "documents/doc-1/source.txt",
            manifestObjectKey: "manifests/doc-1.json",
            vectorKeys: ["doc-1-chunk-0001", "doc-1-memory-1"],
            lifecycleStatus: "active",
            metadata: { aclGroup: "GROUP_A" },
            chunkCount: 1,
            memoryCardCount: 1,
            createdAt: "2026-05-03T00:00:00.000Z"
          })
        }
        if (key === "documents/doc-1/source.txt") return chunk.metadata.text ?? ""
        return ""
      },
      deleteObject: async () => undefined,
      listKeys: async (prefix: string) => prefix === "manifests/" ? ["manifests/doc-1.json"] : []
    },
    memoryVectorStore: {
      put: async () => undefined,
      query: async () => [{ ...chunk, metadata: { ...chunk.metadata, kind: "memory", memoryId: "memory-1" } }],
      delete: async () => undefined
    },
    evidenceVectorStore: {
      put: async () => undefined,
      query: async () => [chunk, { ...chunk, key: "doc-1-chunk-0001", score: 0.8 }],
      delete: async () => undefined
    },
    textModel: new MockBedrockTextModel(),
    questionStore: {
      create: async () => {
        throw new Error("not used")
      },
      list: async () => [],
      get: async () => undefined,
      answer: async () => {
        throw new Error("not used")
      },
      resolve: async () => {
        throw new Error("not used")
      }
    },
    conversationHistoryStore: {
      save: async () => {
        throw new Error("not used")
      },
      list: async () => [],
      delete: async () => undefined
    }
  } as unknown as Dependencies
}

function user() {
  return {
    userId: "test-user",
    email: "test-user@example.com",
    cognitoGroups: ["SYSTEM_ADMIN"]
  }
}

function state(overrides: Record<string, unknown> = {}): QaAgentState {
  return {
    runId: "run",
    question: "question",
    modelId: "model",
    embeddingModelId: "embed",
    clueModelId: "clue",
    useMemory: true,
    debug: false,
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    strictGrounded: true,
    iteration: 0,
    referenceQueue: [],
    resolvedReferences: [],
    unresolvedReferenceTargets: [],
    visitedDocumentIds: [],
    searchBudget: { maxReferenceDepth: 2, remainingCalls: 3 },
    normalizedQuery: undefined,
    memoryCards: [],
    clues: [],
    expandedQueries: [],
    queryEmbeddings: [],
    searchPlan: {
      complexity: "simple",
      intent: "question",
      requiredFacts: [],
      actions: [],
      stopCriteria: { maxIterations: 3, minTopScore: 0.2, minEvidenceCount: 2, maxNoNewEvidenceStreak: 2 }
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
        topK: 6
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
    retrievalDiagnostics: undefined,
    selectedChunks: [chunk],
    answerability: { isAnswerable: false, reason: "not_checked", confidence: 0 },
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
    rawAnswer: undefined,
    answer: undefined,
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
  } as unknown as QaAgentState
}
