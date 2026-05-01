import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import LoginPage from "./LoginPage.js"

describe("LoginPage", () => {
  it("keeps the user on the login form when authentication rejects the password", async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error("メールアドレスまたはパスワードが正しくありません。"))
    const onCompleteNewPassword = vi.fn()
    render(<LoginPage onLogin={onLogin} onCompleteNewPassword={onCompleteNewPassword} />)

    await userEvent.type(screen.getByPlaceholderText("メールアドレスを入力"), "tester@example.com")
    await userEvent.type(screen.getByPlaceholderText("パスワードを入力"), "wrong-password")
    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))

    expect(onLogin).toHaveBeenCalledWith({ email: "tester@example.com", password: "wrong-password", remember: false })
    expect(await screen.findByRole("alert")).toHaveTextContent("メールアドレスまたはパスワードが正しくありません。")
    expect(screen.getByRole("button", { name: "サインイン" })).toBeInTheDocument()
  })

  it("passes remember=true and ignores empty submissions", async () => {
    const onLogin = vi.fn().mockResolvedValue({ email: "tester@example.com", idToken: "id-token", expiresAt: Date.now() + 3600_000 })
    const onCompleteNewPassword = vi.fn()
    render(<LoginPage onLogin={onLogin} onCompleteNewPassword={onCompleteNewPassword} />)

    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))
    expect(onLogin).not.toHaveBeenCalled()

    await userEvent.type(screen.getByPlaceholderText("メールアドレスを入力"), "tester@example.com")
    await userEvent.type(screen.getByPlaceholderText("パスワードを入力"), "Password123!")
    await userEvent.click(screen.getByLabelText("ログイン状態を保持"))
    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))

    expect(onLogin).toHaveBeenCalledWith({ email: "tester@example.com", password: "Password123!", remember: true })
  })

  it("shows the password change form and completes NEW_PASSWORD_REQUIRED", async () => {
    const onLogin = vi.fn().mockResolvedValue({
      type: "NEW_PASSWORD_REQUIRED",
      email: "tester@example.com",
      session: "challenge-session",
      requiredAttributes: []
    })
    const onCompleteNewPassword = vi.fn().mockResolvedValue({
      email: "tester@example.com",
      idToken: "new-id-token",
      expiresAt: Date.now() + 3600_000
    })
    render(<LoginPage onLogin={onLogin} onCompleteNewPassword={onCompleteNewPassword} />)

    await userEvent.type(screen.getByPlaceholderText("メールアドレスを入力"), "tester@example.com")
    await userEvent.type(screen.getByPlaceholderText("パスワードを入力"), "Temporary123!")
    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))

    expect(await screen.findByText("ログインユーザー")).toBeInTheDocument()
    expect(screen.getByText("tester@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "パスワードを設定" })).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText("新しいパスワードを入力"), "NewPassword123!")
    await userEvent.type(screen.getByPlaceholderText("新しいパスワードを再入力"), "Mismatch123!")
    await userEvent.click(screen.getByRole("button", { name: "パスワードを設定" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("新しいパスワードが一致しません。")
    expect(onCompleteNewPassword).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByPlaceholderText("新しいパスワードを再入力"))
    await userEvent.type(screen.getByPlaceholderText("新しいパスワードを再入力"), "NewPassword123!")
    await userEvent.click(screen.getByRole("button", { name: "パスワードを設定" }))

    expect(onCompleteNewPassword).toHaveBeenCalledWith({
      challenge: {
        type: "NEW_PASSWORD_REQUIRED",
        email: "tester@example.com",
        session: "challenge-session",
        requiredAttributes: []
      },
      newPassword: "NewPassword123!",
      remember: false
    })
  })
})
