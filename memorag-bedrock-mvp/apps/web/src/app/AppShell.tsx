import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  assignUserRoles,
  answerQuestion,
  cancelBenchmarkRun,
  chat,
  createManagedUser,
  createQuestion,
  deleteManagedUser,
  deleteConversationHistory,
  deleteDocument,
  fileToBase64,
  getCostAuditSummary,
  getMe,
  listAccessRoles,
  listAdminAuditLog,
  listConversationHistory,
  listQuestions,
  listBenchmarkRuns,
  listBenchmarkSuites,
  listDebugRuns,
  listDocuments,
  listManagedUsers,
  listUsageSummaries,
  resolveQuestion,
  saveConversationHistory,
  startBenchmarkRun,
  suspendManagedUser,
  unsuspendManagedUser,
  uploadDocument,
  type AccessRoleDefinition,
  type BenchmarkRun,
  type BenchmarkSuite,
  type ChatResponse,
  type ConversationHistoryItem,
  type CostAuditSummary,
  type CurrentUser,
  type DebugTrace,
  type DocumentManifest,
  type HumanQuestion,
  type ManagedUser,
  type ManagedUserAuditLogEntry,
  type Permission,
  type UserUsageSummary
} from "../api.js"
import type { AuthSession } from "../authClient.js"
import { RailNav } from "./components/RailNav.js"
import { TopBar } from "./components/TopBar.js"
import type { AppView } from "./types.js"
import { BenchmarkWorkspace } from "../features/benchmark/components/BenchmarkWorkspace.js"
import { DebugPanel } from "../features/debug/components/DebugPanel.js"
import { DocumentWorkspace } from "../features/documents/components/DocumentWorkspace.js"
import { HistoryWorkspace } from "../features/history/components/HistoryWorkspace.js"
import { Icon } from "../shared/components/Icon.js"
import {
  adminAuditActionLabel,
  adminAuditSummary,
  costConfidenceLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatLatency,
  formatTime,
  managedUserStatusLabel,
  priorityLabel,
  statusLabel
} from "../shared/utils/format.js"

type Message = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponse
  questionTicket?: HumanQuestion
}

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

