import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "./ConfirmDialog.js"

describe("shared ui ConfirmDialog", () => {
  it("cancel に initial focus を置き、children を含む focus trap と unmount 後の restore を行う", async () => {
    const user = userEvent.setup()
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
        details={[{
          label: "対象",
          value: (
            <>
              <strong>検索用語:公開版</strong>
              <a href="/alias-diff">差分を確認</a>
            </>
          )
        }]}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      >
        <label>
          <span>理由</span>
          <input />
        </label>
      </ConfirmDialog>
    )

    const dialog = screen.getByRole("dialog", { name: "公開しますか？" })
    const reason = screen.getByRole("textbox", { name: "理由" })
    const cancel = screen.getByRole("button", { name: "キャンセル" })
    const confirm = screen.getByRole("button", { name: "公開" })
    expect(cancel).toHaveFocus()
    expect(dialog).toHaveAttribute("aria-busy", "false")
    expect(confirm).toHaveClass("ui-button-warning")
    expect(screen.getByText("検索用語:公開版").tagName).toBe("STRONG")
    const detailLink = screen.getByRole("link", { name: "差分を確認" })
    expect(detailLink).toHaveAttribute("href", "/alias-diff")
    expect(reason).toBeVisible()

    confirm.focus()
    fireEvent.keyDown(dialog, { key: "Tab" })
    expect(detailLink).toHaveFocus()
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
    expect(confirm).toHaveFocus()

    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it("useId で複数 instance の accessible references を分離し、error を通知する", () => {
    const deleteCancel = vi.fn()
    const publishCancel = vi.fn()
    render(
      <>
        <ConfirmDialog
          title="削除しますか？"
          description="元に戻せません。"
          errorMessage="削除に失敗しました。"
          onCancel={deleteCancel}
          onConfirm={vi.fn()}
        />
        <ConfirmDialog
          title="公開しますか？"
          description="検索結果が変わります。"
          onCancel={publishCancel}
          onConfirm={vi.fn()}
        />
      </>
    )

    const deleteDialog = screen.getByRole("dialog", { name: "削除しますか？" })
    const publishDialog = screen.getByRole("dialog", { name: "公開しますか？" })
    const deleteTitleId = deleteDialog.getAttribute("aria-labelledby")
    const publishTitleId = publishDialog.getAttribute("aria-labelledby")
    const deleteDescriptionIds = deleteDialog.getAttribute("aria-describedby")?.split(" ") ?? []
    const publishDescriptionIds = publishDialog.getAttribute("aria-describedby")?.split(" ") ?? []

    expect(deleteTitleId).toBeTruthy()
    expect(publishTitleId).toBeTruthy()
    expect(deleteTitleId).not.toBe(publishTitleId)
    expect(deleteDescriptionIds).toHaveLength(2)
    expect(publishDescriptionIds).toHaveLength(1)
    expect(deleteDescriptionIds[0]).not.toBe(publishDescriptionIds[0])
    expect(within(deleteDialog).getByRole("alert")).toHaveTextContent("削除に失敗しました。")

    fireEvent.keyDown(window, { key: "Escape" })
    expect(deleteCancel).not.toHaveBeenCalled()
    expect(publishCancel).toHaveBeenCalledTimes(1)
  })

  it("loading 中は dialog 自体へ focus し、Escape と action による close を抑止する", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const view = render(
      <ConfirmDialog
        title="処理を続けますか？"
        description="処理中は閉じられません。"
        loading
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    const dialog = screen.getByRole("dialog", { name: "処理を続けますか？" })
    expect(dialog).toHaveFocus()
    expect(dialog).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "処理中" })).toBeDisabled()

    await user.keyboard("{Escape}")
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()

    view.rerender(
      <ConfirmDialog
        title="処理を続けますか？"
        description="処理中は閉じられません。"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )
    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("idle から loading へ遷移したとき disabled action から dialog へ focus を退避する", () => {
    const view = render(
      <ConfirmDialog
        title="処理を実行しますか？"
        description="開始後は完了まで閉じられません。"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    const dialog = screen.getByRole("dialog", { name: "処理を実行しますか？" })
    const cancel = screen.getByRole("button", { name: "キャンセル" })
    expect(cancel).toHaveFocus()

    view.rerender(
      <ConfirmDialog
        title="処理を実行しますか？"
        description="開始後は完了まで閉じられません。"
        loading
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(cancel).toBeDisabled()
    expect(dialog).toHaveFocus()
  })

  it("internal confirming 中の二重 confirm と Escape close を抑止する", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    let finishConfirm: (() => void) | undefined
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
      finishConfirm = resolve
    }))
    render(
      <ConfirmDialog
        title="変更しますか？"
        description="権限が変わります。"
        confirmLabel="変更"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByRole("button", { name: "変更" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const busyConfirm = screen.getByRole("button", { name: "処理中" })
    expect(busyConfirm).toBeDisabled()
    expect(screen.getByRole("dialog", { name: "変更しますか？" })).toHaveFocus()

    fireEvent.click(busyConfirm)
    await user.keyboard("{Escape}")
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()

    finishConfirm?.()
    expect(await screen.findByRole("button", { name: "変更" })).toBeEnabled()
  })
})
