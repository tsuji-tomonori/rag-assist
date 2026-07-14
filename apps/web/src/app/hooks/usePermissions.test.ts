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
      "cost:read:all",
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
})
