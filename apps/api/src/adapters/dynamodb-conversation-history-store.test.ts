import assert from "node:assert/strict"
import test from "node:test"
import type { QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbConversationHistoryStore } from "./dynamodb-conversation-history-store.js"

test("dynamoConversationHistoryStore_listPaginatesUserPartition", async () => {
  const sent: QueryCommand[] = []
  const store = new DynamoDbConversationHistoryStore("ConversationHistoryTable", { send: async (command: QueryCommand) => {
    sent.push(command)
    if (sent.length === 1) {
      return {
        Items: [marshall(history("conv-1", "2026-05-01T00:00:00.000Z"))],
        LastEvaluatedKey: marshall({ userId: "user-a", id: "conv-1" })
      }
    }
    return { Items: [marshall(history("conv-2", "2026-05-02T00:00:00.000Z"))] }
  } } as never)

  const histories = await store.list("user-a")

  assert.deepEqual(histories.map((item) => item.id), ["conv-2", "conv-1"])
  assert.equal(sent.length, 2)
  assert.deepEqual(sent[1]?.input.ExclusiveStartKey, marshall({ userId: "user-a", id: "conv-1" }))
})

test("conversationHistoryStore_doesNotSliceBeforeFavoriteEnrichment", async () => {
  const store = new DynamoDbConversationHistoryStore("ConversationHistoryTable", { send: async () => ({
    Items: Array.from({ length: 21 }, (_, index) => marshall(history(
      `conv-${index + 1}`,
      `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`
    )))
  }) } as never)

  const histories = await store.list("user-a")

  assert.equal(histories.length, 21)
  assert.equal(histories[0]?.id, "conv-21")
  assert.equal(histories.at(-1)?.id, "conv-1")
})

function history(id: string, updatedAt: string) {
  return {
    schemaVersion: 1,
    userId: "user-a",
    id,
    title: id,
    messages: [],
    isFavorite: false,
    createdAt: updatedAt,
    updatedAt
  }
}
