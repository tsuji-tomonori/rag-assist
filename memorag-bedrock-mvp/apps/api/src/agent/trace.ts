import type { DebugStep, JsonValue } from "../types.js"
import type { QaAgentState, QaAgentUpdate, SearchAction } from "./state.js"
import { NO_ANSWER } from "./state.js"

type NodeFn = (state: QaAgentState) => Promise<QaAgentUpdate>

export function tracedNode(label: string, fn: NodeFn): NodeFn {
  return async (state) => {
    const startedAt = new Date()
    const startedMs = Date.now()

    try {
      const update = await fn(state)
      const completedAt = new Date()
      return {
        ...update,
        trace: buildStep({
          id: state.trace.length + 1,
          label,
          status: inferStatus(update),
          startedAt,
          completedAt,
          startedMs,
          modelId: inferModelId(label, state),
          summary: summarizeUpdate(label, update),
          detail: detailUpdate(update),
          output: outputUpdate(update),
          hitCount: inferHitCount(update),
          tokenCount: inferTokenCount(update)
        })
      }
    } catch (error) {
      const completedAt = new Date()
      const reason = inferErrorAnswerabilityReason(label)
      return {
        answerability: {
          isAnswerable: false,
          reason,
          confidence: 0
        },
        answer: NO_ANSWER,
        citations: [],
        trace: buildStep({
          id: state.trace.length + 1,
          label,
          status: "error",
          startedAt,
          completedAt,
          startedMs,
          summary: "処理中にエラーが発生したため、回答を拒否しました。",
          detail: error instanceof Error ? error.message : String(error),
          output: {
            answerability: {
              isAnswerable: false,
              reason,
              confidence: 0
            },
            answer: NO_ANSWER,
            citations: [],
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
    }
  }
}

function inferErrorAnswerabilityReason(label: string): "invalid_temporal_context" | "citation_validation_failed" {
  if (label === "build_temporal_context") return "invalid_temporal_context"
  return "citation_validation_failed"
}

function buildStep(input: {
  id: number
  label: string
  status: DebugStep["status"]
  startedAt: Date
  completedAt: Date
  startedMs: number
  modelId?: string
  summary: string
  detail?: string
  output?: Record<string, JsonValue>
  hitCount?: number
  tokenCount?: number
}): DebugStep {
  return {
    id: input.id,
    label: input.label,
    status: input.status,
    latencyMs: Math.max(0, Date.now() - input.startedMs),
    modelId: input.modelId,
    summary: input.summary,
    detail: input.detail,
    output: input.output,
    hitCount: input.hitCount,
    tokenCount: input.tokenCount,
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString()
  }
}

function inferStatus(update: QaAgentUpdate): DebugStep["status"] {
  if (update.clarification?.needsClarification) return "warning"
  if (update.answerSupport && !update.answerSupport.supported) return "warning"
  if (update.answerability && update.answerability.isAnswerable === false && update.answerability.reason !== "not_checked") {
    return "warning"
  }
  if (update.answer === NO_ANSWER) return "warning"
  return "success"
}

function inferModelId(label: string, state: QaAgentState): string | undefined {
  if (label === "generate_clues") return state.clueModelId
  if (["generate_answer", "sufficient_context_gate", "verify_answer_support"].includes(label)) return state.modelId
  if (["retrieve_memory", "embed_queries", "search_evidence"].includes(label)) return state.embeddingModelId
  return undefined
}

function summarizeUpdate(label: string, update: QaAgentUpdate): string {
  if (update.clarification) {
    return `clarification=${update.clarification.needsClarification}, reason=${update.clarification.reason}, groundedOptions=${update.clarification.groundedOptionCount}`
  }
  if (update.sufficientContext) return `sufficient_context=${update.sufficientContext.label}, missing=${update.sufficientContext.missingFacts?.length ?? 0}`
  if (update.computedFacts) return `computed_facts=${update.computedFacts.length}`
  if (update.toolIntent) return `tool_intent search=${update.toolIntent.needsSearch}, temporal=${update.toolIntent.needsTemporalCalculation}, arithmetic=${update.toolIntent.needsArithmeticCalculation}`
  if (update.temporalContext) return `today=${update.temporalContext.today}, source=${update.temporalContext.source}`
  if (update.answerSupport) return `answer_support=${update.answerSupport.supported ? "supported" : "unsupported"}, unsupported=${update.answerSupport.unsupportedSentences.length}`
  if (update.retrievalEvaluation) {
    const judge = update.retrievalEvaluation.llmJudge ? `, judge=${update.retrievalEvaluation.llmJudge.label}` : ""
    return `retrieval=${update.retrievalEvaluation.retrievalQuality}, missing=${update.retrievalEvaluation.missingFactIds.length}, risks=${update.retrievalEvaluation.riskSignals?.length ?? 0}${judge}, next=${update.retrievalEvaluation.nextAction.type}`
  }
  if (update.searchPlan) return `plan actions=${update.searchPlan.actions?.length ?? 0}, facts=${update.searchPlan.requiredFacts?.length ?? 0}`
  if (update.actionHistory) {
    const latest = update.actionHistory.at(-1)
    return latest ? `action=${latest.action.type}, hits=${latest.hitCount}, new=${latest.newEvidenceCount}` : "action observed"
  }
  if (update.searchDecision) return `search decision=${update.searchDecision}`
  if (update.memoryCards) return `memory hits=${update.memoryCards.length}`
  if (update.clues || update.expandedQueries) return `expanded queries=${update.expandedQueries?.length ?? update.clues?.length ?? 0}`
  if (update.queryEmbeddings) return `embedded queries=${update.queryEmbeddings.length}`
  if (update.retrievedChunks) return `retrieved=${update.retrievedChunks.length}`
  if (update.selectedChunks) return `selected=${update.selectedChunks.length}`
  if (update.answerability) return `answerable=${update.answerability.isAnswerable}, reason=${update.answerability.reason}`
  if (update.citations) return `citations=${update.citations.length}`
  if (update.answer) return update.answer === NO_ANSWER ? "refused" : "finalized"
  return `${label} completed`
}

function detailUpdate(update: QaAgentUpdate): string | undefined {
  if (update.clarification) return formatClarificationDetail(update.clarification)
  if (update.sufficientContext) return formatSufficientContextDetail(update.sufficientContext)
  if (update.computedFacts) return update.computedFacts.map((fact) => `${fact.id} ${fact.kind}: ${"explanation" in fact ? fact.explanation : "reason" in fact ? fact.reason : ""}`).join("\n")
  if (update.toolIntent) return JSON.stringify(update.toolIntent, null, 2)
  if (update.temporalContext) return JSON.stringify(update.temporalContext, null, 2)
  if (update.answerSupport) return formatAnswerSupportDetail(update.answerSupport)
  if (update.retrievalEvaluation) return formatRetrievalEvaluationDetail(update.retrievalEvaluation)
  if (update.searchPlan) return formatSearchPlanDetail(update.searchPlan)
  if (update.actionHistory) return formatActionObservationDetail(update.actionHistory)
  if (update.searchDecision) return `decision=${update.searchDecision}`
  if (update.memoryCards) {
    return update.memoryCards.map((hit) => `${hit.metadata.fileName} ${hit.metadata.memoryId ?? ""} score=${hit.score.toFixed(4)}`).join("\n")
  }
  if (update.expandedQueries) return update.expandedQueries.join("\n")
  if (update.retrievedChunks) {
    return update.retrievedChunks.map((hit) => `${hit.metadata.fileName} ${hit.metadata.chunkId ?? hit.key} score=${hit.score.toFixed(4)}`).join("\n")
  }
  if (update.selectedChunks) {
    return update.selectedChunks.map((hit) => `${hit.metadata.fileName} ${hit.metadata.chunkId ?? hit.key} score=${hit.score.toFixed(4)}`).join("\n")
  }
  if (update.answerability) return formatAnswerabilityDetail(update.answerability)
  if (update.rawAnswer) return update.rawAnswer
  if (update.answer) return update.answer
  return undefined
}

function formatSufficientContextDetail(judgement: NonNullable<QaAgentUpdate["sufficientContext"]>): string {
  return [
    `label=${judgement.label}`,
    `confidence=${judgement.confidence}`,
    `reason=${judgement.reason}`,
    "",
    "requiredFacts:",
    ...formatList(judgement.requiredFacts ?? []),
    "",
    "supportedFacts:",
    ...formatList(judgement.supportedFacts ?? []),
    "",
    "missingFacts:",
    ...formatList(judgement.missingFacts ?? []),
    "",
    "conflictingFacts:",
    ...formatList(judgement.conflictingFacts ?? []),
    "",
    "supportingChunkIds:",
    ...formatList(judgement.supportingChunkIds ?? [])
  ].join("\n")
}

function formatAnswerSupportDetail(judgement: NonNullable<QaAgentUpdate["answerSupport"]>): string {
  return [
    `supported=${judgement.supported}`,
    `confidence=${judgement.confidence}`,
    `totalSentences=${judgement.totalSentences}`,
    `reason=${judgement.reason}`,
    "",
    "unsupportedSentences:",
    ...(judgement.unsupportedSentences.length > 0
      ? judgement.unsupportedSentences.flatMap((item) => [`- ${item.sentence}`, `  reason=${item.reason}`])
      : ["なし"]),
    "",
    "supportingChunkIds:",
    ...formatList(judgement.supportingChunkIds ?? []),
    "",
    "supportingComputedFactIds:",
    ...formatList(judgement.supportingComputedFactIds ?? []),
    "",
    "contradictionChunkIds:",
    ...formatList(judgement.contradictionChunkIds ?? [])
  ].join("\n")
}

function formatRetrievalEvaluationDetail(evaluation: NonNullable<QaAgentUpdate["retrievalEvaluation"]>): string {
  return [
    `retrievalQuality=${evaluation.retrievalQuality}`,
    `nextAction=${formatSearchAction(evaluation.nextAction)}`,
    `reason=${evaluation.reason}`,
    "",
    "supportedFactIds:",
    ...formatList(evaluation.supportedFactIds ?? []),
    "",
    "missingFactIds:",
    ...formatList(evaluation.missingFactIds ?? []),
    "",
    "conflictingFactIds:",
    ...formatList(evaluation.conflictingFactIds ?? []),
    "",
    "riskSignals:",
    ...formatRiskSignals(evaluation.riskSignals ?? []),
    "",
    "llmJudge:",
    ...formatRetrievalLlmJudge(evaluation.llmJudge)
  ].join("\n")
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["なし"]
}

function formatRiskSignals(signals: NonNullable<NonNullable<QaAgentUpdate["retrievalEvaluation"]>["riskSignals"]>): string[] {
  if (signals.length === 0) return ["なし"]
  return signals.map((signal) => {
    const values = signal.values.length > 0 ? ` values=${signal.values.join(", ")}` : ""
    const chunks = signal.chunkKeys.length > 0 ? ` chunks=${signal.chunkKeys.join(", ")}` : ""
    const candidate = signal.conflictCandidate ? ` subject=${signal.conflictCandidate.subject} predicate=${signal.conflictCandidate.predicate} scope=${signal.conflictCandidate.scope ?? "default"}` : ""
    return `- ${signal.type}${signal.factId ? ` fact=${signal.factId}` : ""}${values}${chunks}${candidate}: ${signal.reason}`
  })
}

function formatRetrievalLlmJudge(judge: NonNullable<QaAgentUpdate["retrievalEvaluation"]>["llmJudge"]): string[] {
  if (!judge) return ["なし"]
  return [
    `- label=${judge.label}`,
    `  confidence=${judge.confidence}`,
    `  factIds=${judge.factIds.join(", ") || "なし"}`,
    `  supportingChunkIds=${judge.supportingChunkIds.join(", ") || "なし"}`,
    `  contradictionChunkIds=${judge.contradictionChunkIds.join(", ") || "なし"}`,
    `  reason=${judge.reason}`
  ]
}

function outputUpdate(update: QaAgentUpdate): Record<string, JsonValue> | undefined {
  const output: Record<string, JsonValue> = {}
  const keys: Array<keyof QaAgentUpdate> = [
    "normalizedQuery",
    "clarificationContext",
    "clues",
    "expandedQueries",
    "searchPlan",
    "actionHistory",
    "retrievalEvaluation",
    "iteration",
    "newEvidenceCount",
    "noNewEvidenceStreak",
    "searchDecision",
    "retrievalDiagnostics",
    "temporalContext",
    "toolIntent",
    "computedFacts",
    "usedComputedFactIds",
    "clarification",
    "answerability",
    "sufficientContext",
    "answerSupport",
    "answer",
    "citations"
  ]

  for (const key of keys) {
    const value = update[key]
    if (value !== undefined) output[String(key)] = toJsonValue(value)
  }

  return Object.keys(output).length > 0 ? output : undefined
}

function formatClarificationDetail(clarification: NonNullable<QaAgentUpdate["clarification"]>): string {
  return [
    `needsClarification=${clarification.needsClarification}`,
    `reason=${clarification.reason}`,
    `ambiguityScore=${clarification.ambiguityScore ?? 0}`,
    `groundedOptionCount=${clarification.groundedOptionCount}`,
    `confidence=${clarification.confidence}`,
    "",
    "question:",
    clarification.question || "なし",
    "",
    "missingSlots:",
    ...formatList(clarification.missingSlots ?? []),
    "",
    "options:",
    ...(clarification.options.length > 0
      ? clarification.options.map((option) => `- ${option.id} ${option.label} source=${option.source} grounding=${option.grounding.length}`)
      : ["なし"]),
    "",
    "rejectedOptions:",
    ...formatList(clarification.rejectedOptions ?? [])
  ].join("\n")
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item))
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {}
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) result[key] = toJsonValue(nested)
    }
    return result
  }
  return String(value)
}

