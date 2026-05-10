import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import type { AuthSession } from "../../authClient.js"
import type { AppRoutesProps } from "../AppRoutes.js"
import type { RailNav } from "../components/RailNav.js"
import type { TopBar } from "../components/TopBar.js"
import {
  buildAdminRouteProps,
  buildAssigneeRouteProps,
  buildBenchmarkRouteProps,
  buildDocumentRouteProps,
  buildHistoryRouteProps,
  buildProfileRouteProps
} from "../routeProps/featureRouteProps.js"
import type { AppView } from "../types.js"
import { useCurrentUser } from "./useCurrentUser.js"
import { usePermissions } from "./usePermissions.js"
import { useAdminData } from "../../features/admin/hooks/useAdminData.js"
import { useBenchmarkRuns } from "../../features/benchmark/hooks/useBenchmarkRuns.js"
import { useChatSession } from "../../features/chat/hooks/useChatSession.js"
import { useDebugRuns, useDebugSelection } from "../../features/debug/hooks/useDebugRuns.js"
import { useDocuments } from "../../features/documents/hooks/useDocuments.js"
import { buildDocumentRoutePath, readDocumentRoute, type DocumentRouteChangeOptions, type DocumentRouteState } from "../../features/documents/routeState.js"
import { useConversationHistory } from "../../features/history/hooks/useConversationHistory.js"
import { useQuestions } from "../../features/questions/hooks/useQuestions.js"

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

