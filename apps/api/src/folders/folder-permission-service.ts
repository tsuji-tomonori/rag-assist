import { HTTPException } from "hono/http-exception"
import type { AppUser } from "../auth.js"
import { folderPermissionSatisfies, isActiveAccount, type EffectiveFolderPermission } from "../authorization.js"
import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import type { FolderPolicyStore } from "../adapters/folder-policy-store.js"
import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { DocumentGroup, FolderPolicy, FolderPolicyEntry, FolderPolicyPermissionLevel, FolderPolicySource } from "../types.js"

export type EffectiveFolderPermissionDetail = {
  folderId: string
  permission: EffectiveFolderPermission
  policySource: FolderPolicySource
  policyId?: string
  inheritedFromFolderId?: string
}

export type FolderPermissionServiceDeps = {
  documentGroupStore: DocumentGroupStore
  folderPolicyStore: FolderPolicyStore
  userGroupStore: UserGroupStore
  groupMembershipStore: GroupMembershipStore
}

const permissionRank: Record<EffectiveFolderPermission, number> = {
  none: 0,
  readOnly: 1,
  full: 2
}

const permissionByRank = ["none", "readOnly", "full"] as const

export class FolderPermissionService {
  constructor(private readonly deps: FolderPermissionServiceDeps) {}

  async resolveEffectiveFolderPermission(user: AppUser, folderId: string): Promise<EffectiveFolderPermission> {
    return (await this.resolveEffectiveFolderPermissionDetail(user, folderId)).permission
  }

  async resolveEffectiveFolderPermissions(user: AppUser, folderIds: string[]): Promise<Record<string, EffectiveFolderPermission>> {
    const entries = await Promise.all(folderIds.map(async (folderId) => [folderId, await this.resolveEffectiveFolderPermission(user, folderId)] as const))
    return Object.fromEntries(entries)
  }

  async resolveEffectiveFolderPermissionDetail(user: AppUser, folderId: string): Promise<EffectiveFolderPermissionDetail> {
    if (!isActiveAccount(user)) return noneDetail(folderId)
    const groups = normalizeDocumentGroups(await this.deps.documentGroupStore.list())
    const folder = groups.find((group) => group.groupId === folderId)
    if (!folder || folder.status === "archived") return noneDetail(folderId)
    const parent = folder.parentGroupId ? groups.find((group) => group.groupId === folder.parentGroupId) : undefined
    if (parent && folder.hasExplicitPolicy === undefined && !folder.policyId) {
      const parentDetail = await this.resolveEffectiveFolderPermissionDetail(user, parent.groupId)
      return {
        folderId,
        permission: parentDetail.permission,
        policySource: parentDetail.permission === "none" ? parentDetail.policySource : "inherited",
        policyId: parentDetail.policyId,
        inheritedFromFolderId: parentDetail.permission === "none" ? parentDetail.inheritedFromFolderId : parentDetail.inheritedFromFolderId ?? parent.groupId
      }
    }

    const policyContext = await this.resolvePolicyContext(folder, groups)
    const grants: EffectiveFolderPermission[] = [await this.resolveAdminPrincipalGrant(user, folder)]
    if (policyContext.policy) {
      grants.push(await this.evaluatePolicy(user, policyContext.policy))
    } else {
      grants.push(await this.evaluatePolicy(user, legacyDefaultPolicy(folder)))
      if (folder.visibility === "org") grants.push("readOnly")
    }

    return {
      folderId,
      permission: maxPermission(grants),
      policySource: policyContext.source,
      policyId: policyContext.policy?.policyId,
      inheritedFromFolderId: policyContext.inheritedFromFolderId
    }
  }

  async assertFolderPermission(user: AppUser, folderId: string, required: Exclude<EffectiveFolderPermission, "none">): Promise<void> {
    const actual = await this.resolveEffectiveFolderPermission(user, folderId)
    if (!folderPermissionSatisfies(actual, required)) throw new HTTPException(403, { message: "Forbidden" })
  }

