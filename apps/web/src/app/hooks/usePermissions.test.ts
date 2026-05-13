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

  it("derives grouped admin, document, benchmark, and alias capabilities", () => {
    const { result } = renderHook(() => usePermissions(user([
      "chat:create",
      "rag:doc:write:group",
      "rag:alias:read",
      "benchmark:read",
      "benchmark:run",
      "user:create",
      "usage:read:all_users",
      "cost:read:all",
      "answer:edit"
    ])))

    expect(result.current.canCreateChat).toBe(true)
    expect(result.current.canManageDocuments).toBe(true)
    expect(result.current.canManageAliases).toBe(true)
    expect(result.current.canReadBenchmarkRuns).toBe(true)
    expect(result.current.canRunBenchmark).toBe(true)
    expect(result.current.canManageUsers).toBe(true)
    expect(result.current.canAuditOperations).toBe(true)
    expect(result.current.canSeeAdminSettings).toBe(true)
    expect(result.current.canCancelBenchmark).toBe(false)
  })
})
