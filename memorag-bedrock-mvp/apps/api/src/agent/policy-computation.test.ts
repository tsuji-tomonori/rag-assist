import assert from "node:assert/strict"
import test from "node:test"
import { buildPolicyComputationExtractionPrompt } from "../rag/prompts.js"
import { policyExtractionToComputedFacts, type PolicyComputationExtraction } from "./policy-computation.js"
import type { RetrievedVector } from "../types.js"

const chunk: RetrievedVector = {
  key: "doc-1-chunk-0001",
  score: 0.9,
  metadata: {
    kind: "chunk",
    documentId: "doc-1",
    fileName: "handbook.md",
    chunkId: "chunk-0001",
    text: "1万円以上の経費精算では領収書の添付が必要です。1万円未満では不要です。",
    createdAt: "2026-05-01T00:00:00.000Z"
  }
}
const question = "5200円の経費精算では領収書いる?"

test("policy extraction facts validate quote, confidence, question match, and compute comparison deterministically", () => {
  const facts = policyExtractionToComputedFacts(extraction({
    questionAmountText: "5200円",
    quote: "1万円以上の経費精算では領収書の添付が必要です。",
    comparator: "gte",
    effect: "required"
  }), [chunk], question)

  assert.equal(facts[0]?.kind, "threshold_comparison")
  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].source : undefined, "llm_policy_extraction")
  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].questionAmount : undefined, 5200)
  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].thresholdAmount : undefined, 10000)
  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].operator : undefined, "gte")
  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].satisfiesCondition : undefined, false)
  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].effect : undefined, "required")
  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].polarity : undefined, "required")
})

test("policy extraction supports not-required true and additional effects", () => {
  const notRequired = policyExtractionToComputedFacts(extraction({
    questionAmountText: "5200円",
    quote: "1万円以上の経費精算では領収書の添付が必要です。1万円未満では不要です。",
    comparator: "lt",
    effect: "not_required"
  }), [chunk], question)
  assert.equal(notRequired[0]?.kind === "threshold_comparison" ? notRequired[0].satisfiesCondition : undefined, true)
  assert.equal(notRequired[0]?.kind === "threshold_comparison" ? notRequired[0].effect : undefined, "not_required")

  const eligibleChunk: RetrievedVector = {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      text: "1万円未満の経費精算は領収書確認の対象です。"
    }
  }
  const eligible = policyExtractionToComputedFacts(extraction({
    questionAmountText: "5200円",
    quote: "1万円未満の経費精算は領収書確認の対象です。",
    comparator: "lt",
    effect: "eligible",
    target: "領収書確認",
    targetText: "領収書",
    effectText: "対象"
  }), [eligibleChunk], question)
  assert.equal(eligible[0]?.kind === "threshold_comparison" ? eligible[0].effect : undefined, "eligible")
  assert.equal(eligible[0]?.kind === "threshold_comparison" ? eligible[0].polarity : undefined, undefined)

  const allowedChunk: RetrievedVector = {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      text: "1万円以上の経費精算では領収書の省略が可能です。"
    }
  }
  const allowedFalse = policyExtractionToComputedFacts(extraction({
    questionAmountText: "5200円",
    quote: "1万円以上の経費精算では領収書の省略が可能です。",
    comparator: "gte",
    effect: "allowed",
    target: "領収書の省略",
    targetText: "領収書",
    effectText: "可能"
  }), [allowedChunk], question)
  assert.match(allowedFalse[0]?.kind === "threshold_comparison" ? allowedFalse[0].explanation : "", /可能条件に該当しません/)
})

test("policy extraction discards unsafe or ambiguous candidates", () => {
  assert.equal(policyExtractionToComputedFacts(extraction({ quote: "資料にない引用です。" }), [chunk], question).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ confidence: 0.7 }), [chunk], question).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ matchesQuestion: false }), [chunk], question).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ ambiguity: ["scope が不明"] }), [chunk], question).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ effect: "unknown" }), [chunk], question).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ thresholdText: "1万円", thresholdValue: 9000 }), [chunk], question).length, 0)
})

