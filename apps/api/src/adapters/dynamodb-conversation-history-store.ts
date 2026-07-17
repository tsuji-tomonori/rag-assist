import { DeleteItemCommand, PutItemCommand, QueryCommand, type DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import type { ConversationHistoryItem } from "../types.js"
import {
  normalizeConversationHistoryInput,
  normalizeStoredConversationHistoryItem,
  type ConversationHistoryStore,
  type SaveConversationHistoryInput
} from "./conversation-history-store.js"
import { createDynamoDbClient } from "./dynamodb-client.js"

type StoredConversationHistoryItem = Omit<ConversationHistoryItem, "schemaVersion"> & {
  schemaVersion?: unknown
  userId: string
}

export class DynamoDbConversationHistoryStore implements ConversationHistoryStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = createDynamoDbClient()) {
    this.client = client
  }

  async save(userId: string, input: SaveConversationHistoryInput): Promise<ConversationHistoryItem> {
    const item: StoredConversationHistoryItem = {
      ...normalizeConversationHistoryInput(input),
      userId
    }
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true })
      })
    )
    return stripUserId(item)
  }

  async list(userId: string): Promise<ConversationHistoryItem[]> {
    const items: ConversationHistoryItem[] = []
    let ExclusiveStartKey: Record<string, unknown> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: marshall({ ":userId": userId }),
        ExclusiveStartKey: ExclusiveStartKey as never
      }))
      items.push(...(result.Items ?? []).map((item) => stripUserId(unmarshall(item) as StoredConversationHistoryItem)))
      ExclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (ExclusiveStartKey)
    return items
      .sort(compareHistoryItems)
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId, id })
      })
    )
  }
}

function compareHistoryItems(a: ConversationHistoryItem, b: ConversationHistoryItem): number {
  if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1
  return b.updatedAt.localeCompare(a.updatedAt)
}

function stripUserId(item: StoredConversationHistoryItem): ConversationHistoryItem {
  const { userId: _userId, ...conversation } = item
  return normalizeStoredConversationHistoryItem(conversation)
}
