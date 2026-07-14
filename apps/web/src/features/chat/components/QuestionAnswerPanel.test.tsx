import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { failedOperation } from "../../../shared/ui/operationOutcome.js"
import type { HumanQuestion } from "../../questions/types.js"
import { QuestionAnswerPanel } from "./QuestionAnswerPanel.js"

const question: HumanQuestion = {
  questionId: "q-1",
  title: "申請期限",
  question: "期限は？",
  requesterName: "依頼者",
  requesterDepartment: "人事",
  assigneeDepartment: "総務",
  category: "policy",
  priority: "normal",
  status: "answered",
  answerBody: "期限は7月31日です。",
  responderName: "担当者",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T01:00:00.000Z"
}

describe("QuestionAnswerPanel", () => {
  it("keeps an unknown resolve result attached to the ticket", async () => {
    const onResolveQuestion = vi.fn().mockResolvedValue(failedOperation(new TypeError("Failed to fetch")))
    render(
      <QuestionAnswerPanel
        question={question}
        loading={false}
        onResolveQuestion={onResolveQuestion}
        onAdditionalQuestion={vi.fn()}
      />
    )

    expect(screen.getByLabelText("担当者からの回答")).toHaveTextContent("担当者回答あり")
    expect(screen.getByLabelText("担当者からの回答")).toHaveTextContent("次の操作")
    await userEvent.click(screen.getByRole("button", { name: "解決した" }))

    expect(onResolveQuestion).toHaveBeenCalledWith("q-1")
    expect(screen.getByRole("alert", { name: "問い合わせの解決: 申請期限" })).toHaveTextContent("結果未確認")
    expect(screen.getByRole("button", { name: "解決した" })).toBeEnabled()
  })
})
