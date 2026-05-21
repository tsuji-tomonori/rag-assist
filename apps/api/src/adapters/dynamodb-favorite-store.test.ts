import assert from "node:assert/strict"
import test from "node:test"
import { DeleteItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbFavoriteStore } from "./dynamodb-favorite-store.js"

test("dynamoFavoriteStore_saveUsesOwnerUserIdAndTargetKey", async () => {
  const sent: unknown[] = []
  const store = new DynamoDbFavoriteStore("FavoritesTable", { send: async (command: unknown) => {
    sent.push(command)
    return {}
  } } as never)

  await store.save("user-a", { targetType: "document", targetId: "doc-1", label: "Doc 1" })

  const command = sent[0] as PutItemCommand
  assert.ok(command instanceof PutItemCommand)
  const input = command.input
  assert.equal(input.TableName, "FavoritesTable")
  const item = unmarshall(input.Item ?? {})
  assert.equal(item.ownerUserId, "user-a")
  assert.equal(item.targetKey, "document#doc-1")
  assert.equal(item.targetType, "document")
  assert.equal(item.targetId, "doc-1")
})

test("dynamoFavoriteStore_listQueriesOnlyOwnerPartition", async () => {
  const sent: unknown[] = []
  const store = new DynamoDbFavoriteStore("FavoritesTable", { send: async (command: unknown) => {
    sent.push(command)
    return { Items: [] }
  } } as never)

  await store.list("user-a")

  const command = sent[0] as QueryCommand
  assert.ok(command instanceof QueryCommand)
  assert.equal(command.input.KeyConditionExpression, "ownerUserId = :ownerUserId")
})

test("dynamoFavoriteStore_deleteRemovesOnlyFavoriteItem", async () => {
  const sent: unknown[] = []
  const store = new DynamoDbFavoriteStore("FavoritesTable", { send: async (command: unknown) => {
    sent.push(command)
    return {}
  } } as never)

  await store.delete("user-a", "document", "doc-1")

  const command = sent[0] as DeleteItemCommand
  assert.ok(command instanceof DeleteItemCommand)
  assert.deepEqual(unmarshall(command.input.Key ?? {}), { ownerUserId: "user-a", targetKey: "document#doc-1" })
})
