export type FavoriteTargetType =
  | "chatSession"
  | "chatMessage"
  | "folder"
  | "document"
  | "agentExecutionPreset"
  | "skill"
  | "agentProfile"
  | "benchmarkRun"

export type FavoriteItem = {
  favoriteId: string
  targetType: FavoriteTargetType
  targetId: string
  label?: string
  note?: string
  accessible: boolean
  createdAt?: string
  updatedAt?: string
}
