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
  buildFavoritesRouteProps,
  buildHistoryRouteProps,
  buildProfileRouteProps
} from "../routeProps/featureRouteProps.js"
import type { AppView } from "../types.js"
import { useCurrentUser } from "./useCurrentUser.js"
import { usePermissions } from "./usePermissions.js"
import { useAdminData } from "../../features/admin/hooks/useAdminData.js"
import { useBenchmarkRuns } from "../../features/benchmark/hooks/useBenchmarkRuns.js"
import type { ChatDocumentScope } from "../../features/chat/hooks/useChatSession.js"
import { useChatSession } from "../../features/chat/hooks/useChatSession.js"
import { useDebugRuns, useDebugSelection } from "../../features/debug/hooks/useDebugRuns.js"
import type { DocumentWorkspaceUrlState } from "../../features/documents/components/DocumentWorkspace.js"
import { useDocuments } from "../../features/documents/hooks/useDocuments.js"
import { useFavorites } from "../../features/favorites/hooks/useFavorites.js"
import { useConversationHistory } from "../../features/history/hooks/useConversationHistory.js"
import { useQuestions } from "../../features/questions/hooks/useQuestions.js"
import {
  buildAppViewUrl,
  canAccessAppView,
  decodeRouteSegment,
  normalizeAppRouteUrl,
  parseAppRoute,
  type AppRouteIssue,
  type ParsedAppRoute
} from "../routing/appRoute.js"

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

export type AppRouteNotice = {
  kind: "permission" | "invalid"
  message: string
}

