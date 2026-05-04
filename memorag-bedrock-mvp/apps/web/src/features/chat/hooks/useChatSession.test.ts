import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
  it("loading 中は canAsk を false にする", () => {
    const { result, rerender } = renderHook((props: Parameters<typeof useChatSession>[0]) => useChatSession(props), {
      initialProps: createProps({ loading: true })
    })

    act(() => result.current.setQuestion("社内規程を確認して"))

    expect(result.current.canAsk).toBe(false)

    rerender(createProps({ loading: false }))

    expect(result.current.canAsk).toBe(true)
  })
})
