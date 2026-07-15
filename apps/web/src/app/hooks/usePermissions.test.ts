import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { CurrentUser, Permission } from "../../shared/types/common.js"
import { usePermissions } from "./usePermissions.js"

function user(permissions: Permission[]): CurrentUser {
  return {
    userId: "user-1",
    email: "user@example.com",
    groups: ["group"],
    permissions
  }
}

describe("usePermissions", () => {
  it("returns false for every capability without a current user", () => {
    const { result } = renderHook(() => usePermissions(null))

    expect(Object.values(result.current).every((value) => value === false)).toBe(true)
  })

  it("derives grouped admin, document, benchmark, and alias capabilities while async agent stays disabled", () => {
    const { result } = renderHook(() => usePermissions(user([
      "chat:create",
      "rag:doc:write:group",
      "rag:group:create",
      "folder.share",
      "folder.move",
      "rag:alias:read",
      "benchmark:read",
      "benchmark:run",
      "agent:read:self",
      "agent:run",
      "user:create",
      "usage:read:all_users",
      "usage:export",
      "cost:read:all",
      "cost:export",
      "answer:edit"
    ])))

    expect(result.current.canCreateChat).toBe(true)
    expect(result.current.canCreateDocumentGroups).toBe(true)
    expect(result.current.canShareDocumentGroups).toBe(true)
    expect(result.current.canMoveDocumentGroups).toBe(true)
    expect(result.current.canManageDocuments).toBe(true)
    expect(result.current.canManageAliases).toBe(true)
    expect(result.current.canReadBenchmarkRuns).toBe(true)
    expect(result.current.canRunBenchmark).toBe(true)
    expect(result.current.canReadAgentRuns).toBe(false)
    expect(result.current.canRunAgent).toBe(false)
    expect(result.current.canManageUsers).toBe(true)
    expect(result.current.canAuditOperations).toBe(true)
    expect(result.current.canExportUsage).toBe(true)
    expect(result.current.canExportCosts).toBe(true)
    expect(result.current.canSeeAdminSettings).toBe(true)
    expect(result.current.canCancelBenchmark).toBe(false)
    expect(result.current.canCancelAgent).toBe(false)
  })

  it("separates document upload, group create, group share, and group move permissions", () => {
    const createOnly = renderHook(() => usePermissions(user(["rag:group:create"])))
    expect(createOnly.result.current.canCreateDocumentGroups).toBe(true)
    expect(createOnly.result.current.canWriteDocuments).toBe(false)
    expect(createOnly.result.current.canManageDocuments).toBe(true)

    const uploadOnly = renderHook(() => usePermissions(user(["rag:doc:write:group"])))
    expect(uploadOnly.result.current.canCreateDocumentGroups).toBe(false)
    expect(uploadOnly.result.current.canWriteDocuments).toBe(true)
    expect(uploadOnly.result.current.canManageDocuments).toBe(true)

    const moveOnly = renderHook(() => usePermissions(user(["folder.move"])))
    expect(moveOnly.result.current.canMoveDocumentGroups).toBe(true)
    expect(moveOnly.result.current.canShareDocumentGroups).toBe(false)
    expect(moveOnly.result.current.canManageDocuments).toBe(true)
  })

  it("does not infer audit export authority from audit read authority", () => {
    const readOnly = renderHook(() => usePermissions(user(["access:policy:read"])))
    expect(readOnly.result.current.canReadAdminAuditLog).toBe(true)
    expect(readOnly.result.current.canExportAdminAuditLog).toBe(false)

    const exporter = renderHook(() => usePermissions(user(["access:audit:export"])))
    expect(exporter.result.current.canReadAdminAuditLog).toBe(false)
    expect(exporter.result.current.canExportAdminAuditLog).toBe(true)
  })

  it("does not infer usage or cost export authority from aggregate read authority", () => {
    const readOnly = renderHook(() => usePermissions(user(["usage:read:all_users", "cost:read:all"])))
    expect(readOnly.result.current.canReadUsage).toBe(true)
    expect(readOnly.result.current.canReadCosts).toBe(true)
    expect(readOnly.result.current.canExportUsage).toBe(false)
    expect(readOnly.result.current.canExportCosts).toBe(false)

    const exporter = renderHook(() => usePermissions(user(["usage:export", "cost:export"])))
    expect(exporter.result.current.canReadUsage).toBe(false)
    expect(exporter.result.current.canReadCosts).toBe(false)
    expect(exporter.result.current.canExportUsage).toBe(true)
    expect(exporter.result.current.canExportCosts).toBe(true)
  })
})
