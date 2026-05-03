import { useEffect, useRef, useState } from "react"
import type { AuthSession } from "../authClient.js"
import { AppRoutes } from "./AppRoutes.js"
import { RailNav } from "./components/RailNav.js"
import { TopBar } from "./components/TopBar.js"
import { useCurrentUser } from "./hooks/useCurrentUser.js"
import { usePermissions } from "./hooks/usePermissions.js"
import type { AppView } from "./types.js"
import { useAdminData } from "../features/admin/hooks/useAdminData.js"
import { useBenchmarkRuns } from "../features/benchmark/hooks/useBenchmarkRuns.js"
import { useDebugRuns } from "../features/debug/hooks/useDebugRuns.js"
import { useDocuments } from "../features/documents/hooks/useDocuments.js"
import { useChatSession } from "../features/chat/hooks/useChatSession.js"
import { useConversationHistory } from "../features/history/hooks/useConversationHistory.js"
import { useQuestions } from "../features/questions/hooks/useQuestions.js"

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

export function AppShell({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const { currentUser, currentUserError } = useCurrentUser(authSession)
  const [activeView, setActiveView] = useState<AppView>("chat")
  const [modelId, setModelId] = useState(defaultModelId)
  const [embeddingModelId] = useState(defaultEmbeddingModelId)
  const [minScore] = useState(0.2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const latestMessageRef = useRef<HTMLElement | null>(null)

  const {
    canCreateChat,
    canReadDocuments,
    canWriteDocuments,
    canDeleteDocuments,
    canAnswerQuestions,
    canReadDebugRuns,
    canReadHistory,
    canOpenAdminSettings,
    canReadBenchmarkRuns,
    canRunBenchmark,
    canCancelBenchmark,
    canDownloadBenchmark,
    canReadUsers,
    canCreateUsers,
    canSuspendUsers,
    canUnsuspendUsers,
    canDeleteUsers,
    canAssignRoles,
    canReadUsage,
    canReadCosts,
    canReadAdminAuditLog,
    canManageDocuments,
    canSeeAdminSettings
  } = usePermissions(currentUser)
  const {
    documents,
    selectedDocumentId,
    file,
    setFile,
    setSelectedDocumentId,
    refreshDocuments,
    ingestDocument,
    onDelete,
    onUploadDocumentFile
  } = useDocuments({
    modelId,
    embeddingModelId,
    canWriteDocuments,
    setLoading,
    setError
  })
  const {
    benchmarkRuns,
    benchmarkSuites,
    benchmarkSuiteId,
    benchmarkModelId,
    benchmarkConcurrency,
    setBenchmarkSuiteId,
    setBenchmarkModelId,
    setBenchmarkConcurrency,
    refreshBenchmarkRuns,
    refreshBenchmarkSuites,
    onStartBenchmark,
    onCancelBenchmark
  } = useBenchmarkRuns({
    embeddingModelId,
    minScore,
    setLoading,
    setError
  })
  const {
    history,
    currentConversationId,
    setCurrentConversationId,
    refreshHistory,
    rememberMessages,
    toggleFavorite,
    deleteHistoryItem,
    createConversationId
  } = useConversationHistory({ setError })
  const {
    debugRuns,
    setDebugRuns,
    setSelectedRunId,
    expandedStepId,
    setExpandedStepId,
    allExpanded,
    setAllExpanded,
    selectedTrace,
    totalLatency,
    selectedRunValue,
    refreshDebugRuns
  } = useDebugRuns({ latestTrace: undefined, pendingDebugQuestion: null })
  const {
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
    newConversation
  } = useChatSession({
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
    rememberMessages,
    createConversationId,
    ingestDocument,
    setDebugRuns,
    setSelectedRunId,
    setExpandedStepId,
    setAllExpanded,
    setLoading,
    setError
  })
  const {
    questions,
    selectedQuestionId,
    setSelectedQuestionId,
    refreshQuestions,
    onCreateQuestion,
    onAnswerQuestion,
    onResolveQuestion
  } = useQuestions({
    canAnswerQuestions,
    setMessages,
    setLoading,
    setError
  })
  const {
    managedUsers,
    adminAuditLog,
    accessRoles,
    usageSummaries,
    costAudit,
    refreshManagedUsers,
    refreshAdminAuditLog,
    refreshAccessRoles,
    refreshUsageSummaries,
    refreshCostAudit,
    refreshAdminData,
    onAssignUserRoles,
    onCreateManagedUser,
    onSetManagedUserStatus
  } = useAdminData({
    canReadAdminAuditLog,
    canReadUsage,
    canReadCosts,
    canReadUsers,
    canOpenAdminSettings,
    setLoading,
    setError
  })
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
  const latestTrace = latestAssistant?.result?.debug
  const isProcessing = pendingActivity !== null
  const visibleMessages = messages
  const latestMessageCreatedAt = visibleMessages[visibleMessages.length - 1]?.createdAt ?? ""

  useEffect(() => {
    if (currentUserError) setError(currentUserError)
  }, [currentUserError])

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
  }, [canReadDebugRuns, canWriteDocuments, debugMode, file, setFile])

  useEffect(() => {
    if (activeView !== "benchmark" || !canReadBenchmarkRuns) return
    const timer = window.setInterval(() => {
      refreshBenchmarkRuns().catch((err) => console.warn("Failed to poll benchmark runs", err))
    }, 15000)
    return () => window.clearInterval(timer)
  }, [activeView, canReadBenchmarkRuns, refreshBenchmarkRuns])

  useEffect(() => {
    if (messages.length === 0) return
    const titleCandidate = messages.find((item) => item.role === "user")?.text || "新しい会話"
    rememberMessages(currentConversationId, titleCandidate, messages)
  }, [currentConversationId, messages, rememberMessages])

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
            onRefresh: () => {
              void refreshBenchmarkRuns().catch((err) => setError(err instanceof Error ? err.message : String(err)))
            },
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
            onRefreshAdminData: refreshAdminData,
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
            onDelete: deleteHistoryItem,
            onToggleFavorite: toggleFavorite,
            onBack: () => setActiveView("chat")
          }}
        />

      </section>
    </main>
  )
}
