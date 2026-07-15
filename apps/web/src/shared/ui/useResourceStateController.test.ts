import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { UiStateTarget } from "./ResourceState.js"
import { useResourceStateController } from "./useResourceStateController.js"
import { HttpError } from "../api/http.js"

const target: UiStateTarget = {
  id: "admin",
  label: "管理者設定",
  regionId: "admin-state-region",
  source: "管理 API"
}

describe("useResourceStateController", () => {
  it("全 part の初回失敗を error とし、raw error を表示 state に残さない", async () => {
    const { result } = renderHook(() => useResourceStateController({ admin: target }))

    await act(() => result.current.run("admin", [
      { id: "users", label: "ユーザー", load: () => Promise.reject(new Error("private stack and endpoint")) }
    ]))

    expect(result.current.states.admin.kind).toBe("error")
    expect(result.current.states.admin).toMatchObject({
      message: "通信またはサービスの状態を確認して、もう一度お試しください。"
    })
    expect(JSON.stringify(result.current.states.admin)).not.toContain("private stack")
  })

  it("part ごとの成功と失敗を partial に保持する", async () => {
    const { result } = renderHook(() => useResourceStateController({ admin: target }))

    await act(() => result.current.run("admin", [
      { id: "users", label: "ユーザー", load: () => Promise.resolve([]) },
      { id: "audit", label: "監査", load: () => Promise.reject(new Error("unavailable")) }
    ]))

    expect(result.current.states.admin.kind).toBe("partial")
    expect(result.current.states.admin.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "users", status: "ready" }),
      expect.objectContaining({ id: "audit", status: "failed" })
    ]))
  })

  it("retry 中は既存 content を保持し、成功後は recovered になる", async () => {
    const { result } = renderHook(() => useResourceStateController({ admin: target }))
    let resolveRetry: (() => void) | undefined
    const retryPromise = new Promise<void>((resolve) => { resolveRetry = resolve })

    await act(() => result.current.run("admin", [
      { id: "users", label: "ユーザー", load: () => Promise.reject(new Error("temporary")) }
    ]))
    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.run("admin", [
        { id: "users", label: "ユーザー", load: () => retryPromise }
      ], "retry")
    })

    expect(result.current.states.admin).toMatchObject({ kind: "retrying", retainContent: false })
    await act(async () => {
      resolveRetry?.()
      await pending
    })
    expect(result.current.states.admin.kind).toBe("recovered")
  })

  it("成功済み content の background 更新失敗は stale として保持する", async () => {
    const { result } = renderHook(() => useResourceStateController({ admin: target }))
    await act(() => result.current.run("admin", [
      { id: "users", label: "ユーザー", load: () => Promise.resolve([]) }
    ]))

    await act(() => result.current.run("admin", [
      { id: "users", label: "ユーザー", load: () => Promise.reject(new Error("temporary")) }
    ], "background"))

    expect(result.current.states.admin.kind).toBe("stale")
    expect(result.current.states.admin.parts[0]).toMatchObject({ id: "users", status: "stale" })
  })

  it("permission は protected content を持たない明示 state にする", () => {
    const { result } = renderHook(() => useResourceStateController({ admin: target }))
    act(() => result.current.setPermission("admin", "管理権限がありません。"))
    expect(result.current.states.admin).toMatchObject({ kind: "permission", message: "管理権限がありません。" })
  })

  it("HTTP 403 は permission として分類し、成功済み content も再表示しない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const { result } = renderHook(() => useResourceStateController({ admin: target }))
    await act(() => result.current.run("admin", [
      { id: "users", label: "ユーザー", load: () => Promise.resolve([]) }
    ]))

    await act(() => result.current.run("admin", [
      { id: "users", label: "ユーザー", load: () => Promise.reject(new HttpError(403, "private response")) }
    ], "refresh"))

    expect(result.current.states.admin.kind).toBe("permission")
    expect(result.current.states.admin.parts[0]).toMatchObject({ id: "users", status: "permission" })
    expect(JSON.stringify(result.current.states.admin)).not.toContain("private response")
    warn.mockRestore()
  })
})
