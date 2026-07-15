import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ManagedUserAuditLogPage } from "../../types.js"
import { AdminAuditPanel } from "./AdminAuditPanel.js"

const page: ManagedUserAuditLogPage = {
  auditLog: [
    { auditId: "audit-1", action: "role:assign", result: "denied", reason: "scope mismatch", actorUserId: "actor-1", actorEmail: "actor@example.com", targetUserId: "target-1", targetEmail: "target@example.com", targetType: "managedUser", policyVersion: "policy-v2", source: "security_audit_outbox", beforeGroups: ["CHAT_USER"], afterGroups: ["CHAT_USER"], createdAt: "2026-07-15T00:00:00.000Z" },
    { auditId: "audit-2", action: "legacy-action", actorUserId: "actor-2", targetUserId: "target-2", beforeGroups: [], afterGroups: [], createdAt: "2026-07-15T00:01:00.000Z" }
  ],
  total: 4, nextCursor: "next", truncated: true, source: "audit-read-model", asOf: "2026-07-15T00:02:00.000Z"
}

function props(overrides: Partial<Parameters<typeof AdminAuditPanel>[0]> = {}): Parameters<typeof AdminAuditPanel>[0] {
  return {
    page, loading: false, urlState: { section: "audit" }, onUrlStateChange: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined), onLoadMore: vi.fn().mockResolvedValue(undefined), canExport: true,
    onCreateExport: vi.fn().mockResolvedValue({ url: "https://example.com/audit.json", redaction: { policyVersion: "redaction-v1" } }),
    ...overrides
  }
}

describe("AdminAuditPanel", () => {
  it("filters, clears, exposes failure evidence, paginates, and exports", async () => {
    const user = userEvent.setup()
    const values = props({ urlState: { section: "audit", query: "old", auditAction: "role:assign" } })
    render(<AdminAuditPanel {...values} />)
    expect(screen.getByText("target@example.com")).toBeInTheDocument()
    expect(screen.getByText(/legacy success/)).toBeInTheDocument()
    expect(screen.getByText(/legacy_admin_ledger/)).toBeInTheDocument()

    const search = screen.getByLabelText("対象・実行者を検索")
    await user.clear(search)
    await user.type(search, " target ")
    await user.click(screen.getByRole("button", { name: "検索" }))
    expect(values.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ query: "target", auditAction: "role:assign" }), "push")
    await user.selectOptions(screen.getByLabelText("操作"), "user:suspend")
    expect(values.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ auditAction: "user:suspend" }))
    await user.click(screen.getByRole("button", { name: "条件を解除" }))
    expect(values.onUrlStateChange).toHaveBeenCalledWith(expect.objectContaining({ query: undefined, auditAction: undefined }), "push")
    await user.click(screen.getByRole("button", { name: /次の履歴を読み込む/ }))
    expect(values.onLoadMore).toHaveBeenCalled()

    await user.type(screen.getByLabelText("export 理由（必須）"), "四半期監査")
    await user.click(screen.getByRole("button", { name: "現在の条件を export" }))
    await waitFor(() => expect(values.onCreateExport).toHaveBeenCalledWith("四半期監査"))
    expect(values.onRefresh).toHaveBeenCalled()
    expect(screen.getByText(/redaction-v1/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "有効期限内に取得" })).toHaveAttribute("href", "https://example.com/audit.json")
  })

  it("distinguishes not loaded, failed, permission, empty, invalid filters, and loading", () => {
    const { rerender } = render(<AdminAuditPanel {...props({ page: null, canExport: false })} />)
    expect(screen.getByText("管理操作履歴をまだ確認できません。")).toBeInTheDocument()
    rerender(<AdminAuditPanel {...props({ page: null, part: { id: "audit", label: "監査", status: "failed" }, canExport: false })} />)
    expect(screen.getByText("管理操作履歴を取得できませんでした。")).toBeInTheDocument()
    rerender(<AdminAuditPanel {...props({ page: null, part: { id: "audit", label: "監査", status: "permission" }, canExport: false })} />)
    expect(screen.getByText("管理操作履歴を取得できませんでした。")).toBeInTheDocument()
    rerender(<AdminAuditPanel {...props({ page: { ...page, auditLog: [], total: 0, nextCursor: undefined }, urlState: { section: "audit", query: "", auditAction: "publish" }, loading: true })} />)
    expect(screen.getByText("条件に一致する管理操作履歴はありません。")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "検索" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "条件を解除" })).not.toBeInTheDocument()
  })

  it.each([
    [new Error("audit failed"), "audit failed"],
    [{}, "監査 export を作成できませんでした。"]
  ])("shows export errors without claiming success", async (failure, message) => {
    const user = userEvent.setup()
    render(<AdminAuditPanel {...props({ onCreateExport: vi.fn().mockRejectedValue(failure) })} />)
    await user.type(screen.getByLabelText("export 理由（必須）"), "監査")
    await user.click(screen.getByRole("button", { name: "現在の条件を export" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(message)
    expect(screen.queryByRole("link", { name: "有効期限内に取得" })).not.toBeInTheDocument()
  })
})
