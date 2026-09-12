import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type { ConversationHistoryItem, FavoriteItem, FavoriteTargetType } from "../types.js"
import type { AppUser } from "../auth.js"
import { FavoriteService, type FavoriteServicePorts } from "./favorite-service.js"

const user: AppUser = {
  userId: "user-1",
  tenantId: "tenant-a",
  accountStatus: "active",
  cognitoGroups: ["CHAT_USER"]
}

test("FavoriteService source depends on narrow ports rather than whole Dependencies or AWS clients", () => {
  const source = readFileSync(fileURLToPath(new URL("./favorite-service.ts", import.meta.url)), "utf8")

  assert.doesNotMatch(source, /\bDependencies\b/)
  assert.doesNotMatch(source, /@aws-sdk\//)
})

test("FavoriteService uses the tenant owner port and redacts storage-only keys", async () => {
  const fixture = createFixture()
  fixture.history.push(conversation("chat-1"))

  const favorite = await fixture.service.save(user, {
    targetType: "chatSession",
    targetId: "chat-1",
    label: "会話"
  })

  assert.equal(fixture.ownerKeyCalls.length, 2)
  assert.deepEqual(fixture.ownerKeyCalls[0], { subject: user, tenantId: undefined })
  assert.equal(fixture.savedOwnerKeys[0], "tenant:tenant-a:user:user-1")
  assert.deepEqual(favorite, {
    favoriteId: "favorite-1",
    targetType: "chatSession",
    targetId: "chat-1",
    label: "会話",
    note: undefined,
    accessible: true,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  })
  assert.equal("ownerUserId" in favorite, false)
  assert.equal("targetKey" in favorite, false)
})

test("FavoriteService rejects unsupported targets before persistence", async () => {
  const fixture = createFixture()

  await assert.rejects(
    () => fixture.service.save(user, { targetType: "skill", targetId: "skill-1" }),
    /Unsupported favorite target type: skill/
  )

  assert.deepEqual(fixture.savedOwnerKeys, [])
  assert.deepEqual(fixture.favorites, [])
})

test("FavoriteService resolves accessible targets and masks inaccessible targets", async () => {
  const fixture = createFixture()
  fixture.history.push(conversation("chat-1"))
  fixture.documents.push({ documentId: "document-1", fileName: "設計書.pdf" })
  fixture.folders.push({ groupId: "folder-1", name: "設計", canonicalPath: "/共有/設計" })
  fixture.favorites.push(
    storedFavorite("favorite-chat", "chatSession", "chat-1", "保存会話"),
    storedFavorite("favorite-document", "document", "document-1", "旧文書名"),
    storedFavorite("favorite-folder", "folder", "folder-1", "旧folder名"),
    storedFavorite("favorite-missing", "document", "document-missing", "非表示文書", "secret note"),
    storedFavorite("favorite-unsupported", "skill", "skill-1", "Skill", "secret note")
  )

  const favorites = await fixture.service.list(user)

  assert.deepEqual(favorites.map(({ favoriteId, accessible, label, note }) => ({ favoriteId, accessible, label, note })), [
    { favoriteId: "favorite-chat", accessible: true, label: "保存会話", note: undefined },
    { favoriteId: "favorite-document", accessible: true, label: "設計書.pdf", note: undefined },
    { favoriteId: "favorite-folder", accessible: true, label: "/共有/設計", note: undefined },
    { favoriteId: "favorite-missing", accessible: false, label: "この項目には現在アクセスできません", note: undefined },
    { favoriteId: "favorite-unsupported", accessible: false, label: "この項目には現在アクセスできません", note: undefined }
  ])
  assert.ok(favorites.every((favorite) => !("ownerUserId" in favorite) && !("targetKey" in favorite)))
})

test("FavoriteService preserves the explicit tenant when deleting by subject id", async () => {
  const fixture = createFixture()

  await fixture.service.delete("user-2", "document", "document-2", "tenant-b")

  assert.deepEqual(fixture.ownerKeyCalls, [{ subject: "user-2", tenantId: "tenant-b" }])
  assert.deepEqual(fixture.deleted, [{ ownerKey: "tenant:tenant-b:user:user-2", targetType: "document", targetId: "document-2" }])
})

function createFixture() {
  const favorites: FavoriteItem[] = []
  const history: ConversationHistoryItem[] = []
  const documents: Array<{ documentId: string; fileName: string }> = []
  const folders: Array<{ groupId: string; name: string; canonicalPath?: string }> = []
  const savedOwnerKeys: string[] = []
  const ownerKeyCalls: Array<{ subject: AppUser | string; tenantId: string | undefined }> = []
  const deleted: Array<{ ownerKey: string; targetType: FavoriteTargetType; targetId: string }> = []
  const ports: FavoriteServicePorts = {
    favoriteStore: {
      save: async (ownerKey, input) => {
        savedOwnerKeys.push(ownerKey)
        const favorite = storedFavorite("favorite-1", input.targetType, input.targetId, input.label, input.note)
        favorites.push(favorite)
        return favorite
      },
      list: async () => favorites,
      delete: async (ownerKey, targetType, targetId) => {
        deleted.push({ ownerKey, targetType, targetId })
      }
    },
    conversationHistoryStore: { list: async () => history },
    ownerKey: (subject, tenantId) => {
      ownerKeyCalls.push({ subject, tenantId })
      const userId = typeof subject === "string" ? subject : subject.userId
      const authoritativeTenantId = typeof subject === "string" ? tenantId : subject.tenantId
      return `tenant:${authoritativeTenantId}:user:${userId}`
    },
    listAccessibleDocuments: async () => documents,
    listAccessibleFolders: async () => folders
  }
  return {
    service: new FavoriteService(ports),
    favorites,
    history,
    documents,
    folders,
    savedOwnerKeys,
    ownerKeyCalls,
    deleted
  }
}

function storedFavorite(
  favoriteId: string,
  targetType: FavoriteTargetType,
  targetId: string,
  label?: string,
  note?: string
): FavoriteItem {
  return {
    favoriteId,
    ownerUserId: "tenant:tenant-a:user:user-1",
    targetKey: `${targetType}#${targetId}`,
    targetType,
    targetId,
    label,
    note,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}

function conversation(id: string): ConversationHistoryItem {
  return {
    schemaVersion: 2,
    id,
    title: id,
    messages: [],
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}
