import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthSession } from "../../features/auth/api/authClient.js"
import type { Permission } from "../../shared/types/common.js"
import { publicSafeUiError, useAppShellState } from "./useAppShellState.js"

const currentUserMock = vi.hoisted(() => ({ useCurrentUser: vi.fn() }))
const documentsMock = vi.hoisted(() => ({
  refreshDocuments: vi.fn(),
  refreshDocumentGroups: vi.fn(),
  refreshReindexMigrations: vi.fn(),
  setFile: vi.fn(),
  setSelectedDocumentId: vi.fn(),
  setSelectedGroupId: vi.fn(),
  setUploadGroupId: vi.fn(),
  onUploadDocumentFile: vi.fn(),
  onCreateDocumentGroup: vi.fn(),
  onShareDocumentGroup: vi.fn(),
  onDelete: vi.fn(),
  onStageReindex: vi.fn(),
  onCutoverReindex: vi.fn(),
  onRollbackReindex: vi.fn()
}))
const benchmarkMock = vi.hoisted(() => ({
  refreshBenchmarkRuns: vi.fn(),
  refreshBenchmarkSuites: vi.fn(),
  setBenchmarkSuiteId: vi.fn(),
  setBenchmarkModelId: vi.fn(),
  setBenchmarkConcurrency: vi.fn(),
  onStartBenchmark: vi.fn(),
  onCancelBenchmark: vi.fn()
}))
const historyMock = vi.hoisted(() => ({
  setCurrentConversationId: vi.fn(),
  refreshHistory: vi.fn(),
  rememberMessages: vi.fn(),
  toggleFavorite: vi.fn(),
  deleteHistoryItem: vi.fn(),
  updateHistoryQuestionTickets: vi.fn(),
  createConversationId: vi.fn(() => "conv-2")
}))
const favoritesMock = vi.hoisted(() => ({
  refreshFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn()
}))
const debugMock = vi.hoisted(() => ({
  setDebugRuns: vi.fn(),
  setSelectedRunId: vi.fn(),
  setExpandedStepId: vi.fn(),
  setAllExpanded: vi.fn(),
  refreshDebugRuns: vi.fn(),
  useDebugSelection: vi.fn()
}))
const chatMock = vi.hoisted(() => ({
  useChatSession: vi.fn(),
  setQuestion: vi.fn(),
  setMessages: vi.fn(),
  setPendingActivity: vi.fn(),
  setPendingDebugQuestion: vi.fn(),
  setSubmitShortcut: vi.fn(),
  onAsk: vi.fn(),
  submitClarificationOption: vi.fn(),
  startClarificationFreeform: vi.fn(),
  newConversation: vi.fn()
}))
const questionsMock = vi.hoisted(() => ({
  setSelectedQuestionId: vi.fn(),
  refreshQuestions: vi.fn(),
  refreshQuestionTickets: vi.fn(),
  refreshLinkedQuestions: vi.fn(),
  onCreateQuestion: vi.fn(),
  onAnswerQuestion: vi.fn(),
  onResolveQuestion: vi.fn()
}))
const adminMock = vi.hoisted(() => ({
  refreshManagedUsers: vi.fn(),
  refreshAdminAuditLog: vi.fn(),
  refreshAccessRoles: vi.fn(),
  refreshUsageSummaries: vi.fn(),
  refreshCostAudit: vi.fn(),
  refreshAliases: vi.fn(),
  refreshAliasAuditLog: vi.fn(),
  refreshAdminData: vi.fn(),
  onAssignUserRoles: vi.fn(),
  onCreateManagedUser: vi.fn(),
  onPrepareManagedUserDelete: vi.fn(),
  onSetManagedUserStatus: vi.fn(),
  onCreateAlias: vi.fn(),
  onUpdateAlias: vi.fn(),
  onReviewAlias: vi.fn(),
  onTransitionAlias: vi.fn(),
  onDisableAlias: vi.fn(),
  onPublishAliases: vi.fn()
}))

