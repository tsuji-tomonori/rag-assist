import { DynamoDBClient, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { UsageEvent } from "../types.js"
import type { UsageEventStore } from "./usage-event-store.js"

export class DynamoDbUsageEventStore implements UsageEventStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async putOnce(event: UsageEvent): Promise<void> {
    try {
      await this.client.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: marshall(event, { removeUndefinedValues: true }),
          ConditionExpression: "attribute_not_exists(idempotencyKey)"
        })
      )
    } catch (error) {
      if (isConditionalCheckFailed(error)) return
      throw error
    }
  }

  async list(limit = 1000): Promise<UsageEvent[]> {
    const events: UsageEvent[] = []
    let exclusiveStartKey: Record<string, unknown> | undefined
    do {
      const result = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey, { removeUndefinedValues: true }) : undefined
        })
      )
      events.push(...(result.Items ?? []).map((item) => unmarshall(item) as UsageEvent))
      exclusiveStartKey = result.LastEvaluatedKey ? unmarshall(result.LastEvaluatedKey) : undefined
    } while (exclusiveStartKey && events.length < limit)
    return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
  }
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (error as { name?: string }).name === "ConditionalCheckFailedException"
}
