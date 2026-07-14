import { createHash } from "node:crypto"
import type { GroupMembership } from "../types.js"

export type VersionedGroupMembershipState = {
  memberships: GroupMembership[]
  version: string
}

export interface GroupMembershipStore {
  list(tenantId: string): Promise<GroupMembership[]>
  listByGroupId(tenantId: string, groupId: string): Promise<GroupMembership[]>
  listByMember(tenantId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<GroupMembership[]>
  save(membership: GroupMembership): Promise<GroupMembership>
  delete(tenantId: string, groupId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<void>
  getVersionedGroupState(tenantId: string, groupId: string): Promise<VersionedGroupMembershipState>
  replaceGroupState(tenantId: string, groupId: string, memberships: GroupMembership[], expectedVersion: string): Promise<VersionedGroupMembershipState>
}

export function groupMembershipId(groupId: string, memberType: GroupMembership["memberType"], memberId: string): string {
  return `membership#${encodeURIComponent(groupId)}#${memberType}#${encodeURIComponent(memberId)}`
}

export function groupMembershipStateVersion(memberships: readonly GroupMembership[]): string {
  const canonical = memberships
    .map((membership) => ({
      membershipId: membership.membershipId ?? groupMembershipId(membership.groupId, membership.memberType, membership.memberId),
      tenantId: membership.tenantId ?? null,
      groupId: membership.groupId,
      memberType: membership.memberType,
      memberId: membership.memberId,
      permissionLevel: membership.permissionLevel,
      source: membership.source,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt
    }))
    .sort((left, right) => (
      `${left.groupId}\u0000${left.memberType}\u0000${left.memberId}`
        .localeCompare(`${right.groupId}\u0000${right.memberType}\u0000${right.memberId}`)
    ))
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export function groupMembershipConflictError(groupId: string): Error {
  const error = new Error(`Group membership state changed for ${groupId}`)
  Object.assign(error, { code: "PRECONDITION_FAILED" })
  return error
}
