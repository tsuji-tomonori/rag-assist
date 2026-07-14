import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import {
  TENANT_ITEM_INDEX_NAME,
  tenantItemIndexAttributes,
  tenantPartitionId,
  tenantStorageKey
} from "../security/tenant-partition.js"
import type { UserGroup } from "../types.js"
import type { UserGroupStore } from "./user-group-store.js"

type StoredUserGroup = Omit<UserGroup, "groupId"> & {
  groupId: string
  storageGroupId: string
  itemType: "userGroup"
  tenantPartitionId: string
  tenantItemId: string
}

export class DynamoDbUserGroupStore implements UserGroupStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(tenantId: string): Promise<UserGroup[]> {
    const groups: UserGroup[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: TENANT_ITEM_INDEX_NAME,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":itemPrefix": "userGroup#"
        }),
        ExclusiveStartKey
      }))
      groups.push(...(result.Items ?? [])
        .map((item) => unmarshall(item) as StoredUserGroup)
        .filter((item) => item.itemType === "userGroup")
        .map((item) => fromStored(item, tenantId)))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return groups
  }

  async get(tenantId: string, groupId: string): Promise<UserGroup | undefined> {
    const result = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: tenantStorageKey(tenantId, groupId) }),
      ConsistentRead: true
    }))
    const item = result.Item ? (unmarshall(result.Item) as StoredUserGroup) : undefined
    return item?.itemType === "userGroup" && item.tenantId === tenantId && item.storageGroupId === groupId
      ? fromStored(item, tenantId)
      : undefined
  }

  async create(group: UserGroup): Promise<UserGroup> {
    const stored: UserGroup = { ...group, itemType: "userGroup" }
    try {
      await this.client.send(new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(toStored(stored), { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(groupId)"
      }))
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        throw Object.assign(new Error(`User group already exists for ${group.groupId}`), { code: "PRECONDITION_FAILED" })
      }
      throw error
    }
    return stored
  }

  async save(group: UserGroup): Promise<UserGroup> {
    const stored: UserGroup = { ...group, itemType: "userGroup" }
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(toStored(stored), { removeUndefinedValues: true })
    }))
    return stored
  }

  async replace(group: UserGroup, expectedUpdatedAt: string): Promise<UserGroup> {
    const stored: UserGroup = { ...group, itemType: "userGroup" }
    try {
      await this.client.send(new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(toStored(stored), { removeUndefinedValues: true }),
        ConditionExpression: "attribute_exists(groupId) AND itemType = :itemType AND updatedAt = :expectedUpdatedAt",
        ExpressionAttributeValues: marshall({
          ":itemType": "userGroup",
          ":expectedUpdatedAt": expectedUpdatedAt
        })
      }))
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        throw Object.assign(new Error(`User group changed for ${group.groupId}`), { code: "PRECONDITION_FAILED" })
      }
      throw error
    }
    return stored
  }

  async archive(tenantId: string, groupId: string, updatedAt: string): Promise<UserGroup> {
    const result = await this.client.send(new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: tenantStorageKey(tenantId, groupId) }),
      ConditionExpression: "attribute_exists(groupId) AND itemType = :itemType",
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: marshall({ ":itemType": "userGroup", ":status": "archived", ":updatedAt": updatedAt }),
      ReturnValues: "ALL_NEW"
    }))
    if (!result.Attributes) throw new Error("User group not found")
    return fromStored(unmarshall(result.Attributes) as StoredUserGroup, tenantId)
  }
}

function toStored(group: UserGroup): StoredUserGroup {
  const { groupId, ...rest } = group
  return {
    ...rest,
    ...tenantItemIndexAttributes(group.tenantId, `userGroup#${groupId}`),
    groupId: tenantStorageKey(group.tenantId, groupId),
    storageGroupId: groupId,
    itemType: "userGroup"
  }
}

function fromStored(group: StoredUserGroup, tenantId: string): UserGroup {
  if (
    group.tenantId !== tenantId ||
    group.tenantPartitionId !== tenantPartitionId(tenantId) ||
    group.tenantItemId !== `userGroup#${group.storageGroupId}`
  ) throw new Error("User group tenant storage integrity mismatch")
  const {
    groupId: _physicalGroupId,
    storageGroupId,
    tenantPartitionId: _tenantPartitionId,
    tenantItemId: _tenantItemId,
    ...rest
  } = group
  return { ...rest, groupId: storageGroupId, itemType: "userGroup" }
}
