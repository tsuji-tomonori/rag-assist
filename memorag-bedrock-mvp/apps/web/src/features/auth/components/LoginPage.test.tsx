import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import LoginPage from "./LoginPage.js"

function renderLoginPage(overrides: Partial<Parameters<typeof LoginPage>[0]> = {}) {
  return render(
    <LoginPage
      onLogin={vi.fn().mockResolvedValue({ email: "tester@example.com", idToken: "token", expiresAt: Date.now() + 60_000 })}
      onSignUp={vi.fn().mockResolvedValue({ email: "tester@example.com" })}
      onConfirmSignUp={vi.fn().mockResolvedValue(undefined)}
      onCompleteNewPassword={vi.fn()}
      {...overrides}
    />
  )
}

describe("LoginPage", () => {
  it("サインイン入力を onLogin に渡す", async () => {
    const onLogin = vi.fn().mockResolvedValue({ email: "tester@example.com", idToken: "token", expiresAt: Date.now() + 60_000 })
    renderLoginPage({ onLogin })

    await userEvent.type(screen.getByPlaceholderText("メールアドレスを入力"), "tester@example.com")
    await userEvent.type(screen.getByPlaceholderText("パスワードを入力"), "password123")
    await userEvent.click(screen.getByLabelText("ログイン状態を保持"))
    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))

    expect(onLogin).toHaveBeenCalledWith({ email: "tester@example.com", password: "password123", remember: true })
  })

  it("アカウント作成モードへ切り替える", async () => {
    renderLoginPage()

    await userEvent.click(screen.getByRole("button", { name: "アカウント作成" }))

    expect(screen.getByRole("button", { name: "サインインへ戻る" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("パスワードを再入力")).toBeInTheDocument()
  })
})
