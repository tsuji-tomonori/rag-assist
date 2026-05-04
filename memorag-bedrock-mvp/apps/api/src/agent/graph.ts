import { randomUUID } from "node:crypto"
import type { AppUser } from "../auth.js"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import { loadChunksForManifest } from "../rag/manifest-chunks.js"
import { buildPipelineVersions } from "../rag/pipeline-versions.js"
import { DEBUG_TRACE_SCHEMA_VERSION, type DebugTrace } from "../types.js"
import type { DocumentManifest, RetrievedVector } from "../types.js"
import { analyzeInput } from "./nodes/analyze-input.js"
import { answerabilityGate } from "./nodes/answerability-gate.js"
import { clarificationGate } from "./nodes/clarification-gate.js"
import { createEmbedQueriesNode } from "./nodes/embed-queries.js"
import { finalizeClarification } from "./nodes/finalize-clarification.js"
import { finalizeRefusal } from "./nodes/finalize-refusal.js"
import { finalizeResponse } from "./nodes/finalize-response.js"
import { createGenerateAnswerNode } from "./nodes/generate-answer.js"
import { createGenerateCluesNode } from "./nodes/generate-clues.js"
import { normalizeQuery } from "./nodes/normalize-query.js"
import { rerankChunks } from "./nodes/rerank-chunks.js"
import { createRetrievalEvaluatorNode } from "./nodes/retrieval-evaluator.js"
import { createRetrieveMemoryNode } from "./nodes/retrieve-memory.js"
import { createSearchEvidenceNode } from "./nodes/search-evidence.js"
import { createSufficientContextGateNode } from "./nodes/sufficient-context-gate.js"
import { validateCitations } from "./nodes/validate-citations.js"
import { createVerifyAnswerSupportNode } from "./nodes/verify-answer-support.js"
import { NO_ANSWER, type Clarification, type QaAgentState, type QaAgentUpdate, type RequiredFact, type SearchAction } from "./state.js"
import { tracedNode } from "./trace.js"
import type { ChatInput, QaGraphResult } from "./types.js"
import { clamp, toCitation } from "./utils.js"

const systemAdminUser: AppUser = {
  userId: "system",
  email: "system@example.com",
  cognitoGroups: ["SYSTEM_ADMIN"]
}

export type ProgressSink = {
  emit: (event: {
    type: "status" | "final" | "error"
    stage?: string
    message?: string
    data?: unknown
  }) => Promise<void>
}