test("policy extraction requires amount and threshold text provenance", () => {
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        questionAmountText: "12000円",
        questionAmountValue: 12000
      }),
      [chunk],
      question
    ).length,
    0
  )
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        quote: "1万円以上の経費精算では領収書の添付が必要です。",
        thresholdText: "5千円",
        thresholdValue: 5000
      }),
      [chunk],
      question
    ).length,
    0
  )
})

test("policy extraction requires comparator and consequence provenance", () => {
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        quote: "1万円以上の経費精算では領収書の添付が必要です。",
        comparator: "lt",
        comparatorText: "以上",
        thresholdText: "1万円",
        thresholdValue: 10000
      }),
      [chunk],
      question
    ).length,
    0
  )
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        quote: "1万円以上の経費精算では領収書の添付が必要です。",
        comparatorText: "未満"
      }),
      [chunk],
      question
    ).length,
    0
  )
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        quote: "1万円以上の経費精算では承認が必要です。",
        target: "領収書の添付",
        targetText: "領収書",
        effectText: "必要"
      }),
      [{
        ...chunk,
        metadata: {
          ...chunk.metadata,
          text: "1万円以上の経費精算では承認が必要です。"
        }
      }],
      "60000円の経費精算では領収書いる?"
    ).length,
    0
  )
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        quote: "1万円以上の経費精算では領収書の添付が必要です。",
        effectText: "不要"
      }),
      [chunk],
      question
    ).length,
    0
  )
})

test("policy extraction requires condition span and effect enum consistency", () => {
  const mixedConditionQuote = "1万円以上の経費精算では承認が必要で、5万円未満では領収書の添付は不要です。"
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        questionAmountText: "30000円",
        questionAmountValue: 30000,
        quote: mixedConditionQuote,
        conditionText: mixedConditionQuote,
        comparator: "lt",
        comparatorText: "未満",
        thresholdText: "1万円",
        thresholdValue: 10000,
        effect: "not_required",
        effectText: "不要"
      }),
      [{
        ...chunk,
        metadata: {
          ...chunk.metadata,
          text: mixedConditionQuote
        }
      }],
      "30000円の経費精算では領収書いる?"
    ).length,
    0
  )

  const mixedEffectQuote = "1万円以上では領収書が必要で、1万円未満では不要です。"
  assert.equal(
    policyExtractionToComputedFacts(
      extraction({
        quote: mixedEffectQuote,
        conditionText: "1万円以上",
        effect: "required",
        effectText: "不要"
      }),
      [{
        ...chunk,
        metadata: {
          ...chunk.metadata,
          text: mixedEffectQuote
        }
      }],
      question
    ).length,
    0
  )
})

test("policy extraction resolves duplicate chunk ids by quote-bearing chunk", () => {
  const first: RetrievedVector = {
    ...chunk,
    key: "doc-a-chunk-0001",
    metadata: {
      ...chunk.metadata,
      documentId: "doc-a",
      text: "5千円以上の社内備品では承認が必要です。"
    }
  }
  const second: RetrievedVector = {
    ...chunk,
    key: "doc-b-chunk-0001",
    metadata: {
      ...chunk.metadata,
      documentId: "doc-b"
    }
  }
  const facts = policyExtractionToComputedFacts(extraction({ sourceChunkId: "chunk-0001" }), [first, second], question)

  assert.equal(facts[0]?.kind === "threshold_comparison" ? facts[0].sourceChunkId : undefined, "doc-b-chunk-0001")
})

