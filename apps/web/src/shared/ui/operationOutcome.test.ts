import { describe, expect, it } from "vitest"
import { HttpError } from "../api/http.js"
import {
  confirmedOperation,
  failedOperation,
  feedbackFromOutcome,
  processingOperationFeedback,
  upsertOperationFeedback
} from "./operationOutcome.js"

describe("operation outcome contract", () => {
  it("HTTP の確定拒否と通信断・timeout の結果不明を分離する", () => {
    expect(failedOperation(new HttpError(403, "Forbidden"))).toMatchObject({ ok: false, status: "failure", error: "Forbidden" })
    expect(failedOperation(new HttpError(504, "Gateway timeout"))).toMatchObject({ ok: false, status: "unknown" })
    expect(failedOperation(new TypeError("Failed to fetch"))).toMatchObject({ ok: false, status: "unknown" })
    expect(failedOperation(new TypeError("response.json is not a function"))).toMatchObject({ ok: false, status: "failure" })
    expect(failedOperation(new Error("validation failed"))).toMatchObject({ ok: false, status: "failure" })
  })

  it("同一操作 id の processing を確定 outcome で置換する", () => {
    const base = { id: "delete-doc-1", actionLabel: "文書削除", targetLabel: "規程.pdf" }
    const processing = processingOperationFeedback(base)
    const success = feedbackFromOutcome(base, confirmedOperation(undefined, {
      evidence: { resultReference: "doc-1", auditReference: "audit-1" }
    }))

    expect(upsertOperationFeedback([processing], success)).toEqual([success])
  })
})
