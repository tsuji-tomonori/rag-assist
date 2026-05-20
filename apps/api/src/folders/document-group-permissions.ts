import type { AppUser } from "../auth.js"
import { isActiveAccount, type EffectiveFolderPermission } from "../authorization.js"
import type { DocumentGroup } from "../types.js"

const permissionRank: Record<EffectiveFolderPermission, number> = {
  none: 0,
  readOnly: 1,
  full: 2
}

export function documentGroupHasLegacyExplicitPolicy(input: {
  visibility?: DocumentGroup["visibility"]
  sharedUserIds?: string[]
  sharedGroups?: string[]
  managerUserIds?: string[]
}): boolean {
  return input.visibility !== undefined ||
    input.sharedUserIds !== undefined ||
    input.sharedGroups !== undefined ||
    input.managerUserIds !== undefined
}

export function canAccessDocumentGroup(group: DocumentGroup | undefined, user: AppUser, groups: DocumentGroup[] = []): boolean {
  return folderPermissionSatisfies(resolveDocumentGroupPermissionDetail(group, user, groups).permission, "readOnly")
}

export function canManageDocumentGroup(group: DocumentGroup | undefined, user: AppUser, groups: DocumentGroup[] = []): boolean {
  return folderPermissionSatisfies(resolveDocumentGroupPermissionDetail(group, user, groups).permission, "full")
}

export type DocumentGroupPermissionDetail = {
  permission: EffectiveFolderPermission
  policySource: "explicit" | "inherited" | "ownerDefault" | "none"
  inheritedFromFolderId?: string
}

export function resolveDocumentGroupPermissionDetail(
  group: DocumentGroup | undefined,
  user: AppUser,
  groups: DocumentGroup[] = [],
  visited: Set<string> = new Set()
): DocumentGroupPermissionDetail {
  if (!group) return noneDetail()
  if (!isActiveAccount(user)) return noneDetail()
  if ((group.status ?? "active") !== "active") return noneDetail()
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return { permission: "full", policySource: policySourceForGroup(group, groups) }
  if (visited.has(group.groupId)) return noneDetail()
  visited.add(group.groupId)

  const parent = group.parentGroupId ? groups.find((candidate) => candidate.groupId === group.parentGroupId) : undefined
  if (parent && group.hasExplicitPolicy === undefined && !group.policyId) {
    const parentDetail = resolveDocumentGroupPermissionDetail(parent, user, groups, visited)
    return {
      permission: parentDetail.permission,
      policySource: parentDetail.permission === "none" ? parentDetail.policySource : "inherited",
      inheritedFromFolderId: parentDetail.permission === "none" ? parentDetail.inheritedFromFolderId : parent.groupId
    }
  }

  const policySource = policySourceForGroup(group, groups)
  if (group.ownerUserId === user.userId || (group.managerUserIds ?? []).includes(user.userId)) return { permission: "full", policySource }
  if ((group.sharedUserIds ?? []).includes(user.userId)) return { permission: "readOnly", policySource }
  if (user.email && (group.sharedUserIds ?? []).includes(user.email)) return { permission: "readOnly", policySource }
  if (group.visibility === "org") return { permission: "readOnly", policySource }
  if ((group.sharedGroups ?? []).some((sharedGroup) => user.cognitoGroups.includes(sharedGroup))) return { permission: "readOnly", policySource }
  return { permission: "none", policySource }
}

export function resolveDocumentGroupPermission(
  group: DocumentGroup | undefined,
  user: AppUser,
  groups: DocumentGroup[] = []
): EffectiveFolderPermission {
  return resolveDocumentGroupPermissionDetail(group, user, groups).permission
}

function folderPermissionSatisfies(actual: EffectiveFolderPermission, required: Exclude<EffectiveFolderPermission, "none">): boolean {
  return permissionRank[actual] >= permissionRank[required]
}

function noneDetail(): DocumentGroupPermissionDetail {
  return { permission: "none", policySource: "none" }
}

function policySourceForGroup(group: DocumentGroup, groups: DocumentGroup[]): DocumentGroupPermissionDetail["policySource"] {
  if (group.hasExplicitPolicy !== undefined || group.policyId) return "explicit"
  return group.parentGroupId && groups.some((candidate) => candidate.groupId === group.parentGroupId) ? "inherited" : "ownerDefault"
}