export function AppShell({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [documents, setDocuments] = useState<DocumentManifest[]>([])
  const [debugRuns, setDebugRuns] = useState<DebugTrace[]>([])
  const [benchmarkRuns, setBenchmarkRuns] = useState<BenchmarkRun[]>([])
  const [benchmarkSuites, setBenchmarkSuites] = useState<BenchmarkSuite[]>([])
  const [questions, setQuestions] = useState<HumanQuestion[]>([])
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [adminAuditLog, setAdminAuditLog] = useState<ManagedUserAuditLogEntry[]>([])
  const [accessRoles, setAccessRoles] = useState<AccessRoleDefinition[]>([])
  const [usageSummaries, setUsageSummaries] = useState<UserUsageSummary[]>([])
  const [costAudit, setCostAudit] = useState<CostAuditSummary | null>(null)
  const [activeView, setActiveView] = useState<AppView>("chat")
  const [selectedDocumentId, setSelectedDocumentId] = useState("all")
  const [selectedRunId, setSelectedRunId] = useState("")
  const [selectedQuestionId, setSelectedQuestionId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState("")
  const [modelId, setModelId] = useState(defaultModelId)
  const [embeddingModelId] = useState(defaultEmbeddingModelId)
  const [minScore] = useState(0.2)
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<ConversationHistoryItem[]>([])
  const [currentConversationId, setCurrentConversationId] = useState(() => createConversationId())
  const [loading, setLoading] = useState(false)
  const [pendingActivity, setPendingActivity] = useState<string | null>(null)
  const [pendingDebugQuestion, setPendingDebugQuestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null)
  const [allExpanded, setAllExpanded] = useState(false)
  const [conversationKey, setConversationKey] = useState(0)
  const [submitShortcut, setSubmitShortcut] = useState<"enter" | "ctrlEnter">("enter")
  const [benchmarkSuiteId, setBenchmarkSuiteId] = useState("standard-agent-v1")
  const [benchmarkModelId, setBenchmarkModelId] = useState(defaultModelId)
  const [benchmarkConcurrency, setBenchmarkConcurrency] = useState(1)
  const latestMessageRef = useRef<HTMLElement | null>(null)
  const historyRef = useRef<ConversationHistoryItem[]>([])

  const hasPermission = (permission: Permission) => currentUser?.permissions.includes(permission) ?? false
  const canCreateChat = hasPermission("chat:create")
  const canReadDocuments = hasPermission("rag:doc:read")
  const canWriteDocuments = hasPermission("rag:doc:write:group")
  const canDeleteDocuments = hasPermission("rag:doc:delete:group")
  const canAnswerQuestions = hasPermission("answer:edit")
  const canReadDebugRuns = hasPermission("chat:admin:read_all")
  const canReadHistory = hasPermission("chat:read:own")
  const canOpenAdminSettings = hasPermission("access:policy:read")
  const canReadBenchmarkRuns = hasPermission("benchmark:read")
  const canRunBenchmark = hasPermission("benchmark:run")
  const canCancelBenchmark = hasPermission("benchmark:cancel")
  const canDownloadBenchmark = hasPermission("benchmark:download")
  const canReadUsers = hasPermission("user:read")
  const canCreateUsers = hasPermission("user:create")
  const canSuspendUsers = hasPermission("user:suspend")
  const canUnsuspendUsers = hasPermission("user:unsuspend")
  const canDeleteUsers = hasPermission("user:delete")
  const canAssignRoles = hasPermission("access:role:assign")
  const canReadUsage = hasPermission("usage:read:all_users")
  const canReadCosts = hasPermission("cost:read:all")
  const canReadAdminAuditLog = canOpenAdminSettings
  const canManageDocuments = canWriteDocuments || canDeleteDocuments
  const canManageUsers = canReadUsers || canCreateUsers || canAssignRoles || canSuspendUsers || canUnsuspendUsers || canDeleteUsers
  const canAuditOperations = canReadUsage || canReadCosts
  const canSeeAdminSettings = canOpenAdminSettings || canAnswerQuestions || canManageDocuments || canReadDebugRuns || canReadBenchmarkRuns || canManageUsers || canAuditOperations
  const canAsk = useMemo(() => (question.trim().length > 0 || (file !== null && canWriteDocuments)) && !loading && canCreateChat, [question, file, loading, canCreateChat, canWriteDocuments])
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
  const latestTrace = latestAssistant?.result?.debug
  const isProcessing = pendingActivity !== null
  const selectedTrace = useMemo(() => {
    if (pendingDebugQuestion) return undefined
    if (selectedRunId) return debugRuns.find((run) => run.runId === selectedRunId) ?? latestTrace
    return latestTrace
  }, [debugRuns, latestTrace, pendingDebugQuestion, selectedRunId])
  const totalLatency = pendingDebugQuestion ? "処理中" : selectedTrace ? formatLatency(selectedTrace.totalLatencyMs) : "-"
  const selectedRunValue = pendingDebugQuestion ? "__processing__" : selectedTrace?.runId ?? ""
  const visibleMessages = messages
  const latestMessageCreatedAt = visibleMessages[visibleMessages.length - 1]?.createdAt ?? ""

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    if (!authSession) {
      setCurrentUser(null)
      return
    }
    let active = true
    setCurrentUser(null)
    getMe()
      .then((user) => {
        if (active) setCurrentUser(user)
      })
      .catch((err) => {
        console.warn("Failed to load current user", err)
        if (active) {
          setCurrentUser(null)
          setError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      active = false
    }
  }, [authSession])

  useEffect(() => {
    if (!authSession || !currentUser) return
    if (canReadDocuments) refreshDocuments().catch((err) => console.warn("Failed to load documents", err))
    if (canReadDebugRuns) refreshDebugRuns().catch((err) => console.warn("Failed to load debug runs", err))
    if (canReadBenchmarkRuns) {
      refreshBenchmarkRuns().catch((err) => console.warn("Failed to load benchmark runs", err))
      refreshBenchmarkSuites().catch((err) => console.warn("Failed to load benchmark suites", err))
    }
    if (canReadUsers) refreshManagedUsers().catch((err) => console.warn("Failed to load managed users", err))
    if (canOpenAdminSettings) refreshAccessRoles().catch((err) => console.warn("Failed to load access roles", err))
    if (canReadAdminAuditLog) refreshAdminAuditLog().catch((err) => console.warn("Failed to load admin audit log", err))
    if (canReadUsage) refreshUsageSummaries().catch((err) => console.warn("Failed to load usage summaries", err))
    if (canReadCosts) refreshCostAudit().catch((err) => console.warn("Failed to load cost audit", err))
    if (canAnswerQuestions) refreshQuestions().catch((err) => console.warn("Failed to load questions", err))
    if (canReadHistory) refreshHistory().catch((err) => console.warn("Failed to load conversation history", err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, currentUser])

  useEffect(() => {
    if (activeView === "assignee" && !canAnswerQuestions) setActiveView("chat")
    if (activeView === "benchmark" && !canReadBenchmarkRuns) setActiveView("chat")
    if (activeView === "documents" && !canManageDocuments) setActiveView("chat")
    if (activeView === "admin" && !canSeeAdminSettings) setActiveView("chat")
  }, [activeView, canAnswerQuestions, canManageDocuments, canReadBenchmarkRuns, canSeeAdminSettings])

  useEffect(() => {
    if (!canReadDebugRuns && debugMode) setDebugMode(false)
    if (!canWriteDocuments && file) setFile(null)
  }, [canReadDebugRuns, canWriteDocuments, debugMode, file])

  useEffect(() => {
    if (activeView !== "benchmark" || !canReadBenchmarkRuns) return
    const timer = window.setInterval(() => {
      refreshBenchmarkRuns().catch((err) => console.warn("Failed to poll benchmark runs", err))
    }, 15000)
    return () => window.clearInterval(timer)
  }, [activeView, canReadBenchmarkRuns])

  useEffect(() => {
    if (messages.length === 0) return
    const titleCandidate = messages.find((item) => item.role === "user")?.text || "新しい会話"
    const existingFavorite = historyRef.current.find((item) => item.id === currentConversationId)?.isFavorite ?? false
    rememberConversation(buildConversationHistoryItem(currentConversationId, titleCandidate, messages, existingFavorite))
  }, [currentConversationId, messages])

  useEffect(() => {
    if (activeView !== "chat") return
    const latestMessage = latestMessageRef.current
    if (!latestMessage) return

    const prefersReducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    latestMessage.scrollIntoView?.({
      block: "start",
      inline: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth"
    })
  }, [activeView, latestMessageCreatedAt, pendingActivity])


  async function refreshDocuments() {
    const nextDocuments = await listDocuments()
    setDocuments(nextDocuments)
    if (selectedDocumentId !== "all" && !nextDocuments.some((document) => document.documentId === selectedDocumentId)) {
      setSelectedDocumentId("all")
    }
  }


  async function refreshDebugRuns() {
    setDebugRuns(await listDebugRuns())
  }

  async function refreshBenchmarkRuns() {
    setBenchmarkRuns(await listBenchmarkRuns())
  }

  async function refreshBenchmarkSuites() {
    const suites = await listBenchmarkSuites()
    setBenchmarkSuites(suites)
    setBenchmarkSuiteId((current) => suites.find((suite) => suite.suiteId === current)?.suiteId ?? suites[0]?.suiteId ?? current)
  }

  async function refreshManagedUsers() {
    setManagedUsers(await listManagedUsers())
  }

  async function refreshAdminAuditLog() {
    setAdminAuditLog(await listAdminAuditLog())
  }

  async function refreshAccessRoles() {
    setAccessRoles(await listAccessRoles())
  }

  async function refreshUsageSummaries() {
    setUsageSummaries(await listUsageSummaries())
  }

  async function refreshCostAudit() {
    setCostAudit(await getCostAuditSummary())
  }

  async function refreshQuestions() {
    const nextQuestions = await listQuestions()
    setQuestions(nextQuestions)
    setSelectedQuestionId((current) => {
      if (current && nextQuestions.some((questionItem) => questionItem.questionId === current)) return current
      return nextQuestions[0]?.questionId ?? ""
    })
  }

  async function refreshHistory() {
    setHistory(await listConversationHistory())
  }

  function rememberConversation(item: ConversationHistoryItem) {
    const existing = historyRef.current.find((entry) => entry.id === item.id)
    const nextItem = { ...item, isFavorite: item.isFavorite ?? existing?.isFavorite ?? false }
    setHistory((prev) => [nextItem, ...prev.filter((entry) => entry.id !== nextItem.id)].sort(compareConversationHistory).slice(0, 20))
    saveConversationHistory(nextItem).catch((err) => console.warn("Failed to save conversation history", err))
  }

  function toggleFavorite(item: ConversationHistoryItem) {
    const nextItem = { ...item, isFavorite: !item.isFavorite }
    setHistory((prev) => [nextItem, ...prev.filter((entry) => entry.id !== nextItem.id)].sort(compareConversationHistory).slice(0, 20))
    saveConversationHistory(nextItem).catch((err) => {
      console.warn("Failed to update conversation favorite", err)
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault()
    if (!canAsk) return

    const typedQuestion = question.trim()
    const userQuestion = typedQuestion || `${file?.name ?? "添付資料"}を取り込んでください`
    const hasAttachment = file !== null
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
      if (file && canWriteDocuments) {
        await uploadDocument({
          fileName: file.name,
          contentBase64: await fileToBase64(file),
          mimeType: file.type || undefined,
          memoryModelId: modelId,
          embeddingModelId
        })
        setFile(null)
        await refreshDocuments()
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

  async function onDelete(documentId?: string) {
    if (!documentId) return
    const document = documents.find((item) => item.documentId === documentId)
    const label = document?.fileName ?? documentId
    if (!window.confirm(`「${label}」を削除します。元資料、manifest、検索ベクトルが削除されます。`)) return

    setLoading(true)
    setError(null)
    try {
      await deleteDocument(documentId)
      setSelectedDocumentId("all")
      await refreshDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onUploadDocumentFile(uploadFile: File) {
    if (!canWriteDocuments) return
    setLoading(true)
    setError(null)
    try {
      await uploadDocument({
        fileName: uploadFile.name,
        contentBase64: await fileToBase64(uploadFile),
        mimeType: uploadFile.type || undefined,
        memoryModelId: modelId,
        embeddingModelId
      })
      await refreshDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function newConversation() {
    if (messages.length > 0) {
      const titleCandidate = messages.find((item) => item.role === "user")?.text || "新しい会話"
      const existingFavorite = historyRef.current.find((item) => item.id === currentConversationId)?.isFavorite ?? false
      rememberConversation(buildConversationHistoryItem(currentConversationId, titleCandidate, messages, existingFavorite))
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

  async function onStartBenchmark() {
    setLoading(true)
    setError(null)
    try {
      const selectedSuite = benchmarkSuites.find((suite) => suite.suiteId === benchmarkSuiteId)
      const created = await startBenchmarkRun({
        suiteId: benchmarkSuiteId,
        mode: selectedSuite?.mode ?? "agent",
        runner: "codebuild",
        modelId: benchmarkModelId,
        embeddingModelId,
        topK: 6,
        memoryTopK: 4,
        minScore,
        concurrency: benchmarkConcurrency
      })
      setBenchmarkRuns((prev) => [created, ...prev.filter((run) => run.runId !== created.runId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onCancelBenchmark(runId: string) {
    setLoading(true)
    setError(null)
    try {
      const cancelled = await cancelBenchmarkRun(runId)
      setBenchmarkRuns((prev) => [cancelled, ...prev.filter((run) => run.runId !== runId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onAssignUserRoles(userId: string, groups: string[]) {
    setLoading(true)
    setError(null)
    try {
      const updated = await assignUserRoles(userId, groups)
      setManagedUsers((prev) => [updated, ...prev.filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email)))
      await Promise.all([
        canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
        canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
        canReadCosts ? refreshCostAudit() : Promise.resolve()
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onCreateManagedUser(input: { email: string; displayName?: string; groups?: string[] }) {
    setLoading(true)
    setError(null)
    try {
      const created = await createManagedUser(input)
      setManagedUsers((prev) => [created, ...prev.filter((user) => user.userId !== created.userId)].sort((a, b) => a.email.localeCompare(b.email)))
      await Promise.all([
        canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
        canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
        canReadCosts ? refreshCostAudit() : Promise.resolve()
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onSetManagedUserStatus(userId: string, action: "suspend" | "unsuspend" | "delete") {
    if (action === "delete" && !window.confirm("このユーザーを管理台帳から削除状態にします。続行しますか？")) return
    setLoading(true)
    setError(null)
    try {
      const updated =
        action === "suspend" ? await suspendManagedUser(userId) : action === "unsuspend" ? await unsuspendManagedUser(userId) : await deleteManagedUser(userId)
      setManagedUsers((prev) => {
        if (updated.status === "deleted") return prev.filter((user) => user.userId !== userId)
        return [updated, ...prev.filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email))
      })
      await Promise.all([
        canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
        canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
        canReadCosts ? refreshCostAudit() : Promise.resolve()
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-frame">
      <RailNav
        activeView={activeView}
        authSession={authSession}
        canAnswerQuestions={canAnswerQuestions}
        canReadBenchmarkRuns={canReadBenchmarkRuns}
        canManageDocuments={canManageDocuments}
        canSeeAdminSettings={canSeeAdminSettings}
        onChangeView={setActiveView}
        onSignOut={onSignOut}
      />

      <section className="main-area">
        <TopBar
          modelId={modelId}
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          debugRuns={debugRuns}
          latestTrace={latestTrace}
          selectedRunValue={selectedRunValue}
          totalLatency={totalLatency}
          debugMode={debugMode}
          canReadDocuments={canReadDocuments}
          canReadDebugRuns={canReadDebugRuns}
          pendingDebugQuestion={pendingDebugQuestion}
          onModelChange={setModelId}
          onDocumentChange={setSelectedDocumentId}
          onRunChange={setSelectedRunId}
          onDebugModeChange={setDebugMode}
          onNewConversation={newConversation}
        />

        {error && <div className="error-banner">{error}</div>}

        {activeView === "chat" ? (
        <section className={`split-workspace ${debugMode ? "" : "debug-off"}`}>
          <section className="chat-card" aria-label="チャット">
            <div className="message-list">
              {visibleMessages.length === 0 && !isProcessing && <ChatEmptyState documentsCount={documents.length} onSelectPrompt={setQuestion} />}
              {visibleMessages.map((message, index) => (
                <article
                  className={`message-row ${message.role}`}
                  key={`${message.role}-${message.createdAt}-${index}`}
                  ref={index === visibleMessages.length - 1 && !pendingActivity ? latestMessageRef : undefined}
                >
                  <div className="message-avatar">{message.role === "user" ? "U" : <Icon name="logo" />}</div>
                  <div className="message-content">
                    <div className="message-meta">
                      <strong>{message.role === "user" ? "あなた" : "エージェント"}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    {message.role === "assistant" ? (
                      <AssistantAnswer
                        message={message}
                        linkedQuestion={getLinkedQuestion(message, questions)}
                        loading={loading}
                        onCreateQuestion={(input) => onCreateQuestion(index, message, input)}
                        onResolveQuestion={onResolveQuestion}
                        onAdditionalQuestion={(value) => setQuestion(value)}
                      />
                    ) : (
                      <UserPromptBubble text={message.text} />
                    )}
                  </div>
                </article>
              ))}
              {pendingActivity && (
                <article className="message-row assistant processing-row" aria-live="polite" ref={latestMessageRef}>
                  <div className="message-avatar">
                    <span className="loading-spinner" aria-hidden="true" />
                  </div>
                  <div className="message-content">
                    <div className="message-meta">
                      <strong>エージェント</strong>
                      <span>{pendingActivity}</span>
                    </div>
                    <ProcessingAnswer label={pendingActivity} />
                  </div>
                </article>
              )}
            </div>

            <form className="composer" onSubmit={onAsk}>
              <textarea
                aria-label="質問"
                placeholder={
                  submitShortcut === "enter"
                    ? "質問を入力してください...（Enterで送信 / Shift+Enterで改行）"
                    : "質問を入力してください...（Ctrl+Enterで送信 / Enterで改行）"
                }
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return

                  if (submitShortcut === "enter") {
                    if (!event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                    return
                  }

                  if (event.ctrlKey || event.metaKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <div className="composer-actions">
                <div className="composer-shortcut-toggle">
                  <label htmlFor="submit-shortcut">送信キー</label>
                  <select
                    id="submit-shortcut"
                    value={submitShortcut}
                    onChange={(event) => setSubmitShortcut(event.target.value as "enter" | "ctrlEnter")}
                  >
                    <option value="enter">Enterで送信</option>
                    <option value="ctrlEnter">Ctrl+Enterで送信</option>
                  </select>
                </div>
                {file && <span className="file-chip">{file.name}</span>}
                {canWriteDocuments && (
                  <label className="icon-button attach-button" title="資料を添付">
                    <Icon name="paperclip" />
                    <input key={conversationKey} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                  </label>
                )}
                <button className="send-button" disabled={!canAsk} type="submit" title="送信">
                  <Icon name="send" />
                </button>
              </div>
            </form>
            <p className="composer-note">本サービスの回答は社内ドキュメントをもとに生成されます。内容の正確性をご確認のうえご利用ください。</p>
          </section>

          {debugMode && canReadDebugRuns && (
            <DebugPanel
              trace={selectedTrace}
              pending={pendingDebugQuestion !== null}
              pendingQuestion={pendingDebugQuestion ?? undefined}
              allExpanded={allExpanded}
              expandedStepId={expandedStepId}
              onToggleAll={() => setAllExpanded((value) => !value)}
              onToggleStep={(stepId) => setExpandedStepId((current) => (current === stepId ? null : stepId))}
            />
          )}
        </section>
        ) : activeView === "assignee" && canAnswerQuestions ? (
          <AssigneeWorkspace
            questions={questions}
            selectedQuestionId={selectedQuestionId}
            loading={loading}
            onSelect={setSelectedQuestionId}
            onAnswer={onAnswerQuestion}
            onBack={() => setActiveView("chat")}
          />
        ) : activeView === "benchmark" && canReadBenchmarkRuns ? (
          <BenchmarkWorkspace
            runs={benchmarkRuns}
            suites={benchmarkSuites}
            suiteId={benchmarkSuiteId}
            modelId={benchmarkModelId}
            concurrency={benchmarkConcurrency}
            loading={loading}
            canRun={canRunBenchmark}
            canCancel={canCancelBenchmark}
            canDownload={canDownloadBenchmark}
            onSuiteChange={setBenchmarkSuiteId}
            onModelChange={setBenchmarkModelId}
            onConcurrencyChange={setBenchmarkConcurrency}
            onStart={onStartBenchmark}
            onRefresh={() => refreshBenchmarkRuns().catch((err) => setError(err instanceof Error ? err.message : String(err)))}
            onCancel={onCancelBenchmark}
            onBack={() => setActiveView("chat")}
          />
        ) : activeView === "documents" && canManageDocuments ? (
          <DocumentWorkspace
            documents={documents}
            loading={loading}
            canWrite={canWriteDocuments}
            canDelete={canDeleteDocuments}
            onUpload={onUploadDocumentFile}
            onDelete={onDelete}
            onBack={() => setActiveView("admin")}
          />
        ) : activeView === "admin" && canSeeAdminSettings ? (
          <AdminWorkspace
            user={currentUser}
            documentsCount={documents.length}
            openQuestionsCount={questions.filter((questionItem) => questionItem.status === "open").length}
            debugRunsCount={debugRuns.length}
            benchmarkRunsCount={benchmarkRuns.length}
            managedUsers={managedUsers}
            adminAuditLog={adminAuditLog}
            accessRoles={accessRoles}
            usageSummaries={usageSummaries}
            costAudit={costAudit}
            loading={loading}
            canManageDocuments={canManageDocuments}
            canAnswerQuestions={canAnswerQuestions}
            canReadDebugRuns={canReadDebugRuns}
            canReadBenchmarkRuns={canReadBenchmarkRuns}
            canOpenAdminSettings={canOpenAdminSettings}
            canReadUsers={canReadUsers}
            canCreateUsers={canCreateUsers}
            canSuspendUsers={canSuspendUsers}
            canUnsuspendUsers={canUnsuspendUsers}
            canDeleteUsers={canDeleteUsers}
            canAssignRoles={canAssignRoles}
            canReadUsage={canReadUsage}
            canReadCosts={canReadCosts}
            canReadAdminAuditLog={canReadAdminAuditLog}
            onOpenDocuments={() => setActiveView("documents")}
            onOpenAssignee={() => setActiveView("assignee")}
            onOpenDebug={() => {
              setDebugMode(true)
              setActiveView("chat")
            }}
            onOpenBenchmark={() => setActiveView("benchmark")}
            onCreateUser={onCreateManagedUser}
            onAssignRoles={onAssignUserRoles}
            onSetUserStatus={onSetManagedUserStatus}
            onRefreshAdminData={() =>
              Promise.all([
                canReadUsers ? refreshManagedUsers() : Promise.resolve(),
                canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
                canOpenAdminSettings ? refreshAccessRoles() : Promise.resolve(),
                canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
                canReadCosts ? refreshCostAudit() : Promise.resolve()
              ]).then(() => undefined)
            }
            onBack={() => setActiveView("chat")}
          />
        ) : (
          <HistoryWorkspace
            history={history}
            favoriteOnly={activeView === "favorites"}
            onSelect={(item) => {
              setCurrentConversationId(item.id)
              setMessages(item.messages)
              setActiveView("chat")
              setError(null)
              setSelectedRunId("")
              setPendingActivity(null)
              setPendingDebugQuestion(null)
            }}
            onDelete={(id) => {
              setHistory((prev) => prev.filter((entry) => entry.id !== id))
              deleteConversationHistory(id).catch((err) => {
                console.warn("Failed to delete conversation history", err)
                setError(err instanceof Error ? err.message : String(err))
              })
            }}
            onToggleFavorite={toggleFavorite}
            onBack={() => setActiveView("chat")}
          />
        )}
      </section>
    </main>
  )
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

function UserPromptBubble({ text }: { text: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const canCopyPrompt = Boolean(text.trim())

  async function copyPrompt() {
    if (!canCopyPrompt) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus("copied")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    } catch (err) {
      console.warn("Failed to copy prompt", err)
      setCopyStatus("error")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    }
  }

  return (
    <div className="user-message-line">
      <p className="user-bubble">{text}</p>
      <button
        type="button"
        className={`prompt-copy-button ${copyStatus === "copied" ? "is-copied" : ""}`}
        onClick={copyPrompt}
        disabled={!canCopyPrompt}
        aria-label={copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー"}
        title={copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー"}
      >
        <Icon name={copyStatus === "copied" ? "check" : "copy"} />
      </button>
      {copyStatus !== "idle" && (
        <span className="sr-only" role="status" aria-live="polite">
          {copyStatus === "copied" ? "プロンプトをコピーしました" : "コピーに失敗しました"}
        </span>
      )}
    </div>
  )
}

function AssistantAnswer({
  message,
  linkedQuestion,
  loading,
  onCreateQuestion,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  message: Message
  linkedQuestion?: HumanQuestion
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
}) {
  const citations = message.result?.citations ?? []
  const [copyStatus, setCopyStatus] = useState<"idle" | "answer" | "error">("idle")
  const canCopyAnswer = Boolean(message.text.trim())

  async function copyText(value: string) {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus("answer")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    } catch (err) {
      console.warn("Failed to copy text", err)
      setCopyStatus("error")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    }
  }

  return (
    <div className="answer-card">
      <p className="answer-text">{message.text || "質問すると、社内ドキュメントに基づく回答と実行トレースが表示されます。"}</p>
      {citations.length > 0 && (
        <div className="answer-sources">
          <strong>根拠ドキュメント</strong>
          <ul>
            {citations.slice(0, 3).map((citation, index) => (
              <li key={`${citation.documentId}-${citation.chunkId ?? index}`}>
                <a href={`#source-${index}`}>{citation.fileName}</a>
                <span>score {citation.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="answer-footer">
        <span>根拠: ドキュメント {citations.length}件</span>
        <button
          type="button"
          className={`copy-action ${copyStatus === "answer" ? "is-copied" : ""}`}
          onClick={() => copyText(message.text)}
          disabled={!canCopyAnswer}
          aria-label={copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー"}
          title={copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー"}
        >
          <Icon name={copyStatus === "answer" ? "check" : "copy"} />
          <span>{copyStatus === "answer" ? "コピー済み" : "回答"}</span>
        </button>
      </div>
      {copyStatus !== "idle" && (
        <p className="copy-feedback" role="status" aria-live="polite">
          {copyStatus === "answer" && "回答をコピーしました"}
          {copyStatus === "error" && "コピーに失敗しました"}
        </p>
      )}
      {message.result && !message.result.isAnswerable && (
        <QuestionEscalationPanel message={message} questionTicket={linkedQuestion} loading={loading} onCreateQuestion={onCreateQuestion} />
      )}
      {linkedQuestion?.status === "answered" || linkedQuestion?.status === "resolved" ? (
        <QuestionAnswerPanel question={linkedQuestion} loading={loading} onResolveQuestion={onResolveQuestion} onAdditionalQuestion={onAdditionalQuestion} />
      ) : null}
    </div>
  )
}

function ChatEmptyState({ documentsCount, onSelectPrompt }: { documentsCount: number; onSelectPrompt: (value: string) => void }) {
  const prompts = [
    "社内規程の申請手順を確認したい",
    "この資料の重要ポイントを整理して",
    "担当部署へ確認が必要な内容を洗い出して"
  ]

  return (
    <section className="chat-empty-state" aria-label="チャット開始">
      <div className="empty-orbit" aria-hidden="true">
        <Icon name="logo" />
      </div>
      <div className="empty-copy">
        <span>{documentsCount > 0 ? `${documentsCount} 件の資料を参照できます` : "資料を添付して開始できます"}</span>
        <h2>何を確認しますか？</h2>
      </div>
      <div className="prompt-grid">
        {prompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => onSelectPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </section>
  )
}

function ProcessingAnswer({ label }: { label: string }) {
  return (
    <div className="answer-card processing-answer">
      <span className="loading-spinner" aria-hidden="true" />
      <p>
        {label}
        <span className="animated-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}

function QuestionEscalationPanel({
  message,
  questionTicket,
  loading,
  onCreateQuestion
}: {
  message: Message
  questionTicket?: HumanQuestion
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
}) {
  const sourceQuestion = message.sourceQuestion ?? ""
  const [title, setTitle] = useState(defaultQuestionTitle(sourceQuestion))
  const [body, setBody] = useState(defaultQuestionBody(sourceQuestion))
  const [category, setCategory] = useState("その他の質問")
  const [priority, setPriority] = useState<HumanQuestion["priority"]>("normal")
  const [assigneeDepartment, setAssigneeDepartment] = useState("総務部")

  if (questionTicket) {
    return (
      <section className="question-status-panel">
        <div>
          <strong>{questionTicket.status === "open" ? "担当者へ送信済み" : questionTicket.status === "answered" ? "担当者が回答済み" : "解決済み"}</strong>
          <span>{questionTicket.assigneeDepartment} / {formatDateTime(questionTicket.updatedAt)}</span>
        </div>
        <p>{questionTicket.title}</p>
      </section>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await onCreateQuestion({
      title,
      question: body,
      requesterName: "山田 太郎",
      requesterDepartment: "利用部門",
      assigneeDepartment,
      category,
      priority,
      sourceQuestion,
      chatAnswer: message.text,
      chatRunId: message.result?.debug?.runId
    })
  }

  return (
    <form className="question-escalation-panel" onSubmit={onSubmit} aria-label="担当者へ質問">
      <div className="question-panel-head">
        <div>
          <h3>担当者へ質問</h3>
          <span>自動表示</span>
        </div>
      </div>
      <label>
        <span>件名</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
      </label>
      <label>
        <span>質問内容</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} required />
      </label>
      <div className="question-form-grid">
        <label>
          <span>カテゴリ</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="その他の質問">その他の質問</option>
            <option value="手続き">手続き</option>
            <option value="社内制度">社内制度</option>
            <option value="資料確認">資料確認</option>
          </select>
        </label>
        <label>
          <span>優先度</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as HumanQuestion["priority"])}>
            <option value="normal">通常</option>
            <option value="high">高</option>
            <option value="urgent">緊急</option>
          </select>
        </label>
      </div>
      <label>
        <span>担当部署</span>
        <select value={assigneeDepartment} onChange={(event) => setAssigneeDepartment(event.target.value)}>
          <option value="総務部">総務部</option>
          <option value="人事部">人事部</option>
          <option value="情報システム部">情報システム部</option>
          <option value="経理部">経理部</option>
        </select>
      </label>
      <div className="question-form-actions">
        <span>通常 1 営業日以内に回答予定</span>
        <button type="submit" disabled={loading || !title.trim() || !body.trim()}>
          担当者へ送信
        </button>
      </div>
    </form>
  )
}

function QuestionAnswerPanel({
  question,
  loading,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  question: HumanQuestion
  loading: boolean
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
}) {
  return (
    <section className="question-answer-panel" aria-label="担当者からの回答">
      <header>
        <span className="status-dot"><Icon name="check" /></span>
        <div>
          <strong>担当者からの回答</strong>
          <span>{question.responderName ?? "担当者"}（{question.responderDepartment ?? question.assigneeDepartment}）</span>
        </div>
      </header>
      <p>{question.answerBody}</p>
      <dl>
        <div>
          <dt>回答日時</dt>
          <dd>{formatDateTime(question.answeredAt ?? question.updatedAt)}</dd>
        </div>
        {question.references && (
          <div>
            <dt>参照情報</dt>
            <dd>{question.references}</dd>
          </div>
        )}
      </dl>
      <footer>
        <button type="button" disabled={loading || question.status === "resolved"} onClick={() => onResolveQuestion(question.questionId)}>
          解決した
        </button>
        <button type="button" onClick={() => onAdditionalQuestion(`追加確認: ${question.title}\n`)}>
          追加で質問する
        </button>
      </footer>
    </section>
  )
}

function AssigneeWorkspace({
  questions,
  selectedQuestionId,
  loading,
  onSelect,
  onAnswer,
  onBack
}: {
  questions: HumanQuestion[]
  selectedQuestionId: string
  loading: boolean
  onSelect: (questionId: string) => void
  onAnswer: (questionId: string, input: Parameters<typeof answerQuestion>[1]) => Promise<void>
  onBack: () => void
}) {
  const selected = questions.find((question) => question.questionId === selectedQuestionId) ?? questions[0]
  const [answerTitle, setAnswerTitle] = useState("")
  const [answerBody, setAnswerBody] = useState("")
  const [references, setReferences] = useState("")
  const [internalMemo, setInternalMemo] = useState("")
  const [notifyRequester, setNotifyRequester] = useState(true)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setAnswerTitle(selected ? `${selected.title}への回答` : "")
    setAnswerBody(selected?.answerBody ?? "")
    setReferences(selected?.references ?? "")
    setInternalMemo(selected?.internalMemo ?? "")
    setNotifyRequester(selected?.notifyRequester ?? true)
    setDraftSavedAt(null)
    setIsDirty(false)
  }, [selected])

  function markDirty() {
    if (!isDirty) setIsDirty(true)
  }

  function onSaveDraft() {
    setDraftSavedAt(new Date())
    setIsDirty(false)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    await onAnswer(selected.questionId, {
      answerTitle,
      answerBody,
      responderName: "佐藤 花子",
      responderDepartment: selected.assigneeDepartment,
      references,
      internalMemo,
      notifyRequester
    })
    setDraftSavedAt(new Date())
    setIsDirty(false)
  }

  return (
    <section className="assignee-workspace" aria-label="担当者対応">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>担当者対応</h2>
          <span>{questions.filter((question) => question.status === "open").length} 件が対応待ち</span>
        </div>
      </header>
      {selected ? (
        <div className="assignee-grid">
          <aside className="question-list-panel">
            <h3>問い合わせ一覧</h3>
            <div className="question-list">
              {questions.map((question) => (
                <button
                  type="button"
                  className={`question-list-item ${question.questionId === selected.questionId ? "active" : ""}`}
                  key={question.questionId}
                  onClick={() => onSelect(question.questionId)}
                >
                  <strong>{question.title}</strong>
                  <span>{statusLabel(question.status)} / {question.assigneeDepartment}</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="question-detail-panel">
            <h3>問い合わせ概要</h3>
            <div className="requester-question">
              <span className="message-avatar">U</span>
              <p>{selected.question}</p>
            </div>
            <dl>
              <div><dt>ステータス</dt><dd>{statusLabel(selected.status)}</dd></div>
              <div><dt>優先度</dt><dd>{priorityLabel(selected.priority)}</dd></div>
              <div><dt>カテゴリ</dt><dd>{selected.category}</dd></div>
              <div><dt>受付日時</dt><dd>{formatDateTime(selected.createdAt)}</dd></div>
              <div><dt>質問者</dt><dd>{selected.requesterName}（{selected.requesterDepartment}）</dd></div>
              <div><dt>担当部署</dt><dd>{selected.assigneeDepartment}</dd></div>
            </dl>
            <h4>チャット履歴</h4>
            <div className="chat-excerpt">
              <strong>エージェント</strong>
              <p>{selected.chatAnswer || "資料からは回答できません。担当者へ確認します。"}</p>
            </div>
          </section>
          <form className="answer-form-panel" onSubmit={onSubmit}>
            <h3>回答作成</h3>
            <label>
              <span>回答タイトル</span>
              <input value={answerTitle} onChange={(event) => { setAnswerTitle(event.target.value); markDirty() }} maxLength={120} required />
            </label>
            <label>
              <span>回答内容</span>
              <textarea value={answerBody} onChange={(event) => { setAnswerBody(event.target.value); markDirty() }} maxLength={4000} required />
            </label>
            <label>
              <span>参照資料 / 関連リンク</span>
              <input value={references} onChange={(event) => { setReferences(event.target.value); markDirty() }} placeholder="資料名、URL、またはナレッジリンク" />
            </label>
            <label>
              <span>内部メモ</span>
              <textarea value={internalMemo} onChange={(event) => { setInternalMemo(event.target.value); markDirty() }} maxLength={1000} />
            </label>
            <label className="notify-row">
              <input type="checkbox" checked={notifyRequester} onChange={(event) => { setNotifyRequester(event.target.checked); markDirty() }} />
              <span>質問者へ通知する</span>
            </label>
            <div className="answer-draft-status" role="status" aria-live="polite">
              {isDirty ? "未保存の変更があります" : draftSavedAt ? `下書きを保存済み（${formatDateTime(draftSavedAt.toISOString())}）` : "下書きは未保存です"}
            </div>
            <div className="answer-form-actions">
              <button type="button" disabled={loading || !isDirty} onClick={onSaveDraft}>下書き保存</button>
              <button type="submit" disabled={loading || !answerTitle.trim() || !answerBody.trim()}>回答を送信</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="empty-question-panel">担当者へ送信された質問はまだありません。</div>
      )}
    </section>
  )
}

function AdminWorkspace({
  user,
  documentsCount,
  openQuestionsCount,
  debugRunsCount,
  benchmarkRunsCount,
  managedUsers,
  adminAuditLog,
  accessRoles,
  usageSummaries,
  costAudit,
  loading,
  canManageDocuments,
  canAnswerQuestions,
  canReadDebugRuns,
  canReadBenchmarkRuns,
  canOpenAdminSettings,
  canReadUsers,
  canCreateUsers,
  canSuspendUsers,
  canUnsuspendUsers,
  canDeleteUsers,
  canAssignRoles,
  canReadUsage,
  canReadCosts,
  canReadAdminAuditLog,
  onOpenDocuments,
  onOpenAssignee,
  onOpenDebug,
  onOpenBenchmark,
  onCreateUser,
  onAssignRoles,
  onSetUserStatus,
  onRefreshAdminData,
  onBack
}: {
  user: CurrentUser | null
  documentsCount: number
  openQuestionsCount: number
  debugRunsCount: number
  benchmarkRunsCount: number
  managedUsers: ManagedUser[]
  adminAuditLog: ManagedUserAuditLogEntry[]
  accessRoles: AccessRoleDefinition[]
  usageSummaries: UserUsageSummary[]
  costAudit: CostAuditSummary | null
  loading: boolean
  canManageDocuments: boolean
  canAnswerQuestions: boolean
  canReadDebugRuns: boolean
  canReadBenchmarkRuns: boolean
  canOpenAdminSettings: boolean
  canReadUsers: boolean
  canCreateUsers: boolean
  canSuspendUsers: boolean
  canUnsuspendUsers: boolean
  canDeleteUsers: boolean
  canAssignRoles: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  canReadAdminAuditLog: boolean
  onOpenDocuments: () => void
  onOpenAssignee: () => void
  onOpenDebug: () => void
  onOpenBenchmark: () => void
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
  onAssignRoles: (userId: string, groups: string[]) => Promise<void>
  onSetUserStatus: (userId: string, action: "suspend" | "unsuspend" | "delete") => Promise<void>
  onRefreshAdminData: () => Promise<void>
  onBack: () => void
}) {
  return (
    <section className="admin-workspace" aria-label="管理者設定">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>管理者設定</h2>
          <span>{user?.groups.join(" / ") || "権限未取得"}</span>
        </div>
      </header>

      <div className="admin-overview-grid">
        {canManageDocuments && (
          <button type="button" className="admin-overview-tile" onClick={onOpenDocuments}>
            <Icon name="document" />
            <strong>ドキュメント管理</strong>
            <span>{documentsCount} 件</span>
          </button>
        )}
        {canAnswerQuestions && (
          <button type="button" className="admin-overview-tile" onClick={onOpenAssignee}>
            <Icon name="inbox" />
            <strong>担当者対応</strong>
            <span>{openQuestionsCount} 件が対応待ち</span>
          </button>
        )}
        {canReadDebugRuns && (
          <button type="button" className="admin-overview-tile" onClick={onOpenDebug}>
            <Icon name="warning" />
            <strong>デバッグ / 評価</strong>
            <span>{debugRunsCount} 件の実行履歴</span>
          </button>
        )}
        {canReadBenchmarkRuns && (
          <button type="button" className="admin-overview-tile" onClick={onOpenBenchmark}>
            <Icon name="gauge" />
            <strong>性能テスト</strong>
            <span>{benchmarkRunsCount} 件の実行履歴</span>
          </button>
        )}
        {canOpenAdminSettings && (
          <div className="admin-overview-tile" aria-label="アクセス管理">
            <Icon name="settings" />
            <strong>アクセス管理</strong>
            <span>{accessRoles.length} role</span>
          </div>
        )}
        {canReadUsers && (
          <div className="admin-overview-tile" aria-label="ユーザー管理">
            <Icon name="settings" />
            <strong>ユーザー管理</strong>
            <span>{managedUsers.length} users</span>
          </div>
        )}
        {canReadUsage && (
          <div className="admin-overview-tile" aria-label="利用状況">
            <Icon name="gauge" />
            <strong>利用状況</strong>
            <span>{usageSummaries.length} users</span>
          </div>
        )}
        {canReadCosts && (
          <div className="admin-overview-tile" aria-label="コスト監査">
            <Icon name="warning" />
            <strong>コスト監査</strong>
            <span>{formatCurrency(costAudit?.totalEstimatedUsd ?? 0)}</span>
          </div>
        )}
      </div>

      <div className="phase2-admin-grid">
        {canReadUsers && (
          <section className="admin-section-panel user-admin-panel" aria-label="ユーザー管理一覧">
            <div className="document-list-head">
              <h3>ユーザー管理</h3>
              <button type="button" onClick={() => void onRefreshAdminData()} disabled={loading}>更新</button>
            </div>
            {canCreateUsers && (
              <AdminCreateUserForm roles={accessRoles} loading={loading} onCreateUser={onCreateUser} />
            )}
            <div className="admin-data-table" role="table" aria-label="ユーザー一覧">
              <div className="admin-user-row admin-user-head" role="row">
                <span role="columnheader">ユーザー</span>
                <span role="columnheader">状態</span>
                <span role="columnheader">ロール</span>
                <span role="columnheader">操作</span>
              </div>
              {managedUsers.length === 0 ? (
                <div className="empty-question-panel">管理対象ユーザーはありません。</div>
              ) : (
                managedUsers.map((managedUser) => (
                  <ManagedUserRow
                    key={managedUser.userId}
                    user={managedUser}
                    roles={accessRoles}
                    loading={loading}
                    canAssignRoles={canAssignRoles}
                    canSuspend={canSuspendUsers}
                    canUnsuspend={canUnsuspendUsers}
                    canDelete={canDeleteUsers}
                    onAssignRoles={onAssignRoles}
                    onSetStatus={onSetUserStatus}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {canOpenAdminSettings && (
          <section className="admin-section-panel" aria-label="ロール定義">
            <div className="document-list-head">
              <h3>ロール定義</h3>
              <span>{accessRoles.length} 件</span>
            </div>
            <div className="role-definition-list">
              {accessRoles.map((role) => (
                <article className="role-definition-card" key={role.role}>
                  <strong>{role.role}</strong>
                  <span>{role.permissions.length} permissions</span>
                  <p>{role.permissions.join(", ")}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {canReadUsage && (
          <section className="admin-section-panel" aria-label="利用状況一覧">
            <div className="document-list-head">
              <h3>利用状況</h3>
              <span>{usageSummaries.length} users</span>
            </div>
            <div className="usage-table" role="table" aria-label="利用状況">
              <div className="usage-row usage-head" role="row">
                <span role="columnheader">ユーザー</span>
                <span role="columnheader">chat</span>
                <span role="columnheader">文書</span>
                <span role="columnheader">問い合わせ</span>
                <span role="columnheader">benchmark</span>
                <span role="columnheader">debug</span>
                <span role="columnheader">最終利用</span>
              </div>
              {usageSummaries.map((item) => (
                <div className="usage-row" role="row" key={item.userId}>
                  <span role="cell">{item.email}</span>
                  <span role="cell">{item.chatMessages}</span>
                  <span role="cell">{item.documentCount}</span>
                  <span role="cell">{item.questionCount}</span>
                  <span role="cell">{item.benchmarkRunCount}</span>
                  <span role="cell">{item.debugRunCount}</span>
                  <span role="cell">{item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "-"}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {canReadCosts && costAudit && (
          <section className="admin-section-panel" aria-label="コスト監査一覧">
            <div className="document-list-head">
              <h3>コスト監査</h3>
              <span>{formatCurrency(costAudit.totalEstimatedUsd)}</span>
            </div>
            <div className="cost-summary-line">
              <span>{formatDate(costAudit.periodStart)} - {formatDate(costAudit.periodEnd)}</span>
              <span>pricing: {formatDate(costAudit.pricingCatalogUpdatedAt)}</span>
            </div>
            <div className="cost-item-list">
              {costAudit.items.map((item) => (
                <article className="cost-item" key={`${item.service}-${item.category}`}>
                  <div>
                    <strong>{item.service}</strong>
                    <span>{item.category}</span>
                  </div>
                  <div>
                    <span>{item.usage} {item.unit}</span>
                    <strong>{formatCurrency(item.estimatedCostUsd)}</strong>
                  </div>
                  <i>{costConfidenceLabel(item.confidence)}</i>
                </article>
              ))}
            </div>
          </section>
        )}

        {canReadAdminAuditLog && (
          <section className="admin-section-panel admin-audit-panel" aria-label="管理操作履歴">
            <div className="document-list-head">
              <h3>管理操作履歴</h3>
              <span>{adminAuditLog.length} 件</span>
            </div>
            <div className="admin-audit-list">
              {adminAuditLog.length === 0 ? (
                <div className="empty-question-panel">管理操作履歴はありません。</div>
              ) : (
                adminAuditLog.map((entry) => (
                  <article className="admin-audit-entry" key={entry.auditId}>
                    <div>
                      <strong>{adminAuditActionLabel(entry.action)}</strong>
                      <span>{entry.targetEmail}</span>
                    </div>
                    <div>
                      <span>{entry.actorEmail || entry.actorUserId}</span>
                      <time>{formatDateTime(entry.createdAt)}</time>
                    </div>
                    <small>{adminAuditSummary(entry)}</small>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

function AdminCreateUserForm({
  roles,
  loading,
  onCreateUser
}: {
  roles: AccessRoleDefinition[]
  loading: boolean
  onCreateUser: (input: { email: string; displayName?: string; groups?: string[] }) => Promise<void>
}) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState("CHAT_USER")

  useEffect(() => {
    if (roles.some((candidate) => candidate.role === role)) return
    setRole(roles[0]?.role ?? "CHAT_USER")
  }, [role, roles])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return
    await onCreateUser({
      email: normalizedEmail,
      displayName: displayName.trim() || undefined,
      groups: [role]
    })
    setEmail("")
    setDisplayName("")
    setRole("CHAT_USER")
  }

  return (
    <form className="admin-create-user-form" aria-label="管理対象ユーザー作成" onSubmit={(event) => void submit(event)}>
      <label>
        <span>メール</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="new-user@example.com" required />
      </label>
      <label>
        <span>表示名</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="任意" />
      </label>
      <label>
        <span>初期ロール</span>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((roleDefinition) => (
            <option value={roleDefinition.role} key={roleDefinition.role}>{roleDefinition.role}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={loading || email.trim().length === 0}>作成</button>
    </form>
  )
}

function ManagedUserRow({
  user,
  roles,
  loading,
  canAssignRoles,
  canSuspend,
  canUnsuspend,
  canDelete,
  onAssignRoles,
  onSetStatus
}: {
  user: ManagedUser
  roles: AccessRoleDefinition[]
  loading: boolean
  canAssignRoles: boolean
  canSuspend: boolean
  canUnsuspend: boolean
  canDelete: boolean
  onAssignRoles: (userId: string, groups: string[]) => Promise<void>
  onSetStatus: (userId: string, action: "suspend" | "unsuspend" | "delete") => Promise<void>
}) {
  const [selectedRole, setSelectedRole] = useState(user.groups[0] ?? "CHAT_USER")

  useEffect(() => {
    setSelectedRole(user.groups[0] ?? "CHAT_USER")
  }, [user.groups])

  return (
    <div className="admin-user-row" role="row">
      <span role="cell">
        <strong>{user.displayName || user.email}</strong>
        <small>{user.email}</small>
      </span>
      <span role="cell">
        <i className={`user-status ${user.status}`}>{managedUserStatusLabel(user.status)}</i>
      </span>
      <span role="cell">
        <div className="role-assignment">
          <select value={selectedRole} disabled={!canAssignRoles || loading} onChange={(event) => setSelectedRole(event.target.value)}>
            {roles.map((role) => (
              <option value={role.role} key={role.role}>{role.role}</option>
            ))}
          </select>
          <button type="button" disabled={!canAssignRoles || loading || user.groups.includes(selectedRole)} onClick={() => void onAssignRoles(user.userId, [selectedRole])}>
            付与
          </button>
        </div>
        <small>{user.groups.join(" / ")}</small>
      </span>
      <span role="cell">
        <div className="user-row-actions">
          {user.status === "suspended" ? (
            <button type="button" disabled={!canUnsuspend || loading} onClick={() => void onSetStatus(user.userId, "unsuspend")}>再開</button>
          ) : (
            <button type="button" disabled={!canSuspend || loading} onClick={() => void onSetStatus(user.userId, "suspend")}>停止</button>
          )}
          <button type="button" disabled={!canDelete || loading} onClick={() => void onSetStatus(user.userId, "delete")}>削除</button>
        </div>
      </span>
    </div>
  )
}

function defaultQuestionTitle(sourceQuestion: string): string {
  const compact = sourceQuestion.replace(/\s+/g, " ").trim()
  return compact ? `${compact.slice(0, 42)}について確認したい` : "資料外の内容について確認したい"
}

function defaultQuestionBody(sourceQuestion: string): string {
  const compact = sourceQuestion.trim()
  return compact
    ? `${compact}\n\n資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。`
    : "資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。"
}

function getLinkedQuestion(message: Message, questions: HumanQuestion[]): HumanQuestion | undefined {
  if (message.questionTicket) {
    return questions.find((question) => question.questionId === message.questionTicket?.questionId) ?? message.questionTicket
  }
  return questions.find((question) => question.sourceQuestion && question.sourceQuestion === message.sourceQuestion)
}

function summarizeTitle(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= 36 ? trimmed : `${trimmed.slice(0, 36)}…`
}

function createConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
