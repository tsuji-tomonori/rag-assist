import assert from "node:assert/strict"
import test from "node:test"
import { DeleteItemCommand, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbFavoriteStore } from "./dynamodb-favorite-store.js"

test("dynamoFavoriteStore_saveUsesOwnerUserIdAndTargetKey", async () => {
  const sent: unknown[] = []
  const store = new DynamoDbFavoriteStore("FavoritesTable", { send: async (command: unknown) => {
    sent.push(command)
    return { Attributes: marshall(favorite("fav-1", "2026-05-21T00:00:00.000Z")) }
  } } as never)

  await store.save("user-a", { targetType: "document", targetId: "doc-1", label: "Doc 1" })

  const command = sent[0] as UpdateItemCommand
  assert.ok(command instanceof UpdateItemCommand)
  const input = command.input
  assert.equal(input.TableName, "FavoritesTable")
  assert.deepEqual(unmarshall(input.Key ?? {}), { ownerUserId: "user-a", targetKey: "document#doc-1" })
  assert.match(input.UpdateExpression ?? "", /createdAt = if_not_exists\(createdAt, :createdAt\)/)
  assert.match(input.UpdateExpression ?? "", /#label = :label/)
  assert.equal(input.ReturnValues, "ALL_NEW")
})

test("dynamoFavoriteStore_savePreservesCreatedAtAndNoteWhenInputNoteUndefined", async () => {
  const sent: UpdateItemCommand[] = []
  const existing = {
    ...favorite("fav-1", "2026-05-22T00:00:00.000Z"),
    createdAt: "2026-05-01T00:00:00.000Z",
    note: "既存メモ"
  }
  const store = new DynamoDbFavoriteStore("FavoritesTable", { send: async (command: UpdateItemCommand) => {
    sent.push(command)
    return { Attributes: marshall(existing) }
  } } as never)

  const saved = await store.save("user-a", { targetType: "document", targetId: "doc-1" })

  assert.equal(saved.createdAt, "2026-05-01T00:00:00.000Z")
  assert.equal(saved.note, "既存メモ")
  assert.doesNotMatch(sent[0]?.input.UpdateExpression ?? "", /note = :note/)
  assert.doesNotMatch(sent[0]?.input.UpdateExpression ?? "", /#label = :label/)
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

test("dynamoFavoriteStore_listPaginatesOwnerPartition", async () => {
  const sent: QueryCommand[] = []
  const store = new DynamoDbFavoriteStore("FavoritesTable", { send: async (command: QueryCommand) => {
    sent.push(command)
    if (sent.length === 1) {
      return {
        Items: [marshall(favorite("fav-1", "2026-05-01T00:00:00.000Z"))],
        LastEvaluatedKey: marshall({ ownerUserId: "user-a", targetKey: "document#doc-1" })
      }
    }
    return { Items: [marshall(favorite("fav-2", "2026-05-02T00:00:00.000Z", "doc-2"))] }
  } } as never)

  const favorites = await store.list("user-a")

  assert.deepEqual(favorites.map((item) => item.favoriteId), ["fav-2", "fav-1"])
  assert.equal(sent.length, 2)
  assert.deepEqual(sent[1]?.input.ExclusiveStartKey, marshall({ ownerUserId: "user-a", targetKey: "document#doc-1" }))
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

function favorite(favoriteId: string, updatedAt: string, targetId = "doc-1") {
  return {
    favoriteId,
    ownerUserId: "user-a",
    targetKey: `document#${targetId}`,
    targetType: "document",
    targetId,
    label: targetId,
    createdAt: updatedAt,
    updatedAt
  }
}
