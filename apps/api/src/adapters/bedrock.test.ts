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

test("bedrock streams only when first-token observation is requested", async () => {
  async function* stream() {
    yield { contentBlockDelta: { delta: { text: "" } } }
    yield { contentBlockDelta: { delta: { text: "回" } } }
    yield { contentBlockDelta: { delta: { text: "答" } } }
    yield { metadata: { usage: { inputTokens: 10, outputTokens: 2 } } }
  }
  const commands: string[] = []
  const model = new BedrockTextModel({
    send: async (command: object) => {
      commands.push(command.constructor.name)
      return { stream: stream() } as never
    }
  } as never)
  let firstTokenCount = 0
  const usage: TextModelTokenUsage[] = []

  const answer = await model.generate("prompt", {
    onFirstToken: () => { firstTokenCount += 1 },
    onUsage: (item) => usage.push(item)
  })

  assert.equal(answer, "回答")
  assert.equal(firstTokenCount, 1)
  assert.deepEqual(commands, ["ConverseStreamCommand"])
  assert.deepEqual(usage, [{ inputTokens: 10, outputTokens: 2, cacheReadTokens: undefined, cacheWriteTokens: undefined }])
})

test("bedrock does not report a first token for an empty stream", async () => {
  async function* stream() {
    yield { contentBlockDelta: { delta: { text: "" } } }
  }
  const model = new BedrockTextModel({ send: async () => ({ stream: stream() }) as never } as never)
  let firstTokenCount = 0
  assert.equal(await model.generate("prompt", { onFirstToken: () => { firstTokenCount += 1 } }), "")
  assert.equal(firstTokenCount, 0)
})

test("bedrock fails a partial stream instead of returning partial answer text", async () => {
  async function* stream() {
    yield { contentBlockDelta: { delta: { text: "partial" } } }
    yield { modelStreamErrorException: { name: "ModelStreamErrorException", message: "stream failed" } }
  }
  const model = new BedrockTextModel({ send: async () => ({ stream: stream() }) as never } as never)
  await assert.rejects(() => model.generate("prompt", { onFirstToken: () => undefined }), /stream failed/)
})
