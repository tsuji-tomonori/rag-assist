import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { UserGroup } from "../types.js"
import type { UserGroupStore } from "./user-group-store.js"

type UserGroupDb = {
  schemaVersion: 1
  groups: UserGroup[]
}

export class LocalUserGroupStore implements UserGroupStore {
  constructor(private readonly baseDir: string) {}

  async list(): Promise<UserGroup[]> {
    return (await this.read()).groups
  }

  async get(groupId: string): Promise<UserGroup | undefined> {
    return (await this.read()).groups.find((group) => group.groupId === groupId)
  }

  async save(group: UserGroup): Promise<UserGroup> {
    const db = await this.read()
    const next = { ...group, itemType: "userGroup" as const }
    const index = db.groups.findIndex((item) => item.groupId === next.groupId)
    if (index >= 0) db.groups[index] = next
    else db.groups.push(next)
    await this.write(db)
    return next
  }

  async archive(groupId: string, updatedAt: string): Promise<UserGroup> {
    const db = await this.read()
    const index = db.groups.findIndex((group) => group.groupId === groupId)
    if (index < 0) throw new Error("User group not found")
    const next: UserGroup = { ...db.groups[index] as UserGroup, status: "archived", updatedAt }
    db.groups[index] = next
    await this.write(db)
    return next
  }

  private async read(): Promise<UserGroupDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(), "utf-8")) as Partial<UserGroupDb>
      return {
        schemaVersion: 1,
        groups: Array.isArray(raw.groups) ? raw.groups : []
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, groups: [] }
      throw err
    }
  }

  private async write(db: UserGroupDb): Promise<void> {
    const targetPath = this.filePath()
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.user-groups.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 1, groups: db.groups }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(): string {
    return path.join(this.baseDir, "user-groups.json")
  }
}
