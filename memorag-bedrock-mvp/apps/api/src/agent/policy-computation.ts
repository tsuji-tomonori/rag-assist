import { z } from "zod"
import type { RetrievedVector } from "../types.js"
import type { ComputedFact } from "./state.js"

const CONFIDENCE_THRESHOLD = 0.75

const EffectSchema = z.enum(["required", "not_required", "allowed", "not_allowed", "eligible", "not_eligible", "unknown"])

export const PolicyComputationExtractionSchema = z.object({
  canExtract: z.boolean(),
  reason: z.string().default(""),
  questionTarget: z
    .object({
      amountText: z.string().optional(),
      amountValue: z.number().optional(),
      currency: z.literal("JPY").optional(),
      subject: z.string().optional(),
      requestedEffect: z.string().optional(),
      requestedObligation: z.string().optional()
    })
    .optional(),
  candidates: z
    .array(
      z.object({
        sourceChunkId: z.string(),
        quote: z.string(),
        condition: z.object({
          subject: z.string(),
          leftQuantity: z.string(),
          conditionText: z.string(),
          comparator: z.enum(["gte", "gt", "lte", "lt", "eq"]),
          comparatorText: z.string(),
          thresholdText: z.string().optional(),
          thresholdValue: z.number().optional(),
          currency: z.literal("JPY")
        }),
        consequence: z.object({
          target: z.string(),
          targetText: z.string(),
          effect: EffectSchema,
          effectText: z.string(),
          naturalLanguage: z.string()
        }),
        matchesQuestion: z.boolean(),
        confidence: z.number().min(0).max(1),
        ambiguity: z.array(z.string()).default(() => [])
      })
    )
    .default(() => [])
})

export type PolicyComputationExtraction = z.infer<typeof PolicyComputationExtractionSchema>
type ThresholdFact = Extract<ComputedFact, { kind: "threshold_comparison" }>
type ConcreteEffect = Exclude<z.infer<typeof EffectSchema>, "unknown">

export function policyExtractionToComputedFacts(
  extraction: PolicyComputationExtraction,
  chunks: RetrievedVector[],
  question: string,
  confidenceThreshold = CONFIDENCE_THRESHOLD
): ComputedFact[] {
  if (!extraction.canExtract) return []
  const amountText = extraction.questionTarget?.amountText
  if (!amountText || !quoteExistsInText(amountText, question)) return []
  const questionAmount = normalizeJpyAmount(amountText, extraction.questionTarget?.amountValue)
  if (questionAmount === undefined || extraction.questionTarget?.currency !== "JPY") return []

  const facts = extraction.candidates.flatMap((candidate): ThresholdFact[] => {
    if (!candidate.matchesQuestion || candidate.confidence < confidenceThreshold || candidate.ambiguity.length > 0) return []
    if (candidate.consequence.effect === "unknown") return []

    const chunk = findChunkForQuote(candidate.sourceChunkId, candidate.quote, chunks)
    if (!chunk) return []

    const thresholdText = candidate.condition.thresholdText
    if (!thresholdText || !quoteExistsInText(thresholdText, candidate.quote)) return []
    const conditionText = candidate.condition.conditionText
    if (!quoteExistsInText(conditionText, candidate.quote)) return []
    if (!quoteExistsInText(thresholdText, conditionText)) return []
    const comparatorText = candidate.condition.comparatorText
    if (!comparatorText || !quoteExistsInText(comparatorText, candidate.quote)) return []
    if (!quoteExistsInText(comparatorText, conditionText)) return []
    if (!conditionHasAmountComparatorPair(conditionText, thresholdText, comparatorText)) return []
    if (operatorFromComparatorText(comparatorText) !== candidate.condition.comparator) return []
    if (!quoteExistsInText(candidate.consequence.targetText, candidate.quote)) return []
    if (!quoteExistsInText(candidate.consequence.effectText, candidate.quote)) return []
    if (effectFromEffectText(candidate.consequence.effectText) !== candidate.consequence.effect) return []
    const thresholdAmount = normalizeJpyAmount(thresholdText, candidate.condition.thresholdValue)
    if (thresholdAmount === undefined || candidate.condition.currency !== "JPY") return []

    const satisfiesCondition = compare(questionAmount, candidate.condition.comparator, thresholdAmount)
    const effect = candidate.consequence.effect
    return [
      {
        id: "threshold-000",
        kind: "threshold_comparison",
        source: "llm_policy_extraction",
        inputFactIds: [],
        sourceChunkId: chunk.key,
        questionAmount,
        thresholdAmount,
        operator: candidate.condition.comparator,
        satisfiesCondition,
        effect,
        polarity: polarityFromEffect(effect),
        subject: candidate.condition.subject || extraction.questionTarget?.subject || "金額条件",
        requirement: candidate.consequence.target || extraction.questionTarget?.requestedObligation || "条件",
        sourceText: candidate.quote,
        extractionConfidence: candidate.confidence,
        explanation: `${formatYen(questionAmount)}は${formatThreshold(candidate.condition.comparator, thresholdAmount)}${satisfiesCondition ? "に該当します" : "に該当しません"}。${formatEffect(effect, satisfiesCondition)}。根拠: ${candidate.quote}`
      }
    ]
  })

  return facts
    .sort((a, b) => Number(b.satisfiesCondition) - Number(a.satisfiesCondition) || b.extractionConfidence - a.extractionConfidence)
    .map((fact, index) => ({
      ...fact,
      id: `threshold-${String(index + 1).padStart(3, "0")}`
    }))
    .slice(0, 5)
}

