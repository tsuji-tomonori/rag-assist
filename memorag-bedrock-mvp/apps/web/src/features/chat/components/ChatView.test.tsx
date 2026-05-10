import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChatView } from "./ChatView.js"

const defaultProps: Parameters<typeof ChatView>[0] = {
  messages: [],
  questions: [],
  documentsCount: 0,
  isProcessing: false,
  pendingActivity: null,
  latestMessageRef: { current: null },
  currentUser: { userId: "user-1", email: "tester@example.com", groups: ["CHAT_USER"], permissions: ["chat:create"] },
  loading: false,
  canAsk: true,
  canWriteDocuments: false,
  modelId: "amazon.nova-lite-v1:0",
  file: null,
  selectedGroupId: "all",
  documentGroups: [],
  conversationKey: 0,
  submitShortcut: "ctrlEnter",
  question: "",
  debugMode: true,
  canReadDebugRuns: true,
  selectedTrace: {
    schemaVersion: 1,
    runId: "debug-run-1",
    question: "質問",
    modelId: "model",
    embeddingModelId: "embedding",
    clueModelId: "clue",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-10T00:00:00.000Z",
    completedAt: "2026-05-10T00:00:01.000Z",
    totalLatencyMs: 1000,
    status: "success",
    answerPreview: "回答",
    isAnswerable: true,
    citations: [],
    retrieved: [],
    steps: []
  },
  selectedRunValue: "debug-run-1",
  pendingDebugQuestion: null,
  allExpanded: false,
  expandedStepId: null,
  onAsk: vi.fn(),
  onSubmitClarificationOption: vi.fn(),
  onStartClarificationFreeform: vi.fn(),
  onSetQuestion: vi.fn(),
  onModelChange: vi.fn(),
  onSetFile: vi.fn(),
  onCreateQuestion: vi.fn(),
  onResolveQuestion: vi.fn(),
  onToggleAllDebugSteps: vi.fn(),
  onToggleDebugStep: vi.fn()
}

function renderChatView(overrides: Partial<Parameters<typeof ChatView>[0]> = {}) {
  return render(<ChatView {...defaultProps} {...overrides} />)
}

describe("ChatView debug permission", () => {
  it("debug 権限がある場合だけ DebugPanel を表示する", () => {
    renderChatView()

    expect(screen.getByLabelText("デバッグパネル")).toBeInTheDocument()
    expect(screen.getByLabelText("チャット").parentElement).not.toHaveClass("debug-off")
  })

  it("debug mode が有効でも debug 権限がなければ DebugPanel を非表示にする", () => {
    renderChatView({ canReadDebugRuns: false })

    expect(screen.queryByLabelText("デバッグパネル")).not.toBeInTheDocument()
    expect(screen.getByLabelText("チャット").parentElement).toHaveClass("debug-off")
  })
})
