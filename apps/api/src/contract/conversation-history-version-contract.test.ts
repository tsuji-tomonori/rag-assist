import assert from "node:assert/strict"
import test from "node:test"
import {
  normalizeConversationHistoryInput,
  normalizeStoredConversationHistoryItem
} from "../adapters/conversation-history-store.js"
import { ConversationHistoryItemSchema } from "../schemas.js"
import {
  CONVERSATION_HISTORY_LEGACY_SCHEMA_VERSION,
  CONVERSATION_HISTORY_SCHEMA_VERSION
} from "../types.js"

const baseItem = {
  id: "conversation-1",
  title: "会話",
  updatedAt: "2026-07-17T00:00:00.000Z",
  isFavorite: false,
  messages: [{ role: "user" as const, text: "質問", createdAt: "2026-07-17T00:00:00.000Z" }]
}

test("FR-022 API write contract defaults new items to current v2 and rejects unknown versions", () => {
  assert.equal(ConversationHistoryItemSchema.parse(baseItem).schemaVersion, CONVERSATION_HISTORY_SCHEMA_VERSION)
  assert.equal(ConversationHistoryItemSchema.parse({ ...baseItem, schemaVersion: 1 }).schemaVersion, 1)
  assert.equal(ConversationHistoryItemSchema.parse({ ...baseItem, schemaVersion: 2 }).schemaVersion, 2)
  assert.equal(ConversationHistoryItemSchema.safeParse({ ...baseItem, schemaVersion: 3 }).success, false)
})

test("FR-022 persisted read contract treats a missing version as legacy v1 and preserves explicit versions", () => {
  assert.equal(
    normalizeStoredConversationHistoryItem(baseItem).schemaVersion,
    CONVERSATION_HISTORY_LEGACY_SCHEMA_VERSION
  )
  assert.equal(normalizeStoredConversationHistoryItem({ ...baseItem, schemaVersion: 1 }).schemaVersion, 1)
  assert.equal(normalizeStoredConversationHistoryItem({ ...baseItem, schemaVersion: 2 }).schemaVersion, 2)
  assert.throws(
    () => normalizeStoredConversationHistoryItem({ ...baseItem, schemaVersion: 3 }),
    /Unsupported conversation history schema version: 3/
  )
})

test("FR-022 write-time migration promotes missing and explicit v1 items to v2 without losing data", () => {
  for (const schemaVersion of [undefined, 1, 2] as const) {
    const input = {
      ...baseItem,
      schemaVersion,
      rollingSummary: "既存要約"
    }
    const normalized = normalizeConversationHistoryInput(input)
    assert.equal(normalized.schemaVersion, CONVERSATION_HISTORY_SCHEMA_VERSION)
    assert.equal(normalized.messages[0]?.text, "質問")
    assert.equal(normalized.rollingSummary, "既存要約")
  }

  assert.throws(
    () => normalizeConversationHistoryInput({ ...baseItem, schemaVersion: 3 as never }),
    /Unsupported conversation history schema version: 3/
  )
})
