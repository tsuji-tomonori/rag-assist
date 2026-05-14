import type { Citation } from "../../../shared/types/common.js"
import type { DebugStep, DebugTrace } from "../types.js"

export type DebugGraphNodeStatus = "success" | "warning" | "error"
export type DebugGraphNodeType = "step" | "retrieval" | "decision" | "answer" | "refusal" | "repair"
export type DebugGraphGroup = "preprocess" | "search-loop" | "context" | "answer" | "finalize" | "other"

export type DebugGraphNode = {
  id: string
  type: DebugGraphNodeType
  label: string
  status: DebugGraphNodeStatus
  latencyMs: number
  group: DebugGraphGroup
  detailRef: string
  summary?: string
  iteration?: number
  decision?: string
}

export type DebugGraphEdge = {
  id: string
  source: string
  target: string
  kind: "next" | "loop" | "branch" | "repair"
  label?: string
  active: boolean
}

export type DebugRunSummary = {
  runId: string
  targetType?: DebugTrace["targetType"]
  visibility?: DebugTrace["visibility"]
  sanitizePolicyVersion?: DebugTrace["sanitizePolicyVersion"]
  exportRedaction?: DebugTrace["exportRedaction"]
  question: string
  status: "answered" | "refused" | "error" | "warning"
  isAnswerable: boolean
  answerPreview: string
  mainFailureStage: "retrieval" | "context" | "answer_generation" | "support_verification" | null
  refusalReason: string | null
  startedAt: string
  completedAt: string
  totalLatencyMs: number
}

export type DebugReplayEnvelope = {
  schemaVersion: 2
  traceType: "memorag-debug-trace"
  runSummary: DebugRunSummary
  pipelineVersions: Record<string, unknown>
  graph: {
    nodes: DebugGraphNode[]
    edges: DebugGraphEdge[]
  }
  details: Record<string, unknown>
  evidence: {
    retrieved: Citation[]
    selected: Citation[]
    citations: Citation[]
  }
  rawTrace: DebugTrace
}

export type FactCoverageRow = {
  id: string
  description: string
  status: "supported" | "missing" | "conflicting" | "unknown"
  reason?: string
}

export type EvidenceDebugRow = Citation & {
  tags: string[]
}

export function buildDebugReplayEnvelope(trace: DebugTrace): DebugReplayEnvelope {
  const nodes = trace.steps.map((step) => buildGraphNode(step))
  const edges = buildGraphEdges(nodes, trace.steps)
  const details = Object.fromEntries(trace.steps.map((step) => [`detail:step-${step.id}`, { step, output: step.output ?? null }]))

  return {
    schemaVersion: 2,
    traceType: "memorag-debug-trace",
    runSummary: buildRunSummary(trace),
    pipelineVersions: trace.pipelineVersions ?? {
      modelId: trace.modelId,
      embeddingModelId: trace.embeddingModelId,
      clueModelId: trace.clueModelId,
      topK: trace.topK,
      memoryTopK: trace.memoryTopK,
      minScore: trace.minScore
    },
    graph: { nodes, edges },
    details,
    evidence: {
      retrieved: trace.retrieved,
      selected: trace.retrieved.filter((item) => trace.citations.some((citation) => sameEvidence(item, citation))),
      citations: trace.citations
    },
    rawTrace: trace
  }
}

export function parseDebugReplayJson(input: unknown): DebugReplayEnvelope {
  if (!isRecord(input)) throw new Error("JSON object が必要です。")

  if (input.traceType === "memorag-debug-trace" && input.schemaVersion === 2) {
    const rawTrace = input.rawTrace
    if (!isDebugTraceLike(rawTrace)) throw new Error("rawTrace が DebugTrace 形式ではありません。")
    const envelope = buildDebugReplayEnvelope(rawTrace)
    return {
      ...envelope,
      graph: isGraphLike(input.graph) ? input.graph : envelope.graph,
      details: isRecord(input.details) ? input.details : envelope.details,
      pipelineVersions: isRecord(input.pipelineVersions) ? input.pipelineVersions : envelope.pipelineVersions
    }
  }

  if (isDebugTraceLike(input)) return buildDebugReplayEnvelope(input)

  throw new Error("DebugTrace または memorag-debug-trace v2 JSON をアップロードしてください。")
}

