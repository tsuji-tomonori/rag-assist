import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  ResourceStateBoundary,
  ResourceStatePanel,
  type UiResourceState,
  type UiStateTarget
} from "./ResourceState.js"
import {
  canShowResourceContent,
  createContentResourceState,
  createEmptyResourceState,
  hasConfirmedResourceResult,
  isResourcePartAvailable,
  isResourceStateBusy,
  resourcePartStatus
} from "./resourceStateModel.js"

const target: UiStateTarget = {
  id: "history",
  label: "会話履歴",
  regionId: "history-state-region",
  source: "会話履歴 API"
}
const asOf = "2026-07-14T06:00:00.000Z"

describe("ResourceStateBoundary", () => {
  it("state model は確認済み結果、保持可能 content、busy、part availability を別々に判定する", () => {
    const content = createContentResourceState(target, asOf)
    const empty = createEmptyResourceState(target, "保存済み会話", asOf)
    const loading: UiResourceState = {
      kind: "loading",
      target,
      parts: [{ id: "items", label: "会話一覧", status: "loading" }],
      operation: "初回取得中",
      retainContent: false
    }
    const retrying: UiResourceState = {
      kind: "retrying",
      target,
      parts: [{ id: "items", label: "会話一覧", status: "retrying", asOf }],
      operation: "再取得中",
      retainContent: true
    }
    const partial: UiResourceState = {
      kind: "partial",
      target,
      parts: [
        { id: "items", label: "会話一覧", status: "ready", asOf },
        { id: "tickets", label: "問い合わせ状態", status: "stale", asOf },
        { id: "audit", label: "監査", status: "failed" }
      ],
      message: "取得できた内容を表示します。",
      asOf
    }

    expect(hasConfirmedResourceResult(content)).toBe(true)
    expect(hasConfirmedResourceResult(empty)).toBe(true)
    expect(hasConfirmedResourceResult(partial)).toBe(true)
    expect(hasConfirmedResourceResult(loading)).toBe(false)
    expect(canShowResourceContent(loading)).toBe(false)
    expect(canShowResourceContent(retrying)).toBe(true)
    expect(isResourceStateBusy(loading)).toBe(true)
    expect(isResourceStateBusy(content)).toBe(false)
    expect(resourcePartStatus(partial, "items")).toBe("ready")
    expect(resourcePartStatus(partial, "missing")).toBeUndefined()
    expect(isResourcePartAvailable(partial, "items")).toBe(true)
    expect(isResourcePartAvailable(partial, "tickets")).toBe(true)
    expect(isResourcePartAvailable(partial, "audit")).toBe(false)
  })

  it("loading は対象 region を busy にして未確認の zero/content を表示しない", () => {
    const state: UiResourceState = {
      kind: "loading",
      target,
      parts: [{ id: "items", label: "会話一覧", status: "loading" }],
      operation: "会話履歴 API から取得中",
      retainContent: false
    }

    render(<ResourceStateBoundary state={state} isEmpty emptyTitle="0 件です"><span>0 件</span></ResourceStateBoundary>)

    expect(screen.getByRole("status")).toHaveTextContent("会話履歴を読み込んでいます")
    expect(document.getElementById(target.regionId)).toHaveAttribute("aria-busy", "true")
    expect(screen.queryByText("0 件")).not.toBeInTheDocument()
  })

  it("取得成功後の zero だけを empty として表示する", () => {
    render(
      <ResourceStateBoundary
        state={createContentResourceState(target, asOf)}
        isEmpty
        emptyScope="保存済み会話"
        emptyTitle="保存済み会話はありません"
      >
        <span>content</span>
      </ResourceStateBoundary>
    )

    expect(screen.getByRole("status")).toHaveAttribute("data-state-kind", "empty")
    expect(screen.getByRole("status")).toHaveTextContent("取得は完了しており、対象は 0 件です")
    expect(screen.queryByText("content")).not.toBeInTheDocument()
  })

  it("error は alert と対象付き retry を示し、empty に変換しない", async () => {
    const onRetry = vi.fn()
    const state: UiResourceState = {
      kind: "error",
      target,
      parts: [{ id: "items", label: "会話一覧", status: "failed" }],
      message: "通信またはサービスの状態を確認して、もう一度お試しください。"
    }

    render(<ResourceStateBoundary state={state} isEmpty emptyTitle="0 件です" onRetry={onRetry}><span>0 件</span></ResourceStateBoundary>)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveAttribute("data-state-target", "history")
    expect(alert).toHaveTextContent("会話履歴を取得できませんでした")
    expect(alert).not.toHaveTextContent("0 件です")
    const retry = screen.getByRole("button", { name: "再試行" })
    expect(retry).toHaveAttribute("aria-controls", target.regionId)
    await userEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("permission は alert と安全な back action を示す", async () => {
    const onBack = vi.fn()
    const state: UiResourceState = {
      kind: "permission",
      target,
      parts: [],
      message: "会話履歴を参照する権限がありません。"
    }
    render(<ResourceStateBoundary state={state} onBack={onBack}><span>protected</span></ResourceStateBoundary>)

    expect(screen.getByRole("alert")).toHaveTextContent("会話履歴を表示できません")
    expect(screen.queryByText("protected")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "戻る" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("partial は成功部分と未更新部分を分け、成功 content を保持する", () => {
    const state: UiResourceState = {
      kind: "partial",
      target,
      parts: [
        { id: "items", label: "会話一覧", status: "ready", asOf },
        { id: "tickets", label: "問い合わせ状態", status: "failed" }
      ],
      message: "取得できた項目を表示します。",
      asOf
    }
    render(<ResourceStateBoundary state={state}><span>取得済み content</span></ResourceStateBoundary>)

    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("取得済み会話一覧")
    expect(status).toHaveTextContent("未更新問い合わせ状態")
    expect(screen.getByText("取得済み content")).toBeInTheDocument()
  })

  it("stale は source/as-of と refresh を示して既存 content を保持する", () => {
    const state: UiResourceState = {
      kind: "stale",
      target,
      parts: [{ id: "items", label: "会話一覧", status: "stale", asOf }],
      message: "最後に確認できた内容を表示しています。",
      asOf
    }
    render(<ResourceStateBoundary state={state} onRetry={vi.fn()}><span>以前の content</span></ResourceStateBoundary>)

    expect(screen.getByRole("status")).toHaveTextContent("source: 会話履歴 API")
    expect(screen.getByRole("button", { name: "最新情報を取得" })).toBeInTheDocument()
    expect(screen.getByText("以前の content")).toBeInTheDocument()
  })

  it("retrying は retained content を busy のまま残す", () => {
    const state: UiResourceState = {
      kind: "retrying",
      target,
      parts: [{ id: "items", label: "会話一覧", status: "retrying", asOf }],
      operation: "会話履歴 API へ再要求中",
      retainContent: true
    }
    render(<ResourceStateBoundary state={state}><span>以前の content</span></ResourceStateBoundary>)

    expect(screen.getByRole("status")).toHaveTextContent("再試行しています")
    expect(screen.getByRole("button", { name: "処理中" })).toBeDisabled()
    expect(screen.getByText("以前の content")).toBeInTheDocument()
  })

  it("recovered は対象に関連付けた完了 status と更新時刻を示す", () => {
    const state: UiResourceState = {
      kind: "recovered",
      target,
      parts: [{ id: "items", label: "会話一覧", status: "ready", asOf }],
      message: "再試行した対象を最新の状態へ更新しました。",
      asOf
    }
    render(<ResourceStateBoundary state={state}><span>回復後 content</span></ResourceStateBoundary>)

    expect(screen.getByRole("status")).toHaveTextContent("会話履歴を更新しました")
    expect(screen.getByRole("status").querySelector("time")).toHaveAttribute("dateTime", asOf)
    expect(screen.getByText("回復後 content")).toBeInTheDocument()
  })

  it("明示された alert だけを focus recovery target にできる", () => {
    const state: Exclude<UiResourceState, { kind: "content" }> = {
      kind: "error",
      target,
      parts: [],
      message: "再試行してください。"
    }
    render(<ResourceStatePanel state={state} focusOnMount />)
    expect(screen.getByRole("alert")).toHaveFocus()
  })
})
