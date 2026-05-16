import { del, get, post } from "../../../shared/api/http.js"
import type { ManagedUser } from "../types.js"

export async function listManagedUsers(): Promise<ManagedUser[] | null> {
  const result = await get<{ users?: ManagedUser[] }>("/admin/users")
  return Array.isArray(result.users) ? result.users : null
}

export async function createManagedUser(input: { email: string; displayName?: string; groups?: string[] }): Promise<ManagedUser> {
  return post<ManagedUser>("/admin/users", input)
}

export async function assignUserRoles(userId: string, groups: string[]): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/roles`, { groups })
}

export async function suspendManagedUser(userId: string): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/suspend`, {})
}

export async function unsuspendManagedUser(userId: string): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/unsuspend`, {})
}

export async function deleteManagedUser(userId: string): Promise<ManagedUser> {
  return del<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}`, true)
}
