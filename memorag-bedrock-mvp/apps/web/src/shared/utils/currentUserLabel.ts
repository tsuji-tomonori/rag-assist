import type { CurrentUser } from "../types/common.js"

export function currentUserLabel(user: CurrentUser | null | undefined): string {
  return user?.email?.trim() || user?.userId?.trim() || "未設定"
}

export function currentUserDepartmentLabel(): string {
  return "未設定"
}
