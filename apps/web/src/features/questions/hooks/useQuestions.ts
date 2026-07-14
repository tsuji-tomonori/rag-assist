import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from "react"
import { answerQuestion, createQuestion, getQuestion, listQuestions, resolveQuestion } from "../api/questionsApi.js"
import type { HumanQuestion, QuestionOperationOutcome } from "../types.js"
import type { Message } from "../../chat/types.js"
import { confirmedOperation, failedOperation, partialOperation } from "../../../shared/ui/operationOutcome.js"

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
  const creatingTargetsRef = useRef(new Set<string>())
  const answeringQuestionIdsRef = useRef(new Set<string>())
  const resolvingQuestionIdsRef = useRef(new Set<string>())

  function beginMutation() {
    setLoading(true)
  }

  function finishMutation() {
    setLoading(false)
  }

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

  async function onCreateQuestion(
    messageIndex: number,
    message: Message,
    input: Parameters<typeof createQuestion>[0]
  ): Promise<QuestionOperationOutcome> {
    const targetKey = message.messageId ?? `${message.role}:${message.createdAt}:${message.sourceQuestion ?? message.text}`
    if (creatingTargetsRef.current.has(targetKey)) {
      return failedOperation(new Error("この回答の問い合わせは送信処理中です。"))
    }
    creatingTargetsRef.current.add(targetKey)
    beginMutation()
    setError(null)
    try {
      const questionTicket = await createQuestion({
        ...input,
        messageId: input.messageId ?? message.messageId
      })
      setMessages((prev) => prev.map((item, index) => {
        const matchesTarget = message.messageId
          ? item.messageId === message.messageId
          : index === messageIndex && item.role === message.role && item.createdAt === message.createdAt
        return matchesTarget ? { ...item, questionTicket } : item
      }))
      setQuestions((prev) =>
        prev.some((questionItem) => questionItem.questionId === questionTicket.questionId) ? prev : [questionTicket, ...prev]
      )
      setSelectedQuestionId(questionTicket.questionId)
      if (canAnswerQuestions) {
        try {
          await refreshQuestions()
        } catch (err) {
          console.warn("Failed to refresh questions after escalation", err)
          return partialOperation(
            questionTicket,
            "問い合わせは作成済みですが、担当者一覧の再読込を確認できませんでした。",
            { resultReference: questionTicket.questionId }
          )
        }
      }
      return confirmedOperation(questionTicket, {
        message: "API が問い合わせの作成を確定しました。",
        evidence: { resultReference: questionTicket.questionId }
      })
    } catch (err) {
      const outcome = failedOperation(err, "問い合わせを作成できませんでした。")
      setError(outcome.message)
      return outcome
    } finally {
      creatingTargetsRef.current.delete(targetKey)
      finishMutation()
    }
  }

  async function onAnswerQuestion(
    questionId: string,
    input: Parameters<typeof answerQuestion>[1]
  ): Promise<QuestionOperationOutcome> {
    if (answeringQuestionIdsRef.current.has(questionId)) {
      return failedOperation(new Error("この問い合わせは回答送信処理中です。"))
    }
    answeringQuestionIdsRef.current.add(questionId)
    beginMutation()
    setError(null)
    try {
      const answered = await answerQuestion(questionId, input)
      setQuestions((prev) => [answered, ...prev.filter((questionItem) => questionItem.questionId !== answered.questionId)])
      setMessages((prev) =>
        prev.map((item) => (item.questionTicket?.questionId === answered.questionId ? { ...item, questionTicket: answered } : item))
      )
      return confirmedOperation(answered, {
        message: "API が担当者回答の送信を確定しました。",
        evidence: { resultReference: answered.questionId, actor: input.responderName }
      })
    } catch (err) {
      const outcome = failedOperation(err, "担当者回答を送信できませんでした。")
      setError(outcome.message)
      return outcome
    } finally {
      answeringQuestionIdsRef.current.delete(questionId)
      finishMutation()
    }
  }

  async function onResolveQuestion(questionId: string): Promise<QuestionOperationOutcome> {
    if (resolvingQuestionIdsRef.current.has(questionId)) {
      return failedOperation(new Error("この問い合わせは解決処理中です。"))
    }
    resolvingQuestionIdsRef.current.add(questionId)
    beginMutation()
    setError(null)
    try {
      const resolved = await resolveQuestion(questionId)
      setQuestions((prev) => [resolved, ...prev.filter((questionItem) => questionItem.questionId !== resolved.questionId)])
      setMessages((prev) =>
        prev.map((item) => (item.questionTicket?.questionId === resolved.questionId ? { ...item, questionTicket: resolved } : item))
      )
      return confirmedOperation(resolved, {
        message: "API が問い合わせの解決を確定しました。",
        evidence: { resultReference: resolved.questionId }
      })
    } catch (err) {
      const outcome = failedOperation(err, "問い合わせを解決できませんでした。")
      setError(outcome.message)
      return outcome
    } finally {
      resolvingQuestionIdsRef.current.delete(questionId)
      finishMutation()
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
