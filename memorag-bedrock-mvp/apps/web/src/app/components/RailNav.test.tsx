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
        canManageDocuments={true}
        canSeeAdminSettings={true}
        onChangeView={onChangeView}
        onSignOut={vi.fn()}
      />
    )

    expect(screen.getByTitle("担当者対応")).toBeInTheDocument()
    expect(screen.getByTitle("性能テスト")).toBeInTheDocument()
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
        canManageDocuments={false}
        canSeeAdminSettings={false}
        onChangeView={vi.fn()}
        onSignOut={vi.fn()}
      />
    )

    expect(screen.queryByTitle("担当者対応")).not.toBeInTheDocument()
    expect(screen.queryByTitle("性能テスト")).not.toBeInTheDocument()
    expect(screen.queryByTitle("ドキュメント")).not.toBeInTheDocument()
    expect(screen.queryByTitle("管理者設定")).not.toBeInTheDocument()
  })
})
