import { createHash, randomUUID } from "node:crypto"
import { DeleteItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand, type DynamoDBClient } from "@aws-sdk/client-dynamodb"
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
    const setExpressions = [
      "favoriteId = if_not_exists(favoriteId, :favoriteId)",
      "targetType = if_not_exists(targetType, :targetType)",
      "targetId = if_not_exists(targetId, :targetId)",
      "createdAt = if_not_exists(createdAt, :createdAt)",
      "updatedAt = :updatedAt"
    ]
    const values: Record<string, unknown> = {
      ":favoriteId": favoriteId,
      ":targetType": input.targetType,
      ":targetId": input.targetId,
      ":createdAt": now,
      ":updatedAt": now
    }
    if (input.label !== undefined) {
      setExpressions.push("#label = :label")
      values[":label"] = input.label
    }
    if (input.note !== undefined) {
      setExpressions.push("note = :note")
      values[":note"] = input.note
    }
    const commandInput = {
      TableName: this.tableName,
      Key: marshall({ ownerUserId, targetKey }),
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
      ReturnValues: "ALL_NEW"
    } as const
    const result = await this.client.send(
      new UpdateItemCommand(input.label !== undefined ? { ...commandInput, ExpressionAttributeNames: { "#label": "label" } } : commandInput)
    )
    if (!result.Attributes) throw new Error("Favorite save failed")
    return unmarshall(result.Attributes) as FavoriteItem
  }

  async list(ownerUserId: string): Promise<FavoriteItem[]> {
    const items: FavoriteItem[] = []
    let ExclusiveStartKey: Record<string, unknown> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "ownerUserId = :ownerUserId",
        ExpressionAttributeValues: marshall({ ":ownerUserId": ownerUserId }),
        ExclusiveStartKey: ExclusiveStartKey as never
      }))
      items.push(...(result.Items ?? []).map((item) => unmarshall(item) as FavoriteItem))
      ExclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (ExclusiveStartKey)
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
