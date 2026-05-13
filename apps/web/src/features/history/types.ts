import type { ChatResponse } from "../chat/types-api.js"
import type { HumanQuestion } from "../questions/types.js"

export type ConversationMessage = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponse
  questionTicket?: HumanQuestion
}

export type ConversationHistoryItem = {
  schemaVersion: 1
  id: string
  title: string
  updatedAt: string
  isFavorite?: boolean
  messages: ConversationMessage[]
}