test("policy extraction prompt keeps natural language extraction separate from deterministic comparison", () => {
  const prompt = buildPolicyComputationExtractionPrompt("5200円の経費精算では領収書いる?", [chunk])

  assert.match(prompt, /回答文は生成しない/)
  assert.match(prompt, /quote としてそのまま抜き出す/)
  assert.match(prompt, /一般知識を使わない/)
  assert.match(prompt, /複数条件がある場合は candidates にすべて出す/)
  assert.match(prompt, /曖昧、矛盾、比較不能なら canExtract=false/)
  assert.match(prompt, /数値比較の最終判定は行わない/)
  assert.match(prompt, /sourceChunkId には <chunk id="..."> の id 属性値だけを入れる/)
  assert.match(prompt, /questionTarget\.amountText は質問中に実在する金額表記/)
  assert.match(prompt, /condition\.thresholdText は quote 中に実在する閾値金額表記/)
  assert.match(prompt, /condition\.conditionText は quote 中に実在する条件表現/)
  assert.match(prompt, /thresholdText と comparatorText を同じ条件として含める/)
  assert.match(prompt, /condition\.comparatorText は quote 中に実在する比較表現/)
  assert.match(prompt, /comparator enum と直接対応する最小表現/)
  assert.match(prompt, /consequence\.targetText と consequence\.effectText は quote 中に実在する表現/)
  assert.match(prompt, /consequence\.effectText は effect enum と直接対応する最小表現/)
})

function extraction(overrides: {
  questionAmountText?: string
  quote?: string
  conditionText?: string
  comparator?: "gte" | "gt" | "lte" | "lt" | "eq"
  comparatorText?: string
  effect?: "required" | "not_required" | "allowed" | "not_allowed" | "eligible" | "not_eligible" | "unknown"
  effectText?: string
  target?: string
  targetText?: string
  confidence?: number
  matchesQuestion?: boolean
  ambiguity?: string[]
  thresholdText?: string
  thresholdValue?: number
  questionAmountValue?: number
  sourceChunkId?: string
} = {}): PolicyComputationExtraction {
  return {
    canExtract: true,
    reason: "test",
    questionTarget: {
      amountText: overrides.questionAmountText ?? "5200円",
      amountValue: overrides.questionAmountValue ?? 5200,
      currency: "JPY",
      subject: "経費精算",
      requestedEffect: "required",
      requestedObligation: "領収書の添付"
    },
    candidates: [
      {
        sourceChunkId: overrides.sourceChunkId ?? "chunk-0001",
        quote: overrides.quote ?? "1万円以上の経費精算では領収書の添付が必要です。",
        condition: {
          subject: "経費精算",
          leftQuantity: "経費精算の金額",
          comparator: overrides.comparator ?? "gte",
          comparatorText: overrides.comparatorText ?? comparatorText(overrides.comparator ?? "gte"),
          conditionText: overrides.conditionText ?? `${overrides.thresholdText ?? "1万円"}${overrides.comparatorText ?? comparatorText(overrides.comparator ?? "gte")}`,
          thresholdText: overrides.thresholdText ?? "1万円",
          thresholdValue: overrides.thresholdValue ?? 10000,
          currency: "JPY"
        },
        consequence: {
          target: overrides.target ?? "領収書の添付",
          targetText: overrides.targetText ?? "領収書",
          effect: overrides.effect ?? "required",
          effectText: overrides.effectText ?? effectText(overrides.effect ?? "required"),
          naturalLanguage: "領収書の添付が必要"
        },
        matchesQuestion: overrides.matchesQuestion ?? true,
        confidence: overrides.confidence ?? 0.95,
        ambiguity: overrides.ambiguity ?? []
      }
    ]
  }
}

function comparatorText(comparator: "gte" | "gt" | "lte" | "lt" | "eq"): string {
  return {
    gte: "以上",
    gt: "超",
    lte: "以下",
    lt: "未満",
    eq: "等しい"
  }[comparator]
}

function effectText(effect: "required" | "not_required" | "allowed" | "not_allowed" | "eligible" | "not_eligible" | "unknown"): string {
  return {
    required: "必要",
    not_required: "不要",
    allowed: "可能",
    not_allowed: "不可",
    eligible: "対象",
    not_eligible: "対象外",
    unknown: "不明"
  }[effect]
}
