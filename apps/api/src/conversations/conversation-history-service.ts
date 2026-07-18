import type { ConversationHistoryStore, SaveConversationHistoryInput } from "../adapters/conversation-history-store.js"
import type { FavoriteStore } from "../adapters/favorite-store.js"
import type { AppUser } from "../auth.js"
import type { ConversationHistoryItem } from "../types.js"

export type ConversationHistorySubject = AppUser | string

export type ConversationHistoryServiceDependencies = {
  conversationHistoryStore: Pick<ConversationHistoryStore, "save" | "list" | "get" | "delete">
  favoriteStore: Pick<FavoriteStore, "list">
  ownerKey: (subject: ConversationHistorySubject, tenantId?: string) => string
  resolveSessionDocumentContext: (
    subject: ConversationHistorySubject,
    input: SaveConversationHistoryInput,
    ownerKey: string
  ) => Promise<ConversationHistoryItem["sessionDocumentContext"]>
  normalize: (input: SaveConversationHistoryInput) => ConversationHistoryItem
  compareForDisplay: (a: ConversationHistoryItem, b: ConversationHistoryItem) => number
}

export class ConversationHistoryService {
  constructor(private readonly deps: ConversationHistoryServiceDependencies) {}

  async save(
    subject: ConversationHistorySubject,
    input: SaveConversationHistoryInput,
    tenantId?: string
  ): Promise<ConversationHistoryItem> {
    const ownerKey = this.deps.ownerKey(subject, tenantId)
    const sessionDocumentContext = await this.deps.resolveSessionDocumentContext(subject, input, ownerKey)
    return this.deps.conversationHistoryStore.save(ownerKey, {
      ...input,
      sessionDocumentContext,
      isFavorite: false
    })
  }

  async list(subject: ConversationHistorySubject, tenantId?: string): Promise<ConversationHistoryItem[]> {
    const ownerKey = this.deps.ownerKey(subject, tenantId)
    const [history, favorites] = await Promise.all([
      this.deps.conversationHistoryStore.list(ownerKey),
      this.deps.favoriteStore.list(ownerKey)
    ])
    const favoriteChatSessionIds = new Set(favorites
      .filter((favorite) => favorite.targetType === "chatSession")
      .map((favorite) => favorite.targetId))
    return history
      .map((item) => ({
        ...this.deps.normalize(item),
        isFavorite: favoriteChatSessionIds.has(item.id)
      }))
      .sort(this.deps.compareForDisplay)
      .slice(0, 20)
  }

  async get(
    subject: ConversationHistorySubject,
    id: string,
    tenantId?: string
  ): Promise<ConversationHistoryItem | undefined> {
    const item = await this.deps.conversationHistoryStore.get(this.deps.ownerKey(subject, tenantId), id)
    return item ? this.deps.normalize(item) : undefined
  }

  async delete(subject: ConversationHistorySubject, id: string, tenantId?: string): Promise<boolean> {
    const ownerKey = this.deps.ownerKey(subject, tenantId)
    if (!(await this.deps.conversationHistoryStore.get(ownerKey, id))) return false
    await this.deps.conversationHistoryStore.delete(ownerKey, id)
    return true
  }
}
