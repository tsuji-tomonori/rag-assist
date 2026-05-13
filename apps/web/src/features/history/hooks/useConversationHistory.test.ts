import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteConversationHistory, listConversationHistory, saveConversationHistory } from "../api/conversationHistoryApi.js"
import type { ConversationHistoryItem } from "../types.js"
import type { HumanQuestion } from "../../questions/types.js"
import { useConversationHistory } from "./useConversationHistory.js"

vi.mock("../api/conversationHistoryApi.js", () => ({
  deleteConversationHistory: vi.fn(),
  listConversationHistory: vi.fn(),
  saveConversationHistory: vi.fn()
}))

const question = (overrides: Partial<HumanQuestion> = {}): HumanQuestion => ({
  questionId: "q-1",
  title: "申請期限",
  question: "期限は？",
  requesterName: "利用者",
  requesterDepartment: "人事",
  assigneeDepartment: "総務",
  category: "policy",
  priority: "normal",
  status: "open",
  createdAt: "2026-05-06T00:00:00.000Z",
  updatedAt: "2026-05-06T00:00:00.000Z",
  ...overrides
})

const item = (overrides: Partial<ConversationHistoryItem> = {}): ConversationHistoryItem => ({
  schemaVersion: 1,
  id: "conv-1",
  title: "会話",
  updatedAt: "2026-05-06T00:00:00.000Z",
  isFavorite: false,
  messages: [{ role: "assistant", text: "回答", createdAt: "2026-05-06T00:00:00.000Z", questionTicket: question() }],
  ...overrides
})

describe("useConversationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(Date, "now").mockReturnValue(1)
    vi.spyOn(Math, "random").mockReturnValue(0.123456)
    vi.mocked(listConversationHistory).mockResolvedValue([item()])
    vi.mocked(saveConversationHistory).mockResolvedValue(item())
    vi.mocked(deleteConversationHistory).mockResolvedValue(undefined)
  })

  it("refreshes, remembers, sorts, and preserves favorite state", async () => {
    const { result } = renderHook(() => useConversationHistory({ setError: vi.fn() }))

    await act(() => result.current.refreshHistory())
    act(() => result.current.rememberConversation(item({ id: "conv-1", updatedAt: "2026-05-06T01:00:00.000Z", isFavorite: true })))
    act(() => result.current.rememberMessages("conv-1", "  長い   タイトル ".repeat(4), [{ role: "user", text: "質問", createdAt: "now" }]))

    expect(result.current.currentConversationId).toMatch(/^conv-1-[a-z0-9]{6}$/)
    expect(result.current.history[0]?.isFavorite).toBe(true)
    expect(result.current.history[0]?.title.length).toBeLessThanOrEqual(37)
    expect(saveConversationHistory).toHaveBeenCalled()
  })

  it("updates linked question tickets and reports persistence errors", async () => {
    const setError = vi.fn()
    vi.mocked(saveConversationHistory).mockRejectedValueOnce(new Error("save failed")).mockRejectedValueOnce(new Error("favorite failed"))
    vi.mocked(deleteConversationHistory).mockRejectedValueOnce(new Error("delete failed"))
    const { result } = renderHook(() => useConversationHistory({ setError }))

    await act(() => result.current.refreshHistory())
    act(() => result.current.updateHistoryQuestionTickets([question({ updatedAt: "2026-05-06T02:00:00.000Z", status: "answered" })]))
    act(() => result.current.toggleFavorite(result.current.history[0]!))
    await act(async () => {
      await Promise.resolve()
    })
    act(() => result.current.deleteHistoryItem("conv-1"))
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.history).toEqual([])
    expect(setError).toHaveBeenCalledWith("favorite failed")
    expect(setError).toHaveBeenCalledWith("delete failed")
  })
})
