import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { FolderPolicy } from "../types.js"
import type { FolderPolicyStore } from "./folder-policy-store.js"

type StoredFolderPolicy = FolderPolicy & { groupId: string; itemType: "folderPolicy" }

export class DynamoDbFolderPolicyStore implements FolderPolicyStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(): Promise<FolderPolicy[]> {
    const policies: FolderPolicy[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "itemType = :itemType",
        ExpressionAttributeValues: marshall({ ":itemType": "folderPolicy" }),
        ExclusiveStartKey
      }))
      policies.push(...(result.Items ?? []).map((item) => fromStored(unmarshall(item) as StoredFolderPolicy)))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return policies
  }

  async get(policyId: string): Promise<FolderPolicy | undefined> {
    const result = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: storageKey(policyId) })
    }))
    const item = result.Item ? (unmarshall(result.Item) as StoredFolderPolicy) : undefined
    return item?.itemType === "folderPolicy" ? fromStored(item) : undefined
  }

  async findByFolderId(folderId: string): Promise<FolderPolicy | undefined> {
    return (await this.list()).find((policy) => policy.folderId === folderId)
  }

  async save(policy: FolderPolicy): Promise<FolderPolicy> {
    const stored: StoredFolderPolicy = { ...policy, groupId: storageKey(policy.policyId), itemType: "folderPolicy" }
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(stored, { removeUndefinedValues: true })
    }))
    return fromStored(stored)
  }

  async delete(policyId: string): Promise<void> {
    await this.client.send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: storageKey(policyId) })
    }))
  }
}

function storageKey(policyId: string): string {
  return `folderPolicy#${policyId}`
}

function fromStored(item: StoredFolderPolicy): FolderPolicy {
  const { groupId: _groupId, ...policy } = item
  return policy
}
