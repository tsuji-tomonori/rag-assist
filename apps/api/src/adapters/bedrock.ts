import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime"
import { config } from "../config.js"
import type { EmbedOptions, GenerateOptions, TextModel } from "./text-model.js"

type BedrockRuntimeClientLike = Pick<BedrockRuntimeClient, "send">

export class BedrockTextModel implements TextModel {
  constructor(private readonly client: BedrockRuntimeClientLike = new BedrockRuntimeClient({ region: config.region })) {}

  async embed(text: string, options: EmbedOptions = {}): Promise<number[]> {
    const modelId = options.modelId ?? config.embeddingModelId
    const dimensions = options.dimensions ?? config.embeddingDimensions

    const body = JSON.stringify({
      inputText: text.slice(0, 50_000),
      dimensions,
      normalize: true,
      embeddingTypes: ["float"]
    })

    const response = await this.client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: Buffer.from(body)
      })
    )

    const payload = JSON.parse(Buffer.from(response.body ?? new Uint8Array()).toString("utf-8")) as {
      embedding?: number[]
      embeddingsByType?: { float?: number[] }
      inputTextTokenCount?: number
    }
    options.onUsage?.({ inputTokens: payload.inputTextTokenCount, outputTokens: 0 })

    const vector = payload.embedding ?? payload.embeddingsByType?.float
    if (!vector?.length) {
      throw new Error(`Embedding response from ${modelId} did not contain a vector`)
    }
    return vector.map((v) => Number(v))
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const modelId = options.modelId ?? config.defaultModelId
    const response = await this.client.send(
      new ConverseCommand({
        modelId,
        system: options.system ? [{ text: options.system }] : undefined,
        messages: [
          {
            role: "user",
            content: [{ text: prompt }]
          }
        ],
        inferenceConfig: {
          maxTokens: options.maxTokens ?? 1200,
          temperature: options.temperature ?? 0.0
        }
      })
    )
    options.onUsage?.({
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
      cacheReadTokens: response.usage?.cacheReadInputTokens,
      cacheWriteTokens: response.usage?.cacheWriteInputTokens
    })

    return (
      response.output?.message?.content
        ?.map((block) => ("text" in block && block.text ? block.text : ""))
        .join("")
        .trim() ?? ""
    )
  }
}
