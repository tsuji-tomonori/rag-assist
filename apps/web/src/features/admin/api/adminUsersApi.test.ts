import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteManagedUser, getManagedUserDeletionPreflight } from "./adminUsersApi.js"

function successResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body))
  }
}

describe("adminUsersApi deletion transfer", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api")
  })

  it("loads server-verified ownership counts and successor candidates", async () => {
    const preflight = {
      targetUserId: "target/1",
      requiresSuccessor: true,
      ownedResources: { folders: 1, resourceGroups: 2, documents: 3, total: 6 },
      eligibleSuccessors: [{ userId: "successor-1", email: "successor@example.com", status: "active" as const }]
    }
    const fetchMock = vi.fn().mockResolvedValue(successResponse(preflight))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getManagedUserDeletionPreflight("target/1")).resolves.toEqual(preflight)
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/target%2F1/deletion-preflight", { headers: {} })
  })

  it("passes the explicitly selected successor as an encoded DELETE query", async () => {
    const deleted = {
      userId: "target/1",
      email: "target@example.com",
      status: "deleted" as const,
      groups: [],
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T01:00:00.000Z"
    }
    const fetchMock = vi.fn().mockResolvedValue(successResponse(deleted))
    vi.stubGlobal("fetch", fetchMock)

    await expect(deleteManagedUser("target/1", "successor & 1")).resolves.toEqual(deleted)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users/target%2F1?successorUserId=successor+%26+1",
      { method: "DELETE", headers: {} }
    )
  })
})
