import { del, get, post } from "../../../shared/api/http.js"
import type { ManagedUser, ManagedUserDeletionPreflight, ManagedUserListPage, ManagedUserListQuery } from "../types.js"
import { buildAdminQuery, decodeManagedUserListPage } from "./adminContract.js"

export async function listManagedUsers(query: ManagedUserListQuery = {}): Promise<ManagedUserListPage> {
  return decodeManagedUserListPage(await get<unknown>(`/admin/users${buildAdminQuery(query)}`))
}

export async function createManagedUser(input: { email: string; displayName?: string; groups?: string[] }): Promise<ManagedUser> {
  return post<ManagedUser>("/admin/users", input)
}

export async function assignUserRoles(userId: string, groups: string[], reason: string): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/roles`, { groups, reason })
}

export async function suspendManagedUser(userId: string): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/suspend`, {})
}

export async function unsuspendManagedUser(userId: string): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/unsuspend`, {})
}

export async function getManagedUserDeletionPreflight(userId: string): Promise<ManagedUserDeletionPreflight> {
  return get<ManagedUserDeletionPreflight>(`/admin/users/${encodeURIComponent(userId)}/deletion-preflight`)
}

export async function deleteManagedUser(userId: string, successorUserId?: string): Promise<ManagedUser> {
  const query = successorUserId
    ? `?${new URLSearchParams({ successorUserId }).toString()}`
    : ""
  return del<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}${query}`, true)
}
