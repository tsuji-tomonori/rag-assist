import { describe, expect, it } from "vitest"
import type { HumanQuestion } from "../types.js"
import { questionJourneyPresentation, summarizeQuestionJourney } from "./questionJourney.js"

const question = (overrides: Partial<HumanQuestion> = {}): HumanQuestion => ({
  questionId: "q-1",
  title: "申請期限",
  question: "期限は？",
  requesterName: "利用者",
  requesterDepartment: "人事",
  assigneeDepartment: "総務",
  category: "policy",
  priority: "normal",
  status: "open",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  ...overrides
})

describe("questionJourneyPresentation", () => {
  it.each([
    ["open", "未対応", "担当割当済み"],
    ["in_progress", "回答作成中", "担当者対応中"],
    ["waiting_requester", "依頼者回答待ち", "追加確認待ち"],
    ["answered", "依頼者確認待ち", "担当者回答あり"],
    ["resolved", "解決済み", "解決済み"]
  ] as const)("maps %s for assignee and requester", (status, assigneeLabel, requesterLabel) => {
    const value = question({ status, assigneeGroupId: "support" })

    expect(questionJourneyPresentation(value, "assignee").presentation.label).toBe(assigneeLabel)
    expect(questionJourneyPresentation(value, "requester").presentation.label).toBe(requesterLabel)
  })

  it("does not claim an assignment when no assignee source exists", () => {
    const journey = questionJourneyPresentation(question({ assigneeDepartment: "未設定" }), "requester")

    expect(journey.presentation.label).toBe("担当者確認待ち")
    expect(journey.assignmentLabel).toBe("担当先は未設定")
  })

  it("summarizes the most actionable ticket before resolved tickets", () => {
    const summary = summarizeQuestionJourney([
      question({ questionId: "resolved", status: "resolved", updatedAt: "2026-07-14T02:00:00.000Z" }),
      question({ questionId: "answered", status: "answered", updatedAt: "2026-07-14T01:00:00.000Z" })
    ], "requester")

    expect(summary?.question.questionId).toBe("answered")
    expect(summary?.ticketCount).toBe(2)
    expect(summary?.nextAction).toContain("解決した")
  })
})
