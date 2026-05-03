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
import { AppRoutes } from "./AppRoutes.js"
import { RailNav } from "./components/RailNav.js"
import { TopBar } from "./components/TopBar.js"
import type { AppView } from "./types.js"
import { formatLatency } from "../shared/utils/format.js"

import type { Message } from "../features/chat/types.js"

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

        <AppRoutes
          activeView={activeView}
          canAnswerQuestions={canAnswerQuestions}
          canReadBenchmarkRuns={canReadBenchmarkRuns}
          canManageDocuments={canManageDocuments}
          canSeeAdminSettings={canSeeAdminSettings}
          chatProps={{
            messages: visibleMessages,
            questions,
            documentsCount: documents.length,
            isProcessing,
            pendingActivity,
            latestMessageRef,
            loading,
            canAsk,
            canWriteDocuments,
            file,
            conversationKey,
            submitShortcut,
            question,
            debugMode,
            canReadDebugRuns,
            selectedTrace,
            pendingDebugQuestion,
            allExpanded,
            expandedStepId,
            onAsk,
            onSetQuestion: setQuestion,
            onSetFile: setFile,
            onSetSubmitShortcut: setSubmitShortcut,
            onCreateQuestion,
            onResolveQuestion,
            onToggleAllDebugSteps: () => setAllExpanded((value) => !value),
            onToggleDebugStep: (stepId) => setExpandedStepId((current) => (current === stepId ? null : stepId))
          }}
          assigneeProps={{
            questions,
            selectedQuestionId,
            loading,
            onSelect: setSelectedQuestionId,
            onAnswer: onAnswerQuestion,
            onBack: () => setActiveView("chat")
          }}
          benchmarkProps={{
            runs: benchmarkRuns,
            suites: benchmarkSuites,
            suiteId: benchmarkSuiteId,
            modelId: benchmarkModelId,
            concurrency: benchmarkConcurrency,
            loading,
            canRun: canRunBenchmark,
            canCancel: canCancelBenchmark,
            canDownload: canDownloadBenchmark,
            onSuiteChange: setBenchmarkSuiteId,
            onModelChange: setBenchmarkModelId,
            onConcurrencyChange: setBenchmarkConcurrency,
            onStart: onStartBenchmark,
            onRefresh: () => refreshBenchmarkRuns().catch((err) => setError(err instanceof Error ? err.message : String(err))),
            onCancel: onCancelBenchmark,
            onBack: () => setActiveView("chat")
          }}
          documentProps={{
            documents,
            loading,
            canWrite: canWriteDocuments,
            canDelete: canDeleteDocuments,
            onUpload: onUploadDocumentFile,
            onDelete,
            onBack: () => setActiveView("admin")
          }}
          adminProps={{
            user: currentUser,
            documentsCount: documents.length,
            openQuestionsCount: questions.filter((questionItem) => questionItem.status === "open").length,
            debugRunsCount: debugRuns.length,
            benchmarkRunsCount: benchmarkRuns.length,
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
            onOpenDocuments: () => setActiveView("documents"),
            onOpenAssignee: () => setActiveView("assignee"),
            onOpenDebug: () => {
              setDebugMode(true)
              setActiveView("chat")
            },
            onOpenBenchmark: () => setActiveView("benchmark"),
            onCreateUser: onCreateManagedUser,
            onAssignRoles: onAssignUserRoles,
            onSetUserStatus: onSetManagedUserStatus,
            onRefreshAdminData: () =>
              Promise.all([
                canReadUsers ? refreshManagedUsers() : Promise.resolve(),
                canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
                canOpenAdminSettings ? refreshAccessRoles() : Promise.resolve(),
                canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
                canReadCosts ? refreshCostAudit() : Promise.resolve()
              ]).then(() => undefined),
            onBack: () => setActiveView("chat")
          }}
          historyProps={{
            history,
            onSelect: (item) => {
              setCurrentConversationId(item.id)
              setMessages(item.messages)
              setActiveView("chat")
              setError(null)
              setSelectedRunId("")
              setPendingActivity(null)
              setPendingDebugQuestion(null)
            },
            onDelete: (id) => {
              setHistory((prev) => prev.filter((entry) => entry.id !== id))
              deleteConversationHistory(id).catch((err) => {
                console.warn("Failed to delete conversation history", err)
                setError(err instanceof Error ? err.message : String(err))
              })
            },
            onToggleFavorite: toggleFavorite,
            onBack: () => setActiveView("chat")
          }}
        />

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

function summarizeTitle(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= 36 ? trimmed : `${trimmed.slice(0, 36)}…`
}

function createConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
