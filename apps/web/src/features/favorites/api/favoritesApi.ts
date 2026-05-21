import { del, get, post } from "../../../shared/api/http.js"
import type { FavoriteItem, FavoriteTargetType } from "../types.js"

export async function listFavorites(): Promise<FavoriteItem[]> {
  const result = await get<{ favorites?: FavoriteItem[] }>("/favorites")
  return result.favorites ?? []
}

export async function saveFavorite(input: { targetType: FavoriteTargetType; targetId: string; label?: string; note?: string }): Promise<FavoriteItem> {
  return post<FavoriteItem>("/favorites", input)
}

export async function deleteFavorite(targetType: FavoriteTargetType, targetId: string): Promise<void> {
  return del(`/favorites/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`)
}
