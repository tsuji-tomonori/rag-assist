import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DocumentGroup } from "../types.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { CreateDocumentGroupInput, DocumentGroupPathLock, DocumentGroupPathUpdate, DocumentGroupStore, UpdateDocumentGroupInput } from "./document-group-store.js"

type DocumentGroupDb = {
  schemaVersion: 1 | 2
  groups: DocumentGroup[]
  pathLocks?: DocumentGroupPathLock[]
}

export class LocalDocumentGroupStore implements DocumentGroupStore {
  constructor(private readonly baseDir: string) {}

  async list(tenantId: string): Promise<DocumentGroup[]> {
    return (await this.read(tenantId)).groups
  }

  async get(tenantId: string, groupId: string): Promise<DocumentGroup | undefined> {
    return (await this.read(tenantId)).groups.find((group) => group.groupId === groupId)
  }

  async create(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read(input.tenantId)
    if (db.groups.some((group) => group.groupId === input.groupId)) throw new Error("Document group already exists")
    db.groups.push(input)
    await this.write(input.tenantId, db)
    return input
  }

  async createWithPathLock(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read(input.tenantId)
    if (db.groups.some((group) => group.groupId === input.groupId)) throw new Error("Document group already exists")
    this.assertPathAvailable(db, input)
    db.pathLocks = [...(db.pathLocks ?? []), pathLockForGroup(input)]
    db.groups.push(input)
    await this.write(input.tenantId, db)
    return input
  }

  async update(tenantId: string, groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read(tenantId)
    const index = db.groups.findIndex((group) => group.groupId === groupId)
    if (index < 0) throw new Error("Document group not found")
    const current = db.groups[index] as DocumentGroup
    const next: DocumentGroup = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    db.groups[index] = next
    await this.write(tenantId, db)
    return next
  }

  async updateWithPathLocks(tenantId: string, updates: DocumentGroupPathUpdate[]): Promise<DocumentGroup[]> {
    if (updates.length === 0) return []
    if (updates.some(({ current, next }) => current.tenantId !== tenantId || next.tenantId !== tenantId)) {
      throw new Error("Document group path update crossed a tenant boundary")
    }
    const db = await this.read(tenantId)
    const byGroupId = new Map(db.groups.map((group, index) => [group.groupId, { group, index }]))
    const nextGroups = new Map(updates.map((update) => [update.next.groupId, update.next]))
    const locks = [...(db.pathLocks ?? [])]
      .filter((lock) => !updates.some((update) => lock.lockedGroupId === update.current.groupId))
    for (const update of updates) {
      const current = byGroupId.get(update.current.groupId)
      if (!current) throw new Error("Document group not found")
      if (current.group.updatedAt !== update.current.updatedAt) throw new Error("Document group changed before path update")
      const conflictingGroup = db.groups.find((group) => (
        group.groupId !== update.current.groupId &&
        !nextGroups.has(group.groupId) &&
        group.adminPathPk === update.next.adminPathPk &&
        group.normalizedCanonicalPath === update.next.normalizedCanonicalPath
      ))
      const conflictingLock = locks.find((lock) => (
        lock.adminPathPk === update.next.adminPathPk &&
        lock.normalizedCanonicalPath === update.next.normalizedCanonicalPath &&
        lock.lockedGroupId !== update.current.groupId
      ))
      if (conflictingGroup || conflictingLock) throw new Error("Document group canonical path already exists")
      locks.push(pathLockForGroup(update.next))
    }
    const updated: DocumentGroup[] = []
    for (const update of updates) {
      const current = byGroupId.get(update.current.groupId)
      if (!current) throw new Error("Document group not found")
      db.groups[current.index] = update.next
      updated.push(update.next)
    }
    db.pathLocks = locks
    await this.write(tenantId, db)
    return updated
  }

  async findByCanonicalPath(tenantId: string, adminPathPk: string, normalizedCanonicalPath: string): Promise<DocumentGroup | undefined> {
    return (await this.read(tenantId)).groups.find((group) => group.adminPathPk === adminPathPk && group.normalizedCanonicalPath === normalizedCanonicalPath)
  }

  async listByAdminPath(tenantId: string, adminPathPk: string): Promise<DocumentGroup[]> {
    return (await this.read(tenantId)).groups.filter((group) => group.adminPathPk === adminPathPk)
  }

  private async read(tenantId: string): Promise<DocumentGroupDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(tenantId), "utf-8")) as DocumentGroupDb
      const db: DocumentGroupDb = {
        schemaVersion: raw.schemaVersion === 2 ? 2 : 1,
        groups: Array.isArray(raw.groups) ? raw.groups : [],
        pathLocks: Array.isArray(raw.pathLocks) ? raw.pathLocks : []
      }
      if (db.groups.some((group) => group.tenantId !== tenantId) || (db.pathLocks ?? []).some((lock) => lock.tenantId !== tenantId)) {
        throw new Error("Document group tenant partition is invalid")
      }
      return db
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        await this.assertNoLegacyStore()
        return { schemaVersion: 2, groups: [], pathLocks: [] }
      }
      throw err
    }
  }

  private async write(tenantId: string, db: DocumentGroupDb): Promise<void> {
    const targetPath = this.filePath(tenantId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.document-groups.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 2, groups: db.groups, pathLocks: db.pathLocks ?? [] }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(tenantId: string): string {
    return path.join(this.baseDir, "document-groups", tenantPartitionId(tenantId), "items.json")
  }

  private async assertNoLegacyStore(): Promise<void> {
    try {
      await readFile(path.join(this.baseDir, "document-groups.json"), "utf-8")
      throw new Error("Legacy unscoped document groups require tenant migration")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
  }

  private assertPathAvailable(db: DocumentGroupDb, input: DocumentGroup): void {
    const conflictingGroup = db.groups.find((group) => group.adminPathPk === input.adminPathPk && group.normalizedCanonicalPath === input.normalizedCanonicalPath)
    const conflictingLock = (db.pathLocks ?? []).find((lock) => lock.adminPathPk === input.adminPathPk && lock.normalizedCanonicalPath === input.normalizedCanonicalPath)
    if (conflictingGroup || conflictingLock) throw new Error("Document group canonical path already exists")
  }
}

function pathLockForGroup(group: DocumentGroup): DocumentGroupPathLock {
  const now = group.updatedAt || new Date().toISOString()
  return {
    tenantId: group.tenantId,
    groupId: pathLockId(group.adminPathPk ?? "", group.normalizedCanonicalPath ?? ""),
    itemType: "documentGroupPathLock",
    adminPathPk: group.adminPathPk ?? "",
    normalizedCanonicalPath: group.normalizedCanonicalPath ?? "",
    lockedGroupId: group.groupId,
    createdAt: group.createdAt || now,
    updatedAt: now
  }
}

function pathLockId(adminPathPk: string, normalizedCanonicalPath: string): string {
  return `pathlock#${encodeURIComponent(adminPathPk)}#${encodeURIComponent(normalizedCanonicalPath)}`
}
