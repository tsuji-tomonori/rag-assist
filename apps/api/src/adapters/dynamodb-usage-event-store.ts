import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { createHash } from "node:crypto"
import { config } from "../config.js"
import type { UsageEvent, UsageListQuery } from "../types.js"
import { normalizeUsageQuery, type UsageEventPage, type UsageEventStore } from "./usage-event-store.js"

const PERIOD_INDEX = "tenantId-periodKey-index"

type DynamoCursor = {
  version: 1
  queryFingerprint: string
  lastEvaluatedKey: Record<string, unknown>
}

export class DynamoDbUsageEventStore implements UsageEventStore {
  constructor(
    private readonly tableName: string,
    private readonly client: Pick<DynamoDBClient, "send"> = new DynamoDBClient({ region: config.region })
  ) {}

  async putOnce(event: UsageEvent): Promise<"inserted" | "duplicate"> {
    try {
      await this.client.send(new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({ ...event, periodKey: `${event.occurredAt}#${event.eventId}` }, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(tenantId) AND attribute_not_exists(idempotencyKey)"
      }))
      return "inserted"
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") return "duplicate"
      throw error
    }
  }

  async query(tenantId: string, query: UsageListQuery): Promise<UsageEventPage> {
    const normalized = normalizeUsageQuery(query)
    const fingerprint = queryFingerprint(tenantId, normalized)
    let exclusiveStartKey = decodeCursor(normalized.cursor, fingerprint)
    const events: UsageEvent[] = []
    do {
      const names: Record<string, string> = { "#tenantId": "tenantId", "#periodKey": "periodKey" }
      const values: Record<string, unknown> = {
        ":tenantId": tenantId,
        ":periodStart": `${normalized.periodStart}#`,
        ":periodEnd": `${normalized.periodEnd}#`
      }
      const filters: string[] = []
      for (const [field, value] of [["subjectId", normalized.subjectId], ["runId", normalized.runId], ["modelId", normalized.modelId], ["feature", normalized.feature], ["provider", normalized.provider]] as const) {
        if (!value) continue
        names[`#${field}`] = field
        values[`:${field}`] = value
        filters.push(`#${field} = :${field}`)
      }
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: PERIOD_INDEX,
        KeyConditionExpression: "#tenantId = :tenantId AND #periodKey BETWEEN :periodStart AND :periodEnd",
        FilterExpression: filters.length > 0 ? filters.join(" AND ") : undefined,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values),
        ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey, { removeUndefinedValues: true }) : undefined,
        Limit: Math.max(1, normalized.limit - events.length)
      }))
      events.push(...(result.Items ?? []).map((item) => {
        const { periodKey: _periodKey, ...event } = unmarshall(item) as UsageEvent & { periodKey: string }
        return event
      }))
      exclusiveStartKey = result.LastEvaluatedKey ? unmarshall(result.LastEvaluatedKey) : undefined
    } while (exclusiveStartKey && events.length < normalized.limit)
    const page = events.slice(0, normalized.limit)
    return {
      events: page,
      nextCursor: exclusiveStartKey ? encodeCursor(exclusiveStartKey, fingerprint) : undefined,
      truncated: Boolean(exclusiveStartKey),
      asOf: new Date().toISOString()
    }
  }
}

function queryFingerprint(tenantId: string, query: UsageListQuery): string {
  return createHash("sha256").update(JSON.stringify({ tenantId, ...query, cursor: undefined })).digest("hex")
}

function encodeCursor(lastEvaluatedKey: Record<string, unknown>, queryFingerprint: string): string {
  const cursor: DynamoCursor = { version: 1, queryFingerprint, lastEvaluatedKey }
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCursor(cursor: string | undefined, queryFingerprint: string): Record<string, unknown> | undefined {
  if (!cursor) return undefined
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<DynamoCursor>
    if (value.version !== 1 || value.queryFingerprint !== queryFingerprint || !value.lastEvaluatedKey) throw new Error("Invalid usage cursor")
    return value.lastEvaluatedKey
  } catch {
    throw new Error("Invalid usage cursor")
  }
}

export { PERIOD_INDEX as USAGE_EVENT_PERIOD_INDEX }