export function useAppShellState({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const { currentUser, currentUserError } = useCurrentUser(authSession)
  const [initialRoute] = useState<ParsedAppRoute>(() => readAppRouteFromLocation())
  const [activeView, setActiveViewState] = useState<AppView>(initialRoute.view)
  const [documentUrlState, setDocumentUrlState] = useState<DocumentWorkspaceUrlState>(() => readDocumentWorkspaceUrlStateFromLocation())
  const [routeNotice, setRouteNotice] = useState<AppRouteNotice | null>(() => routeNoticeForIssue(initialRoute.issue))
  const [chatDocumentScope, setChatDocumentScope] = useState<ChatDocumentScope>(null)
  const setActiveView = useCallback((nextView: AppView) => {
    setActiveViewState(nextView)
    setRouteNotice(null)
    writeAppViewToLocation(nextView, "push")
  }, [])
  const onDocumentUrlStateChange = useCallback((nextState: DocumentWorkspaceUrlState) => {
    setDocumentUrlState(nextState)
    setRouteNotice(null)
    writeDocumentWorkspaceUrlStateToLocation(nextState)
  }, [])
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

  useEffect(() => {
    if (typeof window === "undefined" || !initialRoute.needsNormalization) return
    writeRelativeUrl(normalizeAppRouteUrl(window.location.href, initialRoute), "replace")
  }, [initialRoute])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onPopState = () => {
      const nextRoute = readAppRouteFromLocation()
      setActiveViewState(nextRoute.view)
      setDocumentUrlState(readDocumentWorkspaceUrlStateFromLocation())
      setRouteNotice(routeNoticeForIssue(nextRoute.issue))
      if (nextRoute.needsNormalization) {
        writeRelativeUrl(normalizeAppRouteUrl(window.location.href, nextRoute), "replace")
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const {
    canCreateChat,
    canReadDocuments,
    canCreateDocumentGroups,
    canShareDocumentGroups,
    canMoveDocumentGroups,
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
    onDownloadExtractedText,
    onUploadDocumentFile,
    onStageReindex,
    onCutoverReindex,
    onRollbackReindex,
    onCreateDocumentGroup,
    onShareDocumentGroup,
    onMoveDocumentGroup,
    onLoadFolderShare,
    onReplaceFolderShare,
    onLoadDocumentShare,
    onShareDocument,
    onMoveDocument
  } = useDocuments({
    modelId,
    embeddingModelId,
    canWriteDocuments,
    canCreateDocumentGroups,
    canShareDocumentGroups,
    canMoveDocumentGroups,
    canDeleteDocuments,
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
    favorites,
    refreshFavorites,
    addFavorite,
    removeFavorite
  } = useFavorites({ setError })

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
    documentScope: chatDocumentScope,
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
    onPrepareManagedUserDelete,
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
    if (canReadHistory) {
      loaders.push(refreshHistory().catch((err) => console.warn("Failed to load conversation history", err)))
      loaders.push(refreshFavorites().catch((err) => console.warn("Failed to load favorites", err)))
    }
    if (loaders.length === 0) return
    setLoading(true)
    void Promise.all(loaders).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, currentUser])

  useEffect(() => {
    if (!currentUser) return
    const access = { canAnswerQuestions, canReadBenchmarkRuns, canReadDocuments, canSeeAdminSettings }
    if (canAccessAppView(activeView, access)) return
    setRouteNotice({
      kind: "permission",
      message: "このURLの画面を表示する権限を確認できなかったため、利用可能な開始画面へ移動しました。"
    })
    setActiveViewState("chat")
    writeAppViewToLocation("chat", "replace")
  }, [activeView, canAnswerQuestions, canReadBenchmarkRuns, canReadDocuments, canSeeAdminSettings, currentUser])

  useEffect(() => {
    if (!canReadDebugRuns && debugMode) setDebugMode(false)
    if (!canWriteDocuments && file) setFile(null)
  }, [canReadDebugRuns, canWriteDocuments, debugMode, file, setFile])

  useEffect(() => {
    if (!chatDocumentScope) return
    if (!documents.some((document) => document.documentId === chatDocumentScope.documentId)) setChatDocumentScope(null)
  }, [chatDocumentScope, documents])

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
    canReadDocuments,
    canSeeAdminSettings,
    onChangeView: setActiveView
  }

  const topBarProps: ComponentProps<typeof TopBar> = {
    debugMode,
    canReadDebugRuns,
    onDebugModeChange: setDebugMode,
    onNewConversation: () => {
      setChatDocumentScope(null)
      newConversation()
    }
  }

  const routeProps: AppRoutesProps = {
    activeView,
    permissionsResolved: currentUser !== null,
    canAnswerQuestions,
    canReadBenchmarkRuns,
    canReadDocuments,
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
      documentScope: chatDocumentScope,
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
      onClearDocumentScope: () => setChatDocumentScope(null),
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
      onBack: () => setActiveView("chat")
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
      onBack: () => setActiveView("chat")
    }),
    documentProps: buildDocumentRouteProps({
      documents,
      documentGroups,
      loading,
      canCreateGroup: canCreateDocumentGroups,
      canShareGroup: canShareDocumentGroups,
      canMoveGroup: canMoveDocumentGroups,
      canUpload: canWriteDocuments,
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
      onMoveGroup: onMoveDocumentGroup,
      onLoadFolderShare,
      onReplaceFolderShare,
      onLoadDocumentShare,
      onShareDocument,
      onMoveDocument,
      onDelete,
      onDownloadExtractedText,
      onStageReindex,
      onCutoverReindex,
      onRollbackReindex,
      onAskDocument: (document) => {
        setChatDocumentScope({ documentId: document.documentId, fileName: document.fileName })
        setQuestion(`この資料について質問する: ${document.fileName}`)
        setActiveView("chat")
      },
      onBack: () => setActiveView(canSeeAdminSettings ? "admin" : "chat"),
      urlState: documentUrlState,
      onUrlStateChange: onDocumentUrlStateChange
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
      onOpenDocuments: () => setActiveView("documents"),
      onOpenAssignee: () => setActiveView("assignee"),
      onOpenDebug: () => {
        setDebugMode(true)
        setActiveView("chat")
      },
      onOpenBenchmark: () => setActiveView("benchmark"),
      onCreateUser: onCreateManagedUser,
      onAssignRoles: onAssignUserRoles,
      onPrepareUserDelete: onPrepareManagedUserDelete,
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
      onBack: () => setActiveView("chat")
    }),
    historyProps: buildHistoryRouteProps({
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
      onToggleFavorite: (item) => {
        void toggleFavorite(item, { addFavorite, removeFavorite })
      },
      onBack: () => setActiveView("chat")
    }),
    favoritesProps: buildFavoritesRouteProps({
      favorites,
      onBack: () => setActiveView("chat")
    }),
    profileProps: buildProfileRouteProps({
      authSession,
      submitShortcut,
      onSetSubmitShortcut: setSubmitShortcut,
      onSignOut,
      onBack: () => setActiveView("chat")
    })
  }

  return {
    error,
    loading,
    routeNotice,
    railProps,
    topBarProps,
    routeProps
  }
}

const documentSortKeys = new Set(["updatedDesc", "updatedAsc", "fileNameAsc", "chunkDesc", "typeAsc"])
function readAppRouteFromLocation(): ParsedAppRoute {
  if (typeof window === "undefined") return { view: "chat", needsNormalization: false }
  return parseAppRoute(window.location)
}

