import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  type AttributeValue
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import {
  WEB_SOCKET_TICKET_SCHEMA_VERSION,
  type WebSocketTicketRecord,
  type WebSocketTicketStore
} from "./websocket-ticket-store.js"

type DynamoDbTicketClient = {
  send(command: PutItemCommand | UpdateItemCommand): Promise<unknown>
}

export class DynamoDbWebSocketTicketStore implements WebSocketTicketStore {
  private readonly client: DynamoDbTicketClient

  constructor(
    private readonly tableName = config.webSocketTicketsTableName,
    client?: DynamoDbTicketClient
  ) {
    if (!tableName) throw new Error("WEBSOCKET_TICKETS_TABLE_NAME is required")
    this.client = client ?? new DynamoDBClient({ region: config.region })
  }

  async issue(record: WebSocketTicketRecord): Promise<void> {
    validateRecord(record)
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(record, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_not_exists(ticketHash)"
    }))
  }

  async consume(ticketHash: string, consumedAtEpochMs: number): Promise<WebSocketTicketRecord | undefined> {
    validateHashAndTime(ticketHash, consumedAtEpochMs)
    try {
      const result = await this.client.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ ticketHash }),
        UpdateExpression: "SET #state = :consumed, consumedAtEpochMs = :now",
        ConditionExpression: "#state = :issued AND expiresAtEpochMs > :now AND tokenExpiresAtEpochMs > :now",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: marshall({
          ":issued": "issued",
          ":consumed": "consumed",
          ":now": consumedAtEpochMs
        }),
        ReturnValues: "ALL_NEW"
      })) as { Attributes?: Record<string, AttributeValue> }
      if (!result.Attributes) throw new Error("WebSocket ticket consume did not return a record")
      const record = unmarshall(result.Attributes) as WebSocketTicketRecord
      validateRecord(record)
      if (record.state !== "consumed" || record.consumedAtEpochMs !== consumedAtEpochMs) {
        throw new Error("WebSocket ticket consume integrity mismatch")
      }
      return record
    } catch (error) {
      if (isConditionalCheckFailed(error)) return undefined
      throw error
    }
  }

  async revoke(ticketHash: string, revokedAtEpochMs: number): Promise<boolean> {
    validateHashAndTime(ticketHash, revokedAtEpochMs)
    try {
      await this.client.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ ticketHash }),
        UpdateExpression: "SET #state = :revoked, revokedAtEpochMs = :now",
        ConditionExpression: "#state = :issued",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: marshall({
          ":issued": "issued",
          ":revoked": "revoked",
          ":now": revokedAtEpochMs
        })
      }))
      return true
    } catch (error) {
      if (isConditionalCheckFailed(error)) return false
      throw error
    }
  }
}

function validateRecord(record: WebSocketTicketRecord): void {
  if (record.schemaVersion !== WEB_SOCKET_TICKET_SCHEMA_VERSION) throw new Error("WebSocket ticket schema is invalid")
  for (const [name, value] of [
    ["ticketHash", record.ticketHash],
    ["ticketId", record.ticketId],
    ["userId", record.userId],
    ["identityUsername", record.identityUsername],
    ["tenantId", record.tenantId],
    ["sessionId", record.sessionId],
    ["tokenId", record.tokenId]
  ] as const) {
    if (!value || value.trim() !== value) throw new Error(`WebSocket ticket ${name} is invalid`)
  }
  if (!/^[a-f0-9]{64}$/.test(record.ticketHash)) throw new Error("WebSocket ticket hash is invalid")
  if (!["issued", "consumed", "revoked"].includes(record.state)) throw new Error("WebSocket ticket state is invalid")
  for (const value of [
    record.tokenIssuedAtEpochMs,
    record.tokenExpiresAtEpochMs,
    record.issuedAtEpochMs,
    record.expiresAtEpochMs,
    record.ttl
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("WebSocket ticket timestamp is invalid")
  }
  if (record.expiresAtEpochMs <= record.issuedAtEpochMs) throw new Error("WebSocket ticket lifetime is invalid")
  if (record.tokenExpiresAtEpochMs <= record.tokenIssuedAtEpochMs) throw new Error("WebSocket token lifetime is invalid")
  if (record.ttl !== Math.ceil(record.expiresAtEpochMs / 1000)) throw new Error("WebSocket ticket TTL is invalid")
}

function validateHashAndTime(ticketHash: string, epochMs: number): void {
  if (!/^[a-f0-9]{64}$/.test(ticketHash)) throw new Error("WebSocket ticket hash is invalid")
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) throw new Error("WebSocket ticket timestamp is invalid")
}

function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof Error && error.name === "ConditionalCheckFailedException"
}
