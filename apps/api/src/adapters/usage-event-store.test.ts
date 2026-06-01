import assert from "node:assert/strict"
import test from "node:test"
import { PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbUsageEventStore } from "./dynamodb-usage-event-store.js"
import { InMemoryUsageEventStore } from "./usage-event-store.js"
import type { UsageEvent } from "../types.js"

const baseEvent: UsageEvent = {
  eventId: "event-1",
  tenantId: "default",
  userId: "user-1",
  feature: "rag.generate_answer",
  provider: "bedrock",
  modelId: "model-a",
  inputTokens: 100,
  outputTokens: 20,
  totalTokens: 120,
  tokenSource: "provider_usage",
  usageConfidence: "actual",
  pricingVersion: "v1",
  estimatedCostUsd: 0.000128,
  status: "succeeded",
  idempotencyKey: "run-1:finalAnswer:abc",
  createdAt: "2026-06-01T00:00:00.000Z"
}

test("in-memory usage event store deduplicates by idempotency key", async () => {
  const store = new InMemoryUsageEventStore()

  await store.putOnce(baseEvent)
  await store.putOnce({ ...baseEvent, eventId: "event-2" })

  assert.equal((await store.list()).length, 1)
})

test("dynamodb usage event store writes with idempotency key condition and lists events", async () => {
  const sent: unknown[] = []
  const client = {
    async send(command: unknown) {
      sent.push(command)
      if (command instanceof ScanCommand) {
        return { Items: [marshall(baseEvent, { removeUndefinedValues: true })] }
      }
      return {}
    }
  }
  const store = new DynamoDbUsageEventStore("usage-table", client as never)

  await store.putOnce(baseEvent)
  const events = await store.list()

  assert.equal(sent[0] instanceof PutItemCommand, true)
  assert.equal((sent[0] as PutItemCommand).input.ConditionExpression, "attribute_not_exists(idempotencyKey)")
  assert.deepEqual(events, [baseEvent])
})

test("dynamodb usage event store treats conditional failures as duplicate writes", async () => {
  const client = {
    async send(command: unknown) {
      if (command instanceof PutItemCommand) {
        const error = new Error("duplicate") as Error & { name: string }
        error.name = "ConditionalCheckFailedException"
        throw error
      }
      return {}
    }
  }
  const store = new DynamoDbUsageEventStore("usage-table", client as never)

  await store.putOnce(baseEvent)
})
