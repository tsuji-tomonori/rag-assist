import type { Dependencies } from "../../dependencies.js"
import { parseJsonObject } from "../../rag/json.js"
import { buildSufficientContextPrompt } from "../../rag/prompts.js"
import { llmOptions, ragRuntimePolicy } from "../runtime-policy.js"
import { NO_ANSWER, type QaAgentState, type QaAgentUpdate, type SufficientContextJudgement } from "../state.js"

type JudgeJson = Partial<SufficientContextJudgement>

export function createSufficientContextGateNode(deps: Dependencies) {
  return async function sufficientContextGate(state: QaAgentState): Promise<QaAgentUpdate> {
    const requiredFacts = state.searchPlan.requiredFacts.map((fact) => {
      const type = fact.factType ? `type=${fact.factType}` : "type=unknown"
      const scope = fact.scope ? ` scope=${fact.scope}` : ""
      return `${fact.description} (${type}${scope})`
    }).filter(Boolean)
    const raw = await deps.textModel.generate(
      buildSufficientContextPrompt(state.question, requiredFacts, state.selectedChunks),
      llmOptions("sufficientContext", state.modelId)
    )
    const judgement = normalizeJudgement(parseJsonObject<JudgeJson>(raw), state)

    if (judgement.label === "ANSWERABLE") {
      return {
        sufficientContext: judgement,
        searchPlan: updateRequiredFactStatuses(state, judgement),
        answerability: {
          ...state.answerability,
          isAnswerable: true,
          reason: "sufficient_evidence",
          confidence: Math.max(state.answerability.confidence, judgement.confidence)
        }
      }
    }

    if (canProceedWithGroundedPartialEvidence(state, judgement)) {
      return {
        sufficientContext: {
          ...judgement,
          reason: `${judgement.reason} 後段の引用検証と回答支持検証で確認できるため、取得済み根拠で回答生成へ進みます。`
        },
        searchPlan: updateRequiredFactStatuses(state, judgement),
        answerability: {
          ...state.answerability,
          isAnswerable: true,
          reason: "sufficient_evidence",
          confidence: Math.max(
            state.answerability.confidence,
            Math.min(ragRuntimePolicy.confidence.partialEvidenceCap, judgement.confidence || ragRuntimePolicy.confidence.partialEvidenceFallback)
          )
        }
      }
    }

    return {
      sufficientContext: judgement,
      searchPlan: updateRequiredFactStatuses(state, judgement),
      answerability: {
        ...state.answerability,
        isAnswerable: false,
        reason: judgement.conflictingFacts.length > 0 ? "conflicting_evidence" : "missing_required_fact",
        confidence: judgement.confidence
      },
      answer: NO_ANSWER,
      citations: []
    }
  }
}

function canProceedWithGroundedPartialEvidence(state: QaAgentState, judgement: SufficientContextJudgement): boolean {
  if (judgement.label !== "PARTIAL") return false
  if (!state.answerability.isAnswerable) return false
  if (state.selectedChunks.length === 0) return false
  if (judgement.supportedFacts.length === 0 && judgement.supportingChunkIds.length === 0) return false
  if (judgement.missingFacts.length > 0) return false
  if (judgement.conflictingFacts.length > 0) return false
  if (state.retrievalEvaluation.retrievalQuality === "irrelevant" || state.retrievalEvaluation.retrievalQuality === "conflicting") return false
  if (state.selectedChunks[0]?.score !== undefined && state.selectedChunks[0].score < state.minScore) return false
  return hasDirectAnswerCue(state.question, state.selectedChunks)
}

function hasDirectAnswerCue(question: string, chunks: QaAgentState["selectedChunks"]): boolean {
  const joined = chunks.map((chunk) => chunk.metadata.text ?? "").join("\n")
  const normalizedJoined = normalize(joined)
  const subjectTerms = significantTerms(question)
    .flatMap((term) => [term, ...expandedTermVariants(term)])
    .filter((term) => !isGenericTerm(term))
  const subjectMatched = subjectTerms.length > 0 && subjectTerms.some((term) => normalizedJoined.includes(normalize(term)))
  return subjectMatched && matchesAnswerCue(question, joined)
}

function matchesAnswerCue(question: string, text: string): boolean {
  const normalized = text.normalize("NFKC")
  if (/金額|費用|いくら|円|上限/.test(question)) return /[0-9０-９,]+(?:円|万円|千円)/.test(normalized)
  if (/いつ|期限|日数|何日|何営業日|何日前|開始日|終了日|頻度|何回/.test(question)) {
    return /[0-9０-９]+(?:日|営業日|ヶ月|か月|月|年|回|分)|翌月|前営業日|月末|月初|毎月|年[0-9０-９]+回|[0-9０-９]+日ごと/.test(normalized)
  }
  if (/方法|手順|申請|やり方|フロー|提出|どこ|部署|依頼先/.test(question)) return /(申請|手順|システム|フォーム|提出|承認|部|窓口|チャンネル|ストレージ)/.test(normalized)
  if (/誰|承認|判定|報告先/.test(question)) return /(上長|責任者|産業医|法務部|総務部|人事部|ヘルプデスク|部|者)/.test(normalized)
  if (/何が|何を|ありますか|必要/.test(question)) return normalized.length > 0
  return normalized.length > 0
}