export function extractFactCoverage(trace: DebugTrace): FactCoverageRow[] {
  const evaluation = findLatestOutputRecord(trace, "retrieval_evaluator")?.retrievalEvaluation
  const plan = findLatestOutputRecord(trace, "plan_search")?.searchPlan
  if (!isRecord(evaluation)) return []

  const supported = new Set(readStringArray(evaluation.supportedFactIds))
  const missing = new Set(readStringArray(evaluation.missingFactIds))
  const conflicting = new Set(readStringArray(evaluation.conflictingFactIds))
  const requiredFacts = isRecord(plan) && Array.isArray(plan.requiredFacts) ? plan.requiredFacts.filter(isRecord) : []
  const factIds = new Set<string>([...supported, ...missing, ...conflicting])
  for (const fact of requiredFacts) {
    if (typeof fact.id === "string") factIds.add(fact.id)
  }

  return [...factIds].map((id) => {
    const fact = requiredFacts.find((item) => item.id === id)
    const description = typeof fact?.description === "string" ? fact.description : id
    const status = conflicting.has(id) ? "conflicting" : missing.has(id) ? "missing" : supported.has(id) ? "supported" : "unknown"
    return {
      id,
      description,
      status,
      reason: typeof evaluation.reason === "string" ? evaluation.reason : undefined
    }
  })
}

export function extractAnswerSupport(trace: DebugTrace): Record<string, unknown> | undefined {
  const output = findLatestOutputRecord(trace, "verify_answer_support")
  const support = output?.answerSupport
  return isRecord(support) ? support : undefined
}

export function extractContextAssembly(trace: DebugTrace): Record<string, unknown> | undefined {
  for (const step of [...trace.steps].reverse()) {
    const contextAssembly = step.output?.contextAssembly
    if (isRecord(contextAssembly)) return contextAssembly
  }
  return undefined
}

export function buildEvidenceRows(trace: DebugTrace): EvidenceDebugRow[] {
  const citations = trace.citations
  return trace.retrieved.map((item) => {
    const cited = citations.some((citation) => sameEvidence(item, citation))
    const tags = ["retrieved", cited ? "cited" : "context-candidate"]
    return { ...item, tags }
  })
}

export function stringifyDebugJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function buildRunSummary(trace: DebugTrace): DebugRunSummary {
  const lastWarning = [...trace.steps].reverse().find((step) => step.status === "warning")
  const errorStep = [...trace.steps].reverse().find((step) => step.status === "error")
  const mainFailureStage = inferFailureStage(errorStep ?? lastWarning)
  return {
    runId: trace.runId,
    targetType: trace.targetType,
    visibility: trace.visibility,
    sanitizePolicyVersion: trace.sanitizePolicyVersion,
    exportRedaction: trace.exportRedaction,
    question: trace.question,
    status: trace.status === "error" ? "error" : trace.isAnswerable ? "answered" : trace.status === "warning" ? "warning" : "refused",
    isAnswerable: trace.isAnswerable,
    answerPreview: trace.answerPreview,
    mainFailureStage,
    refusalReason: trace.isAnswerable ? null : lastWarning?.summary ?? "回答拒否として完了しました。",
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    totalLatencyMs: trace.totalLatencyMs
  }
}

function buildGraphNode(step: DebugStep): DebugGraphNode {
  const output = step.output ?? {}
  return {
    id: `step-${step.id}`,
    type: inferNodeType(step),
    label: step.label,
    status: step.status,
    latencyMs: step.latencyMs,
    group: inferNodeGroup(step.label),
    detailRef: `detail:step-${step.id}`,
    summary: step.summary,
    iteration: readNumber(output.iteration),
    decision: readDecision(output)
  }
}

