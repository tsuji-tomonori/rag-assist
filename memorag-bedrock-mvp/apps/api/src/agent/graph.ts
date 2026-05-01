import { randomUUID } from "node:crypto"
import { END, START, StateGraph } from "@langchain/langgraph"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import type { DebugTrace } from "../types.js"
import { analyzeInput } from "./nodes/analyze-input.js"
import { answerabilityGate } from "./nodes/answerability-gate.js"
import { createEmbedQueriesNode } from "./nodes/embed-queries.js"
import { finalizeRefusal } from "./nodes/finalize-refusal.js"
import { finalizeResponse } from "./nodes/finalize-response.js"
import { createGenerateAnswerNode } from "./nodes/generate-answer.js"
import { createGenerateCluesNode } from "./nodes/generate-clues.js"
import { normalizeQuery } from "./nodes/normalize-query.js"
import { rerankChunks } from "./nodes/rerank-chunks.js"
import { createRetrieveMemoryNode } from "./nodes/retrieve-memory.js"
import { createSearchEvidenceNode } from "./nodes/search-evidence.js"
import { validateCitations } from "./nodes/validate-citations.js"
import { AgentState, NO_ANSWER, type QaAgentState, type QaAgentUpdate } from "./state.js"
import { tracedNode } from "./trace.js"
import type { ChatInput, QaGraphResult } from "./types.js"
import { clamp, toCitation } from "./utils.js"

export function createQaAgentGraph(deps: Dependencies) {
  const embedQueries = createEmbedQueriesNode(deps)
  const searchEvidence = createSearchEvidenceNode(deps)

  async function planSearch(state: QaAgentState): Promise<QaAgentUpdate> {
    const unresolvedReferences = state.unresolvedReferences.length > 0 ? state.unresolvedReferences : extractUnresolvedReferences(state.question, state.clues)
    return {
      unresolvedReferences,
      searchDecision: "continue_search"
    }
  }

  async function executeSearchAction(state: QaAgentState): Promise<QaAgentUpdate> {
    const embedUpdate = await embedQueries(state)
    const searchUpdate = await searchEvidence({ ...state, ...embedUpdate } as QaAgentState)
    const nextRetrieved = searchUpdate.retrievedChunks ?? []
    const previousKeys = new Set(state.retrievedChunks.map((chunk) => chunk.key))
    const newEvidenceCount = nextRetrieved.filter((chunk) => !previousKeys.has(chunk.key)).length

    return {
      ...embedUpdate,
      ...searchUpdate,
      newEvidenceCount
    }
  }

  async function evaluateSearchProgress(state: QaAgentState): Promise<QaAgentUpdate> {
    const nextIteration = state.iteration + 1
    const noNewEvidenceStreak = state.newEvidenceCount === 0 ? state.noNewEvidenceStreak + 1 : 0
    const topScore = state.retrievedChunks[0]?.score ?? 0
    const enoughEvidence = state.retrievedChunks.length >= Math.max(2, Math.min(state.topK, 4)) && topScore >= state.minScore
    const stopByIteration = nextIteration >= state.maxIterations
    const stopByNoEvidence = noNewEvidenceStreak >= 2

    return {
      iteration: nextIteration,
      noNewEvidenceStreak,
      searchDecision: enoughEvidence || stopByIteration || stopByNoEvidence ? "done" : "continue_search"
    }
  }

  function routeAfterSearchEvaluation(state: QaAgentState) {
    return state.searchDecision
  }

  function routeAfterGate(state: QaAgentState) {
    return state.answerability.isAnswerable ? "answer" : "refuse"
  }

  return new StateGraph(AgentState)
    .addNode("analyze_input", tracedNode("analyze_input", analyzeInput))
    .addNode("normalize_query", tracedNode("normalize_query", normalizeQuery))
    .addNode("retrieve_memory", tracedNode("retrieve_memory", createRetrieveMemoryNode(deps)))
    .addNode("generate_clues", tracedNode("generate_clues", createGenerateCluesNode(deps)))
    .addNode("plan_search", tracedNode("plan_search", planSearch))
    .addNode("execute_search_action", tracedNode("execute_search_action", executeSearchAction))
    .addNode("evaluate_search_progress", tracedNode("evaluate_search_progress", evaluateSearchProgress))
    .addNode("rerank_chunks", tracedNode("rerank_chunks", rerankChunks))
    .addNode("answerability_gate", tracedNode("answerability_gate", answerabilityGate))
    .addNode("generate_answer", tracedNode("generate_answer", createGenerateAnswerNode(deps)))
    .addNode("validate_citations", tracedNode("validate_citations", validateCitations))
    .addNode("finalize_response", tracedNode("finalize_response", finalizeResponse))
    .addNode("finalize_refusal", tracedNode("finalize_refusal", finalizeRefusal))
    .addEdge(START, "analyze_input")
    .addEdge("analyze_input", "normalize_query")
    .addEdge("normalize_query", "retrieve_memory")
    .addEdge("retrieve_memory", "generate_clues")
    .addEdge("generate_clues", "plan_search")
    .addEdge("plan_search", "execute_search_action")
    .addEdge("execute_search_action", "evaluate_search_progress")
    .addConditionalEdges("evaluate_search_progress", routeAfterSearchEvaluation, {
      continue_search: "plan_search",
      done: "rerank_chunks"
    })
    .addEdge("rerank_chunks", "answerability_gate")
    .addConditionalEdges("answerability_gate", routeAfterGate, {
      answer: "generate_answer",
      refuse: "finalize_refusal"
    })
    .addEdge("generate_answer", "validate_citations")
    .addEdge("validate_citations", "finalize_response")
    .addEdge("finalize_response", END)
    .addEdge("finalize_refusal", END)
    .compile()
}

function extractUnresolvedReferences(question: string, clues: string[]): string[] {
  const base = [question, ...clues].join("\n")
  const refs = base.match(/[A-Za-z0-9_-]{3,}/g) ?? []
  return [...new Set(refs)].slice(0, 8)
}

export async function runQaAgent(deps: Dependencies, input: ChatInput): Promise<QaGraphResult> {
  const startedAt = new Date()
  const startedMs = Date.now()
  const runId = createRunId(startedAt)
  const topK = clamp(input.topK ?? 6, 1, 20)
  const memoryTopK = clamp(input.memoryTopK ?? 4, 1, 10)
  const minScore = input.minScore ?? config.minRetrievalScore
  const modelId = input.modelId ?? config.defaultModelId
  const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
  const clueModelId = input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId
  const graph = createQaAgentGraph(deps)

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
    memoryCards: [],
    clues: [],
    expandedQueries: [],
    queryEmbeddings: [],
    unresolvedReferences: [],
    iteration: 0,
    maxIterations: Math.min(8, Math.max(1, input.maxIterations ?? 3)),
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
    citations: []
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
