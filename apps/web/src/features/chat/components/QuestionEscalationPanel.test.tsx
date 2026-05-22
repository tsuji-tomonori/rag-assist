import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { Message } from "../types.js"
import { QuestionEscalationPanel } from "./QuestionEscalationPanel.js"

const chatCss = readFileSync(resolve(process.cwd(), "src/styles/features/chat.css"), "utf8")

const currentUser: CurrentUser = {
  userId: "user-1",
  email: "tester@example.com",
  groups: ["CHAT_USER"],
  permissions: ["chat:create"]
}

const unansweredMessage: Message = {
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
        onCreateQuestion={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "担当者へ送信" })).toBeEnabled()
  })
})
