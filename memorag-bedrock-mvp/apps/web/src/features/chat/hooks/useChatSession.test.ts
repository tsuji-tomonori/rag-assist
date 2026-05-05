import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const chatApiMock = vi.hoisted(() => ({
  startChatRun: vi.fn(),
  streamChatRunEvents: vi.fn()
}))
const debugApiMock = vi.hoisted(() => ({
  getDebugRun: vi.fn()
}))

vi.mock("../api/chatApi.js", () => chatApiMock)
vi.mock("../../debug/api/debugApi.js", () => debugApiMock)

import { useChatSession } from "./useChatSession.js"

function createProps(overrides: Partial<Parameters<typeof useChatSession>[0]> = {}): Parameters<typeof useChatSession>[0] {
  return {
    canCreateChat: true,
    canWriteDocuments: true,
    canReadDebugRuns: true,
    file: null,
    setFile: vi.fn(),
    debugMode: false,
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    minScore: 0.2,
    currentConversationId: "conv-1",
    setCurrentConversationId: vi.fn(),
    loading: false,
    rememberMessages: vi.fn(),
    createConversationId: () => "conv-2",
    ingestDocument: vi.fn(),
    setDebugRuns: vi.fn(),
    setSelectedRunId: vi.fn(),
    setExpandedStepId: vi.fn(),
    setAllExpanded: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    ...overrides
  }
}

