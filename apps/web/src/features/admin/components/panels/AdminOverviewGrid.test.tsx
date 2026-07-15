import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CostAuditSummary, UsageSummaryPage } from "../../types.js"
import { AdminOverviewGrid } from "./AdminOverviewGrid.js"

const callbacks = {
  onOpenDocuments: vi.fn(), onOpenAssignee: vi.fn(), onOpenDebug: vi.fn(), onOpenBenchmark: vi.fn(),
  onOpenUsers: vi.fn(), onOpenRoles: vi.fn(), onOpenUsageCost: vi.fn(), onOpenAliases: vi.fn()
}
const completeness = {
  eventCount: 2, actualQuantityCount: 1, estimatedQuantityCount: 0, missingQuantityCount: 0,
  unknownSubjectCount: 0, unknownRunCount: 0, unknownModelCount: 0, unknownFeatureCount: 0,
  unpricedQuantityCount: 0, state: "complete" as const
}
const usage = { completeness } as UsageSummaryPage
const cost = { pricedCostUsd: 0.000001, completeness } as CostAuditSummary

function props(overrides: Partial<Parameters<typeof AdminOverviewGrid>[0]> = {}): Parameters<typeof AdminOverviewGrid>[0] {
  return {
    documentsCount: null, openQuestionsCount: null, debugRunsCount: null, benchmarkRunsCount: null,
    managedUsers: null, accessRoles: null, usageSummaries: null, costAudit: null, aliases: null,
    canManageDocuments: false, canAnswerQuestions: false, canReadDebugRuns: false, canReadBenchmarkRuns: false,
    canOpenAdminSettings: false, canReadUsers: false, canReadUsage: false, canReadCosts: false, canManageAliases: false,
    ...callbacks, ...overrides
  }
}

describe("AdminOverviewGrid", () => {
  it("renders no invented summary when every capability is unavailable", () => {
    render(<AdminOverviewGrid {...props({ documentsCount: 4, openQuestionsCount: 3, debugRunsCount: 2, benchmarkRunsCount: 1 })} />)
    expect(screen.getByText("表示できる管理 summary はありません。")).toBeInTheDocument()
  })

  it("renders every authorized action and real KPI and invokes its destination", async () => {
    const user = userEvent.setup()
    render(<AdminOverviewGrid {...props({
      documentsCount: 4, openQuestionsCount: 3, debugRunsCount: 2, benchmarkRunsCount: 1,
      managedUsers: [{ userId: "u1" } as never], accessRoles: [{ role: "SYSTEM_ADMIN" } as never],
      usageSummaries: usage, costAudit: cost, aliases: [{ aliasId: "a1" } as never],
      canManageDocuments: true, canAnswerQuestions: true, canReadDebugRuns: true, canReadBenchmarkRuns: true,
      canOpenAdminSettings: true, canReadUsers: true, canReadUsage: true, canReadCosts: true, canManageAliases: true
    })} />)
    const destinations = [
      ["ドキュメント管理を開く", callbacks.onOpenDocuments], ["担当者対応を開く", callbacks.onOpenAssignee],
      ["デバッグ / 評価を開く", callbacks.onOpenDebug], ["性能テストを開く", callbacks.onOpenBenchmark],
      ["アクセス管理を開く", callbacks.onOpenRoles], ["ユーザー管理を開く", callbacks.onOpenUsers],
      ["利用状況を開く", callbacks.onOpenUsageCost], ["コスト監査を開く", callbacks.onOpenUsageCost],
      ["用語展開管理を開く", callbacks.onOpenAliases]
    ] as const
    for (const [name, callback] of destinations) {
      await user.click(screen.getByRole("button", { name }))
      expect(callback).toHaveBeenCalled()
    }
    expect(screen.getByText("4 件")).toBeInTheDocument()
    expect(screen.getByText("2 event")).toBeInTheDocument()
    expect(screen.getByText("$1.0000e-6")).toBeInTheDocument()
  })

  it("distinguishes failed resources from resources that were not provided", () => {
    const { rerender } = render(<AdminOverviewGrid {...props({
      canOpenAdminSettings: true, canReadUsers: true, canReadUsage: true, canReadCosts: true, canManageAliases: true,
      failedParts: new Set(["roles", "users", "usage", "cost", "aliases"])
    })} />)
    expect(screen.getAllByText("取得失敗")).toHaveLength(5)
    expect(screen.getAllByText("状態メッセージから再試行できます")).toHaveLength(5)

    rerender(<AdminOverviewGrid {...props({
      canOpenAdminSettings: true, canReadUsers: true, canReadUsage: true, canReadCosts: true, canManageAliases: true
    })} />)
    expect(screen.getAllByText("未提供")).toHaveLength(4)
    expect(screen.getByText("利用不可")).toBeInTheDocument()
    expect(screen.getByText("料金表または利用実績は未提供")).toBeInTheDocument()
  })
})
