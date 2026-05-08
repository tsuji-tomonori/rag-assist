import { type Dispatch, type FormEvent, type SetStateAction, useMemo, useState } from "react"
import type { SubmitShortcut } from "../../../app/types.js"
import { startChatRun, streamChatRunEvents } from "../api/chatApi.js"
import { getDebugRun } from "../../debug/api/debugApi.js"
import type { DebugTrace } from "../../debug/types.js"
import type { ChatResponse } from "../types-api.js"
import type { Message } from "../types.js"
import type { ClarificationOption } from "../types-api.js"

type PendingClarificationFreeform = {
  originalQuestion: string
  seedText: string
}

const genericFreeformContextTerms = new Set([
  "申請",
  "期限",
  "締切",
  "必要",
  "方法",
  "手順",
  "条件",
  "対象",
  "場合",
  "質問",
  "申請期限",
  "提出期限"
])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldClearFreeformContext(pending: PendingClarificationFreeform, nextQuestion: string): boolean {
  const trimmed = nextQuestion.trim()
  if (!trimmed) return false
  return looksLikeStandaloneQuestion(trimmed) && !sharesMeaningfulToken(pending.originalQuestion, trimmed)
}

function looksLikeStandaloneQuestion(value: string): boolean {
  const normalized = value.replace(/\s+/g, "")
  return /[?？]$/.test(normalized) ||
    /(何|いつ|どこ|誰|だれ|なぜ|理由|方法|手順|期限|締切|教えて|ですか|ますか|できますか|質問)/.test(normalized)
}

function sharesMeaningfulToken(source: string, target: string): boolean {
  const sourceTokens = [...meaningfulTokens(source)]
  const targetTokens = [...meaningfulTokens(target)]
  return targetTokens.some((targetToken) => sourceTokens.some((sourceToken) => termsMatch(sourceToken, targetToken)))
}

function termsMatch(a: string, b: string): boolean {
  if (a === b || a.includes(b) || b.includes(a)) return true
  return (isCjkAbbreviationTerm(a) && isCjkAbbreviationExpansion(a, b)) ||
    (isCjkAbbreviationTerm(b) && isCjkAbbreviationExpansion(b, a))
}

function isCjkAbbreviationTerm(term: string): boolean {
  return term.length >= 2 && term.length <= 6 && isCjkText(term)
}

function isCjkText(value: string): boolean {
  return /^[\p{Script=Han}\p{Script=Katakana}ー]+$/u.test(value)
}

function isCjkAbbreviationExpansion(short: string, long: string): boolean {
  return isCjkText(long) && long[0] === short[0] && !long.includes(short) && isOrderedSubsequence(short, long)
}

function isOrderedSubsequence(short: string, long: string): boolean {
  let index = 0
  for (const char of short) {
    index = long.indexOf(char, index)
    if (index < 0) return false
    index += char.length
  }
  return true
}

function meaningfulTokens(value: string): Set<string> {
  const normalized = value.normalize("NFKC")
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu) ?? []
  const ascii = normalized.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []
  return new Set([...japanese, ...ascii]
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !genericFreeformContextTerms.has(token)))
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
  selectedGroupId,
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
  selectedGroupId: string
  loading: boolean
  rememberMessages: (id: string, titleCandidate: string, messages: Message[]) => void
  createConversationId: () => string
  ingestDocument: (file: File, options?: { purpose?: "document" | "chatAttachment"; groupId?: string; temporaryScopeId?: string }) => Promise<void>
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
  const [pendingClarificationFreeform, setPendingClarificationFreeform] = useState<PendingClarificationFreeform | null>(null)
  const [conversationKey, setConversationKey] = useState(0)
  const [submitShortcut, setSubmitShortcut] = useState<SubmitShortcut>("enter")
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
    const freeformContext = pendingClarificationFreeform && typedQuestion.length > 0 && !hasAttachment && !shouldClearFreeformContext(pendingClarificationFreeform, typedQuestion)
      ? {
          originalQuestion: pendingClarificationFreeform.originalQuestion,
          selectedValue: typedQuestion
        }
      : undefined
    await submitQuestion(userQuestion, typedQuestion, hasAttachment, freeformContext)
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

  function startClarificationFreeform(originalQuestion: string, seedText: string) {
    setPendingClarificationFreeform({ originalQuestion, seedText })
    setQuestion(seedText)
  }

  function setChatQuestion(value: string) {
    setQuestion(value)
    setPendingClarificationFreeform((pending) => pending && shouldClearFreeformContext(pending, value) ? null : pending)
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
        await ingestDocument(file, { purpose: "chatAttachment", temporaryScopeId: currentConversationId })
        setFile(null)
      }

      if (typedQuestion.length > 0) {
        const searchScope = selectedGroupId !== "all" || hasAttachment
          ? {
              mode: selectedGroupId !== "all" ? "groups" as const : undefined,
              groupIds: selectedGroupId !== "all" ? [selectedGroupId] : undefined,
              includeTemporary: hasAttachment,
              temporaryScopeId: hasAttachment ? currentConversationId : undefined
            }
          : undefined
        const started = await startChatRun({
          question: userQuestion,
          clarificationContext,
          modelId,
          embeddingModelId,
          clueModelId: modelId,
          topK: 6,
          minScore,
          searchScope,
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
      setPendingClarificationFreeform(null)
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
    setPendingClarificationFreeform(null)
    setSelectedRunId("")
    setExpandedStepId(null)
    setAllExpanded(false)
    setConversationKey((current) => current + 1)
  }

  return {
    question,
    setQuestion: setChatQuestion,
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
    startClarificationFreeform,
    newConversation
  }
}
