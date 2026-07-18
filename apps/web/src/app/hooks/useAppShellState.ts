import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import type { AuthSession } from "../../features/auth/api/authClient.js"
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
import {
  adminAuditActions,
  adminSections,
  adminUserSortKeys,
  adminUserStatuses,
  aliasAuditActions,
  aliasSortKeys,
  aliasStatuses,
  type AdminWorkspaceUrlState
} from "../../features/admin/urlState.js"
import { useDocuments } from "../../features/documents/hooks/useDocuments.js"
import { useFavorites } from "../../features/favorites/hooks/useFavorites.js"
import { useConversationHistory } from "../../features/history/hooks/useConversationHistory.js"
import { useQuestions } from "../../features/questions/hooks/useQuestions.js"
import { isResourcePartAvailable, isResourceStateBusy } from "../../shared/ui/resourceStateModel.js"
import { useResourceStateController, type ResourceLoadIntent } from "../../shared/ui/useResourceStateController.js"
import { accountUiStateTarget, appResourceStateTargets, appUiStateTargets } from "../uiStateTargets.js"
import type { UiStateTarget } from "../../shared/ui/ResourceState.js"
import { createContentResourceState } from "../../shared/ui/resourceStateModel.js"
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

export type AppErrorNotice = {
  target: UiStateTarget
  message: string
}

