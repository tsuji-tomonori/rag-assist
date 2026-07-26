import { randomUUID } from "node:crypto"
import type { AppUser } from "../../auth.js"
import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import { hasUsableComputedFact } from "../../chat-orchestration/computation.js"
import { loadChunksForManifest } from "../_shared/storage/manifest-chunks.js"
import { isQualityApprovedForNormalRag } from "../_shared/policies/quality-policy.js"
import { CURRENT_RAG_ELIGIBILITY_POLICY_VERSION, currentEligibilitySnapshotFromAuthoritativeState, evaluateCurrentRagEligibility } from "../_shared/security/current-rag-eligibility.js"
import { reauthorizeCurrentEvidence } from "../_shared/security/current-evidence-reauthorizer.js"
import { readTenantManifest } from "../_shared/storage/tenant-artifacts.js"
import { DocumentPermissionService } from "../../documents/document-permission-service.js"
import { buildPipelineVersions } from "../offline/pre-retrieval/indexing/index-version-store.js"
import { containsSensitiveOutput, sanitizeDebugTraceForPersistence } from "../_shared/security/trace-sanitizer.js"
import { UNTRUSTED_CONTENT_POLICY_VERSION, inspectPromptEvidence } from "../_shared/security/untrusted-content-policy.js"
import { buildReplayVersionManifest } from "../_shared/replay/replay-version-manifest.js"
import { emptyReplaySourceSnapshot, replaySourceSnapshotFromManifest } from "../_shared/replay/replay-source-snapshot.js"
import { assertRagSafetyInterlock } from "../quality-control/production-rag-monitor.js"
import { ProductionRagObservationProducer, bestEffortCapture } from "../quality-control/production-rag-observation-producer.js"
import { RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION } from "../../security/resource-operation-authorization.js"
import { tenantPartitionId } from "../../security/tenant-partition.js"
import {
  // The active guard profile is supplied by Dependencies, never by a module constant.
  assertSafeRagGuardProfile,
  measurePartialRuntimeRagGuards,
  type MandatoryRagGuard,
  type SafeDegradationDecision
} from "../_shared/security/safe-degradation-policy.js"
import { CHAT_ORCHESTRATION_TRACE_TARGET_TYPE, DEBUG_TRACE_SANITIZE_POLICY_VERSION, DEBUG_TRACE_SCHEMA_VERSION, type DebugTrace } from "../../types.js"
import type { Citation, DocumentManifest, ReplaySourceSnapshot, ReplayVersionManifest, RetrievedVector } from "../../types.js"
import { analyzeInput } from "../../chat-orchestration/nodes/analyze-input.js"
import { answerabilityGate } from "../online/post-retrieval/answerability/answerability-gate.js"
import { buildConversationState, decontextualizeQuery } from "../../chat-orchestration/nodes/build-conversation-state.js"
import { buildTemporalContext } from "../../chat-orchestration/nodes/build-temporal-context.js"
import { clarificationGate } from "../../chat-orchestration/nodes/clarification-gate.js"
import { detectToolIntent } from "../../chat-orchestration/nodes/detect-tool-intent.js"
import { createEmbedQueriesNode } from "../../chat-orchestration/nodes/embed-queries.js"
import { executeComputationTools } from "../../chat-orchestration/nodes/execute-computation-tools.js"
import { createExtractPolicyComputationsNode } from "../../chat-orchestration/nodes/extract-policy-computations.js"
import { finalizeClarification } from "../../chat-orchestration/nodes/finalize-clarification.js"
import { finalizeRefusal } from "../../chat-orchestration/nodes/finalize-refusal.js"
import { finalizeResponse } from "../../chat-orchestration/nodes/finalize-response.js"
import { createGenerateAnswerNode } from "../online/generation/answer/answer-generator.js"
import { createGenerateCluesNode } from "../../chat-orchestration/nodes/generate-clues.js"
import { normalizeQuery } from "../../chat-orchestration/nodes/normalize-query.js"
import { rerankChunks } from "../online/post-retrieval/rerank/reranker.service.js"
import { createRetrievalEvaluatorNode } from "../../chat-orchestration/nodes/retrieval-evaluator.js"
import { createRetrieveMemoryNode } from "../../chat-orchestration/nodes/retrieve-memory.js"
import { createSearchEvidenceNode } from "../online/retrieval/request-time/search-evidence.js"
import { createSufficientContextGateNode } from "../online/post-retrieval/answerability/sufficient-context-gate.js"
import { buildFinalEvidenceSet } from "../online/post-retrieval/evidence/final-evidence-set.js"
import { validateCitations } from "../online/generation/citation/citation-validator.js"
import { createVerifyAnswerSupportNode } from "../online/generation/verification/answer-support-verifier.js"
import { deriveMinEvidenceCount, expandedSearchTopK, normalizeMaxIterations, normalizeMemoryTopK, normalizeMinScore, normalizeTopK, ragRuntimePolicy } from "../../chat-orchestration/runtime-policy.js"
import { NO_ANSWER, isPrimaryRequiredFact, type Clarification, type ChatOrchestrationState, type ChatOrchestrationUpdate, type RequiredFact, type SearchAction } from "../../chat-orchestration/state.js"
import { buildSignalPhrase } from "../../chat-orchestration/text-signals.js"
import { tracedNode } from "../../chat-orchestration/trace.js"
import type { ChatInput, ChatOrchestrationResult } from "../../chat-orchestration/types.js"
import { buildChatToolInvocationsFromTrace } from "../../chat-orchestration/tool-registry.js"

const systemAdminUser: AppUser = {
  userId: config.localAuthUserId,
  email: config.localAuthEmail || undefined,
  cognitoGroups: [...config.localAuthGroups],
  accountStatus: "active",
  tenantId: config.localAuthTenantId
}

export type ProgressSink = {
  emit: (event: {
    type: "status" | "final" | "error"
    stage?: string
    message?: string
    data?: unknown
  }) => Promise<void>
  authorizeProtectedRead?: () => Promise<void>
  authorizeExternalSideEffect?: () => Promise<void>
  authorizeDurableCommit?: () => Promise<void>
  recordObservationArtifact?: (runId: string) => void
  recordPersistedTrace?: (trace: DebugTrace) => void
}

