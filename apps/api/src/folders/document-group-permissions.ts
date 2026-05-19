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
  return folderPermissionSatisfies(resolveDocumentGroupPermission(group, user, groups), "readOnly")
}

export function canManageDocumentGroup(group: DocumentGroup | undefined, user: AppUser, groups: DocumentGroup[] = []): boolean {
  return folderPermissionSatisfies(resolveDocumentGroupPermission(group, user, groups), "full")
}

export function resolveDocumentGroupPermission(
  group: DocumentGroup | undefined,
  user: AppUser,
  groups: DocumentGroup[] = [],
  visited: Set<string> = new Set()
): EffectiveFolderPermission {
  if (!group) return "none"
  if (!isActiveAccount(user)) return "none"
  if ((group.status ?? "active") !== "active") return "none"
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return "full"
  if (visited.has(group.groupId)) return "none"
  visited.add(group.groupId)

  const parent = group.parentGroupId ? groups.find((candidate) => candidate.groupId === group.parentGroupId) : undefined
  if (parent && !group.hasExplicitPolicy && !group.policyId) return resolveDocumentGroupPermission(parent, user, groups, visited)

  if (group.ownerUserId === user.userId || (group.managerUserIds ?? []).includes(user.userId)) return "full"
  if ((group.sharedUserIds ?? []).includes(user.userId)) return "readOnly"
  if (user.email && (group.sharedUserIds ?? []).includes(user.email)) return "readOnly"
  if (group.visibility === "org") return "readOnly"
  if ((group.sharedGroups ?? []).some((sharedGroup) => user.cognitoGroups.includes(sharedGroup))) return "readOnly"
  return "none"
}

function folderPermissionSatisfies(actual: EffectiveFolderPermission, required: Exclude<EffectiveFolderPermission, "none">): boolean {
  return permissionRank[actual] >= permissionRank[required]
}