export function createQaAgentGraph(deps: Dependencies, user: AppUser = systemAdminUser, progress?: ProgressSink) {
  const embedQueries = createEmbedQueriesNode(deps)
  const searchEvidence = createSearchEvidenceNode(deps, user)
  const retrievalEvaluator = createRetrievalEvaluatorNode(deps)
  const sufficientContextGate = createSufficientContextGateNode(deps)
  const verifyAnswerSupport = createVerifyAnswerSupportNode(deps)

  async function planSearch(state: QaAgentState): Promise<QaAgentUpdate> {
    const query = state.expandedQueries[0] ?? state.normalizedQuery ?? state.question
    const nextAction = selectNextSearchAction(state, query)
    const requiredFacts =
      state.searchPlan.requiredFacts.length > 0 ? state.searchPlan.requiredFacts : extractRequiredFacts(state.question, state.clues)
    const actions: SearchAction[] = [
      nextAction
    ]
    const expandedQueries = nextAction.type === "evidence_search"
      ? nextAction.query === query ? state.expandedQueries : [nextAction.query, ...state.expandedQueries].slice(0, 8)
      : state.expandedQueries

    return {
      expandedQueries,
      queryEmbeddings: [],
      searchPlan: {
        complexity: inferSearchComplexity(state.question),
        intent: state.normalizedQuery ?? state.question,
        requiredFacts,
        actions,
        stopCriteria: {
          maxIterations: state.maxIterations,
          minTopScore: state.minScore,
          minEvidenceCount: Math.max(2, Math.min(state.topK, 4)),
          maxNoNewEvidenceStreak: 2
        }
      },
      searchDecision: "continue_search"
    }
  }

  async function executeSearchAction(state: QaAgentState): Promise<QaAgentUpdate> {
    const action = state.searchPlan.actions[0] ?? {
      type: "evidence_search" as const,
      query: state.expandedQueries[0] ?? state.normalizedQuery ?? state.question,
      topK: state.topK
    }
    const actionResult = await executePlannedAction(state, action)
    const embedUpdate = actionResult.embedUpdate ?? {}
    const searchUpdate = actionResult.searchUpdate
    const nextRetrieved = searchUpdate.retrievedChunks ?? state.retrievedChunks
    const retrievalDiagnostics = searchUpdate.retrievalDiagnostics
    const previousKeys = new Set(state.retrievedChunks.map((chunk) => chunk.key))
    const newEvidenceCount = nextRetrieved.filter((chunk) => !previousKeys.has(chunk.key)).length

    return {
      ...embedUpdate,
      ...searchUpdate,
      newEvidenceCount,
      actionHistory: [
        ...state.actionHistory,
        {
          action: state.searchPlan.actions[0] ?? {
            type: "evidence_search",
            query: state.expandedQueries[0] ?? state.normalizedQuery ?? state.question,
            topK: state.topK
          },
          hitCount: actionResult.hitCount,
          newEvidenceCount,
          topScore: nextRetrieved[0]?.score,
          retrievalDiagnostics,
          summary: actionResult.summary(newEvidenceCount)
        }
      ]
    }
  }

  async function executePlannedAction(
    state: QaAgentState,
    action: SearchAction
  ): Promise<{
    embedUpdate?: QaAgentUpdate
    searchUpdate: QaAgentUpdate
    hitCount: number
    summary: (newEvidenceCount: number) => string
  }> {
    if (action.type === "expand_context") {
      const expanded = await expandContextWindow(deps, state, action)
      const retrievedChunks = mergeRetrievedChunks(state.retrievedChunks, expanded, Math.max(state.topK, 30))
      return {
        searchUpdate: { retrievedChunks },
        hitCount: expanded.length,
        summary: (newEvidenceCount) =>
          expanded.length === 0
            ? "隣接 context chunk は見つかりませんでした。"
            : `隣接 context chunk を${expanded.length}件展開し、新規根拠は${newEvidenceCount}件でした。`
      }
    }

    const searchState = action.type === "query_rewrite" ? withRewrittenQuery(state, action) : state
    const embedUpdate = await embedQueries(searchState)
    const searchUpdate = await searchEvidence({ ...searchState, ...embedUpdate } as QaAgentState)
    const retrievedChunks = searchUpdate.retrievedChunks ?? []

    return {
      embedUpdate: action.type === "query_rewrite" ? { ...embedUpdate, expandedQueries: searchState.expandedQueries } : embedUpdate,
      searchUpdate,
      hitCount: retrievedChunks.length,
      summary: (newEvidenceCount) => {
        if (retrievedChunks.length === 0) return action.type === "query_rewrite" ? "query rewrite 後の検索結果はありませんでした。" : "検索結果はありませんでした。"
        const prefix = action.type === "query_rewrite" ? "query rewrite 後のhybrid検索" : "hybrid検索"
        return `${prefix}で${retrievedChunks.length}件取得し、新規根拠は${newEvidenceCount}件でした。`
      }
    }
  }

  async function evaluateSearchProgress(state: QaAgentState): Promise<QaAgentUpdate> {
    const nextIteration = state.iteration + 1
    const noNewEvidenceStreak = state.newEvidenceCount === 0 ? state.noNewEvidenceStreak + 1 : 0
    const stopCriteria = state.searchPlan.stopCriteria
    const nextActionType = state.retrievalEvaluation.nextAction.type
    const evaluatorDone = nextActionType === "rerank" || nextActionType === "finalize_refusal"
    const stopByIteration = nextIteration >= stopCriteria.maxIterations
    const stopByNoEvidence = noNewEvidenceStreak >= stopCriteria.maxNoNewEvidenceStreak
    const forcedRefusal =
      state.retrievalEvaluation.conflictingFactIds.length > 0 &&
      state.retrievalEvaluation.nextAction.type !== "finalize_refusal" &&
      (stopByIteration || stopByNoEvidence)

    return {
      iteration: nextIteration,
      noNewEvidenceStreak,
      searchDecision: evaluatorDone || stopByIteration || stopByNoEvidence ? "done" : "continue_search",
      retrievalEvaluation: forcedRefusal
        ? {
            ...state.retrievalEvaluation,
            retrievalQuality: "conflicting",
            nextAction: { type: "finalize_refusal", reason: "unresolved_conflicting_evidence" },
            reason: `${state.retrievalEvaluation.reason} 検索 budget 内で conflicting evidence を解消できなかったため、回答生成前に拒否します。`
          }
        : state.retrievalEvaluation
    }
  }

  function routeAfterSearchEvaluation(state: QaAgentState) {
    return state.searchDecision
  }

  function routeAfterGate(state: QaAgentState) {
    return state.answerability.isAnswerable ? "judge_context" : "refuse"
  }

  function routeAfterSufficientContextGate(state: QaAgentState) {
    return state.answerability.isAnswerable ? "answer" : "refuse"
  }

  const nodes = {
    analyzeInput: tracedNode("analyze_input", analyzeInput),
    normalizeQuery: tracedNode("normalize_query", normalizeQuery),
    retrieveMemory: tracedNode("retrieve_memory", createRetrieveMemoryNode(deps, user)),
    generateClues: tracedNode("generate_clues", createGenerateCluesNode(deps)),
    clarificationGate: tracedNode("clarification_gate", clarificationGate),
    finalizeClarification: tracedNode("finalize_clarification", finalizeClarification),
    planSearch: tracedNode("plan_search", planSearch),
    executeSearchAction: tracedNode("execute_search_action", executeSearchAction),
    retrievalEvaluator: tracedNode("retrieval_evaluator", retrievalEvaluator),
    evaluateSearchProgress: tracedNode("evaluate_search_progress", evaluateSearchProgress),
    rerankChunks: tracedNode("rerank_chunks", rerankChunks),
    answerabilityGate: tracedNode("answerability_gate", answerabilityGate),
    sufficientContextGate: tracedNode("sufficient_context_gate", sufficientContextGate),
    generateAnswer: tracedNode("generate_answer", createGenerateAnswerNode(deps)),
    validateCitations: tracedNode("validate_citations", validateCitations),
    verifyAnswerSupport: tracedNode("verify_answer_support", verifyAnswerSupport),
    finalizeResponse: tracedNode("finalize_response", finalizeResponse),
    finalizeRefusal: tracedNode("finalize_refusal", finalizeRefusal)
  }

  return {
    async invoke(initialState: QaAgentState): Promise<QaAgentState> {
      let state = initialState

      state = await applyNode(state, "analyze_input", nodes.analyzeInput, progress)
      state = await applyNode(state, "normalize_query", nodes.normalizeQuery, progress)
      state = await applyNode(state, "retrieve_memory", nodes.retrieveMemory, progress)
      state = await applyNode(state, "generate_clues", nodes.generateClues, progress)
      state = await applyNode(state, "clarification_gate", nodes.clarificationGate, progress)
      if (state.clarification.needsClarification) {
        return applyNode(state, "finalize_clarification", nodes.finalizeClarification, progress)
      }

      do {
        state = await applyNode(state, "plan_search", nodes.planSearch, progress)
        state = await applyNode(state, "execute_search_action", nodes.executeSearchAction, progress)
        state = await applyNode(state, "retrieval_evaluator", nodes.retrievalEvaluator, progress)
        state = await applyNode(state, "clarification_gate", nodes.clarificationGate, progress)
        if (state.clarification.needsClarification) {
          return applyNode(state, "finalize_clarification", nodes.finalizeClarification, progress)
        }
        state = await applyNode(state, "evaluate_search_progress", nodes.evaluateSearchProgress, progress)
      } while (routeAfterSearchEvaluation(state) === "continue_search")

      if (state.retrievalEvaluation.nextAction.type === "finalize_refusal") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }

      state = await applyNode(state, "rerank_chunks", nodes.rerankChunks, progress)
      state = await applyNode(state, "answerability_gate", nodes.answerabilityGate, progress)

      if (routeAfterGate(state) === "refuse") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }

      state = await applyNode(state, "sufficient_context_gate", nodes.sufficientContextGate, progress)
      if (routeAfterSufficientContextGate(state) === "refuse") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }

      state = await applyNode(state, "generate_answer", nodes.generateAnswer, progress)
      state = await applyNode(state, "validate_citations", nodes.validateCitations, progress)
      state = await applyNode(state, "verify_answer_support", nodes.verifyAnswerSupport, progress)
      return applyNode(state, "finalize_response", nodes.finalizeResponse, progress)
    }
  }
}

