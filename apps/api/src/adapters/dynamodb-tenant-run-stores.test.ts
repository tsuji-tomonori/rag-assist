import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import type { BenchmarkRun, ChatRun, DocumentIngestRun } from "../types.js"
import { DynamoDbBenchmarkRunStore } from "./dynamodb-benchmark-run-store.js"
import { DynamoDbChatRunEventStore } from "./dynamodb-chat-run-event-store.js"
import { DynamoDbChatRunStore } from "./dynamodb-chat-run-store.js"
import { LocalChatRunStore } from "./local-chat-run-store.js"
import { DynamoDbDocumentIngestRunEventStore } from "./dynamodb-document-ingest-run-event-store.js"
import { DynamoDbDocumentIngestRunStore } from "./dynamodb-document-ingest-run-store.js"

test("DynamoDB run stores persist tenant composite keys for identical raw IDs", async () => {
  const chatCommands: unknown[] = []
  const ingestCommands: unknown[] = []
  const benchmarkCommands: unknown[] = []
  const chatStore = new DynamoDbChatRunStore("ChatRuns", captureClient(chatCommands))
  const ingestStore = new DynamoDbDocumentIngestRunStore("IngestRuns", captureClient(ingestCommands))
  const benchmarkStore = new DynamoDbBenchmarkRunStore("BenchmarkRuns", captureClient(benchmarkCommands))

  for (const tenantId of ["tenant-a", "tenant-b"]) {
    await chatStore.create(chatRun(tenantId))
    await ingestStore.create(ingestRun(tenantId))
    await benchmarkStore.create(benchmarkRun(tenantId))
  }

  assertTenantPutKeys(chatCommands, "chatRun#same-run")
  assertTenantPutKeys(ingestCommands, "documentIngestRun#same-run")
  assertTenantPutKeys(benchmarkCommands, "benchmarkRun#2026-07-11T00:00:00.000Z#same-run")
})

test("DynamoDB benchmark list uses TenantItemIndex Query and never Scan", async () => {
  const commands: unknown[] = []
  const store = new DynamoDbBenchmarkRunStore("BenchmarkRuns", captureClient(commands, { Items: [] }))

  assert.deepEqual(await store.list("tenant-a", 25), [])

  const query = commands.find((command): command is QueryCommand => command instanceof QueryCommand)
  assert.ok(query)
  assert.equal(query.input.IndexName, "TenantItemIndex")
  assert.equal(query.input.KeyConditionExpression, "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)")
  const values = unmarshall(query.input.ExpressionAttributeValues ?? {})
  assert.equal(values[":tenantPartitionId"], tenantPartitionId("tenant-a"))
  assert.equal(values[":itemPrefix"], "benchmarkRun#")
  assert.equal(commands.some((command) => command instanceof ScanCommand), false)
})

test("FR-090 chat worker reads only its authorization envelope before a status-CAS claim", async () => {
  const commands: unknown[] = []
  const stored = {
    ...chatRun("tenant-a"),
    runId: tenantStorageKey("tenant-a", "same-run"),
    rawRunId: "same-run",
    tenantPartitionId: tenantPartitionId("tenant-a"),
    tenantItemId: "chatRun#same-run"
  }
  const store = new DynamoDbChatRunStore("ChatRuns", {
    send: async (command: unknown) => {
      commands.push(command)
      if (command instanceof GetItemCommand) return { Item: marshall(stored, { removeUndefinedValues: true }) }
      return {}
    }
  } as never)

  const envelope = await store.getExecutionEnvelope("tenant-a", "same-run")
  assert.equal(envelope?.status, "queued")
  assert.equal("question" in (envelope ?? {}), false)
  assert.equal(await store.updateIfStatus("tenant-a", "same-run", "queued", { status: "running" }), true)

  const projectedRead = commands.find((command): command is GetItemCommand => command instanceof GetItemCommand)
  assert.ok(projectedRead?.input.ProjectionExpression)
  assert.equal(Object.values(projectedRead.input.ExpressionAttributeNames ?? {}).includes("question"), false)
  assert.equal(Object.values(projectedRead.input.ExpressionAttributeNames ?? {}).includes("conversationHistory"), false)
  const claim = commands.find((command): command is UpdateItemCommand => command instanceof UpdateItemCommand)
  assert.equal(claim?.input.ConditionExpression, "#status = :expectedStatus")
  assert.equal(unmarshall(claim?.input.ExpressionAttributeValues ?? {})[":expectedStatus"], "queued")
  assert.equal(claim?.input.ReturnValues, "NONE")
})

