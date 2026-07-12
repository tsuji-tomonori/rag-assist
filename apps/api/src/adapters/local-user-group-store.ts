import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { UserGroup } from "../types.js"
import type { UserGroupStore } from "./user-group-store.js"

type UserGroupDb = {
  schemaVersion: 1
  groups: UserGroup[]
}

const userGroupWriteQueues = new Map<string, Promise<void>>()

export class LocalUserGroupStore implements UserGroupStore {
  constructor(private readonly baseDir: string) {}

  async list(tenantId: string): Promise<UserGroup[]> {
    return (await this.read(tenantId)).groups
  }

  async get(tenantId: string, groupId: string): Promise<UserGroup | undefined> {
    return (await this.read(tenantId)).groups.find((group) => group.groupId === groupId)
  }

  async create(group: UserGroup): Promise<UserGroup> {
    return runUserGroupWrite(this.filePath(group.tenantId), async () => {
      const db = await this.read(group.tenantId)
      if (db.groups.some((candidate) => candidate.groupId === group.groupId)) throw userGroupConflictError(group.groupId)
      const next = { ...group, itemType: "userGroup" as const }
      db.groups.push(next)
      await this.write(group.tenantId, db)
      return next
    })
  }

  async save(group: UserGroup): Promise<UserGroup> {
    return runUserGroupWrite(this.filePath(group.tenantId), async () => {
      const db = await this.read(group.tenantId)
      const next = { ...group, itemType: "userGroup" as const }
      const index = db.groups.findIndex((item) => item.groupId === next.groupId)
      if (index >= 0) db.groups[index] = next
      else db.groups.push(next)
      await this.write(group.tenantId, db)
      return next
    })
  }

  async replace(group: UserGroup, expectedUpdatedAt: string): Promise<UserGroup> {
    return runUserGroupWrite(this.filePath(group.tenantId), async () => {
      const db = await this.read(group.tenantId)
      const index = db.groups.findIndex((candidate) => candidate.groupId === group.groupId)
      if (index < 0 || db.groups[index]?.updatedAt !== expectedUpdatedAt) throw userGroupConflictError(group.groupId)
      const next = { ...group, itemType: "userGroup" as const }
      db.groups[index] = next
      await this.write(group.tenantId, db)
      return next
    })
  }

  async archive(tenantId: string, groupId: string, updatedAt: string): Promise<UserGroup> {
    return runUserGroupWrite(this.filePath(tenantId), async () => {
      const db = await this.read(tenantId)
      const index = db.groups.findIndex((group) => group.groupId === groupId)
      if (index < 0) throw new Error("User group not found")
      const next: UserGroup = { ...db.groups[index] as UserGroup, status: "archived", updatedAt }
      db.groups[index] = next
      await this.write(tenantId, db)
      return next
    })
  }

  private async read(tenantId: string): Promise<UserGroupDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(tenantId), "utf-8")) as Partial<UserGroupDb>
      const db: UserGroupDb = {
        schemaVersion: 1,
        groups: Array.isArray(raw.groups) ? raw.groups : []
      }
      if (db.groups.some((group) => group.tenantId !== tenantId)) {
        throw new Error("User group tenant partition is invalid")
      }
      return db
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        await this.assertNoLegacyStore()
        return { schemaVersion: 1, groups: [] }
      }
      throw err
    }
  }

  private async write(tenantId: string, db: UserGroupDb): Promise<void> {
    if (db.groups.some((group) => group.tenantId !== tenantId)) throw new Error("User group tenant partition is invalid")
    const targetPath = this.filePath(tenantId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.user-groups.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 1, groups: db.groups }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(tenantId: string): string {
    return path.join(this.baseDir, "user-groups", tenantPartitionId(tenantId), "items.json")
  }

  private async assertNoLegacyStore(): Promise<void> {
    try {
      await readFile(path.join(this.baseDir, "user-groups.json"), "utf-8")
      throw new Error("Legacy unscoped user groups require tenant migration")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
  }
}

async function runUserGroupWrite<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = userGroupWriteQueues.get(filePath) ?? Promise.resolve()
  let release: () => void = () => undefined
  const current = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => current, () => current)
  userGroupWriteQueues.set(filePath, queued)
  await previous.catch(() => undefined)
  try {
    return await task()
  } finally {
    release()
    if (userGroupWriteQueues.get(filePath) === queued) userGroupWriteQueues.delete(filePath)
  }
}

function userGroupConflictError(groupId: string): Error {
  return Object.assign(new Error(`User group changed for ${groupId}`), { code: "PRECONDITION_FAILED" })
}
