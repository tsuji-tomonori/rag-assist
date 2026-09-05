import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { ConversationHistoryItemSchema as SharedSchema } from "@memorag-mvp/contract"
import { ConversationHistoryItemSchema as ApiSchema } from "../schemas.js"
import { LocalConversationHistoryStore } from "./local-conversation-history-store.js"
import { DynamoDbConversationHistoryStore } from "./dynamodb-conversation-history-store.js"
import { normalizeConversationHistoryInput, readConversationHistoryVersion } from "./conversation-history-store.js"

const base = {
  id: "session-a", title: "会話", updatedAt: "2026-09-05T00:00:00.000Z", isFavorite: true,
  messages: [{ messageId: "m1", role: "user" as const, text: "質問", createdAt: "2026-09-05T00:00:00.000Z" }],
  rollingSummary: "要約", queryFocusedSummary: "焦点", citationMemory: [{ citation: { documentId: "doc-a" } }],
  decontextualizedQuery: { originalQuestion: "質問", standaloneQuestion: "独立質問", retrievalQueries: ["検索"] },
  taskState: { status: "in_progress" as const, pendingActions: ["確認"] }, toolInvocations: [],
  sessionDocumentContext: { schemaVersion: 1 as const, sessionId: "session-a", updatedAt: "2026-09-05T00:00:00.000Z", temporaryEvidence: [] }
}
for (const version of [undefined, 1, 2, 3] as const) {
  test(`history ${version ?? "missing"} reads without writes and saves v3 without losing state`, async () => {
    const input = { ...base, ...(version === undefined ? {} : { schemaVersion: version }) }
    assert.deepEqual(ApiSchema.parse(input), SharedSchema.parse(input))
    assert.equal(SharedSchema.parse(input).schemaVersion, version ?? 1)
    const directory = await mkdtemp(path.join(tmpdir(), "history-migration-"))
    const file = path.join(directory, "conversation-history.json")
    const stored = { ...input, userId: "tenant:a:user:a" }
    const original = JSON.stringify({ conversations: [stored] })
    await writeFile(file, original)
    const local = new LocalConversationHistoryStore(directory)
    const commands: Array<GetItemCommand | QueryCommand | PutItemCommand> = []
    const dynamo = new DynamoDbConversationHistoryStore("history", { send: async (command: GetItemCommand | QueryCommand | PutItemCommand) => {
      commands.push(command)
      if (command instanceof GetItemCommand) return { Item: marshall(stored) }
      if (command instanceof QueryCommand) return { Items: [marshall(stored)] }
      return {}
    } } as never)
    try {
      for (const store of [local, dynamo]) {
        const read = await store.get(stored.userId, base.id)
        assert.deepEqual(read, { ...input, schemaVersion: version ?? 1 })
        assert.deepEqual(await store.list(stored.userId), [read])
      }
      assert.equal(await readFile(file, "utf8"), original)
      assert.equal(commands.some((command) => command instanceof PutItemCommand), false)
      assert.equal(await local.get("tenant:b:user:a", base.id), undefined)
      for (const store of [local, dynamo]) assert.deepEqual(await store.save(stored.userId, input), { ...base, schemaVersion: 3 })
      const put = commands.find((command) => command instanceof PutItemCommand) as PutItemCommand
      assert.deepEqual(unmarshall(put.input.Item!), { ...base, schemaVersion: 3, userId: stored.userId })
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
}
test("unknown versions cannot be read or silently promoted", () => {
  for (const schemaVersion of [0, 4, "3", null]) {
    assert.equal(ApiSchema.safeParse({ ...base, schemaVersion }).success, false)
    assert.equal(SharedSchema.safeParse({ ...base, schemaVersion }).success, false)
    assert.throws(() => readConversationHistoryVersion(schemaVersion), /Unsupported/)
    assert.throws(() => normalizeConversationHistoryInput({ ...base, schemaVersion } as never), /Unsupported/)
  }
})
