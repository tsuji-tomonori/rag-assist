import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, TransactWriteItemsCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { DocumentGroup } from "../types.js"
import type { CreateDocumentGroupInput, DocumentGroupPathLock, DocumentGroupPathUpdate, DocumentGroupStore, UpdateDocumentGroupInput } from "./document-group-store.js"

const adminCanonicalPathIndexName = "AdminCanonicalPathIndex"

export class DynamoDbDocumentGroupStore implements DocumentGroupStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(): Promise<DocumentGroup[]> {
    const groups: DocumentGroup[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new ScanCommand({ TableName: this.tableName, ExclusiveStartKey }))
      groups.push(...(result.Items ?? [])
        .map((item) => unmarshall(item) as DocumentGroup | DocumentGroupPathLock)
        .filter(isDocumentGroupItem))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return groups
  }

  async get(groupId: string): Promise<DocumentGroup | undefined> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ groupId })
      })
    )
    const item = result.Item ? (unmarshall(result.Item) as DocumentGroup | DocumentGroupPathLock) : undefined
    return item && isDocumentGroupItem(item) ? item : undefined
  }

  async create(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(input, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(groupId)"
      })
    )
    return input
  }

  async createWithPathLock(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    await this.client.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: marshall(pathLockForGroup(input), { removeUndefinedValues: true }),
              ConditionExpression: "attribute_not_exists(groupId)"
            }
          },
          {
            Put: {
              TableName: this.tableName,
              Item: marshall(input, { removeUndefinedValues: true }),
              ConditionExpression: "attribute_not_exists(groupId)"
            }
          }
        ]
      })
    )
    return input
  }

  async update(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
    const entries = Object.entries({ ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
      const current = await this.get(groupId)
      if (!current) throw new Error("Document group not found")
      return current
    }

    const names: Record<string, string> = {}
    const values: Record<string, unknown> = {}
    const assignments = entries.map(([key, value]) => {
      names[`#${key}`] = key
      values[`:${key}`] = value
      return `#${key} = :${key}`
    })

    const result = await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ groupId }),
        ConditionExpression: "attribute_exists(groupId)",
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Document group not found")
    return unmarshall(result.Attributes) as DocumentGroup
  }

  async updateWithPathLocks(updates: DocumentGroupPathUpdate[]): Promise<DocumentGroup[]> {
    if (updates.length === 0) return []
    const transactItems = updates.flatMap((update) => {
      const pathChanged = update.current.adminPathPk !== update.next.adminPathPk || update.current.normalizedCanonicalPath !== update.next.normalizedCanonicalPath
      const items = []
      if (pathChanged) {
        items.push({
          Put: {
            TableName: this.tableName,
            Item: marshall(pathLockForGroup(update.next), { removeUndefinedValues: true }),
            ConditionExpression: "attribute_not_exists(groupId)"
          }
        })
      }
      items.push({
        Put: {
          TableName: this.tableName,
          Item: marshall(update.next, { removeUndefinedValues: true }),
          ConditionExpression: "attribute_exists(groupId) AND updatedAt = :updatedAt",
          ExpressionAttributeValues: marshall({ ":updatedAt": update.current.updatedAt })
        }
      })
      if (pathChanged && update.current.schemaVersion === 2 && update.current.adminPathPk && update.current.normalizedCanonicalPath) {
        items.push({
          Delete: {
            TableName: this.tableName,
            Key: marshall({ groupId: pathLockId(update.current.adminPathPk, update.current.normalizedCanonicalPath) }),
            ConditionExpression: "lockedGroupId = :lockedGroupId",
            ExpressionAttributeValues: marshall({ ":lockedGroupId": update.current.groupId })
          }
        })
      }
      return items
    })
    if (transactItems.length > 25) throw new Error("Document group path update exceeds DynamoDB transaction limit")
    await this.client.send(new TransactWriteItemsCommand({ TransactItems: transactItems }))
    return updates.map((update) => update.next)
  }

  async findByCanonicalPath(adminPathPk: string, normalizedCanonicalPath: string): Promise<DocumentGroup | undefined> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: adminCanonicalPathIndexName,
        KeyConditionExpression: "adminPathPk = :adminPathPk AND normalizedCanonicalPath = :normalizedCanonicalPath",
        ExpressionAttributeValues: marshall({ ":adminPathPk": adminPathPk, ":normalizedCanonicalPath": normalizedCanonicalPath })
      })
    )
    const items = (result.Items ?? []).map((item) => unmarshall(item) as DocumentGroup | DocumentGroupPathLock)
    return items.find(isDocumentGroupItem)
  }

  async listByAdminPath(adminPathPk: string): Promise<DocumentGroup[]> {
    const groups: DocumentGroup[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: adminCanonicalPathIndexName,
          KeyConditionExpression: "adminPathPk = :adminPathPk",
          ExpressionAttributeValues: marshall({ ":adminPathPk": adminPathPk }),
          ExclusiveStartKey
        })
      )
      groups.push(...(result.Items ?? [])
        .map((item) => unmarshall(item) as DocumentGroup | DocumentGroupPathLock)
        .filter(isDocumentGroupItem))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return groups
  }
}

function isDocumentGroupItem(item: DocumentGroup | DocumentGroupPathLock | { itemType?: string }): item is DocumentGroup {
  return item.itemType === undefined || item.itemType === "documentGroup"
}

function pathLockForGroup(group: DocumentGroup): DocumentGroupPathLock {
  const now = group.updatedAt || new Date().toISOString()
  return {
    groupId: pathLockId(group.adminPathPk ?? "", group.normalizedCanonicalPath ?? ""),
    itemType: "documentGroupPathLock",
    adminPathPk: group.adminPathPk ?? "",
    normalizedCanonicalPath: group.normalizedCanonicalPath ?? "",
    lockedGroupId: group.groupId,
    createdAt: group.createdAt || now,
    updatedAt: now
  }
}

function pathLockId(adminPathPk: string, normalizedCanonicalPath: string): string {
  return `pathlock#${encodeURIComponent(adminPathPk)}#${encodeURIComponent(normalizedCanonicalPath)}`
}
