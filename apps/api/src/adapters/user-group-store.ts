import type { UserGroup } from "../types.js"

export interface UserGroupStore {
  list(tenantId: string): Promise<UserGroup[]>
  get(tenantId: string, groupId: string): Promise<UserGroup | undefined>
  create(group: UserGroup): Promise<UserGroup>
  save(group: UserGroup): Promise<UserGroup>
  replace(group: UserGroup, expectedUpdatedAt: string): Promise<UserGroup>
  archive(tenantId: string, groupId: string, updatedAt: string): Promise<UserGroup>
}
