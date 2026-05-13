import { useCallback, useEffect, useRef, useState } from "react"
import { deleteConversationHistory, listConversationHistory, saveConversationHistory } from "../api/conversationHistoryApi.js"
import type { ConversationHistoryItem } from "../types.js"
import type { Message } from "../../chat/types.js"
import type { HumanQuestion } from "../../questions/types.js"

export function useConversationHistory({ setError }: { setError: (error: string | null) => void }) {
  const [history, setHistory] = useState<ConversationHistoryItem[]>([])
  const [currentConversationId, setCurrentConversationId] = useState(() => createConversationId())
  const historyRef = useRef<ConversationHistoryItem[]>([])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  const refreshHistory = useCallback(async () => {
    setHistory(await listConversationHistory())
  }, [])

  const rememberConversation = useCallback((item: ConversationHistoryItem) => {
    const existing = historyRef.current.find((entry) => entry.id === item.id)
    const nextItem = { ...item, isFavorite: item.isFavorite ?? existing?.isFavorite ?? false }
    setHistory((prev) => [nextItem, ...prev.filter((entry) => entry.id !== nextItem.id)].sort(compareConversationHistory).slice(0, 20))
    saveConversationHistory(nextItem).catch((err) => console.warn("Failed to save conversation history", err))
  }, [])

  const rememberMessages = useCallback((id: string, titleCandidate: string, messages: Message[]) => {
    const existingFavorite = historyRef.current.find((item) => item.id === id)?.isFavorite ?? false
    rememberConversation(buildConversationHistoryItem(id, titleCandidate, messages, existingFavorite))
  }, [rememberConversation])

  const toggleFavorite = useCallback((item: ConversationHistoryItem) => {
    const nextItem = { ...item, isFavorite: !item.isFavorite }
    setHistory((prev) => [nextItem, ...prev.filter((entry) => entry.id !== nextItem.id)].sort(compareConversationHistory).slice(0, 20))
    saveConversationHistory(nextItem).catch((err) => {
      console.warn("Failed to update conversation favorite", err)
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [setError])

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id))
    deleteConversationHistory(id).catch((err) => {
      console.warn("Failed to delete conversation history", err)
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [setError])

  const updateHistoryQuestionTickets = useCallback((updatedQuestions: HumanQuestion[]) => {
    if (updatedQuestions.length === 0) return
    const byId = new Map(updatedQuestions.map((questionItem) => [questionItem.questionId, questionItem]))
    const changedItems: ConversationHistoryItem[] = []
    const nextHistory = historyRef.current.map((item) => {
      let changed = false
      const messages = item.messages.map((message) => {
        const questionId = message.questionTicket?.questionId
        const updated = questionId ? byId.get(questionId) : undefined
        if (!updated || message.questionTicket?.updatedAt === updated.updatedAt) return message
        changed = true
        return { ...message, questionTicket: updated }
      })
      if (!changed) return item
      const nextItem = { ...item, messages }
      changedItems.push(nextItem)
      return nextItem
    })
    if (changedItems.length === 0) return
    historyRef.current = nextHistory
    setHistory(nextHistory)
    for (const item of changedItems) {
      saveConversationHistory(item).catch((err) => console.warn("Failed to save refreshed conversation history", err))
    }
  }, [])

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
    updateHistoryQuestionTickets,
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