  async listReadableFolderIds(user: AppUser): Promise<string[]> {
    const groups = await this.deps.documentGroupStore.list()
    const entries = await Promise.all(groups.map(async (group) => [group.groupId, await this.resolveEffectiveFolderPermission(user, group.groupId)] as const))
    return entries.filter(([, permission]) => folderPermissionSatisfies(permission, "readOnly")).map(([folderId]) => folderId)
  }

  async listManageableFolderIds(user: AppUser): Promise<string[]> {
    const groups = await this.deps.documentGroupStore.list()
    const entries = await Promise.all(groups.map(async (group) => [group.groupId, await this.resolveEffectiveFolderPermission(user, group.groupId)] as const))
    return entries.filter(([, permission]) => folderPermissionSatisfies(permission, "full")).map(([folderId]) => folderId)
  }

  async saveFolderPolicy(policy: FolderPolicy): Promise<FolderPolicy> {
    await this.validatePolicyHasFullPrincipal(policy)
    return this.deps.folderPolicyStore.save({ ...policy, itemType: "folderPolicy" })
  }

  async validatePolicyHasFullPrincipal(policy: Pick<FolderPolicy, "entries">): Promise<void> {
    for (const entry of policy.entries) {
      if (entry.permissionLevel !== "full") continue
      if (entry.principalType === "user" && entry.principalId.trim()) return
      if (entry.principalType === "group") {
        const group = await this.deps.userGroupStore.get(entry.principalId)
        if (group?.status === "active") return
      }
    }
    throw new Error("Folder policy must include at least one active full principal")
  }

  private async resolvePolicyContext(folder: DocumentGroup, groups: DocumentGroup[]): Promise<{
    source: FolderPolicySource
    policy?: FolderPolicy
    inheritedFromFolderId?: string
  }> {
    const byId = new Map(groups.map((group) => [group.groupId, group]))
    let current: DocumentGroup | undefined = folder
    let inherited = false
    const visited = new Set<string>()
    while (current) {
      if (visited.has(current.groupId)) return { source: "none" }
      visited.add(current.groupId)
      if (current.hasExplicitPolicy !== undefined || current.policyId) {
        if (!current.policyId) return { source: inherited ? "inherited" : "explicit" }
        const policy = await this.deps.folderPolicyStore.get(current.policyId)
        if (!policy) return { source: "none" }
        return {
          source: inherited ? "inherited" : "explicit",
          policy,
          inheritedFromFolderId: inherited ? current.groupId : undefined
        }
      }
      current = current.parentGroupId ? byId.get(current.parentGroupId) : undefined
      inherited = true
    }
    return { source: "ownerDefault" }
  }

  private async evaluatePolicy(user: AppUser, policy: Pick<FolderPolicy, "entries">): Promise<EffectiveFolderPermission> {
    const grants = await Promise.all(policy.entries.map((entry) => this.evaluatePolicyEntry(user, entry)))
    return maxPermission(grants)
  }

  private async evaluatePolicyEntry(user: AppUser, entry: FolderPolicyEntry): Promise<EffectiveFolderPermission> {
    if (entry.principalType === "user") {
      return userMatchesPrincipal(user, entry.principalId) ? entry.permissionLevel : "none"
    }
    const membershipPermission = await this.resolveUserMembershipPermission(user, entry.principalId, new Set())
    return minPermission(entry.permissionLevel, membershipPermission)
  }

  private async resolveAdminPrincipalGrant(user: AppUser, folder: DocumentGroup): Promise<EffectiveFolderPermission> {
    if (folder.adminPrincipalType === "user") {
      return folder.adminPrincipalId === user.userId || (user.email !== undefined && folder.adminPrincipalId === user.email) ? "full" : "none"
    }
    if (!folder.adminPrincipalId) return "none"
    return this.resolveUserMembershipPermission(user, folder.adminPrincipalId, new Set())
  }

