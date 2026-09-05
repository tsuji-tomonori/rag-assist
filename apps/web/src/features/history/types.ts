import type { ConversationHistoryItem as SharedConversationHistoryItem } from "@memorag-mvp/contract"
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

export type ConversationHistoryItem = Omit<SharedConversationHistoryItem, "messages" | "isFavorite"> & {
  isFavorite?: boolean
  messages: ConversationMessage[]
}
