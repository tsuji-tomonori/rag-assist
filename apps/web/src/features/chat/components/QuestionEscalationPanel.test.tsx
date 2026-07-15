import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { Message } from "../types.js"
import { QuestionEscalationPanel } from "./QuestionEscalationPanel.js"
import { confirmedOperation, failedOperation } from "../../../shared/ui/operationOutcome.js"
import type { HumanQuestion } from "../../questions/types.js"

const chatCss = readFileSync(resolve(process.cwd(), "src/styles/features/chat.css"), "utf8")

const currentUser: CurrentUser = {
  userId: "user-1",
  email: "tester@example.com",
  groups: ["CHAT_USER"],
  permissions: ["chat:create"]
}

const unansweredMessage: Message = {
  messageId: "message-1",
  role: "assistant",
  text: "資料からは回答できません。",
  sourceQuestion: "今日山田さんは何を食べた?",
  createdAt: "2026-04-30T00:00:00.000Z"
}

describe("QuestionEscalationPanel styles", () => {
  it("担当者へ送信ボタンのラベルは補助テキスト用スタイルの対象外である", () => {
    expect(chatCss).not.toMatch(/\.question-form-actions\s+span\s*\{/)
    expect(chatCss).toMatch(/\.question-form-actions\s*>\s*span\s*\{/)
  })

  it("担当者へ送信ボタン内の span は button の文字色を継承する", () => {
    expect(chatCss).toMatch(/\.question-form-actions\s+button\s+span\s*\{[^}]*color:\s*inherit;/s)
  })
})

describe("QuestionEscalationPanel", () => {
  it("QuestionEscalationPanel の送信ボタンは入力済みなら disabled ではない", () => {
    render(
      <QuestionEscalationPanel
        message={unansweredMessage}
        currentUser={currentUser}
        loading={false}
        onCreateQuestion={vi.fn().mockResolvedValue(confirmedOperation<never>())}
      />
    )

    expect(screen.getByRole("button", { name: "担当者へ送信" })).toBeEnabled()
  })

  it("sends the stable message target and keeps unknown results distinct from success", async () => {
    const onCreateQuestion = vi.fn().mockResolvedValue(failedOperation(new TypeError("Failed to fetch")))
    render(
      <QuestionEscalationPanel
        message={unansweredMessage}
        currentUser={currentUser}
        loading={false}
        onCreateQuestion={onCreateQuestion}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "担当者へ送信" }))

    expect(onCreateQuestion).toHaveBeenCalledWith(expect.objectContaining({ messageId: "message-1" }))
    expect(screen.getByRole("alert", { name: /担当者への問い合わせ送信/ })).toHaveTextContent("結果未確認")
    expect(screen.queryByText("完了")).not.toBeInTheDocument()
  })

  it("shows assigned and next-action context for the linked ticket", () => {
    const ticket: HumanQuestion = {
      questionId: "q-1",
      title: "山田さんの昼食について確認",
      question: "確認してください",
      requesterName: "利用者",
      requesterDepartment: "人事",
      assigneeDepartment: "総務",
      assigneeGroupId: "support",
      category: "general",
      priority: "normal",
      status: "open",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z"
    }
    render(
      <QuestionEscalationPanel
        message={unansweredMessage}
        questionTicket={ticket}
        currentUser={currentUser}
        loading={false}
        onCreateQuestion={vi.fn().mockResolvedValue(confirmedOperation(ticket))}
      />
    )

    const region = screen.getByRole("region", { name: "問い合わせ状態: 山田さんの昼食について確認" })
    expect(region).toHaveTextContent("担当割当済み")
    expect(region).toHaveTextContent("担当グループに割当済み")
    expect(region).toHaveTextContent("次の操作")
    expect(region).toHaveTextContent("q-1")
  })
})
