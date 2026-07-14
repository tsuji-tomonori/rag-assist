import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "./ConfirmDialog.js"

describe("shared ConfirmDialog", () => {
  it("focus を dialog 内で循環させ、Escape 後の unmount で起点へ戻す", async () => {
    const onCancel = vi.fn()
    const opener = document.createElement("button")
    document.body.append(opener)
    opener.focus()

    const view = render(
      <ConfirmDialog
        title="公開しますか？"
        description="検索結果へ影響します。"
        confirmLabel="公開"
        tone="warning"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    )

    const dialog = screen.getByRole("dialog", { name: "公開しますか？" })
    const cancel = screen.getByRole("button", { name: "キャンセル" })
    const confirm = screen.getByRole("button", { name: "公開" })
    expect(cancel).toHaveFocus()
    expect(dialog).toHaveAttribute("aria-busy", "false")
    expect(confirm).toHaveClass("ui-button-warning")

    confirm.focus()
    fireEvent.keyDown(dialog, { key: "Tab" })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
    expect(confirm).toHaveFocus()

    await userEvent.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
