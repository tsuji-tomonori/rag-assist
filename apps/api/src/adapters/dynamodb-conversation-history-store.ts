import { DeleteItemCommand, DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import { CONVERSATION_HISTORY_SCHEMA_VERSION, type ConversationHistoryItem, type ConversationHistorySchemaVersion } from "../types.js"
import { normalizeConversationHistoryInput, type ConversationHistoryStore, type SaveConversationHistoryInput } from "./conversation-history-store.js"

type StoredConversationHistoryItem = Omit<ConversationHistoryItem, "schemaVersion"> & {
  schemaVersion?: ConversationHistorySchemaVersion
  userId: string
}

export class DynamoDbConversationHistoryStore implements ConversationHistoryStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
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
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: marshall({ ":userId": userId })
      })
    )
    return (result.Items ?? [])
      .map((item) => stripUserId(unmarshall(item) as StoredConversationHistoryItem))
      .sort(compareHistoryItems)
      .slice(0, 20)
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
  return {
    ...conversation,
    schemaVersion: conversation.schemaVersion ?? CONVERSATION_HISTORY_SCHEMA_VERSION
  }
}
