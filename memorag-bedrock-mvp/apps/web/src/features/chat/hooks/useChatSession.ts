import { type Dispatch, type FormEvent, type SetStateAction, useMemo, useState } from "react"
import { startChatRun, streamChatRunEvents } from "../api/chatApi.js"
import { getDebugRun } from "../../debug/api/debugApi.js"
import type { DebugTrace } from "../../debug/types.js"
import type { ChatResponse } from "../types-api.js"
import type { Message } from "../types.js"
import type { ClarificationOption } from "../types-api.js"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useChatSession({
  canCreateChat,
  canWriteDocuments,
  canReadDebugRuns,
  file,
  setFile,
  debugMode,
  modelId,
  embeddingModelId,
  minScore,
  currentConversationId,
  setCurrentConversationId,
  loading,
  rememberMessages,
  createConversationId,
  ingestDocument,
  setDebugRuns,
  setSelectedRunId,
  setExpandedStepId,
  setAllExpanded,
  setLoading,
  setError
}: {
  canCreateChat: boolean
  canWriteDocuments: boolean
  canReadDebugRuns: boolean
  file: File | null
  setFile: (file: File | null) => void
  debugMode: boolean
  modelId: string
  embeddingModelId: string
  minScore: number
  currentConversationId: string
  setCurrentConversationId: (conversationId: string) => void
  loading: boolean
  rememberMessages: (id: string, titleCandidate: string, messages: Message[]) => void
  createConversationId: () => string
  ingestDocument: (file: File) => Promise<void>
  setDebugRuns: Dispatch<SetStateAction<DebugTrace[]>>
  setSelectedRunId: (runId: string) => void
  setExpandedStepId: (stepId: number | null) => void
  setAllExpanded: (expanded: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [pendingActivity, setPendingActivity] = useState<string | null>(null)
  const [pendingDebugQuestion, setPendingDebugQuestion] = useState<string | null>(null)
  const [conversationKey, setConversationKey] = useState(0)
  const [submitShortcut, setSubmitShortcut] = useState<"enter" | "ctrlEnter">("enter")
  const canAsk = useMemo(
    () => (question.trim().length > 0 || (file !== null && canWriteDocuments)) && !loading && canCreateChat,
    [question, file, loading, canCreateChat, canWriteDocuments]
  )

  async function onAsk(event: FormEvent) {
    event.preventDefault()
    if (!canAsk || loading) return

    const typedQuestion = question.trim()
    const userQuestion = typedQuestion || `${file?.name ?? "添付資料"}を取り込んでください`
    const hasAttachment = file !== null
    await submitQuestion(userQuestion, typedQuestion, hasAttachment)
  }

  async function submitClarificationOption(option: ClarificationOption, originalQuestion: string) {
    const userQuestion = option.resolvedQuery.trim()
    if (!userQuestion || loading || !canCreateChat) return
    await submitQuestion(userQuestion, userQuestion, false, {
      originalQuestion,
      selectedOptionId: option.id,
      selectedValue: option.label
    })
  }

  async function submitQuestion(
    userQuestion: string,
    typedQuestion: string,
    hasAttachment: boolean,
    clarificationContext?: {
      originalQuestion?: string
      selectedOptionId?: string
      selectedValue?: string
    }
  ) {
    setQuestion("")
    setMessages((prev) => [...prev, { role: "user", text: userQuestion, createdAt: new Date().toISOString() }])
    setLoading(true)
    setPendingActivity(hasAttachment && typedQuestion ? "資料を取り込み、回答を生成中" : typedQuestion ? "回答を生成中" : "資料を取り込み中")
    setPendingDebugQuestion(debugMode && canReadDebugRuns ? userQuestion : null)
    setSelectedRunId("")
    setExpandedStepId(null)
    setAllExpanded(false)
    setError(null)

    try {
      if (hasAttachment && file && canWriteDocuments) {
        await ingestDocument(file)
        setFile(null)
      }

      if (typedQuestion.length > 0) {
        const started = await startChatRun({
          question: userQuestion,
          clarificationContext,
          modelId,
          embeddingModelId,
          clueModelId: modelId,
          topK: 6,
          minScore,
          includeDebug: debugMode && canReadDebugRuns
        })
        let result: ChatResponse | undefined
        let lastEventId: number | undefined
        let done = false
        let terminalError: Error | undefined
        let debugRunId: string | undefined

        for (let attempt = 0; attempt < 3 && !done; attempt += 1) {
          try {
            await streamChatRunEvents(started.runId, (event) => {
              if (event.id !== undefined) lastEventId = event.id
              if (event.type === "timeout") {
                setPendingActivity("処理が続いています。再接続しています")
                return
              }
              if (event.type === "status") {
                const message = typeof event.data.message === "string" ? event.data.message : typeof event.data.stage === "string" ? event.data.stage : "回答を生成中"
                setPendingActivity(message)
              }
              if (event.type === "error") {
                const message = typeof event.data.message === "string" ? event.data.message : "chat run failed"
                terminalError = new Error(message)
                done = true
              }
              if (event.type === "final") {
                debugRunId = typeof event.data.debugRunId === "string" ? event.data.debugRunId : undefined
                result = {
                  responseType:
                    event.data.responseType === "answer" || event.data.responseType === "refusal" || event.data.responseType === "clarification"
                      ? event.data.responseType
                      : undefined,
                  answer: typeof event.data.answer === "string" ? event.data.answer : "",
                  isAnswerable: event.data.isAnswerable === true,
                  needsClarification: event.data.needsClarification === true,
                  clarification: event.data.clarification && typeof event.data.clarification === "object" ? (event.data.clarification as ChatResponse["clarification"]) : undefined,
                  citations: Array.isArray(event.data.citations) ? (event.data.citations as ChatResponse["citations"]) : [],
                  retrieved: Array.isArray(event.data.retrieved) ? (event.data.retrieved as ChatResponse["retrieved"]) : [],
                  debug: event.data.debug && typeof event.data.debug === "object" ? (event.data.debug as DebugTrace) : undefined
                }
                done = true
              }
            }, lastEventId)
          } catch (err) {
            if (done || terminalError) break
            if (attempt >= 2) throw err
            setPendingActivity("接続が切れました。再接続しています")
            await sleep(1000 * (attempt + 1))
          }
        }
        if (result && !result.debug && debugRunId && canReadDebugRuns) {
          try {
            result = { ...result, debug: await getDebugRun(debugRunId) }
          } catch (err) {
            console.warn("Failed to load debug trace", err)
          }
        }
        if (terminalError) throw terminalError
        if (!result) throw new Error("chat run completed without final event")
        const finalResult = result
        setMessages((prev) => [...prev, { role: "assistant", text: finalResult.answer, sourceQuestion: userQuestion, result: finalResult, createdAt: new Date().toISOString() }])
        if (finalResult.debug) {
          setSelectedRunId(finalResult.debug.runId)
          setDebugRuns((prev) => [finalResult.debug as DebugTrace, ...prev.filter((run) => run.runId !== finalResult.debug?.runId)])
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "資料を取り込みました。知りたいことを入力してください。", createdAt: new Date().toISOString() }
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingActivity(null)
      setPendingDebugQuestion(null)
      setLoading(false)
    }
  }

  function newConversation() {
    if (messages.length > 0) {
      const titleCandidate = messages.find((item) => item.role === "user")?.text || "新しい会話"
      rememberMessages(currentConversationId, titleCandidate, messages)
    }
    setMessages([])
    setCurrentConversationId(createConversationId())
    setQuestion("")
    setFile(null)
    setError(null)
    setPendingActivity(null)
    setPendingDebugQuestion(null)
    setSelectedRunId("")
    setExpandedStepId(null)
    setAllExpanded(false)
    setConversationKey((current) => current + 1)
  }

  return {
    question,
    setQuestion,
    messages,
    setMessages,
    pendingActivity,
    setPendingActivity,
    pendingDebugQuestion,
    setPendingDebugQuestion,
    conversationKey,
    submitShortcut,
    setSubmitShortcut,
    canAsk,
    onAsk,
    submitClarificationOption,
    newConversation
  }
}
