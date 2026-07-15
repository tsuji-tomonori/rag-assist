import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OperationFeedback } from "./OperationFeedback.js"

describe("OperationFeedback", () => {
  it("対象と API 由来の result/version/audit evidence を状態に関連付ける", () => {
    render(<OperationFeedback entry={{
      id: "share-doc-1",
      actionLabel: "文書共有",
      targetLabel: "規程.pdf",
      targetId: "doc-1",
      status: "success",
      message: "共有方針を確定しました。",
      reason: "監査担当へ共有",
      evidence: { resultReference: "doc-1", version: "policy-v2", auditReference: "audit-1" },
      showUnavailableEvidence: true
    }} />)

    const feedback = screen.getByRole("status", { name: "文書共有: 規程.pdf" })
    expect(within(feedback).getByText("完了")).toBeVisible()
    expect(within(feedback).getByText("policy-v2")).toBeVisible()
    expect(within(feedback).getByText("audit-1")).toBeVisible()
    expect(within(feedback).getByText("API 応答で未提供")).toBeVisible()
  })

  it("結果不明を failure と偽らず assertive alert で示す", () => {
    render(<OperationFeedback entry={{
      id: "cancel-run-1",
      actionLabel: "性能テスト取消",
      targetLabel: "run-1",
      status: "unknown",
      message: "処理結果を確認できません。更新してください。"
    }} />)

    const feedback = screen.getByRole("alert", { name: "性能テスト取消: run-1" })
    expect(within(feedback).getByText("結果未確認")).toBeVisible()
    expect(feedback).toHaveAttribute("aria-live", "assertive")
  })
})
