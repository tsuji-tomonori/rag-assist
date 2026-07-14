import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { BenchmarkRun, BenchmarkSuite } from "../types.js"
import { BenchmarkWorkspace } from "./BenchmarkWorkspace.js"
import { createContentResourceState } from "../../../shared/ui/resourceStateModel.js"
import { appUiStateTargets } from "../../../app/uiStateTargets.js"
import { confirmedOperation, failedOperation } from "../../../shared/ui/operationOutcome.js"

const suite: BenchmarkSuite = {
  suiteId: "standard-agent-v1",
  label: "Agent standard",
  mode: "agent",
  datasetS3Key: "datasets/standard.jsonl",
  preset: "standard",
  defaultConcurrency: 2
}

const run: BenchmarkRun = {
  runId: "run-1",
  status: "queued",
  mode: "agent",
  runner: "codebuild",
  suiteId: "standard-agent-v1",
  datasetS3Key: "datasets/standard.jsonl",
  createdBy: "user-1",
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z"
}

function renderBenchmarkWorkspace(overrides: Partial<Parameters<typeof BenchmarkWorkspace>[0]> = {}) {
  const props: Parameters<typeof BenchmarkWorkspace>[0] = {
    dataState: createContentResourceState(appUiStateTargets.benchmark, "2026-05-10T00:00:00.000Z"),
    runs: [run],
    suites: [suite],
    suiteId: suite.suiteId,
    modelId: "amazon.nova-lite-v1:0",
    concurrency: 2,
    loading: false,
    canRun: true,
    canCancel: true,
    canDownload: true,
    onSuiteChange: vi.fn(),
    onModelChange: vi.fn(),
    onConcurrencyChange: vi.fn(),
    onStart: vi.fn().mockResolvedValue(confirmedOperation(run)),
    onRefresh: vi.fn(),
    onCancel: vi.fn().mockResolvedValue(confirmedOperation({ ...run, status: "cancelled" })),
    onBack: vi.fn(),
    ...overrides
  }
  render(<BenchmarkWorkspace {...props} />)
  return props
}

describe("BenchmarkWorkspace", () => {
  it("does not display fixed benchmark suite or dataset fallbacks when suites are unavailable", () => {
    renderBenchmarkWorkspace({
      runs: [],
      suites: [],
      suiteId: "",
      concurrency: 1
    })

    expect(screen.getByLabelText("テスト種別")).toBeDisabled()
    expect(screen.getByLabelText("データセット")).toHaveValue("テスト設定を選択してください")
    expect(screen.getByRole("button", { name: "性能テストを実行" })).toBeDisabled()
    expect(screen.queryByText("standard-agent-v1")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("datasets/agent/standard-v1.jsonl")).not.toBeInTheDocument()
  })

  it("性能テスト起動は確認ダイアログで設定を確認してから実行する", async () => {
    const onStart = vi.fn().mockResolvedValue(confirmedOperation(run))
    renderBenchmarkWorkspace({ onStart })

    await userEvent.click(screen.getByRole("button", { name: "性能テストを実行" }))

    const dialog = screen.getByRole("dialog", { name: "性能テストを実行しますか？" })
    expect(dialog).toHaveTextContent("Agent standard")
    expect(dialog).toHaveTextContent("amazon.nova-lite-v1:0")
    expect(onStart).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole("button", { name: "実行" }))

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("status", { name: "性能テスト起動: Agent standard" })).toHaveTextContent("完了")
  })

  it("取消は対象・影響・回復条件を確認し、run 行へ結果を関連付ける", async () => {
    const onCancel = vi.fn().mockResolvedValue(confirmedOperation({ ...run, status: "cancelled" }))
    renderBenchmarkWorkspace({ onCancel })

    await userEvent.click(screen.getByRole("button", { name: "run-1のジョブをキャンセル" }))
    const dialog = screen.getByRole("dialog", { name: "この性能テストを取り消しますか？" })
    expect(dialog).toHaveTextContent("run-1")
    expect(dialog).toHaveTextContent("取消後は再開できず、新しい実行が必要です")
    expect(onCancel).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole("button", { name: "取り消す" }))

    expect(onCancel).toHaveBeenCalledWith("run-1")
    expect(screen.getByRole("status", { name: "性能テスト取消: Agent standard" })).toHaveTextContent("完了")
  })

  it("取消 timeout は結果未確認として dialog と対象 run を維持する", async () => {
    const onCancel = vi.fn().mockResolvedValue(failedOperation(new Error("request timed out")))
    renderBenchmarkWorkspace({ onCancel })

    await userEvent.click(screen.getByRole("button", { name: "run-1のジョブをキャンセル" }))
    const dialog = screen.getByRole("dialog", { name: "この性能テストを取り消しますか？" })
    await userEvent.click(within(dialog).getByRole("button", { name: "取り消す" }))

    expect(dialog).toBeVisible()
    expect(screen.getByRole("alert", { name: "性能テスト取消: Agent standard" })).toHaveTextContent("結果未確認")
  })
})
