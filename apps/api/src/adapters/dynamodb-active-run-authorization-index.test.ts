import assert from "node:assert/strict"
import test from "node:test"
import { QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { tenantPartitionId } from "../security/tenant-partition.js"
import { DynamoDbActiveRunAuthorizationIndex } from "./dynamodb-active-run-authorization-index.js"

test("FR-066 active-run authorization index enumerates one tenant with a strongly consistent base-table Query", async () => {
  const commands: unknown[] = []
  const client = {
    send: async (command: unknown) => {
      commands.push(command)
      if (command instanceof QueryCommand) return {
        Items: [marshall({
          schemaVersion: 1,
          tenantPartitionId: tenantPartitionId("tenant-a"),
          runKey: "chat#run-1",
          tenantId: "tenant-a",
          runKind: "chat",
          runId: "run-1",
          updatedAt: "2026-07-11T00:00:00.000Z"
        })]
      }
      return {}
    }
  } as never
  const index = new DynamoDbActiveRunAuthorizationIndex("ActiveRuns", client)

  assert.deepEqual(await index.listActiveRunIds("tenant-a", "chat"), ["run-1"])
  const query = commands.find((command): command is QueryCommand => command instanceof QueryCommand)
  assert.ok(query)
  assert.equal(query.input.IndexName, undefined)
  assert.equal(query.input.ConsistentRead, true)
  assert.equal(query.input.KeyConditionExpression, "tenantPartitionId = :tenantPartitionId AND begins_with(runKey, :runPrefix)")
  const values = unmarshall(query.input.ExpressionAttributeValues ?? {})
  assert.equal(values[":tenantPartitionId"], tenantPartitionId("tenant-a"))
  assert.equal(values[":runPrefix"], "chat#")
  assert.equal(commands.some((command) => command instanceof ScanCommand), false)
})

test("FR-066 active-run authorization index rejects a cross-tenant row", async () => {
  const index = new DynamoDbActiveRunAuthorizationIndex("ActiveRuns", {
    send: async () => ({
      Items: [marshall({
        schemaVersion: 1,
        tenantPartitionId: tenantPartitionId("tenant-b"),
        runKey: "chat#run-b",
        tenantId: "tenant-b",
        runKind: "chat",
        runId: "run-b",
        updatedAt: "2026-07-11T00:00:00.000Z"
      })]
    })
  } as never)
  await assert.rejects(() => index.listActiveRunIds("tenant-a", "chat"), /integrity mismatch/)
})
