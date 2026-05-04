import { del, get, post } from "../../../shared/api/http.js"
import type { ConversationHistoryItem } from "../types.js"

export async function listConversationHistory(): Promise<ConversationHistoryItem[]> {
  const result = await get<{ history?: ConversationHistoryItem[] }>("/conversation-history")
  return result.history ?? []
}

export async function saveConversationHistory(input: ConversationHistoryItem): Promise<ConversationHistoryItem> {
  return post<ConversationHistoryItem>("/conversation-history", input)
}

export async function deleteConversationHistory(id: string): Promise<void> {
  return del(`/conversation-history/${encodeURIComponent(id)}`)
}
