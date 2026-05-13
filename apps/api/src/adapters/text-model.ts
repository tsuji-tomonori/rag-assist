export type GenerateOptions = {
  modelId?: string
  system?: string
  temperature?: number
  maxTokens?: number
}

export type EmbedOptions = {
  modelId?: string
  dimensions?: number
}

export interface TextModel {
  embed(text: string, options?: EmbedOptions): Promise<number[]>
  generate(prompt: string, options?: GenerateOptions): Promise<string>
}
