import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { appUiStateTargets } from "../../../app/uiStateTargets.js"
import { confirmedOperation, failedOperation } from "../../../shared/ui/operationOutcome.js"
import { createContentResourceState } from "../../../shared/ui/resourceStateModel.js"
import type { HumanQuestion } from "../types.js"
import { AssigneeWorkspace } from "./AssigneeWorkspace.js"

const question = (overrides: Partial<HumanQuestion> = {}): HumanQuestion => ({
  questionId: "q-open",
  title: "申請期限",
  question: "申請期限はいつですか？",
  requesterName: "依頼者",
  requesterDepartment: "人事",
  assigneeDepartment: "総務",
  assigneeGroupId: "support",
  category: "policy",
  priority: "normal",
  status: "open",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  ...overrides
})

function renderWorkspace(overrides: Partial<Parameters<typeof AssigneeWorkspace>[0]> = {}) {
  const props: Parameters<typeof AssigneeWorkspace>[0] = {
    dataState: createContentResourceState(appUiStateTargets.assignee, "2026-07-14T00:00:00.000Z"),
    questions: [question()],
    selectedQuestionId: "q-open",
    user: { userId: "answerer", email: "answerer@example.com", groups: ["ANSWER_EDITOR"], permissions: ["answer:edit"] },
    loading: false,
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onAnswer: vi.fn().mockResolvedValue(confirmedOperation(question({ status: "answered" }))),
    onBack: vi.fn(),
    ...overrides
  }
  render(<AssigneeWorkspace {...props} />)
  return props
}

describe("AssigneeWorkspace question journey", () => {
  it("maps all API states into the four lanes without dropping intermediate states", () => {
    renderWorkspace({
      questions: [
        question(),
        question({ questionId: "q-progress", title: "対応中", status: "in_progress" }),
        question({ questionId: "q-wait", title: "追加待ち", status: "waiting_requester" }),
        question({ questionId: "q-answered", title: "回答済み", status: "answered", answerBody: "回答" }),
        question({ questionId: "q-resolved", title: "解決済み", status: "resolved" })
      ]
    })

    expect(within(screen.getByRole("region", { name: "未対応" })).getByRole("button", { name: "申請期限を選択" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "対応中" })).getByRole("button", { name: "対応中を選択" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "確認待ち" })).getByRole("button", { name: "追加待ちを選択" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "確認待ち" })).getByRole("button", { name: "回答済みを選択" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "解決済み" })).getByRole("button", { name: "解決済みを選択" })).toBeInTheDocument()
  })

  it("keeps dirty input and shows target failure when answer submission fails", async () => {
    const onAnswer = vi.fn().mockResolvedValue(failedOperation(new Error("回答 API が拒否しました")))
    renderWorkspace({ onAnswer })

    const body = screen.getByRole("textbox", { name: "回答内容" })
    await userEvent.type(body, "確認結果です")
    await userEvent.click(screen.getByRole("button", { name: "回答を送信" }))

    expect(onAnswer).toHaveBeenCalled()
    expect(screen.getByRole("alert", { name: "担当者回答の送信: 申請期限" })).toHaveTextContent("失敗")
    expect(screen.getByText("未送信の変更があります")).toBeInTheDocument()
    expect(body).toHaveValue("確認結果です")
  })

  it("labels local-only draft state as temporary rather than persisted", async () => {
    renderWorkspace()

    await userEvent.type(screen.getByRole("textbox", { name: "回答内容" }), "一時入力")
    await userEvent.click(screen.getByRole("button", { name: "入力を一時保持" }))

    expect(screen.getByRole("status")).toHaveTextContent("この画面に入力を一時保持")
    expect(screen.queryByText(/下書きを保存済み/)).not.toBeInTheDocument()
  })

  it("does not expose an edit action for answered tickets", () => {
    renderWorkspace({ questions: [question({ status: "answered", answerBody: "確定回答" })] })

    expect(screen.getByRole("textbox", { name: "回答内容" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "回答を送信" })).toBeDisabled()
    expect(screen.getByText("回答送信後の内容です。変更する API は提供されていません。")).toBeInTheDocument()
  })
})