export function useAppShellState({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const { currentUser, currentUserError } = useCurrentUser(authSession)
  const initialDocumentRoute = getCurrentDocumentRoute()
  const [activeView, setActiveView] = useState<AppView>(initialDocumentRoute.isDocumentRoute ? "documents" : "chat")
  const [documentRouteState, setDocumentRouteState] = useState<DocumentRouteState>(initialDocumentRoute.state)
  const [modelId, setModelId] = useState(defaultModelId)
  const [embeddingModelId] = useState(defaultEmbeddingModelId)
  const [minScore] = useState(0.2)
  const [pendingApiCalls, setPendingApiCalls] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const latestMessageRef = useRef<HTMLElement | null>(null)
  const setLoading = useCallback((nextLoading: boolean) => {
    setPendingApiCalls((current) => nextLoading ? current + 1 : Math.max(0, current - 1))
  }, [])
  const loading = pendingApiCalls > 0

  const navigateToView = useCallback((view: AppView, options: { replace?: boolean } = {}) => {
    setActiveView(view)
    if (typeof window === "undefined") return
    const nextPath = view === "documents" ? buildDocumentRoutePath(documentRouteState) : "/"
    updateBrowserLocation(nextPath, options.replace)
  }, [documentRouteState])

  const navigateDocumentRoute = useCallback((nextState: DocumentRouteState, options: DocumentRouteChangeOptions = {}) => {
    setDocumentRouteState(nextState)
    setActiveView("documents")
    if (typeof window === "undefined") return
    updateBrowserLocation(buildDocumentRoutePath(nextState), options.replace)
  }, [])

  const {
    canCreateChat,
    canReadDocuments,
    canWriteDocuments,
    canDeleteDocuments,
    canReindexDocuments,
    canReadAliases,
    canWriteAliases,
    canReviewAliases,
    canDisableAliases,
    canPublishAliases,
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
    canManageAliases,
    canManageDocuments,
    canSeeAdminSettings
  } = usePermissions(currentUser)

  const {
    documents,
    documentGroups,
    reindexMigrations,
    selectedGroupId,
    uploadGroupId,
    operationState: documentOperationState,
    uploadState: documentUploadState,
    file,
    setFile,
    setUploadGroupId,
    refreshDocuments,
    refreshDocumentGroups,
    refreshReindexMigrations,
    ingestDocument,
    onDelete,
    onUploadDocumentFile,
    onStageReindex,
    onCutoverReindex,
    onRollbackReindex,
    onCreateDocumentGroup,
    onShareDocumentGroup
  } = useDocuments({
    modelId,
    embeddingModelId,
    canWriteDocuments,
    canReindexDocuments,
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
    updateHistoryQuestionTickets,
    createConversationId
  } = useConversationHistory({ setError })

  const {
    debugRuns,
    setDebugRuns,
    selectedRunId,
    setSelectedRunId,
    expandedStepId,
    setExpandedStepId,
    allExpanded,
    setAllExpanded,
    refreshDebugRuns
  } = useDebugRuns()

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
    submitClarificationOption,
    startClarificationFreeform,
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
  })

  const {
    questions,
    selectedQuestionId,
    setSelectedQuestionId,
    refreshQuestions,
    refreshQuestionTickets,
    refreshLinkedQuestions,
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
    aliases,
    aliasAuditLog,
    refreshManagedUsers,
    refreshAdminAuditLog,
    refreshAccessRoles,
    refreshUsageSummaries,
    refreshCostAudit,
    refreshAliases,
    refreshAdminData,
    onAssignUserRoles,
    onCreateManagedUser,
    onSetManagedUserStatus,
    onCreateAlias,
    onUpdateAlias,
    onReviewAlias,
    onDisableAlias,
    onPublishAliases
  } = useAdminData({
    canReadAdminAuditLog,
    canReadUsage,
    canReadCosts,
    canReadUsers,
    canOpenAdminSettings,
    canReadAliases,
    canWriteAliases,
    canReviewAliases,
    canDisableAliases,
    canPublishAliases,
    setLoading,
    setError
  })

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
  const latestTrace = latestAssistant?.result?.debug
  const { selectedTrace, selectedRunValue } = useDebugSelection({
    debugRuns,
    selectedRunId,
    latestTrace,
    pendingDebugQuestion
  })
  const isProcessing = pendingActivity !== null
  const visibleMessages = messages
  const latestMessageCreatedAt = visibleMessages[visibleMessages.length - 1]?.createdAt ?? ""
  const linkedQuestionRefreshKey = visibleMessages
    .map((message) => message.questionTicket)
    .filter((questionTicket) => questionTicket && questionTicket.status !== "resolved")
    .map((questionTicket) => `${questionTicket?.questionId}:${questionTicket?.status}:${questionTicket?.updatedAt}`)
    .join("|")
  const historyQuestionIds = useMemo(() => [...new Set(history
    .flatMap((item) => item.messages.map((message) => message.questionTicket))
    .filter((questionTicket) => questionTicket && questionTicket.status !== "resolved")
    .map((questionTicket) => questionTicket?.questionId ?? "")
    .filter(Boolean))], [history])
  const historyQuestionRefreshKey = historyQuestionIds.join("|")

  useEffect(() => {
    if (currentUserError) setError(currentUserError)
  }, [currentUserError])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onPopState = () => {
      const nextDocumentRoute = readDocumentRoute(window.location)
      if (nextDocumentRoute.isDocumentRoute) {
        setDocumentRouteState(nextDocumentRoute.state)
        setActiveView("documents")
      } else {
        setActiveView("chat")
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (!authSession || !currentUser) return
    const loaders: Promise<unknown>[] = []
    if (canReadDocuments) {
      loaders.push(refreshDocuments().catch((err) => console.warn("Failed to load documents", err)))
      loaders.push(refreshDocumentGroups().catch((err) => console.warn("Failed to load document groups", err)))
    }
    if (canReindexDocuments) loaders.push(refreshReindexMigrations().catch((err) => console.warn("Failed to load reindex migrations", err)))
    if (canReadDebugRuns) loaders.push(refreshDebugRuns().catch((err) => console.warn("Failed to load debug runs", err)))
    if (canReadBenchmarkRuns) {
      loaders.push(refreshBenchmarkRuns().catch((err) => console.warn("Failed to load benchmark runs", err)))
      loaders.push(refreshBenchmarkSuites().catch((err) => console.warn("Failed to load benchmark suites", err)))
    }
    if (canReadUsers) loaders.push(refreshManagedUsers().catch((err) => console.warn("Failed to load managed users", err)))
    if (canOpenAdminSettings) loaders.push(refreshAccessRoles().catch((err) => console.warn("Failed to load access roles", err)))
    if (canReadAdminAuditLog) loaders.push(refreshAdminAuditLog().catch((err) => console.warn("Failed to load admin audit log", err)))
    if (canReadUsage) loaders.push(refreshUsageSummaries().catch((err) => console.warn("Failed to load usage summaries", err)))
    if (canReadCosts) loaders.push(refreshCostAudit().catch((err) => console.warn("Failed to load cost audit", err)))
    if (canReadAliases) loaders.push(refreshAliases().catch((err) => console.warn("Failed to load aliases", err)))
    if (canAnswerQuestions) loaders.push(refreshQuestions().catch((err) => console.warn("Failed to load questions", err)))
    if (canReadHistory) loaders.push(refreshHistory().catch((err) => console.warn("Failed to load conversation history", err)))
    if (loaders.length === 0) return
    setLoading(true)
    void Promise.all(loaders).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, currentUser])

  useEffect(() => {
    if (!currentUser) return
    if (activeView === "assignee" && !canAnswerQuestions) navigateToView("chat", { replace: true })
    if (activeView === "benchmark" && !canReadBenchmarkRuns) navigateToView("chat", { replace: true })
    if (activeView === "documents" && !canManageDocuments) navigateToView("chat", { replace: true })
    if (activeView === "admin" && !canSeeAdminSettings) navigateToView("chat", { replace: true })
  }, [activeView, canAnswerQuestions, canManageDocuments, canReadBenchmarkRuns, canSeeAdminSettings, currentUser, navigateToView])

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
    if (!linkedQuestionRefreshKey) return
    refreshLinkedQuestions(messages).catch((err) => console.warn("Failed to refresh linked questions", err))
    const timer = window.setInterval(() => {
      refreshLinkedQuestions(messages).catch((err) => console.warn("Failed to poll linked questions", err))
    }, 20000)
    return () => window.clearInterval(timer)
  }, [linkedQuestionRefreshKey, messages, refreshLinkedQuestions])

  useEffect(() => {
    if (!historyQuestionRefreshKey || (activeView !== "history" && activeView !== "favorites")) return

    const refreshHistoryQuestions = () => {
      refreshQuestionTickets(historyQuestionIds)
        .then(updateHistoryQuestionTickets)
        .catch((err) => console.warn("Failed to refresh history question tickets", err))
    }

    refreshHistoryQuestions()
    const timer = window.setInterval(refreshHistoryQuestions, 20000)
    return () => window.clearInterval(timer)
  }, [activeView, historyQuestionIds, historyQuestionRefreshKey, refreshQuestionTickets, updateHistoryQuestionTickets])

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

  const railProps: ComponentProps<typeof RailNav> = {
    activeView,
    authSession,
    canAnswerQuestions,
    canReadBenchmarkRuns,
    canManageDocuments,
    canSeeAdminSettings,
    onChangeView: navigateToView
  }

  const topBarProps: ComponentProps<typeof TopBar> = {
    debugMode,
    canReadDebugRuns,
    onDebugModeChange: setDebugMode,
    onNewConversation: newConversation
  }

  const routeProps: AppRoutesProps = {
    activeView,
    canAnswerQuestions,
    canReadBenchmarkRuns,
    canManageDocuments,
    canSeeAdminSettings,
    chatProps: {
      messages: visibleMessages,
      questions,
      documentsCount: documents.length,
      isProcessing,
      pendingActivity,
      latestMessageRef,
      currentUser,
      loading,
      canAsk,
      canWriteDocuments,
      modelId,
      file,
      selectedGroupId,
      documentGroups,
      conversationKey,
      submitShortcut,
      question,
      debugMode,
      canReadDebugRuns,
      selectedTrace,
      selectedRunValue,
      pendingDebugQuestion,
      allExpanded,
      expandedStepId,
      onAsk,
      onSubmitClarificationOption: submitClarificationOption,
      onStartClarificationFreeform: startClarificationFreeform,
      onSetQuestion: setQuestion,
      onModelChange: setModelId,
      onSetFile: setFile,
      onCreateQuestion,
      onResolveQuestion,
      onToggleAllDebugSteps: () => setAllExpanded((value) => !value),
      onToggleDebugStep: (stepId) => setExpandedStepId((current) => (current === stepId ? null : stepId))
    },
    assigneeProps: buildAssigneeRouteProps({
      questions,
      selectedQuestionId,
      user: currentUser,
      loading,
      onSelect: setSelectedQuestionId,
      onAnswer: onAnswerQuestion,
      onBack: () => navigateToView("chat")
    }),
    benchmarkProps: buildBenchmarkRouteProps({
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
        setLoading(true)
        setError(null)
        void refreshBenchmarkRuns()
          .catch((err) => setError(err instanceof Error ? err.message : String(err)))
          .finally(() => setLoading(false))
      },
      onCancel: onCancelBenchmark,
      onBack: () => navigateToView("chat")
    }),
    documentProps: buildDocumentRouteProps({
      documents,
      documentGroups,
      loading,
      canWrite: canWriteDocuments,
      canDelete: canDeleteDocuments,
      canReindex: canReindexDocuments,
      uploadGroupId,
      operationState: documentOperationState,
      uploadState: documentUploadState,
      migrations: reindexMigrations,
      onUploadGroupChange: setUploadGroupId,
      onUpload: onUploadDocumentFile,
      onCreateGroup: onCreateDocumentGroup,
      onShareGroup: onShareDocumentGroup,
      onDelete,
      onStageReindex,
      onCutoverReindex,
      onRollbackReindex,
      initialRouteState: documentRouteState,
      onRouteStateChange: navigateDocumentRoute,
      onBack: () => navigateToView("admin")
    }),
    adminProps: buildAdminRouteProps({
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
      aliases,
      aliasAuditLog,
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
      canManageAliases,
      canReadAliases,
      canWriteAliases,
      canReviewAliases,
      canDisableAliases,
      canPublishAliases,
      onOpenDocuments: () => navigateDocumentRoute({}),
      onOpenAssignee: () => navigateToView("assignee"),
      onOpenDebug: () => {
        setDebugMode(true)
        navigateToView("chat")
      },
      onOpenBenchmark: () => navigateToView("benchmark"),
      onCreateUser: onCreateManagedUser,
      onAssignRoles: onAssignUserRoles,
      onSetUserStatus: onSetManagedUserStatus,
      onRefreshAdminData: async () => {
        setLoading(true)
        setError(null)
        try {
          await Promise.all([
            refreshAdminData(),
            canReindexDocuments ? refreshReindexMigrations() : Promise.resolve(),
            canReadAliases ? refreshAliases() : Promise.resolve()
          ])
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setLoading(false)
        }
      },
      onCreateAlias,
      onUpdateAlias,
      onReviewAlias,
      onDisableAlias,
      onPublishAliases,
      onBack: () => navigateToView("chat")
    }),
    historyProps: buildHistoryRouteProps({
      history,
      onSelect: (item) => {
        setCurrentConversationId(item.id)
        setMessages(item.messages)
        navigateToView("chat")
        setError(null)
        setSelectedRunId("")
        setPendingActivity(null)
        setPendingDebugQuestion(null)
      },
      onDelete: deleteHistoryItem,
      onToggleFavorite: toggleFavorite,
      onBack: () => navigateToView("chat")
    }),
    profileProps: buildProfileRouteProps({
      authSession,
      submitShortcut,
      onSetSubmitShortcut: setSubmitShortcut,
      onSignOut,
      onBack: () => navigateToView("chat")
    })
  }

  return {
    error,
    loading,
    railProps,
    topBarProps,
    routeProps
  }
}

function getCurrentDocumentRoute(): { isDocumentRoute: boolean; state: DocumentRouteState } {
  if (typeof window === "undefined") return { isDocumentRoute: false, state: {} }
  return readDocumentRoute(window.location)
}

function updateBrowserLocation(path: string, replace = false) {
  const current = `${window.location.pathname}${window.location.search}`
  if (current === path) return
  const method = replace ? "replaceState" : "pushState"
  window.history[method]({}, "", path)
}
