import type { CostAuditSummary, ManagedUser, ManagedUserAuditLogEntry } from "../../features/admin/types.js"
import type { HumanQuestion } from "../../features/questions/types.js"
import {
  benchmarkRunStatusPresentation,
  managedUserStatusPresentation,
  questionPriorityPresentation,
  questionStatusPresentation
} from "../ui/displayMetadata.js"

export function formatLatency(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} 秒`
  return `${Math.round(value)} ms`
}

export function formatMetricLatency(value?: number | null): string {
  return typeof value === "number" ? formatLatency(value) : "-"
}

export function formatPercent(value?: number | null): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "-"
}

export function formatShortDate(input?: string): string {
  if (!input) return "-"
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`
}

export function formatDate(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
}

export function formatTime(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "--:--:--"
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function formatDateTime(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })
}

export function managedUserStatusLabel(status: ManagedUser["status"]): string {
  return managedUserStatusPresentation(status).label
}

export function costConfidenceLabel(confidence: NonNullable<CostAuditSummary["items"]>[number]["confidence"]): string {
  if (confidence === "actual_usage") return "実測"
  if (confidence === "estimated_usage") return "概算"
  return "手動見積"
}

export function adminAuditActionLabel(action: ManagedUserAuditLogEntry["action"]): string {
  if (action === "user:create") return "ユーザー作成"
  if (action === "role:assign") return "ロール付与"
  if (action === "user:suspend") return "停止"
  if (action === "user:unsuspend") return "再開"
  return "削除"
}

export function adminAuditSummary(entry: ManagedUserAuditLogEntry): string {
  if (entry.action === "role:assign" || entry.action === "user:create") {
    const before = entry.beforeGroups.length > 0 ? entry.beforeGroups.join(" / ") : "なし"
    const after = entry.afterGroups.length > 0 ? entry.afterGroups.join(" / ") : "なし"
    return `${before} -> ${after}`
  }
  const before = entry.beforeStatus ? managedUserStatusLabel(entry.beforeStatus) : "-"
  const after = entry.afterStatus ? managedUserStatusLabel(entry.afterStatus) : "-"
  return `${before} -> ${after}`
}

export function statusLabel(status: HumanQuestion["status"]): string {
  return questionStatusPresentation(status).label
}

export function runStatusLabel(status: "queued" | "running" | "succeeded" | "failed" | "cancelled"): string {
  return benchmarkRunStatusPresentation(status).label
}

export function priorityLabel(priority: HumanQuestion["priority"]): string {
  return questionPriorityPresentation(priority).label
}

export function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}
