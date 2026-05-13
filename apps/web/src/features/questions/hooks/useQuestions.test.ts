import { act, renderHook } from "@testing-library/react"
import type { SetStateAction } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { answerQuestion, createQuestion, getQuestion, listQuestions, resolveQuestion } from "../api/questionsApi.js"
import type { HumanQuestion } from "../types.js"
import type { Message } from "../../chat/types.js"
import { useQuestions } from "./useQuestions.js"

vi.mock("../api/questionsApi.js", () => ({
  answerQuestion: vi.fn(),
  createQuestion: vi.fn(),
  getQuestion: vi.fn(),
  listQuestions: vi.fn(),
  resolveQuestion: vi.fn()
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

function createProps(overrides: Partial<Parameters<typeof useQuestions>[0]> = {}): Parameters<typeof useQuestions>[0] {
  return {
    canAnswerQuestions: true,
    setMessages: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    ...overrides
  }
}

describe("useQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.mocked(listQuestions).mockResolvedValue([question(), question({ questionId: "q-2", updatedAt: "2026-05-06T01:00:00.000Z" })])
    vi.mocked(getQuestion).mockResolvedValue(question({ status: "answered", updatedAt: "2026-05-06T02:00:00.000Z" }))
    vi.mocked(createQuestion).mockResolvedValue(question())
    vi.mocked(answerQuestion).mockResolvedValue(question({ status: "answered", answerBody: "回答" }))
    vi.mocked(resolveQuestion).mockResolvedValue(question({ status: "resolved", resolvedAt: "2026-05-06T03:00:00.000Z" }))
  })

  it("refreshes questions and keeps an existing selection when possible", async () => {
    const { result } = renderHook(() => useQuestions(createProps()))

    act(() => result.current.setSelectedQuestionId("q-2"))
    await act(() => result.current.refreshQuestions())

    expect(result.current.selectedQuestionId).toBe("q-2")
    expect(result.current.questions.map((item) => item.questionId)).toEqual(["q-1", "q-2"])
  })

  it("creates, answers, resolves, and mirrors tickets into chat messages", async () => {
    let messages: Message[] = [{ role: "assistant", text: "回答不能", createdAt: "now", questionTicket: question() }]
    const setMessages = vi.fn((updater: SetStateAction<Message[]>) => {
      messages = typeof updater === "function" ? updater(messages) : updater
    })
    const props = createProps({ setMessages })
    const { result } = renderHook(() => useQuestions(props))

    await act(() => result.current.onCreateQuestion(0, messages[0]!, { title: "申請期限", question: "期限は？", category: "policy" }))
    await act(() => result.current.onAnswerQuestion("q-1", { answerTitle: "回答", answerBody: "本文" }))
    await act(() => result.current.onResolveQuestion("q-1"))

    expect(createQuestion).toHaveBeenCalled()
    expect(answerQuestion).toHaveBeenCalledWith("q-1", { answerTitle: "回答", answerBody: "本文" })
    expect(resolveQuestion).toHaveBeenCalledWith("q-1")
    expect(messages[0]?.questionTicket?.status).toBe("resolved")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("deduplicates unresolved linked question refreshes and ignores missing tickets", async () => {
    vi.mocked(getQuestion).mockRejectedValueOnce(new Error("gone")).mockResolvedValueOnce(question({ questionId: "q-2", updatedAt: "new" }))
    let messages: Message[] = [
      { role: "assistant", text: "a", createdAt: "now", questionTicket: question({ questionId: "q-1" }) },
      { role: "assistant", text: "b", createdAt: "now", questionTicket: question({ questionId: "q-1" }) },
      { role: "assistant", text: "c", createdAt: "now", questionTicket: question({ questionId: "q-2" }) },
      { role: "assistant", text: "d", createdAt: "now", questionTicket: question({ questionId: "q-3", status: "resolved" }) }
    ]
    const setMessages = vi.fn((updater: SetStateAction<Message[]>) => {
      messages = typeof updater === "function" ? updater(messages) : updater
    })
    const { result } = renderHook(() => useQuestions(createProps({ setMessages })))

    const updated = await result.current.refreshLinkedQuestions(messages)

    expect(getQuestion).toHaveBeenCalledTimes(2)
    expect(updated).toHaveLength(1)
    expect(messages[2]?.questionTicket?.updatedAt).toBe("new")
  })

  it("reports API errors without leaving loading active", async () => {
    const props = createProps()
    vi.mocked(answerQuestion).mockRejectedValueOnce("answer failed")
    const { result } = renderHook(() => useQuestions(props))

    await act(() => result.current.onAnswerQuestion("q-1", { answerTitle: "回答", answerBody: "本文" }))

    expect(props.setError).toHaveBeenCalledWith("answer failed")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })
})
