import { PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import test from "node:test"
import assert from "node:assert/strict"
import { backfillFavoritesFromConversationHistory } from "./backfill-favorites.js"

class FakeDynamoClient {
  readonly puts: PutItemCommand[] = []
  private scanCount = 0

  constructor(private readonly items: Record<string, unknown>[], private readonly putError?: Error) {}

  async send(command: ScanCommand | PutItemCommand) {
    if (command instanceof ScanCommand) {
      this.scanCount += 1
      return this.scanCount === 1 ? { Items: this.items } : { Items: [] }
    }
    if (command instanceof PutItemCommand) {
      this.puts.push(command)
      if (this.putError) throw this.putError
      return {}
    }
    throw new Error("unexpected command")
  }
}

function historyItem(overrides: Record<string, unknown>) {
  return marshall({
    schemaVersion: 1,
    userId: "user-a",
    id: "conv-1",
    title: "会話",
    updatedAt: "2026-05-21T00:00:00.000Z",
    messages: [],
    ...overrides
  })
}

test("favoriteBackfillCreatesFavoriteForHistoryFavoriteFlag", async () => {
  const client = new FakeDynamoClient([historyItem({ isFavorite: true })])

  const result = await backfillFavoritesFromConversationHistory({
    conversationHistoryTableName: "history",
    favoritesTableName: "favorites",
    client: client as never
  })

  assert.deepEqual(result, { scanned: 1, created: 1, skippedExisting: 0 })
  assert.equal(client.puts.length, 1)
  const put = client.puts[0]
  assert.ok(put)
  const item = unmarshall(put.input.Item!)
  assert.equal(put.input.TableName, "favorites")
  assert.equal(put.input.ConditionExpression, "attribute_not_exists(ownerUserId) AND attribute_not_exists(targetKey)")
  assert.deepEqual(item, {
    favoriteId: "fav-user-a-chatSession-conv-1",
    ownerUserId: "user-a",
    targetKey: "chatSession#conv-1",
    targetType: "chatSession",
    targetId: "conv-1",
    label: "会話",
    createdAt: "2026-05-21T00:00:00.000Z",
    updatedAt: item.updatedAt
  })
})

test("favoriteBackfillIsIdempotent", async () => {
  const first = new FakeDynamoClient([historyItem({ isFavorite: true })])
  const second = new FakeDynamoClient([historyItem({ isFavorite: true })])

  await backfillFavoritesFromConversationHistory({ conversationHistoryTableName: "history", favoritesTableName: "favorites", client: first as never })
  await backfillFavoritesFromConversationHistory({ conversationHistoryTableName: "history", favoritesTableName: "favorites", client: second as never })

  const firstPut = first.puts[0]
  const secondPut = second.puts[0]
  assert.ok(firstPut)
  assert.ok(secondPut)
  const firstItem = unmarshall(firstPut.input.Item!)
  const secondItem = unmarshall(secondPut.input.Item!)
  assert.equal(firstItem.ownerUserId, secondItem.ownerUserId)
  assert.equal(firstItem.targetKey, secondItem.targetKey)
  assert.equal(firstItem.favoriteId, secondItem.favoriteId)
})

test("favoriteBackfillDoesNotCreateFavoriteForFalseFlag", async () => {
  const client = new FakeDynamoClient([
    historyItem({ id: "conv-false", isFavorite: false }),
    historyItem({ id: "conv-missing" })
  ])

  const result = await backfillFavoritesFromConversationHistory({
    conversationHistoryTableName: "history",
    favoritesTableName: "favorites",
    client: client as never
  })

  assert.deepEqual(result, { scanned: 2, created: 0, skippedExisting: 0 })
  assert.equal(client.puts.length, 0)
})

test("favoriteBackfillDoesNotOverwriteExistingFavorite", async () => {
  const conditionalError = Object.assign(new Error("already exists"), { name: "ConditionalCheckFailedException" })
  const client = new FakeDynamoClient([historyItem({ isFavorite: true })], conditionalError)

  const result = await backfillFavoritesFromConversationHistory({
    conversationHistoryTableName: "history",
    favoritesTableName: "favorites",
    client: client as never
  })

  assert.deepEqual(result, { scanned: 1, created: 0, skippedExisting: 1 })
  assert.equal(client.puts.length, 1)
  assert.equal(client.puts[0]?.input.ConditionExpression, "attribute_not_exists(ownerUserId) AND attribute_not_exists(targetKey)")
})

test("favoriteBackfillPropagatesNonConditionalPutErrors", async () => {
  const client = new FakeDynamoClient([historyItem({ isFavorite: true })], Object.assign(new Error("ddb unavailable"), { name: "InternalServerError" }))

  await assert.rejects(() => backfillFavoritesFromConversationHistory({
    conversationHistoryTableName: "history",
    favoritesTableName: "favorites",
    client: client as never
  }), /ddb unavailable/)
})
