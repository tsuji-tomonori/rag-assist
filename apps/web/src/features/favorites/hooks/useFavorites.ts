import { useCallback, useState } from "react"
import { deleteFavorite, listFavorites, saveFavorite } from "../api/favoritesApi.js"
import type { FavoriteItem, FavoriteTargetType } from "../types.js"

export function useFavorites({ setError }: { setError: (error: string | null) => void }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])

  const refreshFavorites = useCallback(async () => {
    setFavorites(await listFavorites())
  }, [])

  const addFavorite = useCallback(async (input: { targetType: FavoriteTargetType; targetId: string; label?: string; note?: string }) => {
    const saved = await saveFavorite(input)
    setFavorites((prev) => [saved, ...prev.filter((favorite) => !(favorite.targetType === saved.targetType && favorite.targetId === saved.targetId))])
    return saved
  }, [])

  const removeFavorite = useCallback(async (targetType: FavoriteTargetType, targetId: string) => {
    setFavorites((prev) => prev.filter((favorite) => !(favorite.targetType === targetType && favorite.targetId === targetId)))
    await deleteFavorite(targetType, targetId).catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      throw err
    })
  }, [setError])

  return { favorites, setFavorites, refreshFavorites, addFavorite, removeFavorite }
}