test("FR-090 local chat worker claim allows exactly one concurrent queued-to-running transition", async () => {
  const store = new LocalChatRunStore(await mkdtemp(path.join(os.tmpdir(), "chat-run-cas-")))
  await store.create(chatRun("tenant-a"))
  const outcomes = await Promise.all([
    store.updateIfStatus("tenant-a", "same-run", "queued", { status: "running" }),
    store.updateIfStatus("tenant-a", "same-run", "queued", { status: "running" })
  ])
  assert.deepEqual([...outcomes].sort(), [false, true])
  assert.equal((await store.get("tenant-a", "same-run"))?.status, "running")
})

test("DynamoDB run event stores partition identical raw run IDs by tenant and query only the physical key", async () => {
  const chatCommands: unknown[] = []
  const ingestCommands: unknown[] = []
  const chatEvents = new DynamoDbChatRunEventStore("ChatRunEvents", captureClient(chatCommands, { Items: [] }))
  const ingestEvents = new DynamoDbDocumentIngestRunEventStore("IngestRunEvents", captureClient(ingestCommands, { Items: [] }))

  for (const tenantId of ["tenant-a", "tenant-b"]) {
    await chatEvents.append(tenantId, { runId: "same-run", seq: 1, type: "status", message: tenantId })
    await ingestEvents.append(tenantId, { runId: "same-run", seq: 1, type: "status", message: tenantId })
    await chatEvents.listAfter(tenantId, "same-run", 0)
    await ingestEvents.listAfter(tenantId, "same-run", 0)
  }

  assertEventCommands(chatCommands)
  assertEventCommands(ingestCommands)
})

function captureClient(commands: unknown[], response: unknown = {}) {
  return {
    send: async (command: unknown) => {
      commands.push(command)
      return response
    }
  } as never
}

function assertTenantPutKeys(commands: unknown[], tenantItemId: string): void {
  const items = commands
    .filter((command): command is PutItemCommand => command instanceof PutItemCommand)
    .map((command) => unmarshall(command.input.Item ?? {}))
  assert.equal(items.length, 2)
  assert.deepEqual(items.map((item) => item.rawRunId), ["same-run", "same-run"])
  assert.deepEqual(items.map((item) => item.runId), [
    tenantStorageKey("tenant-a", "same-run"),
    tenantStorageKey("tenant-b", "same-run")
  ])
  assert.deepEqual(items.map((item) => item.tenantPartitionId), [
    tenantPartitionId("tenant-a"),
    tenantPartitionId("tenant-b")
  ])
  assert.deepEqual(items.map((item) => item.tenantItemId), [tenantItemId, tenantItemId])
  assert.notEqual(items[0]?.runId, items[1]?.runId)
}

function assertEventCommands(commands: unknown[]): void {
  const items = commands
    .filter((command): command is PutItemCommand => command instanceof PutItemCommand)
    .map((command) => unmarshall(command.input.Item ?? {}))
  assert.deepEqual(items.map((item) => item.runId), [
    tenantStorageKey("tenant-a", "same-run"),
    tenantStorageKey("tenant-b", "same-run")
  ])
  assert.deepEqual(items.map((item) => item.rawRunId), ["same-run", "same-run"])
  const queryKeys = commands
    .filter((command): command is QueryCommand => command instanceof QueryCommand)
    .map((command) => unmarshall(command.input.ExpressionAttributeValues ?? {})[":runId"])
  assert.deepEqual(queryKeys, [
    tenantStorageKey("tenant-a", "same-run"),
    tenantStorageKey("tenant-b", "same-run")
  ])
  assert.equal(commands.some((command) => command instanceof ScanCommand), false)
}

function chatRun(tenantId: string): ChatRun {
  return {
    runId: "same-run",
    tenantId,
    status: "queued",
    createdBy: "user",
    question: "question",
    modelId: "model",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function ingestRun(tenantId: string): DocumentIngestRun {
  return {
    runId: "same-run",
    tenantId,
    status: "queued",
    createdBy: "user",
    uploadId: "upload",
    objectKey: "upload.txt",
    purpose: "document",
    fileName: "upload.txt",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function benchmarkRun(tenantId: string): BenchmarkRun {
  return {
    runId: "same-run",
    tenantId,
    status: "queued",
    mode: "agent",
    runner: "codebuild",
    suiteId: "suite",
    datasetS3Key: "dataset.jsonl",
    createdBy: "user",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}