export function createChatOrchestrationGraph(deps: Dependencies, user: AppUser = systemAdminUser, progress?: ProgressSink) {
  const embedQueries = createEmbedQueriesNode(deps)
  const searchEvidence = createSearchEvidenceNode(deps, user)
  const retrievalEvaluator = createRetrievalEvaluatorNode(deps)
  const extractPolicyComputations = createExtractPolicyComputationsNode(deps)
  const sufficientContextGate = createSufficientContextGateNode(deps)
  const verifyAnswerSupport = createVerifyAnswerSupportNode(deps)

  async function planSearch(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
    const query = state.expandedQueries[0] ?? state.normalizedQuery ?? state.question
    const nextAction = selectNextSearchAction(state, query)
    const requiredFacts =
      state.searchPlan.requiredFacts.length > 0 ? state.searchPlan.requiredFacts : extractRequiredFacts(state.question, state.clues)
    const actions: SearchAction[] = [
      nextAction
    ]
    const expandedQueries = nextAction.type === "evidence_search"
      ? nextAction.query === query ? state.expandedQueries : [nextAction.query, ...state.expandedQueries].slice(0, ragRuntimePolicy.limits.expandedQueryLimit)
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
          minEvidenceCount: deriveMinEvidenceCount(state.topK),
          maxNoNewEvidenceStreak: ragRuntimePolicy.retrieval.maxNoNewEvidenceStreak
        }
      },
      searchDecision: "continue_search"
    }
  }

  async function executeSearchAction(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
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
    state: ChatOrchestrationState,
    action: SearchAction
  ): Promise<{
    embedUpdate?: ChatOrchestrationUpdate
    searchUpdate: ChatOrchestrationUpdate
    hitCount: number
    summary: (newEvidenceCount: number) => string
  }> {
    if (action.type === "expand_context") {
      await progress?.authorizeProtectedRead?.()
      const expanded = await expandContextWindow(deps, state, action, user)
      const retrievedChunks = mergeRetrievedChunks(state.retrievedChunks, expanded, expandedSearchTopK(state.topK))
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
    await progress?.authorizeExternalSideEffect?.()
    const embedUpdate = await embedQueries(searchState)
    await progress?.authorizeProtectedRead?.()
    const searchUpdate = await searchEvidence({ ...searchState, ...embedUpdate } as ChatOrchestrationState)
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

  async function evaluateSearchProgress(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
    const nextIteration = state.iteration + 1
    const noNewEvidenceStreak = state.newEvidenceCount === 0 ? state.noNewEvidenceStreak + 1 : 0
    const stopCriteria = state.searchPlan.stopCriteria
    const nextActionType = state.retrievalEvaluation.nextAction.type
    const evaluatorDone = nextActionType === "rerank" || nextActionType === "finalize_refusal"
    const stopByIteration = nextIteration >= stopCriteria.maxIterations
    const stopByNoEvidence = noNewEvidenceStreak >= stopCriteria.maxNoNewEvidenceStreak
    const stopByExhaustedCandidates = exhaustedCandidateSet(state)
    const stopByRepeatedNoEvidence = repeatedNoNewEvidenceAction(state)
    const unresolvedPrimaryConflict = state.retrievalEvaluation.conflictingFactIds.some((factId) => isPrimaryRequiredFactId(state.searchPlan.requiredFacts, factId))
    const stopBySimpleHighConfidence = hasSimpleHighConfidenceEvidence(state, unresolvedPrimaryConflict)
    const forcedRefusal =
      unresolvedPrimaryConflict &&
      state.retrievalEvaluation.nextAction.type !== "finalize_refusal" &&
      (stopByIteration || stopByNoEvidence || stopByExhaustedCandidates || stopByRepeatedNoEvidence)

    return {
      iteration: nextIteration,
      noNewEvidenceStreak,
      searchDecision: evaluatorDone || stopByIteration || stopByNoEvidence || stopByExhaustedCandidates || stopByRepeatedNoEvidence || stopBySimpleHighConfidence ? "done" : "continue_search",
      retrievalEvaluation: forcedRefusal
        ? {
            ...state.retrievalEvaluation,
            retrievalQuality: "conflicting",
            nextAction: { type: "finalize_refusal", reason: "unresolved_conflicting_evidence" },
            reason: `${state.retrievalEvaluation.reason} 検索 budget 内で primary fact の conflicting evidence を解消できなかったため、回答生成前に拒否します。`
          }
        : state.retrievalEvaluation
    }
  }

  function hasSimpleHighConfidenceEvidence(state: ChatOrchestrationState, unresolvedPrimaryConflict: boolean): boolean {
    if (state.searchPlan.complexity !== "simple") return false
    if (unresolvedPrimaryConflict) return false
    if (state.newEvidenceCount <= 0) return false
    if (state.retrievalEvaluation.retrievalQuality === "irrelevant") return false
    if (state.retrievalEvaluation.nextAction.type === "finalize_refusal") return false
    return (state.retrievedChunks[0]?.score ?? 0) >= ragRuntimePolicy.retrieval.highConfidenceTopScore
  }

  function routeAfterSearchEvaluation(state: ChatOrchestrationState) {
    return state.searchDecision
  }

  function isPrimaryRequiredFactId(facts: RequiredFact[], factId: string): boolean {
    const fact = facts.find((item) => item.id === factId)
    return !fact || isPrimaryRequiredFact(fact)
  }

  function exhaustedCandidateSet(state: ChatOrchestrationState): boolean {
    const latest = state.actionHistory.at(-1)
    return Boolean(latest && latest.hitCount > 0 && latest.newEvidenceCount === 0)
  }

  function repeatedNoNewEvidenceAction(state: ChatOrchestrationState): boolean {
    const latest = state.actionHistory.at(-1)
    if (!latest || latest.newEvidenceCount > 0) return false
    const latestKey = searchActionKey(latest.action)
    return state.actionHistory.slice(0, -1).some((observation) => searchActionKey(observation.action) === latestKey)
  }

  function searchActionKey(action: SearchAction): string {
    if (action.type === "evidence_search") return `${action.type}:${action.query}:${action.topK}`
    if (action.type === "query_rewrite") return `${action.type}:${action.strategy}:${action.input}`
    if (action.type === "expand_context") return `${action.type}:${action.chunkKey}:${action.window}`
    return action.type
  }

  function routeAfterGate(state: ChatOrchestrationState) {
    return state.answerability.isAnswerable ? "judge_context" : "refuse"
  }

  function routeAfterSufficientContextGate(state: ChatOrchestrationState) {
    return state.answerability.isAnswerable ? "answer" : "refuse"
  }

  async function reauthorizeEvidence(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
    const unique = new Map<string, RetrievedVector>()
    for (const chunk of [...state.retrievedChunks, ...state.selectedChunks, ...state.memoryCards]) unique.set(chunk.key, chunk)
    if (unique.size === 0) return {}
    const result = await reauthorizeCurrentEvidence({
      deps,
      user,
      chunks: [...unique.values()],
      purpose: "normal_answer",
      scope: state.searchScope,
      conversationId: state.conversation?.conversationId
    })
    const eligibleKeys = new Set(result.eligible.map((chunk) => chunk.key))
    const selectedDenied = state.selectedChunks.some((chunk) => !eligibleKeys.has(chunk.key))
    const retrievalDiagnostics = appendCurrentAuthorizationDenials(
      state.retrievalDiagnostics,
      result.eligible.length,
      result.denied.length
    )
    return {
      retrievedChunks: state.retrievedChunks.filter((chunk) => eligibleKeys.has(chunk.key)),
      selectedChunks: state.selectedChunks.filter((chunk) => eligibleKeys.has(chunk.key)),
      memoryCards: state.memoryCards.filter((chunk) => eligibleKeys.has(chunk.key)),
      ...(retrievalDiagnostics ? { retrievalDiagnostics } : {}),
      ...(selectedDenied
        ? {
            answer: NO_ANSWER,
            citations: [],
            usedComputedFactIds: [],
            answerability: {
              isAnswerable: false,
              reason: "authorization_revoked" as const,
              confidence: 1
            }
          }
        : {})
    }
  }

  const nodes = {
    analyzeInput: tracedNode("analyze_input", analyzeInput),
    buildTemporalContext: tracedNode("build_temporal_context", buildTemporalContext),
    recordScopeNormalization: tracedNode("normalize_search_scope", async (state) => state.sessionScopeNormalization
      ? { sessionScopeNormalization: state.sessionScopeNormalization }
      : {}),
    detectToolIntent: tracedNode("detect_tool_intent", detectToolIntent),
    buildConversationState: tracedNode("build_conversation_state", buildConversationState),
    decontextualizeQuery: tracedNode("decontextualize_query", decontextualizeQuery),
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
    reauthorizeEvidence: tracedNode("reauthorize_evidence", reauthorizeEvidence),
    extractPolicyComputations: tracedNode("extract_policy_computations", extractPolicyComputations),
    executeComputationTools: tracedNode("execute_computation_tools", executeComputationTools),
    answerabilityGate: tracedNode("answerability_gate", answerabilityGate),
    sufficientContextGate: tracedNode("sufficient_context_gate", sufficientContextGate),
    generateAnswer: tracedNode("generate_answer", createGenerateAnswerNode(deps)),
    validateCitations: tracedNode("validate_citations", validateCitations),
    verifyAnswerSupport: tracedNode("verify_answer_support", verifyAnswerSupport),
    finalizeResponse: tracedNode("finalize_response", finalizeResponse),
    finalizeRefusal: tracedNode("finalize_refusal", finalizeRefusal)
  }

  return {
    async invoke(initialState: ChatOrchestrationState): Promise<ChatOrchestrationState> {
      let state = initialState

      state = await applyNode(state, "analyze_input", nodes.analyzeInput, progress)
      state = await applyNode(state, "build_temporal_context", nodes.buildTemporalContext, progress)
      if (state.answerability.reason === "invalid_temporal_context") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }
      state = await applyNode(state, "normalize_search_scope", nodes.recordScopeNormalization, progress)
      state = await applyNode(state, "detect_tool_intent", nodes.detectToolIntent, progress)
      state = await applyNode(state, "build_conversation_state", nodes.buildConversationState, progress)
      state = await applyNode(state, "decontextualize_query", nodes.decontextualizeQuery, progress)

      if (state.toolIntent?.canAnswerFromQuestionOnly) {
        state = await applyNode(state, "execute_computation_tools", nodes.executeComputationTools, progress)
        if (hasUsableComputedFact(state.computedFacts)) {
          state = await applyNode(state, "answerability_gate", nodes.answerabilityGate, progress)
          if (routeAfterGate(state) === "refuse") {
            return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
          }
          state = await applyNode(state, "generate_answer", nodes.generateAnswer, progress)
          state = await applyNode(state, "validate_citations", nodes.validateCitations, progress)
          state = await applyNode(state, "verify_answer_support", nodes.verifyAnswerSupport, progress)
          return applyNode(state, "finalize_response", nodes.finalizeResponse, progress)
        }
      }

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
      state = await applyNode(state, "reauthorize_evidence", nodes.reauthorizeEvidence, progress)
      if (state.answerability.reason === "authorization_revoked") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }
      if (shouldExtractPolicyComputations(state)) {
        state = await applyNode(state, "extract_policy_computations", nodes.extractPolicyComputations, progress)
      }
      if (state.toolIntent && (state.toolIntent.needsArithmeticCalculation || state.toolIntent.needsTemporalCalculation || state.toolIntent.needsAggregation || state.toolIntent.needsTaskDeadlineIndex)) {
        state = await applyNode(state, "execute_computation_tools", nodes.executeComputationTools, progress)
      }
      state = await applyNode(state, "answerability_gate", nodes.answerabilityGate, progress)

      if (routeAfterGate(state) === "refuse") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }

      state = await applyNode(state, "sufficient_context_gate", nodes.sufficientContextGate, progress)
      if (routeAfterSufficientContextGate(state) === "refuse") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }

      state = await applyNode(state, "generate_answer", nodes.generateAnswer, progress)
      state = await applyNode(state, "reauthorize_evidence", nodes.reauthorizeEvidence, progress)
      if (state.answerability.reason === "authorization_revoked") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }
      state = await applyNode(state, "validate_citations", nodes.validateCitations, progress)
      state = await applyNode(state, "verify_answer_support", nodes.verifyAnswerSupport, progress)
      state = await applyNode(state, "reauthorize_evidence", nodes.reauthorizeEvidence, progress)
      if (state.answerability.reason === "authorization_revoked") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }
      return applyNode(state, "finalize_response", nodes.finalizeResponse, progress)
    }
  }
}