type QaAgentNode = (state: QaAgentState) => Promise<QaAgentUpdate>

async function applyNode(state: QaAgentState, nodeName: string, node: QaAgentNode, progress?: ProgressSink): Promise<QaAgentState> {
  await progress?.emit({
    type: "status",
    stage: nodeName,
    message: `${nodeName} を実行中`
  })
  const started = Date.now()
  const next = applyQaAgentUpdate(state, await node(state))
  await progress?.emit({
    type: "status",
    stage: nodeName,
    message: `${nodeName} が完了`,
    data: { latencyMs: Date.now() - started }
  })
  return next
}

export function applyQaAgentUpdate(state: QaAgentState, update: QaAgentUpdate): QaAgentState {
  const { trace, ...rest } = update
  const traceUpdates = trace === undefined ? [] : Array.isArray(trace) ? trace : [trace]
  return {
    ...state,
    ...rest,
    trace: [...state.trace, ...traceUpdates]
  }
}

function selectNextSearchAction(state: QaAgentState, fallbackQuery: string): SearchAction {
  const nextAction = state.retrievalEvaluation.nextAction
  if (nextAction.type === "evidence_search" && nextAction.query.trim()) {
    return nextAction
  }
  if (nextAction.type === "query_rewrite" || nextAction.type === "expand_context") return nextAction
  return {
    type: "evidence_search",
    query: fallbackQuery,
    topK: state.topK
  }
}

