import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatusBadge } from "./StatusBadge.js"

describe("StatusBadge", () => {
  it("色だけに依存せず marker と可視 label で状態を示す", () => {
    const { container } = render(<StatusBadge presentation={{ label: "承認待ち", tone: "warning" }} />)

    expect(screen.getByText("承認待ち")).toBeVisible()
    expect(container.querySelector(".ui-badge-warning")).toBeInTheDocument()
    expect(container.querySelector(".ui-status-badge-marker")).toHaveAttribute("aria-hidden", "true")
  })
})