export function parseJpyAmountText(text: string): number | undefined {
  const normalized = text.normalize("NFKC").replace(/，/g, ",").trim()
  const match = normalized.match(/^([0-9][0-9,]*(?:\.\d+)?)\s*(万円|千円|円)$/)
  if (!match?.[1] || !match[2]) return undefined
  const numeric = Number(match[1].replace(/,/g, ""))
  const multiplier = match[2] === "万円" ? 10_000 : match[2] === "千円" ? 1_000 : 1
  const value = numeric * multiplier
  return Number.isFinite(value) ? value : undefined
}

function normalizeJpyAmount(text: string | undefined, value: number | undefined): number | undefined {
  const parsedText = text ? parseJpyAmountText(text) : undefined
  const numericValue = value !== undefined && Number.isFinite(value) ? value : undefined
  if (parsedText !== undefined && numericValue !== undefined && Math.abs(parsedText - numericValue) > 0.0001) return undefined
  return parsedText ?? numericValue
}

function findChunkForQuote(sourceChunkId: string, quote: string, chunks: RetrievedVector[]): RetrievedVector | undefined {
  const exact = chunks.find((chunk) => chunk.key === sourceChunkId)
  if (exact && quoteExistsInChunk(quote, exact)) return exact
  return chunks.find((chunk) => chunk.metadata.chunkId === sourceChunkId && quoteExistsInChunk(quote, chunk))
}

function quoteExistsInChunk(quote: string, chunk: RetrievedVector): boolean {
  return quoteExistsInText(quote, chunk.metadata.text ?? "")
}

function quoteExistsInText(needle: string, haystack: string): boolean {
  const trimmedNeedle = needle.trim()
  if (!trimmedNeedle) return false
  return haystack.includes(trimmedNeedle) || haystack.normalize("NFKC").includes(trimmedNeedle.normalize("NFKC"))
}

function operatorFromComparatorText(text: string): ThresholdFact["operator"] | undefined {
  const normalized = text.normalize("NFKC").trim()
  const mapping: Array<[RegExp, ThresholdFact["operator"]]> = [
    [/^以上$/, "gte"],
    [/^超$/, "gt"],
    [/^より大きい$/, "gt"],
    [/^以下$/, "lte"],
    [/^未満$/, "lt"],
    [/^より小さい$/, "lt"],
    [/^(?:等しい|と等しい|同額)$/, "eq"]
  ]
  return mapping.find(([pattern]) => pattern.test(normalized))?.[1]
}

function effectFromEffectText(text: string): ConcreteEffect | undefined {
  const normalized = text.normalize("NFKC").trim()
  const mapping: Array<[RegExp, ConcreteEffect]> = [
    [/^(?:必要|必須|要)$/, "required"],
    [/^(?:不要|免除)$/, "not_required"],
    [/^(?:可能|可|できる|認められる)$/, "allowed"],
    [/^(?:不可|禁止|できない|認められない)$/, "not_allowed"],
    [/^(?:対象|該当)$/, "eligible"],
    [/^(?:対象外|非該当)$/, "not_eligible"]
  ]
  return mapping.find(([pattern]) => pattern.test(normalized))?.[1]
}

function conditionHasAmountComparatorPair(conditionText: string, amountText: string, comparatorText: string): boolean {
  const normalized = conditionText.normalize("NFKC").replace(/\s+/g, "")
  const amount = amountText.normalize("NFKC").replace(/\s+/g, "")
  const comparator = comparatorText.normalize("NFKC").replace(/\s+/g, "")
  return normalized.includes(`${amount}${comparator}`)
}

function compare(amount: number, operator: ThresholdFact["operator"], threshold: number): boolean {
  switch (operator) {
    case "gte":
      return amount >= threshold
    case "gt":
      return amount > threshold
    case "lte":
      return amount <= threshold
    case "lt":
      return amount < threshold
    case "eq":
      return amount === threshold
  }
}

function polarityFromEffect(effect: ConcreteEffect): ThresholdFact["polarity"] {
  if (effect === "required" || effect === "not_required") return effect
  return undefined
}

function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`
}

function formatThreshold(operator: ThresholdFact["operator"], amount: number): string {
  const suffix = operator === "gte" ? "以上" : operator === "gt" ? "超" : operator === "lte" ? "以下" : operator === "lt" ? "未満" : "と等しい"
  return `${formatYen(amount)}${suffix}`
}

function formatEffect(effect: ConcreteEffect, satisfiesCondition: boolean): string {
  const label = {
    required: "必要",
    not_required: "不要",
    allowed: "可能",
    not_allowed: "不可",
    eligible: "対象",
    not_eligible: "対象外"
  }[effect]
  return satisfiesCondition ? `資料上は${label}条件に該当します` : `資料上は${label}条件に該当しません`
}
