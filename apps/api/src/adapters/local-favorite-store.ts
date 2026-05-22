import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { FavoriteItem, FavoriteTargetType } from "../types.js"
import { favoriteTargetKey, type FavoriteStore, type SaveFavoriteInput } from "./favorite-store.js"

type DbFile = {
  favorites: FavoriteItem[]
}

export class LocalFavoriteStore implements FavoriteStore {
  private readonly filePath: string

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "favorites.json")
  }

  async save(ownerUserId: string, input: SaveFavoriteInput): Promise<FavoriteItem> {
    const db = await this.load()
    const now = new Date().toISOString()
    const targetKey = favoriteTargetKey(input.targetType, input.targetId)
    const existing = db.favorites.find((favorite) => favorite.ownerUserId === ownerUserId && favorite.targetKey === targetKey)
    const item: FavoriteItem = {
      favoriteId: existing?.favoriteId ?? stableFavoriteId(ownerUserId, targetKey),
      ownerUserId,
      targetKey,
      targetType: input.targetType,
      targetId: input.targetId,
      label: input.label ?? existing?.label,
      note: input.note ?? existing?.note,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    db.favorites = [item, ...db.favorites.filter((favorite) => !(favorite.ownerUserId === ownerUserId && favorite.targetKey === targetKey))]
    await this.saveDb(db)
    return item
  }

  async list(ownerUserId: string): Promise<FavoriteItem[]> {
    const db = await this.load()
    return db.favorites.filter((favorite) => favorite.ownerUserId === ownerUserId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(ownerUserId: string, targetType: FavoriteTargetType, targetId: string): Promise<FavoriteItem | undefined> {
    const db = await this.load()
    const targetKey = favoriteTargetKey(targetType, targetId)
    return db.favorites.find((favorite) => favorite.ownerUserId === ownerUserId && favorite.targetKey === targetKey)
  }

  async delete(ownerUserId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    const db = await this.load()
    const targetKey = favoriteTargetKey(targetType, targetId)
    db.favorites = db.favorites.filter((favorite) => !(favorite.ownerUserId === ownerUserId && favorite.targetKey === targetKey))
    await this.saveDb(db)
  }

  private async load(): Promise<DbFile> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf-8")) as DbFile
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
      return { favorites: [] }
    }
  }

  private async saveDb(db: DbFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(db, null, 2))
  }
}

function stableFavoriteId(ownerUserId: string, targetKey: string): string {
  return `fav-${createHash("sha256").update(`${ownerUserId}\0${targetKey}`).digest("hex").slice(0, 24)}`
}
