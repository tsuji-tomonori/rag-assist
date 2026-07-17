import assert from "node:assert/strict"
import test from "node:test"
import { BenchmarkRunMetricsSchema, ChatResponseSchema, ConversationHistoryItemSchema, DebugTraceSchema, DocumentIngestRunSchema, DocumentUploadRequestSchema, SearchResponseSchema, WorkerEventSchema, WorkerResultSchema } from "../schemas.js"

test("FR-019 benchmark run metrics bound context relevance and its evidence count", () => {
  const base = { total: 1, succeeded: 1, failedHttp: 0 }
  assert.equal(BenchmarkRunMetricsSchema.safeParse({ ...base, faithfulness: 0.75, contextRelevance: 0.5, contextRelevanceSampleCount: 4 }).success, true)
  assert.equal(BenchmarkRunMetricsSchema.safeParse({ ...base, faithfulness: -0.1 }).success, false)
  assert.equal(BenchmarkRunMetricsSchema.safeParse({ ...base, contextRelevance: 1.1, contextRelevanceSampleCount: 4 }).success, false)
  assert.equal(BenchmarkRunMetricsSchema.safeParse({ ...base, contextRelevance: 0.5, contextRelevanceSampleCount: -1 }).success, false)
})

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

test("FR-074 document ingest run schema exposes terminal replay correlation", () => {
  const result = DocumentIngestRunSchema.safeParse({
    runId: "ingest-rejected-1",
    status: "rejected",
    createdBy: "user-1",
    tenantId: "tenant-a",
    uploadId: "upload-1",
    objectKey: "uploads/rejected.txt",
    purpose: "document",
    fileName: "rejected.txt",
    traceId: "ingest:document-1:version-1",
    replayVersionManifest: { schemaVersion: 1, parserVersion: "text-extractor-v1", ocrVersion: null },
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:01.000Z",
    completedAt: "2026-07-12T00:00:01.000Z"
  })

  assert.equal(result.success, true)
  if (!result.success) return
  assert.equal(result.data.status, "rejected")
  assert.equal(result.data.traceId, "ingest:document-1:version-1")
  assert.equal(result.data.replayVersionManifest?.ocrVersion, null)
})

test("search response diagnostics includes index and alias versions", () => {
  const response = {
    query: "pto",
    results: [],
    diagnostics: {
      indexVersion: "lexical:00000000",
      aliasVersion: "alias:00000000",
      lexicalCount: 0,
      semanticCount: 0,
      fusedCount: 0,
      latencyMs: 1,
      traceId: "search-trace-1",
      replayVersionManifest: {
        schemaVersion: 1,
        sourceSnapshots: [],
        parserVersion: null,
        ocrVersion: null,
        chunkerVersion: null,
        chunkingPolicyVersion: null,
        embedding: { modelId: "embed-v1", dimensions: 1024 },
        policyVersions: {
          ragProfile: "rag-v1",
          retrieval: "retrieval-v1",
          answer: null,
          authorization: "auth-v1",
          eligibility: "eligibility-v1",
          untrustedContent: "untrusted-v1",
          traceSanitization: "trace-v1"
        },
        indexVersion: "lexical:00000000",
        modelVersions: { answer: null, clue: null },
        promptVersion: null,
        pipelineVersion: null,
        datasetVersion: null,
        queryTransformation: {
          originalQuestionHash: "hash",
          normalizedQueryHash: "hash",
          expandedQuerySetHash: null
        },
        decisions: {
          candidateCount: 0,
          deniedCandidateCount: 0,
          finalEvidenceCount: 0,
          responseStatus: "success",
          decisionCode: "completed",
          reasonCodes: [],
          totalLatencyMs: 1
        },
        nondeterministicFactors: [],
        missingVersions: ["sourceSnapshots"]
      },
      index: {
        visibleManifestCount: 1,
        indexedChunkCount: 1,
        cache: "artifact" as const,
        loadMs: 1,
        degradationDecision: {
          policyVersion: "rag-safe-degradation-v1" as const,
          trigger: "dependency_error" as const,
          stage: "lexical_index",
          action: "refuse" as const,
          enforcedGuards: ["authentication", "authorization"] as const,
          missingGuards: ["grounding"] as const,
          safeToReturnContent: false,
          guardOutcomes: [{
            guard: "authentication" as const,
            observed: true,
            passed: true,
            evidence: "runtime_identity_check",
            observedAt: "2026-07-12T00:00:00.000Z"
          }]
        }
      }
    }
  }
  const result = SearchResponseSchema.safeParse(response)

  assert.equal(result.success, true)
  if (!result.success) return
  assert.deepEqual(result.data.diagnostics.index?.degradationDecision?.guardOutcomes, response.diagnostics.index.degradationDecision.guardOutcomes)

  const missingOutcomes = structuredClone(response)
  delete (missingOutcomes.diagnostics.index.degradationDecision as Partial<typeof response.diagnostics.index.degradationDecision>).guardOutcomes
  assert.equal(SearchResponseSchema.safeParse(missingOutcomes).success, false)

  for (const field of ["guard", "observed", "passed", "evidence", "observedAt"] as const) {
    const missingField = structuredClone(response)
    delete (missingField.diagnostics.index.degradationDecision.guardOutcomes[0] as Record<string, unknown>)[field]
    assert.equal(
      SearchResponseSchema.safeParse(missingField).success,
      false,
      `guardOutcomes[].${field} must be required by the API schema`
    )
  }
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
      requestTraceId: "request-1",
      parentTraceIds: ["search-1"],
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
  assert.equal(result.data.debug?.requestTraceId, "request-1")
  assert.deepEqual(result.data.debug?.parentTraceIds, ["search-1"])
})

test("debug trace schema accepts legacy RAG traces and adds J2 visibility defaults", () => {
  const result = DebugTraceSchema.safeParse({
    schemaVersion: 1,
    runId: "run_20260514_000000Z_abcdef12",
    question: "質問",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-14T00:00:00.000Z",
    completedAt: "2026-05-14T00:00:01.000Z",
    totalLatencyMs: 1000,
    status: "success",
    answerPreview: "回答です。",
    isAnswerable: true,
    citations: [],
    retrieved: [],
    steps: []
  })

  assert.equal(result.success, true)
  if (!result.success) return
  assert.equal(result.data.targetType, "rag_run")
  assert.equal(result.data.visibility, "operator_sanitized")
  assert.equal(result.data.sanitizePolicyVersion, "debug-trace-sanitize-v1")
})

test("worker contract keeps runId required while allowing target-specific metadata", () => {
  const event = WorkerEventSchema.safeParse({ runId: "run-1", tenantId: "tenant-a", targetType: "chat_run", stepFunctionsRetry: 1 })
  assert.equal(event.success, true)
  if (!event.success) return
  assert.equal(event.data.runId, "run-1")
  assert.equal(event.data.targetType, "chat_run")

  assert.equal(WorkerEventSchema.safeParse({ targetType: "chat_run" }).success, false)
  assert.equal(WorkerEventSchema.safeParse({ runId: "" }).success, false)
  assert.equal(WorkerEventSchema.safeParse({ runId: "run-1", targetType: "chat_run" }).success, false)

  const result = WorkerResultSchema.safeParse({
    runId: "run-1",
    targetType: "document_ingest_run",
    status: "succeeded",
    resultType: "succeeded"
  })
  assert.equal(result.success, true)
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
