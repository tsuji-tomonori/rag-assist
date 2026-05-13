import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { DebugTrace } from "../types.js"
import { DebugPanel } from "./DebugPanel.js"

const citation = {
  documentId: "doc-1",
  fileName: "requirements.md",
  chunkId: "chunk-1",
  score: 0.91,
  text: "製品要求とプロジェクト要求に分類します。"
}

const trace: DebugTrace = {
  schemaVersion: 1,
  runId: "run-1",
  question: "要求分類を教えて",
  modelId: "model",
  embeddingModelId: "embedding",
  clueModelId: "clue",
  pipelineVersions: { graph: "v2" },
  topK: 6,
  memoryTopK: 4,
  minScore: 0.2,
  startedAt: "2026-05-03T00:00:00.000Z",
  completedAt: "2026-05-03T00:00:01.250Z",
  totalLatencyMs: 1250,
  status: "success",
  answerPreview: "回答",
  isAnswerable: true,
  citations: [citation],
  retrieved: [
    citation,
    { ...citation, chunkId: "chunk-2", score: 0.32, text: "候補の根拠です。" }
  ],
  steps: [
    {
      id: 1,
      label: "plan_search",
      status: "success",
      latencyMs: 20,
      summary: "検索計画",
      output: {
        iteration: 1,
        searchPlan: {
          requiredFacts: [
            { id: "fact-supported", description: "分類体系" },
            { id: "fact-unknown", description: "不明な観点" }
          ]
        }
      },
      startedAt: "2026-05-03T00:00:00.010Z",
      completedAt: "2026-05-03T00:00:00.030Z"
    },
    {
      id: 2,
      label: "retrieval_evaluator",
      status: "warning",
      latencyMs: 30,
      summary: "一部不足",
      output: {
        retrievalEvaluation: {
          supportedFactIds: ["fact-supported"],
          missingFactIds: ["fact-missing"],
          conflictingFactIds: ["fact-conflicting"],
          nextAction: { type: "continue_search" },
          reason: "追加検索が必要"
        }
      },
      startedAt: "2026-05-03T00:00:00.030Z",
      completedAt: "2026-05-03T00:00:00.060Z"
    },
    {
      id: 3,
      label: "verify_answer_support",
      status: "success",
      latencyMs: 25,
      summary: "回答支持を確認",
      output: {
        answerSupport: { supported: true },
        contextAssembly: { selectedChunkIds: ["chunk-1"] }
      },
      startedAt: "2026-05-03T00:00:00.080Z",
      completedAt: "2026-05-03T00:00:00.105Z"
    }
  ]
}

function renderDebugPanel(props: Partial<Parameters<typeof DebugPanel>[0]> = {}) {
  return render(
    <DebugPanel
      trace={trace}
      allExpanded={false}
      expandedStepId={null}
      onToggleAll={vi.fn()}
      onToggleStep={vi.fn()}
      {...props}
    />
  )
}

describe("DebugPanel", () => {
  it("trace から replay graph と diagnostics を表示する", () => {
    renderDebugPanel()

    expect(screen.getByRole("region", { name: "実行サマリ" })).toHaveTextContent("run-1")
    expect(screen.getByRole("button", { name: /retrieval_evaluator/ })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("region", { name: "Fact coverage" })).toHaveTextContent("fact-missing")
    expect(screen.getByRole("region", { name: "Evidence viewer" })).toHaveTextContent("retrieved 2 / cited 1")
    expect(screen.getByRole("region", { name: "Answer support" })).toHaveTextContent('"supported": true')
    expect(screen.getByRole("region", { name: "Context assembly" })).toHaveTextContent("chunk-1")

    fireEvent.click(screen.getByRole("button", { name: /retrieval_evaluator/ }))

    expect(screen.getByRole("button", { name: /retrieval_evaluator/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "ノード詳細" })).toHaveTextContent("retrieval_evaluator")
  })

  it("拡大ボタンから debug panel dialog を開閉できる", () => {
    renderDebugPanel()

    fireEvent.click(screen.getByRole("button", { name: "デバッグパネルを拡大表示" }))

    const dialog = screen.getByRole("dialog", { name: "拡大デバッグパネル" })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent("run-1")
    expect(dialog).toHaveTextContent("Fact coverage")

    fireEvent.click(screen.getByRole("button", { name: "拡大デバッグパネルを閉じる" }))

    expect(screen.queryByRole("dialog", { name: "拡大デバッグパネル" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "デバッグパネルを拡大表示" }))
    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.queryByRole("dialog", { name: "拡大デバッグパネル" })).not.toBeInTheDocument()
  })

  it("pending 中は処理中 step と footer を優先する", () => {
    const onToggleStep = vi.fn()
    renderDebugPanel({ pending: true, pendingQuestion: "  社内規程  を   確認して  ", trace: undefined, onToggleStep })

    expect(screen.getByLabelText("デバッグパネル")).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("button", { name: /入力受付/ })).toHaveTextContent("社内規程 を 確認して")
    expect(screen.getByText("検索と回答生成を実行しています")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /入力受付/ }))

    expect(onToggleStep).toHaveBeenCalledWith(1)
  })

  it("アップロードした replay JSON のエラー表示と解除を扱う", async () => {
    const { container } = renderDebugPanel()
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInstanceOf(HTMLInputElement)

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File(["{}"], "debug.json", { type: "application/json" })]
      }
    })

    expect(await screen.findByText(/DebugTrace/)).toBeInTheDocument()

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File([JSON.stringify({ traceType: "memorag-debug-trace", schemaVersion: 2, rawTrace: trace })], "debug.json", { type: "application/json" })]
      }
    })

    await waitFor(() => expect(screen.getByText("ローカルJSON")).toBeInTheDocument())
    expect(screen.queryByText(/DebugTrace/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "解除" }))

    expect(screen.queryByText("ローカルJSON")).not.toBeInTheDocument()
  })
})
