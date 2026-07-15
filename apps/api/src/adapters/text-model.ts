export type GenerateOptions = {
  modelId?: string
  system?: string
  temperature?: number
  maxTokens?: number
  usageTask?: "clue" | "finalAnswer" | "sufficientContext" | "retrievalJudge" | "answerSupport" | "answerRepair" | "memoryCard"
  onUsage?: (usage: TextModelTokenUsage) => void
}

export type EmbedOptions = {
  modelId?: string
  dimensions?: number
  onUsage?: (usage: TextModelTokenUsage) => void
}

export type TextModelTokenUsage = {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface TextModel {
  embed(text: string, options?: EmbedOptions): Promise<number[]>
  generate(prompt: string, options?: GenerateOptions): Promise<string>
}
