import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ConversationHistoryItem } from "../types.js"
import { HistoryWorkspace } from "./HistoryWorkspace.js"
import { createContentResourceState } from "../../../shared/ui/resourceStateModel.js"
import { appUiStateTargets } from "../../../app/uiStateTargets.js"
import { confirmedOperation, failedOperation } from "../../../shared/ui/operationOutcome.js"
import type { HumanQuestion } from "../../questions/types.js"

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
    dataState: createContentResourceState(appUiStateTargets.history, "2026-05-10T00:00:00.000Z"),
    history: [historyItem],
    onSelect: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(confirmedOperation()),
    onToggleFavorite: vi.fn(),
    onRetry: vi.fn(),
    onBack: vi.fn(),
    ...overrides
  }
  render(<HistoryWorkspace {...props} />)
  return props
}

describe("HistoryWorkspace risky actions", () => {
  it("削除は確認ダイアログで対象を確認してから実行する", async () => {
    const onDelete = vi.fn().mockResolvedValue(confirmedOperation(undefined, { message: "削除を確定しました。" }))
    renderHistoryWorkspace({ onDelete })

    await userEvent.click(screen.getByRole("button", { name: "削除" }))

    const dialog = screen.getByRole("dialog", { name: "この会話履歴を削除しますか？" })
    expect(dialog).toHaveTextContent("申請期限の確認")
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole("button", { name: "削除" }))

    expect(onDelete).toHaveBeenCalledWith("conv-1")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("status", { name: "会話履歴削除: 申請期限の確認" })).toHaveTextContent("完了")
  })

  it("最後の履歴を削除して empty state へ遷移しても確定結果を保持する", async () => {
    const onDelete = vi.fn().mockResolvedValue(confirmedOperation(undefined, { message: "削除を確定しました。" }))
    const props: Parameters<typeof HistoryWorkspace>[0] = {
      dataState: createContentResourceState(appUiStateTargets.history, "2026-05-10T00:00:00.000Z"),
      history: [historyItem],
      onSelect: vi.fn(),
      onDelete,
      onToggleFavorite: vi.fn(),
      onRetry: vi.fn(),
      onBack: vi.fn()
    }
    const view = render(<HistoryWorkspace {...props} />)

    await userEvent.click(screen.getByRole("button", { name: "削除" }))
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "削除" }))
    view.rerender(<HistoryWorkspace {...props} history={[]} />)

    expect(screen.getByRole("status", { name: "会話履歴削除: 申請期限の確認" })).toHaveTextContent("完了")
    expect(screen.getByRole("status", { name: "保存済みの会話履歴はありません。" })).toBeInTheDocument()
  })

  it("通信断は結果不明として対象を残し、確認 dialog を閉じない", async () => {
    const onDelete = vi.fn().mockResolvedValue(failedOperation(new TypeError("Failed to fetch")))
    renderHistoryWorkspace({ onDelete })

    await userEvent.click(screen.getByRole("button", { name: "削除" }))
    const dialog = screen.getByRole("dialog", { name: "この会話履歴を削除しますか？" })
    await userEvent.click(within(dialog).getByRole("button", { name: "削除" }))

    expect(dialog).toBeVisible()
    expect(screen.getByRole("alert", { name: "会話履歴削除: 申請期限の確認" })).toHaveTextContent("結果未確認")
    expect(screen.getAllByText("申請期限の確認").length).toBeGreaterThan(0)
  })

  it("Escape で削除確認を閉じる", async () => {
    const onDelete = vi.fn().mockResolvedValue(confirmedOperation())
    renderHistoryWorkspace({ onDelete })

    await userEvent.click(screen.getByRole("button", { name: "削除" }))
    await userEvent.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe("HistoryWorkspace question journey", () => {
  it("shows an intermediate ticket state and next action on its conversation target", () => {
    const ticket: HumanQuestion = {
      questionId: "q-1",
      title: "追加確認",
      question: "確認してください",
      requesterName: "依頼者",
      requesterDepartment: "人事",
      assigneeDepartment: "総務",
      assigneeGroupId: "support",
      category: "general",
      priority: "normal",
      status: "waiting_requester",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T01:00:00.000Z"
    }
    renderHistoryWorkspace({
      history: [{
        ...historyItem,
        messages: [...historyItem.messages, { role: "assistant", text: "確認待ち", createdAt: ticket.updatedAt, questionTicket: ticket }]
      }]
    })

    const conversation = screen.getByText("追加確認待ち").closest("button")
    expect(conversation).not.toBeNull()
    expect(conversation).toHaveTextContent("追加確認待ち")
    expect(conversation).toHaveTextContent("次の操作")
    expect(conversation).toHaveTextContent("担当者からの確認内容")
  })
})
