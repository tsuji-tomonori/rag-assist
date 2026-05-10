import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BenchmarkWorkspace } from "./BenchmarkWorkspace.js"

const noopAsync = vi.fn().mockResolvedValue(undefined)

function renderWorkspace() {
  render(
    <BenchmarkWorkspace
      runs={[]}
      suites={[]}
      suiteId=""
      modelId="amazon.nova-lite-v1:0"
      concurrency={1}
      loading={false}
      canRun={true}
      canCancel={true}
      canDownload={true}
      onSuiteChange={vi.fn()}
      onModelChange={vi.fn()}
      onConcurrencyChange={vi.fn()}
      onStart={noopAsync}
      onRefresh={vi.fn()}
      onCancel={noopAsync}
      onBack={vi.fn()}
    />
  )
}

describe("BenchmarkWorkspace", () => {
  it("does not display fixed benchmark suite or dataset fallbacks when suites are unavailable", () => {
    renderWorkspace()

    expect(screen.getByLabelText("テスト種別")).toBeDisabled()
    expect(screen.getByLabelText("データセット")).toHaveValue("suite 未選択")
    expect(screen.getByRole("button", { name: "性能テストを実行" })).toBeDisabled()
    expect(screen.queryByText("standard-agent-v1")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("datasets/agent/standard-v1.jsonl")).not.toBeInTheDocument()
  })
})