vi.mock("./useCurrentUser.js", () => currentUserMock)
vi.mock("../../features/documents/hooks/useDocuments.js", () => ({
  useDocuments: vi.fn(() => ({
    documents: [{ documentId: "doc-1", fileName: "handbook.md", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }],
    documentGroups: [],
    reindexMigrations: [],
    selectedDocumentId: "doc-1",
    selectedGroupId: "all",
    uploadGroupId: "personal",
    file: { name: "upload.txt" },
    ...documentsMock
  }))
}))
vi.mock("../../features/benchmark/hooks/useBenchmarkRuns.js", () => ({
  useBenchmarkRuns: vi.fn(() => ({
    benchmarkRuns: [{ runId: "bench-1", status: "queued", mode: "agent", runner: "codebuild", suiteId: "standard", datasetS3Key: "dataset", createdBy: "user", createdAt: "now", updatedAt: "now" }],
    benchmarkSuites: [{ suiteId: "standard", label: "standard", mode: "agent", datasetS3Key: "dataset", preset: "standard", defaultConcurrency: 1 }],
    benchmarkSuiteId: "standard",
    benchmarkModelId: "model",
    benchmarkConcurrency: 1,
    ...benchmarkMock
  }))
}))
vi.mock("../../features/history/hooks/useConversationHistory.js", () => ({
  useConversationHistory: vi.fn(() => ({
    history: [{
      schemaVersion: 1,
      id: "conv-1",
      title: "履歴",
      updatedAt: "now",
      messages: [{ role: "user", text: "質問", createdAt: "now" }]
    }],
    currentConversationId: "conv-1",
    ...historyMock
  }))
}))
vi.mock("../../features/favorites/hooks/useFavorites.js", () => ({
  useFavorites: vi.fn(() => ({
    favorites: [],
    ...favoritesMock
  }))
}))
vi.mock("../../features/debug/hooks/useDebugRuns.js", () => ({
  useDebugRuns: vi.fn(() => ({
    debugRuns: [{ runId: "debug-1", question: "質問", status: "success", steps: [] }],
    selectedRunId: "",
    expandedStepId: null,
    allExpanded: false,
    ...debugMock
  })),
  useDebugSelection: debugMock.useDebugSelection
}))
vi.mock("../../features/chat/hooks/useChatSession.js", () => ({
  useChatSession: chatMock.useChatSession
}))
vi.mock("../../features/questions/hooks/useQuestions.js", () => ({
  useQuestions: vi.fn(() => ({
    questions: [{ questionId: "q-1", title: "質問", question: "質問", requesterName: "user", requesterDepartment: "dept", assigneeDepartment: "dept", category: "policy", priority: "normal", status: "open", createdAt: "now", updatedAt: "now" }],
    selectedQuestionId: "q-1",
    ...questionsMock
  }))
}))
vi.mock("../../features/admin/hooks/useAdminData.js", () => ({
  useAdminData: vi.fn(() => ({
    managedUsers: [],
    adminAuditLog: [],
    accessRoles: [],
    usageSummaries: [],
    costAudit: null,
    aliases: [],
    aliasPage: null,
    aliasAuditLog: [],
    aliasAuditPage: null,
    adminAuditPage: null,
    accessRoleList: null,
    ...adminMock
  }))
}))

const session: AuthSession = {
  email: "user@example.com",
  idToken: "id-token",
  expiresAt: Date.now() + 1000
}

const allPermissions: Permission[] = [
  "chat:create",
  "chat:read:own",
  "chat:admin:read_all",
  "rag:doc:read",
  "rag:doc:write:group",
  "rag:doc:delete:group",
  "rag:index:rebuild:group",
  "rag:group:create",
  "rag:group:assign_manager",
  "folder.move",
  "rag:alias:read",
  "rag:alias:write:group",
  "rag:alias:review:group",
  "rag:alias:disable:group",
  "rag:alias:publish:group",
  "answer:edit",
  "access:policy:read",
  "benchmark:read",
  "benchmark:run",
  "benchmark:cancel",
  "benchmark:download",
  "agent:read:self",
  "agent:run",
  "agent:cancel",
  "user:read",
  "user:create",
  "user:suspend",
  "user:unsuspend",
  "user:delete",
  "access:role:assign",
  "usage:read:all_users",
  "cost:read:all"
]

