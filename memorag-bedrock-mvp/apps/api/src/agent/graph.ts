import { randomUUID } from "node:crypto"
import type { AppUser } from "../auth.js"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import { hasUsableComputedFact } from "./computation.js"
import { loadChunksForManifest } from "../rag/manifest-chunks.js"
import { buildPipelineVersions } from "../rag/pipeline-versions.js"
import { DEBUG_TRACE_SCHEMA_VERSION, type DebugTrace } from "../types.js"
import type { DocumentManifest, RetrievedVector } from "../types.js"
import { analyzeInput } from "./nodes/analyze-input.js"
import { answerabilityGate } from "./nodes/answerability-gate.js"
import { buildConversationState, decontextualizeQuery } from "./nodes/build-conversation-state.js"
import { buildTemporalContext } from "./nodes/build-temporal-context.js"
import { clarificationGate } from "./nodes/clarification-gate.js"
import { detectToolIntent } from "./nodes/detect-tool-intent.js"
import { createEmbedQueriesNode } from "./nodes/embed-queries.js"
import { executeComputationTools } from "./nodes/execute-computation-tools.js"
import { createExtractPolicyComputationsNode } from "./nodes/extract-policy-computations.js"
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
import { asksForMoney, detectQuestionRequirements } from "./question-requirements.js"
import { deriveMinEvidenceCount, expandedSearchTopK, normalizeMaxIterations, normalizeMemoryTopK, normalizeMinScore, normalizeTopK, ragRuntimePolicy } from "./runtime-policy.js"
import { NO_ANSWER, isPrimaryRequiredFact, type Clarification, type QaAgentState, type QaAgentUpdate, type RequiredFact, type SearchAction } from "./state.js"
import { buildSignalPhrase } from "./text-signals.js"
import { tracedNode } from "./trace.js"
import type { ChatInput, QaGraphResult } from "./types.js"
import { toCitation } from "./utils.js"

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
  const extractPolicyComputations = createExtractPolicyComputationsNode(deps)
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
    const stopByExhaustedCandidates = exhaustedCandidateSet(state)
    const stopByRepeatedNoEvidence = repeatedNoNewEvidenceAction(state)
    const unresolvedPrimaryConflict = state.retrievalEvaluation.conflictingFactIds.some((factId) => isPrimaryRequiredFactId(state.searchPlan.requiredFacts, factId))
    const forcedRefusal =
      unresolvedPrimaryConflict &&
      state.retrievalEvaluation.nextAction.type !== "finalize_refusal" &&
      (stopByIteration || stopByNoEvidence || stopByExhaustedCandidates || stopByRepeatedNoEvidence)

    return {
      iteration: nextIteration,
      noNewEvidenceStreak,
      searchDecision: evaluatorDone || stopByIteration || stopByNoEvidence || stopByExhaustedCandidates || stopByRepeatedNoEvidence ? "done" : "continue_search",
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

  function routeAfterSearchEvaluation(state: QaAgentState) {
    return state.searchDecision
  }

  function isPrimaryRequiredFactId(facts: RequiredFact[], factId: string): boolean {
    const fact = facts.find((item) => item.id === factId)
    return !fact || isPrimaryRequiredFact(fact)
  }

  function exhaustedCandidateSet(state: QaAgentState): boolean {
    const latest = state.actionHistory.at(-1)
    return Boolean(latest && latest.hitCount > 0 && latest.newEvidenceCount === 0)
  }

  function repeatedNoNewEvidenceAction(state: QaAgentState): boolean {
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

  function routeAfterGate(state: QaAgentState) {
    return state.answerability.isAnswerable ? "judge_context" : "refuse"
  }

  function routeAfterSufficientContextGate(state: QaAgentState) {
    return state.answerability.isAnswerable ? "answer" : "refuse"
  }

  const nodes = {
    analyzeInput: tracedNode("analyze_input", analyzeInput),
    buildTemporalContext: tracedNode("build_temporal_context", buildTemporalContext),
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
    async invoke(initialState: QaAgentState): Promise<QaAgentState> {
      let state = initialState

      state = await applyNode(state, "analyze_input", nodes.analyzeInput, progress)
      state = await applyNode(state, "build_temporal_context", nodes.buildTemporalContext, progress)
      if (state.answerability.reason === "invalid_temporal_context") {
        return applyNode(state, "finalize_refusal", nodes.finalizeRefusal, progress)
      }
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

function shouldExtractPolicyComputations(state: QaAgentState): boolean {
  if (state.selectedChunks.length === 0) return false
  if (!state.toolIntent) return true
  if (state.toolIntent.needsArithmeticCalculation || state.toolIntent.needsAggregation) return true
  if (state.toolIntent.needsTemporalCalculation || state.toolIntent.needsTaskDeadlineIndex) return false
  return isDocumentThresholdComparisonQuestion(state.question, state.selectedChunks)
}

function isDocumentThresholdComparisonQuestion(question: string, chunks: RetrievedVector[]): boolean {
  const normalizedQuestion = question.normalize("NFKC")
  if (!asksForMoney(normalizedQuestion)) return false
  if (!/(必要|不要|該当|対象|領収|承認|条件|以上|以下|未満|超過)/u.test(normalizedQuestion)) return false
  return chunks.some((chunk) => /(?:\d[\d,]*(?:\.\d+)?|[一二三四五六七八九十百千万億兆]+)\s*(?:円|万円|千円).{0,40}(?:必要|不要|対象|条件|以上|以下|未満|超過|承認)/u.test((chunk.metadata.text ?? "").normalize("NFKC")))
}

function withRewrittenQuery(state: QaAgentState, action: Extract<SearchAction, { type: "query_rewrite" }>): QaAgentState {
  const rewritten = rewriteQuery(state, action)
  return {
    ...state,
    expandedQueries: [rewritten, ...state.expandedQueries.filter((query) => query !== rewritten)].slice(0, ragRuntimePolicy.limits.expandedQueryLimit),
    queryEmbeddings: []
  }
}

function rewriteQuery(state: QaAgentState, action: Extract<SearchAction, { type: "query_rewrite" }>): string {
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
  state: QaAgentState,
  action: Extract<SearchAction, { type: "expand_context" }>
): Promise<RetrievedVector[]> {
  const source = findChunkForExpansion(state.retrievedChunks, action.chunkKey)
  if (!source?.metadata.documentId || !source.metadata.chunkId) return []
  const manifest = await loadManifest(deps, source.metadata.documentId)
  if (!manifest) return []
  const chunks = await loadChunksForManifestSafely(deps, manifest)
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
  const planned = planStructuredFacts(question)
  if (planned.length > 0) return planned

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

function planStructuredFacts(question: string): RequiredFact[] {
  const subject = inferFactSubject(question)
  const candidates: Array<Pick<RequiredFact, "factType" | "description" | "expectedValueType">> = []
  if (asksForMoney(question)) {
    candidates.push({ factType: "amount", description: `${subject} 金額`, expectedValueType: "money" })
  }
  if (/いつ|期限|期日|締切|開始日|終了日|何日|何営業日/.test(question)) {
    candidates.push({ factType: "date", description: `${subject} 期限`, expectedValueType: "date_or_duration" })
  }
  if (/頻度|何回|何度|ごと|毎月|毎年/.test(question)) {
    candidates.push({ factType: "count", description: `${subject} 頻度`, expectedValueType: "count_or_frequency" })
  }
  if (/方法|手順|やり方|フロー|提出/.test(question) || (/申請/.test(question) && !/申請期限|申請期日|申請締切/.test(question))) {
    candidates.push({ factType: "procedure", description: `${subject} 手順`, expectedValueType: "procedure" })
  }
  if (/誰|担当|承認者|責任者|部署|報告先|依頼先/.test(question)) {
    candidates.push({ factType: "person", description: `${subject} 担当`, expectedValueType: "person_or_org" })
  }
  if (/条件|対象|例外|適用範囲/.test(question)) {
    candidates.push({ factType: "condition", description: `${subject} 条件`, expectedValueType: "condition" })
  }
  if (/分類|種類|区分/.test(question)) {
    candidates.push({ factType: "classification", description: `${subject} 分類`, expectedValueType: "classification_items" })
  }
  for (const requirement of detectQuestionRequirements(question)) {
    if (requirement.type === "list_count") {
      candidates.push({ factType: "classification", description: `${subject} ${requirement.count}項目`, expectedValueType: `list_count:${requirement.count}` })
    } else if (requirement.slot === "date") {
      candidates.push({ factType: "date", description: `${subject} 日付・時期`, expectedValueType: "date_or_era" })
    } else if (requirement.slot === "place") {
      candidates.push({ factType: "scope", description: `${subject} 場所`, expectedValueType: "place" })
    } else if (requirement.slot === "organization") {
      candidates.push({ factType: "person", description: `${subject} 組織名`, expectedValueType: "person_or_org" })
    } else if (requirement.slot === "section") {
      candidates.push({ factType: "scope", description: `${subject} 節番号・節名`, expectedValueType: "section" })
    } else if (requirement.slot === "item") {
      candidates.push({ factType: "classification", description: `${subject} 項目名`, expectedValueType: "list_items" })
    }
  }

  return dedupeFactCandidates(candidates).slice(0, ragRuntimePolicy.limits.requiredFactLimit).map((candidate, index) => ({
    id: `fact-${index + 1}`,
    description: candidate.description,
    factType: candidate.factType,
    necessity: "primary",
    subject,
    scope: inferFactScope(question),
    expectedValueType: candidate.expectedValueType,
    confidence: 0.72,
    plannerSource: "deterministic",
    priority: index + 1,
    status: "missing",
    supportingChunkKeys: []
  }))
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
    .replace(/(金額|費用|料金|価格|単価|上限|下限|いくら|期限|期日|締切|締め切り|開始日|終了日|何日|何営業日|頻度|何回|何度|方法|手順|やり方|フロー|申請|提出|担当|承認者|責任者|部署|報告先|依頼先|条件|対象|例外|適用範囲|分類|種類|区分)/gu, "")
    .replace(/(と|および|及び|かつ|または|又は|、|,|\/)+/gu, " ")
    .replace(/の\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
}

function dedupeFactCandidates<T extends Pick<RequiredFact, "factType" | "description" | "expectedValueType">>(candidates: T[]): T[] {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.factType ?? ""}:${candidate.description}:${candidate.expectedValueType ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function inferFactScope(question: string): string | undefined {
  const match = question.match(/(現行|旧制度|新制度|最新版|現在|過去|[0-9０-９]{4}年|[A-Za-z0-9_-]+部|[^\s、。?？]+部署)/u)
  return match?.[0]
}

function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "NoSuchKey" || error.message.includes("NoSuchKey") || error.message.includes("not found") || error.message.includes("specified key does not exist")
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
  const topK = normalizeTopK(input.topK)
  const memoryTopK = normalizeMemoryTopK(input.memoryTopK)
  const minScore = normalizeMinScore(input.minScore)
  const maxIterations = normalizeMaxIterations(input.maxIterations)
  const modelId = input.modelId ?? config.defaultModelId
  const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
  const clueModelId = input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId
  const graph = createQaAgentGraph(deps, user, progress)

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
  })) as QaAgentState

  const answer = state.answer ?? NO_ANSWER
  const isClarification = state.clarification.needsClarification
  const isAnswerable = !isClarification && state.answerability.isAnswerable && answer !== NO_ANSWER
  const citations = isAnswerable ? state.citations : []
  const retrieved = isClarification ? [] : state.retrievedChunks.map(toCitation)
  const finalEvidence = isAnswerable ? state.selectedChunks.map(toCitation) : []
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
        finalEvidence,
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
    finalEvidence,
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
    finalEvidence: NonNullable<DebugTrace["finalEvidence"]>
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
    ragProfile: {
      id: ragRuntimePolicy.profile.id,
      version: ragRuntimePolicy.profile.version,
      retrievalProfileId: ragRuntimePolicy.profile.retrieval.id,
      retrievalProfileVersion: ragRuntimePolicy.profile.retrieval.version,
      answerPolicyId: ragRuntimePolicy.profile.answerPolicy.id,
      answerPolicyVersion: ragRuntimePolicy.profile.answerPolicy.version
    },
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
    totalLatencyMs: Math.max(0, Date.now() - input.startedMs),
    status: input.isAnswerable ? "success" : "warning",
    answerPreview: input.answer,
    isAnswerable: input.isAnswerable,
    citations: input.citations,
    retrieved: input.retrieved,
    finalEvidence: input.finalEvidence,
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
