import type { UserGroup } from "../types.js"

export interface UserGroupStore {
  list(): Promise<UserGroup[]>
  get(groupId: string): Promise<UserGroup | undefined>
  save(group: UserGroup): Promise<UserGroup>
  archive(groupId: string, updatedAt: string): Promise<UserGroup>
}
