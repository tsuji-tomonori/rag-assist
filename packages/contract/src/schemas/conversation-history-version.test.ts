import assert from "node:assert/strict"
import test from "node:test"
import { ConversationHistoryItemSchema } from "./chat.js"

const item = {
  id: "conversation-1",
  title: "会話",
  updatedAt: "2026-07-17T00:00:00.000Z",
  messages: [{ role: "user", text: "質問", createdAt: "2026-07-17T00:00:00.000Z" }]
}

test("FR-022 shared wire contract uses v2 for new items and accepts only v1/v2", () => {
  assert.equal(ConversationHistoryItemSchema.parse(item).schemaVersion, 2)
  assert.equal(ConversationHistoryItemSchema.parse({ ...item, schemaVersion: 1 }).schemaVersion, 1)
  assert.equal(ConversationHistoryItemSchema.parse({ ...item, schemaVersion: 2 }).schemaVersion, 2)
  assert.equal(ConversationHistoryItemSchema.safeParse({ ...item, schemaVersion: 3 }).success, false)
})
