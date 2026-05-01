import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import LoginPage from "./LoginPage.js"

describe("LoginPage", () => {
  it("keeps the user on the login form when authentication rejects the password", async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error("メールアドレスまたはパスワードが正しくありません。"))
    render(<LoginPage onLogin={onLogin} />)

    await userEvent.type(screen.getByPlaceholderText("メールアドレスを入力"), "tester@example.com")
    await userEvent.type(screen.getByPlaceholderText("パスワードを入力"), "wrong-password")
    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))

    expect(onLogin).toHaveBeenCalledWith({ email: "tester@example.com", password: "wrong-password", remember: false })
    expect(await screen.findByRole("alert")).toHaveTextContent("メールアドレスまたはパスワードが正しくありません。")
    expect(screen.getByRole("button", { name: "サインイン" })).toBeInTheDocument()
  })

  it("passes remember=true and ignores empty submissions", async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginPage onLogin={onLogin} />)

    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))
    expect(onLogin).not.toHaveBeenCalled()

    await userEvent.type(screen.getByPlaceholderText("メールアドレスを入力"), "tester@example.com")
    await userEvent.type(screen.getByPlaceholderText("パスワードを入力"), "Password123!")
    await userEvent.click(screen.getByLabelText("ログイン状態を保持"))
    await userEvent.click(screen.getByRole("button", { name: "サインイン" }))

    expect(onLogin).toHaveBeenCalledWith({ email: "tester@example.com", password: "Password123!", remember: true })
  })
})
