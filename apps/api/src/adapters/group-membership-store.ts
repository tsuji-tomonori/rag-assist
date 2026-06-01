import type { GroupMembership } from "../types.js"

export interface GroupMembershipStore {
  list(): Promise<GroupMembership[]>
  listByGroupId(groupId: string): Promise<GroupMembership[]>
  listByMember(memberType: GroupMembership["memberType"], memberId: string): Promise<GroupMembership[]>
  save(membership: GroupMembership): Promise<GroupMembership>
  delete(groupId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<void>
}

export function groupMembershipId(groupId: string, memberType: GroupMembership["memberType"], memberId: string): string {
  return `membership#${encodeURIComponent(groupId)}#${memberType}#${encodeURIComponent(memberId)}`
}