type ChatOrchestrationNode = (state: ChatOrchestrationState) => Promise<ChatOrchestrationUpdate>

async function applyNode(state: ChatOrchestrationState, nodeName: string, node: ChatOrchestrationNode, progress?: ProgressSink): Promise<ChatOrchestrationState> {
  await progress?.emit({
    type: "status",
    stage: nodeName,
    message: `${nodeName} を実行中`
  })
  await authorizeNodeBoundary(nodeName, progress)
  const started = Date.now()
  const next = applyChatOrchestrationUpdate(state, await node(state))
  await progress?.emit({
    type: "status",
    stage: nodeName,
    message: `${nodeName} が完了`,
    data: { latencyMs: Date.now() - started }
  })
  return next
}

async function authorizeNodeBoundary(nodeName: string, progress: ProgressSink | undefined): Promise<void> {
  if (["retrieve_memory", "reauthorize_evidence"].includes(nodeName)) {
    await progress?.authorizeProtectedRead?.()
    return
  }
  if ([
    "generate_clues",
    "retrieval_evaluator",
    "extract_policy_computations",
    "sufficient_context_gate",
    "generate_answer",
    "verify_answer_support"
  ].includes(nodeName)) {
    await progress?.authorizeExternalSideEffect?.()
  }
}

export function applyChatOrchestrationUpdate(state: ChatOrchestrationState, update: ChatOrchestrationUpdate): ChatOrchestrationState {
  const { trace, ...rest } = update
  const traceUpdates = trace === undefined ? [] : Array.isArray(trace) ? trace : [trace]
  return {
    ...state,
    ...rest,
    trace: [...state.trace, ...traceUpdates]
  }
}

