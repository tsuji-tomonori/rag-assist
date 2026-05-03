import { useEffect, useRef, useState } from "react"
import { deleteConversationHistory, listConversationHistory, saveConversationHistory, type ConversationHistoryItem } from "../../../api.js"
import type { Message } from "../../chat/types.js"

export function useConversationHistory({ setError }: { setError: (error: string | null) => void }) {
  const [history, setHistory] = useState<ConversationHistoryItem[]>([])
  const [currentConversationId, setCurrentConversationId] = useState(() => createConversationId())
  const historyRef = useRef<ConversationHistoryItem[]>([])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  async function refreshHistory() {
    setHistory(await listConversationHistory())
  }

  function rememberConversation(item: ConversationHistoryItem) {
    const existing = historyRef.current.find((entry) => entry.id === item.id)
    const nextItem = { ...item, isFavorite: item.isFavorite ?? existing?.isFavorite ?? false }
    setHistory((prev) => [nextItem, ...prev.filter((entry) => entry.id !== nextItem.id)].sort(compareConversationHistory).slice(0, 20))
    saveConversationHistory(nextItem).catch((err) => console.warn("Failed to save conversation history", err))
  }

  function rememberMessages(id: string, titleCandidate: string, messages: Message[]) {
    const existingFavorite = historyRef.current.find((item) => item.id === id)?.isFavorite ?? false
    rememberConversation(buildConversationHistoryItem(id, titleCandidate, messages, existingFavorite))
  }

  function toggleFavorite(item: ConversationHistoryItem) {
    const nextItem = { ...item, isFavorite: !item.isFavorite }
    setHistory((prev) => [nextItem, ...prev.filter((entry) => entry.id !== nextItem.id)].sort(compareConversationHistory).slice(0, 20))
    saveConversationHistory(nextItem).catch((err) => {
      console.warn("Failed to update conversation favorite", err)
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  function deleteHistoryItem(id: string) {
    setHistory((prev) => prev.filter((entry) => entry.id !== id))
    deleteConversationHistory(id).catch((err) => {
      console.warn("Failed to delete conversation history", err)
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  return {
    history,
    setHistory,
    currentConversationId,
    setCurrentConversationId,
    refreshHistory,
    rememberConversation,
    rememberMessages,
    toggleFavorite,
    deleteHistoryItem,
    createConversationId
  }
}

function buildConversationHistoryItem(id: string, titleCandidate: string, messages: Message[], isFavorite = false): ConversationHistoryItem {
  return {
    schemaVersion: 1,
    id,
    title: summarizeTitle(titleCandidate),
    updatedAt: new Date().toISOString(),
    isFavorite,
    messages
  }
}

function compareConversationHistory(a: ConversationHistoryItem, b: ConversationHistoryItem): number {
  if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1
  return b.updatedAt.localeCompare(a.updatedAt)
}

function summarizeTitle(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= 36 ? trimmed : `${trimmed.slice(0, 36)}…`
}

function createConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
