import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { DocumentGroup } from "../types.js"
import { TENANT_ITEM_INDEX_NAME, tenantItemIndexAttributes, tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import type { CreateDocumentGroupInput, DocumentGroupPathLock, DocumentGroupPathUpdate, DocumentGroupStore, UpdateDocumentGroupInput } from "./document-group-store.js"

const adminCanonicalPathIndexName = "AdminCanonicalPathIndex"

export class DynamoDbDocumentGroupStore implements DocumentGroupStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(tenantId: string): Promise<DocumentGroup[]> {
    const groups: DocumentGroup[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: TENANT_ITEM_INDEX_NAME,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":itemPrefix": "documentGroup#"
        }),
        ExclusiveStartKey
      }))
      groups.push(...(result.Items ?? [])
        .map((item) => unmarshall(item) as StoredDocumentGroup | StoredDocumentGroupPathLock)
        .filter(isStoredDocumentGroupItem)
        .map((item) => fromStoredGroup(item, tenantId, item.rawGroupId)))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return groups
  }

  async get(tenantId: string, groupId: string): Promise<DocumentGroup | undefined> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ groupId: tenantStorageKey(tenantId, groupId) })
      })
    )
    const item = result.Item ? (unmarshall(result.Item) as StoredDocumentGroup | StoredDocumentGroupPathLock) : undefined
    if (item && isStoredDocumentGroupItem(item)) return fromStoredGroup(item, tenantId, groupId)
    if (!item) await this.assertNoLegacyItem(groupId)
    return undefined
  }

  async create(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(toStoredGroup(input), { removeUndefinedValues: true }),
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
              Item: marshall(toStoredPathLock(pathLockForGroup(input)), { removeUndefinedValues: true }),
              ConditionExpression: "attribute_not_exists(groupId)"
            }
          },
          {
            Put: {
              TableName: this.tableName,
              Item: marshall(toStoredGroup(input), { removeUndefinedValues: true }),
              ConditionExpression: "attribute_not_exists(groupId)"
            }
          }
        ]
      })
    )
    return input
  }

  async update(tenantId: string, groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
    const entries = Object.entries(storedUpdateInput(tenantId, input)).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
      const current = await this.get(tenantId, groupId)
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
        Key: marshall({ groupId: tenantStorageKey(tenantId, groupId) }),
        ConditionExpression: "attribute_exists(groupId)",
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Document group not found")
    return fromStoredGroup(unmarshall(result.Attributes) as StoredDocumentGroup, tenantId, groupId)
  }

  async updateWithPathLocks(tenantId: string, updates: DocumentGroupPathUpdate[]): Promise<DocumentGroup[]> {
    if (updates.length === 0) return []
    if (updates.some(({ current, next }) => current.tenantId !== tenantId || next.tenantId !== tenantId)) {
      throw new Error("Document group path update crossed a tenant boundary")
    }
    const transactItems = updates.flatMap((update) => {
      const pathChanged = update.current.adminPathPk !== update.next.adminPathPk || update.current.normalizedCanonicalPath !== update.next.normalizedCanonicalPath
      const items = []
      if (pathChanged) {
        items.push({
          Put: {
            TableName: this.tableName,
            Item: marshall(toStoredPathLock(pathLockForGroup(update.next)), { removeUndefinedValues: true }),
            ConditionExpression: "attribute_not_exists(groupId)"
          }
        })
      }
      items.push({
        Put: {
          TableName: this.tableName,
          Item: marshall(toStoredGroup(update.next), { removeUndefinedValues: true }),
          ConditionExpression: "attribute_exists(groupId) AND updatedAt = :updatedAt",
          ExpressionAttributeValues: marshall({ ":updatedAt": update.current.updatedAt })
        }
      })
      if (pathChanged && update.current.schemaVersion === 2 && update.current.adminPathPk && update.current.normalizedCanonicalPath) {
        items.push({
          Delete: {
            TableName: this.tableName,
            Key: marshall({ groupId: tenantStorageKey(tenantId, pathLockId(update.current.adminPathPk, update.current.normalizedCanonicalPath)) }),
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

  async findByCanonicalPath(tenantId: string, adminPathPk: string, normalizedCanonicalPath: string): Promise<DocumentGroup | undefined> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: adminCanonicalPathIndexName,
        KeyConditionExpression: "adminPathPk = :adminPathPk AND normalizedCanonicalPath = :normalizedCanonicalPath",
        ExpressionAttributeValues: marshall({
          ":adminPathPk": scopedAdminPathKey(tenantId, adminPathPk),
          ":normalizedCanonicalPath": normalizedCanonicalPath
        })
      })
    )
    const item = (result.Items ?? [])
      .map((value) => unmarshall(value) as StoredDocumentGroup | StoredDocumentGroupPathLock)
      .find(isStoredDocumentGroupItem)
    return item ? fromStoredGroup(item, tenantId, item.rawGroupId) : undefined
  }

  async listByAdminPath(tenantId: string, adminPathPk: string): Promise<DocumentGroup[]> {
    const groups: DocumentGroup[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: adminCanonicalPathIndexName,
          KeyConditionExpression: "adminPathPk = :adminPathPk",
          ExpressionAttributeValues: marshall({ ":adminPathPk": scopedAdminPathKey(tenantId, adminPathPk) }),
          ExclusiveStartKey
        })
      )
      groups.push(...(result.Items ?? [])
        .map((item) => unmarshall(item) as StoredDocumentGroup | StoredDocumentGroupPathLock)
        .filter(isStoredDocumentGroupItem)
        .map((item) => fromStoredGroup(item, tenantId, item.rawGroupId)))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return groups
  }

  private async assertNoLegacyItem(groupId: string): Promise<void> {
    const legacy = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId }),
      ProjectionExpression: "groupId"
    }))
    if (legacy.Item) throw new Error("Legacy unscoped document group requires tenant migration")
  }
}

