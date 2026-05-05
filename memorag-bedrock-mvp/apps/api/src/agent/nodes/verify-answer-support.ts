import type { Dependencies } from "../../dependencies.js"
import { parseJsonObject } from "../../rag/json.js"
import { buildAnswerSupportPrompt, buildSupportedAnswerRepairPrompt } from "../../rag/prompts.js"
import { llmOptions, ragRuntimePolicy } from "../runtime-policy.js"
import { NO_ANSWER, type AnswerSupportJudgement, type QaAgentState, type QaAgentUpdate } from "../state.js"
import { toCitation } from "../utils.js"

type SupportJson = Partial<AnswerSupportJudgement>

export function createVerifyAnswerSupportNode(deps: Dependencies) {
  return async function verifyAnswerSupport(state: QaAgentState): Promise<QaAgentUpdate> {
    if (!state.answerability.isAnswerable || !state.answer || state.answer === NO_ANSWER) {
      return {
        answerSupport: unsupported("回答可能な最終回答がありません。", state)
      }
    }

    const evidenceChunks = selectCitedChunks(state)
    const raw = await deps.textModel.generate(
      buildAnswerSupportPrompt(state.question, state.answer, evidenceChunks, selectedComputedFacts(state)),
      llmOptions("answerSupport", state.modelId)
    )
    const judgement = normalizeJudgement(parseJsonObject<SupportJson>(raw), state, evidenceChunks)

    if (judgement.supported) {
      return { answerSupport: judgement }
    }

    const repaired = await repairUnsupportedAnswer(deps, state, judgement, evidenceChunks)
    if (repaired) return repaired

    return {
      answerSupport: judgement,
      answerability: {
        ...state.answerability,
        isAnswerable: false,
        reason: "unsupported_answer",
        confidence: judgement.confidence
      },
      answer: NO_ANSWER,
      citations: []
    }
  }
}

type RepairJson = {
  isAnswerable?: boolean
  answer?: string
  usedChunkIds?: string[]
}

async function repairUnsupportedAnswer(
  deps: Dependencies,
  state: QaAgentState,
  judgement: AnswerSupportJudgement,
  evidenceChunks: QaAgentState["selectedChunks"]
): Promise<QaAgentUpdate | undefined> {
  if (evidenceChunks.length === 0 || judgement.unsupportedSentences.length === 0) return undefined
  const raw = await deps.textModel.generate(
    buildSupportedAnswerRepairPrompt(state.question, state.answer ?? "", judgement.unsupportedSentences, evidenceChunks),
    llmOptions("answerRepair", state.modelId)
  )
  const repaired = parseJsonObject<RepairJson>(raw)
  if (repaired?.isAnswerable !== true || !repaired.answer || repaired.answer.trim() === NO_ANSWER) return undefined
  const repairedChunks = chunksForUsedIds(repaired.usedChunkIds ?? [], evidenceChunks)
  if (repairedChunks.length === 0) return undefined
  const supportRaw = await deps.textModel.generate(
    buildAnswerSupportPrompt(state.question, repaired.answer, repairedChunks, selectedComputedFacts(state)),
    llmOptions("answerSupport", state.modelId)
  )
  const repairedJudgement = normalizeJudgement(parseJsonObject<SupportJson>(supportRaw), { ...state, answer: repaired.answer }, repairedChunks)
  if (!repairedJudgement.supported) return undefined
  return {
    answer: repaired.answer.trim(),
    citations: repairedChunks.map(toCitation),
    answerSupport: {
      ...repairedJudgement,
      reason: `unsupported sentence を除去して supported-only 再生成に成功しました。${repairedJudgement.reason}`
    }
  }
}

function selectCitedChunks(state: QaAgentState): QaAgentState["selectedChunks"] {
  if (state.citations.length === 0) return []
  const citedIds = new Set(state.citations.flatMap((citation) => [citation.chunkId, `${citation.documentId}-${citation.chunkId}`].filter(Boolean)))
  const citedFileNames = new Set(state.citations.map((citation) => citation.fileName))
  const selected = state.selectedChunks.filter((chunk) => citedIds.has(chunk.key) || citedIds.has(chunk.metadata.chunkId ?? ""))
  if (selected.length > 0) return selected
  return state.selectedChunks.filter((chunk) => citedFileNames.has(chunk.metadata.fileName))
}

