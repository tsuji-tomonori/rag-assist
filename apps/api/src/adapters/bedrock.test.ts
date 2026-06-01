import assert from "node:assert/strict"
import test from "node:test"
import { ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"

import { BedrockTextModel } from "./bedrock.js"
import type { TextModelTokenUsage } from "./text-model.js"

test("bedrock text model reports embedding provider usage", async () => {
  const sent: unknown[] = []
  const model = new BedrockTextModel({
    send: async (command: unknown) => {
      sent.push(command)
      return {
        body: Buffer.from(JSON.stringify({
          embeddingsByType: { float: [0.1, 0.2] },
          inputTextTokenCount: 17
        }))
      }
    }
  } as never)
  const usage: TextModelTokenUsage[] = []

  const vector = await model.embed("検索クエリ", {
    modelId: "embed-model",
    dimensions: 2,
    onUsage: (event) => usage.push(event)
  })

  assert.ok(sent[0] instanceof InvokeModelCommand)
  assert.deepEqual(vector, [0.1, 0.2])
  assert.deepEqual(usage, [{ inputTokens: 17, outputTokens: 0 }])
})

test("bedrock text model reports converse provider usage", async () => {
  const sent: unknown[] = []
  const model = new BedrockTextModel({
    send: async (command: unknown) => {
      sent.push(command)
      return {
        usage: { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 30, cacheWriteInputTokens: 10 },
        output: { message: { content: [{ text: "回答" }] } }
      }
    }
  } as never)
  const usage: TextModelTokenUsage[] = []

  const output = await model.generate("質問", {
    modelId: "model-a",
    onUsage: (event) => usage.push(event)
  })

  assert.ok(sent[0] instanceof ConverseCommand)
  assert.equal(output, "回答")
  assert.deepEqual(usage, [{ inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 10 }])
})
