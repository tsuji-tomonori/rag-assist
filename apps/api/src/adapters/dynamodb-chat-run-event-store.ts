import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { ChatRunEvent } from "../types.js"
import { tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import type { ChatRunEventStore, CreateChatRunEventInput } from "./chat-run-event-store.js"

export class DynamoDbChatRunEventStore implements ChatRunEventStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async append(tenantId: string, input: CreateChatRunEventInput): Promise<ChatRunEvent> {
    const seq = input.seq ?? await this.nextSeq(tenantId, input.runId)
    const event: ChatRunEvent = {
      ...input,
      seq,
      createdAt: input.createdAt ?? new Date().toISOString()
    }
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(toStored(tenantId, event), { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(runId) AND attribute_not_exists(seq)"
      })
    )
    return event
  }

  async listAfter(tenantId: string, runId: string, afterSeq: number, limit = 50): Promise<ChatRunEvent[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "runId = :runId AND seq > :afterSeq",
        ExpressionAttributeValues: marshall({ ":runId": tenantStorageKey(tenantId, runId), ":afterSeq": afterSeq }),
        Limit: limit,
        ScanIndexForward: true
      })
    )
    return (result.Items ?? []).map((item) => fromStored(unmarshall(item) as StoredChatRunEvent, tenantId, runId))
  }

  private async nextSeq(tenantId: string, runId: string): Promise<number> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "runId = :runId",
        ExpressionAttributeValues: marshall({ ":runId": tenantStorageKey(tenantId, runId) }),
        ProjectionExpression: "seq",
        ScanIndexForward: false,
        Limit: 1
      })
    )
    const latest = result.Items?.[0] ? (unmarshall(result.Items[0]) as Pick<ChatRunEvent, "seq">) : undefined
    return (latest?.seq ?? 0) + 1
  }
}

type StoredChatRunEvent = Omit<ChatRunEvent, "runId"> & {
  runId: string
  rawRunId: string
  tenantPartitionId: string
}

function toStored(tenantId: string, event: ChatRunEvent): StoredChatRunEvent {
  return {
    ...event,
    runId: tenantStorageKey(tenantId, event.runId),
    rawRunId: event.runId,
    tenantPartitionId: tenantPartitionId(tenantId)
  }
}

function fromStored(stored: StoredChatRunEvent, tenantId: string, runId: string): ChatRunEvent {
  if (stored.tenantPartitionId !== tenantPartitionId(tenantId) || stored.rawRunId !== runId) {
    throw new Error("Chat run event tenant storage integrity mismatch")
  }
  const { rawRunId, tenantPartitionId: _tenantPartitionId, ...event } = stored
  return { ...event, runId: rawRunId }
}
