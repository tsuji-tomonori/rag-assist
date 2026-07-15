import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AdminRolePanel } from "./AdminRolePanel.js"

describe("AdminRolePanel", () => {
  it("separates unavailable, failed, permission, and empty states", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<AdminRolePanel accessRoleList={null} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText("ロール定義をまだ確認できません。")).toBeInTheDocument()
    rerender(<AdminRolePanel accessRoleList={null} part={{ id: "roles", label: "ロール", status: "failed" }} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText("ロール定義を取得できませんでした。")).toBeInTheDocument()
    rerender(<AdminRolePanel accessRoleList={null} part={{ id: "roles", label: "ロール", status: "permission" }} loading={true} onRefresh={onRefresh} />)
    expect(screen.getByText("ロール定義を取得できませんでした。")).toBeInTheDocument()
    rerender(<AdminRolePanel accessRoleList={{ roles: [], catalogVersion: "v1", source: "catalog", asOf: "2026-07-15T00:00:00.000Z" }} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText("ロール定義はありません。")).toBeInTheDocument()
  })

  it("shows canonical metadata, categories, raw permissions, and refreshes", async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(<AdminRolePanel accessRoleList={{
      catalogVersion: "catalog-v2", source: "canonical", asOf: "2026-07-15T00:00:00.000Z",
      roles: [{ role: "COST_AUDITOR", displayName: "コスト監査担当", description: "コストを監査", kind: "systemPreset", permissions: ["cost:read:all", "cost:export"] },
        { role: "EMPTY", displayName: "権限なし", description: "権限なし", kind: "systemPreset", permissions: [] }]
    }} loading={false} onRefresh={onRefresh} />)
    expect(screen.getByText((_, element) => element?.textContent === "権限カテゴリ: cost")).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === "権限カテゴリ: なし")).toBeInTheDocument()
    expect(screen.getByText("cost:read:all")).toBeInTheDocument()
    expect(screen.getByText("catalog-v2")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "ロール定義を更新" }))
    expect(onRefresh).toHaveBeenCalled()
  })
})