export function useAppShellState({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const { currentUser, currentUserError } = useCurrentUser(authSession)
  const [initialRoute] = useState<ParsedAppRoute>(() => readAppRouteFromLocation())
  const [activeView, setActiveViewState] = useState<AppView>(initialRoute.view)
  const [documentUrlState, setDocumentUrlState] = useState<DocumentWorkspaceUrlState>(() => readDocumentWorkspaceUrlStateFromLocation())
  const [adminUrlState, setAdminUrlState] = useState<AdminWorkspaceUrlState>(() => readAdminWorkspaceUrlStateFromLocation())
  const [routeNotice, setRouteNotice] = useState<AppRouteNotice | null>(() => routeNoticeForIssue(initialRoute.issue))
  const [chatDocumentScope, setChatDocumentScope] = useState<ChatDocumentScope>(null)
  const setActiveView = useCallback((nextView: AppView) => {
    setActiveViewState(nextView)
    setRouteNotice(null)
    writeAppViewToLocation(nextView, "push")
  }, [])
  const onDocumentUrlStateChange = useCallback((nextState: DocumentWorkspaceUrlState, historyMode: "push" | "replace" = "replace") => {
    setDocumentUrlState(nextState)
    setRouteNotice(null)
    writeDocumentWorkspaceUrlStateToLocation(nextState, historyMode)
  }, [])
  const onAdminUrlStateChange = useCallback((nextState: AdminWorkspaceUrlState, historyMode: "push" | "replace" = "replace") => {
    setAdminUrlState(nextState)
    setRouteNotice(null)
    writeAdminWorkspaceUrlStateToLocation(nextState, historyMode)
  }, [])
  const [modelId, setModelId] = useState(defaultModelId)
  const [embeddingModelId] = useState(defaultEmbeddingModelId)
  const [minScore] = useState(0.2)
  const [pendingApiCalls, setPendingApiCalls] = useState(0)
  const [error, setErrorNotice] = useState<AppErrorNotice | null>(null)
  const setTargetError = useCallback((target: UiStateTarget, nextError: string | null) => {
    setErrorNotice(nextError ? { target, message: publicSafeUiError(nextError) } : null)
  }, [])
  const setChatError = useCallback((nextError: string | null) => setTargetError(appUiStateTargets.chat, nextError), [setTargetError])
  const setDocumentError = useCallback((nextError: string | null) => setTargetError(appUiStateTargets.documents, nextError), [setTargetError])
  const setBenchmarkError = useCallback((nextError: string | null) => setTargetError(appUiStateTargets.benchmark, nextError), [setTargetError])
  const setHistoryError = useCallback((nextError: string | null) => setTargetError(appUiStateTargets.history, nextError), [setTargetError])
  const setFavoritesError = useCallback((nextError: string | null) => setTargetError(appUiStateTargets.favorites, nextError), [setTargetError])
  const setAssigneeError = useCallback((nextError: string | null) => setTargetError(appUiStateTargets.assignee, nextError), [setTargetError])
  const setAdminError = useCallback((nextError: string | null) => setTargetError(appUiStateTargets.admin, nextError), [setTargetError])
  const [debugMode, setDebugMode] = useState(false)
  const {
    states: resourceStates,
    run: runResourceLoad,
    setPermission: setResourcePermission
  } = useResourceStateController(appResourceStateTargets)
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
      setAdminUrlState(readAdminWorkspaceUrlStateFromLocation())
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
    canExportUsage,
    canExportCosts,
    canReadAdminAuditLog,
    canExportAdminAuditLog,
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
    setError: setDocumentError
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
    setError: setBenchmarkError
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
  } = useConversationHistory({ setError: setHistoryError })

  const {
    favorites,
    refreshFavorites,
    addFavorite,
    removeFavorite
  } = useFavorites({ setError: setFavoritesError })

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
    setError: setChatError
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
    setError: setAssigneeError
  })

  const {
    managedUsers,
    managedUserPage,
    adminAuditPage,
    accessRoleList,
    usageSummaries,
    costAudit,
    aliasPage,
    aliasAuditPage,
    pendingAdminMutationKeys,
    refreshManagedUsers,
    loadMoreManagedUsers,
    refreshAdminAuditLog,
    refreshAccessRoles,
    refreshUsageSummaries,
    refreshCostAudit,
    applyUsageCostQuery,
    loadMoreUsage,
    loadMoreCosts,
    onCreateUsageExport,
    onCreateCostExport,
    refreshAliases,
    refreshAliasAuditLog,
    onAssignUserRoles,
    onCreateAdminAuditExport,
    onCreateManagedUser,
    onPrepareManagedUserDelete,
    onSetManagedUserStatus,
    onCreateAlias,
    onUpdateAlias,
    onReviewAlias,
    onTransitionAlias,
    onDisableAlias,
    onPublishAliases
  } = useAdminData({
    canReadAdminAuditLog,
    canExportAdminAuditLog,
    canReadUsage,
    canReadCosts,
    canExportUsage,
    canExportCosts,
    canReadUsers,
    canOpenAdminSettings,
    canReadAliases,
    canWriteAliases,
    canReviewAliases,
    canDisableAliases,
    canPublishAliases,
    setLoading,
    setError: setAdminError
  })
  const adminFilterKey = [
    adminUrlState.section ?? "overview",
    adminUrlState.query ?? "",
    adminUrlState.userStatus ?? "",
    adminUrlState.userSort ?? "emailAsc",
    adminUrlState.aliasStatus ?? "",
    adminUrlState.auditAction ?? "",
    adminUrlState.sort ?? "updatedDesc"
  ].join("\u0000")
  const previousAdminFilterKeyRef = useRef(adminFilterKey)

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

  function loadDocumentResources(intent: ResourceLoadIntent) {
    return runResourceLoad("documents", [
      {
        id: "catalog",
        label: "文書とフォルダ",
        load: () => Promise.all([refreshDocuments(), refreshDocumentGroups()])
      },
      ...(canReindexDocuments
        ? [{ id: "reindex", label: "再インデックス履歴", load: refreshReindexMigrations }]
        : [])
    ], intent)
  }

  function loadBenchmarkResources(intent: ResourceLoadIntent) {
    return runResourceLoad("benchmark", [
      { id: "runs", label: "実行履歴", load: refreshBenchmarkRuns },
      { id: "suites", label: "テスト定義", load: refreshBenchmarkSuites }
    ], intent)
  }

  function loadAdminResources(intent: ResourceLoadIntent) {
    return runResourceLoad("admin", [
      ...(canReadUsers ? [{ id: "users", label: "管理対象ユーザー", load: () => refreshManagedUsers(adminUserQueryForState(adminUrlState)) }] : []),
      ...(canOpenAdminSettings ? [{ id: "roles", label: "ロール定義", load: refreshAccessRoles }] : []),
      ...(canReadAdminAuditLog ? [{ id: "audit", label: "管理操作履歴", load: () => refreshAdminAuditLog(adminAuditQueryForState(adminUrlState)) }] : []),
      ...(canReadUsage ? [{ id: "usage", label: "利用状況", load: refreshUsageSummaries }] : []),
      ...(canReadCosts ? [{ id: "cost", label: "コスト監査", load: refreshCostAudit }] : []),
      ...(canReadAliases ? [{ id: "aliases", label: "用語展開一覧", load: () => refreshAliases(aliasListQueryForState(adminUrlState)) }] : []),
      ...(canReadAliases ? [{ id: "aliasAudit", label: "用語展開監査ログ", load: () => refreshAliasAuditLog(aliasAuditQueryForState(adminUrlState)) }] : [])
    ], intent)
  }

  function refreshAdminPart(partId: "users" | "roles" | "audit" | "usage" | "cost" | "aliases" | "aliasAudit") {
    const loaders = {
      users: { id: "users", label: "管理対象ユーザー", load: () => refreshManagedUsers(adminUserQueryForState(adminUrlState)) },
      roles: { id: "roles", label: "ロール定義", load: refreshAccessRoles },
      audit: { id: "audit", label: "管理操作履歴", load: () => refreshAdminAuditLog(adminAuditQueryForState(adminUrlState)) },
      usage: { id: "usage", label: "利用状況", load: refreshUsageSummaries },
      cost: { id: "cost", label: "コスト監査", load: refreshCostAudit },
      aliases: { id: "aliases", label: "用語展開一覧", load: () => refreshAliases(aliasListQueryForState(adminUrlState)) },
      aliasAudit: { id: "aliasAudit", label: "用語展開監査ログ", load: () => refreshAliasAuditLog(aliasAuditQueryForState(adminUrlState)) }
    }
    return runResourceLoad("admin", [loaders[partId]], "refresh")
  }

  function refreshAdminAliasParts(intent: ResourceLoadIntent = "refresh") {
    return runResourceLoad("admin", [
      { id: "aliases", label: "用語展開一覧", load: () => refreshAliases(aliasListQueryForState(adminUrlState)) },
      { id: "aliasAudit", label: "用語展開監査ログ", load: () => refreshAliasAuditLog(aliasAuditQueryForState(adminUrlState)) }
    ], intent)
  }

  useEffect(() => {
    if (currentUserError) setTargetError(accountUiStateTarget, currentUserError)
  }, [currentUserError, setTargetError])

  useEffect(() => {
    if (!authSession || !currentUser) return
    if (canReadDocuments) {
      void loadDocumentResources("initial")
    } else setResourcePermission("documents", "文書を参照する権限がありません。利用可能な画面へ戻ってください。")
    if (canReadDebugRuns) void runResourceLoad("debug", [{ id: "runs", label: "デバッグ実行履歴", load: refreshDebugRuns }], "initial")
    else setResourcePermission("debug", "デバッグ実行履歴を参照する権限がありません。")
    if (canReadBenchmarkRuns) {
      void loadBenchmarkResources("initial")
    } else setResourcePermission("benchmark", "性能テストの実行履歴を参照する権限がありません。利用可能な画面へ戻ってください。")
    if (canSeeAdminSettings) void loadAdminResources("initial")
    else setResourcePermission("admin", "管理者設定を参照する権限がありません。利用可能な画面へ戻ってください。")
    if (canAnswerQuestions) void runResourceLoad("assignee", [{ id: "questions", label: "問い合わせ一覧", load: refreshQuestions }], "initial")
    else setResourcePermission("assignee", "担当者向け問い合わせを参照する権限がありません。利用可能な画面へ戻ってください。")
    if (canReadHistory) {
      void runResourceLoad("history", [{ id: "conversations", label: "会話履歴", load: refreshHistory }], "initial")
      void runResourceLoad("favorites", [{ id: "favorites", label: "お気に入り", load: refreshFavorites }], "initial")
    } else {
      setResourcePermission("history", "会話履歴を参照する権限がありません。チャットへ戻ってください。")
      setResourcePermission("favorites", "お気に入りを参照する権限がありません。チャットへ戻ってください。")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, currentUser])

  useEffect(() => {
    if (previousAdminFilterKeyRef.current === adminFilterKey || activeView !== "admin" || !currentUser) return
    previousAdminFilterKeyRef.current = adminFilterKey
    if ((adminUrlState.section ?? "overview") === "alias" && canReadAliases) {
      void refreshAdminAliasParts("refresh")
    } else if (adminUrlState.section === "users" && canReadUsers) {
      void refreshAdminPart("users")
    } else if (adminUrlState.section === "audit" && canReadAdminAuditLog) {
      void refreshAdminPart("audit")
    }
    // Resource loader functions intentionally follow the current URL state snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, adminFilterKey, currentUser])

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
      void runResourceLoad("benchmark", [{ id: "runs", label: "実行履歴", load: refreshBenchmarkRuns }], "background")
    }, 15000)
    return () => window.clearInterval(timer)
  }, [activeView, canReadBenchmarkRuns, refreshBenchmarkRuns, runResourceLoad])

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
      dataState: createContentResourceState(appUiStateTargets.chat),
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
      dataState: resourceStates.assignee,
      questions,
      selectedQuestionId,
      user: currentUser,
      loading: loading || isResourceStateBusy(resourceStates.assignee),
      onRetry: () => {
        void runResourceLoad("assignee", [{ id: "questions", label: "問い合わせ一覧", load: refreshQuestions }], "retry")
      },
      onSelect: setSelectedQuestionId,
      onAnswer: onAnswerQuestion,
      onBack: () => setActiveView("chat")
    }),
    benchmarkProps: buildBenchmarkRouteProps({
      dataState: resourceStates.benchmark,
      runs: benchmarkRuns,
      suites: benchmarkSuites,
      suiteId: benchmarkSuiteId,
      modelId: benchmarkModelId,
      concurrency: benchmarkConcurrency,
      loading: loading || isResourceStateBusy(resourceStates.benchmark),
      canRun: canRunBenchmark,
      canCancel: canCancelBenchmark,
      canDownload: canDownloadBenchmark,
      onSuiteChange: setBenchmarkSuiteId,
      onModelChange: setBenchmarkModelId,
      onConcurrencyChange: setBenchmarkConcurrency,
      onStart: onStartBenchmark,
      onRefresh: () => { void loadBenchmarkResources("refresh") },
      onCancel: onCancelBenchmark,
      onBack: () => setActiveView("chat")
    }),
    documentProps: buildDocumentRouteProps({
      dataState: resourceStates.documents,
      documents,
      documentGroups,
      loading: loading || isResourceStateBusy(resourceStates.documents),
      onRetryLoad: () => { void loadDocumentResources("retry") },
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
      dataState: resourceStates.admin,
      user: currentUser,
      documentsCount: isResourcePartAvailable(resourceStates.documents, "catalog") ? documents.length : null,
      openQuestionsCount: isResourcePartAvailable(resourceStates.assignee, "questions")
        ? questions.filter((questionItem) => questionItem.status === "open").length
        : null,
      debugRunsCount: isResourcePartAvailable(resourceStates.debug, "runs") ? debugRuns.length : null,
      benchmarkRunsCount: isResourcePartAvailable(resourceStates.benchmark, "runs") ? benchmarkRuns.length : null,
      managedUsers,
      managedUserPage,
      adminAuditPage,
      accessRoleList,
      usageSummaries,
      costAudit,
      aliasPage,
      aliasAuditPage,
      pendingAdminMutationKeys,
      urlState: adminUrlState,
      onUrlStateChange: onAdminUrlStateChange,
      loading: loading || isResourceStateBusy(resourceStates.admin),
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
      canExportUsage,
      canExportCosts,
      canReadAdminAuditLog,
      canExportAdminAuditLog,
      onApplyUsageCostQuery: applyUsageCostQuery,
      onLoadMoreUsage: loadMoreUsage,
      onLoadMoreCosts: loadMoreCosts,
      onCreateUsageExport,
      onCreateCostExport,
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
      onRefreshAdminData: async () => { await loadAdminResources("refresh") },
      onRefreshAdminPart: async (partId) => { await refreshAdminPart(partId) },
      onLoadMoreAdminAudit: async () => {
        if (!adminAuditPage?.nextCursor) return
        await runResourceLoad("admin", [{
          id: "audit",
          label: "管理操作履歴",
          load: () => refreshAdminAuditLog({ ...adminAuditQueryForState(adminUrlState), cursor: adminAuditPage.nextCursor }, true)
        }], "refresh")
      },
      onCreateAdminAuditExport,
      onLoadMoreManagedUsers: async () => {
        if (!managedUserPage?.nextCursor) return
        await runResourceLoad("admin", [{ id: "users", label: "管理対象ユーザー", load: loadMoreManagedUsers }], "refresh")
      },
      onLoadMoreAliases: async () => {
        if (!aliasPage?.nextCursor) return
        await runResourceLoad("admin", [{
          id: "aliases",
          label: "用語展開一覧",
          load: () => refreshAliases({ ...aliasListQueryForState(adminUrlState), cursor: aliasPage.nextCursor }, true)
        }], "refresh")
      },
      onLoadMoreAliasAudit: async () => {
        if (!aliasAuditPage?.nextCursor) return
        await runResourceLoad("admin", [{
          id: "aliasAudit",
          label: "用語展開監査ログ",
          load: () => refreshAliasAuditLog({ ...aliasAuditQueryForState(adminUrlState), cursor: aliasAuditPage.nextCursor }, true)
        }], "refresh")
      },
      onCreateAlias,
      onUpdateAlias,
      onReviewAlias,
      onTransitionAlias,
      onDisableAlias,
      onPublishAliases,
      onBack: () => setActiveView("chat")
    }),
    historyProps: buildHistoryRouteProps({
      dataState: resourceStates.history,
      history,
      onRetry: () => {
        void runResourceLoad("history", [{ id: "conversations", label: "会話履歴", load: refreshHistory }], "retry")
      },
      onSelect: (item) => {
        setCurrentConversationId(item.id)
        setMessages(item.messages)
        setActiveView("chat")
        setErrorNotice(null)
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
      dataState: resourceStates.favorites,
      favorites,
      onRetry: () => {
        void runResourceLoad("favorites", [{ id: "favorites", label: "お気に入り", load: refreshFavorites }], "retry")
      },
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

export function publicSafeUiError(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  const generic = "処理を完了できませんでした。入力内容と権限を確認して、もう一度お試しください。"
  if (!compact || compact.length > 240) return generic
  if (/[{}<>]|(?:arn:|s3:\/\/|request.?id|stack|exception|traceback|select\s+.+\s+from|\bat\s+\S+\s*\()/i.test(compact)) return generic
  return compact
}

function readAppRouteFromLocation(): ParsedAppRoute {
  if (typeof window === "undefined") return { view: "chat", needsNormalization: false }
  return parseAppRoute(window.location)
}

function readDocumentWorkspaceUrlStateFromLocation(): DocumentWorkspaceUrlState {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const pathState = readDocumentWorkspacePathState(window.location.pathname)
  const sort = params.get("sort")
  const page = parseDocumentPage(params.get("page"))
  const pageSize = parseDocumentPageSize(params.get("pageSize"))
  return {
    ...pathState,
    folderId: params.get("group") || pathState.folderId,
    documentId: params.get("document") || pathState.documentId,
    migrationId: params.get("migration") || pathState.migrationId,
    folderQuery: params.get("folderQuery") || undefined,
    query: params.get("query") || undefined,
    type: params.get("type") || undefined,
    status: params.get("status") || undefined,
    groupFilter: params.get("documentGroup") || undefined,
    sort: sort && documentSortKeys.has(sort) ? sort as DocumentWorkspaceUrlState["sort"] : undefined,
    page,
    pageSize
  }
}

function readAdminWorkspaceUrlStateFromLocation(): AdminWorkspaceUrlState {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const section = params.get("section")
  const aliasStatus = params.get("aliasStatus")
  const auditAction = params.get("auditAction")
  const sort = params.get("sort")
  const userStatus = params.get("userStatus")
  const userSort = params.get("userSort")
  return {
    section: section && adminSections.has(section as NonNullable<AdminWorkspaceUrlState["section"]>)
      ? section as AdminWorkspaceUrlState["section"]
      : undefined,
    query: params.get("adminQuery") || undefined,
    userStatus: userStatus && adminUserStatuses.has(userStatus as never) ? userStatus as AdminWorkspaceUrlState["userStatus"] : undefined,
    userSort: userSort && adminUserSortKeys.has(userSort as never) ? userSort as AdminWorkspaceUrlState["userSort"] : undefined,
    aliasStatus: aliasStatus && aliasStatuses.has(aliasStatus as NonNullable<AdminWorkspaceUrlState["aliasStatus"]>)
      ? aliasStatus as AdminWorkspaceUrlState["aliasStatus"]
      : undefined,
    auditAction: auditAction && (
      adminAuditActions.has(auditAction as never) || aliasAuditActions.has(auditAction as never)
    ) ? auditAction as AdminWorkspaceUrlState["auditAction"] : undefined,
    sort: sort && aliasSortKeys.has(sort as NonNullable<AdminWorkspaceUrlState["sort"]>)
      ? sort as AdminWorkspaceUrlState["sort"]
      : undefined,
    selected: params.get("selected") || undefined
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

function writeDocumentWorkspaceUrlStateToLocation(state: DocumentWorkspaceUrlState, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  const pathState = documentWorkspacePathState(state)
  url.pathname = pathState.pathname
  url.searchParams.delete("view")
  setSearchParam(url, "group", pathState.pathKey === "folderId" ? undefined : state.folderId)
  setSearchParam(url, "document", pathState.pathKey === "documentId" ? undefined : state.documentId)
  setSearchParam(url, "migration", pathState.pathKey === "migrationId" ? undefined : state.migrationId)
  setSearchParam(url, "folderQuery", state.folderQuery)
  setSearchParam(url, "query", state.query)
  setSearchParam(url, "type", state.type)
  setSearchParam(url, "status", state.status)
  setSearchParam(url, "documentGroup", state.groupFilter)
  setSearchParam(url, "sort", state.sort)
  setSearchParam(url, "page", state.page && state.page > 1 ? String(state.page) : undefined)
  setSearchParam(url, "pageSize", state.pageSize && state.pageSize !== 25 ? String(state.pageSize) : undefined)
  writeBrowserUrl(url, historyMode)
}

function writeAdminWorkspaceUrlStateToLocation(state: AdminWorkspaceUrlState, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.pathname = "/"
  url.search = ""
  url.searchParams.set("view", "admin")
  setSearchParam(url, "section", state.section && state.section !== "overview" ? state.section : undefined)
  setSearchParam(url, "adminQuery", state.query)
  setSearchParam(url, "userStatus", state.userStatus)
  setSearchParam(url, "userSort", state.userSort && state.userSort !== "emailAsc" ? state.userSort : undefined)
  setSearchParam(url, "aliasStatus", state.aliasStatus)
  setSearchParam(url, "auditAction", state.auditAction)
  setSearchParam(url, "sort", state.sort && state.sort !== "updatedDesc" ? state.sort : undefined)
  setSearchParam(url, "selected", state.selected)
  url.hash = ""
  writeBrowserUrl(url, historyMode)
}

function aliasListQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    status: state.aliasStatus,
    sort: state.sort ?? "updatedDesc" as const
  }
}

function adminUserQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    status: state.userStatus,
    sort: state.userSort ?? "emailAsc" as const
  }
}

function aliasAuditQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    action: state.auditAction && aliasAuditActions.has(state.auditAction as never)
      ? state.auditAction as "create" | "update" | "review" | "transition" | "disable" | "publish"
      : undefined,
    aliasId: state.selected
  }
}

function adminAuditQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    action: state.auditAction && adminAuditActions.has(state.auditAction as never)
      ? state.auditAction as "user:create" | "role:assign" | "user:suspend" | "user:unsuspend" | "user:delete"
      : undefined
  }
}

function parseDocumentPage(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d{0,5}$/.test(value)) return undefined
  return Number(value)
}

function parseDocumentPageSize(value: string | null): number | undefined {
  if (value !== "25" && value !== "50" && value !== "100") return undefined
  return Number(value)
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
