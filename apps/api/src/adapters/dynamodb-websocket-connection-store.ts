import { DeleteItemCommand, DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"

export type WebSocketConnectionRecord = {
  schemaVersion: 1
  connectionId: string
  userId: string
  tenantId: string
  sessionId: string
  tokenId: string
  ticketId: string
  connectedAtEpochMs: number
  expiresAtEpochMs: number
  ttl: number
}

type DynamoDbConnectionClient = {
  send(command: PutItemCommand | DeleteItemCommand): Promise<unknown>
}

export interface WebSocketConnectionStore {
  connect(record: WebSocketConnectionRecord): Promise<void>
  disconnect(connectionId: string): Promise<void>
}

export class DynamoDbWebSocketConnectionStore implements WebSocketConnectionStore {
  private readonly client: DynamoDbConnectionClient

  constructor(
    private readonly tableName = config.webSocketConnectionsTableName,
    client?: DynamoDbConnectionClient
  ) {
    if (!tableName) throw new Error("WEBSOCKET_CONNECTIONS_TABLE_NAME is required")
    this.client = client ?? new DynamoDBClient({ region: config.region })
  }

  async connect(record: WebSocketConnectionRecord): Promise<void> {
    validateRecord(record)
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(record),
      ConditionExpression: "attribute_not_exists(connectionId)"
    }))
  }

  async disconnect(connectionId: string): Promise<void> {
    const canonicalConnectionId = canonical(connectionId)
    await this.client.send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ connectionId: canonicalConnectionId })
    }))
  }
}

function validateRecord(record: WebSocketConnectionRecord): void {
  if (record.schemaVersion !== 1) throw new Error("WebSocket connection schema is invalid")
  for (const value of [record.connectionId, record.userId, record.tenantId, record.sessionId, record.tokenId, record.ticketId]) canonical(value)
  if (
    !Number.isSafeInteger(record.connectedAtEpochMs)
    || !Number.isSafeInteger(record.expiresAtEpochMs)
    || record.connectedAtEpochMs < 0
    || record.expiresAtEpochMs <= record.connectedAtEpochMs
    || record.ttl !== Math.ceil(record.expiresAtEpochMs / 1000)
  ) throw new Error("WebSocket connection lifetime is invalid")
}

function canonical(value: string): string {
  if (!value || value.trim() !== value) throw new Error("WebSocket connection identity is invalid")
  return value
}
