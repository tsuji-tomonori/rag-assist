import type { Dependencies } from "../dependencies.js"
import type { Citation, DebugTrace } from "../types.js"
import type { Clarification } from "./state.js"

export type PublicClarification = Omit<Clarification, "rejectedOptions">

export type ChatInput = {
  question: string
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
  modelId?: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  strictGrounded?: boolean
  includeDebug?: boolean
  debug?: boolean
  useMemory?: boolean
  maxIterations?: number
  asOfDate?: string
  asOfDateSource?: "benchmark" | "test"
}

export type QaGraphContext = {
  deps: Dependencies
}

export type QaGraphResult = {
  responseType: "answer" | "refusal" | "clarification"
  answer: string
  isAnswerable: boolean
  needsClarification?: boolean
  clarification?: PublicClarification
  citations: Citation[]
  retrieved: Citation[]
  debug?: DebugTrace
}

export type AnswerJson = {
  isAnswerable?: boolean
  answer?: string
  usedChunkIds?: string[]
  usedComputedFactIds?: string[]
}

export type ClueJson = {
  clues?: string[]
}
