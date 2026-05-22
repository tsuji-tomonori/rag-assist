import type { FavoriteItem, FavoriteTargetType } from "../types.js"

export type SaveFavoriteInput = {
  targetType: FavoriteTargetType
  targetId: string
  label?: string
  note?: string
}

export interface FavoriteStore {
  save(ownerUserId: string, input: SaveFavoriteInput): Promise<FavoriteItem>
  list(ownerUserId: string): Promise<FavoriteItem[]>
  get(ownerUserId: string, targetType: FavoriteTargetType, targetId: string): Promise<FavoriteItem | undefined>
  delete(ownerUserId: string, targetType: FavoriteTargetType, targetId: string): Promise<void>
}

export function favoriteTargetKey(targetType: FavoriteTargetType, targetId: string): string {
  return `${targetType}#${targetId}`
}
