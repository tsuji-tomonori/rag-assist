import { type Dispatch, type SetStateAction, useState } from "react"
import { answerQuestion, createQuestion, listQuestions, resolveQuestion, type HumanQuestion } from "../../../api.js"
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

  async function refreshQuestions() {
    const nextQuestions = await listQuestions()
    setQuestions(nextQuestions)
    setSelectedQuestionId((current) => {
      if (current && nextQuestions.some((questionItem) => questionItem.questionId === current)) return current
      return nextQuestions[0]?.questionId ?? ""
    })
  }

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
    onCreateQuestion,
    onAnswerQuestion,
    onResolveQuestion
  }
}
