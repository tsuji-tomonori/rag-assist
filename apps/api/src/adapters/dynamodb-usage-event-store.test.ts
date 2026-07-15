import assert from "node:assert/strict"
import test from "node:test"
import type { PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbUsageEventStore, USAGE_EVENT_PERIOD_INDEX } from "./dynamodb-usage-event-store.js"
import type { UsageEvent } from "../types.js"

test("Dynamo usage store creates tenant-scoped idempotent events conditionally", async () => {
  const sent: PutItemCommand[] = []
  const store = new DynamoDbUsageEventStore("UsageEvents", { send: async (command: PutItemCommand) => {
    sent.push(command)
    if (sent.length === 2) throw Object.assign(new Error("duplicate"), { name: "ConditionalCheckFailedException" })
    return {}
  } } as never)

  assert.equal(await store.putOnce(event("event-1")), "inserted")
  assert.equal(await store.putOnce(event("event-1")), "duplicate")
  assert.equal(sent[0]?.constructor.name, "PutItemCommand")
  assert.equal(sent[0]?.input.ConditionExpression, "attribute_not_exists(tenantId) AND attribute_not_exists(idempotencyKey)")
  const item = unmarshall(sent[0]!.input.Item!)
  assert.equal(item.tenantId, "tenant-a")
  assert.equal(item.idempotencyKey, "run-1:0")
  assert.equal(item.periodKey, "2026-07-15T00:00:00.000Z#event-1")
})

test("Dynamo usage store uses tenant-period Query pagination without Scan or filtered-page loss", async () => {
  const sent: QueryCommand[] = []
  const firstKey = { tenantId: { S: "tenant-a" }, idempotencyKey: { S: "filtered-1" }, periodKey: { S: "2026-07-15T00:00:01.000Z#filtered-1" } }
  const secondKey = { tenantId: { S: "tenant-a" }, idempotencyKey: { S: "event-2" }, periodKey: { S: "2026-07-15T00:00:02.000Z#event-2" } }
  const store = new DynamoDbUsageEventStore("UsageEvents", { send: async (command: QueryCommand) => {
    sent.push(command)
    if (sent.length === 1) return { Items: [], LastEvaluatedKey: firstKey }
    if (sent.length === 2) return {
      Items: [marshall({ ...event("event-2", { subjectId: "subject-a", occurredAt: "2026-07-15T00:00:02.000Z" }), periodKey: "2026-07-15T00:00:02.000Z#event-2" })],
      LastEvaluatedKey: secondKey
    }
    return {
      Items: [marshall({ ...event("event-3", { subjectId: "subject-a", occurredAt: "2026-07-15T00:00:03.000Z" }), periodKey: "2026-07-15T00:00:03.000Z#event-3" })]
    }
  } } as never)

  const first = await store.query("tenant-a", {
    periodStart: "2026-07-15T00:00:00.000Z",
    periodEnd: "2026-07-16T00:00:00.000Z",
    subjectId: "subject-a",
    limit: 1
  })
  assert.deepEqual(first.events.map((item) => item.eventId), ["event-2"])
  assert.equal(first.truncated, true)
  assert.ok(first.nextCursor)
  assert.equal(sent.length, 2, "filtered empty Dynamo pages must be traversed until a result or terminal key")
  for (const command of sent) {
    assert.equal(command.constructor.name, "QueryCommand")
    assert.equal(command.input.IndexName, USAGE_EVENT_PERIOD_INDEX)
    assert.equal(command.input.KeyConditionExpression, "#tenantId = :tenantId AND #periodKey BETWEEN :periodStart AND :periodEnd")
    assert.equal(command.input.FilterExpression, "#subjectId = :subjectId")
    assert.equal(unmarshall(command.input.ExpressionAttributeValues!)[":tenantId"], "tenant-a")
  }

  const second = await store.query("tenant-a", {
    periodStart: "2026-07-15T00:00:00.000Z",
    periodEnd: "2026-07-16T00:00:00.000Z",
    subjectId: "subject-a",
    limit: 1,
    cursor: first.nextCursor
  })
  assert.deepEqual(second.events.map((item) => item.eventId), ["event-3"])
  assert.equal(second.truncated, false)
  assert.deepEqual(sent[2]?.input.ExclusiveStartKey, secondKey)
})

test("Dynamo usage cursor is bound to the tenant and normalized query", async () => {
  const key = { tenantId: { S: "tenant-a" }, idempotencyKey: { S: "event-1" }, periodKey: { S: "2026-07-15T00:00:00.000Z#event-1" } }
  const store = new DynamoDbUsageEventStore("UsageEvents", { send: async () => ({
    Items: [marshall({ ...event("event-1"), periodKey: "2026-07-15T00:00:00.000Z#event-1" })],
    LastEvaluatedKey: key
  }) } as never)
  const query = { periodStart: "2026-07-15T00:00:00.000Z", periodEnd: "2026-07-16T00:00:00.000Z", limit: 1 }
  const first = await store.query("tenant-a", query)
  await assert.rejects(() => store.query("tenant-b", { ...query, cursor: first.nextCursor }), /Invalid usage cursor/)
  await assert.rejects(() => store.query("tenant-a", { ...query, provider: "bedrock", cursor: first.nextCursor }), /Invalid usage cursor/)
})

function event(eventId: string, overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    schemaVersion: 1,
    eventId,
    tenantId: "tenant-a",
    subjectId: "subject-a",
    runId: "run-1",
    feature: "chat",
    provider: "bedrock",
    region: "ap-northeast-1",
    modelId: "model-a",
    quantities: [{ unit: "input_token", value: 10, source: "provider" }],
    status: "succeeded",
    idempotencyKey: "run-1:0",
    occurredAt: "2026-07-15T00:00:00.000Z",
    recordedAt: "2026-07-15T00:00:01.000Z",
    ...overrides
  }
}
