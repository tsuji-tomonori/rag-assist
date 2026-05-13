import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ConversationHistoryItem } from "../types.js"
import { HistoryWorkspace } from "./HistoryWorkspace.js"

const historyItem: ConversationHistoryItem = {
  schemaVersion: 1,
  id: "conv-1",
  title: "申請期限の確認",
  updatedAt: "2026-05-10T00:00:00.000Z",
  messages: [
    { role: "user", text: "期限は？", createdAt: "2026-05-10T00:00:00.000Z" }
  ]
}

function renderHistoryWorkspace(overrides: Partial<Parameters<typeof HistoryWorkspace>[0]> = {}) {
  const props: Parameters<typeof HistoryWorkspace>[0] = {
    history: [historyItem],
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onToggleFavorite: vi.fn(),
    onBack: vi.fn(),
    ...overrides
  }
  render(<HistoryWorkspace {...props} />)
  return props
}

describe("HistoryWorkspace risky actions", () => {
  it("削除は確認ダイアログで対象を確認してから実行する", async () => {
    const onDelete = vi.fn()
    renderHistoryWorkspace({ onDelete })

    await userEvent.click(screen.getByRole("button", { name: "削除" }))

    const dialog = screen.getByRole("dialog", { name: "この会話履歴を削除しますか？" })
    expect(dialog).toHaveTextContent("申請期限の確認")
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole("button", { name: "削除" }))

    expect(onDelete).toHaveBeenCalledWith("conv-1")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("Escape で削除確認を閉じる", async () => {
    const onDelete = vi.fn()
    renderHistoryWorkspace({ onDelete })

    await userEvent.click(screen.getByRole("button", { name: "削除" }))
    await userEvent.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })
})
