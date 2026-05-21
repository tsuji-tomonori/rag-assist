import { createHash, randomUUID } from "node:crypto"
import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import type { FavoriteItem, FavoriteTargetType } from "../types.js"
import { createDynamoDbClient } from "./dynamodb-client.js"
import { favoriteTargetKey, type FavoriteStore, type SaveFavoriteInput } from "./favorite-store.js"

export class DynamoDbFavoriteStore implements FavoriteStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = createDynamoDbClient()) {
    this.client = client
  }

  async save(ownerUserId: string, input: SaveFavoriteInput): Promise<FavoriteItem> {
    const now = new Date().toISOString()
    const targetKey = favoriteTargetKey(input.targetType, input.targetId)
    const favoriteId = stableFavoriteId(ownerUserId, targetKey)
    const item: FavoriteItem = {
      favoriteId,
      ownerUserId,
      targetKey,
      targetType: input.targetType,
      targetId: input.targetId,
      label: input.label,
      note: input.note,
      createdAt: now,
      updatedAt: now
    }
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true })
      })
    )
    return item
  }

  async list(ownerUserId: string): Promise<FavoriteItem[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "ownerUserId = :ownerUserId",
        ExpressionAttributeValues: marshall({ ":ownerUserId": ownerUserId })
      })
    )
    return (result.Items ?? [])
      .map((item) => unmarshall(item) as FavoriteItem)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(ownerUserId: string, targetType: FavoriteTargetType, targetId: string): Promise<FavoriteItem | undefined> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ ownerUserId, targetKey: favoriteTargetKey(targetType, targetId) })
      })
    )
    return result.Item ? (unmarshall(result.Item) as FavoriteItem) : undefined
  }

  async delete(ownerUserId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ ownerUserId, targetKey: favoriteTargetKey(targetType, targetId) })
      })
    )
  }
}

function stableFavoriteId(ownerUserId: string, targetKey: string): string {
  const digest = createHash("sha256").update(`${ownerUserId}\0${targetKey}`).digest("hex").slice(0, 24)
  return `fav-${digest || randomUUID()}`
}
