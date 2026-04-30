import type { DebugStep } from "../types.js"
import type { QaAgentState, QaAgentUpdate } from "./state.js"
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
          hitCount: inferHitCount(update),
          tokenCount: inferTokenCount(update)
        })
      }
    } catch (error) {
      const completedAt = new Date()
      return {
        answerability: {
          isAnswerable: false,
          reason: "citation_validation_failed",
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
          detail: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }
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
    hitCount: input.hitCount,
    tokenCount: input.tokenCount,
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString()
  }
}

function inferStatus(update: QaAgentUpdate): DebugStep["status"] {
  if (update.answerability && update.answerability.isAnswerable === false && update.answerability.reason !== "not_checked") {
    return "warning"
  }
  if (update.answer === NO_ANSWER) return "warning"
  return "success"
}

function inferModelId(label: string, state: QaAgentState): string | undefined {
  if (label === "generate_clues") return state.clueModelId
  if (label === "generate_answer") return state.modelId
  if (["retrieve_memory", "embed_queries", "search_evidence"].includes(label)) return state.embeddingModelId
  return undefined
}

function summarizeUpdate(label: string, update: QaAgentUpdate): string {
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
  if (update.answerability) return `reason=${update.answerability.reason}\nconfidence=${update.answerability.confidence}`
  if (update.rawAnswer) return update.rawAnswer.slice(0, 1200)
  if (update.answer) return update.answer.slice(0, 1200)
  return undefined
}

function inferHitCount(update: QaAgentUpdate): number | undefined {
  return update.memoryCards?.length ?? update.retrievedChunks?.length ?? update.selectedChunks?.length ?? update.citations?.length
}

function inferTokenCount(update: QaAgentUpdate): number | undefined {
  const text = update.rawAnswer ?? update.answer
  if (!text) return undefined
  return Math.max(1, Math.ceil(text.length / 4))
}
