import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  type AttributeValue
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import {
  TENANT_ITEM_INDEX_NAME,
  tenantItemIndexAttributes,
  tenantPartitionId,
  tenantStorageKey
} from "../security/tenant-partition.js"
import type { GroupMembership } from "../types.js"
import {
  groupMembershipConflictError,
  groupMembershipId,
  groupMembershipStateVersion,
  type GroupMembershipStore,
  type VersionedGroupMembershipState
} from "./group-membership-store.js"

type StoredGroupMembership = GroupMembership & {
  groupId: string
  storageGroupId: string
  itemType: "groupMembership"
  tenantPartitionId: string
  tenantItemId: string
}

export class DynamoDbGroupMembershipStore implements GroupMembershipStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(tenantId: string): Promise<GroupMembership[]> {
    return this.queryMemberships(tenantId, "groupMembership#membership#")
  }

  async listByGroupId(tenantId: string, groupId: string): Promise<GroupMembership[]> {
    return this.queryMemberships(
      tenantId,
      `groupMembership#membership#${encodeURIComponent(groupId)}#`
    )
  }

  async listByMember(tenantId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<GroupMembership[]> {
    return (await this.list(tenantId)).filter((membership) => (
      membership.memberType === memberType && membership.memberId === memberId
    ))
  }

  private async queryMemberships(tenantId: string, itemPrefix: string): Promise<GroupMembership[]> {
    const memberships: GroupMembership[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: TENANT_ITEM_INDEX_NAME,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":itemPrefix": itemPrefix
        }),
        ExclusiveStartKey
      }))
      memberships.push(...(result.Items ?? [])
        .map((item) => unmarshall(item) as StoredGroupMembership)
        .filter((item) => item.itemType === "groupMembership")
        .map((item) => fromStored(item, tenantId)))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return memberships
  }

  async save(membership: GroupMembership): Promise<GroupMembership> {
    const normalized: GroupMembership = {
      ...membership,
      itemType: "groupMembership",
      membershipId: membership.membershipId ?? groupMembershipId(membership.groupId, membership.memberType, membership.memberId)
    }
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const current = await this.getVersionedGroupState(normalized.tenantId, normalized.groupId)
      const next = [
        ...current.memberships.filter((candidate) => !(
          candidate.memberType === normalized.memberType && candidate.memberId === normalized.memberId
        )),
        normalized
      ]
      try {
        const replaced = await this.replaceGroupState(normalized.tenantId, normalized.groupId, next, current.version)
        const saved = replaced.memberships.find((candidate) => (
          candidate.memberType === normalized.memberType && candidate.memberId === normalized.memberId
        ))
        if (!saved) throw new Error("Group membership replacement did not persist the member")
        return saved
      } catch (error) {
        if (!isGroupMembershipConflict(error) || attempt === 5) throw error
      }
    }
    throw groupMembershipConflictError(normalized.groupId)
  }

  async delete(tenantId: string, groupId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<void> {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const current = await this.getVersionedGroupState(tenantId, groupId)
      const next = current.memberships.filter((candidate) => !(
        candidate.memberType === memberType && candidate.memberId === memberId
      ))
      if (next.length === current.memberships.length) return
      try {
        await this.replaceGroupState(tenantId, groupId, next, current.version)
        return
      } catch (error) {
        if (!isGroupMembershipConflict(error) || attempt === 5) throw error
      }
    }
  }

  async getVersionedGroupState(tenantId: string, groupId: string): Promise<VersionedGroupMembershipState> {
    const memberships = await this.listByGroupId(tenantId, groupId)
    const computedVersion = groupMembershipStateVersion(memberships)
    const marker = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: membershipStateKey(tenantId, groupId) }),
      ConsistentRead: true
    }))
    if (marker.Item) {
      const stored = unmarshall(marker.Item) as {
        itemType?: string
        storageGroupId?: string
        stateVersion?: string
      }
      if (
        stored.itemType !== "groupMembershipState" ||
        stored.storageGroupId !== groupId ||
        stored.stateVersion !== computedVersion
      ) throw new Error(`Group membership state integrity mismatch for ${groupId}`)
    }
    return { memberships, version: computedVersion }
  }

  async replaceGroupState(
    tenantId: string,
    groupId: string,
    memberships: GroupMembership[],
    expectedVersion: string
  ): Promise<VersionedGroupMembershipState> {
    const current = await this.getVersionedGroupState(tenantId, groupId)
    if (current.version !== expectedVersion) throw groupMembershipConflictError(groupId)
    const next = memberships.map(normalizeMembership)
    if (next.some((membership) => membership.groupId !== groupId)) throw new Error("Group membership state contains another group")
    if (next.some((membership) => membership.tenantId !== tenantId)) throw new Error("Group membership state crossed a tenant boundary")
    const nextByKey = new Map(next.map((membership) => [storageKey(tenantId, groupId, membership.memberType, membership.memberId), membership]))
    if (nextByKey.size !== next.length) throw new Error("Group membership state contains duplicate principals")
    const removedKeys = current.memberships
      .map((membership) => storageKey(tenantId, groupId, membership.memberType, membership.memberId))
      .filter((key) => !nextByKey.has(key))
    if (next.length + removedKeys.length + 1 > 100) throw new Error("Group membership state is too large for an atomic update")
    const nextVersion = groupMembershipStateVersion(next)

    try {
      await this.client.send(new TransactWriteItemsCommand({
        TransactItems: [
          ...removedKeys.map((key) => ({
            Delete: { TableName: this.tableName, Key: marshall({ groupId: key }) }
          })),
          ...[...nextByKey.entries()].map(([key, membership]) => ({
            Put: {
              TableName: this.tableName,
              Item: marshall(toStored(membership, key), { removeUndefinedValues: true })
            }
          })),
          {
            Put: {
              TableName: this.tableName,
              Item: marshall({
                groupId: membershipStateKey(tenantId, groupId),
                itemType: "groupMembershipState",
                tenantId,
                storageGroupId: groupId,
                ...tenantItemIndexAttributes(tenantId, `groupMembershipState#${groupId}`),
                stateVersion: nextVersion
              }),
              ConditionExpression: "attribute_not_exists(groupId) OR stateVersion = :expectedVersion",
              ExpressionAttributeValues: marshall({ ":expectedVersion": expectedVersion })
            }
          }
        ]
      }))
    } catch (error) {
      if (error instanceof Error && error.name === "TransactionCanceledException") throw groupMembershipConflictError(groupId)
      throw error
    }

    return { memberships: next, version: nextVersion }
  }
}

