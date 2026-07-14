import assert from "node:assert/strict"
import test from "node:test"
import { BedrockTextModel } from "./bedrock.js"

test("BedrockTextModel maps Titan embedding response variants and request options", async () => {
  const model = new BedrockTextModel()
  const commands: Array<{ constructor: { name: string }; input: Record<string, unknown> }> = []
  const responses = [
    { body: Buffer.from(JSON.stringify({ embedding: [1, "2", 3] })) },
    { body: Buffer.from(JSON.stringify({ embeddingsByType: { float: [4, 5] } })) }
  ]
  Object.assign(model, {
    client: {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        commands.push(command)
        return responses.shift()
      }
    }
  })

  assert.deepEqual(await model.embed("x".repeat(50_010), { modelId: "embed-test", dimensions: 256 }), [1, 2, 3])
  assert.deepEqual(await model.embed("fallback"), [4, 5])
  assert.equal(commands[0]?.constructor.name, "InvokeModelCommand")
  assert.equal(commands[0]?.input.modelId, "embed-test")
  const request = JSON.parse(Buffer.from(commands[0]?.input.body as Uint8Array).toString("utf8")) as Record<string, unknown>
  assert.equal((request.inputText as string).length, 50_000)
  assert.equal(request.dimensions, 256)
  assert.equal(request.normalize, true)
})

test("BedrockTextModel rejects an empty embedding and joins Converse text blocks", async () => {
  const model = new BedrockTextModel()
  const responses = [
    { body: Buffer.from("{}") },
    { output: { message: { content: [{ text: " first " }, { image: { format: "png" } }, { text: "second " }] } } }
  ]
  const commands: Array<{ constructor: { name: string }; input: Record<string, unknown> }> = []
  Object.assign(model, {
    client: {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        commands.push(command)
        return responses.shift()
      }
    }
  })

  await assert.rejects(() => model.embed("missing", { modelId: "empty-model" }), /empty-model.*vector/)
  assert.equal(await model.generate("prompt", {
    modelId: "generation-test",
    system: "system",
    maxTokens: 42,
    temperature: 0.25
  }), "first second")
  assert.equal(commands[1]?.constructor.name, "ConverseCommand")
  assert.deepEqual(commands[1]?.input.inferenceConfig, { maxTokens: 42, temperature: 0.25 })
  assert.deepEqual(commands[1]?.input.system, [{ text: "system" }])
})
