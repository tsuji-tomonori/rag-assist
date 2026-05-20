import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { UserGroup } from "../types.js"
import type { UserGroupStore } from "./user-group-store.js"

export class DynamoDbUserGroupStore implements UserGroupStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(): Promise<UserGroup[]> {
    const groups: UserGroup[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "itemType = :itemType",
        ExpressionAttributeValues: marshall({ ":itemType": "userGroup" }),
        ExclusiveStartKey
      }))
      groups.push(...(result.Items ?? []).map((item) => unmarshall(item) as UserGroup))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return groups
  }

  async get(groupId: string): Promise<UserGroup | undefined> {
    const result = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId })
    }))
    const item = result.Item ? (unmarshall(result.Item) as UserGroup) : undefined
    return item?.itemType === "userGroup" ? item : undefined
  }

  async save(group: UserGroup): Promise<UserGroup> {
    const stored: UserGroup = { ...group, itemType: "userGroup" }
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(stored, { removeUndefinedValues: true })
    }))
    return stored
  }

  async archive(groupId: string, updatedAt: string): Promise<UserGroup> {
    const result = await this.client.send(new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId }),
      ConditionExpression: "attribute_exists(groupId) AND itemType = :itemType",
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: marshall({ ":itemType": "userGroup", ":status": "archived", ":updatedAt": updatedAt }),
      ReturnValues: "ALL_NEW"
    }))
    if (!result.Attributes) throw new Error("User group not found")
    return unmarshall(result.Attributes) as UserGroup
  }
}
