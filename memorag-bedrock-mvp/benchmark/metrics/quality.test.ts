import assert from "node:assert/strict"
import test from "node:test"
import { assertComparableProfiles, defaultEvaluatorProfile, profileKey } from "../evaluator-profile.js"
import { cjkBigramTokenizer, compareTokenizers, createQualityReview, detectRegressions, whitespaceTokenizer } from "./quality.js"

test("detectRegressions flags metric drops and latency increases", () => {
  const regressions = detectRegressions(
    { answerableAccuracy: 0.86, retrievalRecallAt20: 0.7, p95LatencyMs: 18000 },
    { answerableAccuracy: 0.9, retrievalRecallAt20: 0.78, p95LatencyMs: 16000 },
    { answerableAccuracy: 0.03, retrievalRecallAt20: 0.03, p95LatencyMs: 1000 }
  )

  assert.deepEqual(regressions.map((item) => item.metric).sort(), ["answerableAccuracy", "p95LatencyMs", "retrievalRecallAt20"])
})

test("createQualityReview proposes alias candidates from benchmark failures", () => {
  const review = createQualityReview({
    current: { retrievalRecallAt20: 0.75 },
    baseline: { retrievalRecallAt20: 0.8 },
    failures: [
      {
        id: "row-1",
        question: "PTO の申請期限は？",
        reasons: ["retrieval_recall_at_20_miss"],
        expectedContains: ["年次有給休暇 申請期限 3営業日前"]
      }
    ]
  })

  assert.equal(review.status, "regressed")
  assert.equal(review.aliasCandidates[0]?.term, "pto")
  assert.ok(review.aliasCandidates[0]?.expansions.includes("年次有給休暇"))
})

test("compareTokenizers reports token counts and overlap for tokenizer candidates", () => {
  const result = compareTokenizers("申請承認 Workflow", [
    { name: "whitespace", tokenize: whitespaceTokenizer },
    { name: "cjk_bigram", tokenize: cjkBigramTokenizer }
  ])

  assert.equal(result.tokenizers[0]?.name, "whitespace")
  assert.ok((result.tokenizers.find((row) => row.name === "cjk_bigram")?.tokenCount ?? 0) > 2)
  assert.equal(result.overlap[0]?.left, "whitespace")
  assert.equal(result.overlap[0]?.right, "cjk_bigram")
})

test("evaluator profile comparison rejects mismatched baselines by default", () => {
  assert.equal(profileKey(defaultEvaluatorProfile), "default@1")
  assert.throws(
    () => assertComparableProfiles(defaultEvaluatorProfile, { evaluatorProfile: { id: "custom", version: "1" } }, false),
    /differs from current/
  )
  assert.match(
    assertComparableProfiles(defaultEvaluatorProfile, { evaluatorProfile: { id: "custom", version: "1" } }, true) ?? "",
    /reference comparison/
  )
})
