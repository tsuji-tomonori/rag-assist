import type { ConversationHistoryStore } from "../adapters/conversation-history-store.js"
import type { FavoriteStore, SaveFavoriteInput } from "../adapters/favorite-store.js"
import type { AppUser } from "../auth.js"
import type { FavoriteItem, FavoriteListItem, FavoriteTargetType } from "../types.js"

export type FavoriteDocumentReference = {
  documentId: string
  fileName: string
}

export type FavoriteFolderReference = {
  groupId: string
  name: string
  canonicalPath?: string
}

export type FavoriteServicePorts = {
  favoriteStore: Pick<FavoriteStore, "save" | "list" | "delete">
  conversationHistoryStore: Pick<ConversationHistoryStore, "list">
  ownerKey: (subject: AppUser | string, tenantId?: string) => string
  listAccessibleDocuments: (user: AppUser) => Promise<readonly FavoriteDocumentReference[]>
  listAccessibleFolders: (user: AppUser) => Promise<readonly FavoriteFolderReference[]>
}

export class FavoriteService {
  constructor(private readonly ports: FavoriteServicePorts) {}

  async save(user: AppUser, input: SaveFavoriteInput): Promise<FavoriteListItem> {
    if (!favoriteTargetResolverImplemented(input.targetType)) {
      throw new Error(`Unsupported favorite target type: ${input.targetType}`)
    }
    const favorite = await this.ports.favoriteStore.save(this.ports.ownerKey(user), input)
    return this.resolveVisibility(user, favorite)
  }

  async delete(subject: AppUser | string, targetType: FavoriteTargetType, targetId: string, tenantId?: string): Promise<void> {
    await this.ports.favoriteStore.delete(this.ports.ownerKey(subject, tenantId), targetType, targetId)
  }

  async list(user: AppUser): Promise<FavoriteListItem[]> {
    const ownerKey = this.ports.ownerKey(user)
    const [favorites, history] = await Promise.all([
      this.ports.favoriteStore.list(ownerKey),
      this.ports.conversationHistoryStore.list(ownerKey)
    ])
    const historyIds = new Set(history.map((item) => item.id))
    const documents = await this.ports.listAccessibleDocuments(user)
    const documentsById = new Map(documents.map((document) => [document.documentId, document]))
    const folders = await this.ports.listAccessibleFolders(user)
    const foldersById = new Map(folders.map((folder) => [folder.groupId, folder]))
    return favorites.map((favorite) => {
      if (favorite.targetType === "chatSession") {
        return favoriteListItem(favorite, historyIds.has(favorite.targetId))
      }
      if (favorite.targetType === "document") {
        const document = documentsById.get(favorite.targetId)
        return favoriteListItem(favorite, Boolean(document), document?.fileName)
      }
      if (favorite.targetType === "folder") {
        const folder = foldersById.get(favorite.targetId)
        return favoriteListItem(favorite, Boolean(folder), folder?.canonicalPath ?? folder?.name)
      }
      return favoriteListItem(favorite, false)
    })
  }

  private async resolveVisibility(user: AppUser, favorite: FavoriteItem): Promise<FavoriteListItem> {
    if (favorite.targetType === "chatSession") {
      const history = await this.ports.conversationHistoryStore.list(this.ports.ownerKey(user))
      return favoriteListItem(favorite, history.some((item) => item.id === favorite.targetId))
    }
    if (favorite.targetType === "document") {
      const document = (await this.ports.listAccessibleDocuments(user)).find((item) => item.documentId === favorite.targetId)
      return favoriteListItem(favorite, Boolean(document), document?.fileName)
    }
    if (favorite.targetType === "folder") {
      const folder = (await this.ports.listAccessibleFolders(user)).find((item) => item.groupId === favorite.targetId)
      return favoriteListItem(favorite, Boolean(folder), folder?.canonicalPath ?? folder?.name)
    }
    return favoriteListItem(favorite, false)
  }
}

function stripFavoriteStorageKeys(favorite: FavoriteItem): Omit<FavoriteItem, "ownerUserId" | "targetKey"> {
  const { ownerUserId: _ownerUserId, targetKey: _targetKey, ...visible } = favorite
  return visible
}

function favoriteListItem(favorite: FavoriteItem, accessible: boolean, resolvedLabel?: string): FavoriteListItem {
  const visible = stripFavoriteStorageKeys(favorite)
  if (!accessible) {
    return {
      favoriteId: visible.favoriteId,
      targetType: visible.targetType,
      targetId: visible.targetId,
      accessible: false,
      label: "この項目には現在アクセスできません",
      createdAt: visible.createdAt,
      updatedAt: visible.updatedAt
    }
  }
  return {
    ...visible,
    label: resolvedLabel ?? visible.label,
    accessible: true
  }
}

function favoriteTargetResolverImplemented(targetType: FavoriteTargetType): boolean {
  return targetType === "chatSession" || targetType === "document" || targetType === "folder"
}
