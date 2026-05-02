import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  assignUserRoles,
  answerQuestion,
  cancelBenchmarkRun,
  chat,
  createBenchmarkDownload,
  createQuestion,
  createDebugDownload,
  deleteManagedUser,
  deleteConversationHistory,
  deleteDocument,
  fileToBase64,
  getCostAuditSummary,
  getMe,
  listAccessRoles,
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
  type DebugStep,
  type DebugTrace,
  type DocumentManifest,
  type HumanQuestion,
  type ManagedUser,
  type Permission,
  type UserUsageSummary
} from "./api.js"
import { completeNewPasswordChallenge, confirmSignUp, getStoredAuthSession, signIn, signOut, signUp, type AuthSession } from "./authClient.js"
import LoginPage from "./LoginPage.js"

type Message = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponse
  questionTicket?: HumanQuestion
}

type IconName =
  | "logo"
  | "chat"
  | "clock"
  | "star"
  | "document"
  | "settings"
  | "paperclip"
  | "send"
  | "chevron"
  | "check"
  | "warning"
  | "expand"
  | "plus"
  | "download"
  | "trash"
  | "inbox"
  | "copy"
  | "gauge"
  | "stop"

type AppView = "chat" | "assignee" | "history" | "benchmark" | "admin" | "documents"

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

