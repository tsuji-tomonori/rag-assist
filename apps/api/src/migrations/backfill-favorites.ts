import { DynamoDBClient, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import type { ConversationHistoryItem, FavoriteItem } from "../types.js"
import { createDynamoDbClient } from "../adapters/dynamodb-client.js"
import { favoriteTargetKey } from "../adapters/favorite-store.js"

type StoredHistory = ConversationHistoryItem & {
  userId: string
}

export async function backfillFavoritesFromConversationHistory(input: {
  conversationHistoryTableName: string
  favoritesTableName: string
  client?: DynamoDBClient
}): Promise<{ scanned: number; created: number }> {
  const client = input.client ?? createDynamoDbClient()
  let scanned = 0
  let created = 0
  let ExclusiveStartKey: Record<string, unknown> | undefined
  do {
    const page = await client.send(new ScanCommand({
      TableName: input.conversationHistoryTableName,
      ExclusiveStartKey: ExclusiveStartKey as never
    }))
    ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined
    for (const raw of page.Items ?? []) {
      scanned += 1
      const history = unmarshall(raw) as StoredHistory
      if (history.isFavorite !== true) continue
      await client.send(new PutItemCommand({
        TableName: input.favoritesTableName,
        Item: marshall(toFavorite(history), { removeUndefinedValues: true })
      }))
      created += 1
    }
  } while (ExclusiveStartKey)
  return { scanned, created }
}

function toFavorite(history: StoredHistory): FavoriteItem {
  const targetKey = favoriteTargetKey("chatSession", history.id)
  const now = new Date().toISOString()
  return {
    favoriteId: `fav-${history.userId}-${targetKey}`.replace(/[^A-Za-z0-9_-]/g, "-"),
    ownerUserId: history.userId,
    targetKey,
    targetType: "chatSession",
    targetId: history.id,
    label: history.title,
    createdAt: history.updatedAt || now,
    updatedAt: now
  }
}