function buildGraphEdges(nodes: DebugGraphNode[], steps: DebugStep[]): DebugGraphEdge[] {
  const edges: DebugGraphEdge[] = []
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1]
    const current = nodes[index]
    if (!previous || !current) continue
    const previousStep = steps[index - 1]
    const isLoop = previousStep?.label === "evaluate_search_progress" && current.label === "plan_search"
    const isRepair = previousStep?.label === "verify_answer_support" && current.label === "finalize_response"
    edges.push({
      id: `edge-${previous.id}-${current.id}`,
      source: previous.id,
      target: current.id,
      kind: isLoop ? "loop" : isRepair ? "repair" : "next",
      label: isLoop ? "continue_search" : isRepair ? "repair/finalize" : undefined,
      active: true
    })
  }
  return edges
}

function inferNodeType(step: DebugStep): DebugGraphNodeType {
  if (step.label.includes("retrieval") || step.label.includes("search") || step.label.includes("memory")) return "retrieval"
  if (step.label.includes("gate") || step.label.includes("evaluate")) return "decision"
  if (step.label.includes("refusal")) return "refusal"
  if (step.label.includes("repair")) return "repair"
  if (step.label.includes("answer") || step.label.includes("citation") || step.label.includes("support")) return "answer"
  return "step"
}

function inferNodeGroup(label: string): DebugGraphGroup {
  if (["analyze_input", "normalize_query", "retrieve_memory", "generate_clues"].includes(label)) return "preprocess"
  if (["plan_search", "execute_search_action", "retrieval_evaluator", "evaluate_search_progress"].includes(label)) return "search-loop"
  if (["rerank_chunks", "answerability_gate", "sufficient_context_gate"].includes(label)) return "context"
  if (["generate_answer", "validate_citations", "verify_answer_support"].includes(label)) return "answer"
  if (["finalize_response", "finalize_refusal"].includes(label)) return "finalize"
  return "other"
}

function inferFailureStage(step?: DebugStep): DebugRunSummary["mainFailureStage"] {
  if (!step) return null
  if (step.label.includes("retrieval") || step.label.includes("search")) return "retrieval"
  if (step.label.includes("context") || step.label.includes("answerability")) return "context"
  if (step.label.includes("support") || step.label.includes("citation")) return "support_verification"
  if (step.label.includes("answer")) return "answer_generation"
  return null
}

function readDecision(output: Record<string, unknown>): string | undefined {
  if (typeof output.searchDecision === "string") return output.searchDecision
  const evaluation = output.retrievalEvaluation
  if (isRecord(evaluation)) {
    const nextAction = evaluation.nextAction
    if (isRecord(nextAction) && typeof nextAction.type === "string") return nextAction.type
    if (typeof evaluation.retrievalQuality === "string") return evaluation.retrievalQuality
  }
  const answerability = output.answerability
  if (isRecord(answerability) && typeof answerability.label === "string") return answerability.label
  return undefined
}

function findLatestOutputRecord(trace: DebugTrace, label: string): Record<string, unknown> | undefined {
  const step = [...trace.steps].reverse().find((item) => item.label === label)
  return step?.output
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function sameEvidence(left: Citation, right: Citation): boolean {
  return left.documentId === right.documentId && (left.chunkId ?? "") === (right.chunkId ?? "") && left.fileName === right.fileName
}

function isGraphLike(value: unknown): value is DebugReplayEnvelope["graph"] {
  return isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.edges)
}

function isDebugTraceLike(value: unknown): value is DebugTrace {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.question === "string" &&
    typeof value.modelId === "string" &&
    typeof value.embeddingModelId === "string" &&
    typeof value.clueModelId === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.totalLatencyMs === "number" &&
    typeof value.status === "string" &&
    typeof value.answerPreview === "string" &&
    typeof value.isAnswerable === "boolean" &&
    Array.isArray(value.steps) &&
    Array.isArray(value.citations) &&
    Array.isArray(value.retrieved)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
