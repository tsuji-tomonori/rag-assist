import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { UsageSummaryPage } from "../../types.js"
import { AdminUsagePanel } from "./AdminUsagePanel.js"

const completeness = {
  eventCount: 1, actualQuantityCount: 1, estimatedQuantityCount: 1, missingQuantityCount: 1,
  unknownSubjectCount: 1, unknownRunCount: 1, unknownModelCount: 1, unknownFeatureCount: 1,
  unpricedQuantityCount: 0, state: "partial" as const
}

const activePage: UsageSummaryPage = {
  query: { periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z" },
  events: [{
    schemaVersion: 1, eventId: "event-1", tenantId: "tenant-1", quantities: [
      { unit: "input_token", value: 3, source: "provider" },
      { unit: "output_token", source: "missing" }
    ], status: "succeeded", idempotencyKey: "idem-1",
    occurredAt: "2026-07-15T00:00:00.000Z", recordedAt: "2026-07-15T00:00:01.000Z"
  }],
  nextCursor: "next", truncated: true, asOf: "2026-07-15T00:00:02.000Z", source: "usage_event_store",
  rolloutMode: "active", completeness,
  breakdowns: { bySubject: [], byFeature: [], byProvider: [], byModel: [] }
}

function props(overrides: Partial<Parameters<typeof AdminUsagePanel>[0]> = {}): Parameters<typeof AdminUsagePanel>[0] {
  return {
    usageSummary: activePage, loading: false, canExport: true,
    onApplyQuery: vi.fn().mockResolvedValue(undefined), onRefresh: vi.fn().mockResolvedValue(undefined),
    onLoadMore: vi.fn().mockResolvedValue(undefined),
    onCreateExport: vi.fn().mockResolvedValue({ url: "https://example.com/usage.json" }),
    ...overrides
  }
}

describe("AdminUsagePanel", () => {
  it("shows honest unknown and missing values, applies a cleaned query, loads more, and exports", async () => {
    const user = userEvent.setup()
    const values = props()
    render(<AdminUsagePanel {...values} />)

    expect(screen.getAllByText("unknown / unknown")).toHaveLength(2)
    expect(screen.getByText(/output_token: missing/)).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("期間開始（ISO 8601）"))
    await user.type(screen.getByLabelText("期間開始（ISO 8601）"), "2026-07-02T00:00:00.000Z")
    await user.type(screen.getByLabelText("subject"), "user-1")
    await user.click(screen.getByRole("button", { name: "条件を適用" }))
    expect(values.onApplyQuery).toHaveBeenCalledWith(expect.objectContaining({
      periodStart: "2026-07-02T00:00:00.000Z", subjectId: "user-1"
    }))

    await user.click(screen.getByRole("button", { name: "次の usage event を読み込む" }))
    expect(values.onLoadMore).toHaveBeenCalled()
    await user.type(screen.getByLabelText("export 理由（必須）"), "月次監査")
    await user.click(screen.getByRole("button", { name: "同じ条件の全ページを export" }))
    await waitFor(() => expect(values.onCreateExport).toHaveBeenCalledWith("月次監査"))
    expect(values.onRefresh).toHaveBeenCalled()
    expect(screen.getByRole("link", { name: "有効期限内に取得" })).toHaveAttribute("href", "https://example.com/usage.json")
  })

  it("represents unavailable, failed, empty shadow, permission, and loading states", () => {
    const { rerender } = render(<AdminUsagePanel {...props({ usageSummary: null, canExport: false })} />)
    expect(screen.getByText("利用状況をまだ確認できません。")).toBeInTheDocument()

    rerender(<AdminUsagePanel {...props({ usageSummary: null, part: { id: "usage", label: "利用状況", status: "failed" }, canExport: false })} />)
    expect(screen.getByText("利用状況を取得できませんでした。")).toBeInTheDocument()

    rerender(<AdminUsagePanel {...props({ usageSummary: { ...activePage, events: [], nextCursor: undefined, rolloutMode: "shadow" }, canExport: true })} />)
    expect(screen.getByText(/shadow mode/)).toBeInTheDocument()
    expect(screen.getByText("条件に一致する usage event はありません。")).toBeInTheDocument()
    expect(screen.queryByLabelText("現在の利用状況条件を export")).not.toBeInTheDocument()

    rerender(<AdminUsagePanel {...props({ usageSummary: null, part: { id: "usage", label: "利用状況", status: "permission" }, loading: true })} />)
    expect(screen.getByText("利用状況を取得できませんでした。")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "条件を適用" })).toBeDisabled()
  })

  it.each([
    [new Error("export failed"), "export failed"],
    ["unknown failure", "利用状況 export を作成できませんでした。"]
  ])("shows an export failure without a stale artifact", async (failure, message) => {
    const user = userEvent.setup()
    render(<AdminUsagePanel {...props({ onCreateExport: vi.fn().mockRejectedValue(failure) })} />)
    await user.type(screen.getByLabelText("export 理由（必須）"), "監査")
    await user.click(screen.getByRole("button", { name: "同じ条件の全ページを export" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(message)
    expect(screen.queryByRole("link", { name: "有効期限内に取得" })).not.toBeInTheDocument()
  })
})