function withRewrittenQuery(state: QaAgentState, action: Extract<SearchAction, { type: "query_rewrite" }>): QaAgentState {
  const rewritten = rewriteQuery(state, action)
  return {
    ...state,
    expandedQueries: [rewritten, ...state.expandedQueries.filter((query) => query !== rewritten)].slice(0, 8),
    queryEmbeddings: []
  }
}

function rewriteQuery(state: QaAgentState, action: Extract<SearchAction, { type: "query_rewrite" }>): string {
  const base = action.input.trim() || state.normalizedQuery || state.question
  const missingFacts = state.searchPlan.requiredFacts
    .filter((fact) => state.retrievalEvaluation.missingFactIds.includes(fact.id))
    .map((fact) => fact.description)
    .slice(0, 4)
  if (action.strategy === "section") return [...new Set([base, ...missingFacts, "章 見出し セクション"]).values()].join(" ")
  if (action.strategy === "entity") return [...new Set([base, ...missingFacts, "正式名称 略称 別名"]).values()].join(" ")
  if (action.strategy === "hyde") return `${base} ${missingFacts.join(" ")} 回答 根拠 条件 手順 期限 金額`.trim()
  return [...new Set([base, ...missingFacts]).values()].join(" ")
}

async function expandContextWindow(
  deps: Dependencies,
  state: QaAgentState,
  action: Extract<SearchAction, { type: "expand_context" }>
): Promise<RetrievedVector[]> {
  const source = findChunkForExpansion(state.retrievedChunks, action.chunkKey)
  if (!source?.metadata.documentId || !source.metadata.chunkId) return []
  const manifest = await loadManifest(deps, source.metadata.documentId)
  if (!manifest) return []
  const chunks = await loadChunksForManifest(deps, manifest)
  const center = chunks.findIndex((chunk) => chunk.id === source.metadata.chunkId)
  if (center < 0) return []

  const expanded: RetrievedVector[] = []
  const window = Math.max(1, action.window)
  for (let index = Math.max(0, center - window); index <= Math.min(chunks.length - 1, center + window); index += 1) {
    if (index === center) continue
    const chunk = chunks[index]
    if (!chunk) continue
    const distance = Math.abs(index - center)
    expanded.push({
      key: `${source.metadata.documentId}-${chunk.id}`,
      score: Math.max(0, Math.min(0.99, source.score - distance * 0.03)),
      metadata: {
        ...source.metadata,
        kind: "chunk",
        documentId: source.metadata.documentId,
        fileName: manifest.fileName,
        chunkId: chunk.id,
        objectKey: manifest.sourceObjectKey,
        text: chunk.text,
        sources: ["context_window"],
        expansionSource: "context_window",
        createdAt: manifest.createdAt
      }
    })
  }
  return expanded
}

