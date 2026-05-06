import { describe, expect, it } from "vitest"
import {
  adminAuditActionLabel,
  adminAuditSummary,
  costConfidenceLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatLatency,
  formatMetricLatency,
  formatPercent,
  formatShortDate,
  formatTime,
  managedUserStatusLabel,
  priorityLabel,
  runStatusLabel,
  sanitizeFileName,
  statusLabel
} from "./format.js"

describe("format utilities", () => {
  it("formats nullable dates, latency, percentage, and currency values", () => {
    expect(formatLatency(999)).toBe("999 ms")
    expect(formatLatency(1200)).toBe("1.20 秒")
    expect(formatMetricLatency(null)).toBe("-")
    expect(formatMetricLatency(20)).toBe("20 ms")
    expect(formatPercent(undefined)).toBe("-")
    expect(formatPercent(0.42)).toBe("42%")
    expect(formatCurrency(1.23456)).toBe("$1.2346")
    expect(formatShortDate()).toBe("-")
    expect(formatShortDate("invalid")).toBe("-")
    expect(formatDate("invalid")).toBe("-")
    expect(formatTime("invalid")).toBe("--:--:--")
    expect(formatDateTime("invalid")).toBe("-")
    expect(formatShortDate("2026-05-06T00:00:00.000Z")).toMatch(/05\/06|06\/05/)
  })

  it("maps admin, benchmark, question, and cost labels", () => {
    expect(["active", "suspended", "deleted"].map((status) => managedUserStatusLabel(status as never))).toEqual(["有効", "停止中", "削除済み"])
    expect(["actual_usage", "estimated_usage", "manual_estimate"].map((confidence) => costConfidenceLabel(confidence as never))).toEqual(["実測", "概算", "手動見積"])
    expect(["user:create", "role:assign", "user:suspend", "user:unsuspend", "user:delete"].map((action) => adminAuditActionLabel(action as never))).toEqual(["ユーザー作成", "ロール付与", "停止", "再開", "削除"])
    expect(["open", "answered", "resolved"].map((status) => statusLabel(status as never))).toEqual(["対応中", "回答済み", "解決済み"])
    expect(["queued", "running", "succeeded", "failed", "cancelled"].map((status) => runStatusLabel(status as never))).toEqual(["待機中", "実行中", "成功", "失敗", "取消済み"])
    expect(["urgent", "high", "normal"].map((priority) => priorityLabel(priority as never))).toEqual(["緊急", "高", "通常"])
  })

  it("summarizes admin audit changes and sanitizes filenames", () => {
    expect(adminAuditSummary({
      auditId: "audit-1",
      action: "role:assign",
      actorUserId: "admin",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      beforeGroups: [],
      afterGroups: ["CHAT_USER"],
      createdAt: "now"
    })).toBe("なし -> CHAT_USER")
    expect(adminAuditSummary({
      auditId: "audit-2",
      action: "user:suspend",
      actorUserId: "admin",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      beforeStatus: "active",
      afterStatus: "suspended",
      beforeGroups: [],
      afterGroups: [],
      createdAt: "now"
    })).toBe("有効 -> 停止中")
    expect(adminAuditSummary({
      auditId: "audit-3",
      action: "user:delete",
      actorUserId: "admin",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      beforeGroups: [],
      afterGroups: [],
      createdAt: "now"
    })).toBe("- -> -")
    expect(sanitizeFileName("申請/2026?.md")).toBe("___2026_.md")
    expect(formatDate("2026-05-06T00:00:00.000Z")).toContain("2026")
    expect(formatTime("2026-05-06T12:34:56.000Z")).toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(formatDateTime("2026-05-06T12:34:56.000Z")).toContain("2026")
  })
})
