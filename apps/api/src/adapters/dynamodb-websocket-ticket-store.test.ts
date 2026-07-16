import assert from "node:assert/strict"
import test from "node:test"
import { PutItemCommand, type UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbWebSocketTicketStore } from "./dynamodb-websocket-ticket-store.js"
import type { WebSocketTicketRecord } from "./websocket-ticket-store.js"

const now = 1_783_728_000_000

test("DynamoDB ticket issue uses a unique hash key and never stores raw ticket", async () => {
  const commands: unknown[] = []
  const store = new DynamoDbWebSocketTicketStore("tickets", { async send(command) { commands.push(command); return {} } })
  await store.issue(record({ state: "issued", consumedAtEpochMs: undefined }))
  assert.equal(commands.length, 1)
  const command = commands[0]
  assert.ok(command instanceof PutItemCommand)
  assert.equal(command.input.ConditionExpression, "attribute_not_exists(ticketHash)")
  const stored = unmarshall(command.input.Item!)
  assert.equal(stored.ticketHash, "a".repeat(64))
  assert.equal(JSON.stringify(stored).includes("memorag-ticket."), false)
})

test("DynamoDB ticket consume is atomic and returns the consumed record", async () => {
  let command: UpdateItemCommand | undefined
  const consumed = record()
  const store = new DynamoDbWebSocketTicketStore("tickets", {
    async send(value) {
      command = value as UpdateItemCommand
      return { Attributes: marshall(consumed) }
    }
  })
  assert.deepEqual(await store.consume("a".repeat(64), now), consumed)
  assert.ok(command)
  assert.match(command.input.ConditionExpression!, /#state = :issued/)
  assert.match(command.input.ConditionExpression!, /expiresAtEpochMs > :now/)
  assert.match(command.input.ConditionExpression!, /tokenExpiresAtEpochMs > :now/)
  assert.equal(command.input.ReturnValues, "ALL_NEW")
})

test("DynamoDB ticket consume/revoke maps conditional failures without reopening a ticket", async () => {
  const conditionalClient = {
    async send() {
      const error = new Error("conditional")
      error.name = "ConditionalCheckFailedException"
      throw error
    }
  }
  const store = new DynamoDbWebSocketTicketStore("tickets", conditionalClient)
  assert.equal(await store.consume("a".repeat(64), now), undefined)
  assert.equal(await store.revoke("a".repeat(64), now), false)
})

test("DynamoDB ticket revoke transitions only an issued ticket", async () => {
  let command: UpdateItemCommand | undefined
  const store = new DynamoDbWebSocketTicketStore("tickets", {
    async send(value) { command = value as UpdateItemCommand; return {} }
  })
  assert.equal(await store.revoke("a".repeat(64), now), true)
  assert.ok(command)
  assert.equal(command.input.ConditionExpression, "#state = :issued")
  assert.match(command.input.UpdateExpression!, /#state = :revoked/)
})

function record(overrides: Partial<WebSocketTicketRecord> = {}): WebSocketTicketRecord {
  const expiresAtEpochMs = now + 60_000
  return {
    schemaVersion: 1,
    ticketHash: "a".repeat(64),
    ticketId: "ticket-id-1",
    state: "consumed",
    userId: "user-1",
    identityUsername: "cognito-user",
    tenantId: "tenant-1",
    sessionId: "session-1",
    tokenId: "token-1",
    tokenIssuedAtEpochMs: now - 60_000,
    tokenExpiresAtEpochMs: now + 3_600_000,
    issuedAtEpochMs: now,
    expiresAtEpochMs,
    consumedAtEpochMs: now,
    ttl: Math.ceil(expiresAtEpochMs / 1000),
    ...overrides
  }
}
