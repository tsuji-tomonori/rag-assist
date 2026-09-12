import { ConversationHistoryItemSchema } from "@memorag-mvp/contract"
import { del, get, post } from "../../../shared/api/http.js"
import type { ConversationHistoryItem } from "../types.js"

export async function listConversationHistory(): Promise<ConversationHistoryItem[]> {
  const result = await get<{ history?: ConversationHistoryItem[] }>("/conversation-history")
  return (result.history ?? []).map((item) => ({ ...item, ...ConversationHistoryItemSchema.pick({ schemaVersion: true }).parse(item) }))
}

export async function saveConversationHistory(input: ConversationHistoryItem): Promise<ConversationHistoryItem> {
  ConversationHistoryItemSchema.pick({ schemaVersion: true }).parse(input)
  return post<ConversationHistoryItem>("/conversation-history", { ...input, schemaVersion: 3 })
}

export async function deleteConversationHistory(id: string): Promise<void> {
  return del(`/conversation-history/${encodeURIComponent(id)}`)
}