function storageKey(tenantId: string, groupId: string, memberType: GroupMembership["memberType"], memberId: string): string {
  return tenantStorageKey(tenantId, groupMembershipId(groupId, memberType, memberId))
}

function membershipStateKey(tenantId: string, groupId: string): string {
  return tenantStorageKey(tenantId, `membership-state#${groupId}`)
}

function normalizeMembership(membership: GroupMembership): GroupMembership {
  return {
    ...membership,
    itemType: "groupMembership",
    membershipId: membership.membershipId ?? groupMembershipId(membership.groupId, membership.memberType, membership.memberId)
  }
}

function toStored(membership: GroupMembership, key: string): StoredGroupMembership {
  return {
    ...normalizeMembership(membership),
    ...tenantItemIndexAttributes(
      membership.tenantId,
      `groupMembership#${membership.membershipId ?? groupMembershipId(membership.groupId, membership.memberType, membership.memberId)}`
    ),
    groupId: key,
    storageGroupId: membership.groupId,
    itemType: "groupMembership"
  }
}

function fromStored(item: StoredGroupMembership, tenantId: string): GroupMembership {
  const membershipId = item.membershipId ?? groupMembershipId(item.storageGroupId, item.memberType, item.memberId)
  if (
    item.tenantId !== tenantId ||
    item.tenantPartitionId !== tenantPartitionId(tenantId) ||
    item.tenantItemId !== `groupMembership#${membershipId}`
  ) throw new Error("Group membership tenant storage integrity mismatch")
  const {
    storageGroupId,
    groupId: _storageKey,
    tenantPartitionId: _tenantPartitionId,
    tenantItemId: _tenantItemId,
    ...membership
  } = item
  return { ...membership, groupId: storageGroupId }
}

function isGroupMembershipConflict(error: unknown): boolean {
  return error instanceof Error && (
    error.name === "TransactionCanceledException" ||
    (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
  )
}