function selectNextSearchAction(state: ChatOrchestrationState, fallbackQuery: string): SearchAction {
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

function shouldExtractPolicyComputations(state: ChatOrchestrationState): boolean {
  if (state.selectedChunks.length === 0) return false
  if (state.toolIntent?.needsArithmeticCalculation || state.toolIntent?.needsAggregation) return true
  if (state.toolIntent?.needsTemporalCalculation || state.toolIntent?.needsTaskDeadlineIndex) return false
  return hasStructuredPolicyComputationSignal(state)
}

function hasStructuredPolicyComputationSignal(state: ChatOrchestrationState): boolean {
  const questionValueKinds = extractComparableValueKinds(state.question)
  if (questionValueKinds.size === 0) return false
  return state.selectedChunks.some((chunk) => hasCompatibleValueKind(questionValueKinds, extractComparableValueKinds(chunk.metadata.text ?? "")))
}

function extractComparableValueKinds(text: string): Set<string> {
  const normalized = text.normalize("NFKC")
  const kinds = new Set<string>()
  if (/\p{Number}/u.test(normalized)) kinds.add("number")
  if (/%/.test(normalized)) kinds.add("ratio")
  if (/[¥$€£]/u.test(normalized)) kinds.add("currency")
  if (/[<>]=?|[≤≥≦≧=]/u.test(normalized)) kinds.add("comparator")
  return kinds
}

function hasCompatibleValueKind(left: Set<string>, right: Set<string>): boolean {
  if (left.has("number") && right.has("number")) return true
  if (left.has("ratio") && right.has("ratio")) return true
  if (left.has("currency") && right.has("currency")) return true
  if (left.has("comparator") && right.has("comparator")) return true
  return false
}

function withRewrittenQuery(state: ChatOrchestrationState, action: Extract<SearchAction, { type: "query_rewrite" }>): ChatOrchestrationState {
  const rewritten = rewriteQuery(state, action)
  return {
    ...state,
    expandedQueries: [rewritten, ...state.expandedQueries.filter((query) => query !== rewritten)].slice(0, ragRuntimePolicy.limits.expandedQueryLimit),
    queryEmbeddings: []
  }
}

function rewriteQuery(state: ChatOrchestrationState, action: Extract<SearchAction, { type: "query_rewrite" }>): string {
  const base = action.input.trim() || state.normalizedQuery || state.question
  const missingFacts = state.searchPlan.requiredFacts
    .filter((fact) => state.retrievalEvaluation.missingFactIds.includes(fact.id))
    .map((fact) => fact.description)
    .slice(0, ragRuntimePolicy.limits.queryRewriteFactLimit)
  if (action.strategy === "section") return [...new Set([base, ...missingFacts, "章 見出し セクション"]).values()].join(" ")
  if (action.strategy === "entity") return [...new Set([base, ...missingFacts, "正式名称 略称 別名"]).values()].join(" ")
  if (action.strategy === "hyde") return `${base} ${missingFacts.join(" ")} 回答 根拠 条件 手順 期限 金額`.trim()
  return [...new Set([base, ...missingFacts]).values()].join(" ")
}

async function expandContextWindow(
  deps: Dependencies,
  state: ChatOrchestrationState,
  action: Extract<SearchAction, { type: "expand_context" }>,
  user: AppUser
): Promise<RetrievedVector[]> {
  const source = findChunkForExpansion(state.retrievedChunks, action.chunkKey)
  if (!source?.metadata.documentId || !source.metadata.chunkId) return []
  const manifest = await loadManifest(deps, user, source.metadata.documentId)
  if (!manifest) return []
  const permissionDecision = await new DocumentPermissionService(deps).resolveEffectiveDocumentPermissionDecision(user, manifest)
  const current = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: deps.objectStore,
    manifest,
    authorizationAllowed: permissionDecision.permission === "readOnly" || permissionDecision.permission === "full",
    qualityAllowed: isQualityApprovedForNormalRag(manifest, {
      allowLegacyLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext)
    }),
    purpose: "normal_answer",
    roles: user.cognitoGroups,
    allowLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext)
  })
  if (!evaluateCurrentRagEligibility({
    actor: user,
    identityVerified: Boolean(user.userId && user.tenantId),
    purpose: "normal_answer",
    envelope: source.metadata.securityEnvelope,
    current
  }).allowed) return []
  const chunks = await loadChunksForManifestSafely(deps, manifest)
  const center = chunks.findIndex((chunk) => chunk.id === source.metadata.chunkId)
  if (center < 0) return []

  const expanded: RetrievedVector[] = []
  const window = Math.max(1, action.window)
  for (let index = Math.max(0, center - window); index <= Math.min(chunks.length - 1, center + window); index += 1) {
    if (index === center) continue
    const chunk = chunks[index]
    if (!chunk) continue
    if (!evaluateCurrentRagEligibility({
      actor: user,
      identityVerified: Boolean(user.userId && user.tenantId),
      purpose: "normal_answer",
      envelope: chunk.securityEnvelope,
      current
    }).allowed) continue
    const distance = Math.abs(index - center)
    expanded.push({
      key: `${source.metadata.documentId}-${chunk.id}`,
      score: Math.max(
        0,
        Math.min(ragRuntimePolicy.retrieval.contextWindowMaxScore, source.score - distance * ragRuntimePolicy.retrieval.contextWindowDecay)
      ),
      metadata: {
        ...source.metadata,
        kind: "chunk",
        documentId: source.metadata.documentId,
        fileName: manifest.fileName,
        chunkId: chunk.id,
        securityEnvelope: chunk.securityEnvelope,
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

async function loadChunksForManifestSafely(deps: Dependencies, manifest: DocumentManifest) {
  try {
    return await loadChunksForManifest(deps, manifest)
  } catch (error) {
    if (isMissingObjectError(error)) return []
    throw error
  }
}

function findChunkForExpansion(chunks: RetrievedVector[], chunkKey: string): RetrievedVector | undefined {
  return chunks.find((chunk) => chunk.key === chunkKey || chunk.metadata.chunkId === chunkKey)
}

async function loadManifest(deps: Dependencies, user: AppUser, documentId: string): Promise<DocumentManifest | undefined> {
  try {
    const tenantId = user.tenantId?.trim()
    if (!tenantId) return undefined
    return await readTenantManifest(deps, tenantId, documentId)
  } catch {
    return undefined
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
  const fallbackDescription = buildFallbackFactDescription(question, clues)
  return [
    {
      id: "fact-1",
      description: fallbackDescription,
      factType: "unknown",
      necessity: "primary",
      subject: inferFallbackFactSubject(question, fallbackDescription),
      confidence: 0.45,
      plannerSource: "legacy_fallback",
      priority: 1,
      status: "missing",
      supportingChunkKeys: []
    }
  ]
}

function inferFactSubject(question: string): string {
  const inferred = question
    .replace(/[?？。.!！]/g, "")
    .replace(/(は|を|について|教えて|ください|ですか|ますか|何|いつ|誰|どこ|どの|いくら).*/u, "")
    .trim()
  const cleanedInferred = cleanFactSubject(inferred)
  if (cleanedInferred) return cleanedInferred.slice(0, 80)
  if (inferred) return inferred.slice(0, 80)
  return cleanFactSubject(question).slice(0, 80) || question.slice(0, 80)
}

function buildFallbackFactDescription(question: string, clues: string[]): string {
  const candidateTexts = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]/u.test(question)
    ? [question]
    : [question, ...clues.slice(0, 2)]
  const phrase = buildSignalPhrase(candidateTexts, question, ragRuntimePolicy.limits.factReferenceLimit)
  return phrase.slice(0, 120) || question.slice(0, 120)
}

function inferFallbackFactSubject(question: string, fallbackDescription: string): string {
  const subject = inferFactSubject(question)
  if (subject && subject !== question.slice(0, 80)) return subject
  return fallbackDescription.slice(0, 80)
}

function cleanFactSubject(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/(と|および|及び|かつ|または|又は|、|,|\/)+/gu, " ")
    .replace(/の\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "NoSuchKey" || error.message.includes("NoSuchKey") || error.message.includes("not found") || error.message.includes("specified key does not exist")
}

function inferSearchComplexity(question: string): ChatOrchestrationState["searchPlan"]["complexity"] {
  if (/比較|違い|差分|どちら/.test(question)) return "comparison"
  if (/手順|方法|どうやって|申請|設定/.test(question)) return "procedure"
  if (/それ|これ|上記|前述/.test(question)) return "ambiguous"
  if (/と|および|及び|かつ/.test(question)) return "multi_hop"
  return "simple"
}

export async function runChatOrchestration(
  deps: Dependencies,
  input: ChatInput,
  user: AppUser = systemAdminUser,
  progress?: ProgressSink,
  securityResourceRefs: readonly string[] = []
): Promise<ChatOrchestrationResult> {
  assertSafeRagGuardProfile(deps.ragGuardProfile)
  await assertRagSafetyInterlock({
    objectStore: deps.objectStore,
    runtimeProfileVersion: ragRuntimePolicy.profile.version,
    operation: "chat"
  })
  const startedAt = new Date()
  const startedMs = Date.now()
  const runId = createRunId(startedAt)
  const topK = normalizeTopK(input.topK)
  const memoryTopK = normalizeMemoryTopK(input.memoryTopK)
  const minScore = normalizeMinScore(input.minScore)
  const maxIterations = normalizeMaxIterations(input.maxIterations)
  const modelId = input.modelId ?? config.defaultModelId
  const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
  const clueModelId = input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId
  const graph = createChatOrchestrationGraph(deps, user, progress)

  const state = (await graph.invoke({
    runId,
    question: input.question,
    conversationHistory: input.conversationHistory ?? [],
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
    conversation: input.conversation,
    conversationState: undefined,
    decontextualizedQuery: undefined,
    iteration: 0,
    referenceQueue: [],
    resolvedReferences: [],
    unresolvedReferenceTargets: [],
    visitedDocumentIds: [],
    searchBudget: {
      maxReferenceDepth: ragRuntimePolicy.retrieval.referenceMaxDepth,
      remainingCalls: ragRuntimePolicy.retrieval.searchBudgetCalls
    },
    searchFilters: input.searchFilters,
    searchScope: input.searchScope,
    sessionScopeNormalization: input.sessionScopeNormalization,
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
        maxIterations,
        minTopScore: minScore,
        minEvidenceCount: deriveMinEvidenceCount(topK),
        maxNoNewEvidenceStreak: ragRuntimePolicy.retrieval.maxNoNewEvidenceStreak
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
        topK
      },
      reason: ""
    },
    temporalContext: undefined,
    asOfDate: input.asOfDate,
    asOfDateSource: input.asOfDateSource,
    toolIntent: undefined,
    computedFacts: [],
    usedComputedFactIds: [],
    maxIterations,
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
    trace: []
  })) as ChatOrchestrationState

  let answer = state.answer ?? NO_ANSWER
  const isClarification = state.clarification.needsClarification
  const outputSecretDetected = containsSensitiveOutput(answer)
  const isAnswerable = !isClarification && state.answerability.isAnswerable && answer !== NO_ANSWER && !outputSecretDetected
  if (outputSecretDetected) answer = NO_ANSWER
  const citations = isAnswerable ? state.citations : []
  const authorizationEvaluatedAt = new Date().toISOString()
  const evidenceContext = structuredEvidenceContext(state, authorizationEvaluatedAt)
  const retrieved = isClarification ? [] : buildFinalEvidenceSet(state.retrievedChunks, evidenceContext)
  const conflictChunkKeys = new Set(state.retrievalEvaluation.conflictCandidates.flatMap((candidate) => candidate.chunkKeys))
  const unresolvedConflictEvidence = state.retrievalEvaluation.retrievalQuality === "conflicting"
    ? state.retrievedChunks.filter((chunk) => conflictChunkKeys.has(chunk.key))
    : []
  const finalEvidence = buildFinalEvidenceSet(
    isAnswerable ? state.selectedChunks : unresolvedConflictEvidence,
    evidenceContext
  )
  const guardOutcomes = measurePartialRuntimeRagGuards(runtimeGuardOutcomes(state, user, outputSecretDetected))
  const faultDecisions = state.trace
    .map((step) => (step as typeof step & { degradationDecision?: SafeDegradationDecision }).degradationDecision)
    .filter((decision): decision is SafeDegradationDecision => decision !== undefined)
  const decisions = faultDecisions
  const injectionFindingCount = state.selectedChunks.reduce((count, chunk) => count + inspectPromptEvidence({
    text: String(chunk.metadata.text ?? ""),
    fileName: typeof chunk.metadata.fileName === "string" ? chunk.metadata.fileName : undefined
  }).length, 0)
  await progress?.authorizeDurableCommit?.()
  await bestEffortCapture("normal_chat", () => new ProductionRagObservationProducer(deps.objectStore).captureChatOutcome({
    runId,
    observedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - startedMs),
    tenantId: user.tenantId ?? config.localAuthTenantId,
    roles: user.cognitoGroups,
    resourceIds: [...new Set([...retrieved, ...finalEvidence, ...citations].map((item) => item.documentId))],
    securityResourceRefs,
    pipelineVersions: buildPipelineVersions({ embeddingModelId, embeddingDimensions: config.embeddingDimensions }),
    modelId,
    retrievedCount: retrieved.length,
    finalEvidenceCount: finalEvidence.length,
    citationCount: citations.length,
    validCitationCount: citations.filter((citation) => citation.pageStart !== undefined || citation.pageEnd !== undefined || citation.pageOrSheet !== undefined).length,
    requiredFactCount: state.searchPlan.requiredFacts.length,
    supportedFactCount: state.retrievalEvaluation.supportedFactIds.length,
    answerSentenceCount: state.answerSupport.totalSentences,
    unsupportedSentenceCount: state.answerSupport.unsupportedSentences.length,
    answerSupportConfidence: state.answerSupport.confidence,
    isAnswerable,
    sufficientContextAnswerable: state.sufficientContext.label === "ANSWERABLE",
    injectionFindingCount,
    injectionSuccessCount: injectionFindingCount > 0 && isAnswerable && !guardOutcomes.find((outcome) => outcome.guard === "prompt_injection")?.passed ? 1 : 0,
    guardOutcomes,
    decisions
  }))
  progress?.recordObservationArtifact?.(runId)
  const shouldIncludeDebug = input.includeDebug ?? input.debug ?? false
  const replayDecision = answerReplayDecision(state, isAnswerable, outputSecretDetected)
  const persistedDebug = await persistDebugTrace(deps, {
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
    finalEvidence,
    requesterUserId: user.userId,
    requesterTenantId: user.tenantId ?? config.localAuthTenantId,
    requesterRoles: user.cognitoGroups,
    securityResourceRefs,
    replayDecision,
    state
  })
  progress?.recordPersistedTrace?.(persistedDebug)
  const debug = shouldIncludeDebug ? persistedDebug : undefined

  return {
    responseType: isClarification ? "clarification" : isAnswerable ? "answer" : "refusal",
    answer,
    isAnswerable,
    needsClarification: isClarification,
    clarification: isClarification ? toPublicClarification(state.clarification) : undefined,
    citations,
    retrieved,
    finalEvidence,
    debug
  }
}

function runtimeGuardOutcomes(
  state: ChatOrchestrationState,
  user: AppUser,
  outputSecretDetected: boolean
): Partial<Record<MandatoryRagGuard, { passed: boolean; evidence: string }>> {
  const outcomes: Partial<Record<MandatoryRagGuard, { passed: boolean; evidence: string }>> = {
    authentication: { passed: user.accountStatus === "active" && Boolean(user.userId && user.tenantId), evidence: "resolved_request_identity" },
    output_secret: { passed: !outputSecretDetected, evidence: "persisted_output_secret_pattern_scan" },
    trace_redaction: { passed: true, evidence: "sanitized_trace_and_quality_sample_contract" }
  }
  const promptGuardStep = state.trace.some((step) => ["generate_clues", "sufficient_context_gate", "generate_answer", "verify_answer_support"].includes(step.label))
  if (promptGuardStep) outcomes.prompt_injection = { passed: true, evidence: "executed_prompt_builder_untrusted_content_quarantine" }
  const reauthorization = state.trace.some((step) => step.label === "reauthorize_evidence" && step.status === "success")
  if (reauthorization || state.selectedChunks.length === 0) {
    outcomes.authorization = { passed: state.answerability.reason !== "authorization_revoked", evidence: "current_evidence_reauthorization_node" }
    outcomes.classification_usage = { passed: state.selectedChunks.every((chunk) => chunk.metadata.lifecycleStatus !== "superseded"), evidence: "current_eligibility_filtered_evidence" }
  }
  const toolStep = [...state.trace].reverse().find((step) => step.label === "execute_computation_tools")
  if (toolStep) outcomes.tool_policy = { passed: toolStep.status !== "error", evidence: "tool_execution_policy_trace" }
  const supportStep = [...state.trace].reverse().find((step) => step.label === "verify_answer_support")
  if (supportStep || !state.answerability.isAnswerable) outcomes.grounding = { passed: !state.answerability.isAnswerable || state.answerSupport.supported, evidence: "answer_support_verifier" }
  const citationStep = [...state.trace].reverse().find((step) => step.label === "validate_citations")
  if (citationStep || !state.answerability.isAnswerable) outcomes.citation = { passed: !state.answerability.isAnswerable || state.citations.length > 0, evidence: "citation_validator" }
  return outcomes
}

function structuredEvidenceContext(state: ChatOrchestrationState, authorizationEvaluatedAt: string) {
  const topicsByChunkKey = new Map<string, string>()
  for (const fact of state.searchPlan.requiredFacts) {
    for (const chunkKey of fact.supportingChunkKeys) topicsByChunkKey.set(chunkKey, fact.description)
  }
  for (const candidate of state.retrievalEvaluation.conflictCandidates) {
    const fact = state.searchPlan.requiredFacts.find((item) => item.id === candidate.factId)
    const topic = fact?.description ?? `${candidate.subject} ${candidate.predicate}`.trim()
    for (const chunkKey of candidate.chunkKeys) topicsByChunkKey.set(chunkKey, topic)
  }
  return {
    supportingChunkKeys: state.searchPlan.requiredFacts.flatMap((fact) => fact.supportingChunkKeys),
    conflictingChunkKeys: state.retrievalEvaluation.conflictCandidates.flatMap((candidate) => candidate.chunkKeys),
    topicsByChunkKey,
    asOf: new Date(state.temporalContext?.nowIso ?? authorizationEvaluatedAt),
    authorizationEvaluatedAt
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
    finalEvidence: NonNullable<DebugTrace["finalEvidence"]>
    requesterUserId: string
    requesterTenantId: string
    requesterRoles: string[]
    securityResourceRefs: readonly string[]
    replayDecision: Pick<ReplayVersionManifest["decisions"], "decisionCode" | "reasonCodes">
    state: ChatOrchestrationState
  }
): Promise<DebugTrace> {
  const completedAt = new Date()
  const sourceSnapshots = await loadReplaySourceSnapshots(
    deps,
    input.requesterTenantId,
    input.retrieved
  )
  const ragProfile = {
    id: ragRuntimePolicy.profile.id,
    version: ragRuntimePolicy.profile.version,
    retrievalProfileId: ragRuntimePolicy.profile.retrieval.id,
    retrievalProfileVersion: ragRuntimePolicy.profile.retrieval.version,
    answerPolicyId: ragRuntimePolicy.profile.answerPolicy.id,
    answerPolicyVersion: ragRuntimePolicy.profile.answerPolicy.version
  }
  const responseStatus = input.isAnswerable
    ? "success" as const
    : input.replayDecision.decisionCode === "failed" ? "error" as const : "warning" as const
  const totalLatencyMs = Math.max(0, Date.now() - input.startedMs)
  const replayCandidateCounts = answerReplayCandidateCounts(input.state, input.retrieved.length)
  const replayVersionManifest = buildReplayVersionManifest({
    citations: input.retrieved,
    sourceSnapshots,
    observedVersions: {
      indexVersion: uniqueVersion(input.state.retrievalDiagnostics?.indexVersions)
    },
    ragProfile,
    modelId: input.modelId,
    clueModelId: input.clueModelId,
    policyVersions: {
      authorization: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
      eligibility: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
      untrustedContent: UNTRUSTED_CONTENT_POLICY_VERSION,
      traceSanitization: DEBUG_TRACE_SANITIZE_POLICY_VERSION
    },
    question: input.question,
    normalizedQuery: input.state.normalizedQuery,
    expandedQueries: input.state.expandedQueries,
    candidateCount: replayCandidateCounts.candidateCount,
    deniedCandidateCount: replayCandidateCounts.deniedCandidateCount,
    finalEvidenceCount: input.finalEvidence.length,
    responseStatus,
    decisionCode: input.replayDecision.decisionCode,
    reasonCodes: input.replayDecision.reasonCodes,
    totalLatencyMs,
    nondeterministicFactors: [
      "model-provider-sampling-and-service-revision",
      "dependency-latency-and-retry-schedule",
      "concurrent-authorization-and-lifecycle-updates"
    ]
  })
  const trace = sanitizeDebugTraceForPersistence({
    schemaVersion: DEBUG_TRACE_SCHEMA_VERSION,
    runId: input.runId,
    requestTraceId: input.runId,
    parentTraceIds: answerParentTraceIds(input.state),
    tenantPartitionId: tenantPartitionId(input.requesterTenantId),
    actorPartitionId: tenantPartitionId(`${input.requesterTenantId}:actor:${input.requesterUserId}`),
    securityResourceRefs: [...new Set(input.securityResourceRefs)].sort(),
    targetType: CHAT_ORCHESTRATION_TRACE_TARGET_TYPE,
    visibility: "operator_sanitized",
    sanitizePolicyVersion: DEBUG_TRACE_SANITIZE_POLICY_VERSION,
    exportRedaction: {
      policyVersion: DEBUG_TRACE_SANITIZE_POLICY_VERSION,
      visibility: "operator_sanitized",
      redactedFields: ["rawPrompt", "credentials", "internalReasoning", "unauthorizedDocuments", "internalPolicyDetails"],
      notes: [
        "通常利用者向けには権限外文書、内部 policy、raw prompt、credential、LLM 内部推論を含めない。",
        "現行 debug API は chat:admin:read_all gate の operator_sanitized trace として返す。"
      ]
    },
    question: input.question,
    modelId: input.modelId,
    embeddingModelId: input.embeddingModelId,
    clueModelId: input.clueModelId,
    replayVersionManifest,
    decision: replayVersionManifest.decisions,
    ragProfile,
    topK: input.topK,
    memoryTopK: input.memoryTopK,
    minScore: input.minScore,
    conversationHistory: input.state.conversationHistory,
    clarificationContext: input.state.clarificationContext,
    conversation: input.state.conversation,
    conversationState: input.state.conversationState,
    decontextualizedQuery: input.state.decontextualizedQuery,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalLatencyMs,
    status: responseStatus,
    answerPreview: input.answer,
    isAnswerable: input.isAnswerable,
    citations: input.citations,
    retrieved: input.retrieved,
    finalEvidence: input.finalEvidence,
    toolInvocations: buildChatToolInvocationsFromTrace({
      orchestrationRunId: input.runId,
      requesterUserId: input.requesterUserId,
      steps: input.state.trace
    }),
    steps: input.state.trace
  })

  await deps.objectStore.putText(debugTraceObjectKey(trace), JSON.stringify(trace, null, 2), "application/json")
  await bestEffortCapture("debug_trace", () => new ProductionRagObservationProducer(deps.objectStore).captureDebugTrace(trace, {
    tenantId: input.requesterTenantId,
    roles: input.requesterRoles
  }))
  return trace
}

export function answerReplayDecision(
  state: ChatOrchestrationState,
  isAnswerable: boolean,
  outputSecretDetected: boolean
): Pick<ReplayVersionManifest["decisions"], "decisionCode" | "reasonCodes"> {
  if (isAnswerable) return { decisionCode: "completed", reasonCodes: [] }
  if (state.answerability.reason === "authorization_revoked") {
    return { decisionCode: "rejected", reasonCodes: ["permission_revoked"] }
  }
  if (outputSecretDetected) {
    return { decisionCode: "refused", reasonCodes: ["output_secret_detected"] }
  }
  const degradationReasonCodes = state.trace.flatMap((step) => {
    const decision = step.degradationDecision
    if (!decision) return []
    return [decision.trigger === "unsafe_profile" ? "safety_interlock" as const : "dependency_error" as const]
  })
  if (degradationReasonCodes.length > 0) {
    return { decisionCode: "failed", reasonCodes: [...new Set(degradationReasonCodes)].sort() }
  }
  if (state.clarification.needsClarification) {
    return { decisionCode: "refused", reasonCodes: ["clarification_required"] }
  }
  return { decisionCode: "refused", reasonCodes: ["insufficient_evidence"] }
}

export function answerReplayCandidateCounts(
  state: ChatOrchestrationState,
  finalRetrievedCount: number
): Pick<ReplayVersionManifest["decisions"], "candidateCount" | "deniedCandidateCount"> {
  const observed = state.actionHistory
    .map((action) => action.retrievalDiagnostics)
    .filter((diagnostics): diagnostics is NonNullable<typeof diagnostics> => diagnostics !== undefined)
  const candidateCount = observed.reduce((sum, diagnostics) => sum + diagnostics.candidateCount, 0)
  const deniedCandidateCount = observed.reduce((sum, diagnostics) => sum + diagnostics.deniedCandidateCount, 0)
  const latestObservedDenied = observed.at(-1)?.deniedCandidateCount ?? 0
  const currentDenied = state.retrievalDiagnostics?.deniedCandidateCount ?? latestObservedDenied
  const postSearchDenied = Math.max(0, currentDenied - latestObservedDenied)
  const totalDenied = deniedCandidateCount + postSearchDenied
  const totalCandidates = Math.max(candidateCount, Math.max(0, finalRetrievedCount) + totalDenied)
  return {
    candidateCount: totalCandidates,
    deniedCandidateCount: Math.min(totalCandidates, totalDenied)
  }
}

function appendCurrentAuthorizationDenials(
  diagnostics: ChatOrchestrationState["retrievalDiagnostics"],
  eligibleCount: number,
  newlyDeniedCount: number
): ChatOrchestrationState["retrievalDiagnostics"] {
  if (!diagnostics) return diagnostics
  const deniedCandidateCount = diagnostics.deniedCandidateCount + Math.max(0, newlyDeniedCount)
  const candidateCount = Math.max(
    diagnostics.candidateCount,
    Math.max(0, eligibleCount) + deniedCandidateCount
  )
  return {
    ...diagnostics,
    candidateCount,
    deniedCandidateCount: Math.min(candidateCount, deniedCandidateCount)
  }
}

async function loadReplaySourceSnapshots(
  deps: Dependencies,
  tenantId: string,
  citations: Citation[]
): Promise<ReplaySourceSnapshot[]> {
  const uniqueCitations = [...new Map(citations.map((citation) => [citation.documentId, citation])).values()]
  return Promise.all(uniqueCitations.map(async (citation) => {
    try {
      const manifest = await readTenantManifest(deps, tenantId, citation.documentId)
      return replaySourceSnapshotFromManifest(manifest)
    } catch (error) {
      if (isMissingObjectError(error)) return emptyReplaySourceSnapshot(citation)
      throw error
    }
  }))
}

function uniqueVersion(values: string[] | undefined): string | undefined {
  const observed = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
  return observed.length === 1 ? observed[0] : undefined
}

function answerParentTraceIds(state: ChatOrchestrationState): string[] {
  return [...new Set([
    ...(state.retrievalDiagnostics?.traceIds ?? []),
    ...state.actionHistory.flatMap((action) => action.retrievalDiagnostics?.traceIds ?? [])
  ])].sort()
}

function createRunId(startedAt: Date): string {
  const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_")
  return `run_${stamp}_${randomUUID().slice(0, 8)}`
}

export function debugTraceObjectKey(trace: DebugTrace): string {
  if (!trace.tenantPartitionId) throw new Error("Debug trace tenant partition is required")
  return `debug-runs/${trace.tenantPartitionId}/${trace.startedAt.slice(0, 10)}/${trace.runId}.json`
}