function significantTerms(text: string): string[] {
  const normalized = text.normalize("NFKC")
  const ascii = normalized.match(/[A-Za-z0-9][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu) ?? []
  return [...new Set([...japanese, ...ascii].map((term) => term.trim()).filter(Boolean))]
}

function expandedTermVariants(term: string): string[] {
  return [
    term.replace(/承認者$/, "承認"),
    term.replace(/判定者$/, "判定"),
    term.replace(/担当部署$/, "部"),
    term.replace(/(申請期限|提出期限|取得期限|変更頻度|依頼先|報告先|提出書類|対象家族|対象者|金額基準)$/, ""),
    term.replace(/(申請|期限|条件|頻度|方法|手順|部署|書類|対象|必要|変更|提出|依頼先|報告先|判定)$/, "")
  ].filter((variant) => variant.length >= 2 && variant !== term)
}

function isGenericTerm(term: string): boolean {
  return ["期限", "条件", "手順", "方法", "対象", "申請", "利用", "設定", "削除", "費用", "権限", "頻度", "部署", "書類", "必要", "提出"].includes(term)
}

function normalizeJudgement(parsed: JudgeJson | undefined, state: QaAgentState): SufficientContextJudgement {
  const label = parsed?.label === "ANSWERABLE" || parsed?.label === "PARTIAL" || parsed?.label === "UNANSWERABLE" ? parsed.label : "UNANSWERABLE"
  const confidence = clamp(parsed?.confidence ?? 0)
  const requiredFacts = cleanStrings(parsed?.requiredFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const supportedFacts = cleanStrings(parsed?.supportedFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const missingFacts = cleanStrings(parsed?.missingFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const conflictingFacts = cleanStrings(parsed?.conflictingFacts).slice(0, ragRuntimePolicy.limits.requiredFactLimit)
  const supportingChunkIds = validSupportingChunkIds(cleanStrings(parsed?.supportingChunkIds), state)
  const fallbackSupportingChunkIds =
    label === "ANSWERABLE" && supportingChunkIds.length === 0
      ? state.selectedChunks.slice(0, ragRuntimePolicy.limits.supportingChunkFallbackLimit).map((chunk) => chunk.key)
      : supportingChunkIds
  const fallbackReason = label === "ANSWERABLE" ? "必要事実が根拠チャンクで支持されています。" : "根拠チャンクだけでは回答に必要な事実が不足しています。"

  return {
    label,
    confidence,
    requiredFacts: requiredFacts.length > 0 ? requiredFacts : state.searchPlan.requiredFacts.map((fact) => fact.description),
    supportedFacts,
    missingFacts: label === "ANSWERABLE" ? [] : missingFacts,
    conflictingFacts,
    supportingChunkIds: fallbackSupportingChunkIds,
    reason:
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, ragRuntimePolicy.limits.judgeReasonMaxChars)
        : fallbackReason
  }
}

function updateRequiredFactStatuses(state: QaAgentState, judgement: SufficientContextJudgement): QaAgentState["searchPlan"] {
  const supported = judgement.supportedFacts.map(normalize)
  const missing = judgement.missingFacts.map(normalize)
  const conflicting = judgement.conflictingFacts.map(normalize)

  return {
    ...state.searchPlan,
    requiredFacts: state.searchPlan.requiredFacts.map((fact) => {
      const normalized = normalize(fact.description)
      const status = conflicting.some((item) => item && normalized.includes(item))
        ? "conflicting"
        : supported.some((item) => item && (normalized.includes(item) || item.includes(normalized)))
          ? "supported"
          : missing.some((item) => item && (normalized.includes(item) || item.includes(normalized)))
            ? "missing"
            : judgement.label === "ANSWERABLE"
              ? "supported"
              : fact.status
      return {
        ...fact,
        status,
        supportingChunkKeys: status === "supported" ? judgement.supportingChunkIds : fact.supportingChunkKeys
      }
    })
  }
}

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
}

function validSupportingChunkIds(ids: string[], state: QaAgentState): string[] {
  const validIds = new Set(state.selectedChunks.flatMap((chunk) => [chunk.key, chunk.metadata.chunkId].filter(Boolean)))
  const byChunkId = new Map(state.selectedChunks.map((chunk) => [chunk.metadata.chunkId, chunk.key]))
  return [...new Set(ids.map((id) => byChunkId.get(id) ?? id).filter((id) => validIds.has(id)))]
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase()
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