describe("useAppShellState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    window.history.replaceState(null, "", "/")
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    debugMock.useDebugSelection.mockReturnValue({ selectedTrace: { steps: [] }, totalLatency: 123, selectedRunValue: "debug-1" })
    currentUserMock.useCurrentUser.mockReturnValue({
      currentUser: { userId: "user-1", email: "user@example.com", groups: ["SYSTEM_ADMIN"], permissions: allPermissions },
      currentUserError: null
    })
    for (const fn of [
      documentsMock.refreshDocuments,
      documentsMock.refreshDocumentGroups,
      documentsMock.refreshReindexMigrations,
      benchmarkMock.refreshBenchmarkRuns,
      benchmarkMock.refreshBenchmarkSuites,
      historyMock.refreshHistory,
      favoritesMock.refreshFavorites,
      debugMock.refreshDebugRuns,
      questionsMock.refreshQuestions,
      adminMock.refreshManagedUsers,
      adminMock.refreshAdminAuditLog,
      adminMock.refreshAccessRoles,
      adminMock.refreshUsageSummaries,
      adminMock.refreshCostAudit,
      adminMock.refreshAliases,
      adminMock.refreshAliasAuditLog,
      adminMock.refreshAdminData,
      questionsMock.refreshLinkedQuestions,
      questionsMock.refreshQuestionTickets
    ]) {
      fn.mockResolvedValue([])
    }
    chatMock.useChatSession.mockImplementation(() => ({
      question: "",
      messages: [{ role: "user", text: "質問", createdAt: "now" }, { role: "assistant", text: "回答", createdAt: "later", result: { answer: "回答", isAnswerable: true, citations: [], retrieved: [], debug: { steps: [] } } }],
      pendingActivity: null,
      pendingDebugQuestion: null,
      conversationKey: "conv-1",
      submitShortcut: "ctrlEnter",
      canAsk: true,
      setQuestion: chatMock.setQuestion,
      setMessages: chatMock.setMessages,
      setPendingActivity: chatMock.setPendingActivity,
      setPendingDebugQuestion: chatMock.setPendingDebugQuestion,
      setSubmitShortcut: chatMock.setSubmitShortcut,
      onAsk: chatMock.onAsk,
      submitClarificationOption: chatMock.submitClarificationOption,
      startClarificationFreeform: chatMock.startClarificationFreeform,
      newConversation: chatMock.newConversation
    }))
  })

  it("wires navigation callbacks, admin refresh, history selection, and debug toggles", async () => {
    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })
    act(() => result.current.routeProps.adminProps.onOpenBenchmark())
    expect(result.current.railProps.activeView).toBe("benchmark")
    expect(window.location.search).toBe("?view=benchmark")

    await act(async () => {
      result.current.routeProps.benchmarkProps.onRefresh()
      await Promise.resolve()
    })
    expect(benchmarkMock.refreshBenchmarkRuns).toHaveBeenCalled()

    await act(async () => {
      await result.current.routeProps.adminProps.onRefreshAdminData()
    })
    expect(adminMock.refreshManagedUsers).toHaveBeenCalled()
    expect(adminMock.refreshAdminAuditLog).toHaveBeenCalled()
    expect(adminMock.refreshAccessRoles).toHaveBeenCalled()
    expect(adminMock.refreshUsageSummaries).toHaveBeenCalled()
    expect(adminMock.refreshCostAudit).toHaveBeenCalled()
    expect(adminMock.refreshAliases).toHaveBeenCalled()
    expect(adminMock.refreshAliasAuditLog).toHaveBeenCalled()

    act(() => result.current.routeProps.adminProps.onOpenDebug())
    expect(result.current.railProps.activeView).toBe("chat")
    expect(result.current.topBarProps.debugMode).toBe(true)

    act(() => result.current.routeProps.historyProps.onSelect({
      schemaVersion: 1,
      id: "conv-9",
      title: "履歴",
      updatedAt: "now",
      messages: [{ role: "assistant", text: "履歴回答", createdAt: "now" }]
    }))
    expect(historyMock.setCurrentConversationId).toHaveBeenCalledWith("conv-9")
    expect(chatMock.setMessages).toHaveBeenCalled()
    expect(debugMock.setSelectedRunId).toHaveBeenCalledWith("")

    act(() => result.current.routeProps.chatProps.onToggleAllDebugSteps())
    expect(debugMock.setAllExpanded).toHaveBeenCalled()
    act(() => result.current.routeProps.chatProps.onToggleDebugStep(1))
    expect(debugMock.setExpandedStepId).toHaveBeenCalled()

    act(() => result.current.railProps.onChangeView("profile"))
    expect(window.location.search).toBe("?view=profile")
    expect(result.current.routeProps.profileProps.authSession.email).toBe("user@example.com")
    result.current.routeProps.profileProps.onSetSubmitShortcut("enter")
    expect(chatMock.setSubmitShortcut).toHaveBeenCalledWith("enter")
  })

  it("hydrates and writes document workspace state through URL query parameters", async () => {
    window.history.replaceState(null, "", "/documents/reindex-migrations/migration-1?view=documents&group=group-1&document=doc-1&folderQuery=規定&query=handbook&sort=fileNameAsc&page=2&pageSize=50")
    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.routeProps.activeView).toBe("documents")
    expect(window.location.pathname).toBe("/documents/reindex-migrations/migration-1")
    expect(window.location.search).not.toContain("view=")
    expect(result.current.routeProps.documentProps.urlState).toEqual({
      folderId: "group-1",
      documentId: "doc-1",
      migrationId: "migration-1",
      folderQuery: "規定",
      query: "handbook",
      sort: "fileNameAsc",
      type: undefined,
      status: undefined,
      groupFilter: undefined,
      page: 2,
      pageSize: 50
    })

    const pushState = vi.spyOn(window.history, "pushState")
    act(() => {
      result.current.routeProps.documentProps.onUrlStateChange?.({
        folderId: "group-2",
        documentId: "doc-2",
        migrationId: "migration-2",
        folderQuery: "手順",
        query: "policy",
        type: "PDF",
        status: "active",
        groupFilter: "group-2",
        sort: "chunkDesc",
        page: 3,
        pageSize: 100
      }, "push")
    })

    expect(window.location.pathname).toBe("/documents/reindex-migrations/migration-2")
    expect(window.location.search).toContain("group=group-2")
    expect(window.location.search).toContain("document=doc-2")
    expect(window.location.search).not.toContain("migration=")
    expect(window.location.search).toContain("folderQuery=%E6%89%8B%E9%A0%86")
    expect(window.location.search).toContain("query=policy")
    expect(window.location.search).toContain("type=PDF")
    expect(window.location.search).toContain("status=active")
    expect(window.location.search).toContain("documentGroup=group-2")
    expect(window.location.search).toContain("sort=chunkDesc")
    expect(window.location.search).toContain("page=3")
    expect(window.location.search).toContain("pageSize=100")
    expect(pushState).toHaveBeenCalled()

    act(() => {
      window.history.pushState(null, "", "/?view=documents&query=戻る")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })

    expect(result.current.routeProps.activeView).toBe("documents")
    expect(result.current.routeProps.documentProps.urlState).toEqual({
      folderId: undefined,
      documentId: undefined,
      migrationId: undefined,
      folderQuery: undefined,
      query: "戻る",
      type: undefined,
      status: undefined,
      groupFilter: undefined,
      sort: undefined,
      page: undefined,
      pageSize: undefined
    })
    pushState.mockRestore()
  })

  it("user navigation は history を push し、popstate で view を復元する", async () => {
    const pushState = vi.spyOn(window.history, "pushState")
    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })

    act(() => result.current.railProps.onChangeView("history"))
    expect(pushState).toHaveBeenLastCalledWith(window.history.state, "", "/?view=history")

    act(() => result.current.railProps.onChangeView("favorites"))
    expect(window.location.search).toBe("?view=favorites")

    act(() => {
      window.history.replaceState(null, "", "/?view=history")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })

    expect(result.current.routeProps.activeView).toBe("history")
    expect(result.current.routeNotice).toBeNull()
    pushState.mockRestore()
  })

  it("invalid route を明示して canonical URL へ replace する", async () => {
    window.history.replaceState(null, "", "/?view=obsolete")
    const replaceState = vi.spyOn(window.history, "replaceState")

    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.routeProps.activeView).toBe("chat")
    expect(result.current.routeNotice).toEqual({
      kind: "invalid",
      message: "URLの画面指定を確認できなかったため、安全な開始画面または正規URLへ移動しました。"
    })
    expect(replaceState).toHaveBeenCalled()
    expect(window.location.pathname).toBe("/")
    expect(window.location.search).toBe("")
    replaceState.mockRestore()
  })

  it("denied deep link は protected loader を呼ばず permission notice と許可済み復帰先を示す", async () => {
    window.history.replaceState(null, "", "/?view=admin")
    currentUserMock.useCurrentUser.mockReturnValue({
      currentUser: { userId: "user-1", email: "user@example.com", groups: [], permissions: [] },
      currentUserError: null
    })

    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.routeProps.activeView).toBe("chat")
    expect(result.current.routeNotice).toEqual({
      kind: "permission",
      message: "このURLの画面を表示する権限を確認できなかったため、利用可能な開始画面へ移動しました。"
    })
    expect(window.location.pathname).toBe("/")
    expect(window.location.search).toBe("")
    expect(adminMock.refreshAdminData).not.toHaveBeenCalled()
    expect(adminMock.refreshManagedUsers).not.toHaveBeenCalled()
  })

  it("document workspace から対象文書スコープで chat へ移動する", async () => {
    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.routeProps.documentProps.onAskDocument?.({
        documentId: "doc-1",
        fileName: "handbook.md",
        chunkCount: 1,
        memoryCardCount: 1,
        createdAt: "now"
      })
    })

    expect(result.current.routeProps.activeView).toBe("chat")
    expect(result.current.routeProps.chatProps.documentScope).toEqual({ documentId: "doc-1", fileName: "handbook.md" })
    expect(chatMock.setQuestion).toHaveBeenCalledWith("この資料について質問する: handbook.md")
  })

  it("resets inaccessible state and exposes current user errors", async () => {
    currentUserMock.useCurrentUser.mockReturnValue({
      currentUser: { userId: "user-1", email: "user@example.com", groups: [], permissions: [] },
      currentUserError: "user load failed"
    })
    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.error).toEqual({
      target: expect.objectContaining({ id: "account", label: "アカウント情報" }),
      message: "user load failed"
    })
    expect(result.current.routeProps.canSeeAdminSettings).toBe(false)
    expect(documentsMock.setFile).toHaveBeenCalledWith(null)
  })
})

describe("publicSafeUiError", () => {
  it("利用者向け短文は保持し、内部識別子や stack 断片は一般化する", () => {
    expect(publicSafeUiError("入力内容を確認してください。")).toBe("入力内容を確認してください。")
    expect(publicSafeUiError("RequestId: secret at InternalService (/srv/app.ts:10)")).toBe(
      "処理を完了できませんでした。入力内容と権限を確認して、もう一度お試しください。"
    )
  })
})
