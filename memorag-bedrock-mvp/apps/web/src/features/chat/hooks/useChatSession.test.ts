import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const chatApiMock = vi.hoisted(() => ({
  startChatRun: vi.fn(),
  streamChatRunEvents: vi.fn()
}))

vi.mock("../api/chatApi.js", () => chatApiMock)

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
})
