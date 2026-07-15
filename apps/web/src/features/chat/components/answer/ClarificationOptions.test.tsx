import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ClarificationOptions } from "./ClarificationOptions.js"

describe("ClarificationOptions", () => {
  it("submits a selected option and starts an honest free-form question", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onFreeform = vi.fn()
    const options = [
      { id: "policy", label: "申請期限", resolvedQuery: "申請期限は？", source: "evidence" as const, grounding: [], reason: "期限を確認" },
      { id: "owner", label: "担当者", resolvedQuery: "担当者は？", source: "memory" as const, grounding: [] }
    ]
    render(<ClarificationOptions options={options} originalQuestion="経費精算について" disabled={false} onSubmitClarificationOption={onSubmit} onStartClarificationFreeform={onFreeform} />)
    expect(screen.getByRole("button", { name: "申請期限" })).toHaveAttribute("title", "期限を確認")
    expect(screen.getByRole("button", { name: "担当者" })).toHaveAttribute("title", "この候補で質問する")
    await user.click(screen.getByRole("button", { name: "申請期限" }))
    expect(onSubmit).toHaveBeenCalledWith(options[0], "経費精算について")
    await user.click(screen.getByRole("button", { name: "自分で入力" }))
    expect(onFreeform).toHaveBeenCalledWith("経費精算について", "例: 経費精算の申請期限は？")
  })

  it("disables every choice while a clarification is pending", () => {
    render(<ClarificationOptions options={[{ id: "one", label: "候補", resolvedQuery: "候補", source: "aspect", grounding: [] }]} originalQuestion="質問" disabled onSubmitClarificationOption={vi.fn()} onStartClarificationFreeform={vi.fn()} />)
    expect(screen.getByRole("button", { name: "候補" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "自分で入力" })).toBeDisabled()
  })
})