function findChunkForExpansion(chunks: RetrievedVector[], chunkKey: string): RetrievedVector | undefined {
  return chunks.find((chunk) => chunk.key === chunkKey || chunk.metadata.chunkId === chunkKey)
}

async function loadManifest(deps: Dependencies, documentId: string): Promise<DocumentManifest | undefined> {
  try {
    return JSON.parse(await deps.objectStore.getText(`manifests/${documentId}.json`)) as DocumentManifest
  } catch {
    const keys = await deps.objectStore.listKeys("manifests/")
    const key = keys.find((candidate) => candidate.endsWith(".json") && candidate.includes(documentId))
    return key ? (JSON.parse(await deps.objectStore.getText(key)) as DocumentManifest) : undefined
  }
}

function mergeRetrievedChunks(chunks: RetrievedVector[], additions: RetrievedVector[], limit: number): RetrievedVector[] {
  const byKey = new Map<string, RetrievedVector>()
  for (const chunk of [...chunks, ...additions]) {
    const existing = byKey.get(chunk.key)
    if (!existing || chunk.score > existing.score) byKey.set(chunk.key, chunk)
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

function extractRequiredFacts(question: string, clues: string[]): RequiredFact[] {
  const questionRefs = question.match(/[A-Za-z0-9_-]{3,}/g) ?? []
  const clueRefs = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]/u.test(question)
    ? []
    : clues.flatMap((clue) => clue.match(/[A-Za-z0-9_-]{3,}/g) ?? [])
  const refs = questionRefs.length > 0 ? questionRefs : clueRefs
  const uniqueRefs = [...new Set(refs.filter(isUsefulFactReference))].slice(0, 8)
  if (uniqueRefs.length === 0) {
    return [
      {
        id: "fact-1",
        description: question,
        priority: 1,
        status: "missing",
        supportingChunkKeys: []
      }
    ]
  }
  return uniqueRefs.map((ref, index) => ({
    id: `fact-${index + 1}`,
    description: ref,
    priority: index + 1,
    status: "missing",
    supportingChunkKeys: []
  }))
}

function isUsefulFactReference(ref: string): boolean {
  const normalized = ref.toLowerCase()
  if (["clues_json", "memorag", "clue", "generator", "json", "question", "what", "when", "where", "which", "how"].includes(normalized)) return false
  return true
}

function inferSearchComplexity(question: string): QaAgentState["searchPlan"]["complexity"] {
  if (/比較|違い|差分|どちら/.test(question)) return "comparison"
  if (/手順|方法|どうやって|申請|設定/.test(question)) return "procedure"
  if (/それ|これ|上記|前述/.test(question)) return "ambiguous"
  if (/と|および|及び|かつ/.test(question)) return "multi_hop"
  return "simple"
}

export async function runQaAgent(deps: Dependencies, input: ChatInput, user: AppUser = systemAdminUser, progress?: ProgressSink): Promise<QaGraphResult> {
  const startedAt = new Date()
  const startedMs = Date.now()
  const runId = createRunId(startedAt)
  const topK = clamp(input.topK ?? 6, 1, 20)
  const memoryTopK = clamp(input.memoryTopK ?? 4, 1, 10)
  const minScore = input.minScore ?? config.minRetrievalScore
  const modelId = input.modelId ?? config.defaultModelId
  const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
  const clueModelId = input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId
  const graph = createQaAgentGraph(deps, user, progress)

  const state = (await graph.invoke({
    runId,
    question: input.question,
    modelId,
    embeddingModelId,
    clueModelId,
    useMemory: input.useMemory ?? true,
    debug: input.includeDebug ?? input.debug ?? false,
    topK,
    memoryTopK,
    minScore,
    strictGrounded: input.strictGrounded !== false,
    clarificationContext: input.clarificationContext,
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
      intent: input.question,
      requiredFacts: [],
      actions: [],
      stopCriteria: {
        maxIterations: Math.min(8, Math.max(1, input.maxIterations ?? 3)),
        minTopScore: minScore,
        minEvidenceCount: Math.max(2, Math.min(topK, 4)),
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
        topK
      },
      reason: ""
    },
    maxIterations: Math.min(8, Math.max(1, input.maxIterations ?? 3)),
    newEvidenceCount: 0,
    noNewEvidenceStreak: 0,
    searchDecision: "continue_search",
    retrievedChunks: [],
    retrievalDiagnostics: undefined,
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
    trace: []
  })) as QaAgentState

  const answer = state.answer ?? NO_ANSWER
  const isClarification = state.clarification.needsClarification
  const isAnswerable = !isClarification && state.answerability.isAnswerable && answer !== NO_ANSWER
  const citations = isAnswerable ? state.citations : []
  const retrieved = isClarification ? [] : state.retrievedChunks.map(toCitation)
  const shouldIncludeDebug = input.includeDebug ?? input.debug ?? false
  const debug = shouldIncludeDebug
    ? await persistDebugTrace(deps, {
        runId,
        question: input.question,
        modelId,
        embeddingModelId,
        clueModelId,
        topK,
        memoryTopK,
        minScore,
        startedAt,
        startedMs,
        answer,
        isAnswerable,
        citations,
        retrieved,
        state
      })
    : undefined

  return {
    responseType: isClarification ? "clarification" : isAnswerable ? "answer" : "refusal",
    answer,
    isAnswerable,
    needsClarification: isClarification,
    clarification: isClarification ? toPublicClarification(state.clarification) : undefined,
    citations,
    retrieved,
    debug
  }
}

