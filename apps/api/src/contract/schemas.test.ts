import assert from "node:assert/strict"
import test from "node:test"
import { ChatResponseSchema, ConversationHistoryItemSchema, DocumentUploadRequestSchema, SearchResponseSchema } from "../schemas.js"

test("document metadata schema accepts recursive JSON alias metadata", () => {
  const result = DocumentUploadRequestSchema.safeParse({
    fileName: "policy.md",
    text: "Vacation requests require manager approval.",
    metadata: {
      tenantId: "tenant-a",
      source: "notion",
      docType: "policy",
      searchAliases: {
        pto: ["paid time off", "vacation"],
        vacation: {
          type: "oneWay",
          to: ["annual leave"]
        }
      }
    }
  })

  assert.equal(result.success, true)
})

test("search response diagnostics includes index and alias versions", () => {
  const result = SearchResponseSchema.safeParse({
    query: "pto",
    results: [],
    diagnostics: {
      indexVersion: "lexical:00000000",
      aliasVersion: "alias:00000000",
      lexicalCount: 0,
      semanticCount: 0,
      fusedCount: 0,
      latencyMs: 1
    }
  })

  assert.equal(result.success, true)
})

test("chat response clarification schema strips internal rejected options", () => {
  const result = ChatResponseSchema.parse({
    responseType: "clarification",
    answer: "どの申請種別の期限を確認しますか？",
    isAnswerable: false,
    needsClarification: true,
    clarification: {
      needsClarification: true,
      reason: "multiple_candidate_intents",
      question: "どの申請種別の期限を確認しますか？",
      options: [],
      missingSlots: ["申請種別"],
      confidence: 0.8,
      groundedOptionCount: 2,
      rejectedOptions: ["confidential-internal-policy.txt"]
    },
    citations: [],
    retrieved: []
  })

  assert.equal(Object.hasOwn(result.clarification ?? {}, "rejectedOptions"), false)
})

test("chat debug trace schema exposes only profile identifiers", () => {
  const result = ChatResponseSchema.safeParse({
    responseType: "answer",
    answer: "回答です。",
    isAnswerable: true,
    citations: [],
    retrieved: [],
    debug: {
      schemaVersion: 1,
      runId: "run_20260508_000000Z_abcdef12",
      question: "質問",
      modelId: "amazon.nova-lite-v1:0",
      embeddingModelId: "amazon.titan-embed-text-v2:0",
      clueModelId: "amazon.nova-lite-v1:0",
      ragProfile: {
        id: "default",
        version: "1",
        retrievalProfileId: "default",
        retrievalProfileVersion: "1",
        answerPolicyId: "default-answer-policy",
        answerPolicyVersion: "1"
      },
      topK: 6,
      memoryTopK: 4,
      minScore: 0.2,
      startedAt: "2026-05-08T00:00:00.000Z",
      completedAt: "2026-05-08T00:00:01.000Z",
      totalLatencyMs: 1000,
      status: "success",
      answerPreview: "回答です。",
      isAnswerable: true,
      citations: [],
      retrieved: [],
      steps: []
    }
  })

  assert.equal(result.success, true)
  if (!result.success) return
  assert.deepEqual(result.data.debug?.ragProfile, {
    id: "default",
    version: "1",
    retrievalProfileId: "default",
    retrievalProfileVersion: "1",
    answerPolicyId: "default-answer-policy",
    answerPolicyVersion: "1"
  })
})

test("conversation history schema accepts optional multi-turn state fields", () => {
  const result = ConversationHistoryItemSchema.safeParse({
    id: "conversation-1",
    title: "経費精算の会話",
    updatedAt: "2026-05-14T00:00:00.000Z",
    messages: [{ role: "user", text: "前回の続きは？", createdAt: "2026-05-14T00:00:00.000Z" }],
    decontextualizedQuery: {
      originalQuestion: "前回の続きは？",
      standaloneQuestion: "経費精算期限の前回引用箇所について教えて",
      retrievalQueries: ["経費精算期限 前回引用"],
      turnDependency: "follow_up",
      previousCitationCount: 1
    },
    rollingSummary: "経費精算期限について会話している。",
    queryFocusedSummary: "前回引用した経費精算期限の根拠を確認している。",
    citationMemory: [
      {
        citation: {
          documentId: "doc-1",
          fileName: "policy.md",
          chunkId: "chunk-1",
          pageStart: 1
        },
        turnId: "turn-1",
        answerExcerpt: "申請から30日以内です。",
        rememberedAt: "2026-05-14T00:00:00.000Z"
      }
    ],
    taskState: {
      status: "in_progress",
      goal: "経費精算期限を確認する",
      pendingActions: ["前回 citation を再確認"]
    }
  })

  assert.equal(result.success, true)
  if (!result.success) return
  assert.equal(result.data.schemaVersion, 2)
  assert.equal(result.data.decontextualizedQuery?.turnDependency, "follow_up")
})