function readDocumentWorkspaceUrlStateFromLocation(): DocumentWorkspaceUrlState {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const pathState = readDocumentWorkspacePathState(window.location.pathname)
  const sort = params.get("sort")
  return {
    ...pathState,
    folderId: params.get("group") || pathState.folderId,
    documentId: params.get("document") || pathState.documentId,
    migrationId: params.get("migration") || pathState.migrationId,
    query: params.get("query") || undefined,
    type: params.get("type") || undefined,
    status: params.get("status") || undefined,
    groupFilter: params.get("documentGroup") || undefined,
    sort: sort && documentSortKeys.has(sort) ? sort as DocumentWorkspaceUrlState["sort"] : undefined
  }
}

function readDocumentWorkspacePathState(pathname: string): Pick<DocumentWorkspaceUrlState, "folderId" | "documentId" | "migrationId"> {
  const groupsMatch = pathname.match(/^\/documents\/groups\/([^/]+)$/)
  const folderId = groupsMatch?.[1] ? decodeRouteSegment(groupsMatch[1]) : undefined
  if (folderId) return { folderId }
  const migrationMatch = pathname.match(/^\/documents\/reindex-migrations\/([^/]+)$/)
  const migrationId = migrationMatch?.[1] ? decodeRouteSegment(migrationMatch[1]) : undefined
  if (migrationId) return { migrationId }
  const documentMatch = pathname.match(/^\/documents\/([^/]+)$/)
  const documentId = documentMatch?.[1] ? decodeRouteSegment(documentMatch[1]) : undefined
  if (documentId && documentMatch?.[1] !== "reindex-migrations" && documentMatch?.[1] !== "groups") return { documentId }
  return {}
}

function writeDocumentWorkspaceUrlStateToLocation(state: DocumentWorkspaceUrlState) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  const pathState = documentWorkspacePathState(state)
  url.pathname = pathState.pathname
  url.searchParams.delete("view")
  setSearchParam(url, "group", pathState.pathKey === "folderId" ? undefined : state.folderId)
  setSearchParam(url, "document", pathState.pathKey === "documentId" ? undefined : state.documentId)
  setSearchParam(url, "migration", pathState.pathKey === "migrationId" ? undefined : state.migrationId)
  setSearchParam(url, "query", state.query)
  setSearchParam(url, "type", state.type)
  setSearchParam(url, "status", state.status)
  setSearchParam(url, "documentGroup", state.groupFilter)
  setSearchParam(url, "sort", state.sort)
  writeBrowserUrl(url, "replace")
}

function documentWorkspacePathState(state: DocumentWorkspaceUrlState): {
  pathname: string
  pathKey?: "folderId" | "documentId" | "migrationId"
} {
  if (state.migrationId) {
    const migrationId = encodeDocumentPathSegment(state.migrationId)
    return migrationId
      ? { pathname: `/documents/reindex-migrations/${migrationId}`, pathKey: "migrationId" }
      : { pathname: "/documents" }
  }
  if (state.documentId) {
    const documentId = encodeDocumentPathSegment(state.documentId)
    return documentId
      ? { pathname: `/documents/${documentId}`, pathKey: "documentId" }
      : { pathname: "/documents" }
  }
  if (state.folderId) {
    const folderId = encodeDocumentPathSegment(state.folderId)
    return folderId
      ? { pathname: `/documents/groups/${folderId}`, pathKey: "folderId" }
      : { pathname: "/documents" }
  }
  return { pathname: "/documents" }
}

function encodeDocumentPathSegment(value?: string): string | undefined {
  if (!value) return undefined
  const encoded = encodeURIComponent(value)
  return decodeRouteSegment(encoded) ? encoded : undefined
}

function writeAppViewToLocation(view: AppView, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  writeRelativeUrl(buildAppViewUrl(window.location.href, view), historyMode)
}

function setSearchParam(url: URL, key: string, value?: string) {
  if (value) url.searchParams.set(key, value)
  else url.searchParams.delete(key)
}

function writeRelativeUrl(relativeUrl: string, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  writeBrowserUrl(new URL(relativeUrl, window.location.href), historyMode)
}

function writeBrowserUrl(url: URL, historyMode: "push" | "replace") {
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl === currentUrl) return
  if (historyMode === "push") window.history.pushState(window.history.state, "", nextUrl)
  else window.history.replaceState(window.history.state, "", nextUrl)
}

function routeNoticeForIssue(issue?: AppRouteIssue): AppRouteNotice | null {
  if (!issue) return null
  return {
    kind: "invalid",
    message: "URLの画面指定を確認できなかったため、安全な開始画面または正規URLへ移動しました。"
  }
}
