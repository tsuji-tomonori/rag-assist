import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthSession } from "../../authClient.js"
import type { Permission } from "../../shared/types/common.js"
import { useAppShellState } from "./useAppShellState.js"

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
const debugMock = vi.hoisted(() => ({
  setDebugRuns: vi.fn(),
  setSelectedRunId: vi.fn(),
  setExpandedStepId: vi.fn(),
  setAllExpanded: vi.fn(),
  refreshDebugRuns: vi.fn(),
  useDebugSelection: vi.fn()
}))
const chatMock = vi.hoisted(() => ({
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
  refreshAdminData: vi.fn(),
  onAssignUserRoles: vi.fn(),
  onCreateManagedUser: vi.fn(),
  onSetManagedUserStatus: vi.fn(),
  onCreateAlias: vi.fn(),
  onUpdateAlias: vi.fn(),
  onReviewAlias: vi.fn(),
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
  useChatSession: vi.fn(() => ({
    question: "",
    messages: [{ role: "user", text: "質問", createdAt: "now" }, { role: "assistant", text: "回答", createdAt: "later", result: { answer: "回答", isAnswerable: true, citations: [], retrieved: [], debug: { steps: [] } } }],
    pendingActivity: null,
    pendingDebugQuestion: null,
    conversationKey: "conv-1",
    submitShortcut: "ctrlEnter",
    canAsk: true,
    ...chatMock
  }))
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
    aliasAuditLog: [],
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
      debugMock.refreshDebugRuns,
      questionsMock.refreshQuestions,
      adminMock.refreshManagedUsers,
      adminMock.refreshAdminAuditLog,
      adminMock.refreshAccessRoles,
      adminMock.refreshUsageSummaries,
      adminMock.refreshCostAudit,
      adminMock.refreshAliases,
      adminMock.refreshAdminData,
      questionsMock.refreshLinkedQuestions,
      questionsMock.refreshQuestionTickets
    ]) {
      fn.mockResolvedValue([])
    }
  })

  it("wires navigation callbacks, admin refresh, history selection, and debug toggles", async () => {
    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })
    act(() => result.current.routeProps.adminProps.onOpenBenchmark())
    expect(result.current.railProps.activeView).toBe("benchmark")

    await act(async () => {
      result.current.routeProps.benchmarkProps.onRefresh()
      await Promise.resolve()
    })
    expect(benchmarkMock.refreshBenchmarkRuns).toHaveBeenCalled()

    await act(async () => {
      await result.current.routeProps.adminProps.onRefreshAdminData()
    })
    expect(adminMock.refreshAdminData).toHaveBeenCalled()
    expect(documentsMock.refreshReindexMigrations).toHaveBeenCalled()
    expect(adminMock.refreshAliases).toHaveBeenCalled()

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
    expect(result.current.routeProps.profileProps.authSession.email).toBe("user@example.com")
    result.current.routeProps.profileProps.onSetSubmitShortcut("enter")
    expect(chatMock.setSubmitShortcut).toHaveBeenCalledWith("enter")
  })

  it("hydrates and writes document workspace state through URL query parameters", async () => {
    window.history.replaceState(null, "", "/?view=documents&group=group-1&document=doc-1&query=handbook&sort=fileNameAsc")
    const { result } = renderHook(() => useAppShellState({ authSession: session, onSignOut: vi.fn() }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.routeProps.activeView).toBe("documents")
    expect(result.current.routeProps.documentProps.urlState).toEqual({
      folderId: "group-1",
      documentId: "doc-1",
      query: "handbook",
      sort: "fileNameAsc",
      type: undefined,
      status: undefined,
      groupFilter: undefined
    })

    act(() => {
      result.current.routeProps.documentProps.onUrlStateChange?.({
        folderId: "group-2",
        documentId: "doc-2",
        query: "policy",
        type: "PDF",
        status: "active",
        groupFilter: "group-2",
        sort: "chunkDesc"
      })
    })

    expect(window.location.search).toContain("view=documents")
    expect(window.location.search).toContain("group=group-2")
    expect(window.location.search).toContain("document=doc-2")
    expect(window.location.search).toContain("query=policy")
    expect(window.location.search).toContain("type=PDF")
    expect(window.location.search).toContain("status=active")
    expect(window.location.search).toContain("documentGroup=group-2")
    expect(window.location.search).toContain("sort=chunkDesc")

    act(() => {
      window.history.pushState(null, "", "/?view=documents&query=戻る")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })

    expect(result.current.routeProps.activeView).toBe("documents")
    expect(result.current.routeProps.documentProps.urlState).toEqual({
      folderId: undefined,
      documentId: undefined,
      query: "戻る",
      type: undefined,
      status: undefined,
      groupFilter: undefined,
      sort: undefined
    })
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

    expect(result.current.error).toBe("user load failed")
    expect(result.current.routeProps.canSeeAdminSettings).toBe(false)
    expect(documentsMock.setFile).toHaveBeenCalledWith(null)
  })
})
