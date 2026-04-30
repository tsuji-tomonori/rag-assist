import type { QaAgentState, QaAgentUpdate } from "../state.js"
import { NO_ANSWER } from "../state.js"

export async function answerabilityGate(state: QaAgentState): Promise<QaAgentUpdate> {
  const chunks = state.selectedChunks
  const topScore = chunks[0]?.score ?? 0

  if (chunks.length < 1) {
    return refusal("no_relevant_chunks", 0)
  }

  if (topScore < state.minScore) {
    return refusal("low_similarity_score", Math.max(0, topScore))
  }

  const coverage = estimateRequiredFactCoverage(state.question, chunks)
  if (!coverage.ok) {
    return refusal("missing_required_fact", coverage.confidence)
  }

  return {
    answerability: {
      isAnswerable: true,
      reason: "sufficient_evidence",
      confidence: Math.min(0.99, Math.max(topScore, coverage.confidence))
    }
  }
}

function refusal(reason: "no_relevant_chunks" | "low_similarity_score" | "missing_required_fact", confidence: number): QaAgentUpdate {
  return {
    answerability: {
      isAnswerable: false,
      reason,
      confidence
    },
    answer: NO_ANSWER,
    citations: []
  }
}

function estimateRequiredFactCoverage(question: string, chunks: { metadata: { text?: string } }[]): { ok: boolean; confidence: number } {
  const joined = chunks.map((chunk) => chunk.metadata.text ?? "").join("\n")

  const asksAmount = /金額|費用|いくら|円|上限/.test(question)
  const asksDate = /いつ|期限|日数|何日|何営業日|開始日|終了日/.test(question)
  const asksHow = /方法|手順|申請|やり方|フロー/.test(question)

  if (asksAmount && !/[0-9０-９,]+円/.test(joined)) return { ok: false, confidence: 0.4 }
  if (asksDate && !/[0-9０-９]+(日|営業日|ヶ月|か月|月|年)/.test(joined)) return { ok: false, confidence: 0.4 }
  if (asksHow && !/(申請|手順|システム|フォーム|提出|承認)/.test(joined)) return { ok: false, confidence: 0.45 }

  return { ok: true, confidence: 0.8 }
}