export default function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession())
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [documents, setDocuments] = useState<DocumentManifest[]>([])
  const [debugRuns, setDebugRuns] = useState<DebugTrace[]>([])
  const [benchmarkRuns, setBenchmarkRuns] = useState<BenchmarkRun[]>([])
  const [benchmarkSuites, setBenchmarkSuites] = useState<BenchmarkSuite[]>([])
  const [questions, setQuestions] = useState<HumanQuestion[]>([])
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
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
  const canSuspendUsers = hasPermission("user:suspend")
  const canUnsuspendUsers = hasPermission("user:unsuspend")
  const canDeleteUsers = hasPermission("user:delete")
  const canAssignRoles = hasPermission("access:role:assign")
  const canReadUsage = hasPermission("usage:read:all_users")
  const canReadCosts = hasPermission("cost:read:all")
  const canManageDocuments = canWriteDocuments || canDeleteDocuments
  const canManageUsers = canReadUsers || canAssignRoles || canSuspendUsers || canUnsuspendUsers || canDeleteUsers
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
    rememberConversation(buildConversationHistoryItem(currentConversationId, titleCandidate, messages))
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

  if (!authSession) {
    return (
      <LoginPage
        onLogin={async (payload) => {
          const result = await signIn(payload)
          if (!("type" in result)) setAuthSession(result)
          return result
        }}
        onSignUp={signUp}
        onConfirmSignUp={confirmSignUp}
        onCompleteNewPassword={async (payload) => {
          const session = await completeNewPasswordChallenge(payload)
          setAuthSession(session)
          return session
        }}
      />
    )
  }

  async function refreshDocuments() {
    const nextDocuments = await listDocuments()
    setDocuments(nextDocuments)
    if (selectedDocumentId !== "all" && !nextDocuments.some((document) => document.documentId === selectedDocumentId)) {
      setSelectedDocumentId("all")
    }
  }

  function onSignOut() {
    signOut()
    setAuthSession(null)
    setCurrentUser(null)
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
    setHistory((prev) => [item, ...prev.filter((entry) => entry.id !== item.id)].slice(0, 20))
    saveConversationHistory(item).catch((err) => console.warn("Failed to save conversation history", err))
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
      rememberConversation(buildConversationHistoryItem(currentConversationId, titleCandidate, messages))
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
      <aside className="rail" aria-label="主要ナビゲーション">
        <a className="rail-logo" href="/" aria-label="ホーム">
          <Icon name="logo" />
        </a>
        <nav className="rail-nav">
          <button className={`rail-item ${activeView === "chat" ? "active" : ""}`} type="button" title="チャット" onClick={() => setActiveView("chat")}>
            <Icon name="chat" />
            <span>チャット</span>
          </button>
          {canAnswerQuestions && (
            <button className={`rail-item ${activeView === "assignee" ? "active" : ""}`} type="button" title="担当者対応" onClick={() => setActiveView("assignee")}>
              <Icon name="inbox" />
              <span>担当者対応</span>
            </button>
          )}
          <button className={`rail-item ${activeView === "history" ? "active" : ""}`} type="button" title="履歴" onClick={() => setActiveView("history")}>
            <Icon name="clock" />
            <span>履歴</span>
          </button>
          {canReadBenchmarkRuns && (
            <button className={`rail-item ${activeView === "benchmark" ? "active" : ""}`} type="button" title="性能テスト" onClick={() => setActiveView("benchmark")}>
              <Icon name="gauge" />
              <span>性能テスト</span>
            </button>
          )}
          <button className="rail-item" type="button" title="お気に入り">
            <Icon name="star" />
            <span>お気に入り</span>
          </button>
          {canManageDocuments && (
            <button className={`rail-item ${activeView === "documents" ? "active" : ""}`} type="button" title="ドキュメント" onClick={() => setActiveView("documents")}>
              <Icon name="document" />
              <span>ドキュメント</span>
            </button>
          )}
          {canSeeAdminSettings && (
            <button className={`rail-item ${activeView === "admin" ? "active" : ""}`} type="button" title="管理者設定" onClick={() => setActiveView("admin")}>
              <Icon name="settings" />
              <span>管理者設定</span>
            </button>
          )}
        </nav>
        <button className="account-button" type="button" title="サインアウト" onClick={onSignOut}>
          <span className="account-avatar">{authSession.email.slice(0, 1).toUpperCase()}</span>
          <span>{authSession.email}</span>
          <Icon name="chevron" />
        </button>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <h1>社内QAチャットボットエージェント</h1>
          <label className="top-control">
            <span>モデル</span>
            <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
              <option value="amazon.nova-lite-v1:0">Nova Lite v1</option>
              <option value="anthropic.claude-3-5-sonnet-20240620-v1:0">Claude 3.5 Sonnet</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
            </select>
          </label>
          {canReadDocuments && (
            <div className="top-control document-control">
              <label htmlFor="document-select">ドキュメント</label>
              <div className="document-select-row">
                <select id="document-select" value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
                  <option value="all">すべての資料</option>
                  {documents.map((document) => (
                    <option value={document.documentId} key={document.documentId}>
                      {document.fileName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {canReadDebugRuns && (
            <>
              <label className="top-control run-control">
                <span>実行ID</span>
                <select
                  value={selectedRunValue}
                  onChange={(event) => setSelectedRunId(event.target.value)}
                  disabled={pendingDebugQuestion !== null || (debugRuns.length === 0 && !latestTrace)}
                >
                  {pendingDebugQuestion ? <option value="__processing__">処理中</option> : <option value="">未実行</option>}
                  {(latestTrace && !debugRuns.some((run) => run.runId === latestTrace.runId) ? [latestTrace, ...debugRuns] : debugRuns).map((run) => (
                    <option value={run.runId} key={run.runId}>
                      {run.runId}
                    </option>
                  ))}
                </select>
              </label>
              <div className="latency-block">
                <span>総レイテンシ</span>
                <strong>{totalLatency}</strong>
              </div>
              <label className="debug-toggle">
                <span>デバッグモード</span>
                <input type="checkbox" checked={debugMode} onChange={(event) => setDebugMode(event.target.checked)} />
                <i aria-hidden="true">{debugMode ? "ON" : "OFF"}</i>
              </label>
            </>
          )}
          <button className="new-chat-button" type="button" onClick={newConversation}>
            <Icon name="plus" />
            <span>新しい会話</span>
          </button>
        </header>

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
            canSuspendUsers={canSuspendUsers}
            canUnsuspendUsers={canUnsuspendUsers}
            canDeleteUsers={canDeleteUsers}
            canAssignRoles={canAssignRoles}
            canReadUsage={canReadUsage}
            canReadCosts={canReadCosts}
            onOpenDocuments={() => setActiveView("documents")}
            onOpenAssignee={() => setActiveView("assignee")}
            onOpenDebug={() => {
              setDebugMode(true)
              setActiveView("chat")
            }}
            onOpenBenchmark={() => setActiveView("benchmark")}
            onAssignRoles={onAssignUserRoles}
            onSetUserStatus={onSetManagedUserStatus}
            onRefreshAdminData={() =>
              Promise.all([
                canReadUsers ? refreshManagedUsers() : Promise.resolve(),
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
            onBack={() => setActiveView("chat")}
          />
        )}
      </section>
    </main>
  )
}

function buildConversationHistoryItem(id: string, titleCandidate: string, messages: Message[]): ConversationHistoryItem {
  return {
    schemaVersion: 1,
    id,
    title: summarizeTitle(titleCandidate),
    updatedAt: new Date().toISOString(),
    messages
  }
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

function BenchmarkWorkspace({
  runs,
  suites,
  suiteId,
  modelId,
  concurrency,
  loading,
  canRun,
  canCancel,
  canDownload,
  onSuiteChange,
  onModelChange,
  onConcurrencyChange,
  onStart,
  onRefresh,
  onCancel,
  onBack
}: {
  runs: BenchmarkRun[]
  suites: BenchmarkSuite[]
  suiteId: string
  modelId: string
  concurrency: number
  loading: boolean
  canRun: boolean
  canCancel: boolean
  canDownload: boolean
  onSuiteChange: (suiteId: string) => void
  onModelChange: (modelId: string) => void
  onConcurrencyChange: (concurrency: number) => void
  onStart: () => Promise<void>
  onRefresh: () => void
  onCancel: (runId: string) => Promise<void>
  onBack: () => void
}) {
  const selectedSuite = suites.find((suite) => suite.suiteId === suiteId)
  const summary = summarizeBenchmarkRuns(runs)

  return (
    <section className="benchmark-workspace" aria-label="性能テスト">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>性能テスト</h2>
          <span>{runs.length} 件の実行履歴</span>
        </div>
      </header>

      <div className="benchmark-kpi-grid">
        <BenchmarkMetricCard
          title="最新テスト結果"
          value={summary.latestRun ? runStatusLabel(summary.latestRun.status) : "未実行"}
          subValue={summary.latestRun ? `実行ID: ${summary.latestRun.runId}` : "ジョブ起動後に表示"}
          tone={summary.latestRun?.status ?? "queued"}
        />
        <BenchmarkMetricCard title="平均応答時間" value={formatMetricLatency(summary.averageLatencyMs)} subValue="直近完了 run の平均" />
        <BenchmarkMetricCard title="回答正答率" value={formatPercent(summary.answerableAccuracy)} subValue="answerable accuracy" />
        <BenchmarkMetricCard title="検索再現率" value={formatPercent(summary.retrievalRecallAt20)} subValue="retrieval recall@20" />
      </div>

      <div className="benchmark-layout">
        <section className="benchmark-run-panel">
          <h3><Icon name="gauge" />ジョブ起動</h3>
          <p className="benchmark-run-panel-note">ワンクリックで選択 suite を実行します。</p>
          <label>
            <span>テスト種別</span>
            <select value={suiteId} onChange={(event) => onSuiteChange(event.target.value)}>
              {suites.length === 0 && <option value={suiteId}>standard-agent-v1</option>}
              {suites.map((suite) => (
                <option value={suite.suiteId} key={suite.suiteId}>
                  {suite.label}
                </option>
              ))}
            </select>
          </label>
          <div className="benchmark-mode-grid">
            <div>
              <span>対象</span>
              <strong>{selectedSuite?.mode === "agent" ? "エージェント" : selectedSuite?.mode ?? "agent"}</strong>
            </div>
            <div>
              <span>Runner</span>
              <strong>CodeBuild</strong>
            </div>
          </div>
          <label>
            <span>データセット</span>
            <input value={selectedSuite?.datasetS3Key ?? "datasets/agent/standard-v1.jsonl"} readOnly />
          </label>
          <label>
            <span>モデル</span>
            <select value={modelId} onChange={(event) => onModelChange(event.target.value)}>
              <option value="amazon.nova-lite-v1:0">Nova Lite v1</option>
              <option value="anthropic.claude-3-5-sonnet-20240620-v1:0">Claude 3.5 Sonnet</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
            </select>
          </label>
          <label>
            <span>並列数</span>
            <input
              type="number"
              min={1}
              max={20}
              value={concurrency}
              onChange={(event) => onConcurrencyChange(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
            />
          </label>
          <div className="benchmark-actions">
            <button type="button" onClick={onStart} disabled={loading || !canRun}>
              <Icon name="send" />
              <span>性能テストを実行</span>
            </button>
            <button type="button" onClick={onRefresh} disabled={loading}>
              <Icon name="clock" />
              <span>更新</span>
            </button>
          </div>
        </section>

        <section className="benchmark-history-panel">
          <div className="history-list-head">
            <h3>実行履歴</h3>
            <span>{runs.length} 件</span>
          </div>
          <div className="benchmark-table-wrap">
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>runId</th>
                  <th>status</th>
                  <th>suite</th>
                  <th>p50</th>
                  <th>p95</th>
                  <th>accuracy</th>
                  <th>recall</th>
                  <th>startedAt</th>
                  <th>report</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={9}>実行履歴はまだありません。</td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.runId}>
                      <td><code>{run.runId}</code></td>
                      <td><span className={`run-status ${run.status}`}>{runStatusLabel(run.status)}</span></td>
                      <td>{run.suiteId}</td>
                      <td>{formatMetricLatency(run.metrics?.p50LatencyMs)}</td>
                      <td>{formatMetricLatency(run.metrics?.p95LatencyMs)}</td>
                      <td>{formatPercent(run.metrics?.answerableAccuracy)}</td>
                      <td>{formatPercent(run.metrics?.retrievalRecallAt20)}</td>
                      <td>{formatDateTime(run.startedAt ?? run.createdAt)}</td>
                      <td>
                        <div className="benchmark-row-actions">
                          <button type="button" title="レポートをダウンロード" disabled={!canDownload || !run.reportS3Key} onClick={() => void downloadBenchmarkArtifact(run.runId, "report")}>
                            <Icon name="download" />
                          </button>
                          <button type="button" title="ジョブをキャンセル" disabled={!canCancel || loading || !["queued", "running"].includes(run.status)} onClick={() => void onCancel(run.runId)}>
                            <Icon name="stop" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="benchmark-summary-grid">
        <section className="benchmark-summary-panel">
          <div className="history-list-head">
            <h3>結果サマリー</h3>
            <span>{summary.completedCount} 件の完了 run</span>
          </div>
          <div className="benchmark-trend-bars" aria-label="p95応答時間推移">
            {summary.trendRuns.length === 0 ? (
              <span>完了 run の metrics が登録されると推移を表示します。</span>
            ) : (
              summary.trendRuns.map((run) => (
                <div className="benchmark-trend-bar" key={run.runId}>
                  <i style={{ height: `${Math.max(12, Math.min(108, (run.metrics?.p95LatencyMs ?? 0) / 25))}px` }} />
                  <strong>{formatShortDate(run.completedAt ?? run.updatedAt)}</strong>
                </div>
              ))
            )}
          </div>
          <div className="benchmark-quality-grid">
            <div><span>成功率</span><strong>{formatPercent(summary.runSuccessRate)}</strong></div>
            <div><span>エラー率</span><strong>{formatPercent(summary.errorRate)}</strong></div>
            <div><span>失敗HTTP</span><strong>{summary.failedHttpCount}</strong></div>
          </div>
        </section>

        <section className="benchmark-contract-panel">
          <div className="history-list-head">
            <h3>必要なAPI/データ</h3>
            <span>main 実装を利用</span>
          </div>
          <ul>
            <li><code>GET /benchmark-suites</code><span>実行可能な suite と dataset を取得</span></li>
            <li><code>POST /benchmark-runs</code><span>性能テスト run を queue に登録</span></li>
            <li><code>GET /benchmark-runs</code><span>履歴、status、metrics、artifact key を取得</span></li>
            <li><code>BenchmarkRunsTable</code><span><code>runId</code> 単位で実行状態と metrics を保持</span></li>
          </ul>
        </section>
      </div>
    </section>
  )
}

function DocumentWorkspace({
  documents,
  loading,
  canWrite,
  canDelete,
  onUpload,
  onDelete,
  onBack
}: {
  documents: DocumentManifest[]
  loading: boolean
  canWrite: boolean
  canDelete: boolean
  onUpload: (file: File) => Promise<void>
  onDelete: (documentId: string) => Promise<void>
  onBack: () => void
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canWrite) return
    await onUpload(uploadFile)
    setUploadFile(null)
  }

  return (
    <section className="admin-workspace" aria-label="ドキュメント管理">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="管理者設定へ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>ドキュメント管理</h2>
          <span>{documents.length} 件の登録文書</span>
        </div>
      </header>

      <div className="document-admin-grid">
        <section className="document-admin-panel" aria-label="文書アップロード">
          <h3>アップロード</h3>
          <form className="document-upload-form" onSubmit={onSubmit}>
            <label className="document-upload-drop">
              <Icon name="paperclip" />
              <span>{uploadFile ? uploadFile.name : "ファイルを選択"}</span>
              <input type="file" disabled={!canWrite || loading} onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </label>
            <button type="submit" disabled={!canWrite || !uploadFile || loading}>
              アップロード
            </button>
          </form>
        </section>

        <section className="document-admin-panel document-list-panel" aria-label="登録文書一覧">
          <div className="document-list-head">
            <h3>登録文書</h3>
            <span>{documents.length} 件</span>
          </div>
          <div className="document-table" role="table" aria-label="登録文書">
            <div className="document-table-row document-table-head" role="row">
              <span role="columnheader">ファイル名</span>
              <span role="columnheader">チャンク</span>
              <span role="columnheader">メモリ</span>
              <span role="columnheader">登録日時</span>
              <span role="columnheader">操作</span>
            </div>
            {documents.length === 0 ? (
              <div className="empty-question-panel">登録済みドキュメントはありません。</div>
            ) : (
              documents.map((document) => (
                <div className="document-table-row" role="row" key={document.documentId}>
                  <span role="cell">{document.fileName}</span>
                  <span role="cell">{document.chunkCount}</span>
                  <span role="cell">{document.memoryCardCount}</span>
                  <span role="cell">{formatDateTime(document.createdAt)}</span>
                  <span role="cell">
                    <button
                      type="button"
                      className="delete-document-button"
                      title={`${document.fileName}を削除`}
                      disabled={!canDelete || loading}
                      onClick={() => onDelete(document.documentId)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
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
  canSuspendUsers,
  canUnsuspendUsers,
  canDeleteUsers,
  canAssignRoles,
  canReadUsage,
  canReadCosts,
  onOpenDocuments,
  onOpenAssignee,
  onOpenDebug,
  onOpenBenchmark,
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
  canSuspendUsers: boolean
  canUnsuspendUsers: boolean
  canDeleteUsers: boolean
  canAssignRoles: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  onOpenDocuments: () => void
  onOpenAssignee: () => void
  onOpenDebug: () => void
  onOpenBenchmark: () => void
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
      </div>
    </section>
  )
}

function BenchmarkMetricCard({
  title,
  value,
  subValue,
  tone = "succeeded"
}: {
  title: string
  value: string
  subValue: string
  tone?: BenchmarkRun["status"]
}) {
  return (
    <article className={`benchmark-kpi-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{subValue}</small>
    </article>
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

function HistoryWorkspace({
  history,
  onSelect,
  onDelete,
  onBack
}: {
  history: ConversationHistoryItem[]
  onSelect: (item: ConversationHistoryItem) => void
  onDelete: (id: string) => void
  onBack: () => void
}) {
  const [query, setQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "messages">("newest")

  const visibleHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = normalizedQuery.length === 0
      ? history
      : history.filter((item) => {
          const messageText = item.messages.map((message) => message.text).join(" ").toLowerCase()
          return item.title.toLowerCase().includes(normalizedQuery) || messageText.includes(normalizedQuery)
        })

    return [...filtered].sort((a, b) => {
      if (sortOrder === "messages") return b.messages.length - a.messages.length
      const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return sortOrder === "newest" ? timeDiff : -timeDiff
    })
  }, [history, query, sortOrder])

  return (
    <section className="assignee-workspace" aria-label="履歴">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>履歴</h2>
          <span>{history.length} 件の会話</span>
        </div>
      </header>
      <div className="question-list-panel history-panel">
        <div className="history-list-head">
          <h3>会話一覧</h3>
          <span>{visibleHistory.length} 件を表示中</span>
        </div>
        <div className="history-toolbar">
          <input
            type="search"
            placeholder="タイトルや会話内容で検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="履歴を検索"
          />
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest" | "messages")} aria-label="履歴の並び順">
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
            <option value="messages">メッセージ数順</option>
          </select>
        </div>
        <div className="question-list history-list">
          {visibleHistory.length === 0 ? (
            <div className="empty-question-panel">条件に一致する履歴はありません。</div>
          ) : (
            visibleHistory.map((item) => (
              <div className="question-list-item history-item" key={item.id}>
                <button type="button" onClick={() => onSelect(item)}>
                  <strong>{item.title}</strong>
                  <span>{formatDateTime(item.updatedAt)}</span>
                  <small>{item.messages.length} メッセージ</small>
                </button>
                <button type="button" onClick={() => onDelete(item.id)}>
                  削除
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function DebugPanel({
  trace,
  pending = false,
  pendingQuestion,
  allExpanded,
  expandedStepId,
  onToggleAll,
  onToggleStep
}: {
  trace?: DebugTrace
  pending?: boolean
  pendingQuestion?: string
  allExpanded: boolean
  expandedStepId: number | null
  onToggleAll: () => void
  onToggleStep: (stepId: number) => void
}) {
  const steps = pending ? getProcessingSteps(pendingQuestion) : trace?.steps ?? getPlaceholderSteps()
  const statusLabel = pending ? "処理中" : trace ? (trace.status === "success" ? "成功" : trace.status === "warning" ? "注意" : "失敗") : "未実行"

  return (
    <aside className={`debug-card ${pending ? "processing" : ""}`} aria-label="デバッグパネル" aria-busy={pending}>
      <header className="debug-head">
        <div>
          <h2>デバッグパネル</h2>
          <span>{pending ? "実行中" : `${steps.length} ステップ`}</span>
        </div>
        <div className="debug-head-actions">
          <button type="button" onClick={() => void downloadDebugTrace(trace)} disabled={!trace || pending} title="JSONでダウンロード">
            <Icon name="download" />
            <span>JSON DL</span>
          </button>
          <button type="button" onClick={onToggleAll}>{allExpanded ? "すべて閉じる" : "すべて展開"}</button>
          <button type="button" title="拡大表示">
            <Icon name="expand" />
          </button>
        </div>
      </header>

      <div className="debug-steps">
        {steps.map((step) => {
          const expanded = allExpanded || expandedStepId === step.id
          return (
            <article className={`debug-step ${step.status} ${pending ? "processing" : ""}`} key={step.id}>
              <div className="step-index">{step.id}</div>
              <div className="step-body">
                <button className="step-summary" type="button" onClick={() => onToggleStep(step.id)}>
                  <span className="step-state">
                    {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={step.status === "warning" ? "warning" : "check"} />}
                  </span>
                  <strong>{step.label}</strong>
                  <span className="step-latency">{formatLatency(step.latencyMs)}</span>
                  {step.modelId && <span className="model-chip">{step.modelId}</span>}
                  {step.hitCount !== undefined && <span className="sub-chip">ヒット数: {step.hitCount}件</span>}
                  {step.tokenCount !== undefined && <span className="sub-chip">トークン: {step.tokenCount}</span>}
                  <span className="step-description">{step.summary}</span>
                  <Icon name="chevron" />
                </button>
                {expanded && step.detail && <pre className="step-detail">{step.detail}</pre>}
              </div>
            </article>
          )
        })}
      </div>

      <footer className={`debug-footer ${pending ? "processing" : trace?.status ?? "idle"}`}>
        <span className="footer-status">
          {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={trace?.status === "warning" ? "warning" : "check"} />}
          <strong>{statusLabel}</strong>
        </span>
        <span>{pending ? "検索と回答生成を実行しています" : trace ? (trace.isAnswerable ? "正常に完了しました" : "回答拒否として完了しました") : "質問すると実行トレースを保存します"}</span>
        <span className="footer-latency">合計レイテンシ <strong>{pending ? "計測中" : trace ? formatLatency(trace.totalLatencyMs) : "-"}</strong></span>
      </footer>
    </aside>
  )
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      {getIconPath(name)}
    </svg>
  )
}

function getIconPath(name: IconName) {
  switch (name) {
    case "logo":
      return <path d="M5 4h9a5 5 0 0 1 5 5v6.5a4.5 4.5 0 0 1-4.5 4.5H10l-5 3v-3.2A5 5 0 0 1 1 15V8a4 4 0 0 1 4-4Zm2 6h7v2H7v-2Zm0 4h5v2H7v-2Zm10 3.2 3 1.8v-2.2a4 4 0 0 0 3-3.8V8.5a3.5 3.5 0 0 0-3.5-3.5h-.9A6.8 6.8 0 0 1 21 10v5a3 3 0 0 1-4 2.8v-.6Z" />
    case "chat":
      return <path d="M4 5h16v11H8l-4 3V5Zm4 4v2h8V9H8Zm0 4v2h5v-2H8Z" />
    case "clock":
      return <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v4.4l3.2 1.9-1 1.7-4.2-2.5V7h2Z" />
    case "star":
      return <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    case "document":
      return <path d="M6 3h8l4 4v14H6V3Zm7 2.5V8h2.5L13 5.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" />
    case "settings":
      return <path d="m13.3 3 .6 2a7.8 7.8 0 0 1 1.7.7l1.9-1 2 2-1 1.9c.3.5.5 1.1.7 1.7l2 .6v2.8l-2 .6a7.8 7.8 0 0 1-.7 1.7l1 1.9-2 2-1.9-1c-.5.3-1.1.5-1.7.7l-.6 2h-2.8l-.6-2a7.8 7.8 0 0 1-1.7-.7l-1.9 1-2-2 1-1.9a7.8 7.8 0 0 1-.7-1.7l-2-.6v-2.8l2-.6c.2-.6.4-1.2.7-1.7l-1-1.9 2-2 1.9 1c.5-.3 1.1-.5 1.7-.7l.6-2h2.8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    case "paperclip":
      return <path d="m7.4 13.6 7-7a3.3 3.3 0 0 1 4.7 4.7l-8 8a5 5 0 0 1-7.1-7.1l8.4-8.4 1.4 1.4-8.4 8.4a3 3 0 0 0 4.3 4.3l8-8a1.3 1.3 0 1 0-1.9-1.9l-7 7a.9.9 0 0 0 1.3 1.3l5.9-5.9 1.4 1.4-5.9 5.9a2.9 2.9 0 0 1-4.1-4.1Z" />
    case "send":
      return <path d="M3 20 21 12 3 4v6l10 2-10 2v6Z" />
    case "chevron":
      return <path d="m7 9 5 5 5-5 1.4 1.4L12 16.8l-6.4-6.4L7 9Z" />
    case "check":
      return <path d="M9.5 16.6 4.8 12l1.4-1.4 3.3 3.2 8.3-8.4 1.4 1.4-9.7 9.8Z" />
    case "warning":
      return <path d="M12 3 22 20H2L12 3Zm-1 6v5h2V9h-2Zm0 7v2h2v-2h-2Z" />
    case "expand":
      return <path d="M4 4h7v2H7.4l4.2 4.2-1.4 1.4L6 7.4V11H4V4Zm9 0h7v7h-2V7.4l-4.2 4.2-1.4-1.4L16.6 6H13V4ZM6 16.6l4.2-4.2 1.4 1.4L7.4 18H11v2H4v-7h2v3.6Zm7.8-4.2 4.2 4.2V13h2v7h-7v-2h3.6l-4.2-4.2 1.4-1.4Z" />
    case "plus":
      return <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
    case "download":
      return <path d="M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3V3Zm-6 15h14v3H5v-3Z" />
    case "trash":
      return <path d="M8 3h8l1 2h4v2H3V5h4l1-2Zm-2 6h12l-1 12H7L6 9Zm3 2 .5 8h2L11 11H9Zm4 0-.5 8h2l.5-8h-2Z" />
    case "inbox":
      return <path d="M4 4h16l2 9v7H2v-7l2-9Zm1.6 2-1.3 6h4.4l1.2 2h4.2l1.2-2h4.4l-1.3-6H5.6ZM4 14v4h16v-4h-3.5l-1.2 2H8.7l-1.2-2H4Z" />
    case "copy":
      return <path d="M8 2h10a2 2 0 0 1 2 2v10h-2V4H8V2Zm-4 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v12h10V8H4Z" />
    case "gauge":
      return <path d="M12 4a10 10 0 0 1 10 10 9.8 9.8 0 0 1-2 6H4a9.8 9.8 0 0 1-2-6A10 10 0 0 1 12 4Zm0 2a8 8 0 0 0-8 8c0 1.5.4 2.9 1.2 4h13.6c.8-1.1 1.2-2.5 1.2-4a8 8 0 0 0-8-8Zm4.9 4.7-3.8 5.5a2 2 0 1 1-1.6-1.2l3.8-5.5 1.6 1.2Z" />
    case "stop":
      return <path d="M7 7h10v10H7V7Z" />
  }
}

async function downloadDebugTrace(trace?: DebugTrace) {
  if (!trace) return

  const signed = await createDebugDownload(trace.runId)
  const link = document.createElement("a")
  link.href = signed.url
  link.download = `debug-trace-${sanitizeFileName(trace.runId)}.json`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadBenchmarkArtifact(runId: string, artifact: "report" | "summary" | "results") {
  const signed = await createBenchmarkDownload(runId, artifact)
  const link = document.createElement("a")
  link.href = signed.url
  link.download = `benchmark-${artifact}-${sanitizeFileName(runId)}`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function getPlaceholderSteps(): DebugStep[] {
  const now = new Date().toISOString()
  return ["入力解析", "クエリ正規化", "MemoRAGメモリ検索", "ベクトル検索", "再ランキング", "根拠チェック", "Bedrock推論", "最終回答"].map((label, index) => ({
    id: index + 1,
    label,
    status: "success" as const,
    latencyMs: 0,
    summary: "質問を送信すると、このステップの実行内容が表示されます。",
    startedAt: now,
    completedAt: now
  }))
}

function getProcessingSteps(question?: string): DebugStep[] {
  const now = new Date().toISOString()
  const compactQuestion = question?.replace(/\s+/g, " ").trim()
  const summaries = [
    compactQuestion ? `質問を受け付けました: ${compactQuestion.slice(0, 72)}` : "質問を受け付けました。",
    "検索しやすい形に整えています。",
    "関連するメモリとドキュメントを探しています。",
    "候補の根拠を確認しています。",
    "回答を生成しています。"
  ]

  return ["入力受付", "クエリ準備", "根拠検索", "根拠チェック", "回答生成"].map((label, index) => ({
    id: index + 1,
    label,
    status: "success" as const,
    latencyMs: 0,
    summary: summaries[index] ?? "処理しています。",
    startedAt: now,
    completedAt: now
  }))
}

function formatLatency(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} 秒`
  return `${Math.round(value)} ms`
}

function formatMetricLatency(value?: number | null): string {
  return typeof value === "number" ? formatLatency(value) : "-"
}

function formatPercent(value?: number | null): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "-"
}

function formatShortDate(input?: string): string {
  if (!input) return "-"
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`
}

function formatDate(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
}

function managedUserStatusLabel(status: ManagedUser["status"]): string {
  if (status === "active") return "有効"
  if (status === "suspended") return "停止中"
  return "削除済み"
}

function costConfidenceLabel(confidence: CostAuditSummary["items"][number]["confidence"]): string {
  if (confidence === "actual_usage") return "実測"
  if (confidence === "estimated_usage") return "概算"
  return "手動見積"
}

function formatTime(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "--:--:--"
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDateTime(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })
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

function statusLabel(status: HumanQuestion["status"]): string {
  if (status === "open") return "対応中"
  if (status === "answered") return "回答済み"
  return "解決済み"
}

function runStatusLabel(status: BenchmarkRun["status"]): string {
  if (status === "queued") return "待機中"
  if (status === "running") return "実行中"
  if (status === "succeeded") return "成功"
  if (status === "failed") return "失敗"
  return "取消済み"
}

function summarizeBenchmarkRuns(runs: BenchmarkRun[]): {
  latestRun?: BenchmarkRun
  completedCount: number
  runSuccessRate?: number
  averageLatencyMs?: number | null
  answerableAccuracy?: number | null
  retrievalRecallAt20?: number | null
  errorRate?: number | null
  failedHttpCount: number
  trendRuns: BenchmarkRun[]
} {
  const completedRuns = runs.filter((run) => ["succeeded", "failed", "cancelled"].includes(run.status))
  const metricRuns = completedRuns.filter((run) => run.metrics)
  const runSuccessRate = completedRuns.length > 0
    ? completedRuns.filter((run) => run.status === "succeeded").length / completedRuns.length
    : undefined

  return {
    latestRun: runs[0],
    completedCount: completedRuns.length,
    runSuccessRate,
    averageLatencyMs: averageNullable(metricRuns.map((run) => run.metrics?.averageLatencyMs ?? run.metrics?.p50LatencyMs)),
    answerableAccuracy: averageNullable(metricRuns.map((run) => run.metrics?.answerableAccuracy)),
    retrievalRecallAt20: averageNullable(metricRuns.map((run) => run.metrics?.retrievalRecallAt20)),
    errorRate: averageNullable(metricRuns.map((run) => run.metrics?.errorRate)),
    failedHttpCount: metricRuns.reduce((total, run) => total + (run.metrics?.failedHttp ?? 0), 0),
    trendRuns: metricRuns
      .filter((run) => typeof run.metrics?.p95LatencyMs === "number")
      .sort((a, b) => (a.completedAt ?? a.updatedAt).localeCompare(b.completedAt ?? b.updatedAt))
      .slice(-7)
  }
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function priorityLabel(priority: HumanQuestion["priority"]): string {
  if (priority === "urgent") return "緊急"
  if (priority === "high") return "高"
  return "通常"
}

function summarizeTitle(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= 36 ? trimmed : `${trimmed.slice(0, 36)}…`
}

function createConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
