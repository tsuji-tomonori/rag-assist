import type { Dependencies } from "../dependencies.js"
import type { Citation, DebugTrace, SearchScope } from "../types.js"
import type { Clarification } from "./state.js"
import type { SearchInput } from "../search/hybrid-search.js"

export type PublicClarification = Omit<Clarification, "rejectedOptions">

export type ConversationTurnInput = {
  role: "user" | "assistant"
  text: string
  turnId?: string
  citations?: Array<Partial<Citation>>
  createdAt?: string
}

export type ConversationHistoryTurn = ConversationTurnInput

export type ConversationInput = {
  conversationId: string
  turnId?: string
  turnIndex?: number
  turns: ConversationTurnInput[]
  turnDependency?: string
  state?: {
    activeEntities?: string[]
    activeDocuments?: string[]
    activeTopics?: string[]
    constraints?: string[]
  }
}

export type ChatInput = {
  question: string
  conversationHistory?: ConversationHistoryTurn[]
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
  conversation?: ConversationInput
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
  searchFilters?: SearchInput["filters"]
  searchScope?: SearchScope
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
  finalEvidence?: Citation[]
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
