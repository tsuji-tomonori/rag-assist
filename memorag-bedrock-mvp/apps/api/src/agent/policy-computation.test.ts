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

test("policy extraction facts validate quote, confidence, question match, and compute comparison deterministically", () => {
  const facts = policyExtractionToComputedFacts(extraction({
    questionAmountText: "5200円",
    quote: "1万円以上の経費精算では領収書の添付が必要です。",
    comparator: "gte",
    effect: "required"
  }), [chunk])

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
    quote: "1万円未満では不要です。",
    comparator: "lt",
    effect: "not_required"
  }), [chunk])
  assert.equal(notRequired[0]?.kind === "threshold_comparison" ? notRequired[0].satisfiesCondition : undefined, true)
  assert.equal(notRequired[0]?.kind === "threshold_comparison" ? notRequired[0].effect : undefined, "not_required")

  const eligible = policyExtractionToComputedFacts(extraction({
    questionAmountText: "5200円",
    quote: "1万円未満では不要です。",
    comparator: "lt",
    effect: "eligible"
  }), [chunk])
  assert.equal(eligible[0]?.kind === "threshold_comparison" ? eligible[0].effect : undefined, "eligible")
  assert.equal(eligible[0]?.kind === "threshold_comparison" ? eligible[0].polarity : undefined, undefined)
})

test("policy extraction discards unsafe or ambiguous candidates", () => {
  assert.equal(policyExtractionToComputedFacts(extraction({ quote: "資料にない引用です。" }), [chunk]).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ confidence: 0.7 }), [chunk]).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ matchesQuestion: false }), [chunk]).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ ambiguity: ["scope が不明"] }), [chunk]).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ effect: "unknown" }), [chunk]).length, 0)
  assert.equal(policyExtractionToComputedFacts(extraction({ thresholdText: "1万円", thresholdValue: 9000 }), [chunk]).length, 0)
})

test("policy extraction prompt keeps natural language extraction separate from deterministic comparison", () => {
  const prompt = buildPolicyComputationExtractionPrompt("5200円の経費精算では領収書いる?", [chunk])

  assert.match(prompt, /回答文は生成しない/)
  assert.match(prompt, /quote としてそのまま抜き出す/)
  assert.match(prompt, /一般知識を使わない/)
  assert.match(prompt, /複数条件がある場合は candidates にすべて出す/)
  assert.match(prompt, /曖昧、矛盾、比較不能なら canExtract=false/)
  assert.match(prompt, /数値比較の最終判定は行わない/)
})

function extraction(overrides: {
  questionAmountText?: string
  quote?: string
  comparator?: "gte" | "gt" | "lte" | "lt" | "eq"
  effect?: "required" | "not_required" | "allowed" | "not_allowed" | "eligible" | "not_eligible" | "unknown"
  confidence?: number
  matchesQuestion?: boolean
  ambiguity?: string[]
  thresholdText?: string
  thresholdValue?: number
} = {}): PolicyComputationExtraction {
  return {
    canExtract: true,
    reason: "test",
    questionTarget: {
      amountText: overrides.questionAmountText ?? "5200円",
      amountValue: 5200,
      currency: "JPY",
      subject: "経費精算",
      requestedEffect: "required",
      requestedObligation: "領収書の添付"
    },
    candidates: [
      {
        sourceChunkId: "chunk-0001",
        quote: overrides.quote ?? "1万円以上の経費精算では領収書の添付が必要です。",
        condition: {
          subject: "経費精算",
          leftQuantity: "経費精算の金額",
          comparator: overrides.comparator ?? "gte",
          thresholdText: overrides.thresholdText ?? "1万円",
          thresholdValue: overrides.thresholdValue ?? 10000,
          currency: "JPY"
        },
        consequence: {
          target: "領収書の添付",
          effect: overrides.effect ?? "required",
          naturalLanguage: "領収書の添付が必要"
        },
        matchesQuestion: overrides.matchesQuestion ?? true,
        confidence: overrides.confidence ?? 0.95,
        ambiguity: overrides.ambiguity ?? []
      }
    ]
  }
}
