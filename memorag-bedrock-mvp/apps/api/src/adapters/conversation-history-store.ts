import type { ConversationHistoryItem } from "../types.js"

export type SaveConversationHistoryInput = ConversationHistoryItem

export interface ConversationHistoryStore {
  save(userId: string, input: SaveConversationHistoryInput): Promise<ConversationHistoryItem>
  list(userId: string): Promise<ConversationHistoryItem[]>
  delete(userId: string, id: string): Promise<void>
}