function isStoredDocumentGroupItem(item: StoredDocumentGroup | StoredDocumentGroupPathLock): item is StoredDocumentGroup {
  return item.itemType === undefined || item.itemType === "documentGroup"
}

function pathLockForGroup(group: DocumentGroup): DocumentGroupPathLock {
  const now = group.updatedAt || new Date().toISOString()
  return {
    tenantId: group.tenantId,
    groupId: pathLockId(group.adminPathPk ?? "", group.normalizedCanonicalPath ?? ""),
    itemType: "documentGroupPathLock",
    adminPathPk: group.adminPathPk ?? "",
    normalizedCanonicalPath: group.normalizedCanonicalPath ?? "",
    lockedGroupId: group.groupId,
    createdAt: group.createdAt || now,
    updatedAt: now
  }
}

type StoredDocumentGroup = Omit<DocumentGroup, "groupId" | "adminPathPk"> & {
  groupId: string
  rawGroupId: string
  adminPathPk?: string
  rawAdminPathPk?: string
  tenantPartitionId: string
  tenantItemId: string
}

type StoredDocumentGroupPathLock = Omit<DocumentGroupPathLock, "groupId" | "adminPathPk"> & {
  groupId: string
  rawGroupId: string
  adminPathPk: string
  rawAdminPathPk: string
  tenantPartitionId: string
  tenantItemId: string
}

function toStoredGroup(group: DocumentGroup): StoredDocumentGroup {
  return {
    ...group,
    groupId: tenantStorageKey(group.tenantId, group.groupId),
    rawGroupId: group.groupId,
    adminPathPk: group.adminPathPk ? scopedAdminPathKey(group.tenantId, group.adminPathPk) : undefined,
    rawAdminPathPk: group.adminPathPk,
    ...tenantItemIndexAttributes(group.tenantId, `documentGroup#${group.groupId}`)
  }
}

function fromStoredGroup(stored: StoredDocumentGroup, tenantId: string, groupId: string): DocumentGroup {
  if (stored.tenantId !== tenantId || stored.rawGroupId !== groupId || stored.tenantPartitionId !== tenantPartitionId(tenantId)) {
    throw new Error("Document group tenant storage integrity mismatch")
  }
  const {
    rawGroupId,
    rawAdminPathPk,
    tenantPartitionId: _tenantPartitionId,
    tenantItemId: _tenantItemId,
    ...group
  } = stored
  return { ...group, groupId: rawGroupId, adminPathPk: rawAdminPathPk }
}

function toStoredPathLock(lock: DocumentGroupPathLock): StoredDocumentGroupPathLock {
  return {
    ...lock,
    groupId: tenantStorageKey(lock.tenantId, lock.groupId),
    rawGroupId: lock.groupId,
    adminPathPk: scopedAdminPathKey(lock.tenantId, lock.adminPathPk),
    rawAdminPathPk: lock.adminPathPk,
    ...tenantItemIndexAttributes(lock.tenantId, `documentGroupPathLock#${lock.groupId}`)
  }
}

function storedUpdateInput(tenantId: string, input: UpdateDocumentGroupInput): Record<string, unknown> {
  const stored: Record<string, unknown> = { ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
  if (input.adminPathPk !== undefined) {
    stored.rawAdminPathPk = input.adminPathPk
    stored.adminPathPk = scopedAdminPathKey(tenantId, input.adminPathPk)
  }
  return stored
}

function scopedAdminPathKey(tenantId: string, adminPathPk: string): string {
  return `${tenantPartitionId(tenantId)}#${encodeURIComponent(adminPathPk)}`
}

function pathLockId(adminPathPk: string, normalizedCanonicalPath: string): string {
  return `pathlock#${encodeURIComponent(adminPathPk)}#${encodeURIComponent(normalizedCanonicalPath)}`
}
