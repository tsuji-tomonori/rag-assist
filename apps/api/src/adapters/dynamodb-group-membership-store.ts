import { DeleteItemCommand, DynamoDBClient, PutItemCommand, ScanCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { GroupMembership } from "../types.js"
import { groupMembershipId, type GroupMembershipStore } from "./group-membership-store.js"

type StoredGroupMembership = GroupMembership & { groupId: string; storageGroupId: string; itemType: "groupMembership" }

export class DynamoDbGroupMembershipStore implements GroupMembershipStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(): Promise<GroupMembership[]> {
    const memberships: GroupMembership[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "itemType = :itemType",
        ExpressionAttributeValues: marshall({ ":itemType": "groupMembership" }),
        ExclusiveStartKey
      }))
      memberships.push(...(result.Items ?? []).map((item) => fromStored(unmarshall(item) as StoredGroupMembership)))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return memberships
  }

  async listByGroupId(groupId: string): Promise<GroupMembership[]> {
    return (await this.list()).filter((membership) => membership.groupId === groupId)
  }

  async listByMember(memberType: GroupMembership["memberType"], memberId: string): Promise<GroupMembership[]> {
    return (await this.list()).filter((membership) => membership.memberType === memberType && membership.memberId === memberId)
  }

  async save(membership: GroupMembership): Promise<GroupMembership> {
    const normalized: GroupMembership = {
      ...membership,
      itemType: "groupMembership",
      membershipId: membership.membershipId ?? groupMembershipId(membership.groupId, membership.memberType, membership.memberId)
    }
    const stored: StoredGroupMembership = {
      ...normalized,
      groupId: storageKey(normalized.groupId, normalized.memberType, normalized.memberId),
      storageGroupId: normalized.groupId,
      itemType: "groupMembership"
    }
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(stored, { removeUndefinedValues: true })
    }))
    return normalized
  }

  async delete(groupId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<void> {
    await this.client.send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: storageKey(groupId, memberType, memberId) })
    }))
  }
}

function storageKey(groupId: string, memberType: GroupMembership["memberType"], memberId: string): string {
  return groupMembershipId(groupId, memberType, memberId)
}

function fromStored(item: StoredGroupMembership): GroupMembership {
  const { storageGroupId, groupId: _storageKey, ...membership } = item
  return { ...membership, groupId: storageGroupId }
}
