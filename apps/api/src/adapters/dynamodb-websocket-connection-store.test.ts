import assert from "node:assert/strict"
import test from "node:test"
import { DeleteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb"
import { unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbWebSocketConnectionStore } from "./dynamodb-websocket-connection-store.js"

test("connection store conditionally creates a binding and deletes by exact connection ID", async () => {
  const commands: unknown[] = []
  const store = new DynamoDbWebSocketConnectionStore("connections", {
    async send(command) { commands.push(command); return {} }
  })
  await store.connect({
    schemaVersion: 1,
    connectionId: "connection-1",
    userId: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    tokenId: "token-1",
    ticketId: "ticket-id-1",
    connectedAtEpochMs: 1000,
    expiresAtEpochMs: 2000,
    ttl: 2
  })
  await store.disconnect("connection-1")

  assert.ok(commands[0] instanceof PutItemCommand)
  const put = commands[0] as PutItemCommand
  assert.equal(put.input.ConditionExpression, "attribute_not_exists(connectionId)")
  assert.equal(JSON.stringify(unmarshall(put.input.Item!)).includes("memorag-ticket."), false)
  assert.ok(commands[1] instanceof DeleteItemCommand)
  assert.deepEqual(unmarshall((commands[1] as DeleteItemCommand).input.Key!), { connectionId: "connection-1" })
})

test("connection store rejects incomplete or invalid lifecycle records", async () => {
  const store = new DynamoDbWebSocketConnectionStore("connections", { async send() { return {} } })
  await assert.rejects(() => store.connect({
    schemaVersion: 1,
    connectionId: "",
    userId: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    tokenId: "token-1",
    ticketId: "ticket-id-1",
    connectedAtEpochMs: 1000,
    expiresAtEpochMs: 2000,
    ttl: 2
  }))
  await assert.rejects(() => store.disconnect(" "))
})