function formatAnswerabilityDetail(answerability: NonNullable<QaAgentUpdate["answerability"]>): string {
  const lines = [`reason=${answerability.reason}`, `confidence=${answerability.confidence}`]
  const assessments = answerability.sentenceAssessments ?? []

  lines.push("", "判定に使った文:")
  if (assessments.length === 0) {
    lines.push("なし")
    return lines.join("\n")
  }

  for (const assessment of assessments) {
    const status = assessment.status.toUpperCase()
    const source = [assessment.fileName, assessment.chunkId].filter(Boolean).join(" ")
    const score = assessment.score === undefined ? "" : ` score=${assessment.score.toFixed(4)}`
    const matchedChecks = assessment.checks ?? []
    const checks = matchedChecks.length > 0 ? ` checks=${matchedChecks.join(",")}` : ""
    lines.push(`[${status}]${source ? ` ${source}` : ""}${score}${checks}`)
    lines.push(`reason=${assessment.reason}`)
    lines.push(assessment.sentence)
  }

  return lines.join("\n")
}

function formatSearchPlanDetail(searchPlan: NonNullable<QaAgentUpdate["searchPlan"]>): string {
  const stopCriteria = searchPlan.stopCriteria
  const requiredFacts = searchPlan.requiredFacts ?? []
  const actions = searchPlan.actions ?? []
  const lines = [
    `complexity=${searchPlan.complexity}`,
    `intent=${searchPlan.intent}`,
    `stop=maxIterations:${stopCriteria.maxIterations}, minTopScore:${stopCriteria.minTopScore}, minEvidenceCount:${stopCriteria.minEvidenceCount}, maxNoNewEvidenceStreak:${stopCriteria.maxNoNewEvidenceStreak}`,
    "",
    "requiredFacts:"
  ]

  if (requiredFacts.length === 0) {
    lines.push("なし")
  } else {
    for (const fact of requiredFacts) {
      lines.push(`- ${fact.id} priority=${fact.priority} status=${fact.status}: ${fact.description}`)
    }
  }

  lines.push("", "actions:")
  if (actions.length === 0) {
    lines.push("なし")
  } else {
    for (const action of actions) {
      lines.push(`- ${formatSearchAction(action)}`)
    }
  }

  return lines.join("\n")
}