describe("useChatSession", () => {
  beforeEach(() => {
    chatApiMock.startChatRun.mockReset()
    chatApiMock.streamChatRunEvents.mockReset()
    debugApiMock.getDebugRun.mockReset()
  })

  it("loading 中は canAsk を false にする", () => {
    const { result, rerender } = renderHook((props: Parameters<typeof useChatSession>[0]) => useChatSession(props), {
      initialProps: createProps({ loading: true })
    })

    act(() => result.current.setQuestion("社内規程を確認して"))

    expect(result.current.canAsk).toBe(false)

    rerender(createProps({ loading: false }))

    expect(result.current.canAsk).toBe(true)
  })

  it("stream timeout 後に Last-Event-ID で再接続する", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents
      .mockImplementationOnce(async (_runId, onEvent) => {
        onEvent({ id: 3, type: "timeout", data: { message: "stream timeout" } })
      })
      .mockImplementationOnce(async (_runId, onEvent) => {
        onEvent({
          id: 4,
          type: "final",
          data: {
            answer: "再接続後の回答です。",
            isAnswerable: true,
            citations: [],
            retrieved: []
          }
        })
      })
    const props = createProps()
    const { result } = renderHook(() => useChatSession(props))

    act(() => result.current.setQuestion("長い処理を確認して"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.streamChatRunEvents).toHaveBeenNthCalledWith(1, "chat-run-1", expect.any(Function), undefined)
    expect(chatApiMock.streamChatRunEvents).toHaveBeenNthCalledWith(2, "chat-run-1", expect.any(Function), 3)
    expect(result.current.messages.at(-1)).toMatchObject({
      role: "assistant",
      text: "再接続後の回答です。"
    })
  })

  it("stream 切断後に Last-Event-ID で再接続する", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents
      .mockImplementationOnce(async (_runId, onEvent) => {
        onEvent({ id: 2, type: "status", data: { message: "検索中" } })
        throw new Error("network disconnected")
      })
      .mockImplementationOnce(async (_runId, onEvent) => {
        onEvent({
          id: 3,
          type: "final",
          data: {
            answer: "再接続できました。",
            isAnswerable: true,
            citations: [],
            retrieved: []
          }
        })
      })
    const props = createProps()
    const { result } = renderHook(() => useChatSession(props))

    act(() => result.current.setQuestion("途中切断を確認して"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.streamChatRunEvents).toHaveBeenNthCalledWith(2, "chat-run-1", expect.any(Function), 2)
    expect(result.current.messages.at(-1)).toMatchObject({
      role: "assistant",
      text: "再接続できました。"
    })
  })

  it("final event の debugRunId から debug trace を取得する", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    debugApiMock.getDebugRun.mockResolvedValue({
      schemaVersion: 1,
      runId: "debug-run-1",
      question: "debug を確認して",
      modelId: "model",
      embeddingModelId: "embed",
      clueModelId: "clue",
      topK: 6,
      memoryTopK: 4,
      minScore: 0.2,
      startedAt: "2026-05-04T00:00:00.000Z",
      completedAt: "2026-05-04T00:00:01.000Z",
      totalLatencyMs: 1000,
      status: "success",
      answerPreview: "回答",
      isAnswerable: true,
      citations: [],
      retrieved: [],
      steps: []
    })
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "回答",
          isAnswerable: true,
          citations: [],
          retrieved: [],
          debugRunId: "debug-run-1"
        }
      })
    })
    const setDebugRuns = vi.fn()
    const setSelectedRunId = vi.fn()
    const { result } = renderHook(() => useChatSession(createProps({ debugMode: true, setDebugRuns, setSelectedRunId })))

    act(() => result.current.setQuestion("debug を確認して"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(debugApiMock.getDebugRun).toHaveBeenCalledWith("debug-run-1")
    expect(setSelectedRunId).toHaveBeenCalledWith("debug-run-1")
    expect(setDebugRuns).toHaveBeenCalled()
  })

  it("自由入力の確認回答では元質問を clarificationContext に含める", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "申請期限は2026-07-01です。",
          isAnswerable: true,
          citations: [],
          retrieved: []
        }
      })
    })
    const { result } = renderHook(() => useChatSession(createProps()))

    act(() => result.current.startClarificationFreeform("8/1から育休を取る場合、いつまでに申請する必要がある?", ""))
    act(() => result.current.setQuestion("育児休業"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.startChatRun).toHaveBeenCalledWith(expect.objectContaining({
      question: "育児休業",
      clarificationContext: {
        originalQuestion: "8/1から育休を取る場合、いつまでに申請する必要がある?",
        selectedValue: "育児休業"
      }
    }))
    expect(result.current.messages.at(0)).toMatchObject({ role: "user", text: "育児休業" })
  })

  it("自由入力で略語を正式語に展開した follow-up では clarificationContext を保持する", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "申請期限は2026-07-01です。",
          isAnswerable: true,
          citations: [],
          retrieved: []
        }
      })
    })
    const { result } = renderHook(() => useChatSession(createProps()))

    act(() => result.current.startClarificationFreeform("8/1から育休を取る場合、いつまでに申請する必要がある?", ""))
    act(() => result.current.setQuestion("育児休業の申請期限は？"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.startChatRun).toHaveBeenCalledWith(expect.objectContaining({
      question: "育児休業の申請期限は？",
      clarificationContext: {
        originalQuestion: "8/1から育休を取る場合、いつまでに申請する必要がある?",
        selectedValue: "育児休業の申請期限は？"
      }
    }))
  })

  it("自由入力開始後でも無関係な新規質問では clarificationContext を送らない", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "別質問への回答です。",
          isAnswerable: true,
          citations: [],
          retrieved: []
        }
      })
    })
    const { result } = renderHook(() => useChatSession(createProps()))

    act(() => result.current.startClarificationFreeform("8/1から育休を取る場合、いつまでに申請する必要がある?", ""))
    act(() => result.current.setQuestion("全く別の質問"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.startChatRun).toHaveBeenCalledWith(expect.objectContaining({
      question: "全く別の質問",
      clarificationContext: undefined
    }))
  })

  it("自由入力開始後でも generic term だけを共有する新規質問では clarificationContext を送らない", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "経費精算の回答です。",
          isAnswerable: true,
          citations: [],
          retrieved: []
        }
      })
    })
    const { result } = renderHook(() => useChatSession(createProps()))

    act(() => result.current.startClarificationFreeform("8/1から育休を取る場合、いつまでに申請する必要がある?", ""))
    act(() => result.current.setQuestion("経費精算の申請期限は？"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.startChatRun).toHaveBeenCalledWith(expect.objectContaining({
      question: "経費精算の申請期限は？",
      clarificationContext: undefined
    }))
  })

  it("自由入力の seed example をそのまま送った場合は clarificationContext を送らない", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "経費精算の回答です。",
          isAnswerable: true,
          citations: [],
          retrieved: []
        }
      })
    })
    const { result } = renderHook(() => useChatSession(createProps()))

    act(() => result.current.startClarificationFreeform("8/1から育休を取る場合、いつまでに申請する必要がある?", "例: 経費精算の申請期限は？"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.startChatRun).toHaveBeenCalledWith(expect.objectContaining({
      question: "例: 経費精算の申請期限は？",
      clarificationContext: undefined
    }))
  })

  it("自由入力の seed example を編集して別質問にした場合は clarificationContext を送らない", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "経費精算の回答です。",
          isAnswerable: true,
          citations: [],
          retrieved: []
        }
      })
    })
    const { result } = renderHook(() => useChatSession(createProps()))

    act(() => result.current.startClarificationFreeform("8/1から育休を取る場合、いつまでに申請する必要がある?", "例: 経費精算の申請期限は？"))
    act(() => result.current.setQuestion("経費精算の申請期限は？"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(chatApiMock.startChatRun).toHaveBeenCalledWith(expect.objectContaining({
      question: "経費精算の申請期限は？",
      clarificationContext: undefined
    }))
  })

  it("debug trace 取得に失敗しても final answer を表示する", async () => {
    chatApiMock.startChatRun.mockResolvedValue({ runId: "chat-run-1", status: "queued", eventsPath: "/chat-runs/chat-run-1/events" })
    debugApiMock.getDebugRun.mockRejectedValue(new Error("debug trace unavailable"))
    chatApiMock.streamChatRunEvents.mockImplementationOnce(async (_runId, onEvent) => {
      onEvent({
        id: 1,
        type: "final",
        data: {
          answer: "回答は表示します。",
          isAnswerable: true,
          citations: [],
          retrieved: [],
          debugRunId: "debug-run-1"
        }
      })
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const setDebugRuns = vi.fn()
    const setSelectedRunId = vi.fn()
    const { result } = renderHook(() => useChatSession(createProps({ debugMode: true, setDebugRuns, setSelectedRunId })))

    act(() => result.current.setQuestion("debug 取得失敗時の回答表示を確認して"))
    await act(async () => {
      await result.current.onAsk({ preventDefault: vi.fn() } as any)
    })

    expect(debugApiMock.getDebugRun).toHaveBeenCalledWith("debug-run-1")
    expect(result.current.messages.at(-1)).toMatchObject({
      role: "assistant",
      text: "回答は表示します。"
    })
    expect(result.current.messages.at(-1)?.result?.debug).toBeUndefined()
    expect(setSelectedRunId).not.toHaveBeenCalledWith("debug-run-1")
    expect(setDebugRuns).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith("Failed to load debug trace", expect.any(Error))
    warn.mockRestore()
  })
})
