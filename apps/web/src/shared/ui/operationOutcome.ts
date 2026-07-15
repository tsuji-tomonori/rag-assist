import { HttpError } from "../api/http.js"
import type { SemanticPresentation } from "./displayMetadata.js"

export type OperationStatus = "processing" | "success" | "failure" | "partial" | "unknown"

export type OperationEvidence = Readonly<{
  actor?: string
  resultReference?: string
  version?: string
  auditReference?: string
}>

export type OperationOutcome<T = undefined> =
  | Readonly<{
      ok: true
      status: "success" | "partial"
      value?: T
      message: string
      evidence?: OperationEvidence
    }>
  | Readonly<{
      ok: false
      status: "failure" | "unknown"
      error: string
      message: string
      evidence?: OperationEvidence
    }>

export type OperationFeedbackEntry = Readonly<{
  id: string
  actionLabel: string
  targetLabel: string
  targetId?: string
  status: OperationStatus
  message: string
  reason?: string
  occurredAt?: string
  evidence?: OperationEvidence
  details?: ReadonlyArray<Readonly<{ label: string; value: string }>>
  showUnavailableEvidence?: boolean
}>

const operationStatusPresentations = {
  processing: { label: "処理中", tone: "info", description: "対象への処理が完了していません" },
  success: { label: "完了", tone: "success", description: "API が処理結果を確定しました" },
  failure: { label: "失敗", tone: "danger", description: "API が処理を完了できなかったことを返しました" },
  partial: { label: "処理確定・表示未更新", tone: "warning", description: "mutation は確定しましたが、後続の表示更新を完了できませんでした" },
  unknown: { label: "結果未確認", tone: "warning", description: "通信断または timeout により処理結果を確認できません" }
} satisfies Record<OperationStatus, SemanticPresentation>

export function operationStatusPresentation(status: OperationStatus): SemanticPresentation {
  return operationStatusPresentations[status]
}

export function confirmedOperation<T = undefined>(
  value?: T,
  options: { message?: string; evidence?: OperationEvidence } = {}
): OperationOutcome<T> {
  return {
    ok: true,
    status: "success",
    value,
    message: options.message ?? "API が処理の完了を返しました。",
    evidence: options.evidence
  }
}

export function partialOperation<T>(
  value: T,
  message: string,
  evidence?: OperationEvidence
): OperationOutcome<T> {
  return { ok: true, status: "partial", value, message, evidence }
}

export function failedOperation(
  error: unknown,
  fallbackMessage = "操作を完了できませんでした。"
): OperationOutcome<never> {
  const errorMessage = operationErrorMessage(error, fallbackMessage)
  const unknown = isUnknownOperationResult(error, errorMessage)
  return {
    ok: false,
    status: unknown ? "unknown" : "failure",
    error: errorMessage,
    message: unknown
      ? "処理結果を確認できません。再実行する前に更新して対象の状態を確認してください。"
      : errorMessage
  }
}

export function processingOperationFeedback(
  base: Omit<OperationFeedbackEntry, "status" | "message">,
  message = "対象への処理を実行しています。"
): OperationFeedbackEntry {
  return { ...base, status: "processing", message }
}

export function feedbackFromOutcome<T>(
  base: Omit<OperationFeedbackEntry, "status" | "message" | "evidence">,
  outcome: OperationOutcome<T>
): OperationFeedbackEntry {
  return {
    ...base,
    status: outcome.status,
    message: outcome.message,
    evidence: outcome.evidence
  }
}

export function upsertOperationFeedback(
  current: OperationFeedbackEntry[],
  next: OperationFeedbackEntry,
  limit = 8
): OperationFeedbackEntry[] {
  return [next, ...current.filter((entry) => entry.id !== next.id)].slice(0, limit)
}

function isUnknownOperationResult(error: unknown, message: string): boolean {
  if (error instanceof HttpError) return error.status === 408 || error.status === 504
  if (error instanceof DOMException && error.name === "AbortError") return true
  const normalized = message.toLowerCase()
  return normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("connection reset")
}

function operationErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  const message = String(error).trim()
  return message && message !== "undefined" && message !== "null" ? message : fallbackMessage
}
