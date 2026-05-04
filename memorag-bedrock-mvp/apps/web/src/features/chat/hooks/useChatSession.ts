import { type Dispatch, type FormEvent, type SetStateAction, useMemo, useState } from "react"
import { chat } from "../api/chatApi.js"
import type { DebugTrace } from "../../debug/types.js"
import type { Message } from "../types.js"

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

  async function submitClarificationOption(resolvedQuery: string) {
    const userQuestion = resolvedQuery.trim()
    if (!userQuestion || loading || !canCreateChat) return
    await submitQuestion(userQuestion, userQuestion, false)
  }

  async function submitQuestion(userQuestion: string, typedQuestion: string, hasAttachment: boolean) {
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
        const result = await chat({
          question: userQuestion,
          modelId,
          embeddingModelId,
          clueModelId: modelId,
          topK: 6,
          minScore,
          includeDebug: debugMode && canReadDebugRuns
        })
        setMessages((prev) => [...prev, { role: "assistant", text: result.answer, sourceQuestion: userQuestion, result, createdAt: new Date().toISOString() }])
        if (result.debug) {
          setSelectedRunId(result.debug.runId)
          setDebugRuns((prev) => [result.debug as DebugTrace, ...prev.filter((run) => run.runId !== result.debug?.runId)])
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
