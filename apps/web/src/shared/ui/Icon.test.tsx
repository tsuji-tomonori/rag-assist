import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Icon } from "./Icon.js"

describe("shared ui Icon", () => {
  it("decorative SVG を accessibility tree から隠し、icon-only button の name を親へ委ねる", () => {
    const view = render(
      <button type="button" aria-label="メニューを開く">
        <Icon name="menu" />
      </button>
    )

    expect(screen.getByRole("button", { name: "メニューを開く" })).toBeVisible()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    const icon = view.container.querySelector("svg")
    expect(icon).toHaveClass("icon", "icon-menu")
    expect(icon).toHaveAttribute("aria-hidden", "true")
    expect(icon).toHaveAttribute("viewBox", "0 0 24 24")
    expect(icon?.querySelector("path")).toBeInTheDocument()
  })
})
