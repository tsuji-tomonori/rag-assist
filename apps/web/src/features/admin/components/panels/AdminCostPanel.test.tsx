import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CostAuditSummary } from "../../types.js"
import { AdminCostPanel } from "./AdminCostPanel.js"

const completeness = {
  eventCount: 2, actualQuantityCount: 1, estimatedQuantityCount: 1, missingQuantityCount: 1,
  unknownSubjectCount: 0, unknownRunCount: 0, unknownModelCount: 0, unknownFeatureCount: 0,
  unpricedQuantityCount: 1, state: "partial" as const
}
const activeAudit: CostAuditSummary = {
  query: { periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z" },
  currency: "USD", pricedCostUsd: 0.000001, nextCursor: "next", truncated: true,
  asOf: "2026-07-15T00:00:00.000Z", source: "usage_event_store+versioned_price_catalog", rolloutMode: "active",
  catalogVersions: ["bedrock-2026-07"], completeness,
  items: [
    { eventId: "event-1", subjectId: "user-1", runId: "run-1", feature: "chat", provider: "bedrock", region: "ap-northeast-1", modelId: "model-1", unit: "input_token", quantity: 1, measurementSource: "provider", pricingState: "actual", catalogVersion: "bedrock-2026-07", priceSource: "AWS price list", costUsd: 0.000001, occurredAt: "2026-07-15T00:00:00.000Z" },
    { eventId: "event-2", subjectId: "unknown", runId: "unknown", feature: "unknown", provider: "unknown", region: "unknown", modelId: "unknown", unit: "output_token", measurementSource: "missing", pricingState: "unpriced", occurredAt: "2026-07-15T00:00:01.000Z" }
  ]
}

function props(overrides: Partial<Parameters<typeof AdminCostPanel>[0]> = {}): Parameters<typeof AdminCostPanel>[0] {
  return {
    costAudit: activeAudit, loading: false, canExport: true,
    onApplyQuery: vi.fn().mockResolvedValue(undefined), onRefresh: vi.fn().mockResolvedValue(undefined),
    onLoadMore: vi.fn().mockResolvedValue(undefined),
    onCreateExport: vi.fn().mockResolvedValue({ url: "https://example.com/cost.json" }),
    ...overrides
  }
}

describe("AdminCostPanel", () => {
  it("shows priced and unpriced evidence, filters, paginates, and exports", async () => {
    const user = userEvent.setup()
    const values = props()
    render(<AdminCostPanel {...values} />)
    expect(screen.getAllByText("$1.0000e-6")).toHaveLength(3)
    expect(screen.getAllByText("unpriced").length).toBeGreaterThan(0)
    expect(screen.getByText(/catalog unavailable/)).toBeInTheDocument()

    await user.type(screen.getByLabelText("provider"), "bedrock")
    await user.click(screen.getByRole("button", { name: "条件を適用" }))
    expect(values.onApplyQuery).toHaveBeenCalledWith(expect.objectContaining({ provider: "bedrock" }))
    await user.click(screen.getByRole("button", { name: "次の cost item を読み込む" }))
    expect(values.onLoadMore).toHaveBeenCalled()
    await user.type(screen.getByLabelText("export 理由（必須）"), "請求照合")
    await user.click(screen.getByRole("button", { name: "同じ条件の全ページを export" }))
    await waitFor(() => expect(values.onCreateExport).toHaveBeenCalledWith("請求照合"))
    expect(values.onRefresh).toHaveBeenCalled()
    expect(screen.getByRole("link", { name: "有効期限内に取得" })).toHaveAttribute("href", "https://example.com/cost.json")
  })

  it("represents unavailable, failed, empty disabled, and loading states", () => {
    const { rerender } = render(<AdminCostPanel {...props({ costAudit: null, canExport: false })} />)
    expect(screen.getByText("コスト監査をまだ確認できません。")).toBeInTheDocument()
    rerender(<AdminCostPanel {...props({ costAudit: null, part: { id: "cost", label: "コスト", status: "permission" }, canExport: false })} />)
    expect(screen.getByText("コスト監査を取得できませんでした。")).toBeInTheDocument()
    rerender(<AdminCostPanel {...props({ costAudit: { ...activeAudit, items: [], nextCursor: undefined, rolloutMode: "disabled", catalogVersions: [] } })} />)
    expect(screen.getByText(/disabled mode/)).toBeInTheDocument()
    expect(screen.getByText("未設定")).toBeInTheDocument()
    expect(screen.getByText("条件に一致する cost item はありません。")).toBeInTheDocument()
    expect(screen.queryByLabelText("現在のコスト条件を export")).not.toBeInTheDocument()
    rerender(<AdminCostPanel {...props({ loading: true })} />)
    expect(screen.getByRole("button", { name: "条件を適用" })).toBeDisabled()
  })

  it.each([
    [new Error("cost failed"), "cost failed"],
    [42, "コスト export を作成できませんでした。"]
  ])("shows export errors honestly", async (failure, message) => {
    const user = userEvent.setup()
    render(<AdminCostPanel {...props({ onCreateExport: vi.fn().mockRejectedValue(failure) })} />)
    await user.type(screen.getByLabelText("export 理由（必須）"), "監査")
    await user.click(screen.getByRole("button", { name: "同じ条件の全ページを export" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(message)
  })
})
