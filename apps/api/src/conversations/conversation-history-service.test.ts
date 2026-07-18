import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { normalizeConversationHistoryInput, type SaveConversationHistoryInput } from "../adapters/conversation-history-store.js"
import type { FavoriteItem, ConversationHistoryItem } from "../types.js"
import { ConversationHistoryService, type ConversationHistoryServiceDependencies } from "./conversation-history-service.js"

test("save resolves the session context before saving the canonical non-favorite projection", async () => {
  const fixture = createFixture()
  const input = historyInput("conversation-1", "2026-07-18T01:00:00.000Z")
  const context = {
    schemaVersion: 1 as const,
    sessionId: input.id,
    temporaryEvidence: [],
    updatedAt: "2026-07-18T01:01:00.000Z"
  }
  fixture.resolveSessionDocumentContext = async (_subject, _input, ownerKey) => {
    fixture.calls.push(`resolve:${ownerKey}`)
    return context
  }

  const saved = await fixture.service().save("user-1", { ...input, isFavorite: true }, "tenant-1")

  assert.deepEqual(fixture.calls, [
    "owner:user-1:tenant-1",
    "resolve:tenant:tenant-1:user:user-1",
    "save:tenant:tenant-1:user:user-1"
  ])
  assert.equal(saved.isFavorite, false)
  assert.deepEqual(saved.sessionDocumentContext, context)
})

test("save stops before the store when session context authorization fails", async () => {
  const fixture = createFixture()
  fixture.resolveSessionDocumentContext = async () => {
    fixture.calls.push("resolve:denied")
    throw new Error("Forbidden")
  }

  await assert.rejects(
    fixture.service().save("user-1", historyInput("conversation-1", "2026-07-18T01:00:00.000Z"), "tenant-1"),
    /Forbidden/
  )
  assert.deepEqual(fixture.calls, ["owner:user-1:tenant-1", "resolve:denied"])
})

test("list normalizes, projects chat-session favorites, sorts, and limits to 20 in one owner partition", async () => {
  const fixture = createFixture()
  fixture.history = Array.from({ length: 21 }, (_, index) => historyInput(
    `conversation-${index + 1}`,
    `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`
  ))
  fixture.favorites = [favorite("conversation-1"), favorite("document-1", "document")]

  const result = await fixture.service().list("user-1", "tenant-1")

  assert.equal(result.length, 20)
  assert.equal(result[0]?.id, "conversation-1")
  assert.equal(result[0]?.isFavorite, true)
  assert.equal(result.some((item) => item.id === "conversation-2"), false)
  assert.equal(fixture.normalizedIds.length, 21)
  assert.deepEqual(fixture.calls.slice(0, 3), [
    "owner:user-1:tenant-1",
    "list:tenant:tenant-1:user:user-1",
    "favorites:tenant:tenant-1:user:user-1"
  ])
})

test("get stays in the owner partition and normalizes only existing history", async () => {
  const fixture = createFixture()
  fixture.history = [historyInput("existing", "2026-07-18T01:00:00.000Z")]

  assert.equal((await fixture.service().get("user-1", "existing", "tenant-1"))?.schemaVersion, 3)
  assert.equal(await fixture.service().get("user-2", "missing", "tenant-1"), undefined)
  assert.deepEqual(fixture.normalizedIds, ["existing"])
  assert.equal(fixture.calls.includes("get:tenant:tenant-1:user:user-1:existing"), true)
  assert.equal(fixture.calls.includes("get:tenant:tenant-1:user:user-2:missing"), true)
})

test("delete uses get-before-delete, returns false for missing, and propagates delete failure", async () => {
  const fixture = createFixture()
  fixture.history = [historyInput("existing", "2026-07-18T01:00:00.000Z")]

  assert.equal(await fixture.service().delete("user-1", "missing", "tenant-1"), false)
  assert.equal(fixture.calls.some((call) => call.endsWith(":missing") && call.startsWith("delete:")), false)

  fixture.deleteError = new Error("delete failed")
  await assert.rejects(fixture.service().delete("user-1", "existing", "tenant-1"), /delete failed/)
  assert.deepEqual(fixture.calls.slice(-2), [
    "get:tenant:tenant-1:user:user-1:existing",
    "delete:tenant:tenant-1:user:user-1:existing"
  ])
})

