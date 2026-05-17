import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DocumentGroup } from "../types.js"
import type { CreateDocumentGroupInput, DocumentGroupPathLock, DocumentGroupPathUpdate, DocumentGroupStore, UpdateDocumentGroupInput } from "./document-group-store.js"

type DocumentGroupDb = {
  schemaVersion: 1 | 2
  groups: DocumentGroup[]
  pathLocks?: DocumentGroupPathLock[]
}

export class LocalDocumentGroupStore implements DocumentGroupStore {
  constructor(private readonly baseDir: string) {}

  async list(): Promise<DocumentGroup[]> {
    return (await this.read()).groups
  }

  async get(groupId: string): Promise<DocumentGroup | undefined> {
    return (await this.read()).groups.find((group) => group.groupId === groupId)
  }

  async create(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read()
    if (db.groups.some((group) => group.groupId === input.groupId)) throw new Error("Document group already exists")
    db.groups.push(input)
    await this.write(db)
    return input
  }

  async createWithPathLock(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read()
    if (db.groups.some((group) => group.groupId === input.groupId)) throw new Error("Document group already exists")
    this.assertPathAvailable(db, input)
    db.pathLocks = [...(db.pathLocks ?? []), pathLockForGroup(input)]
    db.groups.push(input)
    await this.write(db)
    return input
  }

  async update(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read()
    const index = db.groups.findIndex((group) => group.groupId === groupId)
    if (index < 0) throw new Error("Document group not found")
    const current = db.groups[index] as DocumentGroup
    const next: DocumentGroup = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    db.groups[index] = next
    await this.write(db)
    return next
  }

  async updateWithPathLocks(updates: DocumentGroupPathUpdate[]): Promise<DocumentGroup[]> {
    if (updates.length === 0) return []
    const db = await this.read()
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
    await this.write(db)
    return updated
  }

  async findByCanonicalPath(adminPathPk: string, normalizedCanonicalPath: string): Promise<DocumentGroup | undefined> {
    return (await this.read()).groups.find((group) => group.adminPathPk === adminPathPk && group.normalizedCanonicalPath === normalizedCanonicalPath)
  }

  async listByAdminPath(adminPathPk: string): Promise<DocumentGroup[]> {
    return (await this.read()).groups.filter((group) => group.adminPathPk === adminPathPk)
  }

  private async read(): Promise<DocumentGroupDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(), "utf-8")) as DocumentGroupDb
      return {
        schemaVersion: raw.schemaVersion === 2 ? 2 : 1,
        groups: Array.isArray(raw.groups) ? raw.groups : [],
        pathLocks: Array.isArray(raw.pathLocks) ? raw.pathLocks : []
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 2, groups: [], pathLocks: [] }
      throw err
    }
  }

  private async write(db: DocumentGroupDb): Promise<void> {
    const targetPath = this.filePath()
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.document-groups.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 2, groups: db.groups, pathLocks: db.pathLocks ?? [] }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(): string {
    return path.join(this.baseDir, "document-groups.json")
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
