import type { ChatResponse } from "../chat/types-api.js"
import type { HumanQuestion } from "../questions/types.js"

export type ConversationMessage = {
  messageId?: string
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponse
  questionTicket?: HumanQuestion
}

export const CONVERSATION_HISTORY_SCHEMA_VERSION = 2

export type ConversationHistorySchemaVersion = 1 | typeof CONVERSATION_HISTORY_SCHEMA_VERSION

export type ConversationHistoryItem = {
  schemaVersion: ConversationHistorySchemaVersion
  id: string
  title: string
  updatedAt: string
  isFavorite?: boolean
  messages: ConversationMessage[]
}
