import { render, screen, within } from "@testing-library/react"
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
        canReadDocuments={true}
        canSeeAdminSettings={true}
        onChangeView={onChangeView}
      />
    )

    expect(screen.getByTitle("担当者対応")).toBeInTheDocument()
    expect(screen.getByTitle("性能テスト")).toBeInTheDocument()
    expect(screen.queryByTitle("非同期エージェント")).not.toBeInTheDocument()
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
        canReadDocuments={false}
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
        canReadDocuments={false}
        canSeeAdminSettings={false}
        onChangeView={onChangeView}
      />
    )

    expect(screen.queryByText("very-long-account-name-for-layout-check@example.internal")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "個人設定" }))

    expect(onChangeView).toHaveBeenCalledWith("profile")
  })

  it("mobile menu は expanded/current/name を公開し、Escape で trigger へ focus を戻す", async () => {
    const user = userEvent.setup()

    render(
      <RailNav
        activeView="chat"
        authSession={authSession}
        canAnswerQuestions={true}
        canReadBenchmarkRuns={true}
        canReadDocuments={true}
        canSeeAdminSettings={true}
        onChangeView={vi.fn()}
      />
    )

    const openButton = screen.getByRole("button", { name: "メニューを開く" })
    expect(openButton).toHaveAttribute("aria-expanded", "false")

    await user.click(openButton)

    const closeButton = screen.getByRole("button", { name: "メニューを閉じる" })
    expect(closeButton).toHaveAttribute("aria-expanded", "true")
    const mobileNavigation = screen.getByRole("navigation", { name: "モバイル画面" })
    const current = within(mobileNavigation).getByRole("button", { name: "チャット" })
    expect(current).toHaveAttribute("aria-current", "page")
    expect(current).toHaveFocus()
    expect(within(mobileNavigation).getByRole("button", { name: "管理者設定" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "個人設定" })).toHaveLength(2)

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("navigation", { name: "モバイル画面" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "メニューを開く" })).toHaveFocus()
  })

  it("mobile destination の選択で menu を閉じ、権限外 destination を追加しない", async () => {
    const user = userEvent.setup()
    const onChangeView = vi.fn()

    render(
      <RailNav
        activeView="history"
        authSession={authSession}
        canAnswerQuestions={false}
        canReadBenchmarkRuns={false}
        canReadDocuments={false}
        canSeeAdminSettings={false}
        onChangeView={onChangeView}
      />
    )

    await user.click(screen.getByRole("button", { name: "メニューを開く" }))
    const mobileNavigation = screen.getByRole("navigation", { name: "モバイル画面" })
    expect(within(mobileNavigation).queryByRole("button", { name: "担当者対応" })).not.toBeInTheDocument()
    expect(within(mobileNavigation).queryByRole("button", { name: "性能テスト" })).not.toBeInTheDocument()
    expect(within(mobileNavigation).queryByRole("button", { name: "ドキュメント" })).not.toBeInTheDocument()
    expect(within(mobileNavigation).queryByRole("button", { name: "管理者設定" })).not.toBeInTheDocument()

    await user.click(within(mobileNavigation).getByRole("button", { name: "お気に入り" }))

    expect(onChangeView).toHaveBeenCalledWith("favorites")
    expect(screen.queryByRole("navigation", { name: "モバイル画面" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "メニューを開く" })).toHaveFocus()
  })
})
