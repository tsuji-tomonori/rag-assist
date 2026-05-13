import { type Dispatch, type SetStateAction, useCallback, useState } from "react"
import { answerQuestion, createQuestion, getQuestion, listQuestions, resolveQuestion } from "../api/questionsApi.js"
import type { HumanQuestion } from "../types.js"
import type { Message } from "../../chat/types.js"

export function useQuestions({
  canAnswerQuestions,
  setMessages,
  setLoading,
  setError
}: {
  canAnswerQuestions: boolean
  setMessages: Dispatch<SetStateAction<Message[]>>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [questions, setQuestions] = useState<HumanQuestion[]>([])
  const [selectedQuestionId, setSelectedQuestionId] = useState("")

  const mergeQuestions = useCallback((updatedQuestions: HumanQuestion[]) => {
    if (updatedQuestions.length === 0) return
    setQuestions((prev) => {
      const byId = new Map(prev.map((questionItem) => [questionItem.questionId, questionItem]))
      for (const questionItem of updatedQuestions) byId.set(questionItem.questionId, questionItem)
      return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    })
  }, [])

  const updateMessageTickets = useCallback((updatedQuestions: HumanQuestion[]) => {
    if (updatedQuestions.length === 0) return
    const byId = new Map(updatedQuestions.map((questionItem) => [questionItem.questionId, questionItem]))
    setMessages((prev) => {
      let changed = false
      const nextMessages = prev.map((item) => {
        const questionId = item.questionTicket?.questionId
        const updated = questionId ? byId.get(questionId) : undefined
        if (!updated || item.questionTicket?.updatedAt === updated.updatedAt) return item
        changed = true
        return { ...item, questionTicket: updated }
      })
      return changed ? nextMessages : prev
    })
  }, [setMessages])

  const refreshQuestions = useCallback(async () => {
    const nextQuestions = await listQuestions()
    setQuestions(nextQuestions)
    setSelectedQuestionId((current) => {
      if (current && nextQuestions.some((questionItem) => questionItem.questionId === current)) return current
      return nextQuestions[0]?.questionId ?? ""
    })
  }, [])

  const refreshQuestionTickets = useCallback(async (questionIds: string[]) => {
    const uniqueIds = [...new Set(questionIds)].filter(Boolean)
    if (uniqueIds.length === 0) return []

    const results = await Promise.all(
      uniqueIds.map(async (questionId) => {
        try {
          return await getQuestion(questionId)
        } catch (err) {
          console.warn("Failed to refresh linked question", questionId, err)
          return undefined
        }
      })
    )
    const updatedQuestions = results.filter((questionItem): questionItem is HumanQuestion => Boolean(questionItem?.questionId))
    mergeQuestions(updatedQuestions)
    return updatedQuestions
  }, [mergeQuestions])

  const refreshLinkedQuestions = useCallback(async (messages: Message[]) => {
    const questionIds = messages
      .map((item) => item.questionTicket)
      .filter((questionTicket): questionTicket is HumanQuestion => Boolean(questionTicket?.questionId))
      .filter((questionTicket) => questionTicket.status !== "resolved")
      .map((questionTicket) => questionTicket.questionId)
    const updatedQuestions = await refreshQuestionTickets(questionIds)
    updateMessageTickets(updatedQuestions)
    return updatedQuestions
  }, [refreshQuestionTickets, updateMessageTickets])

  async function onCreateQuestion(messageIndex: number, message: Message, input: Parameters<typeof createQuestion>[0]) {
    setLoading(true)
    setError(null)
    try {
      const questionTicket = await createQuestion(input)
      setMessages((prev) => prev.map((item, index) => (index === messageIndex ? { ...item, questionTicket } : item)))
      setQuestions((prev) =>
        prev.some((questionItem) => questionItem.questionId === questionTicket.questionId) ? prev : [questionTicket, ...prev]
      )
      setSelectedQuestionId(questionTicket.questionId)
      if (canAnswerQuestions) {
        await refreshQuestions().catch((err) => console.warn("Failed to refresh questions after escalation", err))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onAnswerQuestion(questionId: string, input: Parameters<typeof answerQuestion>[1]) {
    setLoading(true)
    setError(null)
    try {
      const answered = await answerQuestion(questionId, input)
      setQuestions((prev) => [answered, ...prev.filter((questionItem) => questionItem.questionId !== answered.questionId)])
      setMessages((prev) =>
        prev.map((item) => (item.questionTicket?.questionId === answered.questionId ? { ...item, questionTicket: answered } : item))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onResolveQuestion(questionId: string) {
    setLoading(true)
    setError(null)
    try {
      const resolved = await resolveQuestion(questionId)
      setQuestions((prev) => [resolved, ...prev.filter((questionItem) => questionItem.questionId !== resolved.questionId)])
      setMessages((prev) =>
        prev.map((item) => (item.questionTicket?.questionId === resolved.questionId ? { ...item, questionTicket: resolved } : item))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return {
    questions,
    selectedQuestionId,
    setQuestions,
    setSelectedQuestionId,
    refreshQuestions,
    refreshQuestionTickets,
    refreshLinkedQuestions,
    onCreateQuestion,
    onAnswerQuestion,
    onResolveQuestion
  }
}