  private async resolveUserMembershipPermission(user: AppUser, groupId: string, visited: Set<string>): Promise<EffectiveFolderPermission> {
    if (visited.has(groupId)) return "none"
    visited.add(groupId)
    const group = await this.deps.userGroupStore.get(groupId)
    if (group?.status === "archived") return "none"
    if (user.cognitoGroups.includes(groupId)) return "full"

    const grants: EffectiveFolderPermission[] = []
    const memberships = await this.deps.groupMembershipStore.listByGroupId(groupId)
    for (const membership of memberships) {
      if (membership.memberType === "user") {
        if (userMatchesPrincipal(user, membership.memberId)) grants.push(membership.permissionLevel)
        continue
      }
      const childPermission = await this.resolveUserMembershipPermission(user, membership.memberId, new Set(visited))
      grants.push(minPermission(membership.permissionLevel, childPermission))
    }
    return maxPermission(grants)
  }
}

function noneDetail(folderId: string): EffectiveFolderPermissionDetail {
  return { folderId, permission: "none", policySource: "none" }
}

function userMatchesPrincipal(user: AppUser, principalId: string): boolean {
  return user.userId === principalId || user.email === principalId
}

function legacyDefaultPolicy(folder: DocumentGroup): Pick<FolderPolicy, "entries"> {
  const entries: FolderPolicyEntry[] = []
  if (folder.adminPrincipalType === "user" && folder.adminPrincipalId) entries.push({ principalType: "user", principalId: folder.adminPrincipalId, permissionLevel: "full" })
  if (folder.adminPrincipalType === "group" && folder.adminPrincipalId) entries.push({ principalType: "group", principalId: folder.adminPrincipalId, permissionLevel: "full" })
  for (const userId of folder.managerUserIds ?? []) entries.push({ principalType: "user", principalId: userId, permissionLevel: "full" })
  for (const userId of folder.sharedUserIds ?? []) entries.push({ principalType: "user", principalId: userId, permissionLevel: "readOnly" })
  for (const groupId of folder.sharedGroups ?? []) entries.push({ principalType: "group", principalId: groupId, permissionLevel: "readOnly" })
  return { entries }
}

function normalizeDocumentGroups(groups: DocumentGroup[]): DocumentGroup[] {
  const byId = new Map(groups.map((group) => [group.groupId, group]))
  const normalized = new Map<string, DocumentGroup>()
  const visiting = new Set<string>()
  const visit = (group: DocumentGroup): DocumentGroup => {
    const cached = normalized.get(group.groupId)
    if (cached) return cached
    if (visiting.has(group.groupId)) return normalizeDocumentGroup(group)
    visiting.add(group.groupId)
    const parent = group.parentGroupId ? byId.get(group.parentGroupId) : undefined
    const normalizedParent = parent ? visit(parent) : undefined
    const result = normalizeDocumentGroup(group, normalizedParent)
    normalized.set(group.groupId, result)
    visiting.delete(group.groupId)
    return result
  }
  return groups.map(visit)
}

function normalizeDocumentGroup(group: DocumentGroup, parent?: DocumentGroup): DocumentGroup {
  return {
    ...group,
    tenantId: group.tenantId ?? parent?.tenantId ?? "default",
    adminPrincipalType: group.adminPrincipalType ?? parent?.adminPrincipalType ?? "user",
    adminPrincipalId: group.adminPrincipalId ?? parent?.adminPrincipalId ?? group.ownerUserId,
    ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : [...(group.ancestorGroupIds ?? [])],
    visibility: group.visibility ?? "private",
    sharedUserIds: uniqueStrings(group.sharedUserIds ?? []),
    sharedGroups: uniqueStrings(group.sharedGroups ?? []),
    managerUserIds: uniqueStrings([group.ownerUserId, ...(group.managerUserIds ?? [])]),
    hasExplicitPolicy: group.hasExplicitPolicy ?? (group.policyId ? true : undefined),
    status: group.status ?? "active",
    createdBy: group.createdBy ?? group.ownerUserId
  }
}

function minPermission(left: EffectiveFolderPermission | FolderPolicyPermissionLevel, right: EffectiveFolderPermission | FolderPolicyPermissionLevel): EffectiveFolderPermission {
  return permissionByRank[Math.min(permissionRank[left], permissionRank[right])] ?? "none"
}

function maxPermission(values: EffectiveFolderPermission[]): EffectiveFolderPermission {
  const rank = values.reduce((current, value) => Math.max(current, permissionRank[value]), 0)
  return permissionByRank[rank] ?? "none"
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
