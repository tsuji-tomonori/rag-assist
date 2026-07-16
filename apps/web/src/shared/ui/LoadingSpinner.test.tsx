import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LoadingSpinner, LoadingStatus } from "./LoadingSpinner.js"

describe("shared ui loading primitives", () => {
  it("label がない spinner は decorative、label がある spinner は named status になる", () => {
    const view = render(
      <div>
        <LoadingSpinner className="button-spinner" />
        <LoadingSpinner label="検索中" />
      </div>
    )

    const decorative = view.container.querySelector(".button-spinner")
    expect(decorative).toHaveClass("loading-spinner")
    expect(decorative).toHaveAttribute("aria-hidden", "true")
    expect(decorative).not.toHaveAttribute("role")

    const named = screen.getByRole("status", { name: "検索中" })
    expect(named).toHaveClass("loading-spinner")
    expect(named).not.toHaveAttribute("aria-hidden")
  })

  it("LoadingStatus は visible label と polite busy live region を提供する", () => {
    render(<LoadingStatus className="workspace-loading" label="ドキュメント一覧を更新中" />)

    const status = screen.getByRole("status")
    expect(status).toHaveClass("loading-status", "workspace-loading")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("aria-busy", "true")
    expect(status).toHaveTextContent("ドキュメント一覧を更新中")
    expect(within(status).getByText("ドキュメント一覧を更新中")).toBeVisible()
    expect(status.querySelector(".loading-spinner")).toHaveAttribute("aria-hidden", "true")
  })
})