function toPublicClarification(clarification: Clarification): Omit<Clarification, "rejectedOptions"> {
  const { rejectedOptions: _rejectedOptions, ...publicClarification } = clarification
  return publicClarification
}

async function persistDebugTrace(
  deps: Dependencies,
  input: {
    runId: string
    question: string
    modelId: string
    embeddingModelId: string
    clueModelId: string
    topK: number
    memoryTopK: number
    minScore: number
    startedAt: Date
    startedMs: number
    answer: string
    isAnswerable: boolean
    citations: DebugTrace["citations"]
    retrieved: DebugTrace["retrieved"]
    state: QaAgentState
  }
): Promise<DebugTrace> {
  const completedAt = new Date()
  const trace: DebugTrace = {
    schemaVersion: DEBUG_TRACE_SCHEMA_VERSION,
    runId: input.runId,
    question: input.question,
    modelId: input.modelId,
    embeddingModelId: input.embeddingModelId,
    clueModelId: input.clueModelId,
    pipelineVersions: buildPipelineVersions({
      embeddingModelId: input.embeddingModelId,
      embeddingDimensions: config.embeddingDimensions
    }),
    topK: input.topK,
    memoryTopK: input.memoryTopK,
    minScore: input.minScore,
    clarificationContext: input.state.clarificationContext,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalLatencyMs: Math.max(0, Date.now() - input.startedMs),
    status: input.isAnswerable ? "success" : "warning",
    answerPreview: input.answer,
    isAnswerable: input.isAnswerable,
    citations: input.citations,
    retrieved: input.retrieved,
    steps: input.state.trace
  }

  await deps.objectStore.putText(debugTraceKey(trace), JSON.stringify(trace, null, 2), "application/json")
  return trace
}

function createRunId(startedAt: Date): string {
  const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_")
  return `run_${stamp}_${randomUUID().slice(0, 8)}`
}

function debugTraceKey(trace: DebugTrace): string {
  return `debug-runs/${trace.startedAt.slice(0, 10)}/${trace.runId}.json`
}
