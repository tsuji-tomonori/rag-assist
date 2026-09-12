import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PersonalSettingsView } from "./PersonalSettingsView.js"

const authSession = {
  email: "tester@example.com",
  idToken: "token",
  expiresAt: Date.now() + 60_000
}

describe("PersonalSettingsView", () => {
  it("送信キーのsession scopeを説明し、変更結果をpolite statusで通知する", async () => {
    const user = userEvent.setup()
    const onSetSubmitShortcut = vi.fn()

    render(
      <PersonalSettingsView
        authSession={authSession}
        submitShortcut="enter"
        onSetSubmitShortcut={onSetSubmitShortcut}
        onSignOut={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const shortcut = screen.getByRole("combobox", { name: "送信キー" })
    const help = screen.getByText(/現在のサインイン中だけ有効です/)
    expect(shortcut).toHaveAccessibleDescription(help.textContent ?? "")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    await user.selectOptions(shortcut, "ctrlEnter")

    expect(onSetSubmitShortcut).toHaveBeenCalledWith("ctrlEnter")
    expect(screen.getByRole("status")).toHaveTextContent("送信キーを「Ctrl+Enterで送信」に変更しました")
    expect(screen.getByRole("status")).toHaveTextContent("現在のサインイン中だけ有効です")
  })
})
