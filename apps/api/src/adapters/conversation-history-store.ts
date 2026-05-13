import type { ConversationHistoryItem } from "../types.js"

export type SaveConversationHistoryInput =
  Omit<ConversationHistoryItem, "schemaVersion"> & Partial<Pick<ConversationHistoryItem, "schemaVersion">>

export interface ConversationHistoryStore {
  save(userId: string, input: SaveConversationHistoryInput): Promise<ConversationHistoryItem>
  list(userId: string): Promise<ConversationHistoryItem[]>
  delete(userId: string, id: string): Promise<void>
}
