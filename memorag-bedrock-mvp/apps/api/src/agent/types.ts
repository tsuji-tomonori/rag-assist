import type { Dependencies } from "../dependencies.js"
import type { Citation, DebugTrace } from "../types.js"

export type ChatInput = {
  question: string
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
}

export type QaGraphContext = {
  deps: Dependencies
}

export type QaGraphResult = {
  answer: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  debug?: DebugTrace
}

export type AnswerJson = {
  isAnswerable?: boolean
  answer?: string
  usedChunkIds?: string[]
}

export type ClueJson = {
  clues?: string[]
}
