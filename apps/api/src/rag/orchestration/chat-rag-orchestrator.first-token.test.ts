import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import test from "node:test"
import type { TextModel } from "../../adapters/text-model.js"
import { observeAnswerFirstToken } from "./chat-rag-orchestrator.js"

test("first-token evidence ignores a failed attempt and records the successful retry", async () => {
  let attempt = 0
  const inner: TextModel = {
    embed: async () => [],
    generate: async (_prompt, options) => {
      attempt += 1
      options?.onFirstToken?.()
      if (attempt === 1) throw new Error("partial stream failed")
      return "grounded answer"
    }
  }
  const observer = observeAnswerFirstToken(inner, performance.now())

  await assert.rejects(
    () => observer.textModel.generate("first", { usageTask: "finalAnswer" }),
    /partial stream failed/
  )
  assert.equal(observer.evidence(true).status, "unavailable")

  assert.equal(
    await observer.textModel.generate("retry", { usageTask: "answerRepair" }),
    "grounded answer"
  )
  const evidence = observer.evidence(true)
  assert.equal(evidence.status, "measured")
  if (evidence.status === "measured") {
    assert.equal(evidence.attemptOrdinal, 2)
    assert.ok(typeof evidence.latencyMs === "number" && evidence.latencyMs >= 0)
  }
})
