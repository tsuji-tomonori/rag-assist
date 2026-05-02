import { randomUUID } from "node:crypto"
import type { AppUser } from "../auth.js"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import { DEBUG_TRACE_SCHEMA_VERSION, type DebugTrace } from "../types.js"
import { analyzeInput } from "./nodes/analyze-input.js"
import { answerabilityGate } from "./nodes/answerability-gate.js"
import { createEmbedQueriesNode } from "./nodes/embed-queries.js"
import { finalizeRefusal } from "./nodes/finalize-refusal.js"
import { finalizeResponse } from "./nodes/finalize-response.js"
import { createGenerateAnswerNode } from "./nodes/generate-answer.js"
import { createGenerateCluesNode } from "./nodes/generate-clues.js"
import { normalizeQuery } from "./nodes/normalize-query.js"
import { rerankChunks } from "./nodes/rerank-chunks.js"
import { retrievalEvaluator } from "./nodes/retrieval-evaluator.js"
import { createRetrieveMemoryNode } from "./nodes/retrieve-memory.js"
import { createSearchEvidenceNode } from "./nodes/search-evidence.js"
import { createSufficientContextGateNode } from "./nodes/sufficient-context-gate.js"
import { validateCitations } from "./nodes/validate-citations.js"
import { createVerifyAnswerSupportNode } from "./nodes/verify-answer-support.js"
import { NO_ANSWER, type QaAgentState, type QaAgentUpdate, type RequiredFact, type SearchAction } from "./state.js"
import { tracedNode } from "./trace.js"
import type { ChatInput, QaGraphResult } from "./types.js"
import { clamp, toCitation } from "./utils.js"

const systemAdminUser: AppUser = {
  userId: "system",
  email: "system@example.com",
  cognitoGroups: ["SYSTEM_ADMIN"]
}

export function createQaAgentGraph(deps: Dependencies, user: AppUser = systemAdminUser) {
  const embedQueries = createEmbedQueriesNode(deps)
  const searchEvidence = createSearchEvidenceNode(deps, user)
  const sufficientContextGate = createSufficientContextGateNode(deps)
  const verifyAnswerSupport = createVerifyAnswerSupportNode(deps)

  async function planSearch(state: QaAgentState): Promise<QaAgentUpdate> {
    const query = state.expandedQueries[0] ?? state.normalizedQuery ?? state.question
    const nextEvidenceAction = selectNextEvidenceAction(state, query)
    const requiredFacts =
      state.searchPlan.requiredFacts.length > 0 ? state.searchPlan.requiredFacts : extractRequiredFacts(state.question, state.clues)
    const actions: SearchAction[] = [
      nextEvidenceAction
    ]

    return {
      expandedQueries: nextEvidenceAction.query === query ? state.expandedQueries : [nextEvidenceAction.query, ...state.expandedQueries].slice(0, 8),
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
    const embedUpdate = await embedQueries(state)
    const searchUpdate = await searchEvidence({ ...state, ...embedUpdate } as QaAgentState)
    const nextRetrieved = searchUpdate.retrievedChunks ?? []
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
          hitCount: nextRetrieved.length,
          newEvidenceCount,
          topScore: nextRetrieved[0]?.score,
          retrievalDiagnostics,
          summary:
            nextRetrieved.length === 0
              ? "検索結果はありませんでした。"
              : `hybrid検索で${nextRetrieved.length}件取得し、新規根拠は${newEvidenceCount}件でした。`
        }
      ]
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

    return {
      iteration: nextIteration,
      noNewEvidenceStreak,
      searchDecision: evaluatorDone || stopByIteration || stopByNoEvidence ? "done" : "continue_search"
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
    retrieveMemory: tracedNode("retrieve_memory", createRetrieveMemoryNode(deps)),
    generateClues: tracedNode("generate_clues", createGenerateCluesNode(deps)),
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

      state = await applyNode(state, nodes.analyzeInput)
      state = await applyNode(state, nodes.normalizeQuery)
      state = await applyNode(state, nodes.retrieveMemory)
      state = await applyNode(state, nodes.generateClues)

      do {
        state = await applyNode(state, nodes.planSearch)
        state = await applyNode(state, nodes.executeSearchAction)
        state = await applyNode(state, nodes.retrievalEvaluator)
        state = await applyNode(state, nodes.evaluateSearchProgress)
      } while (routeAfterSearchEvaluation(state) === "continue_search")

      if (state.retrievalEvaluation.nextAction.type === "finalize_refusal") {
        return applyNode(state, nodes.finalizeRefusal)
      }

      state = await applyNode(state, nodes.rerankChunks)
      state = await applyNode(state, nodes.answerabilityGate)

      if (routeAfterGate(state) === "refuse") {
        return applyNode(state, nodes.finalizeRefusal)
      }

      state = await applyNode(state, nodes.sufficientContextGate)
      if (routeAfterSufficientContextGate(state) === "refuse") {
        return applyNode(state, nodes.finalizeRefusal)
      }

      state = await applyNode(state, nodes.generateAnswer)
      state = await applyNode(state, nodes.validateCitations)
      state = await applyNode(state, nodes.verifyAnswerSupport)
      return applyNode(state, nodes.finalizeResponse)
    }
  }
}

type QaAgentNode = (state: QaAgentState) => Promise<QaAgentUpdate>

async function applyNode(state: QaAgentState, node: QaAgentNode): Promise<QaAgentState> {
  return applyQaAgentUpdate(state, await node(state))
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

function selectNextEvidenceAction(state: QaAgentState, fallbackQuery: string): Extract<SearchAction, { type: "evidence_search" }> {
  const nextAction = state.retrievalEvaluation.nextAction
  if (nextAction.type === "evidence_search" && nextAction.query.trim()) {
    return nextAction
  }
  return {
    type: "evidence_search",
    query: fallbackQuery,
    topK: state.topK
  }
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

export async function runQaAgent(deps: Dependencies, input: ChatInput, user: AppUser = systemAdminUser): Promise<QaGraphResult> {
  const startedAt = new Date()
  const startedMs = Date.now()
  const runId = createRunId(startedAt)
  const topK = clamp(input.topK ?? 6, 1, 20)
  const memoryTopK = clamp(input.memoryTopK ?? 4, 1, 10)
  const minScore = input.minScore ?? config.minRetrievalScore
  const modelId = input.modelId ?? config.defaultModelId
  const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
  const clueModelId = input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId
  const graph = createQaAgentGraph(deps, user)

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
    citations: [],
    trace: []
  })) as QaAgentState

  const answer = state.answer ?? NO_ANSWER
  const isAnswerable = state.answerability.isAnswerable && answer !== NO_ANSWER
  const citations = isAnswerable ? state.citations : []
  const retrieved = state.retrievedChunks.map(toCitation)
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
    answer,
    isAnswerable,
    citations,
    retrieved,
    debug
  }
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
    topK: input.topK,
    memoryTopK: input.memoryTopK,
    minScore: input.minScore,
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