test("MemoRagService delegates four history operations while retaining the session authorization resolver", () => {
  const source = readFileSync(new URL("../rag/memorag-service.ts", import.meta.url), "utf8")
  assert.match(source, /this\.conversationHistoryService\.save\(subject, input, tenantId\)/)
  assert.match(source, /this\.conversationHistoryService\.list\(subject, tenantId\)/)
  assert.match(source, /this\.conversationHistoryService\.get\(subject, id, tenantId\)/)
  assert.match(source, /this\.conversationHistoryService\.delete\(subject, id, tenantId\)/)
  assert.match(source, /resolveSessionDocumentContext: \(subject, input, ownerKey\) => this\.resolveSessionDocumentContext\(subject, input, ownerKey\)/)
})

function createFixture() {
  type Fixture = {
    calls: string[]
    history: SaveConversationHistoryInput[]
    favorites: FavoriteItem[]
    normalizedIds: string[]
    deleteError: Error | undefined
    resolveSessionDocumentContext: ConversationHistoryServiceDependencies["resolveSessionDocumentContext"]
    dependencies: () => ConversationHistoryServiceDependencies
    service: () => ConversationHistoryService
  }
  const fixture: Fixture = {
    calls: [] as string[],
    history: [] as SaveConversationHistoryInput[],
    favorites: [] as FavoriteItem[],
    normalizedIds: [] as string[],
    deleteError: undefined as Error | undefined,
    resolveSessionDocumentContext: async () => undefined as ConversationHistoryItem["sessionDocumentContext"],
    dependencies: () => ({
      ownerKey: (subject, tenantId) => {
        const userId = typeof subject === "string" ? subject : subject.userId
        fixture.calls.push(`owner:${userId}:${tenantId ?? ""}`)
        return `tenant:${tenantId}:user:${userId}`
      },
      resolveSessionDocumentContext: (...args) => fixture.resolveSessionDocumentContext(...args),
      normalize: (input) => {
        fixture.normalizedIds.push(input.id)
        return normalizeConversationHistoryInput(input)
      },
      compareForDisplay: compareForDisplay,
      conversationHistoryStore: {
        save: async (ownerKey, input) => {
          fixture.calls.push(`save:${ownerKey}`)
          return normalizeConversationHistoryInput(input)
        },
        list: async (ownerKey) => {
          fixture.calls.push(`list:${ownerKey}`)
          return fixture.history.map(normalizeConversationHistoryInput)
        },
        get: async (ownerKey, id) => {
          fixture.calls.push(`get:${ownerKey}:${id}`)
          const item = fixture.history.find((candidate) => candidate.id === id)
          return item ? normalizeConversationHistoryInput(item) : undefined
        },
        delete: async (ownerKey, id) => {
          fixture.calls.push(`delete:${ownerKey}:${id}`)
          if (fixture.deleteError) throw fixture.deleteError
        }
      },
      favoriteStore: {
        list: async (ownerKey) => {
          fixture.calls.push(`favorites:${ownerKey}`)
          return fixture.favorites
        }
      }
    }),
    service: () => new ConversationHistoryService(fixture.dependencies())
  }
  return fixture
}

function historyInput(id: string, updatedAt: string): SaveConversationHistoryInput {
  return { id, title: id, updatedAt, messages: [] }
}

function favorite(targetId: string, targetType: FavoriteItem["targetType"] = "chatSession"): FavoriteItem {
  return {
    favoriteId: `favorite-${targetId}`,
    ownerUserId: "tenant:tenant-1:user:user-1",
    targetKey: `${targetType}#${targetId}`,
    targetType,
    targetId,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z"
  }
}

function compareForDisplay(a: ConversationHistoryItem, b: ConversationHistoryItem): number {
  if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1
  return b.updatedAt.localeCompare(a.updatedAt)
}
