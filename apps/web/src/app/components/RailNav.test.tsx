import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RailNav } from "./RailNav.js"

const authSession = {
  email: "tester@example.com",
  idToken: "token",
  expiresAt: Date.now() + 60_000
}

describe("RailNav", () => {
  it("権限に応じたナビ項目を表示し、view change を通知する", async () => {
    const onChangeView = vi.fn()

    render(
      <RailNav
        activeView="chat"
        authSession={authSession}
        canAnswerQuestions={true}
        canReadBenchmarkRuns={true}
        canReadAgentRuns={true}
        canManageDocuments={true}
        canSeeAdminSettings={true}
        onChangeView={onChangeView}
      />
    )

    expect(screen.getByTitle("担当者対応")).toBeInTheDocument()
    expect(screen.getByTitle("性能テスト")).toBeInTheDocument()
    expect(screen.getByTitle("非同期エージェント")).toBeInTheDocument()
    expect(screen.getByTitle("ドキュメント")).toBeInTheDocument()
    expect(screen.getByTitle("管理者設定")).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("管理者設定"))

    expect(onChangeView).toHaveBeenCalledWith("admin")
  })

  it("権限のない管理系ナビを隠す", () => {
    render(
      <RailNav
        activeView="chat"
        authSession={authSession}
        canAnswerQuestions={false}
        canReadBenchmarkRuns={false}
        canReadAgentRuns={false}
        canManageDocuments={false}
        canSeeAdminSettings={false}
        onChangeView={vi.fn()}
      />
    )

    expect(screen.queryByTitle("担当者対応")).not.toBeInTheDocument()
    expect(screen.queryByTitle("性能テスト")).not.toBeInTheDocument()
    expect(screen.queryByTitle("非同期エージェント")).not.toBeInTheDocument()
    expect(screen.queryByTitle("ドキュメント")).not.toBeInTheDocument()
    expect(screen.queryByTitle("管理者設定")).not.toBeInTheDocument()
  })

  it("アカウントボタンにメールアドレスを出さず、個人設定を開く", async () => {
    const onChangeView = vi.fn()

    render(
      <RailNav
        activeView="chat"
        authSession={{ ...authSession, email: "very-long-account-name-for-layout-check@example.internal" }}
        canAnswerQuestions={false}
        canReadBenchmarkRuns={false}
        canReadAgentRuns={false}
        canManageDocuments={false}
        canSeeAdminSettings={false}
        onChangeView={onChangeView}
      />
    )

    expect(screen.queryByText("very-long-account-name-for-layout-check@example.internal")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "個人設定" }))

    expect(onChangeView).toHaveBeenCalledWith("profile")
  })
})