function normalizeJudgement(parsed: SupportJson | undefined, state: QaAgentState, evidenceChunks: QaAgentState["selectedChunks"]): AnswerSupportJudgement {
  const unsupportedSentences = normalizeUnsupportedSentences(parsed?.unsupportedSentences).slice(0, ragRuntimePolicy.limits.unsupportedSentenceLimit)
  const supportingChunkIds = validChunkIds(cleanStrings(parsed?.supportingChunkIds), evidenceChunks)
  const supportingComputedFactIds = validComputedFactIds(cleanStrings(parsed?.supportingComputedFactIds), state)
  const contradictionChunkIds = validChunkIds(cleanStrings(parsed?.contradictionChunkIds), evidenceChunks)
  const totalSentences = normalizeTotalSentences(parsed?.totalSentences, state.answer ?? "", unsupportedSentences.length)
  const supported = parsed?.supported === true && unsupportedSentences.length === 0 && contradictionChunkIds.length === 0 && (evidenceChunks.length > 0 || supportingComputedFactIds.length > 0)

  return {
    supported,
    unsupportedSentences: supported ? [] : unsupportedSentences.length > 0 ? unsupportedSentences : [{ sentence: state.answer ?? "", reason: "回答文を支持する根拠チャンクを確認できませんでした。" }],
    supportingChunkIds:
      supported && supportingChunkIds.length === 0
        ? evidenceChunks.slice(0, ragRuntimePolicy.limits.supportingChunkFallbackLimit).map((chunk) => chunk.key)
        : supportingChunkIds,
    supportingComputedFactIds,
    contradictionChunkIds,
    confidence: clamp(
      parsed?.confidence ??
        (supported ? ragRuntimePolicy.confidence.answerSupportSupportedFallback : ragRuntimePolicy.confidence.answerSupportUnsupportedFallback)
    ),
    totalSentences,
    reason:
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, ragRuntimePolicy.limits.judgeReasonMaxChars)
        : supported
          ? "回答文は根拠チャンクで支持されています。"
          : "根拠で支持されない回答文があります。"
  }
}

function unsupported(reason: string, state: QaAgentState): AnswerSupportJudgement {
  return {
    supported: false,
    unsupportedSentences: state.answer && state.answer !== NO_ANSWER ? [{ sentence: state.answer, reason }] : [],
    supportingChunkIds: [],
    supportingComputedFactIds: [],
    contradictionChunkIds: [],
    confidence: 0,
    totalSentences: state.answer ? splitSentences(state.answer).length : 0,
    reason
  }
}

function selectedComputedFacts(state: QaAgentState): QaAgentState["computedFacts"] {
  if (state.usedComputedFactIds.length === 0) return state.computedFacts
  const ids = new Set(state.usedComputedFactIds)
  return state.computedFacts.filter((fact) => ids.has(fact.id))
}

function normalizeUnsupportedSentences(value: unknown): AnswerSupportJudgement["unsupportedSentences"] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return undefined
      const sentence = "sentence" in item && typeof item.sentence === "string" ? item.sentence.trim() : ""
      const reason = "reason" in item && typeof item.reason === "string" ? item.reason.trim() : ""
      if (!sentence) return undefined
      return { sentence, reason: reason || "根拠チャンクで支持されていません。" }
    })
    .filter((item): item is { sentence: string; reason: string } => item !== undefined)
}

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
}

function validChunkIds(ids: string[], chunks: QaAgentState["selectedChunks"]): string[] {
  const validIds = new Set(chunks.flatMap((chunk) => [chunk.key, chunk.metadata.chunkId].filter(Boolean)))
  const byChunkId = new Map(chunks.map((chunk) => [chunk.metadata.chunkId, chunk.key]))
  return [...new Set(ids.map((id) => byChunkId.get(id) ?? id).filter((id) => validIds.has(id)))]
}

function validComputedFactIds(ids: string[], state: QaAgentState): string[] {
  const validIds = new Set(state.computedFacts.map((fact) => fact.id))
  return [...new Set(ids.filter((id) => validIds.has(id)))]
}

function chunksForUsedIds(ids: string[], chunks: QaAgentState["selectedChunks"]): QaAgentState["selectedChunks"] {
  const normalized = new Set(ids.map((id) => id.trim()).filter(Boolean))
  return chunks.filter((chunk) => normalized.has(chunk.key) || normalized.has(chunk.metadata.chunkId ?? ""))
}

function normalizeTotalSentences(value: unknown, answer: string, unsupportedCount: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value)
  return Math.max(splitSentences(answer).length, unsupportedCount)
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。.!?！？])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
