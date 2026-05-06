import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getMe } from "../../features/admin/api/currentUserApi.js"
import type { AuthSession } from "../../authClient.js"
import { useCurrentUser } from "./useCurrentUser.js"

vi.mock("../../features/admin/api/currentUserApi.js", () => ({
  getMe: vi.fn()
}))

const session: AuthSession = {
  email: "a@example.com",
  accessToken: "token",
  idToken: "id",
  expiresAt: Date.now() + 1000
}

describe("useCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  it("clears user when session is missing and loads current user when present", async () => {
    vi.mocked(getMe).mockResolvedValue({ userId: "user-1", email: "a@example.com", groups: ["CHAT_USER"], permissions: ["chat:create"] })
    const { result, rerender } = renderHook((authSession: AuthSession | null) => useCurrentUser(authSession), { initialProps: null as AuthSession | null })

    expect(result.current.currentUser).toBeNull()

    rerender(session)
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.currentUser?.userId).toBe("user-1")
    expect(result.current.currentUserError).toBeNull()
  })

  it("stores load errors and ignores stale async results after unmount", async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new Error("load failed")).mockResolvedValueOnce({ userId: "late", email: "late@example.com", groups: [], permissions: [] })
    const { result, rerender, unmount } = renderHook((authSession: AuthSession | null) => useCurrentUser(authSession), { initialProps: session })

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.currentUserError).toBe("load failed")

    rerender({ ...session, accessToken: "next" })
    unmount()
    await act(async () => {
      await Promise.resolve()
    })

    expect(getMe).toHaveBeenCalledTimes(2)
  })

  it("stores non-Error load failures as strings", async () => {
    vi.mocked(getMe).mockRejectedValueOnce("load failed as string")
    const { result } = renderHook(() => useCurrentUser(session))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.currentUserError).toBe("load failed as string")
  })
})
