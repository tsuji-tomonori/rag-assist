import type { QaAgentState, QaAgentUpdate } from "../state.js"
import { NO_ANSWER } from "../state.js"
import { hasUsableRequirementsClassificationEvidence, isRequirementsClassificationQuestion } from "../../rag/prompts.js"

type SelectedChunk = QaAgentState["selectedChunks"][number]
type SentenceAssessment = NonNullable<QaAgentState["answerability"]["sentenceAssessments"]>[number]
type FactCheck = "amount" | "date" | "procedure" | "requirements_classification" | "retrieval_relevance"

export async function answerabilityGate(state: QaAgentState): Promise<QaAgentUpdate> {
  const chunks = state.selectedChunks
  const topScore = chunks[0]?.score ?? 0

  if (chunks.length < 1) {
    return refusal("no_relevant_chunks", 0)
  }

  if (topScore < state.minScore) {
    return refusal("low_similarity_score", Math.max(0, topScore), buildLowScoreAssessments(chunks, state.minScore))
  }

  const coverage = estimateRequiredFactCoverage(state.question, chunks)
  if (!coverage.ok) {
    return refusal("missing_required_fact", coverage.confidence, coverage.sentenceAssessments)
  }

  return {
    answerability: {
      isAnswerable: true,
      reason: "sufficient_evidence",
      confidence: Math.min(0.99, Math.max(topScore, coverage.confidence)),
      sentenceAssessments: coverage.sentenceAssessments
    }
  }
}

function refusal(
  reason: "no_relevant_chunks" | "low_similarity_score" | "missing_required_fact",
  confidence: number,
  sentenceAssessments: SentenceAssessment[] = []
): QaAgentUpdate {
  return {
    answerability: {
      isAnswerable: false,
      reason,
      confidence,
      sentenceAssessments
    },
    answer: NO_ANSWER,
    citations: []
  }
}

function estimateRequiredFactCoverage(question: string, chunks: SelectedChunk[]): { ok: boolean; confidence: number; sentenceAssessments: SentenceAssessment[] } {
  const joined = chunks.map((chunk) => chunk.metadata.text ?? "").join("\n")
  const requiredChecks = requiredFactChecks(question)
  const sentenceAssessments = buildSentenceAssessments(chunks, requiredChecks)

  if (isRequirementsClassificationQuestion(question) && !hasUsableRequirementsClassificationEvidence(joined)) {
    return { ok: false, confidence: 0.35, sentenceAssessments }
  }

  const asksAmount = /金額|費用|いくら|円|上限/.test(question)
  const asksDate = /いつ|期限|日数|何日|何営業日|開始日|終了日/.test(question)
  const asksHow = /方法|手順|申請|やり方|フロー/.test(question)

  if (asksAmount && !matchesFactCheck("amount", joined)) return { ok: false, confidence: 0.4, sentenceAssessments }
  if (asksDate && !matchesFactCheck("date", joined)) return { ok: false, confidence: 0.4, sentenceAssessments }
  if (asksHow && !matchesFactCheck("procedure", joined)) return { ok: false, confidence: 0.45, sentenceAssessments }

  return { ok: true, confidence: 0.8, sentenceAssessments }
}

function requiredFactChecks(question: string): FactCheck[] {
  const checks: FactCheck[] = []
  if (isRequirementsClassificationQuestion(question)) checks.push("requirements_classification")
  if (/金額|費用|いくら|円|上限/.test(question)) checks.push("amount")
  if (/いつ|期限|日数|何日|何営業日|開始日|終了日/.test(question)) checks.push("date")
  if (/方法|手順|申請|やり方|フロー/.test(question)) checks.push("procedure")
  return checks.length > 0 ? checks : ["retrieval_relevance"]
}

function buildSentenceAssessments(chunks: SelectedChunk[], requiredChecks: FactCheck[]): SentenceAssessment[] {
  const sentences = chunks.flatMap((chunk) =>
    splitSentences(chunk.metadata.text ?? "").map((sentence) => ({
      sentence,
      fileName: chunk.metadata.fileName,
      chunkId: chunk.metadata.chunkId ?? chunk.key,
      score: chunk.score
    }))
  )

  const assessments = sentences.map((item) => {
    const checks = requiredChecks.filter((check) => matchesFactCheck(check, item.sentence))
    return {
      ...item,
      status: checks.length > 0 ? "ok" : "ng",
      checks,
      reason: checks.length > 0 ? `質問に必要な条件に一致: ${checks.map(labelFactCheck).join(", ")}` : `質問に必要な条件と一致せず: ${requiredChecks.map(labelFactCheck).join(", ")}`
    } satisfies SentenceAssessment
  })

  return selectAssessmentsForDebug(assessments)
}

function buildLowScoreAssessments(chunks: SelectedChunk[], minScore: number): SentenceAssessment[] {
  return selectAssessmentsForDebug(
    chunks.flatMap((chunk) =>
      splitSentences(chunk.metadata.text ?? "").map(
        (sentence): SentenceAssessment => ({
          status: "ng",
          sentence,
          fileName: chunk.metadata.fileName,
          chunkId: chunk.metadata.chunkId ?? chunk.key,
          score: chunk.score,
          checks: [],
          reason: `類似度 ${chunk.score.toFixed(4)} が minScore ${minScore.toFixed(4)} 未満`
        })
      )
    )
  )
}

function selectAssessmentsForDebug(assessments: SentenceAssessment[], maxItems = 12): SentenceAssessment[] {
  const ok = assessments.filter((assessment) => assessment.status === "ok")
  const ng = assessments.filter((assessment) => assessment.status === "ng")
  return [...ok.slice(0, maxItems), ...ng.slice(0, Math.max(0, maxItems - ok.length))].slice(0, maxItems)
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[。！？!?])\s*|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 24)
}

function matchesFactCheck(check: FactCheck, text: string): boolean {
  switch (check) {
    case "amount":
      return /[0-9０-９,]+円/.test(text)
    case "date":
      return /[0-9０-９]+(日|営業日|ヶ月|か月|月|年)/.test(text)
    case "procedure":
      return /(申請|手順|システム|フォーム|提出|承認)/.test(text)
    case "requirements_classification":
      return hasUsableRequirementsClassificationEvidence(text)
    case "retrieval_relevance":
      return text.length > 0
  }
}

function labelFactCheck(check: FactCheck): string {
  switch (check) {
    case "amount":
      return "金額"
    case "date":
      return "期限・日付"
    case "procedure":
      return "方法・手順"
    case "requirements_classification":
      return "要求分類"
    case "retrieval_relevance":
      return "検索選定"
  }
}
