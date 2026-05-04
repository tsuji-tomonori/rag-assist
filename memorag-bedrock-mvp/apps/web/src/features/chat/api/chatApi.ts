import { post } from "../../../shared/api/http.js"
import type { ChatResponse } from "../types-api.js"

export async function chat(input: {
  question: string
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
  modelId: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  minScore?: number
  includeDebug?: boolean
}): Promise<ChatResponse> {
  return post<ChatResponse>("/chat", input)
}