function formatActionObservationDetail(actionHistory: NonNullable<QaAgentUpdate["actionHistory"]>): string {
  const latest = actionHistory.at(-1)
  if (!latest) return "なし"
  const topScore = latest.topScore === undefined ? "" : ` topScore=${latest.topScore.toFixed(4)}`
  return [
    `action=${formatSearchAction(latest.action)}`,
    `hitCount=${latest.hitCount}`,
    `newEvidenceCount=${latest.newEvidenceCount}${topScore}`,
    latest.summary,
    ...formatRetrievalDiagnostics(latest.retrievalDiagnostics)
  ].join("\n")
}

function formatRetrievalDiagnostics(diagnostics: NonNullable<QaAgentUpdate["actionHistory"]>[number]["retrievalDiagnostics"]): string[] {
  if (!diagnostics) return []
  return [
    "",
    "retrievalDiagnostics:",
    `queries=${diagnostics.queryCount}`,
    `indexVersions=${diagnostics.indexVersions.join(",") || "none"}`,
    `aliasVersions=${diagnostics.aliasVersions.join(",") || "none"}`,
    `lexicalCount=${diagnostics.lexicalCount}`,
    `semanticCount=${diagnostics.semanticCount}`,
    `fusedCount=${diagnostics.fusedCount}`,
    `sources=lexical:${diagnostics.sourceCounts.lexical}, semantic:${diagnostics.sourceCounts.semantic}, hybrid:${diagnostics.sourceCounts.hybrid}`
  ]
}

function formatSearchAction(action: SearchAction): string {
  if (action.type === "evidence_search") return `evidence_search query="${action.query}" topK=${action.topK}`
  if (action.type === "query_rewrite") return `query_rewrite strategy=${action.strategy} input="${action.input}"`
  if (action.type === "expand_context") return `expand_context chunkKey=${action.chunkKey} window=${action.window}`
  if (action.type === "rerank") return `rerank objective="${action.objective}"`
  return `finalize_refusal reason="${action.reason}"`
}

function inferHitCount(update: QaAgentUpdate): number | undefined {
  return update.memoryCards?.length ?? update.retrievedChunks?.length ?? update.selectedChunks?.length ?? update.citations?.length
}

function inferTokenCount(update: QaAgentUpdate): number | undefined {
  const text = update.rawAnswer ?? update.answer
  if (!text) return undefined
  return Math.max(1, Math.ceil(text.length / 4))
}
