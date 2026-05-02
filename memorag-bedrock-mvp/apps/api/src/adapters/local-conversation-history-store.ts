import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { CONVERSATION_HISTORY_SCHEMA_VERSION, type ConversationHistoryItem } from "../types.js"
import type { ConversationHistoryStore, SaveConversationHistoryInput } from "./conversation-history-store.js"

type StoredConversationHistoryItem = Omit<ConversationHistoryItem, "schemaVersion"> & {
  schemaVersion?: typeof CONVERSATION_HISTORY_SCHEMA_VERSION
  userId: string
}

type DbFile = {
  conversations: StoredConversationHistoryItem[]
}

export class LocalConversationHistoryStore implements ConversationHistoryStore {
  private readonly filePath: string

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "conversation-history.json")
  }

  async save(userId: string, input: SaveConversationHistoryInput): Promise<ConversationHistoryItem> {
    const item: StoredConversationHistoryItem = {
      ...input,
      schemaVersion: input.schemaVersion ?? CONVERSATION_HISTORY_SCHEMA_VERSION,
      userId,
      updatedAt: input.updatedAt || new Date().toISOString(),
      messages: input.messages.slice(0, 100)
    }
    const db = await this.load()
    const otherUsers = db.conversations.filter((conversation) => conversation.userId !== userId)
    const currentUser = [item, ...db.conversations.filter((conversation) => conversation.userId === userId && conversation.id !== item.id)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20)
    db.conversations = [...currentUser, ...otherUsers]
    await this.saveFile(db)
    return stripUserId(item)
  }

  async list(userId: string): Promise<ConversationHistoryItem[]> {
    const db = await this.load()
    return db.conversations
      .filter((conversation) => conversation.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20)
      .map(stripUserId)
  }

  async delete(userId: string, id: string): Promise<void> {
    const db = await this.load()
    db.conversations = db.conversations.filter((conversation) => conversation.userId !== userId || conversation.id !== id)
    await this.saveFile(db)
  }

  private async load(): Promise<DbFile> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf-8")) as DbFile
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
      return { conversations: [] }
    }
  }

  private async saveFile(db: DbFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(db, null, 2))
  }
}

function stripUserId(item: StoredConversationHistoryItem): ConversationHistoryItem {
  const { userId: _userId, ...conversation } = item
  return {
    ...conversation,
    schemaVersion: conversation.schemaVersion ?? CONVERSATION_HISTORY_SCHEMA_VERSION
  }
}
