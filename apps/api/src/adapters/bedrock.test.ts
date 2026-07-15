import assert from "node:assert/strict"
import test from "node:test"
import { BedrockTextModel } from "./bedrock.js"
import type { TextModelTokenUsage } from "./text-model.js"

test("bedrock exposes provider embedding and generation quantities", async () => {
  const responses = [
    { body: Buffer.from(JSON.stringify({ embeddingsByType: { float: [0.1] }, inputTextTokenCount: 17 })) },
    { usage: { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 30, cacheWriteInputTokens: 10 }, output: { message: { content: [{ text: "回答" }] } } }
  ]
  const model = new BedrockTextModel({ send: async () => responses.shift() as never } as never)
  const usage: TextModelTokenUsage[] = []
  await model.embed("query", { onUsage: (item) => usage.push(item) })
  await model.generate("prompt", { onUsage: (item) => usage.push(item) })
  assert.deepEqual(usage, [
    { inputTokens: 17, outputTokens: 0 },
    { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 10 }
  ])
})
